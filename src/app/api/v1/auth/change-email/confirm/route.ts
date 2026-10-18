import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { confirmEmailChange } from "@/lib/email-change-service";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function resolveCallerIdentity(req: Request) {
  // 1. Check getSession()
  try {
    const session = await getSession();
    if (session && session.userId) {
      return {
        userId: session.userId,
        email: session.email || "",
        role: (session.role || session.staffRole || "USER").toUpperCase(),
      };
    }
  } catch {}

  // 2. Check cookies / Authorization header
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token =
      cookieStore.get("session")?.value ||
      cookieStore.get("accessToken")?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      cookieStore.get("__Secure-next-auth.session-token")?.value;
  } catch {}

  const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const effectiveToken = token || authHeader;

  if (effectiveToken) {
    try {
      const verified = await jwtVerify(effectiveToken, SECRET_KEY);
      const payload = verified.payload;
      const role = ((payload.role as string) || (payload.userRole as string) || "").toUpperCase();
      const email = ((payload.email as string) || "").toLowerCase().trim();
      const userId = (payload.userId as string) || (payload.id as string) || "master-superadmin-001";
      const isSuper = Boolean(
        payload.isSuperAdmin ||
        role === "SUPER_ADMIN"
      );

      return {
        userId,
        email,
        role: isSuper ? "SUPER_ADMIN" : role,
      };
    } catch {}
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const caller = await resolveCallerIdentity(req);
    if (!caller || !caller.userId) {
      return NextResponse.json(
        { error: "Authentication required to confirm email change.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { otp } = body;

    if (!otp) {
      return NextResponse.json(
        { error: "6-digit verification code is required.", code: "MISSING_OTP" },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

    const result = await confirmEmailChange({
      userId: caller.userId,
      otp,
      clientIp,
    });

    if (!result.success) {
      const status =
        result.code === "DATABASE_VERIFICATION_FAILED"
          ? 500
          : result.code === "VERIFICATION_LOCKED"
          ? 423
          : 400;
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: result.message,
      newEmail: result.newEmail,
      requiresRelogin: true,
    });

    // Clear session cookies to enforce re-login across all browser tabs
    response.cookies.delete("session");
    response.cookies.delete("accessToken");
    response.cookies.delete("refreshToken");
    response.cookies.delete("next-auth.session-token");
    response.cookies.delete("__Secure-next-auth.session-token");

    return response;
  } catch (error: any) {
    console.error("[CHANGE_EMAIL_CONFIRM_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to verify email change. Please try again later." },
      { status: 500 }
    );
  }
}
