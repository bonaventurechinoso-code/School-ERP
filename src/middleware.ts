import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SECURITY_CONFIG } from "./security/config";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isProtected = SECURITY_CONFIG.PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  if (isProtected) {
    const hasSession = SECURITY_CONFIG.SESSION_COOKIES.some((n) => req.cookies.get(n));
    if (!hasSession) {
      return NextResponse.redirect(new URL(SECURITY_CONFIG.LOGIN_ROUTE, req.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/super-admin/:path*", "/dashboard/:path*", "/admin/:path*"] };
