import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAllAuthSessionData, applyLogoutCookiesAndHeaders } from "@/lib/server-logout";

export async function POST() {
  try {
    const cookieStore = await cookies();
    await clearAllAuthSessionData(cookieStore);
    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    return applyLogoutCookiesAndHeaders(response);
  } catch {
    const response = NextResponse.json({ success: true });
    return applyLogoutCookiesAndHeaders(response);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectParam = searchParams.get("redirect") || searchParams.get("callbackUrl") || "/login";
    let safeTarget = "/login";
    if (redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
      safeTarget = redirectParam;
    }

    const cookieStore = await cookies();
    await clearAllAuthSessionData(cookieStore);

    const redirectUrl = new URL(safeTarget, req.url);
    const response = NextResponse.redirect(redirectUrl);
    return applyLogoutCookiesAndHeaders(response);
  } catch {
    const redirectUrl = new URL("/login", req.url);
    const response = NextResponse.redirect(redirectUrl);
    return applyLogoutCookiesAndHeaders(response);
  }
}
