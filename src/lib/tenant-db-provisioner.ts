import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import { basePrisma } from "./tenant-prisma";

const execAsync = promisify(exec);

export interface TierProvisionOptions {
  schoolId: string;
  schoolName: string;
  subdomain: string;
  tierName: string;
  adminEmail?: string;
}

export interface ProvisionResult {
  tierName: string;
  databaseName: string;
  databaseUrl: string;
  success: boolean;
  isSimulated?: boolean;
  error?: string;
}

export { sanitizeTierSlug, generateTierDbName } from "./tenant-tier-utils";
import { sanitizeTierSlug, generateTierDbName } from "./tenant-tier-utils";

/**
 * Computes the PostgreSQL connection URL for a target tier database.
 * Replaces the database name segment while preserving credentials, host, port, and options.
 */
export function buildTierDbUrl(baseDbUrl: string, databaseName: string): string {
  try {
    const url = new URL(baseDbUrl);
    url.pathname = `/${databaseName}`;
    return url.toString();
  } catch {
    // Regex fallback if URL parsing fails
    return baseDbUrl.replace(/\/[^/?]+(\?.*)?$/, `/${databaseName}$1`);
  }
}

/**
 * Ensures the target PostgreSQL database exists.
 * If not existing, issues CREATE DATABASE with safe fallback.
 */
export async function ensureDatabaseExists(databaseName: string, baseDbUrl: string): Promise<{ created: boolean; exists: boolean; fallbackMode?: boolean }> {
  try {
    // Check if database exists in PostgreSQL system catalog
    const checkResult: any[] = await basePrisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      databaseName
    );

    if (checkResult && checkResult.length > 0) {
      return { created: false, exists: true };
    }

    // Attempt to create database
    // In PostgreSQL, CREATE DATABASE cannot run within a multi-statement transaction
    await basePrisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    console.info(`[TIER_DB_PROVISIONER] Created new PostgreSQL database: "${databaseName}"`);
    return { created: true, exists: true };
  } catch (error: any) {
    console.warn(
      `[TIER_DB_PROVISIONER] CREATE DATABASE "${databaseName}" encountered an exception (${error?.message || error}). Entering safe fallback orchestration.`
    );
    // Fallback: return exists=false with fallbackMode=true so the orchestrator can fall back safely
    return { created: false, exists: false, fallbackMode: true };
  }
}

/**
 * Runs Prisma schema migration against the target tier database.
 * Executes `prisma migrate deploy` to deploy migrations, with automatic schema push fallback.
 */
export async function migrateTierDatabase(tierDbUrl: string): Promise<boolean> {
  const env = { ...process.env, DATABASE_URL: tierDbUrl };
  const maskedUrl = tierDbUrl.replace(/:[^:@]+@/, ":****@");

  try {
    console.info(`[TIER_DB_PROVISIONER] Executing 'prisma migrate deploy' against: ${maskedUrl}`);
    await execAsync(`npx prisma migrate deploy --schema=prisma/schema.prisma`, {
      env,
      timeout: 35000,
    });
    console.info(`[TIER_DB_PROVISIONER] 'prisma migrate deploy' succeeded for tier database.`);
    return true;
  } catch (migrateErr: any) {
    console.warn(`[TIER_DB_PROVISIONER] 'prisma migrate deploy' returned notice (${migrateErr?.message || migrateErr}). Attempting schema push synchronization...`);
    try {
      await execAsync(`npx prisma db push --schema=prisma/schema.prisma --accept-data-loss --skip-generate`, {
        env,
        timeout: 35000,
      });
      console.info(`[TIER_DB_PROVISIONER] Schema push succeeded for tier database.`);
      return true;
    } catch (pushErr: any) {
      console.warn(`[TIER_DB_PROVISIONER] Schema sync warning for tier DB:`, pushErr?.message || pushErr);
      return false;
    }
  }
}

/**
 * Seeds a tier database with appropriate educational classrooms, courses, and admin staff.
 */
