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
import { sendSchoolRegistrationSuccessEmail } from "@/lib/mail";
import { recordTenantCreated, sendSuperAdminTenantRegistrationEmail } from "@/lib/admin-notifications";
import { registerTenantInStore } from "@/app/dashboard/super-admin/mock-data";
import { createTenantWithAdmin } from "@/lib/tenant-service";
import { isReservedSubdomain, buildTenantUrl } from "@/lib/tenant-resolver";

const VALID_TIERS = [
  'Creche', 'CRECHE',
  'Nursery / Kindergarten', 'NURSERY', 'KINDERGARTEN',
  'Primary School', 'PRIMARY',
  'Junior Secondary School', 'Senior Secondary School', 'SECONDARY', 'JSS', 'SSS',
  'Technical / Vocational School', 'TECHNICAL', 'VOCATIONAL',
  'Islamiyya / Quranic School', 'ISLAMIYYA', 'QURANIC',
  'University', 'UNIVERSITY',
  'Polytechnic', 'POLYTECHNIC',
  'College of Education', 'COLLEGE_OF_EDUCATION', 'COLLEGE_OF_ED',
  'Monotechnic', 'MONOTECHNIC',
  'College of Nursing / Health Sciences', 'COLLEGE_OF_NURSING',
  'Professional / Postgraduate Institute', 'POSTGRADUATE', 'PROFESSIONAL',
  'PRIMARY_SECONDARY',
  'COMBINED_NURSERY_PRIMARY_SECONDARY'
];

