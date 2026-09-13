import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import * as jose from "jose";
import { getDefaultPermissionsForRole } from "@/lib/auth";

const DEMO_SUBDOMAIN = "demo";
const DEMO_SCHOOL_NAME = "Demo School";
const DEMO_ADMIN_EMAIL = "demo.admin@schoolerp.local";

/**
 * Idempotently retrieves or provisions the isolated demo school tenant.
 * Ensures Demo School exists with baseline tiers, staff, and configurations
 * strictly isolated from the global platform administration layer.
 */
async function getOrProvisionDemoTenant() {
  let demoSchool = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: DEMO_SUBDOMAIN },
        { name: { contains: "Demo", mode: "insensitive" } },
      ],
    },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
      staff: true,
    },
  });

  if (!demoSchool) {
    demoSchool = await basePrisma.school.create({
      data: {
        name: DEMO_SCHOOL_NAME,
        subdomain: DEMO_SUBDOMAIN,
        isActive: true,
        isBanned: false,
        isPublicPortalEnabled: true,
        welcomeGreeting: "Welcome to the Demo School Environment! Explore institutional workflows safely in complete isolation.",
        academicTiers: {
          create: [
            { name: "Daycare / Nursery", level: 1 },
            { name: "Primary School", level: 2 },
            { name: "Secondary School", level: 3 },
            { name: "Higher Institution / University", level: 4 },
          ],
        },
        departments: {
          create: [
            { name: "Academic Administration" },
          ],
        },
      },
      include: {
        academicTiers: {
          orderBy: { level: "asc" },
        },
        staff: true,
      },
    });
  }

  // Ensure academic tiers are present
  let tiers = demoSchool.academicTiers;
  if (!tiers || tiers.length === 0) {
    await basePrisma.academicTier.createMany({
      data: [
        { schoolId: demoSchool.id, name: "Daycare / Nursery", level: 1 },
        { schoolId: demoSchool.id, name: "Primary School", level: 2 },
        { schoolId: demoSchool.id, name: "Secondary School", level: 3 },
        { schoolId: demoSchool.id, name: "Higher Institution / University", level: 4 },
      ],
    });
    tiers = await basePrisma.academicTier.findMany({
      where: { schoolId: demoSchool.id },
      orderBy: { level: "asc" },
    });
  }

  const tierNames = tiers.map((t) => t.name);
  const adminStaff = demoSchool.staff?.find((s) => s.role === "ADMIN" || s.role === "TENANT_ADMIN") || demoSchool.staff?.[0];

  return {
    demoSchool,
    staffId: adminStaff?.id || "demo-tenant-admin-id",
    staffEmail: adminStaff?.email || DEMO_ADMIN_EMAIL,
    tierNames,
  };
}

/**
 * Generates an authenticated session JWT scoped strictly to the Demo School tenant.
 * Uses role 'TENANT_ADMIN' to restrict master platform access while granting full demo tenant access.
 */
async function generateDemoSessionToken(
  staffId: string,
  staffEmail: string,
  schoolId: string,
  schoolDomain: string,
  schoolName: string,
  activeTiers: string[]
): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
  const secret = new TextEncoder().encode(jwtSecret);

  return new jose.SignJWT({
    userId: staffId,
    email: staffEmail,
    tenantId: schoolId,
    schoolDomain: schoolDomain,
    tenantName: schoolName,
    role: "TENANT_ADMIN",
    activeTiers: activeTiers,
    permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

/**
 * GET handler: Directly navigated when public users click "Explore Demo Environment".
 * Generates a mock TENANT_ADMIN session tied strictly to Demo School and redirects to /demo/dashboard.
 */
export async function GET(req: Request) {
  try {
    const { demoSchool, staffId, staffEmail, tierNames } = await getOrProvisionDemoTenant();

    const sessionToken = await generateDemoSessionToken(
      staffId,
      staffEmail,
      demoSchool.id,
      demoSchool.subdomain,
      demoSchool.name,
      tierNames
    );

    // Direct user into the isolated Demo School dashboard context
    const redirectPath = `/${demoSchool.subdomain}/dashboard`;
    const redirectUrl = new URL(redirectPath, req.url);

    const response = NextResponse.redirect(redirectUrl);

    // Attach secure demo session and active tier cookies
    response.cookies.set("session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    response.cookies.set("activeTier", tierNames[0] || "Primary School", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error: any) {
    console.error("[DEMO_SESSION_INITIALIZATION_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to initialize demo environment session.", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST handler: Programmatic initialization support for asynchronous client workflows.
 */
export async function POST(req: Request) {
  try {
    const { demoSchool, staffId, staffEmail, tierNames } = await getOrProvisionDemoTenant();

    const sessionToken = await generateDemoSessionToken(
      staffId,
      staffEmail,
      demoSchool.id,
      demoSchool.subdomain,
      demoSchool.name,
      tierNames
    );

    const redirectPath = `/${demoSchool.subdomain}/dashboard`;

    const response = NextResponse.json({
      success: true,
      message: "Demo environment session initialized successfully.",
      tenant: {
        id: demoSchool.id,
        name: demoSchool.name,
        subdomain: demoSchool.subdomain,
      },
      role: "TENANT_ADMIN",
      redirectUrl: redirectPath,
    });

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
    console.error("[DEMO_SESSION_INITIALIZATION_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to initialize demo environment session.", details: error?.message },
      { status: 500 }
    );
  }
}
