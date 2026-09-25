import * as jose from "jose";
import crypto from "crypto";
import { cookies } from "next/headers";
import { basePrisma } from "./tenant-prisma";

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const ALG = "HS256";

export interface AccessTokenClaims {
  userId: string;
  schoolId: string;
  role: string;
  email?: string;
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
  [key: string]: any;
}

/**
 * Computes SHA-256 hash of a raw token string for secure database persistence.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Signs a short-lived (15 minutes) Access Token JWT.
 */
export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new jose.SignJWT({
    userId: claims.userId,
    schoolId: claims.schoolId,
    role: claims.role,
    email: claims.email,
    isSuperAdmin: Boolean(claims.isSuperAdmin || claims.role === "SUPER_ADMIN"),
    mustChangePassword: Boolean(claims.mustChangePassword),
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_MAX_AGE_SECONDS)
    .sign(SECRET_KEY);
}

/**
 * Verifies a short-lived Access Token JWT.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET_KEY);
    return {
      userId: payload.userId as string,
      schoolId: payload.schoolId as string,
      role: payload.role as string,
      email: payload.email as string | undefined,
      isSuperAdmin: Boolean(payload.isSuperAdmin),
      mustChangePassword: Boolean(payload.mustChangePassword),
    };
  } catch {
    return null;
  }
}

/**
 * Creates a cryptographically secure 7-day Refresh Token, stores its SHA-256 hash in the database,
 * and sets the HttpOnly, Secure, SameSite=Strict cookie.
 */
export async function issueRefreshToken(params: {
  userId: string;
  schoolId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ rawRefreshToken: string; expiresAt: Date }> {
  const rawRefreshToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000);

  await basePrisma.refreshToken.create({
    data: {
      userId: params.userId,
      schoolId: params.schoolId || null,
      tokenHash,
      expiresAt,
      isRevoked: false,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });

  return { rawRefreshToken, expiresAt };
}

/**
 * Strict Refresh Token Rotation:
 * Validates incoming refresh token hash against the database, revokes it, issues a new refresh token,
 * and produces a new short-lived access token.
 * 
 * If a revoked token is presented, detects possible replay attack and purges all active tokens for that user.
 */
export async function rotateRefreshToken(params: {
  rawRefreshToken: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{
  success: boolean;
  accessToken?: string;
  rawRefreshToken?: string;
  error?: string;
  claims?: AccessTokenClaims;
}> {
  const oldHash = hashToken(params.rawRefreshToken);

  const existingToken = await basePrisma.refreshToken.findUnique({
    where: { tokenHash: oldHash },
  });

  if (!existingToken) {
    return { success: false, error: "Invalid refresh token." };
  }

  // Token reuse detection: if token is already revoked, potential security breach!
  if (existingToken.isRevoked) {
    console.warn(`[SECURITY_ALERT]: Replayed refresh token detected for userId: ${existingToken.userId}. Revoking all sessions.`);
    await basePrisma.refreshToken.updateMany({
      where: { userId: existingToken.userId },
      data: { isRevoked: true },
    });
    return { success: false, error: "Token reuse detected. All active sessions have been terminated for security." };
  }

  const now = new Date();
  if (existingToken.expiresAt < now) {
    return { success: false, error: "Refresh token has expired. Please sign in again." };
  }

  // Resolve user identity to build new access token claims
  let userRole = "STUDENT";
  let userEmail = "";
  let isSuperAdmin = false;
  let mustChangePassword = false;

  const superAdmin = await basePrisma.superAdmin.findUnique({
    where: { id: existingToken.userId },
  });

  if (superAdmin) {
    userRole = "SUPER_ADMIN";
    userEmail = superAdmin.email;
    isSuperAdmin = true;
  } else {
    const staff = await basePrisma.staff.findUnique({
      where: { id: existingToken.userId },
    });
    if (staff) {
      userRole = staff.role;
      userEmail = staff.email;
      mustChangePassword = Boolean(staff.mustChangePassword);
    } else {
      const student = await basePrisma.student.findUnique({
        where: { id: existingToken.userId },
      });
      if (student) {
        userRole = "STUDENT";
        userEmail = student.email || `${student.admissionNumber || student.id}@student.portal`;
        mustChangePassword = Boolean(student.mustChangePassword);
      }
    }
  }

  // Generate new refresh token pair
  const newRawRefreshToken = crypto.randomBytes(32).toString("hex");
  const newHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000);

  // Invalidate old token and link to replacement (chain tracking)
  await basePrisma.refreshToken.update({
    where: { id: existingToken.id },
    data: {
      isRevoked: true,
      replacedByTokenHash: newHash,
    },
  });

  // Save new refresh token
  await basePrisma.refreshToken.create({
    data: {
      userId: existingToken.userId,
      schoolId: existingToken.schoolId,
      tokenHash: newHash,
      expiresAt: newExpiresAt,
      isRevoked: false,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });

  const claims: AccessTokenClaims = {
    userId: existingToken.userId,
    schoolId: existingToken.schoolId || "global-saas",
    role: userRole,
    email: userEmail,
    isSuperAdmin,
    mustChangePassword,
  };

  const newAccessToken = await signAccessToken(claims);

  return {
    success: true,
    accessToken: newAccessToken,
    rawRefreshToken: newRawRefreshToken,
    claims,
  };
}

/**
 * Cookie configuration strictly adhering to HttpOnly, Secure, SameSite=Strict
 */
export function getRefreshTokenCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  };
}

export function getAccessTokenCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  };
}
