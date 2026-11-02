import { cookies, headers } from "next/headers";
import * as jose from "jose";
import crypto from "crypto";
import { basePrisma } from "./tenant-prisma";
import { SessionPayload, UserRole } from "./auth";
import { getCachedSchool } from "./cache";
import { isTenantSuspended } from "./tenantStatus";

/**
 * STRICT SESSION CONFIGURATION
 * 30 minutes of inactivity session timeout.
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 60; // 1800 seconds (30 minutes)
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
export const SESSION_COOKIE_NAME = "session";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const ALG = "HS256";

export const BASE_TENANT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "bonaveeict.com.ng").toLowerCase().replace(/^www\./, "").split(":")[0].trim();

/**
 * Cookie security directives strictly enforced across all environments.
 * Omitting the 'domain' attribute enforces RFC 6265 Host-Only cookies,
 * ensuring that cookies set on a tenant subdomain (e.g., stpeter.bonaveeict.com.ng)
 * are strictly restricted to that host and NEVER bleed across sibling tenants
 * or to the apex platform domain.
 */
export function getSecureCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS, targetHost?: string) {
  const isProd = process.env.NODE_ENV === "production";

  // Safe local dev check: only apply cookie domain if in dev or explicitly configured
  const domain = !isProd ? (process.env.SESSION_DOMAIN || undefined) : undefined;

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    domain: domain,
    maxAge: maxAge,
  };
}

export interface CreateSessionParams {
  userId: string;
  email?: string | null;
  tenantId?: string | null;
  schoolDomain?: string | null;
  tenantName?: string | null;
  role: UserRole | string;
  userRole?: string | null;
  assignedTier?: string | null;
  staffRole?: string | null;
  activeTiers?: string[];
  permissions?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionToken?: string | null;
  mustChangePassword?: boolean;
}

/**
 * 1. CONFIGURE DATABASE SESSION STRATEGY:
 * Persists an authoritative session row directly in the PostgreSQL database,
 * cryptographically signs a JWT session token referencing this active row,
 * and sets strict HTTP-only secure cookie headers with a 30-minute inactivity limit.
 */
export async function createDatabaseSession(params: CreateSessionParams): Promise<{
  sessionToken: string;
  cookieToken: string;
  expiresAt: Date;
}> {
  const sessionToken = params.sessionToken || crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);
  const effectiveRole = params.userRole || params.role;

  // Auto-Expire Inactive Sessions: Automatically delete any session with lastActive > 30 days ago on every login
  cleanupInactiveSessions(params.userId).catch(() => {});

  // 1. Create authoritative database record
  await basePrisma.session.create({
    data: {
      sessionToken,
      userId: params.userId,
      email: params.email || null,
      tenantId: params.tenantId || null,
      schoolDomain: params.schoolDomain || null,
      role: effectiveRole,
      staffRole: params.staffRole || null,
      expiresAt,
      lastActiveAt: now,
      isRevoked: false,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });

  // 2. Cryptographically sign the session token with tenantId and role binding
  const cookieToken = await new jose.SignJWT({
    jti: sessionToken || crypto.randomUUID(),
    sessionToken: sessionToken || crypto.randomUUID(),
    sessionId: sessionToken || crypto.randomUUID(),
    id: sessionToken || crypto.randomUUID(),
    token: sessionToken || crypto.randomUUID(),
    userId: params.userId,
    email: params.email || undefined,
    tenantId: params.tenantId || null,
    schoolDomain: params.schoolDomain || "admin",
    tenantName: params.tenantName || undefined,
    role: effectiveRole,
    userRole: effectiveRole,
    assignedTier: params.assignedTier ?? null,
    staffRole: params.staffRole || undefined,
    activeTiers: params.activeTiers || [],
    permissions: params.permissions || [],
    mustChangePassword: params.mustChangePassword ?? false,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(SECRET_KEY);

  // 3. Set secure HTTP-only cookie (when inside request scope)
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, cookieToken, getSecureCookieOptions(SESSION_MAX_AGE_SECONDS));
  } catch {
    // Gracefully handle invocation outside active Next.js request context (e.g. test scripts, CLI tasks)
  }

  return {
    sessionToken,
    cookieToken,
    expiresAt,
  };
}

