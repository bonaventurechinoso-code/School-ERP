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
    let decodedSegments = pathSegments.map((s) => decodeURIComponent(s));

    // Strip accidental leading "uploads" or "public" path segments
    while (
      decodedSegments.length > 0 &&
      (decodedSegments[0].toLowerCase() === "uploads" ||
        decodedSegments[0].toLowerCase() === "public" ||
        decodedSegments[0].toLowerCase() === "api")
    ) {
      decodedSegments.shift();
    }

    if (decodedSegments.length === 0) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Resolve absolute path and guard against directory traversal
    const uploadsBase = path.resolve(process.cwd(), "public", "uploads");
    let targetFilePath = path.resolve(uploadsBase, ...decodedSegments);

    // Fallback search if direct path does not exist
    if (!targetFilePath.startsWith(uploadsBase) || !fs.existsSync(targetFilePath)) {
      const rawFileName = decodedSegments[decodedSegments.length - 1];
      const fileName = rawFileName ? rawFileName.split("?")[0].split("#")[0] : null;
      if (fileName) {
        // 1. Try school-scoped search if school directory is present in segments
        let schoolDir = uploadsBase;
        if (decodedSegments.length >= 2 && decodedSegments[0].toLowerCase() === "admissions") {
          const candidateSchoolDir = path.resolve(uploadsBase, "admissions", decodedSegments[1]);
          if (fs.existsSync(candidateSchoolDir)) {
            schoolDir = candidateSchoolDir;
          }
        }

        const foundPath = searchFileInDirectory(schoolDir, fileName);
        if (foundPath && foundPath.startsWith(uploadsBase) && fs.existsSync(foundPath)) {
          targetFilePath = foundPath;
        } else {
          // 2. Global uploads search fallback
          const globalFoundPath = searchFileInDirectory(uploadsBase, fileName);
          if (globalFoundPath && globalFoundPath.startsWith(uploadsBase) && fs.existsSync(globalFoundPath)) {
            targetFilePath = globalFoundPath;
          } else {
            return new NextResponse("File not found", { status: 404 });
          }
        }
      } else {
        return new NextResponse("File not found", { status: 404 });
      }
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

/**
 * Recursively search for a file by name within a base directory (max depth 6)
 */
function searchFileInDirectory(dir: string, targetName: string, depth = 0): string | null {
  if (depth > 6 || !fs.existsSync(dir)) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
        return fullPath;
      } else if (entry.isDirectory()) {
        const found = searchFileInDirectory(fullPath, targetName, depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

