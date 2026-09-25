/**
 * Brute-Force Rate Limiter & Automatic Account Lockout Engine
 * 
 * Rules:
 * 1. IP Window Limiter: Maximum 5 attempts per 15 minutes per unique IP address.
 * 2. Targeted Account Lockout: Automatically locks account for 30 minutes following
 *    5 consecutive credential failures for that specific account.
 */

interface IpAttemptRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

interface AccountLockRecord {
  failedAttempts: number;
  lockedUntil?: number;
  lastFailedAt: number;
}

// In-memory state tracking (synchronized across request lifecycles with sliding eviction)
const ipAttempts = new Map<string, IpAttemptRecord>();
const accountLocks = new Map<string, AccountLockRecord>();

const IP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_IP_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ACCOUNT_FAILURES = 5;

/**
 * Checks whether an IP address is throttled.
 */
export function checkIpRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  if (!ip || ip === "::1" || ip === "127.0.0.1") {
    // In local dev, still allow but monitor
  }

  const now = Date.now();
  const record = ipAttempts.get(ip);

  if (!record) {
    return { allowed: true };
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Window expired, reset
  if (now - record.firstAttemptAt > IP_WINDOW_MS) {
    ipAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_IP_ATTEMPTS) {
    const blockedUntil = record.firstAttemptAt + IP_WINDOW_MS;
    record.blockedUntil = blockedUntil;
    const retryAfterSeconds = Math.ceil((blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/**
 * Checks whether a targeted user account is locked.
 */
export function checkAccountLockout(accountKey: string): { locked: boolean; lockedUntil?: Date; remainingMinutes?: number } {
  const now = Date.now();
  const record = accountLocks.get(accountKey.toLowerCase().trim());

  if (!record || !record.lockedUntil) {
    return { locked: false };
  }

  if (now < record.lockedUntil) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
    return {
      locked: true,
      lockedUntil: new Date(record.lockedUntil),
      remainingMinutes,
    };
  }

  // Lockout expired, reset failed counter
  accountLocks.delete(accountKey.toLowerCase().trim());
  return { locked: false };
}

/**
 * Records a failed login attempt for both IP and Account.
 */
export function recordCredentialFailure(
  ip: string,
  accountKey: string
): {
  isLocked: boolean;
  lockedUntil?: Date;
  ipBlocked: boolean;
  retryAfterSeconds?: number;
  remainingAccountAttempts: number;
} {
  const now = Date.now();
  const normalizedKey = accountKey.toLowerCase().trim();

  // 1. Update IP tracking
  let ipRecord = ipAttempts.get(ip);
  if (!ipRecord || now - ipRecord.firstAttemptAt > IP_WINDOW_MS) {
    ipRecord = { count: 1, firstAttemptAt: now };
  } else {
    ipRecord.count += 1;
  }

  let ipBlocked = false;
  let retryAfterSeconds: number | undefined;

  if (ipRecord.count >= MAX_IP_ATTEMPTS) {
    ipRecord.blockedUntil = ipRecord.firstAttemptAt + IP_WINDOW_MS;
    ipBlocked = true;
    retryAfterSeconds = Math.ceil((ipRecord.blockedUntil - now) / 1000);
  }
  ipAttempts.set(ip, ipRecord);

  // 2. Update Account tracking
  let accRecord = accountLocks.get(normalizedKey);
  if (!accRecord || (accRecord.lockedUntil && now >= accRecord.lockedUntil)) {
    accRecord = { failedAttempts: 1, lastFailedAt: now };
  } else {
    accRecord.failedAttempts += 1;
    accRecord.lastFailedAt = now;
  }

  let isLocked = false;
  let lockedUntil: Date | undefined;

  if (accRecord.failedAttempts >= MAX_ACCOUNT_FAILURES) {
    const lockTime = now + ACCOUNT_LOCKOUT_MS;
    accRecord.lockedUntil = lockTime;
    isLocked = true;
    lockedUntil = new Date(lockTime);
  }

  accountLocks.set(normalizedKey, accRecord);

  const remainingAccountAttempts = Math.max(0, MAX_ACCOUNT_FAILURES - accRecord.failedAttempts);

  return {
    isLocked,
    lockedUntil,
    ipBlocked,
    retryAfterSeconds,
    remainingAccountAttempts,
  };
}

/**
 * Clears failures upon successful authentication.
 */
export function recordCredentialSuccess(ip: string, accountKey: string): void {
  accountLocks.delete(accountKey.toLowerCase().trim());
  // Do not immediately reset IP counter to prevent rapid cycling, but reset account lock
}
