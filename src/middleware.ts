import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

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

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // 1. MASTER SAAS CONTROLLER / SUPER-ADMIN ACCESS LOCKDOWN:
  // Explicitly hard-gate /admin and /super-admin routes behind SUPER_ADMIN role verification.
  const isGlobalAdminPath =
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/super-admin' ||
    path.startsWith('/super-admin/');

  if (isGlobalAdminPath) {
    const sessionToken = req.cookies.get('session')?.value;
    const isDev = process.env.NODE_ENV === 'development';

    if (!sessionToken) {
      const deniedUrl = new URL('/access-denied', req.url);
      deniedUrl.searchParams.set('message', 'Platform Super-Admin authentication required. Please log in with authorized credentials.');
      return NextResponse.redirect(deniedUrl);
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
        userEmail === 'admin@schoolerp.com' ||
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
      const deniedUrl = new URL('/access-denied', req.url);
      deniedUrl.searchParams.set('message', 'Super-Admin session invalid or expired. Please re-authenticate.');
      const response = NextResponse.redirect(deniedUrl);
      response.cookies.delete('session');
      return response;
    }
  }

  // Get hostname from headers (e.g., 'johnali.schoolerp.com', 'localhost:3000', '10.60.230.247:3000')
  const hostname = req.headers.get('host') || '';

  // Determine if there's a subdomain
  const isIPAddress = /^[0-9\.]+(:[0-9]+)?$/.test(hostname) || /^\[.*\](:[0-9]+)?$/.test(hostname);
  const isLocalhost = hostname.startsWith('localhost') || hostname.includes('127.0.0.1');

  let subdomain = '';
  if (isIPAddress || isLocalhost) {
    subdomain = url.searchParams.get('mockTenant') || '';
  } else {
    const parts = hostname.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].includes('localhost'))) {
      subdomain = parts[0];
    }
  }

  // Bypass dedicated portals, public pages, and auth endpoints from administrative interception
  const isPublicOrPortalPath =
    path.startsWith('/portal/') ||
    path.includes('/portal/') ||
    path === '/access-denied' ||
    path.startsWith('/access-denied') ||
    path === '/trial-expired' ||
    path.startsWith('/trial-expired') ||
    path.includes('/login') ||
    path.includes('/apply') ||
    path.startsWith('/register');

  if (isPublicOrPortalPath) {
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
    '/dashboard', '/finance', '/hr', '/portal-settings',
    '/admissions', '/staff', '/students', '/scheduling',
    '/exams', '/transcripts', '/report-cards', '/communications'
  ];
  const isTenantAdminPath = tenantAdminSegments.some(segment => path.includes(segment));

  if (isTenantAdminPath) {
    const sessionToken = req.cookies.get('session')?.value;
    const isDev = process.env.NODE_ENV === 'development';

    if (!sessionToken) {
      // Redirect to tenant login or access-denied
      const targetPath = subdomain ? `/${subdomain}/login` : '/access-denied';
      const loginUrl = new URL(targetPath, req.url);
      if (subdomain && (isIPAddress || isLocalhost)) {
        loginUrl.searchParams.set('mockTenant', subdomain);
      }
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Verify JWT
      const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionToken, secret);

      // Resolve effective tenant context
      let effectiveSubdomain = subdomain;
      if (!effectiveSubdomain) {
        if (payload.schoolDomain) {
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
          const statusUrl = new URL(`/api/tenants/status?subdomain=${effectiveSubdomain}`, req.url);
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

      // --- Strict Role Isolation Matrix ---
      const rawRole = ((payload.role as string) || '').toUpperCase();
      // In development mode, automatically treat active session with master SUPER_ADMIN privileges
      const role = isDev ? 'SUPER_ADMIN' : rawRole;

      // 1. ISOLATE STUDENTS FROM ADMINISTRATIVE DASHBOARDS
      if (!isDev && role === 'STUDENT') {
        const studentPortalUrl = new URL('/portal/student', req.url);
        studentPortalUrl.searchParams.set('denied', 'true');
        return NextResponse.redirect(studentPortalUrl);
      }

      // 2. ISOLATE STAFF FROM ADMINISTRATIVE DASHBOARDS
      if (!isDev && role === 'STAFF') {
        const staffPortalUrl = new URL('/portal/staff', req.url);
        staffPortalUrl.searchParams.set('denied', 'true');
        return NextResponse.redirect(staffPortalUrl);
      }

      // 4. TEACHER Role: Block Finance, HR, Portal Settings, Admissions, Staff
      if (!isDev && role === 'TEACHER') {
        if (path.includes('/finance') || path.includes('/hr') || path.includes('/portal-settings') || path.includes('/admissions') || path.includes('/staff')) {
          const dashUrl = new URL(`/${subdomain || 'app'}/dashboard`, req.url);
          if (subdomain && (isIPAddress || isLocalhost)) {
            dashUrl.searchParams.set('mockTenant', subdomain);
          }
          return NextResponse.redirect(dashUrl);
        }
      }

      // 5. BURSAR Role: Block HR, Portal Settings, Scheduling, Exams, Transcripts, Admissions, Staff
      if (!isDev && role === 'BURSAR') {
        if (path.includes('/hr') || path.includes('/portal-settings') || path.includes('/scheduling') || path.includes('/exams') || path.includes('/transcripts') || path.includes('/admissions') || path.includes('/staff')) {
          const dashUrl = new URL(`/${subdomain || 'app'}/dashboard`, req.url);
          if (subdomain && (isIPAddress || isLocalhost)) {
            dashUrl.searchParams.set('mockTenant', subdomain);
          }
          return NextResponse.redirect(dashUrl);
        }
      }

      // 6. SUPER_ADMIN / SCHOOL_ADMIN / ADMIN / TENANT_ADMIN: Unrestricted access across administrative modules
    } catch (err) {
      // Token is invalid or expired
      const targetPath = subdomain ? `/${subdomain}/login` : '/access-denied';
      const loginUrl = new URL(targetPath, req.url);
      if (subdomain && (isIPAddress || isLocalhost)) {
        loginUrl.searchParams.set('mockTenant', subdomain);
      }
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('session');
      return response;
    }
  }
  // --- End Auth Check ---

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
