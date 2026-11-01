import { NextRequest, NextResponse } from "next/server";
import {
  verifyPresignedDownloadToken,
  readPrivateAdmissionsFile,
} from "@/lib/storage/admissionsStorage";

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ storageKey: string }> }
) {
  try {
    const { storageKey: rawKey } = await paramsPromise;
    const storageKey = decodeURIComponent(rawKey);
    const { searchParams } = new URL(req.url);

    const token = searchParams.get("token");
    const tenantId = searchParams.get("tenant");

    if (!token || !tenantId) {
      return NextResponse.json(
        { error: "Access Denied: Missing presigned authentication token or tenant parameter." },
        { status: 403 }
      );
    }

    const isValid = verifyPresignedDownloadToken(storageKey, tenantId, token);
    if (!isValid) {
      return NextResponse.json(
        {
          error:
            "403 Forbidden: Presigned signed URL has expired (15-minute TTL elapsed) or is cryptographically invalid.",
        },
        { status: 403 }
      );
    }

    const file = await readPrivateAdmissionsFile(storageKey, tenantId);
    if (!file) {
      return NextResponse.json(
        { error: "Document not found in private storage vault." },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.fileName}"`,
        "Cache-Control": "private, max-age=900", // Cache strictly matches the 15-min TTL
      },
    });
  } catch (error: any) {
    console.error("[STORAGE_VIEW_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal error retrieving private admissions credential." },
      { status: 500 }
    );
  }
}
