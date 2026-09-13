import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - admin (SaaS Master Platform routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (e.g. images, fonts)
     */
    '/((?!api|admin|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // 1. MASTER SAAS CONTROLLER SHORT-CIRCUIT:
  // Instantly recognize platform owner routes (/admin, /admin/*).
  // Completely skip tenant detection and database lookups, and open master SaaS dashboard directly.
  if (path === '/admin' || path.startsWith('/admin/')) {
    return NextResponse.next();
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
    if (parts.length > 2) {
      subdomain = parts[0];
    }
  }

  // Bypass dedicated portals, public pages, and auth endpoints from administrative interception
  const isPublicOrPortalPath =
    path.startsWith('/portal/') ||
    path.includes('/portal/') ||
    path === '/access-denied' ||
    path.includes('/login') ||
    path.includes('/apply') ||
    path.startsWith('/register');

  if (isPublicOrPortalPath) {
    if (isIPAddress || isLocalhost) {
      if (subdomain) {
        const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
        return NextResponse.rewrite(rewriteUrl);
      }
      return NextResponse.next();
    }

    if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
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
      // Redirect to tenant login or SaaS Master portal
      const targetPath = subdomain ? `/${subdomain}/login` : '/admin';
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

      // 6. SUPER_ADMIN / SCHOOL_ADMIN / ADMIN: Unrestricted access across administrative modules
    } catch (err) {
      // Token is invalid or expired
      const targetPath = subdomain ? `/${subdomain}/login` : '/admin';
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
    if (subdomain) {
      const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
      return NextResponse.rewrite(rewriteUrl);
    }
    return NextResponse.next();
  }

  if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}
