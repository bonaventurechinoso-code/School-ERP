import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { getDefaultPermissionsForRole } from "@/lib/auth";
import { createDatabaseSession } from "@/lib/session-manager";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashPassword } from "@/lib/security-service";
import { registerTenantInStore } from "@/app/dashboard/super-admin/mock-data";

export const dynamic = "force-dynamic";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * POST /api/trials/create
 * Input: schoolName, adminName, email, phone, password
 * Creates a brand new real trial tenant in PostgreSQL.
 * Empty state: 0 students, 0 extra staff, 0 revenue.
 * Redirects to /onboarding?tenant=slug
 */
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body might be FormData or URL-encoded
    }

    const schoolName = (body.schoolName || body.name || "My Academy").trim();
    const adminName = (body.adminName || body.fullName || "School Administrator").trim();
    const email = (body.email || body.adminEmail || "").trim().toLowerCase();
    const phone = (body.phone || body.contactPhone || "").trim();
    const password = body.password || "Password123!";

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Administrator email address is required." },
        { status: 400 }
      );
    }

    // 1. Generate unique slug
    let slug = slugify(schoolName);
    if (!slug || slug.length < 2) {
      slug = `school-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const existingSchool = await basePrisma.school.findFirst({
      where: {
        OR: [{ subdomain: slug }, { slug: slug }],
      },
    });

    if (existingSchool) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const codePrefix = (slug.replace(/[^a-z0-9]/gi, "").slice(0, 4) || "SCH").toUpperCase();
    const code = `${codePrefix}${Math.floor(100 + Math.random() * 900)}`;

    const now = new Date();
    const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const passwordHash = await hashPassword(password);

    // 2. Create tenant in PostgreSQL with empty state (0 students, 0 extra staff, 0 MRR)
    const result = await basePrisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: schoolName,
          subdomain: slug,
          slug: slug,
          status: "trial",
          subscriptionStatus: "ACTIVE",
          isActive: true,
          isBanned: false,
          contactPhone: phone || null,
          trialStartDate: now,
          trialEndDate: fourteenDaysOut,
          isPublicPortalEnabled: true,
          welcomeGreeting: `Welcome to ${schoolName}! Explore administrative workflows during your 14-day free trial.`,
          academicTiers: {
            create: [
              { name: "Daycare / Nursery", level: 1 },
              { name: "Primary School", level: 2 },
              { name: "Secondary School", level: 3 },
            ],
          },
          departments: {
            create: [{ name: "Administration" }],
          },
        },
        include: {
          academicTiers: true,
          departments: true,
        },
      });

      // Seed 14-day trial subscription record
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

      // Create Admin User
      const user = await tx.user.create({
        data: {
          schoolId: school.id,
          email: email,
          role: "SCHOOL_ADMIN",
          passwordHash: passwordHash,
          mustChangePassword: false,
          status: "ACTIVE",
        },
      });

      // Create Admin Staff
      const nameParts = adminName.split(" ");
      const firstName = nameParts[0] || "Admin";
      const lastName = nameParts.slice(1).join(" ") || "User";

      const staff = await tx.staff.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          firstName: firstName,
          lastName: lastName,
          email: email,
          departmentId: school.departments[0]?.id,
          status: "ACTIVE",
        },
      });

      // Synchronize Tenant table with trial details
      try {
        await tx.tenant.create({
          data: {
            schoolName: schoolName,
            subdomain: slug,
            adminEmail: email,
            contactPhone: phone || "+234 800 000 0000",
            institutionTypes: ["PRIMARY", "SECONDARY"],
            status: "ACTIVE",
            subscriptionStatus: "TRIALING",
            isDemo: false,
            isTrial: true,
            trialEndsAt: fourteenDaysOut,
          },
        });
      } catch (tenantSyncErr) {
        console.warn("[TRIAL_CREATE] Tenant sync warning:", tenantSyncErr);
      }

      return { school, user, staff };
    });

    // 3. Register in in-memory store so Super Admin sees it immediately
    registerTenantInStore({
      id: result.school.id,
      name: result.school.name,
      code: code,
      subdomain: result.school.subdomain,
      tier: "Free",
      studentsCount: 0,
      planStatus: "Trial",
      subscriptionStatus: "Free Trial",
      monthlyRevenue: 0,
      contactEmail: email,
      contactPhone: phone || "+234 800 000 0000",
      joinedDate: "Today",
      adminName: adminName,
      isDemo: false,
      isTrial: true,
      trialEndsAt: fourteenDaysOut.toISOString(),
    });

    // 4. Log audit event
    await logAuditEvent({
      action: "TRIAL_CREATED",
      actorId: result.staff.id,
      schoolId: result.school.id,
      target: result.school.name,
      metadata: {
        status: "trial",
        planTier: "free_trial",
        trialEndsAt: fourteenDaysOut.toISOString(),
        mrr: 0,
        subdomain: result.school.subdomain,
      },
    });

    // 5. Generate session token
    const sessionResult = await createDatabaseSession({
      userId: result.staff.id,
      email: email,
      tenantId: result.school.id,
      schoolDomain: result.school.subdomain,
      tenantName: result.school.name,
      role: "SCHOOL_ADMIN",
      activeTiers: ["Daycare / Nursery", "Primary School", "Secondary School"],
      permissions: getDefaultPermissionsForRole("SCHOOL_ADMIN"),
      userAgent: "Trial Registration",
    });

    const redirectPath = `/onboarding?tenant=${result.school.subdomain}`;

    const response = NextResponse.json({
      success: true,
      message: "14-day free trial created successfully.",
      tenant: {
        id: result.school.id,
        name: result.school.name,
        subdomain: result.school.subdomain,
        isTrial: true,
        trialEndsAt: fourteenDaysOut.toISOString(),
      },
      redirectUrl: redirectPath,
    });

    response.cookies.set("session", sessionResult.cookieToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    response.cookies.set("activeTier", "Primary School", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error: any) {
    console.error("[TRIAL_CREATION_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create trial." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trials/create
 * Allows direct browser navigation or test calls.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const schoolName = url.searchParams.get("schoolName") || "Grace Hills Academy";
  const adminName = url.searchParams.get("adminName") || "Dr. Sarah Ade";
  const email = url.searchParams.get("email") || `admin.${Date.now().toString().slice(-4)}@bonaveeict.com.ng`;
  const phone = url.searchParams.get("phone") || "+2348012345678";

  const fakeReq = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolName, adminName, email, phone, password: "Password123!" }),
  });

  return POST(fakeReq);
}
