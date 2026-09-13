import { safeRedisScanDel } from "./redis";

/**
 * Write-Through Cache Invalidation Pipeline:
 *
 * Instead of purging the entire cache or dropping the Redis database,
 * this pipeline uses non-blocking chunked SCAN + UNLINK to purge ONLY
 * the specific namespace keys affected by data mutations.
 */

export async function invalidateNamespace(pattern: string): Promise<number> {
  try {
    const deletedCount = await safeRedisScanDel(pattern);
    if (deletedCount > 0 && process.env.NODE_ENV !== "production") {
      console.log(`[CACHE_INVALIDATION] Purged ${deletedCount} keys matching pattern: ${pattern}`);
    }
    return deletedCount;
  } catch (err) {
    console.warn("[CACHE_INVALIDATION] Failed to invalidate namespace:", err);
    return 0;
  }
}

/**
 * Invalidate student roster and associated dashboard queries for a tenant and/or tier.
 */
export async function invalidateStudentNamespace(schoolId: string, tierName?: string): Promise<void> {
  const sanitizedTier = tierName ? tierName.toLowerCase().replace(/[^a-z0-9_-]/g, "") : "*";
  await Promise.all([
    invalidateNamespace(`cache:tenant:${schoolId}:tier:${sanitizedTier}:table:students:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:${sanitizedTier}:students:enrolled*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:${sanitizedTier}:students:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:students:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:*students*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:dashboard:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:transcripts:*`),
  ]);
}

/**
 * Invalidate staff directory and scheduling queries for a tenant.
 */
export async function invalidateStaffNamespace(schoolId: string): Promise<void> {
  await Promise.all([
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:staff:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:dashboard:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:scheduling:*`),
  ]);
}

/**
 * Invalidate financial ledgers, invoices, payments, and fee templates for a tenant.
 */
export async function invalidateFinanceNamespace(schoolId: string): Promise<void> {
  await Promise.all([
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:invoices:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:payments:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:transactions:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:feeTemplates:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:dashboard:*`),
  ]);
}

/**
 * Invalidate grade records, report cards, and exam results.
 */
export async function invalidateGradingNamespace(schoolId: string, tierName?: string): Promise<void> {
  const sanitizedTier = tierName ? tierName.toLowerCase().replace(/[^a-z0-9_-]/g, "") : "*";
  await Promise.all([
    invalidateNamespace(`cache:tenant:${schoolId}:tier:${sanitizedTier}:table:grades:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:exams:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:reportCards:*`),
  ]);
}

/**
 * Invalidate admissions, applicant pipeline, and enrollment leads.
 */
export async function invalidateAdmissionsNamespace(schoolId: string): Promise<void> {
  await Promise.all([
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:admissions:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:leads:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:students:*`),
    invalidateNamespace(`cache:tenant:${schoolId}:tier:*:table:dashboard:*`),
  ]);
}

/**
 * Invalidate institutional tenant metadata and academic tiers cache when school details change.
 */
export async function invalidateTenantMetadata(subdomain: string): Promise<void> {
  await invalidateNamespace(`cache:tenant:meta:${subdomain.toLowerCase()}`);
}
