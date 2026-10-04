import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { getDefaultPermissionsForRole } from "@/lib/auth";
import { createDatabaseSession } from "@/lib/session-manager";

const SANDBOX_SUBDOMAIN = "sandbox";
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

  // Wrap the entire sandbox initialization in a transaction so partial retries don't leave duplicates
  const result = await basePrisma.$transaction(async (tx) => {
    // 1. Check if sandbox school already exists
    let school = await tx.school.findFirst({
      where: {
        OR: [
          { subdomain: "sandbox" },
          { subdomain: "trial-sandbox" },
          { slug: "sandbox" },
          { slug: "trial-sandbox" },
        ],
      },
      include: {
        academicTiers: true,
        staff: true,
        classrooms: true,
        students: true,
      },
    });

    const now = new Date();
    const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    if (!school) {
      // Create the isolated trial sandbox tenant
      school = await tx.school.create({
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
    } else if (!school.trialEndDate) {
      school = await tx.school.update({
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

    for (const t of completeTrialTiers) {
      await tx.academicTier.upsert({
        where: {
          schoolId_name: {
            schoolId: school.id,
            name: t.name,
          },
        },
        update: {
          level: t.level,
        },
        create: {
          schoolId: school.id,
          name: t.name,
          level: t.level,
        },
      });
    }

    const tiers = await tx.academicTier.findMany({
      where: { schoolId: school.id },
      orderBy: { level: "asc" },
    });

    const primaryTier = tiers.find((t) => t.name.includes("Primary")) || tiers[0];
    const secondaryTier = tiers.find((t) => t.name.includes("Secondary")) || tiers[tiers.length - 1];

    // 3. Ensure administration department exists
    const dept = await tx.department.upsert({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: "Academic Administration",
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        name: "Academic Administration",
      },
    });

    // 4. Ensure admin user exists
    const adminUser = await tx.user.upsert({
      where: {
        schoolId_email: {
          schoolId: school.id,
          email: SANDBOX_ADMIN_EMAIL,
        },
      },
      update: {
        role: "SCHOOL_ADMIN",
        status: "ACTIVE",
      },
      create: {
        schoolId: school.id,
        email: SANDBOX_ADMIN_EMAIL,
        role: "SCHOOL_ADMIN",
        passwordHash: "",
        mustChangePassword: true,
        status: "ACTIVE",
      },
    });

    // Unlink any other staff that might conflict on unique userId constraint
    const conflictingStaff = await tx.staff.findFirst({
      where: {
        userId: adminUser.id,
        NOT: { email: SANDBOX_ADMIN_EMAIL },
      },
    });
    if (conflictingStaff) {
      await tx.staff.update({
        where: { id: conflictingStaff.id },
        data: { userId: null },
      });
    }

    // 5. Upsert trial admin staff on schoolId_email (idempotent, prevents unique constraint failure)
    const adminStaff = await tx.staff.upsert({
      where: {
        schoolId_email: {
          schoolId: school.id,
          email: SANDBOX_ADMIN_EMAIL,
        },
      },
      update: {
        userId: adminUser.id,
        firstName: "Trial",
        lastName: "Administrator",
        status: "ACTIVE",
        departmentId: dept.id,
      },
      create: {
        schoolId: school.id,
        userId: adminUser.id,
        firstName: "Trial",
        lastName: "Administrator",
        email: SANDBOX_ADMIN_EMAIL,
        status: "ACTIVE",
        departmentId: dept.id,
      },
    });

    // 6. Ensure sample classrooms exist
    const classroomCount = await tx.classroom.count({
      where: { schoolId: school.id },
    });

    if (classroomCount === 0 && primaryTier && secondaryTier) {
      const classData = [
        { name: "Primary 1", capacity: 30, schoolId: school.id, tierId: primaryTier.id },
        { name: "Primary 5", capacity: 30, schoolId: school.id, tierId: primaryTier.id },
        { name: "JSS 1", capacity: 35, schoolId: school.id, tierId: secondaryTier.id },
        { name: "SSS 3", capacity: 35, schoolId: school.id, tierId: secondaryTier.id },
      ];
      for (const c of classData) {
        await tx.classroom.create({ data: c });
      }
    }

    // 7. Ensure sample students exist so the dashboard has rich data to explore
    const studentCount = await tx.student.count({
      where: { schoolId: school.id },
    });

    if (studentCount === 0 && primaryTier && secondaryTier) {
      const sampleStudents = [
        { firstName: "Amina", lastName: "Bello", currentClass: "Primary 1", tierId: primaryTier.id, admissionNumber: "SB/PRI/2026/001" },
        { firstName: "Emeka", lastName: "Okafor", currentClass: "Primary 5", tierId: primaryTier.id, admissionNumber: "SB/PRI/2026/002" },
        { firstName: "Chioma", lastName: "Adeyemi", currentClass: "JSS 1", tierId: secondaryTier.id, admissionNumber: "SB/SEC/2026/001" },
        { firstName: "Tunde", lastName: "Danjuma", currentClass: "SSS 3", tierId: secondaryTier.id, admissionNumber: "SB/SEC/2026/002" },
      ];

      for (const s of sampleStudents) {
        await tx.student.create({
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

    const refreshedSchool = await tx.school.findUnique({
      where: { id: school.id },
      include: {
        academicTiers: true,
        staff: true,
        classrooms: true,
        students: true,
      },
    });

    return {
      school: refreshedSchool || school,
      adminStaff,
      tierNames: tiers.map((t) => t.name),
    };
  });

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
