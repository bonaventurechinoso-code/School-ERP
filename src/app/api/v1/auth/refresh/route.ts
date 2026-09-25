import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  rotateRefreshToken,
  getRefreshTokenCookieOptions,
  getAccessTokenCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_NAME,
} from "@/lib/dual-token";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    let rawRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

    if (!rawRefreshToken) {
      try {
        const body = await req.json();
        rawRefreshToken = body?.refreshToken;
      } catch {}
    }

    if (!rawRefreshToken) {
      return NextResponse.json(
        { error: "Refresh token is required.", code: "REFRESH_TOKEN_MISSING" },
        { status: 401 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const result = await rotateRefreshToken({
      rawRefreshToken,
      ipAddress,
      userAgent,
    });

    if (!result.success || !result.accessToken || !result.rawRefreshToken) {
      const response = NextResponse.json(
        { error: result.error || "Token rotation failed.", code: "REFRESH_FAILED" },
        { status: 401 }
      );
      response.cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
      response.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      accessToken: result.accessToken,
      user: result.claims,
    });

    // Enforce absolute token rotation upon every validation refresh cycle:
    // Transferred strictly inside an HttpOnly, Secure, SameSite=Strict cookie wrapper
    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      result.rawRefreshToken,
      getRefreshTokenCookieOptions()
    );

    response.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      result.accessToken,
      getAccessTokenCookieOptions()
    );

    return response;
  } catch (error: any) {
    console.error("[AUTH_TOKEN_ROTATION_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal server error during token rotation.", details: error?.message },
      { status: 500 }
    );
  }
}
