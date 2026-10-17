import { basePrisma } from "./tenant-prisma";
import { hashPassword } from "./security-service";
import { recordTenantCreated, sendSuperAdminTenantRegistrationEmail } from "./admin-notifications";
import { sendSchoolRegistrationSuccessEmail } from "./mail";
import { registerTenantInStore } from "@/app/dashboard/super-admin/mock-data";
import { logAuditEvent } from "./audit-logger";

export interface CreateTenantWithAdminParams {
  slug: string;
  name: string;
  adminEmail: string;
  adminPassword: string;
  contactPhone?: string | null;
  tiers?: string[];
}

export interface TenantWithAdminResult {
  school: any;
  user: any;
  staff: any;
}

/**
 * Extracts and normalizes school code/slug from user input, subdomain, or hostname.
 */
export function normalizeSchoolCode(input: string): string {
  if (!input || typeof input !== "string") return "";
  let cleaned = input.trim().toLowerCase();
  // Strip protocol and port if present
  cleaned = cleaned.replace(/^https?:\/\//, "").split(":")[0];
  // Strip known apex domains
  const apexDomains = [
    (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "bonaveeict.com.ng").toLowerCase(),
    "bonaveeict.com.ng",
    "localhost",
  ];
  for (const apex of apexDomains) {
    if (cleaned.endsWith(`.${apex}`)) {
      cleaned = cleaned.slice(0, -(apex.length + 1));
      break;
    }
  }
  return cleaned.replace(/[^a-z0-9_-]/g, "");
}

/**
 * Canonical shared lookup for tenants used by Login, Forgot Password, and other auth endpoints.
 * Case-insensitive, trimmed, and strictly looks up by slug, subdomain, or ID without hardcoded exclusions.
 */
export async function resolveTenant(schoolCode: string) {
  const normalizedCode = normalizeSchoolCode(schoolCode);
  if (!normalizedCode) return null;

  return basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: { equals: normalizedCode, mode: "insensitive" } },
        { slug: { equals: normalizedCode, mode: "insensitive" } },
        { id: normalizedCode },
      ],
      deletedAt: null,
    },
    include: {
      academicTiers: { orderBy: { level: "asc" } },
      tierDatabases: true,
    },
  });
}

/**
 * Single unified function for tenant creation across Landing Page and Super Admin console.
 * Atomically creates School, AcademicTier(s), 14-day trial Subscription, Department, User, and Staff in ONE transaction.
 * Notification, emails, and audit logs are only dispatched AFTER successful database commit.
 */
