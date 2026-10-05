import * as jose from "jose";
import crypto from "crypto";
import { cookies } from "next/headers";
import { basePrisma } from "./tenant-prisma";

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const ALG = "HS256";

export interface AccessTokenClaims {
  userId: string;
  schoolId: string;
  tenantId?: string;
  role: string;
  userRole?: string;
  assignedTier?: string | null;
  activeTiers?: string[];
  schoolDomain?: string;
  tenantSlug?: string;
  tenantName?: string;
  email?: string;
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
  [key: string]: any;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const effectiveTenantId = claims.tenantId || claims.schoolId;
  const effectiveRole = claims.userRole || claims.role;
  return new jose.SignJWT({
    userId: claims.userId,
    schoolId: claims.schoolId || effectiveTenantId,
    tenantId: effectiveTenantId,
    role: claims.role || effectiveRole,
    userRole: effectiveRole,
    assignedTier: claims.assignedTier ?? null,
    activeTiers: claims.activeTiers || [],
    schoolDomain: claims.schoolDomain,
    tenantSlug: claims.tenantSlug || claims.schoolDomain,
    tenantName: claims.tenantName,
    email: claims.email,
    isSuperAdmin: Boolean(claims.isSuperAdmin || claims.role === "SUPER_ADMIN" || effectiveRole === "SUPER_ADMIN"),
    mustChangePassword: Boolean(claims.mustChangePassword),
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_MAX_AGE_SECONDS)
    .sign(SECRET_KEY);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET_KEY);
    const tenantId = (payload.tenantId || payload.schoolId) as string;
    const userRole = (payload.userRole || payload.role) as string;
    return {
      userId: payload.userId as string,
      schoolId: (payload.schoolId || tenantId) as string,
      tenantId: tenantId,
      role: (payload.role || userRole) as string,
      userRole: userRole,
      assignedTier: (payload.assignedTier as string) || null,
      activeTiers: (payload.activeTiers as string[]) || [],
      schoolDomain: payload.schoolDomain as string,
      tenantSlug: payload.tenantSlug as string,
      tenantName: payload.tenantName as string,
      email: payload.email as string | undefined,
      isSuperAdmin: Boolean(payload.isSuperAdmin),
      mustChangePassword: Boolean(payload.mustChangePassword),
    };
  } catch {
    return null;
  }
}

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
      schoolId: params.schoolId === "global-saas" ? null : params.schoolId,
      tokenHash,
      expiresAt,
      isRevoked: false,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });
  return { rawRefreshToken, expiresAt };
}

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
    const user = await basePrisma.user.findFirst({
      where: {
        OR: [
          { id: existingToken.userId },
          { staff: { id: existingToken.userId } },
          { student: { id: existingToken.userId } },
        ],
      },
    });
    if (user) {
      userRole = user.role;
      userEmail = user.email;
      mustChangePassword = Boolean(user.mustChangePassword);
    }
  }
  const newRawRefreshToken = crypto.randomBytes(32).toString("hex");
  const newHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000);
  await basePrisma.refreshToken.update({
    where: { id: existingToken.id },
    data: {
      isRevoked: true,
      replacedByTokenHash: newHash,
    },
  });
  await basePrisma.refreshToken.create({
    data: {
      userId: existingToken.userId,
      schoolId: existingToken.schoolId === "global-saas" ? null : existingToken.schoolId,
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