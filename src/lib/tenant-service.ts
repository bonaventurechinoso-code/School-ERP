import { basePrisma } from "./tenant-prisma";
import { hashPassword } from "./security-service";
import { recordTenantCreated, recordTenantDeleted, sendSuperAdminTenantRegistrationEmail } from "./admin-notifications";
import { sendSchoolRegistrationSuccessEmail, sendPasswordRecommendationEmail } from "./mail";
import { registerTenantInStore, removeTenantFromStore } from "@/app/dashboard/super-admin/mock-data";
import { logAuditEvent } from "./audit-logger";
import { isReservedSubdomain } from "./tenant-resolver";
import { clearTenantCache } from "@/lib/tenant-status";
import { invalidateTenantMetadata } from "@/lib/cache-invalidation";
import { getCanonicalClassNamesForTier } from "./school-tier-classes";

export interface CreateTenantWithAdminParams {
  slug: string;
  name: string;
  adminEmail: string;
  adminPassword: string;
  contactPhone?: string | null;
  tiers?: string[];
  tertiaryType?: string | null;
  isSelfRegistration?: boolean;
  mustChangePassword?: boolean;
  isTemporaryPassword?: boolean;
}

export interface TenantWithAdminResult {
  school: any;
  user: any;
  staff: any;
  emailResult?: any;
}

/**
 * Evaluates whether a password that meets minimum requirements is relatively weak
 * (e.g. contains common dictionary/weak terms, low special character variety, or short length).
 */
export function isWeakPassword(password: string): boolean {
  if (!password) return true;
  const lower = password.toLowerCase();
  const commonWeakPatterns = ["password", "1234", "123456", "12345678", "admin", "school", "welcome", "qwerty"];
  const hasCommonPattern = commonWeakPatterns.some((p) => lower.includes(p));
  const specialMatches = password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/g) || [];
  const hasLowVariety = specialMatches.length <= 1;
  const isShort = password.length < 10;
  return hasCommonPattern || isShort || hasLowVariety;
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

  try {
    return await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: { equals: normalizedCode, mode: "insensitive" } },
          { slug: { equals: normalizedCode, mode: "insensitive" } },
          { id: normalizedCode },
          ...(normalizedCode === "sandbox" ? [{ subdomain: { equals: "trial-sandbox", mode: "insensitive" as const } }, { slug: { equals: "trial-sandbox", mode: "insensitive" as const } }] : []),
          ...(normalizedCode === "trial-sandbox" ? [{ subdomain: { equals: "sandbox", mode: "insensitive" as const } }, { slug: { equals: "sandbox", mode: "insensitive" as const } }] : []),
        ],
        deletedAt: null,
      },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
        tierDatabases: true,
      },
    });
  } catch (err: any) {
    console.warn("[resolveTenant] Primary lookup notice:", err?.message);
    try {
      return await basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: { equals: normalizedCode, mode: "insensitive" } },
            { slug: { equals: normalizedCode, mode: "insensitive" } },
            { id: normalizedCode },
          ],
          deletedAt: null,
        },
        include: {
          academicTiers: true,
        },
      });
    } catch (fallbackErr: any) {
      console.error("[resolveTenant] Critical lookup failure:", fallbackErr?.message);
      return null;
    }
  }
}

/**
 * Automatically provisions canonical standard classrooms for an academic tier of a school.
 * Safe, fast, and idempotent: batch inserts missing classrooms using createMany.
 */