export async function createTenantWithAdmin(
  params: CreateTenantWithAdminParams
): Promise<TenantWithAdminResult> {
  const { slug, name, adminEmail, adminPassword, contactPhone, tiers = [] } = params;

  // 1. Validation & normalization
  const canonicalSlug = (slug || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!canonicalSlug) {
    throw new Error("Invalid school code or URL slug. Only lowercase alphanumeric characters are allowed.");
  }

  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new Error("School name is required.");
  }

  const normalizedEmail = (adminEmail || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("A valid institutional administrator email is required.");
  }

  const effectivePassword = (adminPassword || "").trim();
  if (!effectivePassword || effectivePassword.length < 8) {
    throw new Error("Administrative password must be at least 8 characters long.");
  }

  // 2. Slug uniqueness check
  const existingSchool = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: { equals: canonicalSlug, mode: "insensitive" } },
        { slug: { equals: canonicalSlug, mode: "insensitive" } },
      ],
      deletedAt: null,
    },
  });

  if (existingSchool) {
    throw new Error(`The URL slug "${canonicalSlug}" is already taken. Please choose another.`);
  }

  // 3. Hash password using the canonical enterprise bcrypt algorithm (12 rounds)
  const passwordHash = await hashPassword(effectivePassword);

  const now = new Date();
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Normalize academic tiers
  const effectiveTiers = Array.isArray(tiers) && tiers.length > 0 ? tiers : ["Senior Secondary School"];

  // 4. Atomic Transaction: School + Tiers + Subscription + Department + User + Staff
  const transactionResult = await basePrisma.$transaction(async (tx) => {
    // A. School row: status ACTIVE, slug and subdomain strictly canonicalSlug
    const school = await tx.school.create({
      data: {
        name: trimmedName,
        subdomain: canonicalSlug,
        slug: canonicalSlug,
        status: "ACTIVE",
        contactPhone: contactPhone?.trim() || null,
        isActive: true,
        isBanned: false,
        trialStartDate: now,
        trialEndDate: fourteenDaysOut,
        collectionMode: "MANUAL_BANK_TRANSFER",
      },
    });

    // B. Academic tiers
    for (let i = 0; i < effectiveTiers.length; i++) {
      await tx.academicTier.create({
        data: {
          schoolId: school.id,
          name: effectiveTiers[i],
          level: i + 1,
        },
      });
    }

    // C. Initial 14-day manual trial subscription
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

    // D. Initial school payment record
    await tx.schoolPayment.create({
      data: {
        schoolId: school.id,
        amount: 0.0,
        type: "SUBSCRIPTION",
        status: "VERIFIED",
      },
    });

    // E. Default Department
    const dept = await tx.department.create({
      data: {
        schoolId: school.id,
        name: "Administration",
      },
    });

    // F. User row in platform DB (authoritative auth record)
    const user = await tx.user.upsert({
      where: { schoolId_email: { schoolId: school.id, email: normalizedEmail } },
      update: {
        passwordHash,
        role: "SCHOOL_ADMIN",
        mustChangePassword: false,
        status: "ACTIVE",
      },
      create: {
        schoolId: school.id,
        email: normalizedEmail,
        passwordHash,
        role: "SCHOOL_ADMIN",
        mustChangePassword: false,
        status: "ACTIVE",
      },
    });

    // G. Staff row linked directly to User
    const staff = await tx.staff.create({
      data: {
        schoolId: school.id,
        userId: user.id,
        firstName: "Admin",
        lastName: "User",
        email: normalizedEmail,
        departmentId: dept.id,
        status: "ACTIVE",
        activeAt: now,
      },
    });

    // H. Backward-compatible security table sync
    try {
      await tx.$executeRawUnsafe(
        `INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, password_updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET must_change_password = $3, password_updated_at = NOW();`,
        user.id,
        school.id,
        false
      );
    } catch {}

    // I. Optional schema boundary creation
    try {
      await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${canonicalSlug}";`);
    } catch {}

    return { school, user, staff };
  });

  const { school, user, staff } = transactionResult;

  // 5. Post-Commit Actions (Only executed if transaction committed successfully)
  // Super admin store cache
  try {
    registerTenantInStore({
      id: school.id,
      name: trimmedName,
      code: canonicalSlug.toUpperCase().slice(0, 7),
      subdomain: canonicalSlug,
      tier: "Free",
      studentsCount: 0,
      planStatus: "Trial",
      subscriptionStatus: "Free Trial",
      monthlyRevenue: 0,
      contactEmail: normalizedEmail,
      contactPhone: contactPhone || "+234 800 000 0000",
      joinedDate: "Today",
      adminName: "Tenant Administrator",
      trialEndsAt: fourteenDaysOut.toISOString(),
    });
  } catch (err) {
    console.warn("[TENANT_STORE_CACHE_WARNING]:", err);
  }

  // Welcome email to newly provisioned tenant administrator
  try {
    await sendSchoolRegistrationSuccessEmail({
      schoolName: trimmedName,
      subdomain: canonicalSlug,
      adminEmail: normalizedEmail,
      adminPassword: effectivePassword,
      contactPhone: contactPhone || null,
      tiers: effectiveTiers,
      schoolId: school.id,
    });
  } catch (emailErr) {
    console.error("[TENANT_WELCOME_EMAIL_ERROR]:", emailErr);
  }

  // Super-admin notification and alert email
  try {
    await recordTenantCreated({
      schoolId: school.id,
      schoolName: trimmedName,
      subdomain: canonicalSlug,
      adminEmail: normalizedEmail,
      tiers: effectiveTiers,
    });
    await sendSuperAdminTenantRegistrationEmail({
      schoolName: trimmedName,
      subdomain: canonicalSlug,
      adminEmail: normalizedEmail,
      contactPhone: contactPhone || null,
      tiers: effectiveTiers,
      schoolId: school.id,
    });
  } catch (notifErr) {
    console.error("[SUPER_ADMIN_NOTIFICATION_ERROR]:", notifErr);
  }

  // Audit log
  try {
    await logAuditEvent({
      actorId: user.id,
      action: "TENANT_REGISTERED",
      target: trimmedName,
      schoolId: school.id,
      metadata: {
        subdomain: canonicalSlug,
        adminEmail: normalizedEmail,
        tiers: effectiveTiers,
      },
    });
  } catch {}

  return { school, user, staff };
}
