import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { triggerSSLProvisioning } from "@/lib/ssl-provisioning";

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
    const { schoolName, adminEmail, contactPhone, subdomain, tiers } = body;

    // Validate inputs
    if (!schoolName || !adminEmail || !subdomain || !tiers || tiers.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields or academic tiers.", code: "VALIDATION_FAILED" },
        { status: 400 }
      );
    }

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
    const defaultRoot = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "bonaveeict.com.ng").toLowerCase().replace(/^www\./, "").trim();
    const rootDomain = rawHost && (rawHost.endsWith("schoolerp.com") || rawHost.endsWith("bonaveeict.com.ng"))
      ? (rawHost.endsWith("schoolerp.com") ? "schoolerp.com" : "bonaveeict.com.ng")
      : defaultRoot;

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

          await tx.staff.create({
            data: {
              schoolId: school.id,
              firstName: "Admin",
              lastName: "User",
              email: adminEmail,
              role: "ADMIN",
              departmentId: dept.id,
              status: "ACTIVE",
              activeAt: now,
              password: ""
            }
          });

          await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${tenantSubdomain}";`);
          createdSchools.push(school);
        }
        return createdSchools;
      });

      // Trigger non-blocking SSL & DNS provisioning for primary subdomain
      triggerSSLProvisioning(`${formattedSubdomain}-primary`).catch((err) =>
        console.warn("[SSL_PROVISIONING_COMBINED_WARN]:", err?.message)
      );

      return NextResponse.json({
        success: true,
        message: "Combined tenants successfully provisioned.",
        tenant: {
          id: newSchools[0].id,
          name: newSchools[0].name,
          subdomain: `${formattedSubdomain}-primary`,
          slug: `${formattedSubdomain}-primary`,
          status: newSchools[0].status,
          trialStartDate: newSchools[0].trialStartDate,
          trialEndDate: newSchools[0].trialEndDate,
        },
        subdomain: `${formattedSubdomain}-primary`,
        schoolName,
        adminEmail,
        portalUrl: `/${formattedSubdomain}-primary`,
        subdomainUrl: `${proto}://${formattedSubdomain}-primary.${rootDomain}`,
        fullDirectPortalUrl: `${proto}://${rootDomain}/${formattedSubdomain}-primary`,
        loginUrl: `/${formattedSubdomain}-primary/login`,
        subdomainLoginUrl: `${proto}://${formattedSubdomain}-primary.${rootDomain}/login`,
        dashboardUrl: `/${formattedSubdomain}-primary/dashboard`,
        redirectUrl: `/${formattedSubdomain}-primary/login`,
        trialDays: 14,
        sslStatus: "AUTOMATED_PROVISIONING_TRIGGERED",
      });
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

      // 6. Create default admin staff account
      await tx.staff.create({
        data: {
          schoolId: school.id,
          firstName: "Admin",
          lastName: "User",
          email: adminEmail,
          role: "ADMIN",
          departmentId: dept.id,
          status: "ACTIVE",
          activeAt: now,
          password: ""
        }
      });

      // 7. Provision isolated database boundary
      await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${formattedSubdomain}";`);

      return school;
    });

    // Trigger non-blocking SSL & DNS provisioning for the tenant subdomain
    triggerSSLProvisioning(formattedSubdomain).catch((err) =>
      console.warn("[SSL_PROVISIONING_STANDARD_WARN]:", err?.message)
    );

    return NextResponse.json({
      success: true,
      message: "Tenant successfully provisioned.",
      tenant: {
        id: newSchool.id,
        name: newSchool.name,
        subdomain: formattedSubdomain,
        slug: formattedSubdomain,
        status: newSchool.status,
        trialStartDate: newSchool.trialStartDate,
        trialEndDate: newSchool.trialEndDate,
      },
      subdomain: formattedSubdomain,
      schoolName,
      adminEmail,
      portalUrl: `/${formattedSubdomain}`,
      subdomainUrl: `${proto}://${formattedSubdomain}.${rootDomain}`,
      fullDirectPortalUrl: `${proto}://${rootDomain}/${formattedSubdomain}`,
      loginUrl: `/${formattedSubdomain}/login`,
      subdomainLoginUrl: `${proto}://${formattedSubdomain}.${rootDomain}/login`,
      dashboardUrl: `/${formattedSubdomain}/dashboard`,
      redirectUrl: `/${formattedSubdomain}/login`,
      trialDays: 14,
      sslStatus: "AUTOMATED_PROVISIONING_TRIGGERED",
    });

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
