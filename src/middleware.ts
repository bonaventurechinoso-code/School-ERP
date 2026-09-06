import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // Get hostname from headers (e.g., 'johnali.schoolerp.com', 'localhost:3000', '10.60.230.247:3000')
  const hostname = req.headers.get('host') || '';
  
  // 1. Query Parameter Fallback for local development and mobile testing
  // We identify if the request is from a raw IP or localhost
  const isIPAddress = /^[0-9\.]+(:[0-9]+)?$/.test(hostname) || /^\[.*\](:[0-9]+)?$/.test(hostname);
  const isLocalhost = hostname.startsWith('localhost') || hostname.includes('127.0.0.1');
  
  if (isIPAddress || isLocalhost) {
    const mockTenant = url.searchParams.get('mockTenant');
    
    if (mockTenant) {
      // Create the rewrite URL for the mock tenant
      // Example: http://10.60.230.247:3000/?mockTenant=johnali -> /johnali/
      const rewriteUrl = new URL(`/${mockTenant}${url.pathname}${url.search}`, req.url);
      return NextResponse.rewrite(rewriteUrl);
    }
    
    // If no mockTenant is provided on local/IP, you might want to default to something 
    // or just pass through. Here we simply pass through to allow standard routing.
    return NextResponse.next();
  }

  // 2. Standard Subdomain Routing for Production/Staging
  // Determine if there's a subdomain. Assuming main domain like 'schoolerp.com'
  // and subdomains like 'johnali.schoolerp.com'
  const parts = hostname.split('.');
  
  // We check if it's a subdomain (has more than 2 parts for standard domain like domain.com)
  // This logic may need to be adjusted based on your exact production TLD (e.g., .co.uk)
  if (parts.length > 2) {
    const subdomain = parts[0];
    
    // Prevent rewriting for reserved subdomains like 'www' or 'app'
    if (subdomain !== 'www' && subdomain !== 'app') {
      const rewriteUrl = new URL(`/${subdomain}${url.pathname}${url.search}`, req.url);
      return NextResponse.rewrite(rewriteUrl);
    }
  }
  
  // No rewrite needed, pass through
  return NextResponse.next();
}
