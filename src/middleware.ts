import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";
import { getToken } from "next-auth/jwt";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "schoolerp-nextauth-super-secret-key-change-in-production";

// Exact public path roots that do not require authentication
const PUBLIC_ROOT_PATHS = new Set([
  "",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "access-denied",
  "unauthorized",
  "trial-expired",
  "onboarding",
  "admit-slip",
  "track",
  "apply",
]);

// Public tenant sub-actions (e.g. /{schoolDomain}/login, /{schoolDomain}/apply, etc.)
const PUBLIC_TENANT_ACTIONS = new Set([
  "login",
  "apply",
  "forgot-password",
  "reset-password",
]);

// Reserved system subdomains / prefixes that are not tenant codes (including common typos)
const SYSTEM_PREFIXES = new Set([
  "api",
  "_next",
  "admin",
  "super-admin",
  "super_admin",
  "superadmin",
  "supper-admin",
  "supper_admin",
  "platform",
  "console",
  "dashboard",
  "teacher",
  "bursar",
  "portal",
  "school-admin",
  "tenant-admin",
  "change-password",
  "unauthorized",
]);

const AUTH_COOKIES_TO_CLEAR = [
  "session",
  "accessToken",
  "refreshToken",
  "auth_token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

// Mandatory response headers to prevent any intermediate caching of authenticated views
const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function isSuperAdminPath(lowerPath: string): boolean {
  return (
    lowerPath === "/super-admin" ||
    lowerPath.startsWith("/super-admin/") ||
    lowerPath === "/super_admin" ||
    lowerPath.startsWith("/super_admin/") ||
    lowerPath === "/superadmin" ||
    lowerPath.startsWith("/superadmin/") ||
    lowerPath === "/supper-admin" ||
    lowerPath.startsWith("/supper-admin/") ||
    lowerPath === "/supper_admin" ||
    lowerPath.startsWith("/supper_admin/") ||
    lowerPath === "/admin" ||
    lowerPath.startsWith("/admin/") ||
    lowerPath.startsWith("/dashboard/super-admin") ||
    lowerPath.startsWith("/api/super-admin") ||
    lowerPath.startsWith("/api/admin")
  );
}

function isPublicRoute(pathname: string): boolean {
  const lowerPath = pathname.toLowerCase();

  // Never allow super-admin or admin paths to be treated as public
  if (isSuperAdminPath(lowerPath)) {
    return false;
  }

  // 1. Static assets and Next.js internals
  if (
    lowerPath.startsWith("/_next") ||
    lowerPath.startsWith("/img") ||
    lowerPath.startsWith("/uploads") ||
    lowerPath.startsWith("/api/uploads") ||
    lowerPath.startsWith("/favicon.ico") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff|woff2|pdf)$/i.test(lowerPath)
  ) {
    return true;
  }

  const cleanPath = lowerPath.replace(/^\/+/, "");
  const segments = cleanPath.split("/").filter(Boolean);

  // 2. Root path (landing page)
  if (segments.length === 0) {
    return true;
  }

  // 3. Known public root paths
  const firstSegment = segments[0].toLowerCase();
  if (PUBLIC_ROOT_PATHS.has(firstSegment)) {
    return true;
  }

  // 4. Public API routes
  if (firstSegment === "api") {
    const apiPath = "/" + segments.join("/");
    if (
      apiPath.startsWith("/api/uploads") ||
      apiPath.startsWith("/api/auth") ||
      apiPath.startsWith("/api/v1/auth/login") ||
      apiPath.startsWith("/api/v1/auth/forgot-password") ||
      apiPath.startsWith("/api/v1/auth/reset-password") ||
      apiPath.startsWith("/api/v1/auth/verify-reset-token") ||
      apiPath.startsWith("/api/v1/admissions/public-submit") ||
      apiPath.startsWith("/api/v1/payments/receipt/upload") ||
      apiPath.startsWith("/api/v1/payments/settings") ||
      apiPath.startsWith("/api/v1/payments/access-check") ||
      apiPath.startsWith("/api/schools") ||
      apiPath.startsWith("/api/tenants/register") ||
      apiPath.startsWith("/api/ssl") ||
      apiPath.startsWith("/api/wallet/webhook") ||
      apiPath.startsWith("/api/trial") ||
      apiPath.startsWith("/api/trials") ||
      apiPath.startsWith("/api/v1/health")
    ) {
      return true;
    }
    // All other API routes are protected
    return false;
  }

  // 5. Tenant routes: /{schoolDomain} or /{schoolDomain}/...
  if (!SYSTEM_PREFIXES.has(firstSegment)) {
    // Single segment /{schoolDomain} -> public school homepage
    if (segments.length === 1) {
      return true;
    }
    const secondSegment = segments[1].toLowerCase();
    // Public tenant actions: /{schoolDomain}/login, /{schoolDomain}/apply, etc.
    if (PUBLIC_TENANT_ACTIONS.has(secondSegment)) {
      return true;
    }
    // Public applicant upload: /{schoolDomain}/admissions/upload/...
    if (secondSegment === "admissions" && segments.length >= 3 && segments[2].toLowerCase() === "upload") {
      return true;
    }
    // All other tenant sub-paths (dashboard, students, staff, finance, etc.) are protected!
    return false;
  }

  return false;
}

