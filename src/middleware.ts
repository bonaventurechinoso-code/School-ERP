import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { checkRouteAuthorization, getDevMockRoleConfig } from '@/lib/permissions';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (e.g. images, fonts)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export const BASE_TENANT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'bonaveeict.com.ng').toLowerCase().replace(/^www\./, '').split(':')[0].trim();

// System reserved root paths that are NOT tenant slugs
const SYSTEM_RESERVED_ROOTS = new Set([
  'admin', 'super-admin', 'access-denied', 'trial-expired',
  'login', 'register', 'choice', 'me', 'api', 'portal-settings', 'change-password'
]);

/**
 * Cleanly extracts tenant subdomains specifically against the .bonaveeict.com.ng suffix.
 */
export function extractTenantSubdomain(host: string, searchParams?: URLSearchParams): string {
  const strippedHost = (host || '').split(':')[0].toLowerCase().trim();

  // 1. Explicit mockTenant override (used for local development / testing)
  const mockOverride = searchParams?.get('mockTenant');
  if (mockOverride) {
    return mockOverride.toLowerCase().trim();
  }

  // 2. Local development: e.g. stpeter.localhost:3000
  if (strippedHost.endsWith('.localhost')) {
    const localParts = strippedHost.split('.');
    if (localParts.length >= 2 && localParts[0] !== 'localhost') {
      return localParts[0].toLowerCase().trim();
    }
    return '';
  }
  if (strippedHost === 'localhost' || strippedHost === '127.0.0.1' || /^[0-9\.]+$/.test(strippedHost)) {
    return '';
  }

  // 3. Official Platform Apex: bonaveeict.com.ng or www.bonaveeict.com.ng is NEVER treated as a tenant
  if (strippedHost === BASE_TENANT_DOMAIN || strippedHost === `www.${BASE_TENANT_DOMAIN}`) {
    return '';
  }

  // 4. Primary production extraction: cleanly split specifically against the .bonaveeict.com.ng suffix
  if (strippedHost.endsWith(`.${BASE_TENANT_DOMAIN}`)) {
    const sub = strippedHost.slice(0, -(BASE_TENANT_DOMAIN.length + 1)).toLowerCase().trim();
    if (sub && !['www', 'app', 'api', 'admin', 'mail'].includes(sub)) {
      return sub;
    }
    return '';
  }

  // 5. Fallback for auxiliary hosting domains (Render)
  const auxiliaryApexDomains = ['school-erp-1-mfc3.onrender.com'];
  for (const apex of auxiliaryApexDomains) {
    if (strippedHost.endsWith(`.${apex}`)) {
      const sub = strippedHost.slice(0, -(apex.length + 1)).toLowerCase().trim();
      if (sub && !['www', 'app', 'api', 'admin', 'mail'].includes(sub)) {
        return sub;
      }
      return '';
    }
  }

  return '';
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // 1. Extract hostname from incoming headers (Render/Node reverse proxy passes x-forwarded-host)
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const strippedHost = rawHost.split(':')[0].toLowerCase().trim();

  // 2. Identify local/IP development environments
  const isIPAddress = /^[0-9\.]+$/.test(strippedHost) || /^\[.*\]$/.test(strippedHost);
  const isLocalhost = strippedHost === 'localhost' || strippedHost === '127.0.0.1' || strippedHost.endsWith('.localhost');

  // 3. Cleanly extract tenant subdomain specifically against .bonaveeict.com.ng
  const subdomain = extractTenantSubdomain(rawHost, url.searchParams);

  // 4. Identify if current host is the master platform apex domain
  const isApexOrPlatformHost =
    !strippedHost ||
    strippedHost === BASE_TENANT_DOMAIN ||
    strippedHost === `www.${BASE_TENANT_DOMAIN}` ||
    (strippedHost.endsWith('.onrender.com') && strippedHost.split('.').length === 3);

  // 5. Extract tenantSlug directly from the incoming URL path parameters (e.g. /york/...)
  const pathSegments = path.split('/').filter(Boolean);
  const potentialPathSlug = pathSegments.length > 0 && !SYSTEM_RESERVED_ROOTS.has(pathSegments[0]) ? pathSegments[0] : '';
  const effectiveTenantSlug = subdomain || potentialPathSlug;

  // 6. Cryptographic Session & SuperAdmin Token Resolution
  let sessionToken = req.cookies.get('accessToken')?.value || req.cookies.get('session')?.value;
  if (!sessionToken) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }
  }

  let verifiedSessionPayload: any = null;
  let isSuperAdmin = false;

  if (sessionToken) {
    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const verified = await jwtVerify(sessionToken, secret);
      verifiedSessionPayload = verified.payload;
      const userRole = ((verifiedSessionPayload.role as string) || '').trim().toUpperCase();
      const userEmail = ((verifiedSessionPayload.email as string) || '').trim().toLowerCase();

      const isMasterAdminEmail =
        userEmail === 'superadmin@platform.com' ||
        userEmail === 'superadmin@school.edu' ||
        userEmail === 'admin@bonaveeict.com.ng' ||
        userEmail.startsWith('superadmin@');

      if (userRole === 'SUPER_ADMIN' || verifiedSessionPayload.isSuperAdmin === true || isMasterAdminEmail) {
        isSuperAdmin = true;
      }
    } catch {
      // Invalid/expired token
    }
  }

  // STEP 2: SuperAdmin Bypass:
  // Grant unrestricted global access bypass to authenticated requests originating from the master SuperAdmin scope,
  // explicitly marking their session state with isSuperAdmin = true.
  if (isSuperAdmin) {
    req.headers.set('x-is-super-admin', 'true');
    req.headers.set('x-user-role', 'SUPER_ADMIN');
    if (verifiedSessionPayload?.userId) {
      req.headers.set('x-user-id', verifiedSessionPayload.userId as string);
    }
    if (effectiveTenantSlug) {
      req.headers.set('x-tenant-slug', effectiveTenantSlug);
    }

    // If super admin is accessing master platform admin pages or any tenant panel, let them through
    if (path === '/admin' || path.startsWith('/admin/') || path === '/super-admin' || path.startsWith('/super-admin/')) {
      return NextResponse.next({ request: { headers: req.headers } });
    }
  }

  // MASTER SAAS CONTROLLER / SUPER-ADMIN CONSOLE LOCKDOWN:
  const isGlobalAdminPath =
    (!subdomain || isApexOrPlatformHost) &&
    (path === '/admin' ||
     path.startsWith('/admin/') ||
     path === '/super-admin' ||
     path.startsWith('/super-admin/'));

  if (isGlobalAdminPath) {
    if (!isSuperAdmin) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', path);
      const res = NextResponse.redirect(loginUrl);
      if (sessionToken && !verifiedSessionPayload) {
        res.cookies.delete('session');
        res.cookies.delete('accessToken');
      }
      return res;
    }
    return NextResponse.next({ request: { headers: req.headers } });
  }

  // STEP 2: Live School Record Validation for Path-Based Slug Routes:
  // If a tenant route is accessed without a valid slug matching a live School record,
  // immediately return an explicit HTTP 400 bad request.
  let activeSchoolRecord: { schoolId: string; slug: string; name?: string } | null = null;

  if (effectiveTenantSlug && !isSuperAdmin) {
    try {
      const appBaseUrl =
        (isLocalhost || isIPAddress)
          ? req.nextUrl.origin
          : (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin);
      const statusUrl = new URL(`/api/tenants/status?slug=${encodeURIComponent(effectiveTenantSlug)}`, appBaseUrl);
      const statusRes = await fetch(statusUrl, { cache: 'no-store' });

      if (!statusRes.ok) {
        // Explicit HTTP 400 bad request if slug does not match a live School record
        return new NextResponse(
          JSON.stringify({
            statusCode: 400,
            error: "Bad Request",
            message: `Explicit Bad Request: Invalid school slug '${effectiveTenantSlug}'. No live institution matches this identifier.`,
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }
        );
      }

      const statusData = await statusRes.json();
      if (!statusData?.schoolId || statusData?.isBanned) {
        return new NextResponse(
          JSON.stringify({
            statusCode: 400,
            error: "Bad Request",
            message: `Explicit Bad Request: Institution for slug '${effectiveTenantSlug}' is inactive or invalid.`,
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }
        );
      }

      // Check trial expiration
      const now = new Date();
      const isExpired = statusData.trialEndDate ? new Date(statusData.trialEndDate) < now : false;
      if (isExpired && !path.includes('/trial-expired')) {
        const expiredUrl = new URL('/trial-expired', req.url);
        return NextResponse.redirect(expiredUrl);
      }

      activeSchoolRecord = {
        schoolId: statusData.schoolId,
        slug: statusData.slug || effectiveTenantSlug,
      };

      req.headers.set('x-tenant-id', activeSchoolRecord.schoolId);
      req.headers.set('x-tenant-slug', activeSchoolRecord.slug);
    } catch (lookupErr) {
      console.warn('[MIDDLEWARE_SLUG_VERIFICATION_ERROR]:', lookupErr);
    }
  }

  // STEP 3: Forced Initial Reset Pipeline:
  // When an administrator adds a new Staff member or Student, mustChangePassword: true is set.
  // Their first successful login forces a strict browser interception, routing them straight to
  // /[tenantSlug]/security/change-password while blocking access to all other application panels until complete.
  if (verifiedSessionPayload?.mustChangePassword) {
    const isChangePasswordPage =
      path === '/change-password' ||
      path.startsWith('/change-password') ||
      path.endsWith('/security/change-password') ||
      path.includes('/security/change-password');

    if (!isChangePasswordPage) {
      const targetSlug = effectiveTenantSlug || (verifiedSessionPayload.schoolDomain as string) || '';
      const forcedPath = targetSlug ? `/${targetSlug}/security/change-password` : '/change-password';
      const forcedUrl = new URL(forcedPath, req.url);
      forcedUrl.searchParams.set('forced', 'true');
      return NextResponse.redirect(forcedUrl);
    }
  }

  // Bypass public pages and auth endpoints from administrative RBAC interception
  const isPublicOrPortalPath =
    path === '/change-password' ||
    path.startsWith('/change-password') ||
    path.startsWith('/portal/') ||
    path.includes('/portal/') ||
    path.startsWith('/teacher') ||
    path.startsWith('/bursar') ||
    path === '/access-denied' ||
    path.startsWith('/access-denied') ||
    path === '/trial-expired' ||
    path.startsWith('/trial-expired') ||
    path.includes('/login') ||
    path.includes('/apply') ||
    path.startsWith('/register') ||
    path.includes('/forgot-password') ||
    path.includes('/reset-password') ||
    path.includes('/security/change-password');

  if (isPublicOrPortalPath) {
    if (isIPAddress || isLocalhost) {
      if (subdomain && !url.pathname.startsWith(`/${subdomain}`)) {
        const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
        return NextResponse.rewrite(rewriteUrl, { request: { headers: req.headers } });
      }
      return NextResponse.next({ request: { headers: req.headers } });
    }

    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && !url.pathname.startsWith(`/${subdomain}`)) {
      const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
      return NextResponse.rewrite(rewriteUrl, { request: { headers: req.headers } });
    }

    return NextResponse.next({ request: { headers: req.headers } });
  }

  // --- Auth Check & RBAC Protection for Tenant Administrative Routes ---
  const tenantAdminSegments = [
    '/dashboard', '/finance', '/hr', '/portal-settings', '/settings',
    '/admissions', '/staff', '/students', '/scheduling',
    '/exams', '/transcripts', '/report-cards', '/communications'
  ];
  const isTenantAdminPath = tenantAdminSegments.some(segment => path.includes(segment));

  if (isTenantAdminPath) {
    const isDev = process.env.NODE_ENV === 'development';
    const devMockRoleSetting = process.env.NEXT_PUBLIC_DEV_MOCK_ROLE;
    const mockRoleConfig = isDev && devMockRoleSetting ? getDevMockRoleConfig(devMockRoleSetting) : null;

    if (!sessionToken && !mockRoleConfig && !isSuperAdmin) {
      const targetPath = effectiveTenantSlug ? `/${effectiveTenantSlug}/login` : '/login';
      const loginUrl = new URL(targetPath, req.url);
      if (effectiveTenantSlug && (isIPAddress || isLocalhost) && !subdomain) {
        loginUrl.searchParams.set('mockTenant', effectiveTenantSlug);
      }
      return NextResponse.redirect(loginUrl);
    }

    let payload: any = verifiedSessionPayload;

    if (!payload && mockRoleConfig) {
      payload = {
        userId: 'dev-mock-user',
        email: `mock-${mockRoleConfig.staffRole.toLowerCase().replace(/[^a-z0-9]/g, '')}@school.edu`,
        role: mockRoleConfig.role,
        staffRole: mockRoleConfig.staffRole,
        tenantId: activeSchoolRecord?.schoolId || 'mock-dev-tenant',
        schoolDomain: effectiveTenantSlug || 'greenwood',
      };
    }

    // Strict Cross-Tenant Boundaries Check:
    // Ensure active session belongs to this specific tenant! School A data is invisible to School B.
    if (effectiveTenantSlug && payload && !isSuperAdmin) {
      const payloadDomain = ((payload.schoolDomain || payload.tenantSlug) as string || '').toLowerCase().trim();
      const payloadSchoolId = (payload.tenantId || payload.schoolId) as string;

      const isMatchingTenant =
        payloadDomain === effectiveTenantSlug.toLowerCase() ||
        (activeSchoolRecord && payloadSchoolId === activeSchoolRecord.schoolId);

      if (!isMatchingTenant) {
        const targetPath = `/${effectiveTenantSlug}/login`;
        const loginUrl = new URL(targetPath, req.url);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('session');
        res.cookies.delete('accessToken');
        return res;
      }
    }

    const rawRole = (payload?.role as string) || '';
    const staffRole = (payload?.staffRole as string) || '';
    const authResult = isSuperAdmin ? { allowed: true } : checkRouteAuthorization(path, rawRole, staffRole);

    if (!authResult.allowed) {
      const targetPath = effectiveTenantSlug ? `/${effectiveTenantSlug}/login` : '/login';
      const loginUrl = new URL(targetPath, req.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('session');
      res.cookies.delete('accessToken');
      return res;
    }

    req.headers.set('x-user-id', (payload?.userId as string) || '');
    req.headers.set('x-user-role', rawRole);
    req.headers.set('x-staff-role', staffRole);
    req.headers.set('x-tenant-id', (payload?.tenantId || payload?.schoolId || activeSchoolRecord?.schoolId) as string || '');
  }

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  if (isIPAddress || isLocalhost) {
    if (subdomain && !url.pathname.startsWith(`/${subdomain}`)) {
      const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
      response = NextResponse.rewrite(rewriteUrl, {
        request: {
          headers: req.headers,
        },
      });
    }
  } else if (subdomain && subdomain !== 'www' && subdomain !== 'app' && !url.pathname.startsWith(`/${subdomain}`)) {
    const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
    response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: req.headers,
      },
    });
  }

  return response;
}
