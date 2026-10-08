import { cookies, headers } from "next/headers";
import * as jose from "jose";

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  SCHOOL_ADMIN = "SCHOOL_ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  PARENT = "PARENT",
  BURSAR = "BURSAR",
}

export type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "BURSAR" | "STAFF" | "TENANT_ADMIN";

export interface SessionPayload {
  userId: string;
  email?: string;
  tenantId: string;
  role: Role | UserRole | string;
  staffRole?: string;
  schoolDomain: string;
  tenantName?: string;
  activeTiers: string[];
  permissions: string[];
  sessionToken?: string;
  sessionId?: string;
  dbSessionId?: string;
  expiresAt?: Date | string;
  mustChangePassword?: boolean;
  [key: string]: any;
}

export function normalizeRole(rawRole: string): Role | string {
  const upper = (rawRole || "").trim().toUpperCase();
  if (upper === "SUPER_ADMIN") return Role.SUPER_ADMIN;
  if (
    upper === "SCHOOL_ADMIN" ||
    upper === "TENANT_ADMIN" ||
    upper === "SCHOOL_OWNER" ||
    upper === "TENANT_OWNER" ||
    upper === "ADMIN_EXECUTIVE" ||
    upper === "ADMIN" ||
    upper.includes("ADMIN")
  ) {
    return Role.SCHOOL_ADMIN;
  }
  if (upper === "STUDENT") return Role.STUDENT;
  if (upper === "BURSAR") return Role.BURSAR;
  if (upper === "PARENT") return Role.PARENT;
  if (upper === "TEACHER" || upper === "STAFF") return Role.TEACHER;
  return Role.TEACHER;
}

export function getDefaultPermissionsForRole(role: Role | UserRole | string): string[] {
  const upper = (role || "").toString().toUpperCase();
  switch (upper) {
    case "SUPER_ADMIN":
      return [
        "manage:all",
        "manage:tenants",
        "manage:tiers",
        "manage:wallets",
        "manage:students",
        "manage:staff",
        "manage:finances"
      ];
    case "SCHOOL_ADMIN":
    case "TENANT_ADMIN":
    case "ADMIN":
      return [
        "manage:school",
        "manage:tiers",
        "manage:wallet",
        "manage:students",
        "manage:staff",
        "manage:finances",
        "manage:academics",
        "view:reports"
      ];
    case "BURSAR":
      return [
        "manage:finances",
        "manage:fees",
        "manage:invoices",
        "manage:payments",
        "verify:payments",
        "view:reports"
      ];
    case "TEACHER":
    case "STAFF":
      return [
        "view:classes",
        "mark:attendance",
        "enter:grades",
        "view:students",
        "view:bulletins"
      ];
    case "STUDENT":
      return [
        "view:timetable",
        "view:grades",
        "view:transcripts",
        "view:attendance"
      ];
    case "PARENT":
      return [
        "view:student_grades",
        "view:student_attendance",
        "view:invoices",
        "make:payment"
      ];
    default:
      return [];
  }
}

import { validateDatabaseSession, requireServerAuth } from "./session-manager";
import { getDevMockRoleConfig } from "./permissions";
import { getServerSession } from "next-auth";
import { authOptions } from "./nextauth-config";

export { requireServerAuth, authOptions };

export function isSuperAdminUser(userOrRole: any): boolean {
  if (!userOrRole) return false;
  if (typeof userOrRole === "string") {
    return userOrRole.trim().toUpperCase() === "SUPER_ADMIN";
  }
  const role = (userOrRole.role || userOrRole.userRole || "").toString().trim().toUpperCase();
  return role === "SUPER_ADMIN" || Boolean(userOrRole.isSuperAdmin);
}

/**
 * Validates cross-tenant boundaries.
 * Super Admin Golden Key: user.role === 'SUPER_ADMIN' immediately passes all cross-tenant checks.
 * Standard users must strictly belong to the target tenant domain or tenant ID.
 */
export function validateTenantSessionMatch(
  session: SessionPayload | null,
  targetDomainOrSlug?: string | null
): { allowed: boolean; isSuperAdmin: boolean; reason?: string } {
  if (!session) {
    return { allowed: false, isSuperAdmin: false, reason: "No active session." };
  }

  // 1. THE SUPER ADMIN "GOLDEN KEY" PROTECTION CLAUSE
  if (isSuperAdminUser(session)) {
    return { allowed: true, isSuperAdmin: true };
  }

  // If no target tenant domain constraint was passed, allow standard session
  if (!targetDomainOrSlug) {
    return { allowed: true, isSuperAdmin: false };
  }

  const target = targetDomainOrSlug.trim().toLowerCase();
  const sessionDomain = (session.schoolDomain || "").trim().toLowerCase();
  const sessionTenantId = (session.tenantId || "").trim();

  // Standard user must match target tenant domain or tenant ID exactly
  if (sessionDomain === target || sessionTenantId === targetDomainOrSlug.trim()) {
    return { allowed: true, isSuperAdmin: false };
  }

  return {
    allowed: false,
    isSuperAdmin: false,
    reason: `Cross-tenant violation: User belongs to institution '${sessionDomain || sessionTenantId}', access to '${target}' is forbidden.`,
  };
}

