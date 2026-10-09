import { NextResponse } from "next/server";
import crypto from "crypto";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { createPasswordResetToken, hashToken } from "@/lib/security-service";
import { sendPasswordResetEmail } from "@/lib/mail";
import { BASE_TENANT_DOMAIN } from "@/lib/session-manager";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, schoolDomain } = body;

    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Institutional email address is required.", code: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    // Extract tenant context from body or headers
    const headerTenantSlug = req.headers.get("x-tenant-slug");
    const domainInput = (schoolDomain || headerTenantSlug || "").trim().toLowerCase();

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";

    let baseUrl = `${proto}://${hostHeader}`;
    if (!hostHeader) {
      baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || `https://${BASE_TENANT_DOMAIN}`).replace(/\/$/, "");
    }

    // =========================================================================
    // 1. CENTRAL SUPERADMIN RECOVERY ROUTING
    // =========================================================================
    const isSuperAdminDomain =
      !domainInput ||
      ["superadmin", "platform", "central", "saas", "super-admin", "admin"].includes(domainInput);

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

      const anchorSchool = await basePrisma.school.findFirst({
        where: { isActive: true },
      }) || await basePrisma.school.findFirst();

      const anchorSchoolId = anchorSchool?.id || "";

      // Secure, short-lived token (1 hour max expiration)
      const resetToken = await createPasswordResetToken({
        schoolId: anchorSchoolId,
        email: normalizedEmail,
        userId: adminId,
        userType: "PLATFORM_ADMIN",
        expiresMinutes: 60,
        ip: clientIp,
      });

      const targetSlug = anchorSchool?.slug || anchorSchool?.subdomain || "admin";
      const resetUrl = `${baseUrl}/${targetSlug}/reset-password?token=${encodeURIComponent(resetToken)}`;

      const mailResult = await sendPasswordResetEmail({
        school: anchorSchool || { name: "School ERP Platform", branding: { primaryColor: "#0B132B" } },
        recipientEmail: normalizedEmail,
        recipientName: "Platform Superadmin",
        resetUrl,
        expiresMinutes: 60,
      });

      if (!mailResult.success) {
        console.error(`[SUPERADMIN_PASSWORD_RESET] Failed to dispatch email to ${normalizedEmail}:`, mailResult.error);
      }

      return NextResponse.json({
        success: true,
        message: "A password recovery email with instructions has been dispatched to your email address.",
        resetUrlPreview: process.env.NODE_ENV === "development" ? resetUrl : undefined,
      });
    }

    // =========================================================================
    // 2. TENANT CONTEXT RESOLUTION (STRICT ISOLATION)
    // =========================================================================
    if (!domainInput) {
      return NextResponse.json(
        { error: "School domain context is required.", code: "DOMAIN_REQUIRED" },
        { status: 400 }
      );
    }

    // Locate the school exclusively for this domain
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: domainInput },
          { slug: domainInput },
          { subdomain: { equals: domainInput, mode: "insensitive" } },
          { slug: { equals: domainInput, mode: "insensitive" } },
        ],
        isActive: true,
        deletedAt: null,
      },
    });

    if (!school) {
      console.warn(`[FORGOT_PASSWORD_BLOCKED] No active institution found for domain '${domainInput}'. Cross-tenant fallbacks are strictly prohibited.`);
      return NextResponse.json(
        { error: "No active school institution matches this domain context.", code: "TENANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const institutionId = school.id;

    // =========================================================================
    // 3. STRICT TENANT-SCOPED USER LOOKUP (No cross-tenant data leaks)
    // =========================================================================
    let foundUser: {
      id: string;
      name: string;
      role: string;
      userType: "USER" | "STAFF" | "STUDENT" | "PLATFORM_ADMIN";
    } | null = null;

    // A. Check tenant administrators strictly within institutionId
    const adminUser = await basePrisma.user.findFirst({
      where: {
        schoolId: institutionId,
        email: { equals: normalizedEmail, mode: "insensitive" },
        role: { in: ["SCHOOL_ADMIN", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "HEADMASTER", "BURSAR", "DIRECTOR"] as any },
      },
    });

    if (adminUser) {
      const u = adminUser as any;
      const fullName = (u.name || `${u.firstName || ""} ${u.lastName || ""}`).trim();
      foundUser = {
        id: adminUser.id,
        name: fullName || "Tenant Administrator",
        role: adminUser.role || "SCHOOL_ADMIN",
        userType: "USER",
      };
    }

    // B. Check staff members strictly within institutionId
    if (!foundUser) {
      let staff: any = await basePrisma.staff.findFirst({
        where: {
          schoolId: institutionId,
          email: { equals: normalizedEmail, mode: "insensitive" },
          status: { not: "TERMINATED" },
        },
      });

      if (!staff && school.databaseUrl) {
        try {
          const tenantDb = await getTenantClient(institutionId);
          staff = await tenantDb.staff.findFirst({
            where: {
              schoolId: institutionId,
              email: { equals: normalizedEmail, mode: "insensitive" },
              status: { not: "TERMINATED" },
            },
          });
        } catch {}
      }

      if (staff) {
        const fullName = (staff.name || staff.fullName || `${staff.firstName || ""} ${staff.lastName || ""}`).trim();
        foundUser = {
          id: staff.id,
          name: fullName || "Staff Member",
          role: staff.role || staff.staffRole || "STAFF",
          userType: "STAFF",
        };
      }
    }

    // C. Check students strictly within institutionId
    if (!foundUser) {
      let student: any = await basePrisma.student.findFirst({
        where: {
          schoolId: institutionId,
          email: { equals: normalizedEmail, mode: "insensitive" },
          status: { notIn: ["EXPELLED"] },
        },
      });

      if (!student && school.databaseUrl) {
        try {
          const tenantDb = await getTenantClient(institutionId);
          student = await tenantDb.student.findFirst({
            where: {
              schoolId: institutionId,
              email: { equals: normalizedEmail, mode: "insensitive" },
            },
          });
        } catch {}
      }

      if (student) {
        const fullName = (student.name || student.fullName || `${student.firstName || ""} ${student.lastName || ""}`).trim();
        foundUser = {
          id: student.id,
          name: fullName || "Student",
          role: "STUDENT",
          userType: "STUDENT",
        };
      }
    }

    // D. Check standard user table strictly within institutionId
    if (!foundUser) {
      const fallbackUser: any = await basePrisma.user.findFirst({
        where: {
          schoolId: institutionId,
          email: { equals: normalizedEmail, mode: "insensitive" },
        },
      });

      if (fallbackUser) {
        const fullName = (fallbackUser.name || `${fallbackUser.firstName || ""} ${fallbackUser.lastName || ""}`).trim();
        foundUser = {
          id: fallbackUser.id,
          name: fullName || "User",
          role: fallbackUser.role || "USER",
          userType: "USER",
        };
      }
    }

    // Security practice: Return generic positive message if user not found in this specific tenant
    if (!foundUser) {
      console.info(`[FORGOT_PASSWORD] Email '${normalizedEmail}' not registered in tenant '${institutionId}' (${school.name}). Returning generic success.`);
      return NextResponse.json({
        success: true,
        message: "If an account associated with this institutional email exists, password recovery instructions have been dispatched.",
      });
    }

    // =========================================================================
    // 4. TOKEN GENERATION WITH SECURE HASHED SIGNATURE (1 Hour Max Expiration)
    // =========================================================================
    // Generates a cryptographically random 32-byte token and stores strictly the SHA-256 hash
    const resetToken = await createPasswordResetToken({
      schoolId: school.id,
      email: normalizedEmail,
      userId: foundUser.id,
      userType: foundUser.userType === "USER" ? "USER" : (foundUser.userType as any),
      expiresMinutes: 60, // Short-lived (expires in 1 hour max)
      ip: clientIp,
    });

    // 5. Compile recovery link strictly preserving the tenant slug
    const targetSlug = school.slug || school.subdomain;
    const resetUrl = `${baseUrl}/${targetSlug}/reset-password?token=${encodeURIComponent(resetToken)}`;

    // 6. Transmit transactional email
    const info = await sendPasswordResetEmail({
      school,
      recipientEmail: normalizedEmail,
      recipientName: foundUser.name,
      resetUrl,
      expiresMinutes: 60,
      from: "noreply@bonaveeict.com.ng",
    });

    if (!info.success) {
      console.error(`[PASSWORD_RESET_EMAIL_ERROR] Failed to send email to ${normalizedEmail}:`, info.error);
    }

    return NextResponse.json({
      success: true,
      message: "If an account associated with this institutional email exists, password recovery instructions have been dispatched.",
      resetUrlPreview: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (error: any) {
    console.error("[AUTH_FORGOT_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "Could not initiate password recovery.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
