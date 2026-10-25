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

// Reserved system subdomains / prefixes that are not tenant codes
const SYSTEM_PREFIXES = new Set([
  "api",
  "_next",
  "admin",
  "super-admin",
  "super_admin",
  "platform",
  "console",
  "dashboard",
  "teacher",
  "bursar",
  "portal",
  "school-admin",
  "tenant-admin",
  "change-password",
]);

// Mandatory response headers to prevent any intermediate caching of authenticated views
const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function isPublicRoute(pathname: string): boolean {
  // 1. Static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/img") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/api/uploads") ||
    pathname.startsWith("/favicon.ico") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff|woff2|pdf)$/i.test(pathname)
  ) {
    return true;
  }

  const cleanPath = pathname.replace(/^\/+/, "");
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
      const role = ((payload.role || payload.userRole || "") as string).trim().toUpperCase();
      const isSuperAdmin =
        role === "SUPER_ADMIN" ||
        Boolean(payload.isSuperAdmin) ||
        payload.email === "bonaventure.chinoso@gmail.com" ||
        payload.email === "admin@bonaveeict.com.ng";

      const sessionTokenId =
        (payload.sessionToken as string) ||
        (payload.sessionId as string) ||
        (payload.jti as string) ||
        (payload.token as string) ||
        (payload.id as string) ||
        token;

      return {
        userId: (payload.userId as string) || (payload.id as string) || (payload.sub as string),
        role,
        tenantId: (payload.tenantId as string) || (payload.schoolId as string) || null,
        schoolDomain: (payload.schoolDomain as string) || (payload.tenantSlug as string) || null,
        isSuperAdmin,
        sessionToken: sessionTokenId,
      };
    } catch {
      // Token might be a NextAuth JWE token or invalid
    }
  }

  // B. Verify with NextAuth getToken helper
  try {
    const nextAuthToken = await getToken({
      req,
      secret: NEXTAUTH_SECRET,
    });

    if (nextAuthToken) {
      const role = ((nextAuthToken.role || nextAuthToken.userRole || "") as string).trim().toUpperCase();
      const isSuperAdmin =
        role === "SUPER_ADMIN" ||
        Boolean(nextAuthToken.isSuperAdmin) ||
        nextAuthToken.email === "bonaventure.chinoso@gmail.com" ||
        nextAuthToken.email === "admin@bonaveeict.com.ng";

      return {
        userId: (nextAuthToken.userId as string) || (nextAuthToken.id as string) || (nextAuthToken.sub as string),
        role,
        tenantId: (nextAuthToken.tenantId as string) || null,
        schoolDomain: (nextAuthToken.schoolDomain as string) || null,
        isSuperAdmin,
        sessionToken: (nextAuthToken.sessionToken as string) || undefined,
      };
    }
  } catch {}

  return null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Legacy /admin/_ redirect: redirect 301 to /super-admin/_
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const newPath = pathname === "/admin" ? "/super-admin" : pathname.replace(/^\/admin/, "/super-admin");
    const targetUrl = new URL(newPath, req.url);
    targetUrl.search = req.nextUrl.search;
    return NextResponse.redirect(targetUrl, 301);
  }

  // 1. Allow unauthenticated access to public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Strict request-scoped token verification
  const claims = await extractAndVerifyToken(req);

  // Parse path for tenant scoping
  const segments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase() || "";
  const isTenantRoute = segments.length >= 2 && !SYSTEM_PREFIXES.has(firstSegment);
  const requestedTenant = isTenantRoute ? firstSegment : null;

  // 3. UNAUTHENTICATED ACCESS ATTEMPT
  if (!claims || !claims.userId) {
    // API endpoints return 401 with strict no-cache headers
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active authentication session required." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // Page endpoints redirect to /[tenant]/login or /login with strict no-cache headers
    const loginUrl = requestedTenant
      ? new URL(`/${requestedTenant}/login`, req.url)
      : new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
      redirectResponse.headers.set(k, v);
    }

    // Immediately expire invalid or stale cookies
    redirectResponse.cookies.delete("session");
    redirectResponse.cookies.delete("accessToken");
    redirectResponse.cookies.delete("auth_token");
    return redirectResponse;
  }

  // 4. SUPER ADMIN AUTHORIZATION
  if (
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/dashboard/super-admin") ||
    pathname.startsWith("/api/super-admin")
  ) {
    if (!claims.isSuperAdmin && claims.role !== "SUPER_ADMIN") {
      if (pathname.startsWith("/api/")) {
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
  }

  // 5. TENANT ISOLATION CHECK:
  // Non-super-admins cannot access another tenant's workspace
  if (requestedTenant && !claims.isSuperAdmin) {
    const userDomain = (claims.schoolDomain || "").toLowerCase().trim();
    const userTenantId = (claims.tenantId || "").trim();

    if (userDomain !== requestedTenant && userTenantId !== requestedTenant) {
      if (pathname.startsWith("/api/")) {
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
    "/((?!_next/static|_next/image|favicon.ico|img/|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
