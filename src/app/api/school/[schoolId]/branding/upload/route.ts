import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { uploadToUploadthing } from "@/lib/uploadthing";

export const dynamic = "force-dynamic";

const ALLOWED_LOGO_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_HERO_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const ALLOWED_HERO_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_HERO_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_HERO_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ schoolId: string }> | { schoolId: string } }
) {
  try {
    const { schoolId } = await Promise.resolve(props.params);

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "Missing schoolId parameter." },
        { status: 400 }
      );
    }

    // 1. Verify existence of target School
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ id: schoolId }, { subdomain: schoolId }],
      },
      select: { id: true, subdomain: true },
    });

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School institution not found." },
        { status: 404 }
      );
    }

    // 2. Auth & RBAC Check
    const session = await getSession(undefined, school.subdomain).catch(() => null);
    const isDemo = school.subdomain.toLowerCase() === "demo";

    if (!isDemo && !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please sign in to manage school branding." },
        { status: 401 }
      );
    }

    if (!isDemo && session) {
      const role = (session.role || "").toUpperCase();
      const staffRole = (session.staffRole || "").toUpperCase();
      const combined = `${role} ${staffRole}`;
      const isAuthorized =
        combined.includes("SUPER_ADMIN") ||
        combined.includes("SCHOOL_ADMIN") ||
        combined.includes("ADMIN") ||
        combined.includes("PRINCIPAL") ||
        combined.includes("HEADMASTER") ||
        combined.includes("VICE_PRINCIPAL");

      if (!isAuthorized) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: Only school administrators and principals can upload institutional media.",
          },
          { status: 403 }
        );
      }
    }

    // 3. Process FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mediaKind = (formData.get("mediaKind") as string) || "logo"; // "logo" | "hero"

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No media file provided." },
        { status: 400 }
      );
    }

    const mimeType = (file.type || "").toLowerCase().trim();
    const isLogo = mediaKind === "logo";
    const isVideo = ALLOWED_HERO_VIDEO_MIMES.has(mimeType);

    if (isLogo) {
      if (!ALLOWED_LOGO_MIMES.has(mimeType)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid logo format. Please upload a PNG, JPG, WebP, or SVG image (max 5MB).",
          },
          { status: 400 }
        );
      }
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: "Logo file size exceeds the 5MB maximum limit." },
          { status: 400 }
        );
      }
    } else {
      // mediaKind === "hero"
      const isAllowedHeroImage = ALLOWED_HERO_IMAGE_MIMES.has(mimeType);
      const isAllowedHeroVideo = ALLOWED_HERO_VIDEO_MIMES.has(mimeType);

      if (!isAllowedHeroImage && !isAllowedHeroVideo) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid background format. Please upload an image (PNG, JPG, WebP up to 10MB) or video (MP4, WebM up to 50MB).",
          },
          { status: 400 }
        );
      }

      if (isAllowedHeroImage && file.size > MAX_HERO_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: "Hero background image size exceeds the 10MB maximum limit.",
          },
          { status: 400 }
        );
      }

      if (isAllowedHeroVideo && file.size > MAX_HERO_VIDEO_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: "Hero background video size exceeds the 50MB maximum limit.",
          },
          { status: 400 }
        );
      }
    }

    // 4. File extension determination
    const originalExt = path.extname(file.name || "").toLowerCase();
    const fallbackExt = isLogo
      ? mimeType.includes("svg")
        ? ".svg"
        : mimeType.includes("png")
        ? ".png"
        : ".jpg"
      : isVideo
      ? mimeType.includes("webm")
        ? ".webm"
        : ".mp4"
      : mimeType.includes("png")
      ? ".png"
      : ".jpg";

    const safeExt = originalExt || fallbackExt;
    const cleanPrefix = isLogo ? "logo" : isVideo ? "hero_vid" : "hero_img";
    const uniqueFileName = `${cleanPrefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${safeExt}`;

    // 5. Try UploadThing Cloud Storage first if configured
    if (process.env.UPLOADTHING_TOKEN) {
      try {
        const utResult = await uploadToUploadthing(file, uniqueFileName);
        if (utResult && utResult.url) {
          return NextResponse.json({
            success: true,
            url: utResult.url,
            mediaKind,
            mediaType: isVideo ? "video" : "image",
            mimeType,
            size: file.size,
            name: file.name,
          });
        }
      } catch (utErr) {
        console.warn("[BRANDING_UPLOAD] UploadThing failed, falling back to local disk:", utErr);
      }
    }

    // 6. Local Disk Storage: public/uploads/branding/[schoolId]/
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "branding", school.id);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/branding/${school.id}/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      mediaKind,
      mediaType: isVideo ? "video" : "image",
      mimeType,
      size: file.size,
      name: file.name,
    });
  } catch (error: any) {
    console.error("[BRANDING_UPLOAD_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload media file." },
      { status: 500 }
    );
  }
}