/**
 * 2. ENFORCE STRICT SERVER-SIDE VERIFICATION:
 * Validates the session token against the active database row.
 * Cryptographically binds the user's active session to their specific 'tenantId'
 * and 'role' fetched directly from the database server, completely ignoring
 * any data coming from client frontend state.
 */
export async function validateDatabaseSession(
  rawCookieToken?: string | null
): Promise<SessionPayload | null> {
  let token = rawCookieToken;
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value || cookieStore.get("accessToken")?.value;
    } catch {
      // Outside active request scope
    }
  }

  if (!token) {
    try {
      const headerList = await headers();
      const authHeader = headerList.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
      if (!token) {
        token = headerList.get("x-session-token");
      }
    } catch {}
  }

  if (!token) return null;

  try {
    // 1. Cryptographic token signature verification
    const { payload } = await jose.jwtVerify(token, SECRET_KEY);
    const sessionTokenId =
      (payload.sessionToken as string) ||
      (payload.sessionId as string) ||
      (payload.jti as string) ||
      (payload.token as string) ||
      (payload.id as string);

    if (!sessionTokenId) {
      return null;
    }

    // 2. Query the active database session record by sessionToken or id
    const dbSession = await basePrisma.session.findFirst({
      where: {
        OR: [
          { sessionToken: sessionTokenId },
          { id: sessionTokenId },
        ],
      },
    });

    if (!dbSession) {
      return null;
    }

    // 3. Validate active status and revocation flag
    if (dbSession.isRevoked) {
      console.warn(`[AUTH_SECURITY]: Session '${sessionTokenId}' has been revoked by security officer.`);
      return null;
    }

    // 4. Validate strict 30-minute idle expiration
    const now = new Date();
    if (now > dbSession.expiresAt) {
      console.warn(`[AUTH_SECURITY]: Session '${sessionTokenId}' has expired due to 30 minutes of inactivity.`);
      // Clean up expired session asynchronously
      basePrisma.session.update({
        where: { id: dbSession.id },
        data: { isRevoked: true },
      }).catch(() => {});
      return null;
    }

    // 5. Cryptographic Binding Integrity Check:
    // Ensure the token's claims match the authoritative database row
    if (
      dbSession.userId !== payload.userId ||
      dbSession.role !== payload.role ||
      (dbSession.tenantId && payload.tenantId && dbSession.tenantId !== payload.tenantId)
    ) {
      console.error("[AUTH_SECURITY_VIOLATION]: Session cryptographic binding mismatch between token and database row.");
      return null;
    }

    // 6. Sliding Session Inactivity Extension:
    // If more than 60 seconds have elapsed since last check, roll the 30-minute expiry forward
    const elapsedMs = now.getTime() - new Date(dbSession.lastActiveAt).getTime();
    if (elapsedMs > 60 * 1000) {
      const newExpiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);
      basePrisma.session.update({
        where: { id: dbSession.id },
        data: {
          lastActiveAt: now,
          expiresAt: newExpiresAt,
        },
      }).catch(() => {});
    }

    // 7. Check authoritative User table for current mustChangePassword flag (bypassed for demo tenant)
    const isDemoTenantSession =
      (dbSession.schoolDomain || (payload as any).schoolDomain || "").toLowerCase() === "demo";
    let mustChangePassword = !isDemoTenantSession && Boolean(payload.mustChangePassword);
    if (!isDemoTenantSession) {
      try {
        const userRow = await basePrisma.user.findFirst({
          where: {
            OR: [
              { id: dbSession.userId },
              { staff: { id: dbSession.userId } },
              { student: { id: dbSession.userId } },
            ],
          },
          select: { mustChangePassword: true },
        });
        if (userRow) {
          mustChangePassword = Boolean(userRow.mustChangePassword);
        }
      } catch (userRowErr) {
        // Fallback to base user query without relations if nested query fails due to hard deletes
        try {
          const fallbackUser = await basePrisma.user.findUnique({
            where: { id: dbSession.userId },
            select: { mustChangePassword: true },
          });
          if (fallbackUser) {
            mustChangePassword = Boolean(fallbackUser.mustChangePassword);
          }
        } catch {}
      }
    }

    // 7b. Check authoritative tenant suspension state
    if (dbSession.schoolDomain && dbSession.role !== "SUPER_ADMIN") {
      const isDemo = dbSession.schoolDomain.toLowerCase() === "demo";
      if (!isDemo) {
        const school = await getCachedSchool(dbSession.schoolDomain);
        if (school && isTenantSuspended(school)) {
          console.warn(`[AUTH_SECURITY]: Session '${sessionTokenId}' rejected because tenant '${dbSession.schoolDomain}' is suspended.`);
          return null;
        }
      }
    }

    // 8. Return server-authoritative session state including sessionToken
    const anyPayload = payload as any;
    return {
      userId: dbSession.userId,
      email: dbSession.email || (anyPayload.email as string),
      tenantId: dbSession.tenantId || (anyPayload.tenantId as string) || null,
      schoolDomain: dbSession.schoolDomain || (anyPayload.schoolDomain as string) || "admin",
      tenantName: (anyPayload.tenantName as string) || undefined,
      role: dbSession.role as UserRole | string,
      userRole: (anyPayload.userRole as string) || (dbSession.role as string),
      assignedTier: (anyPayload.assignedTier as string) || (anyPayload.activeTiers?.[0] as string) || null,
      staffRole: dbSession.staffRole || (anyPayload.staffRole as string) || undefined,
      activeTiers: (anyPayload.activeTiers as string[]) || [],
      permissions: (anyPayload.permissions as string[]) || [],
      sessionToken: dbSession.sessionToken,
      sessionId: dbSession.sessionToken,
      token: token,
      dbSessionId: dbSession.id,

      expiresAt: dbSession.expiresAt,
      mustChangePassword,
      forceChangePassword: mustChangePassword,
    };
  } catch (error) {
    console.error("[AUTH_VERIFICATION_ERROR]: Failed to validate session token:", error);
    return null;
  }
}

