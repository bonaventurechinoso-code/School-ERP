import { NextResponse } from "next/server";
import { getDemoPrismaClient } from "@/lib/tenant-prisma";
import { getDefaultPermissionsForRole } from "@/lib/auth";
import { createDatabaseSession } from "@/lib/session-manager";
import { logAuditEvent } from "@/lib/audit-logger";
import { registerTenantInStore } from "@/app/dashboard/super-admin/mock-data";

const DEMO_SUBDOMAIN = "demo";
const DEMO_SCHOOL_NAME = "Demo School";
const DEMO_ADMIN_EMAIL = "demo.admin@schoolerp.local";

export const dynamic = "force-dynamic";

/**
 * Idempotently retrieves or seeds the single fixed demo tenant.
 * Uses getDemoPrismaClient() to strictly isolate Demo data to DEMO_DATABASE_URL.
 * Guaranteed to NEVER create multiple tenants on click.
 */
async function getOrProvisionDemoTenant() {
  const demoPrisma = getDemoPrismaClient();

  let demoSchool = await demoPrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: DEMO_SUBDOMAIN },
        { slug: DEMO_SUBDOMAIN },
      ],
    },
    include: {
      academicTiers: { orderBy: { level: "asc" } },
      staff: { include: { user: true } },
    },
  });

  if (!demoSchool) {
    demoSchool = await demoPrisma.school.create({
      data: {
        name: DEMO_SCHOOL_NAME,
        subdomain: DEMO_SUBDOMAIN,
        slug: DEMO_SUBDOMAIN,
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        isActive: true,
        isBanned: false,
        trialStartDate: null,
        trialEndDate: null,
        isPublicPortalEnabled: true,
        welcomeGreeting: "Welcome to Demo School! Explore administrative workflows freely in demo mode.",
        academicTiers: {
          create: [
            { name: "Creche / Nursery", level: 1 },
            { name: "Primary School", level: 2 },
            { name: "Secondary School", level: 3 },
            { name: "Higher Institution / University", level: 4 },
          ],
        },
        departments: {
          create: [{ name: "Academic Administration" }],
        },
      },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
        staff: { include: { user: true } },
      },
    });
  }

  // Idempotently verify / seed single fixed Demo Tenant in Tenant table
  try {
    const existingDemoTenant = await demoPrisma.tenant.findFirst({
      where: {
        OR: [
          { isDemo: true },
          { subdomain: DEMO_SUBDOMAIN },
        ],
      },
    });

    if (!existingDemoTenant) {
      await demoPrisma.tenant.create({
        data: {
          schoolName: DEMO_SCHOOL_NAME,
          subdomain: DEMO_SUBDOMAIN,
          adminEmail: DEMO_ADMIN_EMAIL,
          contactPhone: "+234 800 000 0000",
          institutionTypes: ["PRIMARY", "SECONDARY"],
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          isDemo: true,
          isTrial: false,
          trialEndsAt: null,
        },
      });
    } else if (!existingDemoTenant.isDemo || existingDemoTenant.isTrial) {
      await demoPrisma.tenant.update({
        where: { id: existingDemoTenant.id },
        data: {
          isDemo: true,
          isTrial: false,
          subscriptionStatus: "ACTIVE",
          trialEndsAt: null,
        },
      });
    }
  } catch (tenantSyncErr) {
    console.warn("[DEMO_SESSION] Demo tenant table sync check:", tenantSyncErr);
  }

  // Ensure tiers
  let tiers = demoSchool.academicTiers;
  if (!tiers || tiers.length === 0) {
    await demoPrisma.academicTier.createMany({
      data: [
        { schoolId: demoSchool.id, name: "Creche / Nursery", level: 1 },
        { schoolId: demoSchool.id, name: "Primary School", level: 2 },
        { schoolId: demoSchool.id, name: "Secondary School", level: 3 },
      ],
    });
    tiers = await demoPrisma.academicTier.findMany({
      where: { schoolId: demoSchool.id },
      orderBy: { level: "asc" },
    });
  }

  const tierNames = tiers.map((t) => t.name);

  // Ensure admin user & staff
  let adminStaff = demoSchool.staff?.find(
    (s: any) => s.user?.role === "SCHOOL_ADMIN" || s.user?.role === "SUPER_ADMIN"
  ) || demoSchool.staff?.[0];

  if (!adminStaff) {
    const adminUser = await demoPrisma.user.upsert({
      where: {
        schoolId_email: {
          schoolId: demoSchool.id,
          email: DEMO_ADMIN_EMAIL,
        },
      },
      update: { role: "SCHOOL_ADMIN", status: "ACTIVE" },
      create: {
        schoolId: demoSchool.id,
        email: DEMO_ADMIN_EMAIL,
        role: "SCHOOL_ADMIN",
        passwordHash: "",
        mustChangePassword: false,
        status: "ACTIVE",
      },
    });

    const dept = await demoPrisma.department.findFirst({
      where: { schoolId: demoSchool.id },
    });

    adminStaff = await demoPrisma.staff.upsert({
      where: {
        schoolId_email: {
          schoolId: demoSchool.id,
          email: DEMO_ADMIN_EMAIL,
        },
      },
      update: { userId: adminUser.id, status: "ACTIVE" },
      create: {
        schoolId: demoSchool.id,
        userId: adminUser.id,
        firstName: "Demo",
        lastName: "Administrator",
        email: DEMO_ADMIN_EMAIL,
        status: "ACTIVE",
        departmentId: dept?.id,
      },
      include: { user: true },
    });
  }

  // Update fixed demo school entry in in-memory store (DO NOT create new id)
  registerTenantInStore({
    id: demoSchool.id,
    name: demoSchool.name,
    code: "DEMO001",
    subdomain: DEMO_SUBDOMAIN,
    tier: "Free",
    studentsCount: 120,
    planStatus: "Active",
    subscriptionStatus: "Active",
    monthlyRevenue: 0,
    contactEmail: DEMO_ADMIN_EMAIL,
    contactPhone: "+234 800 000 0000",
    joinedDate: "Oct 13, 2026",
    adminName: "Demo Administrator",
    isDemo: true,
    isTrial: false,
    trialEndsAt: undefined,
  });

  return {
    demoSchool,
    staffId: adminStaff.id,
    staffEmail: adminStaff.email || DEMO_ADMIN_EMAIL,
    tierNames,
  };
}

