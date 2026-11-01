import crypto from "crypto";
import fs from "fs";
import path from "path";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const SIGNING_SECRET =
  process.env.STORAGE_SIGNING_SECRET ||
  process.env.JWT_SECRET_KEY ||
  process.env.NEXTAUTH_SECRET ||
  "bonavee-enterprise-admissions-secure-storage-key-2026";

/**
 * Validates file magic bytes to prevent MIME spoofing attacks.
 * Strictly permits PDF, JPG, and PNG only.
 */
export function validateAdmissionsMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  const normalizedMime = mimeType.toLowerCase().trim();

  // PDF: %PDF (25 50 44 46)
  if (normalizedMime === "application/pdf") {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // JPEG / JPG: FF D8 FF
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (normalizedMime === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  return false;
}

export function validateAdmissionsFile(
  buffer: Buffer,
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "The uploaded file is empty." };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES || buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 5MB maximum limit (${(buffer.length / (1024 * 1024)).toFixed(2)}MB uploaded).`,
    };
  }

  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return {
      valid: false,
      error: "Invalid file format. Only PDF, JPG, and PNG files are accepted.",
    };
  }

  if (!validateAdmissionsMagicBytes(buffer, normalizedMime)) {
    return {
      valid: false,
      error: "Security validation failed: File binary header does not match its claimed MIME format.",
    };
  }

  return { valid: true };
}

/**
 * Generates an expiring HMAC-signed download token for private storage access.
 * Strict default TTL is 15 minutes (900 seconds).
 */
export function generatePresignedDownloadToken(
  storageKey: string,
  tenantId: string,
  ttlSeconds: number = 15 * 60
): { token: string; expiresAt: number; signedUrl: string } {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${storageKey}|${tenantId}|${expiresAt}`;
  const hmac = crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
  const token = `${expiresAt}.${hmac}`;

  const signedUrl = `/api/v1/admissions/storage/view/${encodeURIComponent(
    storageKey
  )}?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenantId)}`;

  return { token, expiresAt, signedUrl };
}

/**
 * Verifies an HMAC-signed download token against the requested storageKey and tenantId.
 */
export function verifyPresignedDownloadToken(
  storageKey: string,
  tenantId: string,
  token: string
): boolean {
  try {
    const [expiresAtStr, signature] = token.split(".");
    if (!expiresAtStr || !signature) return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
      return false; // Token expired
    }

    const expectedPayload = `${storageKey}|${tenantId}|${expiresAt}`;
    const expectedHmac = crypto.createHmac("sha256", SIGNING_SECRET).update(expectedPayload).digest("hex");

    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedHmac, "hex"));
  } catch {
    return false;
  }
}

/**
 * Resolves local private storage vault path
 */
function getPrivateStorageDirectory(tenantId: string): string {
  const dir = path.join(process.cwd(), "uploads", "private_admissions", tenantId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Stores an admissions file into private storage.
 * Supports S3/Supabase private buckets or secure isolated disk vault.
 */
export async function savePrivateAdmissionsFile({
  buffer,
  originalFileName,
  mimeType,
  tenantId,
  applicationId,
  documentType,
}: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  tenantId: string;
  applicationId: string;
  documentType: string;
}): Promise<{
  storageKey: string;
  fileMimeType: string;
  fileSizeBytes: number;
  checksum: string;
  signedUrl: string;
}> {
  const validation = validateAdmissionsFile(buffer, mimeType, buffer.length);
  if (!validation.valid) {
    throw new Error(validation.error || "File validation failed");
  }

  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const extension = path.extname(originalFileName).toLowerCase() || (mimeType.includes("pdf") ? ".pdf" : ".jpg");
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const cleanDocType = documentType.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const storageKey = `admissions/${tenantId}/${applicationId}/${cleanDocType}_${Date.now()}_${randomSuffix}${extension}`;

  // Check for Cloud Object Storage (S3 / Supabase S3 API / GCS)
  const s3Bucket = process.env.AWS_S3_BUCKET || process.env.SUPABASE_STORAGE_BUCKET;
  if (s3Bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      // Optional AWS SDK dynamic execution if package is present in environment
      const dynamicImport = new Function("pkg", "return import(pkg)");
      const { S3Client, PutObjectCommand } = await dynamicImport("@aws-sdk/client-s3");
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.AWS_S3_ENDPOINT || undefined,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      await s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: mimeType,
          Metadata: {
            tenantId,
            applicationId,
            documentType,
          },
        })
      );
    } catch (s3Err) {
      console.warn("[STORAGE_FALLBACK] Cloud S3 upload skipped/failed, persisting to secure local vault:", s3Err);
      const targetDir = getPrivateStorageDirectory(tenantId);
      const diskPath = path.join(targetDir, `${path.basename(storageKey)}`);
      fs.writeFileSync(diskPath, buffer);
    }
  } else {
    // Isolated secure local vault (server-side only, non-public directory)
    const targetDir = getPrivateStorageDirectory(tenantId);
    const diskPath = path.join(targetDir, `${path.basename(storageKey)}`);
    fs.writeFileSync(diskPath, buffer);
  }

  const { signedUrl } = generatePresignedDownloadToken(storageKey, tenantId, 15 * 60);

  return {
    storageKey,
    fileMimeType: mimeType,
    fileSizeBytes: buffer.length,
    checksum,
    signedUrl,
  };
}

/**
 * Reads a file from private storage (S3 or local secure vault)
 */
export async function readPrivateAdmissionsFile(
  storageKey: string,
  tenantId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  const s3Bucket = process.env.AWS_S3_BUCKET || process.env.SUPABASE_STORAGE_BUCKET;
  if (s3Bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const dynamicImport = new Function("pkg", "return import(pkg)");
      const { S3Client, GetObjectCommand } = await dynamicImport("@aws-sdk/client-s3");
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.AWS_S3_ENDPOINT || undefined,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: s3Bucket,
          Key: storageKey,
        })
      );

      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          const chunks: any[] = [];
          stream.on("data", (chunk: any) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
      };

      const buffer = await streamToBuffer(response.Body);
      const mimeType = response.ContentType || "application/octet-stream";
      return { buffer, mimeType, fileName: path.basename(storageKey) };
    } catch {
      // Fallback to local disk lookup below
    }
  }

  // Local private storage fallback
  const targetDir = getPrivateStorageDirectory(tenantId);
  const diskPath = path.join(targetDir, `${path.basename(storageKey)}`);
  if (fs.existsSync(diskPath)) {
    const buffer = fs.readFileSync(diskPath);
    const ext = path.extname(storageKey).toLowerCase();
    const mimeType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : "application/octet-stream";
    return { buffer, mimeType, fileName: path.basename(storageKey) };
  }

  return null;
}