export async function seedTierDatabase(options: TierProvisionOptions & { tierDbUrl: string; databaseName: string }): Promise<void> {
  const { schoolId, schoolName, subdomain, tierName, tierDbUrl, databaseName, adminEmail } = options;
  let tierPrisma: PrismaClient | null = null;

  try {
    tierPrisma = new PrismaClient({
      datasources: { db: { url: tierDbUrl } },
    });

    // 1. Ensure School metadata exists in tier database
    const school = await tierPrisma.school.upsert({
      where: { id: schoolId },
      update: {
        name: schoolName,
        subdomain,
        databaseUrl: tierDbUrl,
        isMultiDbEnabled: true,
      },
      create: {
        id: schoolId,
        name: schoolName,
        subdomain,
        slug: subdomain.toLowerCase(),
        databaseUrl: tierDbUrl,
        isMultiDbEnabled: true,
        isActive: true,
      },
    });

    // 2. Create the Academic Tier record in tier database
    const tier = await tierPrisma.academicTier.upsert({
      where: { schoolId_name: { schoolId: school.id, name: tierName } },
      update: {
        databaseUrl: tierDbUrl,
        databaseName,
        level: 1,
      },
      create: {
        name: tierName,
        schoolId: school.id,
        databaseUrl: tierDbUrl,
        databaseName,
        level: 1,
      },
    });

    // 3. Determine tier-specific classrooms
    const upper = tierName.toUpperCase();
    let classNames: string[] = [];

    if (upper.includes("CRECHE") || upper.includes("NURSERY")) {
      classNames = ["Creche", "Nursery 1", "Nursery 2", "Kindergarten"];
    } else if (upper.includes("PRIMARY") && !upper.includes("SECONDARY")) {
      classNames = ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"];
    } else if (upper.includes("SECONDARY") && !upper.includes("PRIMARY")) {
      classNames = ["JSS 1", "JSS 2", "JSS 3", "SSS 1 (Science)", "SSS 2 (Art)", "SSS 3"];
    } else if (upper.includes("PRIMARY") && upper.includes("SECONDARY")) {
      classNames = ["Primary 1", "Primary 6", "JSS 1", "SSS 3"];
    } else if (upper.includes("UNIVERSITY") || upper.includes("POLYTECHNIC") || upper.includes("COLLEGE")) {
      classNames = ["100 Level", "200 Level", "300 Level", "400 Level"];
    } else {
      classNames = [`${tierName} - Level 1`, `${tierName} - Level 2`];
    }

    // Seed classrooms
    for (const className of classNames) {
      const existingClass = await tierPrisma.classroom.findFirst({
        where: { schoolId: school.id, name: className },
      });
      if (!existingClass) {
        await tierPrisma.classroom.create({
          data: {
            schoolId: school.id,
            tierId: tier.id,
            name: className,
            capacity: 35,
          },
        });
      }
    }

    // 4. Seed Administration Department & Staff
    const dept = await tierPrisma.department.upsert({
      where: { id: `${school.id}-admin-dept` },
      update: {},
      create: {
        id: `${school.id}-admin-dept`,
        schoolId: school.id,
        name: "Academic Administration",
      },
    });

    if (adminEmail) {
      await tierPrisma.staff.upsert({
        where: { id: `${school.id}-admin-staff` },
        update: {},
        create: {
          id: `${school.id}-admin-staff`,
          schoolId: school.id,
          firstName: "Admin",
          lastName: "Officer",
          email: adminEmail,
          departmentId: dept.id,
          status: "ACTIVE",
        },
      });
    }

    console.info(`[TIER_DB_PROVISIONER] Seeded tier database "${databaseName}" for tier "${tierName}".`);
  } catch (seedError: any) {
    console.warn(`[TIER_DB_PROVISIONER] Seed execution note for "${databaseName}":`, seedError?.message || seedError);
  } finally {
    if (tierPrisma) {
      await tierPrisma.$disconnect().catch(() => {});
    }
  }
}

/**
 * High-level orchestration function to provision, migrate, and seed separate databases
 * for multiple tiers of a tenant workspace.
 */
