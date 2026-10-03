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

    console.log(`[DEBUG_FORGOT_PW] Lookup initiated for email: "${normalizedEmail}" domain: "${normalizedDomain}"`);

    // 1. Locate tenant institution
    let school: any = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: normalizedDomain },
          { slug: normalizedDomain },
          { subdomain: { equals: normalizedDomain, mode: "insensitive" } },
          { slug: { equals: normalizedDomain, mode: "insensitive" } },
          { subdomain: { startsWith: normalizedDomain, mode: "insensitive" } },
          { slug: { startsWith: normalizedDomain, mode: "insensitive" } },
        ],
      },
      include: { academicTiers: true },
    });

    // Fallback: If school not found by domain slug, resolve school by registered user email
    if (!school) {
      const userMatch = await basePrisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        include: { school: true },
      });
      if (userMatch?.school) {
        school = userMatch.school;
        console.log(`[DEBUG_FORGOT_PW] School resolved via User record: ${school.name} (${school.subdomain})`);
      }
    }

    if (!school) {
      const staffMatch = await basePrisma.staff.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        include: { school: true },
      });
      if (staffMatch?.school) {
        school = staffMatch.school;
        console.log(`[DEBUG_FORGOT_PW] School resolved via Staff record: ${school.name} (${school.subdomain})`);
      }
    }

    if (!school) {
      const studentMatch = await basePrisma.student.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        include: { school: true },
      });
      if (studentMatch?.school) {
        school = studentMatch.school;
        console.log(`[DEBUG_FORGOT_PW] School resolved via Student record: ${school.name} (${school.subdomain})`);
      }
    }

    if (!school) {
      console.log(`[DEBUG_FORGOT_PW] No institution found for domain "${normalizedDomain}" or email "${normalizedEmail}"`);
      return NextResponse.json(
        { error: "School institution not found.", code: "TENANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // =========================================================================
    // 3. UNIFIED RECIPIENT LOOKUP ACROSS ALL AUTH TABLES
    // =========================================================================
    const institutionId = school.id;
    const prisma = basePrisma as any;
    let foundUser: {
      id: string;
      name: string;
      role: string;
      userType: "USER" | "STAFF" | "STUDENT" | "PLATFORM_ADMIN";
    } | null = null;

    // A. prisma.institution.findFirst + admins relation OR prisma.tenantAdmin.findFirst({ where: { email, institutionId } })
    // Also checking prisma.user (admin roles)
    let tenantAdmin: any = null;
    if (prisma.tenantAdmin) {
      tenantAdmin = await prisma.tenantAdmin.findFirst({
        where: {
          email: normalizedEmail,
          institutionId,
        },
      }).catch(() => null);
    }

    if (!tenantAdmin && prisma.institution) {
      const institutionWithAdmins = await prisma.institution.findFirst({
        where: { id: institutionId },
        include: { admins: true },
      }).catch(() => null);
      if (institutionWithAdmins?.admins) {
        const matched = institutionWithAdmins.admins.find((a: any) => (a.email || "").toLowerCase() === normalizedEmail);
        if (matched) tenantAdmin = matched;
      }
    }

    let adminUser = null;
    if (!tenantAdmin) {
      adminUser = await basePrisma.user.findFirst({
        where: {
          schoolId: institutionId,
          email: { equals: normalizedEmail, mode: "insensitive" },
          role: { in: ["SCHOOL_ADMIN", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "HEADMASTER", "BURSAR", "DIRECTOR"] as any },
        },
      });

      if (!adminUser && school.databaseUrl) {
        try {
          const tenantDb = await getTenantClient(institutionId);
          adminUser = await tenantDb.user.findFirst({
            where: {
              schoolId: institutionId,
              email: { equals: normalizedEmail, mode: "insensitive" },
              role: { in: ["SCHOOL_ADMIN", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "HEADMASTER", "BURSAR", "DIRECTOR"] as any },
            },
          });
        } catch {}
      }
    }

    if (tenantAdmin || adminUser) {
      const u: any = tenantAdmin || adminUser;
      const fullName = (u.name || u.fullName || `${u.firstName || ""} ${u.lastName || ""}`).trim();
      foundUser = {
        id: u.id,
        name: fullName || (u.role ? `${String(u.role).replace(/_/g, " ")}` : "Tenant Administrator"),
        role: u.role || "SCHOOL_ADMIN",
        userType: "USER",
      };
      console.log(`[DEBUG_FORGOT_PW] Found Tenant Admin: ${foundUser.name} (${foundUser.id}) role: ${foundUser.role}`);
    }

    // B. prisma.staff.findFirst({ where: { email, institutionId } })
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
          role: staff.role || "STAFF",
          userType: "STAFF",
        };
        console.log(`[DEBUG_FORGOT_PW] Found Staff: ${foundUser.name} (${foundUser.id}) role: ${foundUser.role}`);
      }
    }

    // C. prisma.student.findFirst({ where: { email, institutionId } })
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
          role: student.role || "STUDENT",
          userType: "STUDENT",
        };
        console.log(`[DEBUG_FORGOT_PW] Found Student: ${foundUser.name} (${foundUser.id}) role: ${foundUser.role}`);
      }
    }

    // D. prisma.user fallback
    if (!foundUser) {
      let fallbackUser: any = await basePrisma.user.findFirst({
        where: {
          schoolId: institutionId,
          email: { equals: normalizedEmail, mode: "insensitive" },
        },
      });

      if (!fallbackUser && school.databaseUrl) {
        try {
          const tenantDb = await getTenantClient(institutionId);
          fallbackUser = await tenantDb.user.findFirst({
            where: {
              schoolId: institutionId,
              email: { equals: normalizedEmail, mode: "insensitive" },
            },
          });
        } catch {}
      }

      if (!fallbackUser) {
        const crossUser: any = await basePrisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: "insensitive" } },
          include: { school: true },
        });
        if (crossUser) {
          fallbackUser = crossUser;
          if (crossUser.school) {
            school = crossUser.school;
          }
        }
      }

      if (fallbackUser) {
        const fullName = (fallbackUser.name || fallbackUser.fullName || `${fallbackUser.firstName || ""} ${fallbackUser.lastName || ""}`).trim();
        foundUser = {
          id: fallbackUser.id,
          name: fullName || (fallbackUser.role ? `${String(fallbackUser.role).replace(/_/g, " ")}` : "User"),
          role: fallbackUser.role || "USER",
          userType: "USER",
        };
        console.log(`[DEBUG_FORGOT_PW] Found User Fallback: ${foundUser.name} (${foundUser.id}) role: ${foundUser.role}`);
      }
    }

    // Security practice: Return generic positive message even if email wasn't found in tenant
    if (!foundUser) {
      console.log(`[DEBUG_FORGOT_PW] Account not found for email "${normalizedEmail}" in institution "${institutionId}" (${school.name})`);
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists for this institution, a recovery link has been dispatched.",
      });
    }

    // 4. Generate same reset token for any role (strict 15-minute expiration timestamp)
    const resetToken = await createPasswordResetToken({
      schoolId: school.id,
      email: normalizedEmail,
      userId: foundUser.id,
      userType: foundUser.userType === "USER" ? "USER" : (foundUser.userType as any),
      expiresMinutes: 15,
      ip: clientIp,
    });

    // Explicitly sync reset token fields directly on User model (prisma.user)
    await basePrisma.user.updateMany({
      where: {
        OR: [
          { id: foundUser.id },
          { email: { equals: normalizedEmail, mode: "insensitive" } },
        ],
      },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    }).catch(() => {});

    // 5. Compile recovery link preserving the tenant slug
    const targetSlug = school.slug || school.subdomain;
    const resetUrl = `${baseUrl}/${targetSlug}/reset-password?token=${encodeURIComponent(resetToken)}`;

    // 6. Transmit transactional email with verified sender domain & explicit name
    const info = await sendPasswordResetEmail({
      school,
      recipientEmail: normalizedEmail,
      recipientName: foundUser.name,
      resetUrl,
      expiresMinutes: 15,
      from: "noreply@bonaveeict.com.ng",
    });

    console.log("Reset token for", email, "role:", foundUser.role, "sent:", info.messageId);

    if (!info.success) {
      console.error(`[EMAIL_SYNC_ERROR] [PASSWORD_RESET] Failed to dispatch password reset to ${normalizedEmail}:`, info.error);
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
