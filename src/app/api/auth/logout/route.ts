import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeDatabaseSession } from "@/lib/session-manager";
import { REFRESH_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_NAME, hashToken } from "@/lib/dual-token";
import { basePrisma } from "@/lib/tenant-prisma";

const EXPIRED_COOKIE_OPTIONS = {
  path: "/",
  expires: new Date(0),
  maxAge: 0,
} as const;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    // Attempt to revoke the database session before clearing cookies
    const sessionCookieValue =
      cookieStore.get("session")?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      cookieStore.get("__Secure-next-auth.session-token")?.value;

    if (sessionCookieValue) {
      await revokeDatabaseSession(sessionCookieValue).catch(() => {});
    }

    // Invalidate the stored refresh token so it can never mint new access tokens
    const rawRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
    if (rawRefreshToken) {
      await basePrisma.refreshToken
        .updateMany({
          where: { tokenHash: hashToken(rawRefreshToken), isRevoked: false },
          data: { isRevoked: true },
        })
        .catch(() => {});
    }

    // Clear all auth-related cookies (both dev + secure production variants)
    const cookiesToDelete = [
      "session",
      "auth_token",
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "__Host-next-auth.csrf-token",
      "next-auth.csrf-token",
      REFRESH_TOKEN_COOKIE_NAME,
      ACCESS_TOKEN_COOKIE_NAME,
    ];

    for (const name of cookiesToDelete) {
      cookieStore.delete(name);
    }

    const response = NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );

    // Belt-and-suspenders: also set them to expired via response headers
    for (const name of cookiesToDelete) {
      response.cookies.set(name, "", {
        ...EXPIRED_COOKIE_OPTIONS,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    // Prevent bfcache from restoring the page after logout
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    // Even on error, return success so the client proceeds to /login
    const response = NextResponse.json({ success: true }, { status: 200 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