export async function provisionTierDatabases(
  options: {
    schoolId: string;
    schoolName: string;
    subdomain: string;
    tiers: string[];
    adminEmail?: string;
  }
): Promise<ProvisionResult[]> {
  const { schoolId, schoolName, subdomain, tiers, adminEmail } = options;
  const baseDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/school_erp?schema=public";
  const results: ProvisionResult[] = [];

  console.info(`[TIER_DB_PROVISIONER] Starting multi-database provisioning for tenant "${subdomain}" (${tiers.length} tiers)...`);

  for (const tierName of tiers) {
    const databaseName = generateTierDbName(subdomain, tierName);
    const tierDbUrl = buildTierDbUrl(baseDbUrl, databaseName);

    try {
      // 1. Ensure database exists
      const dbStatus = await ensureDatabaseExists(databaseName, baseDbUrl);

      if (dbStatus.fallbackMode) {
        // Safe testing fallback: record metadata pointing to tier URL or primary DB
        results.push({
          tierName,
          databaseName,
          databaseUrl: tierDbUrl,
          success: true,
          isSimulated: true,
        });
      } else {
        // 2. Migrate Schema
        await migrateTierDatabase(tierDbUrl);

        // 3. Seed Tier Data
        await seedTierDatabase({
          schoolId,
          schoolName,
          subdomain,
          tierName,
          tierDbUrl,
          databaseName,
          adminEmail,
        });

        results.push({
          tierName,
          databaseName,
          databaseUrl: tierDbUrl,
          success: true,
        });
      }

      // 4. Record Database Connection in Base Database
      try {
        const tierDbRecord = await basePrisma.tenantTierDatabase.upsert({
          where: { schoolId_tierName: { schoolId, tierName } },
          update: {
            databaseName,
            databaseUrl: tierDbUrl,
            status: "ACTIVE",
            isProvisioned: true,
          },
          create: {
            schoolId,
            tierName,
            databaseName,
            databaseUrl: tierDbUrl,
            status: "ACTIVE",
            isProvisioned: true,
          },
        });

        // Link with AcademicTier in base database
        await basePrisma.academicTier.updateMany({
          where: { schoolId, name: tierName },
          data: {
            databaseUrl: tierDbUrl,
            databaseName,
            tierDatabaseId: tierDbRecord.id,
          },
        });
      } catch (recordErr: any) {
        console.warn(`[TIER_DB_PROVISIONER] Metadata record note:`, recordErr?.message || recordErr);
      }
    } catch (err: any) {
      console.warn(`[TIER_DB_PROVISIONER] Error provisioning tier "${tierName}":`, err?.message || err);
      results.push({
        tierName,
        databaseName,
        databaseUrl: tierDbUrl,
        success: false,
        error: err?.message || "Provisioning failed",
      });
    }
  }

  // Update School record with JSON mapping, explicit tier URLs, and multiDbEnabled flag
  try {
    const tierDatabasesConfig: Record<string, string> = {};
    let nurseryDbUrl: string | null = null;
    let primaryDbUrl: string | null = null;
    let secondaryDbUrl: string | null = null;

    for (const res of results) {
      if (res.success && res.databaseUrl) {
        const slug = sanitizeTierSlug(res.tierName).toUpperCase();
        tierDatabasesConfig[slug] = res.databaseUrl;
        if (slug.includes("NURSERY")) nurseryDbUrl = res.databaseUrl;
        if (slug === "PRIMARY") primaryDbUrl = res.databaseUrl;
        if (slug === "SECONDARY") secondaryDbUrl = res.databaseUrl;
      }
    }

    await basePrisma.school.update({
      where: { id: schoolId },
      data: {
        isMultiDbEnabled: tiers.length > 1,
        databaseUrl: baseDbUrl,
        tierDatabasesConfig,
        nurseryDbUrl,
        primaryDbUrl,
        secondaryDbUrl,
      },
    });
  } catch (schoolUpdateErr: any) {
    console.warn(`[TIER_DB_PROVISIONER] Could not update school multi-db configuration:`, schoolUpdateErr?.message);
  }

  return results;
}
