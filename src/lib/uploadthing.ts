import { UTApi } from "uploadthing/server";

let cachedUTApi: UTApi | null = null;

/**
 * Initializes and returns the UTApi instance using UPLOADTHING_TOKEN.
 * Returns null if the token is not configured in environment variables.
 */
export function getUploadthingApi(): UTApi | null {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token || !token.trim()) {
    return null;
  }
  if (!cachedUTApi) {
    try {
      cachedUTApi = new UTApi({ token: token.trim() });
    } catch (err) {
      console.error("[UPLOADTHING_INIT_ERROR]:", err);
      return null;
    }
  }
  return cachedUTApi;
}

export interface UploadResult {
  url: string;
  key: string;
  name: string;
  size: number;
}

/**
 * Uploads a standard Web API File to Uploadthing.
 * Returns the public URL, file key, and metadata, or null if upload fails or token is missing.
 */
export async function uploadToUploadthing(
  file: File,
  customName?: string
): Promise<UploadResult | null> {
  const utapi = getUploadthingApi();
  if (!utapi) {
    return null;
  }

  try {
    const fileToUpload = customName
      ? new File([await file.arrayBuffer()], customName, { type: file.type })
      : file;

    const response = await utapi.uploadFiles(fileToUpload);
    if (response && response.data) {
      const publicUrl = response.data.url || (response.data as any).ufsUrl || (response.data as any).appUrl;
      if (publicUrl) {
        return {
          url: publicUrl,
          key: response.data.key,
          name: response.data.name || customName || file.name,
          size: response.data.size || file.size,
        };
      }
    }

    if (response && response.error) {
      console.error("[UPLOADTHING_UPLOAD_ERROR]:", response.error);
    }
    return null;
  } catch (error) {
    console.error("[UPLOADTHING_EXCEPTION]:", error);
    return null;
  }
}

export interface UploadthingFileInfo {
  key: string;
  name: string;
  url: string;
  size: number;
}

let cachedFileList: { files: UploadthingFileInfo[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60000; // 60s cache

/**
 * Searches for a file on Uploadthing by exact name, suffix, or KYC category.
 * Prevents continuous API spam using an in-memory cache.
 */
export async function findFileInUploadthing(
  fileNameOrPattern: string
): Promise<UploadthingFileInfo | null> {
  const utapi = getUploadthingApi();
  if (!utapi) return null;

  const now = Date.now();
  if (!cachedFileList || now - cachedFileList.timestamp > CACHE_TTL_MS) {
    try {
      const res = await utapi.listFiles({ limit: 500 });
      if (res && Array.isArray(res.files)) {
        cachedFileList = {
          files: res.files.map((f: any) => ({
            key: f.key,
            name: f.name,
            url: `https://utfs.io/f/${f.key}`,
            size: f.size,
          })),
          timestamp: now,
        };
      }
    } catch (err) {
      console.error("[UPLOADTHING_LIST_FILES_ERROR]:", err);
    }
  }

  if (!cachedFileList || cachedFileList.files.length === 0) return null;

  const target = fileNameOrPattern.toLowerCase();

  // 1. Exact name match
  const exact = cachedFileList.files.find((f) => f.name.toLowerCase() === target);
  if (exact) return exact;

  // 2. Trailing or substring match
  const bySub = cachedFileList.files.find(
    (f) => target.endsWith(f.name.toLowerCase()) || target.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(target)
  );
  if (bySub) return bySub;

  // 3. Category match for standard admissions KYC documents
  const categories = [
    { key: "passport", test: (n: string) => n.includes("passport") },
    { key: "academic", test: (n: string) => n.includes("academic") || n.includes("result") || n.includes("transcript") },
    { key: "birth", test: (n: string) => n.includes("birth") || n.includes("age") },
    { key: "medical", test: (n: string) => n.includes("medical") || n.includes("fitness") },
  ];

  for (const cat of categories) {
    if (cat.test(target)) {
      const match = cachedFileList.files.find((f) => cat.test(f.name.toLowerCase()));
      if (match) return match;
    }
  }

  return null;
}

