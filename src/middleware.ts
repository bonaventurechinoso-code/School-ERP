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
  "track",
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

function isPublicRoute(pathname: string, req?: NextRequest): boolean {
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
    // Allow public admissions and upload endpoints
    if (
      apiPath.startsWith("/api/v1/admissions/upload") ||
      apiPath.startsWith("/api/admissions/upload") ||
      apiPath.startsWith("/api/v1/admissions/public-submit") ||
      apiPath.startsWith("/api/admissions/public-submit") ||
      apiPath.startsWith("/api/v1/payments/receipt/upload") ||
      apiPath.startsWith("/api/v1/payments/settings") ||
      apiPath.startsWith("/api/v1/payments/access-check") ||
      apiPath.startsWith("/api/uploads") ||
      apiPath.startsWith("/api/auth") ||
      apiPath.startsWith("/api/v1/auth/login") ||
      apiPath.startsWith("/api/v1/auth/forgot-password") ||
      apiPath.startsWith("/api/v1/auth/reset-password") ||
      apiPath.startsWith("/api/v1/auth/verify-reset-token") ||
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
    // Allow applicant /auth/session or /admissions/* when request includes an applicant/upload token or guest session
    if (
      req &&
      (apiPath === "/api/v1/auth/session" ||
        apiPath === "/api/auth/session" ||
        apiPath.startsWith("/api/admissions/") ||
        apiPath.startsWith("/api/v1/admissions/")) &&
      Boolean(
        req.nextUrl.searchParams.get("token") ||
        req.headers.get("x-applicant-token") ||
        req.headers.get("x-upload-token") ||
        req.cookies.get("guest_session")
      )
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
    // Public applicant admission portal sub-paths: /{schoolDomain}/admissions/{upload|track|apply|offer|admit-slip}/...
    if (secondSegment === "admissions" && segments.length >= 3) {
      const thirdSegment = segments[2].toLowerCase();
      if (["upload", "track", "apply", "offer", "admit-slip", "status"].includes(thirdSegment)) {
        return true;
      }
    }
    // Public applications tracking: /{schoolDomain}/applications/{track|apply|upload}/...
    if (secondSegment === "applications" && segments.length >= 3) {
      const thirdSegment = segments[2].toLowerCase();
      if (["track", "apply", "upload"].includes(thirdSegment)) {
        return true;
      }
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
  isSuspended?: boolean;
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
          isSuspended: Boolean(payload.isSuspended) || payload.status === "SUSPENDED" || payload.subscriptionStatus === "SUSPENDED",
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
          isSuspended: Boolean(nextAuthToken.isSuspended) || nextAuthToken.status === "SUSPENDED" || nextAuthToken.subscriptionStatus === "SUSPENDED",
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Derives a canonical, safe redirect URL that never falls back to internal container ports
 * (such as localhost:10000 on Render). Respects reverse proxy headers, configured environment variables,
 * and canonical platform domain.
 */
function getSafeRedirectUrl(targetPath: string, req: NextRequest): URL {
  const normalizedPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    const primaryHost = forwardedHost.split(",")[0].trim();
    if (primaryHost && !primaryHost.includes("localhost:10000")) {
      return new URL(normalizedPath, `${forwardedProto}://${primaryHost}`);
    }
  }

  if (
    req.nextUrl &&
    req.nextUrl.host &&
    !req.nextUrl.host.includes("localhost:10000") &&
    !req.nextUrl.host.includes("127.0.0.1:10000")
  ) {
    return new URL(normalizedPath, req.nextUrl);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (appUrl && !appUrl.includes("localhost:10000")) {
    return new URL(normalizedPath, appUrl);
  }

  if (process.env.NODE_ENV === "production") {
    return new URL(normalizedPath, "https://bonaveeict.com.ng");
  }

  return new URL(normalizedPath, req.nextUrl);
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const lowerPath = pathname.toLowerCase();

  // Super-admin login route: rewrite cleanly to /login?type=super-admin
  if (lowerPath === "/super-admin/login" || lowerPath === "/admin/login") {
    const loginUrl = getSafeRedirectUrl("/login?type=super-admin", req);
    loginUrl.search = req.nextUrl.search;
    loginUrl.searchParams.set("type", "super-admin");
    return NextResponse.rewrite(loginUrl);
  }

  // 1. Allow unauthenticated access ONLY to explicitly public routes
  if (isPublicRoute(pathname, req)) {
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
    const targetLoginPath = requestedTenant
      ? `/${requestedTenant}/login`
      : "/login";
    const loginUrl = getSafeRedirectUrl(targetLoginPath, req);
    const normalizedCallback = isSuperAdminPath(lowerPath)
      ? lowerPath
          .replace(/^\/(?:supper-admin|supper_admin|superadmin|super_admin|admin)(?=\/|$)/, "/super-admin")
          .replace(/\/tenats(?=\/|$)/, "/tenants")
      : pathname;
    loginUrl.searchParams.set("callbackUrl", normalizedCallback);

    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set("Location", loginUrl.pathname + loginUrl.search);
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
      const deniedUrl = getSafeRedirectUrl("/access-denied", req);
      const redirectResponse = NextResponse.redirect(deniedUrl);
      redirectResponse.headers.set("Location", "/access-denied");
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
        const targetUrl = getSafeRedirectUrl(canonicalPath, req);
        targetUrl.search = req.nextUrl.search;
        const redirectResponse = NextResponse.redirect(targetUrl, 307);
        redirectResponse.headers.set("Location", targetUrl.pathname + targetUrl.search);
        return redirectResponse;
      }
    }
  }

  // 5. TENANT ISOLATION CHECK:
  // Non-super-admins cannot access another tenant's workspace
  if (requestedTenant && !claims.isSuperAdmin) {
    if (claims.isSuspended) {
      if (lowerPath.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Account suspended: Subscription overdue or inactive.", code: "ACCOUNT_SUSPENDED" },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      const loginUrl = getSafeRedirectUrl(`/${requestedTenant}/login?error=suspended&code=${requestedTenant}`, req);
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.headers.set("Location", loginUrl.pathname + loginUrl.search);
      for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
        redirectResponse.headers.set(k, v);
      }
      return redirectResponse;
    }
    const userDomain = (claims.schoolDomain || "").toLowerCase().trim();
    const userTenantId = (claims.tenantId || "").trim();

    if (userDomain !== requestedTenant && userTenantId !== requestedTenant) {
      if (lowerPath.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Cross-tenant access violation." },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      const deniedUrl = getSafeRedirectUrl("/access-denied", req);
      const redirectResponse = NextResponse.redirect(deniedUrl);
      redirectResponse.headers.set("Location", "/access-denied");
      for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
        redirectResponse.headers.set(k, v);
      }
      return redirectResponse;
    }
  }

  // 5b. EDGE RBAC ROLE ISOLATION & WORKSPACE DEFENSE
  const userRole = (claims.role || "").toUpperCase();
  const targetTenant = requestedTenant || (claims.schoolDomain || "").toLowerCase().trim() || "greenwood";

  const createRoleRedirect = (targetDestination: string) => {
    if (lowerPath.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Role not authorized for this workspace." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }
    const destUrl = getSafeRedirectUrl(targetDestination, req);
    const redirectResponse = NextResponse.redirect(destUrl);
    redirectResponse.headers.set("Location", destUrl.pathname + destUrl.search);
    for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) {
      redirectResponse.headers.set(k, v);
    }
    return redirectResponse;
  };

  if (lowerPath === "/change-password" || lowerPath.startsWith("/change-password/")) {
    // Allowed for all authenticated roles
  } else if (userRole === "STUDENT") {
    const isAllowedStudentRoute =
      lowerPath === `/${targetTenant}/portal` ||
      lowerPath === `/${targetTenant}/portal/student` ||
      lowerPath.startsWith(`/${targetTenant}/portal/student/`) ||
      lowerPath === `/${targetTenant}/student` ||
      lowerPath.startsWith(`/${targetTenant}/student/`) ||
      lowerPath === "/portal" ||
      lowerPath === "/portal/student" ||
      lowerPath.startsWith("/portal/student/") ||
      lowerPath.startsWith("/api/student/") ||
      lowerPath.startsWith(`/${targetTenant}/api/student/`);

    if (!isAllowedStudentRoute) {
      return createRoleRedirect(`/${targetTenant}/portal/student`);
    }
  } else if (userRole === "PARENT") {
    const isAllowedParentRoute =
      lowerPath === `/${targetTenant}/portal` ||
      lowerPath === `/${targetTenant}/portal/parent` ||
      lowerPath.startsWith(`/${targetTenant}/portal/parent/`) ||
      lowerPath === `/${targetTenant}/parent` ||
      lowerPath.startsWith(`/${targetTenant}/parent/`) ||
      lowerPath === "/portal" ||
      lowerPath === "/portal/parent" ||
      lowerPath.startsWith("/portal/parent/") ||
      lowerPath.startsWith("/api/parent/") ||
      lowerPath.startsWith(`/${targetTenant}/api/parent/`);

    if (!isAllowedParentRoute) {
      return createRoleRedirect(`/${targetTenant}/portal/parent`);
    }
  } else if (userRole === "TEACHER" || userRole === "STAFF") {
    const isAllowedStaffRoute =
      lowerPath === `/${targetTenant}/portal` ||
      lowerPath === `/${targetTenant}/portal/staff` ||
      lowerPath.startsWith(`/${targetTenant}/portal/staff/`) ||
      lowerPath === "/portal" ||
      lowerPath === "/portal/staff" ||
      lowerPath.startsWith("/portal/staff/") ||
      lowerPath.startsWith("/api/staff/") ||
      lowerPath.startsWith(`/${targetTenant}/api/staff/`);

    if (!isAllowedStaffRoute) {
      return createRoleRedirect(`/${targetTenant}/portal/staff`);
    }
  } else if (userRole === "BURSAR") {
    if (
      lowerPath.includes("/portal/student") ||
      lowerPath.includes("/portal/parent")
    ) {
      return createRoleRedirect(`/${targetTenant}/portal/bursar`);
    }
  } else if (userRole === "PRINCIPAL" || userRole === "HEADMASTER" || userRole === "VICE_PRINCIPAL") {
    if (
      lowerPath.includes("/portal/student") ||
      lowerPath.includes("/portal/parent")
    ) {
      return createRoleRedirect(`/${targetTenant}/portal/principal`);
    }
  }

  // 6. ATTACH REQUEST-SCOPED CONTEXT TO INCOMING REQUEST HEADERS
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", lowerPath);
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
