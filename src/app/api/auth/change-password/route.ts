import { NextResponse } from "next/server";
import { POST as baseChangePasswordPost } from "@/app/api/v1/auth/change-password/route";
import { basePrisma } from "@/lib/tenant-prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/session-manager";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, hashToken } from "@/lib/dual-token";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
  // Capture current request token(s) before password update
  const cookieStore = await cookies();
  const currentSessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentAccessTokenCookie = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const currentRefreshTokenCookie = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const currentRequestToken = currentSessionCookie || currentAccessTokenCookie || authHeader;

  // Execute password update
  const res = await baseChangePasswordPost(req.clone());

  // 2A: After password update succeeds, delete all sessions where userId = current user AND token != current request token.
  // Keep current session alive. Do NOT delete current session.
  if (res.ok) {
    try {
      const newSessionCookie = res.cookies.get(SESSION_COOKIE_NAME)?.value;
      const newAccessCookie = res.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
      const newRefreshCookie = res.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

      let userId = "";
      const tokensToCheck = [
        newSessionCookie,
        newAccessCookie,
        currentRequestToken,
        currentSessionCookie,
        currentAccessTokenCookie,
      ].filter(Boolean) as string[];

      for (const t of tokensToCheck) {
        try {
          const { payload } = await jose.jwtVerify(t, SECRET_KEY);
          userId = (payload.userId || payload.sub || payload.id) as string;
          if (userId) break;
        } catch {}
      }

      if (userId) {
        // Collect tokens that represent the current active session to keep alive
        const tokensToKeep = new Set<string>();
        if (currentRequestToken) tokensToKeep.add(currentRequestToken);
        if (currentSessionCookie) tokensToKeep.add(currentSessionCookie);
        if (newSessionCookie) tokensToKeep.add(newSessionCookie);
        if (newAccessCookie) tokensToKeep.add(newAccessCookie);

        for (const t of Array.from(tokensToKeep)) {
          try {
            const { payload } = await jose.jwtVerify(t, SECRET_KEY);
            const sid = (payload.sessionToken || payload.sessionId || payload.id || payload.jti) as string;
            if (sid) tokensToKeep.add(sid);
          } catch {}
        }

        const keepList = Array.from(tokensToKeep);

        // Delete all sessions for this user EXCEPT the current session
        await basePrisma.session.deleteMany({
          where: {
            userId: userId,
            sessionToken: { notIn: keepList },
            id: { notIn: keepList },
          },
        }).catch(() => {});

        // Delete all other refresh tokens for this user EXCEPT current/new refresh token
        const refreshTokensToKeep = new Set<string>();
        if (newRefreshCookie) {
          refreshTokensToKeep.add(hashToken(newRefreshCookie));
          refreshTokensToKeep.add(newRefreshCookie);
        }
        if (currentRefreshTokenCookie) {
          refreshTokensToKeep.add(hashToken(currentRefreshTokenCookie));
          refreshTokensToKeep.add(currentRefreshTokenCookie);
        }

        if (refreshTokensToKeep.size > 0) {
          await basePrisma.refreshToken.deleteMany({
            where: {
              userId: userId,
              tokenHash: { notIn: Array.from(refreshTokensToKeep) },
              id: { notIn: Array.from(refreshTokensToKeep) },
            },
          }).catch(() => {});
        }
      }
    } catch (revokeErr) {
      console.error("[CHANGE_PASSWORD_REVOKE_ERROR]:", revokeErr);
    }
  }

  return res;
}
