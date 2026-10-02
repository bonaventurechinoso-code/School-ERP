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
