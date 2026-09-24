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

  // On a local tenant school workspace (e.g. stmark.bonaveeict.com.ng or localhost with mockTenant),
  // navigating to /admin or /[schoolDomain]/admin is a tenant workspace action, NOT the SaaS platform super-admin console.
  if (subdomain && !isApexOrPlatformHost && (path === '/admin' || path === `/${subdomain}/admin`)) {
    const dashboardTarget = url.pathname.startsWith(`/${subdomain}`) ? `/${subdomain}/dashboard` : '/dashboard';
    return NextResponse.redirect(new URL(dashboardTarget, req.url));
  }

  // MASTER SAAS CONTROLLER / SUPER-ADMIN ACCESS LOCKDOWN:
  // Explicitly hard-gate /admin and /super-admin routes behind SUPER_ADMIN role verification
  // strictly on the master platform apex domain.
  const isGlobalAdminPath =
    (!subdomain || isApexOrPlatformHost) &&
    (path === '/admin' ||
     path.startsWith('/admin/') ||
     path === '/super-admin' ||
     path.startsWith('/super-admin/'));

  if (isGlobalAdminPath) {
    let sessionToken = req.cookies.get('session')?.value;
    if (!sessionToken) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7);
      }
    }
    const isDev = process.env.NODE_ENV === 'development';

    if (!sessionToken) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionToken, secret);

      const userRole = ((payload.role as string) || '').trim().toUpperCase();
      const userEmail = ((payload.email as string) || '').trim().toLowerCase();

      // Master administrator designated emails allowed to bypass tenant checks and route into global admin
      const isMasterAdminEmail =
        userEmail === 'superadmin@platform.com' ||
        userEmail === 'superadmin@school.edu' ||
        userEmail === 'admin@bonaveeict.com.ng' ||
        userEmail.startsWith('superadmin@');

      // EXPLICIT CHECK:
      // Allow if verified role is SUPER_ADMIN, OR if running in development mode and session belongs to designated master administrator
      if (userRole === 'SUPER_ADMIN' || (isDev && isMasterAdminEmail)) {
        return NextResponse.next();
      }

      // HARD GATED: Block non-super admin roles (TENANT_ADMIN, DEMO_USER, SCHOOL_ADMIN, STAFF, STUDENT)
      const deniedUrl = new URL('/access-denied', req.url);
      deniedUrl.searchParams.set('role', userRole || 'GUEST');
      deniedUrl.searchParams.set(
        'message',
        'Access Denied: This console is strictly restricted to Platform Super-Administrators. Standard tenant admins, demo users, staff, and students cannot access master platform governance.'
      );
      return NextResponse.redirect(deniedUrl);
    } catch (err) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', path);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('session');
      return response;
    }
  }

  // Bypass dedicated portals, public pages, and auth endpoints from administrative interception
  const isPublicOrPortalPath =
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
    // Intercept portal visits if user has a pending forced initial password reset
    if ((path.includes('/portal/') || path.startsWith('/portal/')) && !path.includes('/security/change-password')) {
      const cookieToken = req.cookies.get('session')?.value;
      if (cookieToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
          const secret = new TextEncoder().encode(jwtSecret);
          const verified = await jwtVerify(cookieToken, secret);
          if (verified.payload?.mustChangePassword) {
            const tenant = (verified.payload.schoolDomain as string) || subdomain || '';
            const forcedPath = tenant ? `/${tenant}/security/change-password` : '/security/change-password';
            const forcedUrl = new URL(forcedPath, req.url);
            forcedUrl.searchParams.set('forced', 'true');
            return NextResponse.redirect(forcedUrl);
          }
        } catch {
          // Token decode fail handled by page authentication
        }
      }
    }

    if (isIPAddress || isLocalhost) {
      if (subdomain && !url.pathname.startsWith(`/${subdomain}`)) {
        const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
        return NextResponse.rewrite(rewriteUrl);
      }
      return NextResponse.next();
    }

    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && !url.pathname.startsWith(`/${subdomain}`)) {
      const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
      return NextResponse.rewrite(rewriteUrl);
    }

    return NextResponse.next();
  }

  // --- Auth Check & RBAC Protection for Tenant Administrative Routes ---
  const tenantAdminSegments = [
    '/dashboard', '/finance', '/hr', '/portal-settings', '/settings',
    '/admissions', '/staff', '/students', '/scheduling',
    '/exams', '/transcripts', '/report-cards', '/communications'
  ];
  const isTenantAdminPath = tenantAdminSegments.some(segment => path.includes(segment));

  if (isTenantAdminPath) {
    // Resolve candidate session tokens:
    // Prioritize query token (from onboarding redirect) over potentially stale root-domain cookies
    const queryToken = url.searchParams.get('token') || url.searchParams.get('sessionToken');
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const cookieToken = req.cookies.get('session')?.value;

    let sessionToken = queryToken || authHeader || cookieToken;

    const isDev = process.env.NODE_ENV === 'development';
    const devMockRoleSetting = process.env.NEXT_PUBLIC_DEV_MOCK_ROLE;
    const mockRoleConfig = isDev && devMockRoleSetting ? getDevMockRoleConfig(devMockRoleSetting) : null;

    const pathSegments = path.split('/').filter(Boolean);
    const pathTenant = pathSegments.length > 0 && !['admin', 'super-admin', 'portal', 'api', 'access-denied', 'trial-expired', 'login', 'register', 'choice'].includes(pathSegments[0]) ? pathSegments[0] : '';
    const effectiveTenant = subdomain || pathTenant;

    if (!sessionToken && !mockRoleConfig) {
      // Redirect to tenant login or portal login instead of access-denied
      const targetPath = subdomain ? '/login' : (pathTenant ? `/${pathTenant}/login` : '/login');
      const loginUrl = new URL(targetPath, req.url);
      if (effectiveTenant && (isIPAddress || isLocalhost) && !subdomain) {
        loginUrl.searchParams.set('mockTenant', effectiveTenant);
      }
      return NextResponse.redirect(loginUrl);
    }

    try {
      let payload: any = null;

      if (sessionToken) {
        try {
          const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
          const secret = new TextEncoder().encode(jwtSecret);
          const verified = await jwtVerify(sessionToken, secret);
          payload = verified.payload;
        } catch (tokenErr) {
          // If the cookie token was invalid/expired but queryToken was also available, attempt queryToken
          if (queryToken && sessionToken !== queryToken) {
            try {
              const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
              const secret = new TextEncoder().encode(jwtSecret);
              const verifiedQuery = await jwtVerify(queryToken, secret);
              payload = verifiedQuery.payload;
              sessionToken = queryToken;
            } catch {
              if (!mockRoleConfig) throw tokenErr;
            }
          } else if (!mockRoleConfig) {
            throw tokenErr;
          }
        }
      }

      // If no valid session token exists but Flexible Local Dev Mode is active, synthesize mock session profile
      if (!payload && mockRoleConfig) {
        payload = {
          userId: 'dev-mock-user',
          email: `mock-${mockRoleConfig.staffRole.toLowerCase().replace(/[^a-z0-9]/g, '')}@school.edu`,
          role: mockRoleConfig.role,
          staffRole: mockRoleConfig.staffRole,
          tenantId: 'mock-dev-tenant',
          schoolDomain: subdomain || 'greenwood',
        };
      }

      // Intercept entry if user is flagged for forced initial password reset
      if (payload?.mustChangePassword && !path.includes('/security/change-password')) {
        const forcedPath = effectiveTenant
          ? `/${effectiveTenant}/security/change-password`
          : '/security/change-password';
        const forcedUrl = new URL(forcedPath, req.url);
        forcedUrl.searchParams.set('forced', 'true');
        return NextResponse.redirect(forcedUrl);
      }

      // --- Strict Cross-Subdomain & Root Domain Session Isolation Guard ---
      // If on a tenant subdomain, ensure the active session belongs to this specific tenant!
      // Prevent root domain session states or sibling tenant sessions from bleeding across subdomains.
      if (effectiveTenant && payload) {
        const payloadDomain = ((payload.schoolDomain as string) || '').toLowerCase().trim();
        const payloadRole = ((payload.role as string) || '').toUpperCase().trim();
        const isSuperAdmin = payloadRole === 'SUPER_ADMIN';

        // If the session does not belong to this tenant and is not a platform Super Admin:
        if (!isSuperAdmin && (!payloadDomain || payloadDomain !== effectiveTenant.toLowerCase())) {
          // If a query token was provided for this specific tenant, switch to it:
          if (queryToken && sessionToken !== queryToken) {
            try {
              const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
              const secret = new TextEncoder().encode(jwtSecret);
              const verifiedQuery = await jwtVerify(queryToken, secret);
              const queryPayloadDomain = ((verifiedQuery.payload.schoolDomain as string) || '').toLowerCase().trim();
              const queryRole = ((verifiedQuery.payload.role as string) || '').toUpperCase().trim();
              if (queryPayloadDomain === effectiveTenant.toLowerCase() || queryRole === 'SUPER_ADMIN') {
                payload = verifiedQuery.payload;
                sessionToken = queryToken;
              } else {
                throw new Error("Query token tenant mismatch");
              }
            } catch {
              const targetPath = subdomain ? '/login' : (pathTenant ? `/${pathTenant}/login` : '/login');
              const loginUrl = new URL(targetPath, req.url);
              if (effectiveTenant && (isIPAddress || isLocalhost) && !subdomain) {
                loginUrl.searchParams.set('mockTenant', effectiveTenant);
              }
              const res = NextResponse.redirect(loginUrl);
              res.cookies.delete('session');
              return res;
            }
          } else {
            // Mismatched foreign/root cookie without matching query token:
            // Clear the bleeding foreign cookie and redirect to this tenant's login portal,
            // NEVER throwing the "Security Guard Activated" block page!
            const targetPath = subdomain ? '/login' : (pathTenant ? `/${pathTenant}/login` : '/login');
            const loginUrl = new URL(targetPath, req.url);
            if (effectiveTenant && (isIPAddress || isLocalhost) && !subdomain) {
              loginUrl.searchParams.set('mockTenant', effectiveTenant);
            }
            const res = NextResponse.redirect(loginUrl);
            res.cookies.delete('session');
            return res;
          }
        }
      }

      // Resolve effective tenant context
      let effectiveSubdomain = subdomain;
      if (!effectiveSubdomain) {
        if (payload?.schoolDomain) {
          effectiveSubdomain = payload.schoolDomain as string;
        } else {
          const segments = path.split('/').filter(Boolean);
          if (segments.length > 0 && !['admin', 'portal', 'api', 'access-denied', 'trial-expired'].includes(segments[0])) {
            effectiveSubdomain = segments[0];
          }
        }
      }

      // --- Dynamic Tenant Status & 14-Day Trial Expiration Evaluation ---
      if (effectiveSubdomain) {
        try {
          // Resolve internal API status check using canonical base URL
          const appBaseUrl =
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.BASE_URL ||
            `${req.nextUrl.protocol}//${req.nextUrl.host}`;
          const statusUrl = new URL(`/api/tenants/status?subdomain=${effectiveSubdomain}`, appBaseUrl);
          const statusRes = await fetch(statusUrl, { cache: 'no-store' });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const now = new Date();
            const isExpired = statusData.trialEndDate ? new Date(statusData.trialEndDate) < now : false;
            const isBanned = statusData.isBanned;

            if (isExpired || isBanned) {
              const expiredUrl = new URL('/trial-expired', req.url);
              return NextResponse.redirect(expiredUrl);
            }
          }
        } catch (statusCheckErr) {
          console.warn('[MIDDLEWARE_TENANT_STATUS_CHECK_WARNING]:', statusCheckErr);
        }
      }

      // --- Strict Role-Based Access Control (RBAC) Matrix ---
      const rawRole = (payload?.role as string) || '';
      const staffRole = (payload?.staffRole as string) || '';

      const authResult = checkRouteAuthorization(path, rawRole, staffRole);

      if (!authResult.allowed) {
        // If guest / unauthenticated, redirect to login instead of throwing an access denied error
        if (authResult.category === 'GUEST') {
          const targetPath = subdomain ? '/login' : (pathTenant ? `/${pathTenant}/login` : '/login');
          const loginUrl = new URL(targetPath, req.url);
          if (effectiveTenant && (isIPAddress || isLocalhost) && !subdomain) {
            loginUrl.searchParams.set('mockTenant', effectiveTenant);
          }
          const res = NextResponse.redirect(loginUrl);
          res.cookies.delete('session');
          return res;
        }

        // 1. If student attempted to access administrative area, direct to student portal with notice
        if (authResult.category === 'STUDENT') {
          const studentPortalUrl = new URL('/portal/student', req.url);
          studentPortalUrl.searchParams.set('denied', 'true');
          return NextResponse.redirect(studentPortalUrl);
        }

        // 2. Direct all other unauthorized access attempts gracefully to /access-denied
        const deniedUrl = new URL('/access-denied', req.url);
        deniedUrl.searchParams.set('role', authResult.effectiveRoleName);
        deniedUrl.searchParams.set(
          'message',
          authResult.reason || 'You do not have permission to view this administrative workspace.'
        );
        if (subdomain && (isIPAddress || isLocalhost)) {
          deniedUrl.searchParams.set('mockTenant', subdomain);
        }
        return NextResponse.redirect(deniedUrl);
      }

      const resolvedSessionToken =
        (payload?.sessionToken as string) ||
        (payload?.sessionId as string) ||
        (payload?.jti as string) ||
        (payload?.token as string) ||
        (payload?.id as string) ||
        sessionToken ||
        '';

      // Inject cryptographically verified session claims into downstream request headers
      req.headers.set('x-user-id', (payload?.userId as string) || '');
      req.headers.set('x-user-role', rawRole);
      req.headers.set('x-staff-role', staffRole);
      req.headers.set('x-tenant-id', (payload?.tenantId as string) || '');
      req.headers.set('x-session-token', resolvedSessionToken);
    } catch (err) {
      // Token is invalid or expired
      const pathSegments = path.split('/').filter(Boolean);
      const pathTenant = pathSegments.length > 0 && !['admin', 'super-admin', 'portal', 'api', 'access-denied', 'trial-expired', 'login', 'register', 'choice'].includes(pathSegments[0]) ? pathSegments[0] : '';
      const effectiveTenant = subdomain || pathTenant;
      const targetPath = subdomain ? '/login' : (pathTenant ? `/${pathTenant}/login` : '/login');
      const loginUrl = new URL(targetPath, req.url);
      if (effectiveTenant && (isIPAddress || isLocalhost) && !subdomain) {
        loginUrl.searchParams.set('mockTenant', effectiveTenant);
      }
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('session');
      return response;
    }
  }
  // --- End Auth Check ---

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

  // If session token was provided via query parameter during onboarding redirect, persist strictly as Host-Only cookie
  const incomingToken = url.searchParams.get('token') || url.searchParams.get('sessionToken');
  if (incomingToken) {
    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set('session', incomingToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      domain: undefined, // Strictly Host-Only cookie scoped to this exact subdomain
      maxAge: 30 * 60,
    });
  }

  return response;
}


