import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { changeUserPassword } from "@/lib/security-service";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getSecureCookieOptions,
} from "@/lib/session-manager";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    // 1. Resolve session token from cookies or authorization header
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const token = cookieToken || authHeader;

    if (!token) {
      return NextResponse.json(
        { error: "Authentication session required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 2. Cryptographically verify caller session
    let payload: any = null;
    try {
      const verified = await jwtVerify(token, SECRET_KEY);
      payload = verified.payload;
    } catch {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again.", code: "SESSION_EXPIRED" },
        { status: 401 }
      );
    }

    const userId = payload.userId as string;
    const schoolId = payload.tenantId as string;
    const role = (payload.role as string) || "STAFF";

    if (!userId) {
      return NextResponse.json(
        { error: "User identity could not be resolved from session.", code: "INVALID_SESSION" },
        { status: 400 }
      );
    }

    // 3. Execute authoritative password change
    const result = await changeUserPassword({
      userId,
      schoolId: schoolId || "global-saas",
      role,
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Password update failed.", code: "VALIDATION_FAILED" },
        { status: 400 }
      );
    }

    // 4. Issue updated session token with mustChangePassword = false
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

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully.",
      mustChangePassword: false,
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      newSessionToken,
      getSecureCookieOptions(SESSION_MAX_AGE_SECONDS)
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
