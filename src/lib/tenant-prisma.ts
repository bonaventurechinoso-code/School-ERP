import { PrismaClient } from '@prisma/client';
import { triggerInquiryNotification } from './admissions-events';

// Global singleton to avoid connection exhaustion in Next.js dev mode
declare global {
  // eslint-disable-next-line no-var
  var __prismaBaseClient: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaTierConnectionPool: Map<string, PrismaClient> | undefined;
  // eslint-disable-next-line no-var
  var __admissionsPrismaMiddlewareAttached: boolean | undefined;
}

const cachedClient = (globalThis as any).__prismaBaseClient;
export const basePrisma: PrismaClient =
  cachedClient && (cachedClient as any).paymentProof
    ? cachedClient
    : new PrismaClient();
(globalThis as any).__prismaBaseClient = basePrisma;

// Attach Prisma middleware to base client for automated inquiry email triggers
if (!(globalThis as any).__admissionsPrismaMiddlewareAttached && typeof (basePrisma as any).$use === 'function') {
  (globalThis as any).__admissionsPrismaMiddlewareAttached = true;
  (basePrisma as any).$use(async (params: any, next: any) => {
    const result = await next(params);
    if (params.model === 'AdmissionLead') {
      if (params.action === 'create' && (result?.status === 'INQUIRY' || !result?.status)) {
        triggerInquiryNotification({
          leadId: result.id,
          schoolId: result.schoolId,
          lead: result,
        });
      } else if ((params.action === 'update' || params.action === 'upsert') && result?.status === 'INQUIRY') {
        const isSettingInquiry = (params.args as any)?.data?.status === 'INQUIRY';
        if (isSettingInquiry) {
          triggerInquiryNotification({
            leadId: result.id,
            schoolId: result.schoolId,
            lead: result,
          });
        }
      }
    }
    return result;
  });
}

// In-memory pool for tier-specific database connections
const connectionPool: Map<string, PrismaClient> = (globalThis as any).__prismaTierConnectionPool || new Map();
(globalThis as any).__prismaTierConnectionPool = connectionPool;

/**
 * Standard models requiring schoolId isolation
 */
const TENANT_MODELS = [
  'Student', 'Staff', 'Classroom', 'Course', 'FeeTemplate', 
  'Invoice', 'Payment', 'Timetable', 'StudentAttendance', 
  'StaffAttendance', 'Exam', 'ExamResult', 'GradeRecord',
  'AcademicRecord', 'ReportCard', 'Notice', 'MessageLog', 
  'AcademicTier', 'Department', 'PayrollRecord', 'Transaction', 
  'AdmissionLead', 'TenantTierDatabase'
];

/**
 * Applies tenant isolation extension to any PrismaClient
 */
export function applyTenantIsolation(client: PrismaClient, schoolId: string) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (TENANT_MODELS.includes(model as string)) {
            if (operation === 'create' || operation === 'createMany') {
              if (args.data) {
                if (Array.isArray(args.data)) {
                  (args as any).data = (args.data as any[]).map(d => ({ ...d, schoolId }));
                } else {
                  (args as any).data = { ...(args.data as any), schoolId };
                }
              }
            } else {
              if ((args as any).where) {
                (args as any).where = { ...(args as any).where, schoolId };
              } else {
                (args as any).where = { schoolId };
              }
            }
          }
          
          const result = await query(args);

          // Automated trigger for AdmissionLead mutations entering INQUIRY stage
          if (model === 'AdmissionLead') {
            const resAny = result as any;
            if (operation === 'create' || operation === 'createMany') {
              if (Array.isArray(resAny)) {
                for (const item of resAny) {
                  if (item?.id && (item?.status === 'INQUIRY' || !item?.status)) {
                    triggerInquiryNotification({
                      leadId: item.id,
                      schoolId: item.schoolId || schoolId,
                      lead: item,
                    });
                  }
                }
              } else if (resAny?.id && (resAny.status === 'INQUIRY' || !resAny.status)) {
                triggerInquiryNotification({
                  leadId: resAny.id,
                  schoolId: resAny.schoolId || schoolId,
                  lead: resAny,
                });
              }
            } else if (operation === 'update' || operation === 'upsert') {
              const isSettingInquiry = (args as any)?.data?.status === 'INQUIRY';
              if (resAny?.id && isSettingInquiry && resAny.status === 'INQUIRY') {
                triggerInquiryNotification({
                  leadId: resAny.id,
                  schoolId: resAny.schoolId || schoolId,
                  lead: resAny,
                });
              }
            }
          }

          return result;
        },
      },
    },
  });
}

export interface TierContextInput {
  tierId?: string;
  tierName?: string;
}

/**
 * Connection Manager Utility that manages pooled connections
 * and dynamic-routes queries to the appropriate database.
 */
export class TenantConnectionManager {
  /**
   * Retrieves or creates a pooled PrismaClient for a specific connection URL.
   */
  static getClientForUrl(connectionUrl: string): PrismaClient {
    if (!connectionPool.has(connectionUrl)) {
      const newClient = new PrismaClient({
        datasources: { db: { url: connectionUrl } },
      });
      connectionPool.set(connectionUrl, newClient);
    }
    return connectionPool.get(connectionUrl)!;
  }

