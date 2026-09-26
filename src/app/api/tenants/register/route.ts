import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { triggerSSLProvisioning, warmAndVerifySSLHandshake } from "@/lib/ssl-provisioning";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  createDatabaseSession,
  SESSION_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  getSecureCookieOptions,
  BASE_TENANT_DOMAIN,
} from "@/lib/session-manager";
import { getDefaultPermissionsForRole } from "@/lib/auth";
import { ensureSecurityTables, hashPassword, validatePasswordStrength } from "@/lib/security-service";
import { logAuditEvent } from "@/lib/audit-logger";
import { sendSchoolRegistrationSuccessEmail } from "@/lib/email-service";

const VALID_TIERS = [
  'NURSERY',
  'DAYCARE',
  'PRIMARY',
  'SECONDARY',
  'PRIMARY_SECONDARY',
  'UNIVERSITY',
  'POLYTECHNIC',
  'COLLEGE_OF_EDUCATION',
  'COMBINED_NURSERY_PRIMARY_SECONDARY'
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schoolName, adminEmail, contactPhone, subdomain, tiers, password, adminPassword } = body;

    // Validate inputs
    if (!schoolName || !adminEmail || !subdomain || !tiers || tiers.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields or academic tiers.", code: "VALIDATION_FAILED" },
        { status: 400 }
      );
    }

    await ensureSecurityTables();

    const effectiveAdminPassword = adminPassword || password;
    let adminPasswordToSave = "Password123";
    let isUserProvidedPassword = false;

    if (effectiveAdminPassword && typeof effectiveAdminPassword === "string" && effectiveAdminPassword.trim().length > 0) {
      if (effectiveAdminPassword.trim().length < 8) {
        return NextResponse.json(
          { error: "Admin password must be at least 8 characters long.", code: "INVALID_PASSWORD" },
          { status: 400 }
        );
      }
      adminPasswordToSave = effectiveAdminPassword.trim();
      isUserProvidedPassword = true;
    }

    const adminPasswordHash = await hashPassword(adminPasswordToSave);

    // Validate standard backend enum metadata
    const invalidTiers = tiers.filter((t: string) => !VALID_TIERS.includes(t));
    if (invalidTiers.length > 0) {
      return NextResponse.json(
        { error: `Invalid academic tier subtypes provided: ${invalidTiers.join(', ')}`, code: "INVALID_TIERS" },
        { status: 400 }
      );
    }

    // Format subdomain (lowercase, remove spaces/special chars)
    const formattedSubdomain = subdomain.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    if (!formattedSubdomain) {
      return NextResponse.json(
        { error: "Invalid subdomain.", code: "INVALID_SUBDOMAIN" },
        { status: 400 }
      );
    }

    // Check if subdomain is unique
    const existingSchool = await basePrisma.school.findUnique({
      where: { subdomain: formattedSubdomain },
    });

    if (existingSchool) {
      return NextResponse.json(
        { error: "This URL slug is already taken. Please choose another.", code: "SUBDOMAIN_TAKEN" },
        { status: 409 }
      );
    }

    const now = new Date();
    const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    const rawHost = hostHeader.split(":")[0].toLowerCase().trim();
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const rootDomain = BASE_TENANT_DOMAIN; // Strictly "bonaveeict.com.ng"

    // Provision combined tenant if requested
    if (tiers.includes('COMBINED_NURSERY_PRIMARY_SECONDARY')) {
      const subdomains = [
        { suffix: '-nursery', tier: 'DAYCARE', name: `${schoolName} Nursery` },
        { suffix: '-primary', tier: 'PRIMARY', name: `${schoolName} Primary` },
        { suffix: '-secondary', tier: 'SECONDARY', name: `${schoolName} Secondary` }
      ];

      const newSchools = await basePrisma.$transaction(async (tx) => {
        const createdSchools = [];
        for (const sub of subdomains) {
          const tenantSubdomain = formattedSubdomain + sub.suffix;
          const school = await tx.school.create({
            data: {
              name: sub.name,
              subdomain: tenantSubdomain,
              slug: tenantSubdomain,
              status: "ACTIVE",
              contactPhone: contactPhone || null,
              isActive: true,
              isBanned: false,
              trialStartDate: now,
              trialEndDate: fourteenDaysOut,
              collectionMode: "MANUAL_BANK_TRANSFER",
            },
          });

          await tx.academicTier.create({
            data: { schoolId: school.id, name: sub.tier, level: 1 }
          });

          // Seed active 14-day manual trial subscription ledger (0% charge)
          await tx.subscription.create({
            data: {
              schoolId: school.id,
              plan: "14_DAY_TRIAL",
              amount: 0.0,
              status: "ACTIVE",
              paymentMethod: "MANUAL",
              verifiedByAdmin: true,
              expiresAt: fourteenDaysOut,
            },
          });

          await tx.schoolPayment.create({
            data: {
              schoolId: school.id,
              amount: 0.0,
              type: "SUBSCRIPTION",
              status: "VERIFIED",
            },
          });

          const dept = await tx.department.create({
            data: { schoolId: school.id, name: "Administration" }
          });

          const user = await tx.user.upsert({
            where: { schoolId_email: { schoolId: school.id, email: adminEmail } },
            update: {
              passwordHash: adminPasswordHash,
              role: "SCHOOL_ADMIN",
              mustChangePassword: false,
              status: "ACTIVE",
            },
            create: {
              schoolId: school.id,
              email: adminEmail,
              passwordHash: adminPasswordHash,
              role: "SCHOOL_ADMIN",
              mustChangePassword: false,
              status: "ACTIVE",
            },
          });

          const staff = await tx.staff.create({
            data: {
              schoolId: school.id,
              userId: user.id,
              firstName: "Admin",
              lastName: "User",
              email: adminEmail,
              departmentId: dept.id,
              status: "ACTIVE",
              activeAt: now,
            }
          });

          await tx.$executeRawUnsafe(`
            INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, password_updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET must_change_password = $3, password_updated_at = NOW();
          `, staff.id, school.id, false);

          await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${tenantSubdomain}";`);
          createdSchools.push({ school, staff });
        }
        return createdSchools;
      });

      // Synchronize SSL generation with onboarding pipeline
      const combinedSubdomain = `${formattedSubdomain}-primary`;
      const sslSyncResult = await warmAndVerifySSLHandshake(combinedSubdomain, rootDomain, proto);

      const primarySchool = newSchools[0].school;
      const primaryStaff = newSchools[0].staff;

      // Dispatch Registration Success Email to the School Admin
      try {
        console.log(`[REGISTER_EMAIL] Triggering registration success email for combined tenant: ${adminEmail}...`);
        const emailResult = await sendSchoolRegistrationSuccessEmail({
          schoolName,
          subdomain: combinedSubdomain,
          adminEmail,
          adminPassword: adminPassword || password,
          contactPhone: contactPhone || null,
          tiers: ['DAYCARE', 'PRIMARY', 'SECONDARY'],
          schoolId: primarySchool.id,
        });
        console.log(`[REGISTER_EMAIL] Completed with status:`, emailResult?.deliveryStatus);
      } catch (emailErr) {
        console.error("[REGISTER_EMAIL_SEND_EXCEPTION]:", emailErr);
      }

      // Automatically issue authenticated database session for newly created Tenant Administrator
      const distinctSessionToken = crypto.randomUUID();
      const sessionResult = await createDatabaseSession({
        userId: primaryStaff.id,
        email: adminEmail,
        tenantId: primarySchool.id,
        schoolDomain: combinedSubdomain,
        tenantName: primarySchool.name,
        role: "TENANT_ADMIN",
        staffRole: "Tenant Administrator",
        activeTiers: ['DAYCARE', 'PRIMARY', 'SECONDARY'],
        permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
        sessionToken: distinctSessionToken,
      });

      const response = NextResponse.json({
        success: true,
        message: "Combined tenants successfully provisioned.",
        tenant: {
          id: primarySchool.id,
          name: primarySchool.name,
          subdomain: combinedSubdomain,
          slug: combinedSubdomain,
          status: primarySchool.status,
          trialStartDate: primarySchool.trialStartDate,
          trialEndDate: primarySchool.trialEndDate,
        },
        subdomain: combinedSubdomain,
        schoolName,
        adminEmail,
        sslReady: sslSyncResult.sslReady,
        targetFqdn: sslSyncResult.targetFqdn,
        portalUrl: `/${combinedSubdomain}`,
        subdomainUrl: `${proto}://${combinedSubdomain}.${rootDomain}`,
        fullDirectPortalUrl: `${proto}://${rootDomain}/${combinedSubdomain}`,
        loginUrl: `/${combinedSubdomain}/login`,
        subdomainLoginUrl: `${proto}://${combinedSubdomain}.${rootDomain}/login`,
        dashboardUrl: `/${combinedSubdomain}/dashboard`,
        subdomainDashboardUrl: `${proto}://${combinedSubdomain}.${rootDomain}/dashboard`,
        redirectUrl: `/${combinedSubdomain}/dashboard`,
        sessionToken: sessionResult.sessionToken,
        token: sessionResult.cookieToken,
        sessionPayload: {
          userId: primaryStaff.id,
          email: adminEmail,
          tenantId: primarySchool.id,
          schoolDomain: combinedSubdomain,
          tenantName: primarySchool.name,
          role: "TENANT_ADMIN",
          staffRole: "Tenant Administrator",
          activeTiers: ['DAYCARE', 'PRIMARY', 'SECONDARY'],
          permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
          sessionToken: sessionResult.sessionToken,
          token: sessionResult.cookieToken,
        },
        trialDays: 14,
        sslStatus: sslSyncResult.sslReady ? "SSL_READY" : "AWAITING_HANDSHAKE",
      });

      response.cookies.set(
        SESSION_COOKIE_NAME,
        sessionResult.cookieToken,
        getSecureCookieOptions(SESSION_MAX_AGE_SECONDS)
      );

      return response;
    }

    // Standard Tenant Provisioning Transaction
    const newSchool = await basePrisma.$transaction(async (tx) => {
      // 1. Create School record with instant ACTIVE status
      const school = await tx.school.create({
        data: {
          name: schoolName,
          subdomain: formattedSubdomain,
          slug: formattedSubdomain,
          status: "ACTIVE",
          contactPhone: contactPhone || null,
          isActive: true,
          isBanned: false,
          trialStartDate: now,
          trialEndDate: fourteenDaysOut,
          collectionMode: "MANUAL_BANK_TRANSFER",
        },
      });

      // 2. Persist exact standardized academic tiers matching UI checkboxes
      for (let i = 0; i < tiers.length; i++) {
        await tx.academicTier.create({
          data: {
            schoolId: school.id,
            name: tiers[i],
            level: i + 1,
          },
        });
      }

      // 3. Automatically seed initial active 14-day manual trial subscription (amount: 0.0)
      await tx.subscription.create({
        data: {
          schoolId: school.id,
          plan: "14_DAY_TRIAL",
          amount: 0.0,
          status: "ACTIVE",
          paymentMethod: "MANUAL",
          verifiedByAdmin: true,
          expiresAt: fourteenDaysOut,
        },
      });

      // 4. Seed initial school payment ledger record (amount: 0.0)
      await tx.schoolPayment.create({
        data: {
          schoolId: school.id,
          amount: 0.0,
          type: "SUBSCRIPTION",
          status: "VERIFIED",
        },
      });

      // 5. Create default department
      const dept = await tx.department.create({
        data: {
          schoolId: school.id,
          name: "Administration",
        }
      });

      const user = await tx.user.upsert({
        where: { schoolId_email: { schoolId: school.id, email: adminEmail } },
        update: {
          passwordHash: adminPasswordHash,
          role: "SCHOOL_ADMIN",
          mustChangePassword: false,
          status: "ACTIVE",
        },
        create: {
          schoolId: school.id,
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: "SCHOOL_ADMIN",
          mustChangePassword: false,
          status: "ACTIVE",
        },
      });

      const staff = await tx.staff.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          firstName: "Admin",
          lastName: "User",
          email: adminEmail,
          departmentId: dept.id,
          status: "ACTIVE",
          activeAt: now,
        }
      });

      await tx.$executeRawUnsafe(`
        INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, password_updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET must_change_password = $3, password_updated_at = NOW();
      `, staff.id, school.id, false);

      // 7. Provision isolated database boundary
      await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${formattedSubdomain}";`);

      return { school, staff };
    });

    // Dispatch Registration Success Email to the School Admin
    try {
      console.log(`[REGISTER_EMAIL] Triggering registration success email for: ${adminEmail}...`);
      const emailResult = await sendSchoolRegistrationSuccessEmail({
        schoolName,
        subdomain: formattedSubdomain,
        adminEmail,
        adminPassword: adminPassword || password,
        contactPhone: contactPhone || null,
        tiers,
        schoolId: newSchool.school.id,
      });
      console.log(`[REGISTER_EMAIL] Completed with status:`, emailResult?.deliveryStatus);
    } catch (emailErr) {
      console.error("[REGISTER_EMAIL_SEND_EXCEPTION]:", emailErr);
    }

    // Synchronize SSL generation with onboarding pipeline:
    // Trigger reverse proxy TLS binding and await initial handshake confirmation
    const sslSyncResult = await warmAndVerifySSLHandshake(formattedSubdomain, rootDomain, proto);

    // Automatically issue authenticated database session for newly created Tenant Administrator
    const distinctSessionToken = crypto.randomUUID();
    const sessionResult = await createDatabaseSession({
      userId: newSchool.staff.id,
      email: adminEmail,
      tenantId: newSchool.school.id,
      schoolDomain: formattedSubdomain,
      tenantName: newSchool.school.name,
      role: "TENANT_ADMIN",
      staffRole: "Tenant Administrator",
      activeTiers: tiers,
      permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      sessionToken: distinctSessionToken,
    });

    const response = NextResponse.json({
      success: true,
      message: "Tenant successfully provisioned.",
      tenant: {
        id: newSchool.school.id,
        name: newSchool.school.name,
        subdomain: formattedSubdomain,
        slug: formattedSubdomain,
        status: newSchool.school.status,
        trialStartDate: newSchool.school.trialStartDate,
        trialEndDate: newSchool.school.trialEndDate,
      },
      subdomain: formattedSubdomain,
      schoolName,
      adminEmail,
      sslReady: sslSyncResult.sslReady,
      targetFqdn: sslSyncResult.targetFqdn,
      portalUrl: `/${formattedSubdomain}`,
      subdomainUrl: `${proto}://${formattedSubdomain}.${rootDomain}`,
      fullDirectPortalUrl: `${proto}://${rootDomain}/${formattedSubdomain}`,
      loginUrl: `/${formattedSubdomain}/login`,
      subdomainLoginUrl: `${proto}://${formattedSubdomain}.${rootDomain}/login`,
      dashboardUrl: `/${formattedSubdomain}/dashboard`,
      subdomainDashboardUrl: `${proto}://${formattedSubdomain}.${rootDomain}/dashboard`,
      redirectUrl: `/${formattedSubdomain}/dashboard`,
      sessionToken: sessionResult.sessionToken,
      token: sessionResult.cookieToken,
      sessionPayload: {
        userId: newSchool.staff.id,
        email: adminEmail,
        tenantId: newSchool.school.id,
        schoolDomain: formattedSubdomain,
        tenantName: newSchool.school.name,
        role: "TENANT_ADMIN",
        staffRole: "Tenant Administrator",
        activeTiers: tiers,
        permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
        sessionToken: sessionResult.sessionToken,
        token: sessionResult.cookieToken,
      },
      trialDays: 14,
      sslStatus: sslSyncResult.sslReady ? "SSL_READY" : "AWAITING_HANDSHAKE",
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionResult.cookieToken,
      getSecureCookieOptions(SESSION_MAX_AGE_SECONDS)
    );

    return response;

  } catch (error: any) {
    console.error("CRITICAL_PROVISIONING_EXCEPTION:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error during provisioning",
        code: error.code || "CRITICAL_PROVISIONING_ERROR",
        meta: error.meta || null,
      },
      { status: 500 }
    );
  }
}