interface VerifiedClaims {
  userId: string;
  role: string;
  tenantId?: string | null;
  schoolDomain?: string | null;
  isSuperAdmin: boolean;
  sessionToken?: string;
}

async function extractAndVerifyToken(req: NextRequest): Promise<VerifiedClaims | null> {
  // 1. Check Authorization Bearer header
  let token: string | undefined;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check x-session-token header
  if (!token) {
    const xToken = req.headers.get("x-session-token");
    if (xToken) token = xToken.trim();
  }

  // 3. Check cookies (session, accessToken, auth_token)
  if (!token) {
    token =
      req.cookies.get("session")?.value ||
      req.cookies.get("accessToken")?.value ||
      req.cookies.get("auth_token")?.value;
  }

  // A. Verify with jose HS256 secret (for database session JWTs and dual-tokens)
  if (token) {
    try {
      const { payload } = await jose.jwtVerify(token, SECRET_KEY);
      const userId = (payload.userId as string) || (payload.id as string) || (payload.sub as string);
      if (userId) {
        const role = ((payload.role || payload.userRole || "") as string).trim().toUpperCase();
        const isSuperAdmin = role === "SUPER_ADMIN" || Boolean(payload.isSuperAdmin);

        const sessionTokenId =
          (payload.sessionToken as string) ||
          (payload.sessionId as string) ||
          (payload.jti as string) ||
          (payload.token as string) ||
          (payload.id as string) ||
          token;

        return {
          userId,
          role,
          tenantId: (payload.tenantId as string) || (payload.schoolId as string) || null,
          schoolDomain: (payload.schoolDomain as string) || (payload.tenantSlug as string) || null,
          isSuperAdmin,
          sessionToken: sessionTokenId,
        };
      }
    } catch {
      // Token might be a NextAuth JWE token or invalid/expired
    }
  }

  // B. Verify with NextAuth getToken helper
  try {
    const nextAuthToken = await getToken({
      req,
      secret: NEXTAUTH_SECRET,
    });

    if (nextAuthToken) {
      const userId = (nextAuthToken.userId as string) || (nextAuthToken.id as string) || (nextAuthToken.sub as string);
      if (userId) {
        const role = ((nextAuthToken.role || nextAuthToken.userRole || "") as string).trim().toUpperCase();
        const isSuperAdmin = role === "SUPER_ADMIN" || Boolean(nextAuthToken.isSuperAdmin);

        return {
          userId,
          role,
          tenantId: (nextAuthToken.tenantId as string) || null,
          schoolDomain: (nextAuthToken.schoolDomain as string) || null,
          isSuperAdmin,
          sessionToken: (nextAuthToken.sessionToken as string) || undefined,
        };
      }
    }
  } catch {}

  return null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const lowerPath = pathname.toLowerCase();

  // Super-admin login route: rewrite cleanly to /login?type=super-admin
  if (lowerPath === "/super-admin/login" || lowerPath === "/admin/login") {
    const loginUrl = new URL("/login?type=super-admin", req.url);
    loginUrl.search = req.nextUrl.search;
    loginUrl.searchParams.set("type", "super-admin");
    return NextResponse.rewrite(loginUrl);
  }

  // 1. Allow unauthenticated access ONLY to explicitly public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Strict request-scoped token verification (runs for ALL protected routes including /super-admin/*)
  const claims = await extractAndVerifyToken(req);

  // Parse path for tenant scoping
  const segments = lowerPath.replace(/^\/+/, "").split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase() || "";
  const isTenantRoute = segments.length >= 2 && !SYSTEM_PREFIXES.has(firstSegment);
  const requestedTenant = isTenantRoute ? firstSegment : null;

  // 3. UNAUTHENTICATED ACCESS ATTEMPT
  if (!claims || !claims.userId) {
    // API endpoints return 401 with strict no-cache headers
    if (lowerPath.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active authentication session required." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // Page endpoints redirect to /[tenant]/login or /login with strict no-cache headers
    const loginUrl = requestedTenant
      ? new URL(`/${requestedTenant}/login`, req.url)
      : new URL("/login", req.url);
    const normalizedCallback = isSuperAdminPath(lowerPath)
      ? lowerPath
          .replace(/^\/(?:supper-admin|supper_admin|superadmin|super_admin|admin)(?=\/|$)/, "/super-admin")
          .replace(/\/tenats(?=\/|$)/, "/tenants")
      : pathname;
    loginUrl.searchParams.set("callbackUrl", normalizedCallback);

    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
      redirectResponse.headers.set(k, v);
    }

    // Immediately expire invalid or stale cookies
    for (const cookieName of AUTH_COOKIES_TO_CLEAR) {
      redirectResponse.cookies.delete(cookieName);
    }
    return redirectResponse;
  }

  // 4. SUPER ADMIN AUTHORIZATION (includes /super-admin, /admin, and case/typo variants)
  if (isSuperAdminPath(lowerPath)) {
    if (!claims.isSuperAdmin && claims.role !== "SUPER_ADMIN") {
      if (lowerPath.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Super Admin privileges required." },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      const deniedUrl = new URL("/access-denied", req.url);
      const redirectResponse = NextResponse.redirect(deniedUrl);
      for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
        redirectResponse.headers.set(k, v);
      }
      return redirectResponse;
    }

    // Canonicalize legacy /admin/* or uppercase/typo /Supper-admin/* paths for authenticated Super Admins
    if (!lowerPath.startsWith("/api/") && !lowerPath.startsWith("/dashboard/")) {
      const canonicalPath = lowerPath
        .replace(/^\/(?:supper-admin|supper_admin|superadmin|super_admin|admin)(?=\/|$)/, "/super-admin")
        .replace(/\/tenats(?=\/|$)/, "/tenants");
      if (pathname !== canonicalPath) {
        const targetUrl = new URL(canonicalPath, req.url);
        targetUrl.search = req.nextUrl.search;
        return NextResponse.redirect(targetUrl, 307);
      }
    }
  }

  // 5. TENANT ISOLATION CHECK:
  // Non-super-admins cannot access another tenant's workspace
  if (requestedTenant && !claims.isSuperAdmin) {
    const userDomain = (claims.schoolDomain || "").toLowerCase().trim();
    const userTenantId = (claims.tenantId || "").trim();

    if (userDomain !== requestedTenant && userTenantId !== requestedTenant) {
      if (lowerPath.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Cross-tenant access violation." },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      const deniedUrl = new URL("/access-denied", req.url);
      const redirectResponse = NextResponse.redirect(deniedUrl);
      for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
        redirectResponse.headers.set(k, v);
      }
      return redirectResponse;
    }
  }

  // 6. ATTACH REQUEST-SCOPED CONTEXT TO INCOMING REQUEST HEADERS
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", claims.userId);
  requestHeaders.set("x-user-role", claims.role);
  if (claims.tenantId) requestHeaders.set("x-tenant-id", claims.tenantId);
  if (claims.schoolDomain) requestHeaders.set("x-tenant-slug", claims.schoolDomain);
  if (claims.sessionToken) requestHeaders.set("x-session-token", claims.sessionToken);
  requestHeaders.set("x-is-super-admin", claims.isSuperAdmin ? "true" : "false");

  // 7. INJECT STRICT CACHE-CONTROL HEADERS INTO RESPONSE
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
    response.headers.set(k, v);
  }

  return response;
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/super-admin/:path*",
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|img/|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
