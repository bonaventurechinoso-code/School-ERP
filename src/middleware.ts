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

  // --- Auth Check & RBAC Protection for Administrative Routes ---
  const isAdminConsole = path === '/admin' || path.startsWith('/admin/');
  const tenantAdminSegments = [
    '/dashboard', '/finance', '/hr', '/portal-settings',
    '/admissions', '/staff', '/students', '/scheduling',
    '/exams', '/transcripts', '/report-cards', '/communications'
  ];
  const isTenantAdminPath = tenantAdminSegments.some(segment => path.includes(segment));
  const isAdministrativePath = isAdminConsole || isTenantAdminPath;

  if (isAdministrativePath) {
    const sessionToken = req.cookies.get('session')?.value;

    if (!sessionToken) {
      // Redirect to login if no session token
      const loginUrl = new URL(isAdminConsole ? '/login' : '/login', req.url);
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
      const role = ((payload.role as string) || '').toUpperCase();

      // 1. ISOLATE STUDENTS FROM ADMINISTRATIVE DASHBOARDS
      if (role === 'STUDENT') {
        const studentPortalUrl = new URL('/portal/student', req.url);
        studentPortalUrl.searchParams.set('denied', 'true');
        return NextResponse.redirect(studentPortalUrl);
      }

      // 2. ISOLATE STAFF FROM ADMINISTRATIVE DASHBOARDS
      if (role === 'STAFF') {
        const staffPortalUrl = new URL('/portal/staff', req.url);
        staffPortalUrl.searchParams.set('denied', 'true');
        return NextResponse.redirect(staffPortalUrl);
      }

      // 3. SUPER ADMIN CONSOLE (/admin) PROTECTION
      if (isAdminConsole && !['SUPER_ADMIN', 'ADMIN'].includes(role)) {
        const deniedUrl = new URL('/access-denied', req.url);
        deniedUrl.searchParams.set('role', role);
        deniedUrl.searchParams.set('message', 'Platform Super-Admin console is restricted to Super-Administrators.');
        return NextResponse.redirect(deniedUrl);
      }

      // 4. TEACHER Role: Block Finance, HR, Portal Settings, Admissions, Staff
      if (role === 'TEACHER') {
        if (path.includes('/finance') || path.includes('/hr') || path.includes('/portal-settings') || path.includes('/admissions') || path.includes('/staff')) {
          const dashUrl = new URL(`/${subdomain || 'app'}/dashboard`, req.url);
          if (subdomain && (isIPAddress || isLocalhost)) {
            dashUrl.searchParams.set('mockTenant', subdomain);
          }
          return NextResponse.redirect(dashUrl);
        }
      }

      // 5. BURSAR Role: Block HR, Portal Settings, Scheduling, Exams, Transcripts, Admissions, Staff
      if (role === 'BURSAR') {
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
      const loginUrl = new URL('/login', req.url);
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
