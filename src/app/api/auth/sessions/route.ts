import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { basePrisma } from "@/lib/tenant-prisma";
import { verifyAccessToken, hashToken, REFRESH_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/dual-token";
import { validateDatabaseSession, SESSION_COOKIE_NAME } from "@/lib/session-manager";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sessions
 * Returns active device sessions as strict JSON.
 * NEVER returns HTML, never throws raw exceptions.
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const headerList = await headers();

    // 1. Read token from cookies, headers, or Authorization
    let rawToken =
      cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      cookieStore.get("__Secure-next-auth.session-token")?.value;

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      rawToken = authHeader.substring(7).trim();
    }

    // 2. Identify current authenticated user
    let currentUserId = headerList.get("x-user-id");

    if (!currentUserId && rawToken) {
      const claims = await verifyAccessToken(rawToken).catch(() => null);
      if (claims?.userId) {
        currentUserId = claims.userId;
      }
    }

    if (!currentUserId && rawToken) {
      const dbSession = await validateDatabaseSession(rawToken).catch(() => null);
      if (dbSession?.userId) {
        currentUserId = dbSession.userId;
      }
    }

    if (!currentUserId && rawToken) {
      const hashed = hashToken(rawToken);
      const rt = await basePrisma.refreshToken.findFirst({
        where: { tokenHash: hashed, isRevoked: false },
        select: { userId: true },
      }).catch(() => null);
      if (rt?.userId) {
        currentUserId = rt.userId;
      }
    }

    // If no valid token found, return empty sessions array (never redirect, never HTML)
    if (!currentUserId) {
      return NextResponse.json({ sessions: [] }, { status: 200, headers: JSON_HEADERS });
    }

    const now = new Date();
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

    // 2B. Inactivity prune: Delete sessions where lastActiveAt or updatedAt is older than 8 hours
    await basePrisma.session.deleteMany({
      where: {
        userId: currentUserId,
        OR: [
          { lastActiveAt: { lt: eightHoursAgo } },
          { updatedAt: { lt: eightHoursAgo } },
        ],
      },
    }).catch(() => {});

    await basePrisma.refreshToken.deleteMany({
      where: {
        userId: currentUserId,
        OR: [
          { updatedAt: { lt: eightHoursAgo } },
          { createdAt: { lt: eightHoursAgo } },
        ],
      },
    }).catch(() => {});

    const currentSessionToken =
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

    // Fetch active database sessions (strictly within last 8 hours)
    const activeDbSessions = await basePrisma.session.findMany({
      where: {
        userId: currentUserId,
        isRevoked: false,
        expiresAt: { gt: now },
        lastActiveAt: { gte: eightHoursAgo },
        updatedAt: { gte: eightHoursAgo },
      },
      orderBy: { lastActiveAt: "desc" },
    }).catch(() => []);

    // Fetch active refresh tokens (strictly within last 8 hours)
    const activeRefreshTokens = await basePrisma.refreshToken.findMany({
      where: {
        userId: currentUserId,
        isRevoked: false,
        expiresAt: { gt: now },
        updatedAt: { gte: eightHoursAgo },
        createdAt: { gte: eightHoursAgo },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);

    const formattedSessions = (activeDbSessions || []).map((s) => ({
      id: s.id,
      type: "DATABASE_SESSION",
      ipAddress: s.ipAddress || "Unknown IP",
      userAgent: s.userAgent || "Browser Client",
      lastActiveAt: s.lastActiveAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: Boolean(
        (currentSessionToken && (s.sessionToken === currentSessionToken || s.id === currentSessionToken)) ||
        s.id === rawToken
      ),
    }));

    if (formattedSessions.length === 0 && (activeRefreshTokens || []).length > 0) {
      for (const rt of activeRefreshTokens) {
        formattedSessions.push({
          id: rt.id,
          type: "REFRESH_TOKEN",
          ipAddress: rt.ipAddress || "Unknown IP",
          userAgent: rt.userAgent || "Browser Client",
          lastActiveAt: rt.createdAt.toISOString(),
          createdAt: rt.createdAt.toISOString(),
          expiresAt: rt.expiresAt.toISOString(),
          isCurrent: false,
        });
      }
    }

    return NextResponse.json(
      { success: true, sessions: formattedSessions },
      { status: 200, headers: JSON_HEADERS }
    );
  } catch {
    // Fail-safe: Always return JSON
    return NextResponse.json(
      { sessions: [] },
      { status: 200, headers: JSON_HEADERS }
    );
  }
}

/**
 * DELETE /api/auth/sessions
 * Revokes a specific session by ID.
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    let targetSessionId = url.searchParams.get("id") || url.searchParams.get("sessionId");

    if (!targetSessionId) {
      try {
        const body = await req.json();
        targetSessionId = body?.id || body?.sessionId;
      } catch {}
    }

    if (!targetSessionId) {
      return NextResponse.json(
        { error: "Session ID parameter is required.", code: "SESSION_ID_REQUIRED" },
        { status: 400, headers: JSON_HEADERS }
      );
    }

    await basePrisma.session.updateMany({
      where: { id: targetSessionId },
      data: { isRevoked: true },
    }).catch(() => {});

    await basePrisma.refreshToken.updateMany({
      where: { id: targetSessionId },
      data: { isRevoked: true },
    }).catch(() => {});

    return NextResponse.json(
      { success: true, message: "Session revoked successfully", revokedId: targetSessionId },
      { status: 200, headers: JSON_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not revoke session" },
      { status: 200, headers: JSON_HEADERS }
    );
  }
}
