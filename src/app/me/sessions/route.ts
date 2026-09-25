import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth-guards";
import { basePrisma } from "@/lib/tenant-prisma";
import { logAuditEvent } from "@/lib/audit-logger";
import { SESSION_COOKIE_NAME } from "@/lib/session-manager";
import { REFRESH_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/dual-token";

/**
 * GET /me/sessions
 * Active Session Control Portal Endpoint:
 * Lists all currently active device sessions for the authenticated user.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    const cookieStore = await cookies();
    const currentSessionToken =
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

    const now = new Date();

    // 1. Fetch active database sessions
    const activeDbSessions = await basePrisma.session.findMany({
      where: {
        userId: auth.userId,
        isRevoked: false,
        expiresAt: { gt: now },
      },
      orderBy: { lastActiveAt: "desc" },
    });

    // 2. Fetch active refresh tokens
    const activeRefreshTokens = await basePrisma.refreshToken.findMany({
      where: {
        userId: auth.userId,
        isRevoked: false,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format active device sessions
    const formattedSessions = activeDbSessions.map((s) => {
      const isCurrent =
        s.sessionToken === currentSessionToken ||
        s.id === currentSessionToken;

      return {
        id: s.id,
        type: "DATABASE_SESSION",
        ipAddress: s.ipAddress || "Unknown IP",
        userAgent: s.userAgent || "Browser Client",
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent,
      };
    });

    // If no db sessions found but refresh tokens exist, include refresh token sessions
    if (formattedSessions.length === 0 && activeRefreshTokens.length > 0) {
      for (const rt of activeRefreshTokens) {
        formattedSessions.push({
          id: rt.id,
          type: "REFRESH_TOKEN",
          ipAddress: rt.ipAddress || "Unknown IP",
          userAgent: rt.userAgent || "Browser Client",
          lastActiveAt: rt.createdAt,
          createdAt: rt.createdAt,
          expiresAt: rt.expiresAt,
          isCurrent: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      userId: auth.userId,
      role: auth.role,
      sessionsCount: formattedSessions.length,
      sessions: formattedSessions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unauthorized: Could not retrieve active device sessions." },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

/**
 * DELETE /me/sessions
 * Selectively revokes or kills individual session signatures instantly.
 */
export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
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
        { error: "Session ID parameter is required for selective revocation.", code: "SESSION_ID_REQUIRED" },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    // Revoke target in Session table
    const sessionUpdate = await basePrisma.session.updateMany({
      where: {
        id: targetSessionId,
        userId: auth.userId,
      },
      data: { isRevoked: true },
    });

    // Revoke target in RefreshToken table
    const refreshUpdate = await basePrisma.refreshToken.updateMany({
      where: {
        id: targetSessionId,
        userId: auth.userId,
      },
      data: { isRevoked: true },
    });

    if (sessionUpdate.count === 0 && refreshUpdate.count === 0) {
      return NextResponse.json(
        { error: "Session not found or already revoked.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Commit event to AuditLog
    await logAuditEvent({
      actorId: auth.userId,
      action: "SESSION_REVOKED",
      target: targetSessionId,
      schoolId: auth.schoolId,
      ip: clientIp,
      metadata: { revokedSessionId: targetSessionId },
    });

    return NextResponse.json({
      success: true,
      message: `Session '${targetSessionId}' has been revoked successfully.`,
      revokedId: targetSessionId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unauthorized: Could not revoke session." },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}