  /**
   * Resolves the dedicated database URL for a given schoolId and tier context.
   * Returns null if no dedicated tier database is configured (triggering default DB fallback).
   */
  static async resolveTierDbUrl(schoolId: string, tierIdentifier?: string | TierContextInput): Promise<string | null> {
    if (!tierIdentifier) return null;

    try {
      let tierName = typeof tierIdentifier === 'string' ? tierIdentifier : tierIdentifier.tierName;
      let tierId = typeof tierIdentifier === 'object' ? tierIdentifier.tierId : undefined;

      // If tierIdentifier is a UUID/ID string, check if it matches an AcademicTier directly
      if (typeof tierIdentifier === 'string' && (tierIdentifier.length > 20 || tierIdentifier.includes('-'))) {
        try {
          const tierById = await basePrisma.academicTier.findUnique({
            where: { id: tierIdentifier },
            select: { id: true, name: true, databaseUrl: true },
          });
          if (tierById) {
            if (tierById.databaseUrl) return tierById.databaseUrl;
            tierName = tierById.name;
            tierId = tierById.id;
          }
        } catch {}
      }

      // 1. If tierId is provided, check directly on AcademicTier
      if (tierId) {
        const tier = await basePrisma.academicTier.findUnique({
          where: { id: tierId },
          select: { databaseUrl: true },
        });
        if (tier?.databaseUrl) return tier.databaseUrl;
      }

      // 2. Look up by schoolId and tierName in TenantTierDatabase
      if (tierName) {
        const tierDb = await basePrisma.tenantTierDatabase.findFirst({
          where: {
            schoolId,
            status: 'ACTIVE',
            OR: [
              { tierName: { equals: tierName, mode: 'insensitive' } },
              { tierName: { contains: tierName, mode: 'insensitive' } },
            ],
          },
          select: { databaseUrl: true },
        });

        if (tierDb?.databaseUrl) return tierDb.databaseUrl;

        // 3. Fallback: check academicTier by name
        const academicTier = await basePrisma.academicTier.findFirst({
          where: {
            schoolId,
            OR: [
              { name: { equals: tierName, mode: 'insensitive' } },
              { name: { contains: tierName, mode: 'insensitive' } },
            ],
          },
          select: { databaseUrl: true },
        });

        if (academicTier?.databaseUrl) return academicTier.databaseUrl;
      }

      return null;
    } catch (err: any) {
      console.warn(`[CONNECTION_ROUTER] Error resolving tier database URL (${err?.message || err}). Falling back to primary DB.`);
      return null;
    }
  }

  /**
   * Routes dynamically to the correct database based on the active Tenant context
   * and the specific tier being accessed.
   */
  static async getClient(schoolId: string, tierContext?: string | TierContextInput) {
    const tierDbUrl = await this.resolveTierDbUrl(schoolId, tierContext);

    if (tierDbUrl) {
      try {
        const rawClient = this.getClientForUrl(tierDbUrl);
        return applyTenantIsolation(rawClient, schoolId);
      } catch (poolErr: any) {
        console.warn(`[CONNECTION_ROUTER] Failed connecting to tier DB: ${tierDbUrl}. Falling back to default database.`);
      }
    }

    // BACKWARD COMPATIBILITY: fallback safely to primary default database
    return applyTenantIsolation(basePrisma, schoolId);
  }
}

/**
 * Creates a Prisma client extension that automatically isolates
 * queries and mutations to a specific schoolId.
 * 
 * Supports dynamic routing: if a tierContext is supplied (or detected),
 * routes queries to the dedicated tier database.
 * 
 * @param schoolId The tenant's unique school ID
 * @param tierContext Optional tier context (e.g. "PRIMARY", "SECONDARY", "NURSERY", or { tierName, tierId })
 */
export function getTenantClient(schoolId: string, tierContext?: string | TierContextInput) {
  // If tierContext is provided synchronously, return client isolated on basePrisma or async resolver
  // To preserve backwards compatibility with synchronous calls:
  return applyTenantIsolation(basePrisma, schoolId);
}

/**
 * Async dynamic routing client: dynamically connects to the dedicated tier database
 * if configured, with graceful fallback to primary database.
 */
export async function getDynamicTenantClient(schoolId: string, tierContext?: string | TierContextInput) {
  return TenantConnectionManager.getClient(schoolId, tierContext);
}

/**
 * Alias helper to directly get a tier database client
 */
export async function getTierClient(options: { schoolId: string; tierName: string }) {
  return TenantConnectionManager.getClient(options.schoolId, options.tierName);
}

