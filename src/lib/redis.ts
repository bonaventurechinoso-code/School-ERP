import Redis, { RedisOptions } from "ioredis";

// Next.js hot module reloading singleton on globalThis
declare global {
  // eslint-disable-next-line no-var
  var __redisInstance: Redis | null | undefined;
  // eslint-disable-next-line no-var
  var __redisFailedLogged: boolean | undefined;
  // eslint-disable-next-line no-var
  var __redisLastFailureTime: number | undefined;
}

// Ensure connection config explicitly uses 127.0.0.1 instead of localhost
// to avoid Node.js attempting IPv6 resolution (::1) before falling back,
// which causes a 2-to-3 second connection timeout delay on local machines.
const rawRedisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const REDIS_URL = rawRedisUrl
  .replace("//localhost:", "//127.0.0.1:")
  .replace("//localhost", "//127.0.0.1");

// 15-second circuit breaker cooldown after a connection failure
const CIRCUIT_BREAKER_COOLDOWN_MS = 15000;

const redisOptions: RedisOptions = {
  lazyConnect: true,
  family: 4, // Explicitly force IPv4 to avoid IPv6 DNS timeout delays
  enableOfflineQueue: false, // Prevents queries from hanging indefinitely if Redis is offline
  maxRetriesPerRequest: 1,   // Fail fast so fallback to Prisma takes over immediately
  connectTimeout: 500,       // 500ms max timeout - prevents 2-3s delay
  disconnectTimeout: 500,
  commandTimeout: 500,
  retryStrategy(times) {
    if (times > 2) return null; // Stop retrying quickly; fallback to DB
    return 1000;
  },
};

function createRedisClient(): Redis | null {
  try {
    const client = new Redis(REDIS_URL, redisOptions);

    client.on("error", (err: any) => {
      globalThis.__redisLastFailureTime = Date.now();
      if (!globalThis.__redisFailedLogged) {
        console.warn(
          `[REDIS_FALLBACK] Redis at 127.0.0.1 is unreachable (${err?.message || err}). Safe DB fallback is active.`
        );
        globalThis.__redisFailedLogged = true;
      }
    });

    client.on("connect", () => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[REDIS] Successfully connected to Redis instance at 127.0.0.1.");
      }
      globalThis.__redisFailedLogged = false;
      globalThis.__redisLastFailureTime = 0;
    });

    return client;
  } catch (err: any) {
    globalThis.__redisLastFailureTime = Date.now();
    if (!globalThis.__redisFailedLogged) {
      console.warn("[REDIS_FALLBACK] Could not initialize Redis client:", err?.message || err);
      globalThis.__redisFailedLogged = true;
    }
    return null;
  }
}

// Enforce singleton on globalThis to prevent Next.js from spawning multiple connection pools during hot-reloads
if (!globalThis.__redisInstance) {
  globalThis.__redisInstance = createRedisClient();
}

const clientInstance: Redis | null = globalThis.__redisInstance ?? null;

export const redis = clientInstance;
export default clientInstance;

/**
 * Returns the active Redis client, connecting lazily if necessary.
 * Utilizes a circuit breaker: if connection failed recently, returns null
 * immediately in 0ms without waiting on TCP sockets.
 */
export async function getRedisClient(): Promise<Redis | null> {
  if (!clientInstance) return null;

  // Circuit-breaker check: avoid 2-3s socket hang if Redis went down recently
  const lastFailure = globalThis.__redisLastFailureTime || 0;
  if (Date.now() - lastFailure < CIRCUIT_BREAKER_COOLDOWN_MS) {
    return null;
  }

  try {
    if (clientInstance.status === "wait" || clientInstance.status === "close") {
      await clientInstance.connect();
    }
    return clientInstance;
  } catch (err: any) {
    globalThis.__redisLastFailureTime = Date.now();
    if (!globalThis.__redisFailedLogged) {
      console.warn("[REDIS_FALLBACK] Lazy connect to 127.0.0.1 failed. Circuit breaker active; falling back to DB.");
      globalThis.__redisFailedLogged = true;
    }
    return null;
  }
}

/**
 * Check if Redis is currently connected and responsive.
 */
export async function isRedisConnected(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

/**
 * Safe GET wrapper with error suppression.
 * Returns null if Redis is down or key does not exist.
 */
export async function safeRedisGet(key: string): Promise<string | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;
    return await client.get(key);
  } catch (err) {
    return null;
  }
}

/**
 * Safe SET wrapper with TTL and error suppression.
 * Defaults to 1800 seconds (30 minutes sliding TTL).
 */
export async function safeRedisSet(
  key: string,
  value: string,
  ttlSeconds: number = 1800
): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    if (ttlSeconds > 0) {
      await client.set(key, value, "EX", ttlSeconds);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Safe DEL wrapper for one or multiple keys.
 */
export async function safeRedisDel(keys: string | string[]): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client) return 0;
    const keysArray = Array.isArray(keys) ? keys : [keys];
    if (keysArray.length === 0) return 0;
    return await client.del(...keysArray);
  } catch (err) {
    return 0;
  }
}

/**
 * Non-blocking SCAN-and-UNLINK for namespace invalidation.
 * Safely iterates through keys using non-blocking SCAN with COUNT 100
 * and unlinks matching keys without locking Redis.
 */
export async function safeRedisScanDel(pattern: string): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client) return 0;

    let cursor = "0";
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        // UNLINK is asynchronous and non-blocking in Redis >= 4.0
        await client.unlink(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    return deletedCount;
  } catch (err) {
    return 0;
  }
}
