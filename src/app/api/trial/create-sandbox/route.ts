import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { getDefaultPermissionsForRole } from "@/lib/auth";
import { createDatabaseSession } from "@/lib/session-manager";

const SANDBOX_SUBDOMAIN = "trial-sandbox";
const SANDBOX_SCHOOL_NAME = "Trial Sandbox Academy";
const SANDBOX_ADMIN_EMAIL = "trial.admin@schoolerp.local";

export const dynamic = "force-dynamic";

interface CachedTrialSandbox {
  school: any;
  adminStaff: any;
  tierNames: string[];
  cachedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __cachedTrialSandbox: CachedTrialSandbox | undefined;
}

const CACHE_TTL_MS = 60 * 1000;

/**
 * Idempotently provisions or retrieves the isolated trial sandbox tenant.
 * Safely seeds baseline school metadata, academic tiers, administration staff,
 * and sample classrooms/students completely isolated from the main SaaS administration layer.
 */
async function provisionOrGetTrialSandbox() {
  const cached = (globalThis as any).__cachedTrialSandbox as CachedTrialSandbox | undefined;
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      school: cached.school,
      adminStaff: cached.adminStaff,
      tierNames: cached.tierNames,
    };
  }

  // 1. Check if sandbox school already exists
  let school = await basePrisma.school.findUnique({
    where: { subdomain: SANDBOX_SUBDOMAIN },
    include: {
      academicTiers: true,
      staff: true,
      classrooms: true,
      students: true,
    },
  });

  if (!school) {
    const now = new Date();
    const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Create the isolated trial sandbox tenant
    school = await basePrisma.school.create({
      data: {
        name: SANDBOX_SCHOOL_NAME,
        subdomain: SANDBOX_SUBDOMAIN,
        slug: SANDBOX_SUBDOMAIN,
        isActive: true,
        isBanned: false,
        trialStartDate: now,
        trialEndDate: fourteenDaysOut,
        isPublicPortalEnabled: true,
        welcomeGreeting: "Welcome to your Trial Sandbox! Explore administrative workflows safely in this isolated environment.",
        academicTiers: {
          create: [
            { name: "Daycare / Nursery", level: 1 },
            { name: "Primary School", level: 2 },
            { name: "Secondary School", level: 3 },
            { name: "College of Education", level: 4 },
            { name: "Polytechnic", level: 5 },
            { name: "University", level: 6 },
          ],
        },
        departments: {
          create: [
            { name: "Academic Administration" },
          ],
        },
      },
      include: {
        academicTiers: true,
        staff: true,
        classrooms: true,
        students: true,
      },
    });
  }

  if (school && !school.trialEndDate) {
    const now = new Date();
    const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    school = await basePrisma.school.update({
      where: { id: school.id },
      data: {
        trialStartDate: school.trialStartDate || now,
        trialEndDate: fourteenDaysOut,
        isBanned: school.isBanned ?? false,
      },
      include: {
        academicTiers: true,
        staff: true,
        classrooms: true,
        students: true,
      },
    });
  }

  // 2. Ensure all 6 academic tiers exist
  const completeTrialTiers = [
    { name: "Daycare / Nursery", level: 1 },
    { name: "Primary School", level: 2 },
    { name: "Secondary School", level: 3 },
    { name: "College of Education", level: 4 },
    { name: "Polytechnic", level: 5 },
    { name: "University", level: 6 },
  ];

  let tiers = school.academicTiers;
  if (tiers.length < completeTrialTiers.length) {
    for (const t of completeTrialTiers) {
      const exists = tiers.some(
        (existing) => existing.name.toLowerCase() === t.name.toLowerCase()
      );
      if (!exists) {
        await basePrisma.academicTier.create({
          data: {
            schoolId: school.id,
            name: t.name,
            level: t.level,
          },
        });
      }
    }
    tiers = await basePrisma.academicTier.findMany({
      where: { schoolId: school.id },
      orderBy: { level: "asc" },
    });
  }

  const primaryTier = tiers.find(t => t.name.includes("Primary")) || tiers[0];
  const secondaryTier = tiers.find(t => t.name.includes("Secondary")) || tiers[tiers.length - 1];

  // 3 & 4. Ensure admin staff exists for the trial session
  let adminStaff = school.staff?.find((s: any) => s.role === "ADMIN") || null;
  if (!adminStaff) {
    let dept = await basePrisma.department.findFirst({
      where: { schoolId: school.id },
    });
    if (!dept) {
      dept = await basePrisma.department.create({
        data: {
          schoolId: school.id,
          name: "Academic Administration",
        },
      });
    }

    adminStaff = await basePrisma.staff.findFirst({
      where: { schoolId: school.id, user: { role: "SCHOOL_ADMIN" } },
    });
    if (!adminStaff) {
      let adminUser = await basePrisma.user.findFirst({
        where: { schoolId: school.id, email: SANDBOX_ADMIN_EMAIL },
      });
      if (!adminUser) {
        adminUser = await basePrisma.user.create({
          data: {
            schoolId: school.id,
            email: SANDBOX_ADMIN_EMAIL,
            role: "SCHOOL_ADMIN",
            passwordHash: "",
            mustChangePassword: true,
          }
        });
      }
      adminStaff = await basePrisma.staff.create({
        data: {
          schoolId: school.id,
          userId: adminUser.id,
          firstName: "Trial",
          lastName: "Administrator",
          email: SANDBOX_ADMIN_EMAIL,
          status: "ACTIVE",
          departmentId: dept.id,
        },
      });
    }
  }

  // 5. Ensure sample classrooms exist
  if (school.classrooms.length === 0) {
    const classData = [
      { name: "Primary 1", capacity: 30, schoolId: school.id, tierId: primaryTier.id },
      { name: "Primary 5", capacity: 30, schoolId: school.id, tierId: primaryTier.id },
      { name: "JSS 1", capacity: 35, schoolId: school.id, tierId: secondaryTier.id },
      { name: "SSS 3", capacity: 35, schoolId: school.id, tierId: secondaryTier.id },
    ];
    for (const c of classData) {
      await basePrisma.classroom.create({ data: c });
    }
  }

  // 6. Ensure sample students exist so the dashboard has rich data to explore
  if (school.students.length === 0) {
    const sampleStudents = [
      { firstName: "Amina", lastName: "Bello", currentClass: "Primary 1", tierId: primaryTier.id, admissionNumber: "SB/PRI/2026/001" },
      { firstName: "Emeka", lastName: "Okafor", currentClass: "Primary 5", tierId: primaryTier.id, admissionNumber: "SB/PRI/2026/002" },
      { firstName: "Chioma", lastName: "Adeyemi", currentClass: "JSS 1", tierId: secondaryTier.id, admissionNumber: "SB/SEC/2026/001" },
      { firstName: "Tunde", lastName: "Danjuma", currentClass: "SSS 3", tierId: secondaryTier.id, admissionNumber: "SB/SEC/2026/002" },
    ];

    for (const s of sampleStudents) {
      await basePrisma.student.create({
        data: {
          schoolId: school.id,
          tierId: s.tierId,
          firstName: s.firstName,
          lastName: s.lastName,
          currentClass: s.currentClass,
          admissionNumber: s.admissionNumber,
          status: "ENROLLED",
          parentName: `Mr/Mrs ${s.lastName}`,
          parentEmail: `parent.${s.lastName.toLowerCase()}@example.com`,
          parentPhone: "+2348012345678",
        },
      });
    }
  }

  const result = {
    school,
    adminStaff,
    tierNames: tiers.map(t => t.name),
  };

  (globalThis as any).__cachedTrialSandbox = {
    ...result,
    cachedAt: Date.now(),
  };

  return result;
}

