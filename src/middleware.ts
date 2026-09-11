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

  // --- Auth Check & RBAC Protection for Tenant Routes ---
  const protectedSegments = [
    '/dashboard', '/finance', '/hr', '/portal-settings',
    '/admissions', '/staff', '/students', '/scheduling',
    '/exams', '/transcripts', '/report-cards', '/communications'
  ];

  const isProtectedPath = protectedSegments.some(segment => url.pathname.includes(segment));

  if (isProtectedPath) {
    const sessionToken = req.cookies.get('session')?.value;

    if (!sessionToken) {
      // Redirect to login if no session token
      const loginUrl = new URL('/login', req.url);
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
      const path = url.pathname;

      // 1. TEACHER Role: Block Finance, HR, Portal Settings, Admissions, Staff
      if (role === 'TEACHER') {
        if (path.includes('/finance') || path.includes('/hr') || path.includes('/portal-settings') || path.includes('/admissions') || path.includes('/staff')) {
          const dashUrl = new URL(`/${subdomain || 'app'}/dashboard`, req.url);
          if (subdomain && (isIPAddress || isLocalhost)) {
            dashUrl.searchParams.set('mockTenant', subdomain);
          }
          return NextResponse.redirect(dashUrl);
        }
      }

      // 2. BURSAR Role: Block HR, Portal Settings, Scheduling, Exams, Transcripts, Admissions, Staff
      if (role === 'BURSAR') {
        if (path.includes('/hr') || path.includes('/portal-settings') || path.includes('/scheduling') || path.includes('/exams') || path.includes('/transcripts') || path.includes('/admissions') || path.includes('/staff')) {
          const dashUrl = new URL(`/${subdomain || 'app'}/dashboard`, req.url);
          if (subdomain && (isIPAddress || isLocalhost)) {
            dashUrl.searchParams.set('mockTenant', subdomain);
          }
          return NextResponse.redirect(dashUrl);
        }
      }

      // 3. STUDENT Role: Block all staff/management modules
      if (role === 'STUDENT') {
        if (path.includes('/finance') || path.includes('/hr') || path.includes('/portal-settings') || path.includes('/admissions') || path.includes('/staff') || path.includes('/scheduling') || path.includes('/exams') || path.includes('/transcripts') || path.includes('/communications')) {
          const dashUrl = new URL(`/${subdomain || 'app'}/dashboard`, req.url);
          if (subdomain && (isIPAddress || isLocalhost)) {
            dashUrl.searchParams.set('mockTenant', subdomain);
          }
          return NextResponse.redirect(dashUrl);
        }
      }

      // 4. ADMIN Role: Unrestricted access across all modules
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
