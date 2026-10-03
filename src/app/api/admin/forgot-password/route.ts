import { NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { createPasswordResetToken } from "@/lib/security-service";
import { sendPasswordResetEmail } from "@/lib/mail";
import { BASE_TENANT_DOMAIN } from "@/lib/session-manager";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, schoolDomain, schoolId } = body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email address is required.", code: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    // 1. Locate tenant school
    let school = null;
    if (schoolId) {
      school = await basePrisma.school.findUnique({
        where: { id: schoolId },
      });
    } else if (schoolDomain) {
      const normalizedDomain = schoolDomain.toLowerCase().trim();
      school = await basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: normalizedDomain },
            { slug: normalizedDomain },
          ],
        },
      });
    }

    // If school was not explicitly provided, attempt to resolve via admin User record
    if (!school) {
      const userMatch = await basePrisma.user.findFirst({
        where: {
          email: normalizedEmail,
          role: { in: ["SCHOOL_ADMIN", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "HEADMASTER", "BURSAR"] as any },
          status: { not: "DEACTIVATED" },
        },
        include: { school: true },
      });
      if (userMatch?.school) {
        school = userMatch.school;
      }
    }

    if (!school) {
      return NextResponse.json(
        { error: "School institution context could not be identified.", code: "TENANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Query tenant 'admins/users' collection linked to the tenant context (explicitly prisma.user)
    let adminUser = await basePrisma.user.findFirst({
      where: {
        schoolId: school.id,
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
    });

    if (!adminUser && school.databaseUrl) {
      try {
        const tenantDb = await getTenantClient(school.id);
        adminUser = await tenantDb.user.findFirst({
          where: {
            schoolId: school.id,
            email: { equals: normalizedEmail, mode: "insensitive" },
          },
        });
      } catch {}
    }

    if (!adminUser) {
      // Diagnostic check: check if admin email exists under another tenant context (tenantId mismatch)
      const crossTenantUser = await basePrisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        include: { school: true },
      });
      if (crossTenantUser) {
        console.log(`[AUTH_ERROR] Admin email found under different tenant ID ${crossTenantUser.schoolId} instead of requested tenant ${school.id}`);
        console.log("[AUTH_ERROR] Admin email not found in database tracking");
        if (crossTenantUser.school && ["SCHOOL_ADMIN", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "HEADMASTER", "BURSAR"].includes(crossTenantUser.role as string)) {
          adminUser = crossTenantUser;
          school = crossTenantUser.school;
        }
      } else {
        console.log("[AUTH_ERROR] Admin email not found in database tracking");
      }
    }

    // Check staff table as fallback for school administrators
    let staffUser = null;
    if (!adminUser) {
      staffUser = await basePrisma.staff.findFirst({
        where: {
          schoolId: school.id,
          email: { equals: normalizedEmail, mode: "insensitive" },
          status: { not: "TERMINATED" },
        },
      });
    }

    if (!adminUser && !staffUser) {
      console.log("[AUTH_ERROR] Admin email not found in database tracking");
      // Prevent enumeration while returning success
      return NextResponse.json({
        success: true,
        message: "If an admin account with this email exists for this institution, a recovery link has been dispatched.",
      });
    }

    const userId = adminUser?.id || staffUser?.id || "";
    const userName = adminUser 
      ? `${adminUser.firstName || ""} ${adminUser.lastName || ""}`.trim() || (adminUser.role ? `${adminUser.role.replace(/_/g, " ")}` : "School Administrator")
      : `${staffUser?.firstName || ""} ${staffUser?.lastName || ""}`.trim() || "School Administrator";

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    const resetToken = await createPasswordResetToken({
      schoolId: school.id,
      email: normalizedEmail,
      userId,
      userType: "USER",
      expiresMinutes: 15,
      ip: clientIp,
    });

    // Explicitly update recovery fields directly on Admin/User model (prisma.user)
    if (adminUser) {
      await basePrisma.user.update({
        where: { id: adminUser.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      }).catch((err) => {
        console.warn("[AUTH_WARNING] Could not update resetPasswordToken on User:", err);
      });
    }

    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";

    let baseUrl = `${proto}://${hostHeader}`;
    if (!hostHeader) {
      baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || `https://${BASE_TENANT_DOMAIN}`).replace(/\/$/, "");
    }

    const targetSlug = school.slug || school.subdomain;
    const resetUrl = `${baseUrl}/${targetSlug}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const mailResult = await sendPasswordResetEmail({
      school,
      recipientEmail: normalizedEmail,
      recipientName: userName,
      resetUrl,
      expiresMinutes: 15,
    });

    if (!mailResult.success) {
      console.error(`[EMAIL_SYNC_ERROR] [ADMIN_PASSWORD_RESET] Failed to dispatch password reset to ${normalizedEmail}:`, mailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: "An administrator password recovery email has been dispatched.",
      resetUrlPreview: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (error: any) {
    console.error("[EMAIL_SYNC_ERROR] [ADMIN_FORGOT_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "Could not initiate administrator password recovery.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