/**
 * Revokes the active database session and clears the cookie.
 */
export async function revokeDatabaseSession(sessionTokenOrCookie?: string | null): Promise<boolean> {
  try {
    let token = sessionTokenOrCookie;
    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {}
    }

    if (token) {
      let sessionTokenId = token;
      try {
        const { payload } = await jose.jwtVerify(token, SECRET_KEY);
        sessionTokenId =
          (payload.sessionToken as string) ||
          (payload.sessionId as string) ||
          (payload.jti as string) ||
          (payload.token as string) ||
          (payload.id as string) ||
          token;
      } catch {}

      await basePrisma.session.updateMany({
        where: {
          OR: [{ sessionToken: sessionTokenId }, { id: sessionTokenId }],
        },
        data: { isRevoked: true },
      });
    }

    try {
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE_NAME);
    } catch {}
    return true;
  } catch (err) {
    console.error("[AUTH_REVOKE_ERROR]: Error revoking database session:", err);
    return false;
  }
}

/**
 * Security Emergency Revocation: Revokes all active database sessions for a given user.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await basePrisma.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
  return result.count;
}

/**
 * Auto-Expire Inactive Sessions:
 * Automatically delete any session with lastActive > 30 days ago.
 * Safe, asynchronous, non-blocking cleanup.
 * Does NOT delete active sessions < 30 days.
 */
export async function cleanupInactiveSessions(userId?: string): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionWhere: any = {
      lastActiveAt: { lt: thirtyDaysAgo },
    };
    const refreshWhere: any = {
      OR: [
        { updatedAt: { lt: thirtyDaysAgo } },
        { createdAt: { lt: thirtyDaysAgo } },
      ],
    };

    if (userId) {
      sessionWhere.userId = userId;
      refreshWhere.userId = userId;
    }

    await basePrisma.session.deleteMany({
      where: sessionWhere,
    }).catch(() => {});

    await basePrisma.refreshToken.deleteMany({
      where: refreshWhere,
    }).catch(() => {});
  } catch {
    // Fail safely
  }
}

/**
 * Server Action / API Route Guard:
 * Strictly enforces that the caller has an active, valid database session,
 * returning the server-verified tenantId and role. Throws an Error if unauthorized.
 */
export async function requireServerAuth(): Promise<SessionPayload> {
  const session = await validateDatabaseSession();
  if (!session) {
    throw new Error("Unauthorized: Active database session required or session has expired.");
  }
  return session;
}
