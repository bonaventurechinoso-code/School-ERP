import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyAccessToken, AccessTokenClaims } from "./dual-token";
import { validateDatabaseSession } from "./session-manager";
import { basePrisma } from "./tenant-prisma";

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  SCHOOL_ADMIN = "SCHOOL_ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  PARENT = "PARENT",
  BURSAR = "BURSAR",
}

export interface AuthContext {
  userId: string;
  schoolId: string;
  role: Role | string;
  email?: string;
  isSuperAdmin: boolean;
  mustChangePassword?: boolean;
}

/**
 * Functional Guard: requireAuth
 * Authenticates the caller via short-lived access token, session cookie, or Authorization header.
 * Throws an Error or returns verified AuthContext.
 */
export async function requireAuth(req?: Request): Promise<AuthContext> {
  // 1. Check Authorization Bearer header
  let token: string | undefined;
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  // 2. Check cookies
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get("accessToken")?.value || cookieStore.get("session")?.value;
    } catch {}
  }

  // 3. Check downstream verified headers (if passed by middleware)
  try {
    const headerList = await headers();
    const headerUserId = headerList.get("x-user-id");
    const headerSchoolId = headerList.get("x-tenant-id");
    const headerRole = headerList.get("x-user-role");
    const isSuperAdminHeader = headerList.get("x-is-super-admin") === "true";

    if (headerUserId && headerSchoolId) {
      return {
        userId: headerUserId,
        schoolId: headerSchoolId,
        role: headerRole || Role.STUDENT,
        isSuperAdmin: isSuperAdminHeader || headerRole === Role.SUPER_ADMIN,
      };
    }
  } catch {}

  if (!token) {
    throw new Error("Unauthorized: Authentication token is required.");
  }

  // 4. Verify access token
  const claims = await verifyAccessToken(token);
  if (claims) {
    return {
      userId: claims.userId,
      schoolId: claims.schoolId,
      role: claims.role,
      email: claims.email,
      isSuperAdmin: Boolean(claims.isSuperAdmin || claims.role === Role.SUPER_ADMIN),
      mustChangePassword: claims.mustChangePassword,
    };
  }

  // 5. Fallback check active database session
  const dbSession = await validateDatabaseSession(token);
  if (dbSession) {
    return {
      userId: dbSession.userId,
      schoolId: dbSession.tenantId || "global-saas",
      role: dbSession.role,
      email: dbSession.email,
      isSuperAdmin: dbSession.role === Role.SUPER_ADMIN,
      mustChangePassword: dbSession.mustChangePassword,
    };
  }

  throw new Error("Unauthorized: Invalid or expired credentials.");
}

/**
 * Functional Guard: requireRole
 * Enforces that the authenticated user possesses one of the permitted system roles.
 * SuperAdmins automatically pass with global bypass.
 */
export async function requireRole(
  allowedRoles: (Role | string)[],
  req?: Request
): Promise<AuthContext> {
  const auth = await requireAuth(req);

  if (auth.isSuperAdmin || auth.role === Role.SUPER_ADMIN) {
    return auth;
  }

  const normalizedUserRole = (auth.role || "").toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  if (!normalizedAllowed.includes(normalizedUserRole)) {
    throw new Error(
      `Forbidden: Access denied. Role '${auth.role}' is not authorized to access this resource. Allowed: [${normalizedAllowed.join(", ")}]`
    );
  }

  return auth;
}

/**
 * Functional Guard: requireTenantContext
 * Validates that the request belongs to an active, valid school tenant.
 * Returns tenant identity and school record.
 */
export async function requireTenantContext(reqOrSlug: Request | string): Promise<{
  schoolId: string;
  slug: string;
  name: string;
  subdomain: string;
}> {
  let slug = typeof reqOrSlug === "string" ? reqOrSlug : "";

  if (typeof reqOrSlug !== "string") {
    // Extract from headers or URL
    const headerSchoolId = reqOrSlug.headers.get("x-tenant-id");
    const headerSlug = reqOrSlug.headers.get("x-tenant-slug");
    if (headerSchoolId && headerSlug) {
      return {
        schoolId: headerSchoolId,
        slug: headerSlug,
        name: headerSlug,
        subdomain: headerSlug,
      };
    }

    const url = new URL(reqOrSlug.url);
    const segments = url.pathname.split("/").filter(Boolean);
    slug = segments.length > 0 ? segments[0] : "";
  }

  if (!slug) {
    throw new Error("Bad Request: Tenant slug or context is required.");
  }

  const normalizedSlug = slug.toLowerCase().trim();

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { slug: normalizedSlug },
        { subdomain: normalizedSlug },
      ],
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      subdomain: true,
      isActive: true,
      isBanned: true,
    },
  });

  if (!school || !school.isActive || school.isBanned) {
    throw new Error(`Bad Request: No live institution matches slug '${slug}'.`);
  }

  return {
    schoolId: school.id,
    slug: school.slug || school.subdomain,
    name: school.name,
    subdomain: school.subdomain,
  };
}
