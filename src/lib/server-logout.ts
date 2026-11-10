import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeDatabaseSession, SESSION_COOKIE_NAME } from "@/lib/session-manager";
import { REFRESH_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_NAME, hashToken } from "@/lib/dual-token";
import { basePrisma } from "@/lib/tenant-prisma";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

const EXPIRED_COOKIE_OPTIONS = {
  path: "/",
  expires: new Date(0),
  maxAge: 0,
} as const;

export const COOKIES_TO_DELETE = [
  "session",
  "auth_token",
  "guest_session",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "__Host-next-auth.csrf-token",
  "next-auth.csrf-token",
  "activeTier",
  "auth_guard_status",
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_NAME,
];

export async function clearAllAuthSessionData(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  // Delete current session from database session table using cookie value
  const sessionCookieValue =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ||
    cookieStore.get("session")?.value ||
    cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ||
    cookieStore.get("auth_token")?.value ||
    cookieStore.get("next-auth.session-token")?.value ||
    cookieStore.get("__Secure-next-auth.session-token")?.value;

  if (sessionCookieValue) {
    let sessionTokenId = sessionCookieValue;
    try {
      const { payload } = await jose.jwtVerify(sessionCookieValue, SECRET_KEY);
      sessionTokenId =
        (payload.sessionToken as string) ||
        (payload.sessionId as string) ||
        (payload.jti as string) ||
        (payload.token as string) ||
        (payload.id as string) ||
        sessionCookieValue;
    } catch {}

    await basePrisma.session.deleteMany({
      where: {
        OR: [
          { sessionToken: sessionCookieValue },
          { id: sessionCookieValue },
          { sessionToken: sessionTokenId },
          { id: sessionTokenId },
        ],
      },
    }).catch(() => {});

    await revokeDatabaseSession(sessionCookieValue).catch(() => {});
  }

  // Delete current session token from existing refreshToken table using the token from cookie
  const rawRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  if (rawRefreshToken) {
    const hashed = hashToken(rawRefreshToken);
    await basePrisma.refreshToken.deleteMany({
      where: {
        OR: [
          { tokenHash: hashed },
          { id: rawRefreshToken },
        ],
      },
    }).catch(() => {});
  }

  for (const name of COOKIES_TO_DELETE) {
    try {
      cookieStore.delete(name);
    } catch {}
  }
}

export function applyLogoutCookiesAndHeaders(response: NextResponse) {
  for (const name of COOKIES_TO_DELETE) {
    response.cookies.set(name, "", {
      ...EXPIRED_COOKIE_OPTIONS,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