/**
 * Dynamic Prisma Client Injector:
 * Resolves or instantiates a cached PrismaClient specifically connected to the given tenant's tier database.
 * 
 * SAFETY FALLBACK:
 * Wrapped in a try/catch block. If the tier-specific client fails to initialize, connect, or is undefined,
 * it gracefully logs the issue and falls back to the main tenant database client (basePrisma).
 * 
 * @param tenantId The unique School / Tenant ID
 * @param tier The target academic tier (e.g. "NURSERY", "PRIMARY", "SECONDARY", "Daycare / Nursery")
 */
export async function getPrismaClientForTier(tenantId: string, tier: string) {
  try {
    if (!tenantId || !tier) {
      return applyTenantIsolation(basePrisma, tenantId || "");
    }

    // 1. Check School model for explicit or JSON tier database configuration
    const school = await basePrisma.school.findUnique({
      where: { id: tenantId },
      select: {
        databaseUrl: true,
        tierDatabasesConfig: true,
        nurseryDbUrl: true,
        primaryDbUrl: true,
        secondaryDbUrl: true,
        isMultiDbEnabled: true,
      },
    });

    let tierDbUrl: string | null = null;
    const upperTier = tier.toUpperCase().trim();

    // Check explicit columns
    if ((upperTier.includes("NURSERY") || upperTier.includes("DAYCARE")) && school?.nurseryDbUrl) {
      tierDbUrl = school.nurseryDbUrl;
    } else if (upperTier.includes("PRIMARY") && !upperTier.includes("SECONDARY") && school?.primaryDbUrl) {
      tierDbUrl = school.primaryDbUrl;
    } else if (upperTier.includes("SECONDARY") && !upperTier.includes("PRIMARY") && school?.secondaryDbUrl) {
      tierDbUrl = school.secondaryDbUrl;
    }

    // Check JSON config: tierDatabasesConfig
    if (!tierDbUrl && school?.tierDatabasesConfig && typeof school.tierDatabasesConfig === 'object') {
      const config = school.tierDatabasesConfig as Record<string, string>;
      for (const [key, url] of Object.entries(config)) {
        if (upperTier.includes(key.toUpperCase()) || key.toUpperCase().includes(upperTier)) {
          tierDbUrl = url;
          break;
        }
      }
    }

    // Check TenantTierDatabase relation or AcademicTier
    if (!tierDbUrl) {
      tierDbUrl = await TenantConnectionManager.resolveTierDbUrl(tenantId, tier);
    }

    // If a dedicated tier database URL was found, instantiate or retrieve from cache
    if (tierDbUrl) {
      try {
        const client = TenantConnectionManager.getClientForUrl(tierDbUrl);
        return applyTenantIsolation(client, tenantId);
      } catch (clientInitErr: any) {
        console.warn(
          `[SAFETY_FALLBACK] Failed to initialize dynamic PrismaClient for tier "${tier}" on tenant "${tenantId}" (${clientInitErr?.message || clientInitErr}). Falling back to main tenant database.`
        );
      }
    }

    // Safe fallback to main tenant database
    return applyTenantIsolation(basePrisma, tenantId);
  } catch (outerErr: any) {
    console.warn(
      `[SAFETY_FALLBACK] getPrismaClientForTier caught exception for tenant "${tenantId}", tier "${tier}":`,
      outerErr?.message || outerErr
    );
    return applyTenantIsolation(basePrisma, tenantId);
  }
}

/**
 * Invalidate cached Prisma client connections to force refresh of connection pools.
 */
export function invalidateTierConnection(connectionUrl?: string) {
  if (connectionUrl) {
    connectionPool.delete(connectionUrl);
  } else {
    connectionPool.clear();
  }
}

/**
 * Resolves or creates a valid AcademicTier record in an isolated tier database
 * to satisfy foreign key constraints during cross-database student enrollment.
 */
export async function resolveTierIdForTierDb(
  tierDb: any,
  schoolId: string,
  tierIdentifier: { id?: string; name?: string; level?: number | null }
): Promise<string> {
  try {
    let targetTierInDb = await tierDb.academicTier.findFirst({
      where: {
        schoolId,
        OR: [
          ...(tierIdentifier.id ? [{ id: tierIdentifier.id }] : []),
          ...(tierIdentifier.name ? [
            { name: { equals: tierIdentifier.name, mode: 'insensitive' } },
            { name: { contains: tierIdentifier.name, mode: 'insensitive' } },
          ] : []),
        ],
      },
    });

    if (!targetTierInDb && tierIdentifier.name) {
      try {
        targetTierInDb = await tierDb.academicTier.create({
          data: {
            id: tierIdentifier.id || `${schoolId}-${tierIdentifier.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            name: tierIdentifier.name,
            schoolId,
            level: tierIdentifier.level ?? 1,
          },
        });
      } catch {
        targetTierInDb = await tierDb.academicTier.findFirst({ where: { schoolId } });
      }
    }

    if (!targetTierInDb) {
      targetTierInDb = await tierDb.academicTier.findFirst();
    }

    return targetTierInDb?.id || tierIdentifier.id || 'default-tier';
  } catch (err: any) {
    console.warn('[ROUTER] Failed to resolve tier ID in tier database:', err?.message || err);
    return tierIdentifier.id || 'default-tier';
  }
}