export async function provisionDefaultClassroomsForSchool(
  db: any,
  schoolId: string,
  tierId?: string | null,
  tierName?: string
): Promise<Array<{ id: string; name: string }>> {
  if (!schoolId) return [];
  const classNames = getCanonicalClassNamesForTier(tierName || "Primary School");
  if (!classNames || classNames.length === 0) return [];

  try {
    const existing = await db.classroom.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
    const existingSet = new Set(existing.map((c: any) => c.name.toLowerCase().trim()));

    const toCreate = classNames
      .filter((name) => !existingSet.has(name.toLowerCase().trim()))
      .map((name) => ({
        schoolId,
        name,
        capacity: 35,
        tierId: tierId || null,
      }));

    if (toCreate.length > 0) {
      await db.classroom.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    return await db.classroom.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
  } catch (batchErr) {
    console.warn(`[provisionDefaultClassroomsForSchool] Batch provision notice:`, batchErr);
    return [];
  }
}

/**
 * Single unified function for tenant creation across Landing Page and Super Admin console.
 * Atomically creates School, AcademicTier(s), 14-day trial Subscription, Department, User, and Staff in ONE transaction.
 * Notification, emails, and audit logs are only dispatched AFTER successful database commit.
 */
export async function createTenantWithAdmin(
  params: CreateTenantWithAdminParams
): Promise<TenantWithAdminResult> {
  const { slug, name, adminEmail, adminPassword, contactPhone, tiers = [], tertiaryType } = params;

  // 1. Validation & normalization (allows lowercase alphanumeric and hyphens)
  const canonicalSlug = (slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!canonicalSlug) {
    throw new Error("Invalid school code or URL slug. Only lowercase alphanumeric characters and hyphens are allowed.");
  }

  // Reserved subdomain protection
  if (isReservedSubdomain(canonicalSlug)) {
    throw new Error(`The URL slug "${canonicalSlug}" is reserved by the platform. Please choose another.`);
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

  // 2. Slug uniqueness check across School and Tenant models
  const [existingSchool, existingTenant] = await Promise.all([
    basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: { equals: canonicalSlug, mode: "insensitive" } },
          { slug: { equals: canonicalSlug, mode: "insensitive" } },
        ],
        deletedAt: null,
      },
    }),
    basePrisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: { equals: canonicalSlug, mode: "insensitive" } },
          { slug: { equals: canonicalSlug, mode: "insensitive" } },
        ],
      },
    }),
  ]);

  if (existingSchool || existingTenant) {
    throw new Error(`The URL slug "${canonicalSlug}" is already taken. Please choose another.`);
  }

  // 3. Hash password using the canonical enterprise bcrypt algorithm (12 rounds)
  const passwordHash = await hashPassword(effectivePassword);

  const now = new Date();
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Normalize academic tiers
  const effectiveTiers = Array.isArray(tiers) && tiers.length > 0 ? tiers : ["Senior Secondary School"];

  const isSelfReg = params.isSelfRegistration ?? true;
  const mustChange = params.mustChangePassword !== undefined
    ? params.mustChangePassword
    : !isSelfReg;
  const isTemp = params.isTemporaryPassword !== undefined
    ? params.isTemporaryPassword
    : !isSelfReg;

  // 4. Atomic Transaction: Core Tenant Identity (School + Tiers + Subscription + Department + User + Staff)
  const transactionResult = await basePrisma.$transaction(
    async (tx) => {
      // A. School row: status ACTIVE, slug and subdomain strictly canonicalSlug
      let derivedTier: any = "TERTIARY";
      const lowerName = trimmedName.toLowerCase();
      const joinedTiers = effectiveTiers.join(" ").toLowerCase();
      if (lowerName.includes("creche") || joinedTiers.includes("creche")) {
        derivedTier = "CRECHE";
      } else if (lowerName.includes("primary") || joinedTiers.includes("primary") || joinedTiers.includes("nursery")) {
        derivedTier = "PRIMARY";
      } else if (lowerName.includes("secondary") || joinedTiers.includes("secondary") || joinedTiers.includes("high")) {
        derivedTier = "SECONDARY";
      }

      const school = await tx.school.create({
        data: {
          name: trimmedName,
          subdomain: canonicalSlug,
          slug: canonicalSlug,
          status: "ACTIVE",
          tier: derivedTier,
          tertiaryType: derivedTier === "TERTIARY" ? (tertiaryType as any) || "UNIVERSITY" : null,
          contactPhone: contactPhone?.trim() || null,
          isActive: true,
          isBanned: false,
          trialStartDate: now,
          trialEndDate: fourteenDaysOut,
          collectionMode: "MANUAL_BANK_TRANSFER",
        },
      });

      // A2. Synchronize Tenant model record (stores slug and customDomain: null)
      try {
        await tx.tenant.upsert({
          where: { subdomain: canonicalSlug },
          update: {
            schoolName: trimmedName,
            adminEmail: normalizedEmail,
            slug: canonicalSlug,
            customDomain: null,
            status: "ACTIVE",
          },
          create: {
            schoolName: trimmedName,
            subdomain: canonicalSlug,
            slug: canonicalSlug,
            customDomain: null,
            adminEmail: normalizedEmail,
            contactPhone: contactPhone?.trim() || "",
            institutionTypes: effectiveTiers,
            status: "ACTIVE",
          },
        });
      } catch (tErr) {
        console.warn("[TENANT_SERVICE_RECORD_SYNC]:", tErr);
      }

      // B. Academic tiers
      const createdTiers: Array<{ id: string; name: string }> = [];
      for (let i = 0; i < effectiveTiers.length; i++) {
        const tierRecord = await tx.academicTier.create({
          data: {
            schoolId: school.id,
            name: effectiveTiers[i],
            level: i + 1,
          },
        });
        createdTiers.push({ id: tierRecord.id, name: effectiveTiers[i] });
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
          mustChangePassword: mustChange,
          status: "ACTIVE",
        },
        create: {
          schoolId: school.id,
          email: normalizedEmail,
          passwordHash,
          role: "SCHOOL_ADMIN",
          mustChangePassword: mustChange,
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

      // H. Backward-compatible security table sync (User & Staff)
      try {
        await tx.$executeRawUnsafe(
          `INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, is_temporary_password, password_updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET must_change_password = $3, is_temporary_password = $4, password_updated_at = NOW();`,
          user.id,
          school.id,
          mustChange,
          isTemp
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, is_temporary_password, password_updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET must_change_password = $3, is_temporary_password = $4, password_updated_at = NOW();`,
          staff.id,
          school.id,
          mustChange,
          isTemp
        );
      } catch { }

      // I. Optional schema boundary creation
      try {
        await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${canonicalSlug}";`);
      } catch { }

      return { school, user, staff, createdTiers };
    },
    {
      maxWait: 15000, // Maximum time Prisma client waits to acquire transaction lock (15s)
      timeout: 60000, // Extended transaction timeout to avoid expired transaction exceptions (60s)
    }
  );

  const { school, user, staff, createdTiers } = transactionResult;

  // 5. Post-Commit Actions (Only executed after transaction has committed successfully)
  // Standard classrooms auto-provisioning (Batch executed post-commit for maximum speed & safety)
  for (const ct of createdTiers) {
    try {
      await provisionDefaultClassroomsForSchool(basePrisma, school.id, ct.id, ct.name);
    } catch (classErr) {
      console.warn(`[provisionDefaultClassroomsForSchool]: Failed for tier ${ct.name} in school ${school.id}:`, classErr);
    }
  }
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
  let emailResult: any = null;
  try {
    emailResult = await sendSchoolRegistrationSuccessEmail({
      schoolName: trimmedName,
      subdomain: canonicalSlug,
      adminEmail: normalizedEmail,
      adminPassword: effectivePassword,
      contactPhone: contactPhone || null,
      tiers: effectiveTiers,
      schoolId: school.id,
    });
  } catch (emailErr: any) {
    console.error("[TENANT_WELCOME_EMAIL_ERROR]:", emailErr);
    emailResult = { success: false, error: emailErr?.message || String(emailErr) };
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

  // Audit log for tenant registration
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
  } catch { }

  // Soft warning / recommendation email for weak-but-valid passwords on self-registration
  const isWeak = isWeakPassword(effectivePassword);
  if (isSelfReg && isWeak) {
    try {
      await sendPasswordRecommendationEmail({
        schoolName: trimmedName,
        subdomain: canonicalSlug,
        adminEmail: normalizedEmail,
        schoolId: school.id,
      });
    } catch (recEmailErr) {
      console.warn("[PASSWORD_RECOMMENDATION_EMAIL_WARNING]:", recEmailErr);
    }

    try {
      await logAuditEvent({
        actorId: user.id,
        action: "PASSWORD_POLICY_UPDATED",
        target: user.email,
        schoolId: school.id,
        metadata: {
          note: "Soft recommendation: weak password detected during self-registration",
          emailDispatched: true,
        },
      });
    } catch (auditErr) {
      console.warn("[PASSWORD_POLICY_AUDIT_WARNING]:", auditErr);
    }
  }

  return { school, user, staff, emailResult };
}

