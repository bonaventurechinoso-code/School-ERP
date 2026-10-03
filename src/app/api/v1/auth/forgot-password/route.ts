import { NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { createPasswordResetToken } from "@/lib/security-service";
import { sendPasswordResetEmail } from "@/lib/mail";
import { BASE_TENANT_DOMAIN } from "@/lib/session-manager";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, schoolDomain } = body;

    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email address is required.", code: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    const normalizedDomain = (schoolDomain || "").trim().toLowerCase();

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";

    let baseUrl = `${proto}://${hostHeader}`;
    if (!hostHeader) {
      baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || `https://${BASE_TENANT_DOMAIN}`).replace(/\/$/, "");
    }

    // =========================================================================
    // 1. CENTRAL SUPERADMIN RECOVERY ROUTING
    // =========================================================================
    // Query the global 'superadmins' central collection to verify platform administrators.
    const isSuperAdminDomain =
      !normalizedDomain ||
      ["superadmin", "platform", "central", "saas", "super-admin", "admin"].includes(normalizedDomain);

    const superAdmin = await basePrisma.superAdmin.findUnique({
      where: { email: normalizedEmail },
    });

    const platformAdmin = !superAdmin
      ? await basePrisma.platformAdmin.findUnique({
          where: { email: normalizedEmail },
        })
      : null;

    const isMasterDevAdmin =
      process.env.NODE_ENV !== "production" &&
      (normalizedEmail === "superadmin@platform.com" ||
       normalizedEmail === "superadmin@school.edu" ||
       normalizedEmail === "admin@bonaveeict.com.ng");

    if (superAdmin || platformAdmin || (isSuperAdminDomain && isMasterDevAdmin)) {
      const adminId = superAdmin?.id || platformAdmin?.id || "master-superadmin-001";

      // Locate anchor school to bind token foreign key in database
      const anchorSchool = await basePrisma.school.findFirst({
        where: { isActive: true },
      }) || await basePrisma.school.findFirst();

      const anchorSchoolId = anchorSchool?.id || "global-saas";

      const resetToken = await createPasswordResetToken({
        schoolId: anchorSchoolId,
        email: normalizedEmail,
        userId: adminId,
        userType: "PLATFORM_ADMIN",
        expiresMinutes: 15,
        ip: clientIp,
      });

      const targetSlug = anchorSchool?.slug || anchorSchool?.subdomain || "admin";
      const resetUrl = `${baseUrl}/${targetSlug}/reset-password?token=${encodeURIComponent(resetToken)}`;

      const mailResult = await sendPasswordResetEmail({
        school: anchorSchool || { name: "School ERP Platform", branding: { primaryColor: "#4f46e5" } },
        recipientEmail: normalizedEmail,
        recipientName: "Platform Superadmin",
        resetUrl,
        expiresMinutes: 15,
      });

      if (!mailResult.success) {
        console.error(`[EMAIL_SYNC_ERROR] [SUPERADMIN_PASSWORD_RESET] Failed to dispatch password reset to ${normalizedEmail}:`, mailResult.error);
      }

      return NextResponse.json({
        success: true,
        message: "A password recovery email with instructions has been dispatched to your email address.",
        resetUrlPreview: process.env.NODE_ENV === "development" ? resetUrl : undefined,
      });
    }

    // =========================================================================
    // 2. TENANT CONTEXT RESOLUTION
    // =========================================================================
    if (!normalizedDomain) {
      return NextResponse.json(
        { error: "School domain context is required.", code: "DOMAIN_REQUIRED" },
        { status: 400 }
      );
    }

    // 1. Locate tenant school
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: normalizedDomain },
          { slug: normalizedDomain },
        ],
      },
      include: { academicTiers: true },
    });

    if (!school) {
      return NextResponse.json(
        { error: "School institution not found.", code: "TENANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // =========================================================================
    // 3. RECIPIENT VERIFICATION WITHIN TENANT CONTEXT
    // =========================================================================
    let userType: "USER" | "STAFF" | "STUDENT" | null = null;
    let userId = "";
    let userName = "";

    // A. Query tenant 'admins/users' collection linked to the tenant context
    let adminUser = await basePrisma.user.findFirst({
      where: {
        schoolId: school.id,
        email: normalizedEmail,
        status: { not: "DEACTIVATED" },
      },
    });

    if (!adminUser && school.databaseUrl) {
      try {
        const tenantDb = await getTenantClient(school.id);
        adminUser = await tenantDb.user.findFirst({
          where: {
            schoolId: school.id,
            email: normalizedEmail,
            status: { not: "DEACTIVATED" },
          },
        });
      } catch {}
    }

    if (adminUser) {
      userType = "USER";
      userId = adminUser.id;
      const fullName = `${adminUser.firstName || ""} ${adminUser.lastName || ""}`.trim();
      userName = fullName || (adminUser.role ? `${adminUser.role.replace(/_/g, " ")}` : "School Administrator");
    }

    // B. Check Staff if not found in User table
    if (!userType) {
      let staff = await basePrisma.staff.findFirst({
        where: {
          schoolId: school.id,
          email: normalizedEmail,
          status: { not: "TERMINATED" },
        },
      });

      if (!staff && school.databaseUrl) {
        try {
          const tenantDb = await getTenantClient(school.id);
          staff = await tenantDb.staff.findFirst({
            where: {
              schoolId: school.id,
              email: normalizedEmail,
              status: { not: "TERMINATED" },
            },
          });
        } catch {}
      }

      if (staff) {
        userType = "STAFF";
        userId = staff.id;
        userName = `${staff.firstName} ${staff.lastName}`.trim();
      }
    }

    // C. Check Student if not found in Staff (Exact, untouched student logic)
    if (!userType) {
      let student = await basePrisma.student.findFirst({
        where: {
          schoolId: school.id,
          email: normalizedEmail,
          status: { notIn: ["EXPELLED"] },
        },
      });

      if (!student && school.databaseUrl) {
        try {
          const tenantDb = await getTenantClient(school.id);
          student = await tenantDb.student.findFirst({
            where: {
              schoolId: school.id,
              email: normalizedEmail,
            },
          });
        } catch {}
      }

      if (student) {
        userType = "STUDENT";
        userId = student.id;
        userName = `${student.firstName} ${student.lastName}`.trim();
      }
    }

    // Security practice: Return generic positive message even if email wasn't found in tenant
    // to prevent email enumeration attacks, BUT do not dispatch email if unverified.
    if (!userType || !userId) {
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists for this institution, a recovery link has been dispatched.",
      });
    }

    // 4. Generate secure time-limited token (strict 15-minute expiration timestamp)
    const resetToken = await createPasswordResetToken({
      schoolId: school.id,
      email: normalizedEmail,
      userId,
      userType,
      expiresMinutes: 15,
      ip: clientIp,
    });

    // 5. Compile recovery link preserving the tenant slug
    const targetSlug = school.slug || school.subdomain;
    const resetUrl = `${baseUrl}/${targetSlug}/reset-password?token=${encodeURIComponent(resetToken)}`;

    // 6. Transmit transactional email via mail delivery service
    const mailResult = await sendPasswordResetEmail({
      school,
      recipientEmail: normalizedEmail,
      recipientName: userName,
      resetUrl,
      expiresMinutes: 15,
    });

    if (!mailResult.success) {
      console.error(`[EMAIL_SYNC_ERROR] [PASSWORD_RESET] Failed to dispatch password reset to ${normalizedEmail}:`, mailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: "A password recovery email with instructions has been dispatched to your email address.",
      resetUrlPreview: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (error: any) {
    console.error("[EMAIL_SYNC_ERROR] [AUTH_FORGOT_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "Could not initiate password recovery.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