function normalizeTier(tier: string): string {
  const upper = String(tier || "").trim().toUpperCase();
  if (upper === "CRECHE") return "Creche";
  if (upper === "NURSERY" || upper.includes("KINDERGARTEN")) return "Nursery / Kindergarten";
  if (upper === "PRIMARY") return "Primary School";
  if (upper === "SECONDARY" || upper === "JSS" || upper === "SSS") return "Senior Secondary School";
  if (upper === "UNIVERSITY") return "University";
  if (upper === "POLYTECHNIC") return "Polytechnic";
  if (upper.includes("EDUCATION") || upper === "COLLEGE_OF_ED") return "College of Education";
  if (upper === "MONOTECHNIC") return "Monotechnic";
  if (upper.includes("NURSING")) return "College of Nursing / Health Sciences";
  if (upper.includes("POSTGRADUATE") || upper.includes("PROFESSIONAL")) return "Professional / Postgraduate Institute";
  return tier;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schoolName, adminEmail, contactPhone, subdomain, tiers, password, adminPassword, tertiaryType } = body;

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
      const pwdValidation = validatePasswordStrength(effectiveAdminPassword.trim());
      if (!pwdValidation.valid) {
        return NextResponse.json(
          { error: pwdValidation.error || "Password must meet enterprise security requirements (min 8 chars, 1 uppercase, 1 numeric digit, 1 special character).", code: "INVALID_PASSWORD" },
          { status: 400 }
        );
      }
      adminPasswordToSave = effectiveAdminPassword.trim();
      isUserProvidedPassword = true;
    } else {
      return NextResponse.json(
        { error: "Admin password is required.", code: "MISSING_PASSWORD" },
        { status: 400 }
      );
    }

    const adminPasswordHash = await hashPassword(adminPasswordToSave);

    // Normalize and validate standard backend enum metadata
    const rawTiers = Array.isArray(tiers) ? tiers : [tiers];
    const invalidTiers = rawTiers.filter((t: string) => {
      const upper = String(t || "").trim().toUpperCase();
      return !VALID_TIERS.some(v => v.toUpperCase() === upper);
    });
    if (invalidTiers.length > 0) {
      return NextResponse.json(
        { error: `Invalid academic tier subtypes provided: ${invalidTiers.join(', ')}`, code: "INVALID_TIERS" },
        { status: 400 }
      );
    }
    const effectiveTiers = rawTiers.map(normalizeTier);

    // Format subdomain (lowercase, allow hyphens, remove spaces/special chars)
    const formattedSubdomain = subdomain
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!formattedSubdomain) {
      return NextResponse.json(
        { error: "Invalid subdomain.", code: "INVALID_SUBDOMAIN" },
        { status: 400 }
      );
    }

    // Reserved Subdomain Check
    if (isReservedSubdomain(formattedSubdomain)) {
      return NextResponse.json(
        {
          error: `The subdomain "${formattedSubdomain}" is reserved for platform operations. Please choose another.`,
          code: "RESERVED_SLUG",
          suggested: `${formattedSubdomain}-school`,
        },
        { status: 400 }
      );
    }

    // Check if subdomain is unique across School and Tenant tables
    const [existingSchool, existingTenant] = await Promise.all([
      basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: { equals: formattedSubdomain, mode: "insensitive" } },
            { slug: { equals: formattedSubdomain, mode: "insensitive" } },
          ],
          deletedAt: null,
        },
        select: { id: true, subdomain: true, slug: true },
      }),
      basePrisma.tenant.findFirst({
        where: {
          OR: [
            { subdomain: { equals: formattedSubdomain, mode: "insensitive" } },
            { slug: { equals: formattedSubdomain, mode: "insensitive" } },
          ],
        },
        select: { id: true, subdomain: true, slug: true },
      }),
    ]);

    if (existingSchool || existingTenant) {
      return NextResponse.json(
        {
          error: "This URL slug is already taken. Please choose another.",
          code: "SUBDOMAIN_TAKEN",
          suggested: `${formattedSubdomain}-2`,
        },
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
        { suffix: '-nursery', tier: 'CRECHE', name: `${schoolName} Nursery` },
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
            INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, is_temporary_password, password_updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET must_change_password = $3, is_temporary_password = $4, password_updated_at = NOW();
          `, user.id, school.id, false, false);
          await tx.$executeRawUnsafe(`
            INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, is_temporary_password, password_updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET must_change_password = $3, is_temporary_password = $4, password_updated_at = NOW();
          `, staff.id, school.id, false, false);

          await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${tenantSubdomain}";`);
          createdSchools.push({ school, staff });
        }
        return createdSchools;
      }, {
        maxWait: 15000,
        timeout: 60000,
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
          tiers: ['CRECHE', 'PRIMARY', 'SECONDARY'],
          schoolId: primarySchool.id,
        });
        console.log(`[REGISTER_EMAIL] Completed with status:`, emailResult?.deliveryStatus);
        if (!emailResult?.success) {
          console.error(`[EMAIL_SYNC_ERROR] [TENANT_REGISTRATION] Delivery failure:`, emailResult?.error);
        }
      } catch (emailErr) {
        console.error("[EMAIL_SYNC_ERROR] [TENANT_REGISTRATION] Exception:", emailErr);
      }

      // Trigger Super-Admin notification record and email alert
      try {
        await recordTenantCreated({
          schoolId: primarySchool.id,
          schoolName,
          subdomain: combinedSubdomain,
          adminEmail,
          tiers: ['CRECHE', 'PRIMARY', 'SECONDARY'],
        });
        await sendSuperAdminTenantRegistrationEmail({
          schoolName,
          subdomain: combinedSubdomain,
          adminEmail,
          contactPhone: contactPhone || null,
          tiers: ['CRECHE', 'PRIMARY', 'SECONDARY'],
          schoolId: primarySchool.id,
        });
      } catch (notifErr) {
        console.error("[SUPER_ADMIN_NOTIF_EXCEPTION]:", notifErr);
      }

      registerTenantInStore({
        id: primarySchool.id,
        name: schoolName,
        code: combinedSubdomain.toUpperCase().slice(0, 7),
        subdomain: combinedSubdomain,
        tier: "Free",
        studentsCount: 0,
        planStatus: "Trial",
        subscriptionStatus: "Free Trial",
        monthlyRevenue: 0,
        contactEmail: adminEmail,
        contactPhone: contactPhone || "+234 800 000 0000",
        joinedDate: "Today",
        adminName: "Tenant Administrator",
        trialEndsAt: fourteenDaysOut.toISOString(),
      });

      const distinctSessionToken = crypto.randomUUID();
      const sessionResult = await createDatabaseSession({
        userId: primaryStaff.id,
        email: adminEmail,
        tenantId: primarySchool.id,
        schoolDomain: combinedSubdomain,
        tenantName: primarySchool.name,
        role: "TENANT_ADMIN",
        staffRole: "Tenant Administrator",
        activeTiers: ['CRECHE', 'PRIMARY', 'SECONDARY'],
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
        portalUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/", proto),
        subdomainUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/", proto),
        fullDirectPortalUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/", proto),
        loginUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/login", proto),
        subdomainLoginUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/login", proto),
        dashboardUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/dashboard", proto),
        subdomainDashboardUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/dashboard", proto),
        redirectUrl: buildTenantUrl(combinedSubdomain, hostHeader, "/", proto),
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
          activeTiers: ['CRECHE', 'PRIMARY', 'SECONDARY'],
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

    // Standard Tenant Provisioning Transaction via Unified createTenantWithAdmin
    const newSchool = await createTenantWithAdmin({
      slug: formattedSubdomain,
      name: schoolName,
      adminEmail,
      adminPassword: adminPasswordToSave,
      contactPhone: contactPhone || null,
      tiers: effectiveTiers,
      tertiaryType: tertiaryType || null,
      isSelfRegistration: true,
      mustChangePassword: false,
      isTemporaryPassword: false,
    });

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
      activeTiers: effectiveTiers,
      permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      sessionToken: distinctSessionToken,
    });

    const portalUrl = buildTenantUrl(formattedSubdomain, hostHeader, "/", proto);
    const loginUrl = buildTenantUrl(formattedSubdomain, hostHeader, "/login", proto);
    const dashboardUrl = buildTenantUrl(formattedSubdomain, hostHeader, "/dashboard", proto);

    const emailSent = Boolean(newSchool.emailResult?.success);
    const emailStatus = newSchool.emailResult?.deliveryStatus || (emailSent ? "DELIVERED" : "PENDING_CONFIGURATION");

    const response = NextResponse.json({
      success: true,
      message: `Tenant "${schoolName}" successfully provisioned.`,
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
      emailSent,
      emailStatus,
      credentials: {
        schoolName,
        subdomain: formattedSubdomain,
        adminEmail,
        adminPassword: adminPasswordToSave,
        portalUrl,
        loginUrl,
      },
      sslReady: sslSyncResult.sslReady,
      targetFqdn: sslSyncResult.targetFqdn,
      portalUrl,
      subdomainUrl: portalUrl,
      fullDirectPortalUrl: portalUrl,
      loginUrl,
      subdomainLoginUrl: loginUrl,
      dashboardUrl,
      subdomainDashboardUrl: dashboardUrl,
      redirectUrl: portalUrl,
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
        activeTiers: effectiveTiers,
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
