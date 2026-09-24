import { cookies } from "next/headers";
import * as jose from "jose";

export type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TENANT_ADMIN" | "STAFF" | "STUDENT";

export interface SessionPayload {
  userId: string;
  email?: string;
  tenantId: string;
  role: UserRole | string;
  staffRole?: string;
  schoolDomain: string;
  tenantName?: string;
  activeTiers: string[];
  permissions: string[];
  sessionToken?: string;
  sessionId?: string;
  dbSessionId?: string;
  expiresAt?: Date | string;
  [key: string]: any;
}

export function normalizeRole(rawRole: string): UserRole {
  const upper = (rawRole || "").trim().toUpperCase();
  if (upper === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (
    upper === "SCHOOL_ADMIN" ||
    upper === "TENANT_ADMIN" ||
    upper === "SCHOOL_OWNER" ||
    upper === "TENANT_OWNER" ||
    upper === "ADMIN_EXECUTIVE" ||
    upper === "ADMIN" ||
    upper.includes("ADMIN")
  ) {
    return "SCHOOL_ADMIN";
  }
  if (upper === "STUDENT") return "STUDENT";
  return "STAFF"; // Default/fallback for TEACHER, BURSAR, SUPERVISOR, STAFF
}

export function getDefaultPermissionsForRole(role: UserRole | string): string[] {
  switch (role) {
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
    default:
      return [];
  }
}

import { validateDatabaseSession, requireServerAuth } from "./session-manager";
import { getDevMockRoleConfig } from "./permissions";
import { getServerSession } from "next-auth";
import { authOptions } from "./nextauth-config";

export { requireServerAuth, authOptions };

export async function getSession(tokenOverride?: string | null): Promise<SessionPayload | null> {
  // 1. Authoritative database-backed session validation (Secure Production Mode)
  const dbSession = await validateDatabaseSession(tokenOverride);
  if (dbSession) {
    return dbSession;
  }

  // 2. Flexible Local Dev Mode Mocking (via NEXT_PUBLIC_DEV_MOCK_ROLE)
  const isDev = process.env.NODE_ENV === "development";
  const devMockRoleSetting = isDev ? process.env.NEXT_PUBLIC_DEV_MOCK_ROLE : null;
  if (isDev && devMockRoleSetting && !tokenOverride) {
    const mock = getDevMockRoleConfig(devMockRoleSetting);
    if (mock) {
      return {
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

  // 3. NextAuth.js active session resolution (Credentials & Google OAuth)
  if (!tokenOverride) {
    try {
      const nextAuthSession = await getServerSession(authOptions);
      if (nextAuthSession?.user) {
        const u = nextAuthSession.user as any;
        const sToken = u.sessionToken || u.jti || u.id || u.userId;
        return {
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
  let rawToken = tokenOverride;
  if (!rawToken) {
    try {
      const cookieStore = await cookies();
      rawToken = cookieStore.get("session")?.value;
    } catch {}
  }

  if (!rawToken) {
    return null;
  }

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

    return {
      ...(payload as any),
      sessionToken,
      sessionId: sessionToken,
      userId: (payload.userId as string) || (payload.id as string) || "stateless-user",
      role: (payload.role as UserRole) || "STAFF",
      tenantId: (payload.tenantId as string) || "global-saas",
      schoolDomain: (payload.schoolDomain as string) || "admin",
      activeTiers: (payload.activeTiers as string[]) || [],
      permissions: (payload.permissions as string[]) || [],
    } as SessionPayload;
  } catch (error) {
    console.error("Failed to decode session token:", error);
    return null;
  }
}