/**
 * Creates an authenticated session JWT scoped strictly to the trial sandbox tenant.
 */
async function generateTrialSessionToken(
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
    role: "SCHOOL_ADMIN",
    activeTiers: activeTiers,
    permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
    userAgent: "Trial Sandbox Session",
  });

  return sessionResult.cookieToken;
}

/**
 * GET handler: Directly navigated when public users click "Start Free Trial".
 * Provisions the sandbox, sets the tenant admin session, and redirects to the isolated dashboard.
 */
export async function GET(req: Request) {
  try {
    const { school, adminStaff, tierNames } = await provisionOrGetTrialSandbox();

    const sessionToken = await generateTrialSessionToken(
      adminStaff.id,
      adminStaff.email,
      school.id,
      school.subdomain,
      school.name,
      tierNames
    );

    // Target route for local development uses ?mockTenant= to align with middleware tenant resolution
    const redirectPath = `/dashboard?mockTenant=${SANDBOX_SUBDOMAIN}`;
    const redirectUrl = new URL(redirectPath, req.url);

    const response = NextResponse.redirect(redirectUrl);

    // Attach trial session and active tier cookies
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
    console.error("[TRIAL_SANDBOX_PROVISIONING_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to initialize trial sandbox environment.", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST handler: Supports programmatic API invocation if called from asynchronous client workflows.
 */
export async function POST(req: Request) {
  try {
    const { school, adminStaff, tierNames } = await provisionOrGetTrialSandbox();

    const sessionToken = await generateTrialSessionToken(
      adminStaff.id,
      adminStaff.email,
      school.id,
      school.subdomain,
      school.name,
      tierNames
    );

    const redirectPath = `/dashboard?mockTenant=${SANDBOX_SUBDOMAIN}`;

    const response = NextResponse.json({
      success: true,
      message: "Trial sandbox environment initialized successfully.",
      tenant: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
      },
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
    console.error("[TRIAL_SANDBOX_PROVISIONING_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to initialize trial sandbox environment.", details: error?.message },
      { status: 500 }
    );
  }
}