/**
 * Creates authenticated session for Demo School.
 */
async function generateDemoSessionToken(
  staffId: string,
  staffEmail: string,
  schoolId: string,
  schoolDomain: string,
  schoolName: string,
  activeTiers: string[]
): Promise<string> {
  const sessionResult = await createDatabaseSession({
    userId: staffId,
    email: staffEmail,
    tenantId: schoolId,
    schoolDomain: schoolDomain,
    tenantName: schoolName,
    role: "TENANT_ADMIN",
    activeTiers: activeTiers,
    permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
    userAgent: "Demo School Session",
  });

  return sessionResult.cookieToken;
}

/**
 * GET handler: Public users clicking "Explore Demo Environment".
 * Routes to /demo/admin with X-Demo-Mode: DEMO MODE header.
 */
export async function GET(req: Request) {
  try {
    const { demoSchool, staffId, staffEmail, tierNames } = await getOrProvisionDemoTenant();

    await logAuditEvent({
      action: "DEMO_SESSION",
      actorId: staffId || "DEMO_USER",
      schoolId: demoSchool.id,
      target: demoSchool.name,
      metadata: {
        event: "DEMO_SESSION",
        subdomain: DEMO_SUBDOMAIN,
        visitedAt: new Date().toISOString(),
      },
    });

    const sessionToken = await generateDemoSessionToken(
      staffId,
      staffEmail,
      demoSchool.id,
      demoSchool.subdomain,
      demoSchool.name,
      tierNames
    );

    // Redirect to /demo/dashboard
    const redirectUrl = new URL(`/demo/dashboard`, req.url);
    const response = NextResponse.redirect(redirectUrl);

    response.headers.set("X-Demo-Mode", "DEMO MODE");

    response.cookies.set("session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    response.cookies.set("activeTier", tierNames[0] || "Primary School", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error: any) {
    console.error("[DEMO_SESSION_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to initialize demo environment session.", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST handler: Client fetch from landing page.
 */
export async function POST(req: Request) {
  try {
    const { demoSchool, staffId, staffEmail, tierNames } = await getOrProvisionDemoTenant();

    await logAuditEvent({
      action: "DEMO_SESSION",
      actorId: staffId || "DEMO_USER",
      schoolId: demoSchool.id,
      target: demoSchool.name,
      metadata: {
        event: "DEMO_SESSION",
        subdomain: DEMO_SUBDOMAIN,
        visitedAt: new Date().toISOString(),
      },
    });

    const sessionToken = await generateDemoSessionToken(
      staffId,
      staffEmail,
      demoSchool.id,
      demoSchool.subdomain,
      demoSchool.name,
      tierNames
    );

    const response = NextResponse.json({
      success: true,
      message: "Demo session initialized.",
      tenant: {
        id: demoSchool.id,
        name: demoSchool.name,
        subdomain: DEMO_SUBDOMAIN,
        isDemo: true,
      },
      role: "TENANT_ADMIN",
      redirectUrl: "/demo/dashboard",
    });

    response.headers.set("X-Demo-Mode", "DEMO MODE");

    response.cookies.set("session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    response.cookies.set("activeTier", tierNames[0] || "Primary School", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error: any) {
    console.error("[DEMO_SESSION_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to initialize demo environment session.", details: error?.message },
      { status: 500 }
    );
  }
}