export async function getSession(
  tokenOverride?: string | null,
  targetTenantDomain?: string | null
): Promise<SessionPayload | null> {
  let resolvedSession: SessionPayload | null = null;

  // 1. Authoritative database-backed session validation (Secure Production Mode)
  const dbSession = await validateDatabaseSession(tokenOverride);
  if (dbSession) {
    resolvedSession = dbSession;
  }

  // 2. Flexible Local Dev Mode Mocking (via NEXT_PUBLIC_DEV_MOCK_ROLE)
  if (!resolvedSession) {
    const isDev = process.env.NODE_ENV === "development";
    const devMockRoleSetting = isDev ? process.env.NEXT_PUBLIC_DEV_MOCK_ROLE : null;
    if (isDev && devMockRoleSetting && !tokenOverride) {
      const mock = getDevMockRoleConfig(devMockRoleSetting);
      if (mock) {
        resolvedSession = {
          userId: "dev-mock-user-id",
          email: `mock-${mock.staffRole.toLowerCase().replace(/[^a-z0-9]/g, "")}@school.edu`,
          tenantId: "mock-dev-tenant",
          schoolDomain: "greenwood",
          tenantName: "Greenwood Academy",
          role: mock.role,
          staffRole: mock.staffRole,
          activeTiers: ["Primary School", "Secondary School"],
          permissions: getDefaultPermissionsForRole(mock.role as any),
          sessionToken: "mock-dev-session-token",
          sessionId: "mock-dev-session-token",
        };
      }
    }
  }

  // 3. NextAuth.js active session resolution (Credentials & Google OAuth)
  if (!resolvedSession && !tokenOverride) {
    try {
      const nextAuthSession = await getServerSession(authOptions);
      if (nextAuthSession?.user) {
        const u = nextAuthSession.user as any;
        const sToken = u.sessionToken || u.jti || u.id || u.userId;
        resolvedSession = {
          userId: u.userId || u.id,
          email: u.email || undefined,
          tenantId: u.tenantId || "global-saas",
          schoolDomain: u.schoolDomain || "admin",
          tenantName: u.tenantName || undefined,
          role: (u.role as UserRole) || "STAFF",
          staffRole: u.staffRole || undefined,
          activeTiers: u.activeTiers || [],
          permissions: u.permissions || getDefaultPermissionsForRole((u.role as UserRole) || "STAFF"),
          sessionToken: sToken,
          sessionId: sToken,
          dbSessionId: u.dbSessionId,
        };
      }
    } catch {
      // Graceful fallback if invoked in environment without NextAuth headers
    }
  }

  // 4. Fallback stateless token verification (for dev tests or transient tokens)
  if (!resolvedSession) {
    let rawToken = tokenOverride;
    if (!rawToken) {
      try {
        const cookieStore = await cookies();
        rawToken = cookieStore.get("session")?.value || cookieStore.get("accessToken")?.value;
      } catch {}
    }

    if (!rawToken) {
      try {
        const headerList = await headers();
        const authHeader = headerList.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
          rawToken = authHeader.substring(7);
        }
        if (!rawToken) {
          rawToken = headerList.get("x-session-token");
        }
      } catch {}
    }

    if (rawToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(rawToken, secret);
        const sessionToken =
          (payload.sessionToken as string) ||
          (payload.sessionId as string) ||
          (payload.jti as string) ||
          (payload.token as string) ||
          (payload.id as string) ||
          rawToken;

        const anyPayload = payload as any;
        resolvedSession = {
          ...anyPayload,
          sessionToken,
          sessionId: sessionToken,
          userId: (anyPayload.userId as string) || (anyPayload.id as string) || "stateless-user",
          role: (anyPayload.role as UserRole) || (anyPayload.userRole as UserRole) || "STAFF",
          userRole: (anyPayload.userRole as string) || (anyPayload.role as string) || "STAFF",
          assignedTier: (anyPayload.assignedTier as string) || (anyPayload.activeTiers?.[0] as string) || null,
          tenantId: (anyPayload.tenantId as string) || (anyPayload.schoolId as string) || "global-saas",
          schoolDomain: (anyPayload.schoolDomain as string) || "admin",
          activeTiers: (anyPayload.activeTiers as string[]) || [],
          permissions: (anyPayload.permissions as string[]) || [],
        } as SessionPayload;
      } catch (error) {
        console.error("Failed to decode session token:", error);
        return null;
      }
    }
  }

  if (!resolvedSession) {
    return null;
  }

  // =========================================================================
  // THE SUPER ADMIN "GOLDEN KEY" PROTECTION CLAUSE (CRITICAL)
  // =========================================================================
  // If user.role === 'SUPER_ADMIN', grant immediate full validation clearance.
  // Super Admin bypasses [schoolDomain] routing match constraints completely.
  if (isSuperAdminUser(resolvedSession)) {
    return resolvedSession;
  }

  // Cross-reference against target tenant domain (either passed explicitly or present in headers)
  let activeTenantDomain = targetTenantDomain;
  if (!activeTenantDomain) {
    try {
      const headerList = await headers();
      activeTenantDomain = headerList.get("x-tenant-slug") || headerList.get("x-tenant-id");
    } catch {}
  }

  if (activeTenantDomain) {
    const matchCheck = validateTenantSessionMatch(resolvedSession, activeTenantDomain);
    if (!matchCheck.allowed) {
      console.warn(`[AUTH_GUARD_REJECT] ${matchCheck.reason}`);
      return null; // Instant session rejection on cross-tenant mismatch
    }
  }

  return resolvedSession;
}

