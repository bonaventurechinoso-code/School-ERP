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

/**
 * Cache-Aside Pattern Implementation:
 * 1. Checks Redis cache using structured namespace key.
 * 2. If found, transparently decompresses and returns data.
 * 3. If cache miss or Redis is unavailable/erroring, invokes fallback fetchFn.
 * 4. Automatically compresses payload (if > threshold) and stores in Redis with sliding TTL.
 * 5. Returns data to caller seamlessly.
 */
export async function cacheAside<T>(options: CacheAsideOptions<T>): Promise<T> {
  const {
    key,
    fetchFn,
    ttlSeconds = 1800, // 30 minutes safe sliding TTL
    compressThresholdBytes = 1024,
  } = options;

  // 1. Try reading from cache
  try {
    const cachedData = await safeRedisGet(key);
    if (cachedData !== null) {
      const decompressed = decompressPayload<T>(cachedData);
      if (decompressed !== null && decompressed !== undefined) {
        return decompressed;
      }
    }
  } catch (cacheReadErr) {
    // Suppress and seamlessly proceed to direct DB fetch
  }

  // 2. Fetch directly from DB via provided fetch function
  const freshData = await fetchFn();

  // 3. Cache the newly fetched data in the background
  if (freshData !== undefined && freshData !== null) {
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
        return await basePrisma.school.findUnique({
          where: { subdomain: normalizedDomain },
          include: {
            academicTiers: {
              orderBy: { level: "asc" },
            },
          },
        });
      } catch (err) {
        console.error(`[CACHE] Failed to fetch school metadata for ${normalizedDomain}:`, err);
        return null;
      }
    },
  });
}
