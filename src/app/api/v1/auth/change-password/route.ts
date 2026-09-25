import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { changeUserPassword } from "@/lib/security-service";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getSecureCookieOptions,
} from "@/lib/session-manager";
import {
  signAccessToken,
  issueRefreshToken,
  getRefreshTokenCookieOptions,
  getAccessTokenCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_NAME,
} from "@/lib/dual-token";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { oldPassword, currentPassword, newPassword, confirmPassword } = body;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // 1. Resolve session token from cookies or authorization header
    let cookieToken: string | undefined = undefined;
    try {
      const cookieStore = await cookies();
      cookieToken =
        cookieStore.get(SESSION_COOKIE_NAME)?.value ||
        cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ||
        cookieStore.get("accessToken")?.value;
    } catch {}

    const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const token = cookieToken || authHeader;

    let userId = "";
    let schoolId = "global-saas";
    let role = "STAFF";
    let payload: any = null;

    if (token) {
      try {
        const verified = await jwtVerify(token, SECRET_KEY);
        payload = verified.payload;
        userId = (payload.userId || payload.sub || payload.id) as string;
        schoolId = (payload.schoolId || payload.tenantId || "global-saas") as string;
        role = (payload.role as string) || "STAFF";
      } catch {
        return NextResponse.json(
          { error: "Your session has expired. Please sign in again.", code: "SESSION_EXPIRED" },
          { status: 401 }
        );
      }
    } else if (body.userId || body.email) {
      const { basePrisma } = await import("@/lib/tenant-prisma");
      if (body.userId) {
        const user = await basePrisma.user.findUnique({ where: { id: body.userId } });
        if (user) {
          userId = user.id;
          schoolId = user.schoolId;
          role = user.role;
        } else {
          const staff = await basePrisma.staff.findUnique({
            where: { id: body.userId },
            include: { user: true },
          });
          if (staff) {
            userId = staff.id;
            schoolId = staff.schoolId;
            role = staff.user?.role || "TEACHER";
          }
        }
      } else if (body.email) {
        const user = await basePrisma.user.findFirst({ where: { email: body.email.trim().toLowerCase() } });
        if (user) {
          userId = user.id;
          schoolId = user.schoolId;
          role = user.role;
        } else {
          const staff = await basePrisma.staff.findFirst({
            where: { email: body.email.trim().toLowerCase() },
            include: { user: true },
          });
          if (staff) {
            userId = staff.id;
            schoolId = staff.schoolId;
            role = staff.user?.role || "TEACHER";
          }
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication session required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 3. Execute authoritative password change
    const result = await changeUserPassword({
      userId,
      schoolId: schoolId || "global-saas",
      role,
      oldPassword: oldPassword || currentPassword,
      newPassword,
      confirmPassword,
      ip: clientIp,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Password update failed.", code: "VALIDATION_FAILED" },
        { status: 400 }
      );
    }

    // 4. Issue updated session token, access token, and refresh token with mustChangePassword = false
    const updatedPayload = {
      ...payload,
      mustChangePassword: false,
    };
    delete (updatedPayload as any).exp;
    delete (updatedPayload as any).nbf;
    delete (updatedPayload as any).iat;

    const newSessionToken = await new SignJWT(updatedPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS)
      .sign(SECRET_KEY);

    const newAccessToken = await signAccessToken({
      userId,
      schoolId: schoolId || "global-saas",
      role,
      email: payload.email || undefined,
      isSuperAdmin: Boolean(payload.isSuperAdmin || role === "SUPER_ADMIN"),
      mustChangePassword: false,
    });

    const { rawRefreshToken } = await issueRefreshToken({
      userId,
      schoolId: schoolId || "global-saas",
      ipAddress: clientIp,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully. Other active sessions have been securely logged out.",
      mustChangePassword: false,
      accessToken: newAccessToken,
      role,
      schoolDomain: payload.schoolDomain || undefined,
    });

    // Update all authentication cookies
    response.cookies.set(
      SESSION_COOKIE_NAME,
      newSessionToken,
      getSecureCookieOptions(SESSION_MAX_AGE_SECONDS)
    );

    response.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      newAccessToken,
      getAccessTokenCookieOptions()
    );

    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      rawRefreshToken,
      getRefreshTokenCookieOptions()
    );

    return response;
  } catch (error: any) {
    console.error("[AUTH_CHANGE_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while changing password.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
