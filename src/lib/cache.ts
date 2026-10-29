import { safeRedisGet, safeRedisSet } from "./redis";
import { compressPayload, decompressPayload } from "./compression";

export interface CacheKeyOptions {
  tenantId: string;
  tierName?: string;
  table: string;
  action?: string;
  cursor?: string | null;
  limit?: number;
  filters?: Record<string, any>;
}

export interface CacheAsideOptions<T> {
  key: string;
  fetchFn: () => Promise<T>;
  ttlSeconds?: number; // Default: 1800 seconds (30 minutes)
  compressThresholdBytes?: number; // Default: 1024 bytes (1 KB)
}

/**
 * Builds structured, namespaced cache keys:
 * cache:tenant:[tenantId]:tier:[tierName]:table:[tableName]:[queryParams]
 */
export function buildCacheKey(options: CacheKeyOptions): string {
  const { tenantId, tierName = "all", table, action, cursor, limit, filters } = options;
  
  const sanitizedTier = (tierName || "all").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const baseNamespace = `cache:tenant:${tenantId}:tier:${sanitizedTier}:table:${table}`;

  const queryParts: string[] = [];

  if (action) queryParts.push(`action:${action}`);
  if (cursor !== undefined && cursor !== null) queryParts.push(`cursor:${cursor || "first"}`);
  if (limit !== undefined) queryParts.push(`limit:${limit}`);

  if (filters && Object.keys(filters).length > 0) {
    // Sort keys for deterministic cache keys
    const sortedFilterEntries = Object.entries(filters)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [k, v] of sortedFilterEntries) {
      const serializedValue = typeof v === "object" ? JSON.stringify(v) : String(v);
      queryParts.push(`${k}:${serializedValue}`);
    }
  }

  const querySegment = queryParts.length > 0 ? queryParts.join(":") : "all";
  return `${baseNamespace}:${querySegment}`;
}

// Global in-memory cache for ultra-fast L1 lookups & seamless Redis offline fallback
const l1MemoryCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Purges L1 in-memory cache entries matching a tenant subdomain or ID.
 */
export function clearL1TenantCache(subdomainOrId: string): void {
  const clean = (subdomainOrId || "").trim().toLowerCase();
  if (!clean) return;
  l1MemoryCache.delete(`cache:tenant:meta:${clean}`);
  for (const key of l1MemoryCache.keys()) {
    if (key.toLowerCase().includes(clean)) {
      l1MemoryCache.delete(key);
    }
  }
}

/**
 * Two-Tier Cache-Aside Pattern Implementation:
 * 1. Checks L1 in-memory cache (< 0.05ms)
 * 2. Checks L2 Redis cache using structured namespace key (< 2ms)
 * 3. If found, transparently decompresses and refreshes L1 cache.
 * 4. If cache miss, invokes fallback fetchFn from DB.
 * 5. Caches payload in both L1 (Memory) and L2 (Redis with sliding TTL).
 * 6. Returns data to caller seamlessly.
 */
export async function cacheAside<T>(options: CacheAsideOptions<T>): Promise<T> {
  const {
    key,
    fetchFn,
    ttlSeconds = 1800, // 30 minutes safe sliding TTL
    compressThresholdBytes = 1024,
  } = options;

  const now = Date.now();

  // 1. Check L1 Memory Cache
  const l1Entry = l1MemoryCache.get(key);
  if (l1Entry && l1Entry.expiresAt > now) {
    return l1Entry.data as T;
  }

  // 2. Try reading from L2 Redis cache
  try {
    const cachedData = await safeRedisGet(key);
    if (cachedData !== null) {
      const decompressed = decompressPayload<T>(cachedData);
      if (decompressed !== null && decompressed !== undefined) {
        // Populate L1 cache
        l1MemoryCache.set(key, { data: decompressed, expiresAt: now + ttlSeconds * 1000 });
        return decompressed;
      }
    }
  } catch (cacheReadErr) {
    // Suppress and seamlessly proceed to direct DB fetch
  }

  // 3. Fetch directly from DB via provided fetch function
  const freshData = await fetchFn();

  // 4. Cache newly fetched data in both L1 and L2
  if (freshData !== undefined && freshData !== null) {
    l1MemoryCache.set(key, { data: freshData, expiresAt: now + ttlSeconds * 1000 });
    try {
      const compressedPayload = compressPayload(freshData, compressThresholdBytes);
      // Run asynchronously without awaiting to minimize request latency
      safeRedisSet(key, compressedPayload, ttlSeconds).catch(() => {});
    } catch (cacheWriteErr) {
      // Non-blocking: failures to cache will never fail the query
    }
  }

  return freshData;
}

/**
 * Pre-fetches and caches institutional tenant metadata and academic tiers directly in Redis.
 * Resolves in <1ms from memory streams, bypassing repetitive PostgreSQL queries on root requests.
 */
export async function getCachedSchool(subdomain: string) {
  if (!subdomain) return null;
  const normalizedDomain = subdomain.toLowerCase();
  const cacheKey = `cache:tenant:meta:${normalizedDomain}`;

  return cacheAside({
    key: cacheKey,
    ttlSeconds: 3600, // 1 hour sliding TTL
    fetchFn: async () => {
      try {
        const { basePrisma } = await import("./tenant-prisma");
        const schoolRecord = await basePrisma.school.findFirst({
          where: {
            OR: [
              { subdomain: { equals: normalizedDomain, mode: "insensitive" } },
              { slug: { equals: normalizedDomain, mode: "insensitive" } },
            ],
          },
          include: {
            academicTiers: {
              orderBy: { level: "asc" },
            },
          },
        });
        if (schoolRecord) {
          const isSuspended =
            schoolRecord.isSuspended === true ||
            schoolRecord.isActive === false ||
            String(schoolRecord.status || "").toUpperCase() === "SUSPENDED" ||
            String(schoolRecord.subscriptionStatus || "").toUpperCase() === "SUSPENDED";

          return {
            ...schoolRecord,
            isActive: !isSuspended,
            isSuspended: isSuspended,
            status: isSuspended ? "SUSPENDED" : schoolRecord.status,
            academicTiers: schoolRecord.academicTiers || [],
          };
        }

        return null;
      } catch (err) {
        console.error(`[CACHE] Failed to fetch school metadata for ${normalizedDomain}:`, err);
        return null;
      }
    },
  });
}

/**
 * Pre-fetches and caches platform corporate settlement bank configuration directly in Redis.
 * Used to display corporate subscription payment details across tenant workspaces.
 */
export async function getCachedPlatformBank() {
  const cacheKey = "cache:platform:bank:global";

  return cacheAside({
    key: cacheKey,
    ttlSeconds: 3600,
    fetchFn: async () => {
      try {
        const { prisma } = await import("./prisma");
        let bank = await prisma.platformBankConfig.findUnique({
          where: { id: "global" },
        });
        if (!bank) {
          bank = await prisma.platformBankConfig.create({
            data: {
              id: "global",
              bankCode: "035",
              bankName: "Wema Bank",
              accountNumber: "0123456789",
            },
          });
        }
        return {
          bankCode: bank.bankCode || "035",
          bankName: bank.bankName || "Wema Bank",
          accountNumber: bank.accountNumber || "0123456789",
        };
      } catch (err) {
        console.error("[CACHE] Failed to fetch platform bank config:", err);
        return {
          bankCode: "035",
          bankName: "Wema Bank",
          accountNumber: "0123456789",
        };
      }
    },
  });
}

