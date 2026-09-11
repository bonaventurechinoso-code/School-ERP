import { cookies } from "next/headers";
import * as jose from "jose";

export type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "STAFF" | "STUDENT";

export interface SessionPayload {
  userId: string;
  email?: string;
  tenantId: string;
  role: UserRole | string;
  schoolDomain: string;
  tenantName?: string;
  activeTiers: string[];
  permissions: string[];
  [key: string]: any;
}

export function normalizeRole(rawRole: string): UserRole {
  const upper = (rawRole || "").trim().toUpperCase();
  if (upper === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (upper === "SCHOOL_ADMIN" || upper === "ADMIN") return "SCHOOL_ADMIN";
  if (upper === "STUDENT") return "STUDENT";
  return "STAFF"; // Default/fallback for TEACHER, BURSAR, SUPERVISOR, STAFF
}

export function getDefaultPermissionsForRole(role: UserRole): string[] {
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

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);
    return payload as unknown as SessionPayload;
  } catch (error) {
    console.error("Failed to decode session token:", error);
    return null;
  }
}
