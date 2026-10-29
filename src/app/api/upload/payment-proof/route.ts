import { NextRequest, NextResponse } from "next/server";
import { getStorage, validateMagicBytes } from "@/lib/storage";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "application/pdf",
]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No proof file provided in upload." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds the 5MB maximum limit." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload a JPG, PNG, WebP, or PDF receipt." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Strict Magic Bytes Verification
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: "Corrupted or invalid file contents. File does not match declared media type." },
        { status: 400 }
      );
    }

    const storage = getStorage();
    const cleanFileName = `proof_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.${file.name.split(".").pop() || "jpg"}`;
    const result = await storage.upload(buffer, cleanFileName, file.type);

    return NextResponse.json({
      success: true,
      url: result.url,
      receiptUrl: result.url,
      receiptData: result.data || null,
      mimeType: result.mimeType,
      receiptMimeType: result.mimeType,
      size: result.size,
      receiptSize: result.size,
      checksum: result.checksum,
      receiptChecksum: result.checksum,
      publicId: result.publicId || null,
      receiptPublicId: result.publicId || null,
      fileName: cleanFileName,
    });
  } catch (error: any) {
    console.error("[UPLOAD_PAYMENT_PROOF_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process receipt image upload." },
      { status: 500 }
    );
  }
}
