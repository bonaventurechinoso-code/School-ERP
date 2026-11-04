import crypto from "crypto";

export interface UploadResult {
  url: string;
  publicId?: string;
  data?: string; // Base64 backup for permanent database persistence
  mimeType: string;
  size: number;
  checksum: string;
}

export interface StorageAdapter {
  readonly providerName: string;
  upload(buffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult>;
}

/**
 * Validates file magic bytes to prevent MIME spoofing attacks
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  // JPEG / JPG: FF D8 FF
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (mimeType.includes("png")) {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  // PDF: %PDF (25 50 44 46)
  if (mimeType.includes("pdf")) {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // WebP: RIFF .... WEBP
  if (mimeType.includes("webp")) {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

/**
 * 1. Base64 Database Storage Adapter (100% Persistence, 0 External Dependencies)
 * Guaranteed to never 404 after unlimited Render deploys.
 */
export class Base64DBStorage implements StorageAdapter {
  readonly providerName = "Base64DB";

  async upload(buffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    const base64 = buffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    return {
      url: dataUri,
      data: base64,
      mimeType,
      size: buffer.length,
      checksum,
    };
  }
}

/**
 * 2. Cloudinary Enterprise Cloud Storage Adapter
 * Used whenever Cloudinary credentials are provided in Render environment variables.
 * Falls back to Base64DBStorage if the external API is unreachable.
 */
export class CloudinaryStorage implements StorageAdapter {
  readonly providerName = "Cloudinary";
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private fallback: Base64DBStorage;

  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.fallback = new Base64DBStorage();
  }

  async upload(buffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const base64 = buffer.toString("base64");

    try {
      const timestamp = Math.round(Date.now() / 1000);
      const folder = "bonavee/payment-proofs";
      const paramsToSign = `folder=${folder}&timestamp=${timestamp}${this.apiSecret}`;
      const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

      const endpoint = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;

      const formData = new FormData();
      formData.append("file", `data:${mimeType};base64,${base64}`);
      formData.append("api_key", this.apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", folder);

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.warn(`[STORAGE_WARN] Cloudinary upload HTTP ${res.status}: ${errorText}. Falling back to Base64.`);
        return this.fallback.upload(buffer, fileName, mimeType);
      }

      const json = await res.json();
      return {
        url: json.secure_url || json.url,
        publicId: json.public_id,
        data: base64, // Keep database backup even when cloud upload succeeds
        mimeType,
        size: buffer.length,
        checksum,
      };
    } catch (err) {
      console.warn("[STORAGE_WARN] Cloudinary exception, falling back to Base64:", err);
      return this.fallback.upload(buffer, fileName, mimeType);
    }
  }
}

/**
 * 3. UploadThing Persistent Storage Adapter
 * Used whenever UPLOADTHING_TOKEN is present in Render environment variables.
 * Falls back to Base64DBStorage if upload fails or times out.
 */
export class UploadthingStorage implements StorageAdapter {
  readonly providerName = "UploadThing";
  private fallback: Base64DBStorage;

  constructor() {
    this.fallback = new Base64DBStorage();
  }

  async upload(buffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    console.log(`[STORAGE] UPLOADTHING_TOKEN present? ${!!process.env.UPLOADTHING_TOKEN}`);
    try {
      if (!process.env.UPLOADTHING_TOKEN) {
        console.warn("[STORAGE_WARN] UPLOADTHING_TOKEN missing, falling back to Base64.");
        return this.fallback.upload(buffer, fileName, mimeType);
      }
      const { uploadToUploadthing } = await import("@/lib/uploadthing");
      const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });
      const utResult = await uploadToUploadthing(file, fileName);
      if (utResult && utResult.url) {
        return {
          url: utResult.url,
          publicId: utResult.key,
          data: buffer.toString("base64"),
          mimeType,
          size: buffer.length,
          checksum,
        };
      }
    } catch (err) {
      console.warn("[STORAGE_WARN] Uploadthing exception, falling back to Base64:", err);
    }
    return this.fallback.upload(buffer, fileName, mimeType);
  }
}

/**
 * Factory returning the optimal Storage implementation:
 * Always use UploadThing as the primary cloud storage adapter on Render.
 * Cloudinary does not exist on Render and must NEVER overwrite UploadThing.
 * Falls back to Base64DBStorage automatically if token is missing or external upload fails.
 */
export function getStorage(): StorageAdapter {
  return new UploadthingStorage();
}

