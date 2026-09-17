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

/**
 * Explicit Windows-optimized network parameters:
 * Force IPv4 host string "127.0.0.1" and port 6379.
 * Using "127.0.0.1" instead of "localhost" eliminates the 2-to-3 second IPv6 (::1) DNS lookup
 * timeout common in Windows background services and Node.js networking stacks.
 */
const REDIS_HOST = "127.0.0.1";
const REDIS_PORT = 6379;

const rawRedisUrl = process.env.REDIS_URL;
const REDIS_URL = rawRedisUrl
  ? rawRedisUrl.replace("//localhost:", `//${REDIS_HOST}:`).replace("//localhost", `//${REDIS_HOST}`)
  : `redis://${REDIS_HOST}:${REDIS_PORT}`;

// Circuit breaker cooldown: if offline, fail fast in 0ms to DB fallback without blocking queries
const CIRCUIT_BREAKER_COOLDOWN_MS = 5000;

const redisOptions: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  family: 4,                  // Explicitly force IPv4 to eliminate Windows IPv6 (::1) resolution delays
  lazyConnect: true,          // Connect lazily so Next.js server boots without blocking
  enableOfflineQueue: false,  // Fail fast on offline state so Safe DB fallback takes over instantly
  maxRetriesPerRequest: 1,    // Single attempt per query before handing off to Prisma fallback
  connectTimeout: 1000,       // 1 second connection timeout
  disconnectTimeout: 500,
  commandTimeout: 1000,
  keepAlive: 10000,           // 10-second TCP keepalive for persistent Windows Service connection
  retryStrategy(times: number) {
    // Reconnection backoff: smooth exponential backoff capped at 3000ms.
    // NEVER returns null: allows the client to automatically detect when the local
    // Redis Windows Service is ready and seamlessly transition from Safe DB fallback
    // to the in-memory cache layer without requiring an application restart.
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
};

function createRedisClient(): Redis | null {
  try {
    const client = rawRedisUrl
      ? new Redis(REDIS_URL, redisOptions)
      : new Redis(redisOptions);

    client.on("error", (err: any) => {
      globalThis.__redisLastFailureTime = Date.now();
      if (!globalThis.__redisFailedLogged) {
        console.warn(
          `[REDIS_FALLBACK] Redis at ${REDIS_HOST}:${REDIS_PORT} is unreachable (${err?.message || err}). Safe DB fallback is active.`
        );
        globalThis.__redisFailedLogged = true;
      }
    });

    client.on("connect", () => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[REDIS] Successfully connected to Redis instance at ${REDIS_HOST}:${REDIS_PORT}.`);
      }
      globalThis.__redisFailedLogged = false;
      globalThis.__redisLastFailureTime = 0;
    });

    client.on("ready", () => {
      console.log(`[REDIS] Redis client ready and accepting commands at ${REDIS_HOST}:${REDIS_PORT}.`);
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

  // Immediate fast path: already connected and ready
  if (clientInstance.status === "ready") {
    return clientInstance;
  }

  // If in the middle of connecting or reconnecting, fail fast to safe DB fallback
  if (clientInstance.status === "connecting" || clientInstance.status === "reconnecting") {
    return null;
  }

  // Circuit-breaker check: avoid TCP socket hang if Redis failed recently
  const lastFailure = globalThis.__redisLastFailureTime || 0;
  if (Date.now() - lastFailure < CIRCUIT_BREAKER_COOLDOWN_MS) {
    return null;
  }

  try {
    if (clientInstance.status === "wait" || clientInstance.status === "close") {
      await clientInstance.connect();
    }
    return (clientInstance.status as string) === "ready" ? clientInstance : null;
  } catch (err: any) {
    globalThis.__redisLastFailureTime = Date.now();
    if (!globalThis.__redisFailedLogged) {
      console.warn(`[REDIS_FALLBACK] Lazy connect to ${REDIS_HOST}:${REDIS_PORT} failed. Circuit breaker active; falling back to DB.`);
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
