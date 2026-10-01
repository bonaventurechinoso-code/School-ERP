import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await paramsPromise;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Decode path segments to handle encoded characters and slashes
    const decodedSegments = pathSegments.map((s) => decodeURIComponent(s));

    // Resolve absolute path and guard against directory traversal
    const uploadsBase = path.resolve(process.cwd(), "public", "uploads");
    const targetFilePath = path.resolve(uploadsBase, ...decodedSegments);

    if (!targetFilePath.startsWith(uploadsBase) || !fs.existsSync(targetFilePath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    const stat = fs.statSync(targetFilePath);
    if (!stat.isFile()) {
      return new NextResponse("Invalid file request", { status: 400 });
    }

    const fileBuffer = fs.readFileSync(targetFilePath);
    const ext = path.extname(targetFilePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".txt": "text/plain",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("[API_UPLOADS_ROUTE_ERROR]:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
