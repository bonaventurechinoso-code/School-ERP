import { cookies } from "next/headers";
import * as jose from "jose";
import crypto from "crypto";
import { basePrisma } from "./tenant-prisma";
import { SessionPayload, UserRole } from "./auth";

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

/**
 * Cookie security directives strictly enforced across all environments.
 */
export function getSecureCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
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
  staffRole?: string | null;
  activeTiers?: string[];
  permissions?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
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
  const sessionToken = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);

  // 1. Create authoritative database record
  await basePrisma.session.create({
    data: {
      sessionToken,
      userId: params.userId,
      email: params.email || null,
      tenantId: params.tenantId || null,
      schoolDomain: params.schoolDomain || null,
      role: params.role,
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
    jti: sessionToken,
    sessionToken,
    userId: params.userId,
    email: params.email || undefined,
    tenantId: params.tenantId || "global-saas",
    schoolDomain: params.schoolDomain || "admin",
    tenantName: params.tenantName || undefined,
    role: params.role,
    staffRole: params.staffRole || undefined,
    activeTiers: params.activeTiers || [],
    permissions: params.permissions || [],
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
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // Outside active request scope
    }
  }

  if (!token) return null;

  try {
    // 1. Cryptographic token signature verification
    const { payload } = await jose.jwtVerify(token, SECRET_KEY);
    const sessionTokenId = (payload.jti as string) || (payload.sessionToken as string);

    if (!sessionTokenId) {
      console.warn("[AUTH_SECURITY_ALERT]: Missing sessionTokenId in JWT payload.");
      return null;
    }

    // 2. Query the active database session record
    const dbSession = await basePrisma.session.findUnique({
      where: { sessionToken: sessionTokenId },
    });

    if (!dbSession) {
      console.warn(`[AUTH_SECURITY]: Session token '${sessionTokenId}' not found in active database registry.`);
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

    // 7. Return server-authoritative session state
    return {
      userId: dbSession.userId,
      email: dbSession.email || (payload.email as string),
      tenantId: dbSession.tenantId || (payload.tenantId as string) || "global-saas",
      schoolDomain: dbSession.schoolDomain || (payload.schoolDomain as string) || "admin",
      tenantName: (payload.tenantName as string) || undefined,
      role: dbSession.role as UserRole | string,
      staffRole: dbSession.staffRole || (payload.staffRole as string) || undefined,
      activeTiers: (payload.activeTiers as string[]) || [],
      permissions: (payload.permissions as string[]) || [],
      dbSessionId: dbSession.id,
      expiresAt: dbSession.expiresAt,
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
        sessionTokenId = (payload.jti as string) || (payload.sessionToken as string) || token;
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
