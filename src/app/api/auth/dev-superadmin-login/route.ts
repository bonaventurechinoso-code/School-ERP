import { NextResponse } from "next/server";
import { getDefaultPermissionsForRole } from "@/lib/auth";
import { createDatabaseSession } from "@/lib/session-manager";

const MASTER_DEV_EMAIL = "superadmin@platform.com";
const MASTER_DEV_USER_ID = "master-dev-superadmin-id";

/**
 * Temporary, secure development-only backdoor route handler.
 * Signs in the developer with full SUPER_ADMIN privileges, sets the authorized
 * session cookie, and redirects directly into the Super Admin panel (/admin).
 */
async function generateDevSuperAdminSession(): Promise<string> {
  const sessionResult = await createDatabaseSession({
    userId: MASTER_DEV_USER_ID,
    email: MASTER_DEV_EMAIL,
    tenantId: "global-saas",
    schoolDomain: "admin",
    tenantName: "Global Platform Administration",
    role: "SUPER_ADMIN",
    activeTiers: ["Central Platform"],
    permissions: getDefaultPermissionsForRole("SUPER_ADMIN"),
    userAgent: "Dev Backdoor SuperAdmin",
  });

  return sessionResult.cookieToken;
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Dev backdoor route is strictly disabled in production environments." },
      { status: 403 }
    );
  }

  try {
    const sessionToken = await generateDevSuperAdminSession();
    const redirectUrl = new URL("/admin", req.url);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set("session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error("[DEV_SUPERADMIN_LOGIN_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to generate dev super-admin session.", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Dev backdoor route is strictly disabled in production environments." },
      { status: 403 }
    );
  }

  try {
    const sessionToken = await generateDevSuperAdminSession();
    const response = NextResponse.json({
      success: true,
      message: "Dev super-admin session initialized successfully.",
      email: MASTER_DEV_EMAIL,
      role: "SUPER_ADMIN",
      redirectUrl: "/admin",
    });

    response.cookies.set("session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error: any) {
    console.error("[DEV_SUPERADMIN_LOGIN_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to generate dev super-admin session.", details: error?.message },
      { status: 500 }
    );
  }
}