export interface HardDeleteResult {
  success: boolean;
  schoolId?: string;
  subdomain?: string;
  name?: string;
  purgedTablesCount: number;
}

/**
 * Irreversibly and permanently purges a tenant and all its associated data
 * everywhere across the production PostgreSQL database.
 */
export async function hardDeleteTenant(identifier: string): Promise<HardDeleteResult> {
  const cleanId = (identifier || "").trim();
  if (!cleanId) {
    throw new Error("Tenant identifier is required for hard delete.");
  }

  // 1. Locate School and Tenant records across all aliases and subdomains
  const initialSchools = await basePrisma.school.findMany({
    where: {
      OR: [
        { id: cleanId },
        { subdomain: { equals: cleanId, mode: "insensitive" } },
        { slug: { equals: cleanId, mode: "insensitive" } },
      ],
    },
  });
  console.log("[HARD_DELETE] initialSchools found:", initialSchools);

  const discoveredSubdomains = Array.from(
    new Set(
      [
        cleanId.toLowerCase(),
        ...initialSchools.map((s) => s.subdomain?.toLowerCase()),
        ...initialSchools.map((s) => s.slug?.toLowerCase()),
      ].filter(Boolean) as string[]
    )
  );

  const initialTenants = await basePrisma.tenant.findMany({
    where: {
      OR: [
        { id: cleanId },
        { subdomain: { in: discoveredSubdomains, mode: "insensitive" } },
        { slug: { in: discoveredSubdomains, mode: "insensitive" } },
      ],
    },
  });

  const allSubdomains = Array.from(
    new Set(
      [
        ...discoveredSubdomains,
        ...initialTenants.map((t) => t.subdomain?.toLowerCase()),
        ...initialTenants.map((t) => t.slug?.toLowerCase()),
      ].filter(Boolean) as string[]
    )
  );

  const schools = await basePrisma.school.findMany({
    where: {
      OR: [
        { id: cleanId },
        { subdomain: { in: allSubdomains, mode: "insensitive" } },
        { slug: { in: allSubdomains, mode: "insensitive" } },
      ],
    },
  });
  const tenants = initialTenants;

  const schoolIds = Array.from(new Set([...schools.map((s) => s.id), cleanId]));
  const tenantIds = Array.from(new Set([...tenants.map((t) => t.id), cleanId]));
  const allTargetIds = Array.from(new Set([...schoolIds, ...tenantIds]));
  const subdomains = allSubdomains;
  console.log("[HARD_DELETE] Targets:", { schoolIds, tenantIds, allTargetIds, subdomains });

  const primarySchool = schools[0];
  const primaryTenant = tenants[0];
  const targetName = primarySchool?.name || primaryTenant?.schoolName || cleanId;
  const primarySubdomain = primarySchool?.subdomain || primaryTenant?.subdomain || cleanId;

  // 2. Clear all L1/L2 Redis caches and in-memory global store
  for (const sub of subdomains) {
    await clearTenantCache(sub).catch(() => { });
    await invalidateTenantMetadata(sub).catch(() => { });
    removeTenantFromStore(sub);
  }
  for (const id of allTargetIds) {
    await clearTenantCache(id).catch(() => { });
    removeTenantFromStore(id);
  }

  // 3. Notify admin notification logs
  await recordTenantDeleted({
    schoolId: primarySchool?.id || cleanId,
    schoolName: targetName,
    subdomain: primarySubdomain,
  }).catch(() => { });

  // 4. Exhaustive hard purge of all associated child data across database
  let purgedCount = 0;

  // Academic and student child records
  await basePrisma.studentAttendance.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.staffAttendance.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.studentParent.deleteMany({ where: { student: { schoolId: { in: schoolIds } } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.gradeRecord.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.reportCard.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.academicRecord.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.examResult.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.exam.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.timetable.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.notice.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.messageLog.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.admissionLead.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.paymentProof.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.payment.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.invoice.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.feeTemplate.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.transaction.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.payrollRecord.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.student.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.staff.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.course.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.classroom.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.department.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.tenantTierDatabase.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.academicTier.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.passwordResetToken.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.refreshToken.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.subscription.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.schoolPayment.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.user.deleteMany({ where: { schoolId: { in: schoolIds } } }).then(() => purgedCount++).catch(() => { });

  // Tenant model dependencies & wallets
  await basePrisma.walletTransaction.deleteMany({
    where: {
      OR: [
        { wallet: { tenantId: { in: allTargetIds } } },
        { wallet: { tenant: { subdomain: { in: subdomains } } } },
      ],
    },
  }).then(() => purgedCount++).catch(() => { });

  await basePrisma.wallet.deleteMany({
    where: {
      OR: [
        { tenantId: { in: allTargetIds } },
        { tenant: { subdomain: { in: subdomains } } },
      ],
    },
  }).then(() => purgedCount++).catch(() => { });

  await basePrisma.tenantCampus.deleteMany({ where: { tenantId: { in: allTargetIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.tenantFeatureFlag.deleteMany({ where: { tenantId: { in: allTargetIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.tenantNotification.deleteMany({ where: { tenantId: { in: allTargetIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.tenantSubscriptionPayment.deleteMany({ where: { tenantId: { in: allTargetIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.tenantPaymentSettings.deleteMany({ where: { tenantId: { in: allTargetIds } } }).then(() => purgedCount++).catch(() => { });
  await basePrisma.subscriptionPayment.deleteMany({ where: { tenantId: { in: allTargetIds } } }).then(() => purgedCount++).catch(() => { });

  // Raw database tables (security, sessions, and exams)
  for (const sId of schoolIds) {
    try {
      await basePrisma.$executeRawUnsafe(`DELETE FROM bonavee_user_security WHERE school_id = $1`, sId);
    } catch { }
  }
  for (const id of allTargetIds) {
    try {
      await basePrisma.$executeRawUnsafe(`DELETE FROM bonavee_scheduled_exams WHERE tenant_id = $1`, id);
    } catch { }
    try {
      await basePrisma.$executeRawUnsafe(`DELETE FROM bonavee_database_sessions WHERE tenant_id = $1`, id);
    } catch { }
  }

  // Drop isolated PostgreSQL tenant schemas if present
  for (const sub of subdomains) {
    const cleanSub = sub.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
    if (cleanSub && cleanSub !== "public") {
      try {
        await basePrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "tenant_${cleanSub}" CASCADE;`);
      } catch (dropErr) {
        console.warn(`[HARD_DELETE] Schema drop notice for tenant_${cleanSub}:`, dropErr);
      }
    }
  }

  // 5. Hard delete primary School & Tenant rows
  const deletedSchools = await basePrisma.school.deleteMany({
    where: {
      OR: [
        { id: { in: schoolIds } },
        { subdomain: { in: subdomains } },
      ],
    },
  }).catch((err) => { console.error("[HARD_DELETE] school.deleteMany error:", err); return { count: 0 }; });

  const deletedTenants = await basePrisma.tenant.deleteMany({
    where: {
      OR: [
        { id: { in: allTargetIds } },
        { subdomain: { in: subdomains } },
      ],
    },
  }).catch((err) => { console.error("[HARD_DELETE] tenant.deleteMany error:", err); return { count: 0 }; });

  console.log(`[HARD_DELETE] Result: ${deletedSchools.count} schools, ${deletedTenants.count} tenants deleted.`);

  // 6. Record authoritative Audit Log
  await basePrisma.auditLog.create({
    data: {
      actorId: "super_admin",
      action: "TENANT_HARD_DELETE",
      target: targetName,
      schoolId: primarySchool?.id || null,
      tenantId: primaryTenant?.id || null,
      metadata: {
        actorEmail: "admin@bonaveeict.com.ng",
        identifier: cleanId,
        schoolIds,
        tenantIds,
        subdomains,
        permanent: true,
        purgedTablesCount: purgedCount,
        timestamp: new Date().toISOString(),
      },
    },
  }).catch(() => { });

  return {
    success: true,
    schoolId: primarySchool?.id,
    subdomain: primarySubdomain,
    name: targetName,
    purgedTablesCount: purgedCount,
  };
}
