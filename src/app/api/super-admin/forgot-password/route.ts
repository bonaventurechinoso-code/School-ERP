import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { createPasswordResetToken } from "@/lib/security-service";
import { sendPasswordResetEmail } from "@/lib/mail";
import { BASE_TENANT_DOMAIN } from "@/lib/session-manager";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email address is required.", code: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    // 1. Query the global 'superadmins' central collection
    const superAdmin = await basePrisma.superAdmin.findFirst({
      where: { email: normalizedEmail },
    });

    const platformAdmin = !superAdmin
      ? await basePrisma.platformAdmin.findFirst({
          where: { email: normalizedEmail },
        })
      : null;

    const isMasterDevAdmin =
      process.env.NODE_ENV !== "production" &&
      (normalizedEmail === "superadmin@platform.com" ||
       normalizedEmail === "superadmin@school.edu" ||
       normalizedEmail === "admin@bonaveeict.com.ng");

    if (!superAdmin && !platformAdmin && !isMasterDevAdmin) {
      console.log("[AUTH_ERROR] Admin email not found in database tracking");
      return NextResponse.json({
        success: true,
        message: "If a platform superadmin account with this email exists, a recovery link has been dispatched.",
      });
    }

    const adminId = superAdmin?.id || platformAdmin?.id || "master-superadmin-001";
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    // Locate anchor school context for DB token association
    const anchorSchool = await basePrisma.school.findFirst({
      where: { isActive: true },
    }) || await basePrisma.school.findFirst();

    if (!anchorSchool) {
      return NextResponse.json(
        { error: "System initialization pending: no school anchor found for token binding.", code: "NO_ANCHOR_SCHOOL" },
        { status: 500 }
      );
    }

    const resetToken = await createPasswordResetToken({
      schoolId: anchorSchool.id,
      email: normalizedEmail,
      userId: adminId,
      userType: "PLATFORM_ADMIN",
      expiresMinutes: 15,
      ip: clientIp,
    });

    if (superAdmin) {
      await basePrisma.superAdmin.update({
        where: { id: superAdmin.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      }).catch((err) => {
        console.warn("[AUTH_WARNING] Could not update reset fields on SuperAdmin:", err);
      });
    }

    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";

    let baseUrl = `${proto}://${hostHeader}`;
    if (!hostHeader) {
      baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || `https://${BASE_TENANT_DOMAIN}`).replace(/\/$/, "");
    }

    const targetSlug = anchorSchool.slug || anchorSchool.subdomain;
    const resetUrl = `${baseUrl}/${targetSlug}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const mailResult = await sendPasswordResetEmail({
      school: anchorSchool,
      recipientEmail: normalizedEmail,
      recipientName: "Platform Superadmin",
      resetUrl,
      expiresMinutes: 15,
    });

    if (!mailResult.success) {
      console.error(`[EMAIL_SYNC_ERROR] [SUPERADMIN_PASSWORD_RESET] Failed to dispatch superadmin password reset to ${normalizedEmail}:`, mailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: "A platform superadmin password recovery email has been dispatched.",
      resetUrlPreview: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (error: any) {
    console.error("[EMAIL_SYNC_ERROR] [SUPERADMIN_FORGOT_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "Could not initiate superadmin password recovery.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
