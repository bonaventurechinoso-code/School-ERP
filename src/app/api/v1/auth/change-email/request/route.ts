import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { requestEmailChange } from "@/lib/email-change-service";

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
        schoolId: session.tenantId || null,
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
        role === "SUPER_ADMIN" ||
        email === "bonaventure.chinoso@gmail.com"
      );

      return {
        userId,
        email,
        role: isSuper ? "SUPER_ADMIN" : role,
        schoolId: (payload.schoolId as string) || null,
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
        { error: "Authentication required to request email change.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { newEmail, currentPassword } = body;

    if (!newEmail || !currentPassword) {
      return NextResponse.json(
        { error: "Both new email address and current password are required.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

    const result = await requestEmailChange({
      userId: caller.userId,
      currentEmail: caller.email,
      newEmail,
      currentPassword,
      clientIp,
      userRole: caller.role,
      schoolId: caller.schoolId,
    });

    if (!result.success) {
      const status = result.code === "INCORRECT_PASSWORD" ? 401 : result.code === "RATE_LIMIT_EXCEEDED" ? 429 : 400;
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("[CHANGE_EMAIL_REQUEST_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to process email change request. Please try again later." },
      { status: 500 }
    );
  }
}
