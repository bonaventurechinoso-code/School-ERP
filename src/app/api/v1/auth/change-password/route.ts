import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { changeUserPassword, completePasswordReset, verifyPasswordResetToken } from "@/lib/security-service";
import { basePrisma } from "@/lib/tenant-prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-manager";
import {
  signAccessToken,
  issueRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_NAME,
} from "@/lib/dual-token";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      oldPassword,
      currentPassword,
      newPassword,
      confirmPassword,
      resetToken,
      token: bodyToken,
      schoolDomain,
    } = body;

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Extract active tenant context from request parameters or headers
    const headerTenantSlug = req.headers.get("x-tenant-slug");
    const targetDomain = (schoolDomain || headerTenantSlug || "").trim().toLowerCase();

    // =========================================================================
    // CASE A: PASSWORD RESET VIA RECOVERY TOKEN
    // =========================================================================
    const activeRecoveryToken = resetToken || (!oldPassword && !currentPassword ? bodyToken : undefined);
    if (activeRecoveryToken) {
      if (!newPassword || !confirmPassword) {
        return NextResponse.json(
          { error: "New password and confirmation password are required.", code: "FIELDS_REQUIRED" },
          { status: 400 }
        );
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: "New password and confirmation password do not match.", code: "PASSWORD_MISMATCH" },
          { status: 400 }
        );
      }

      // Verify the recovery token signature with tenant domain verification
      const tokenVerification = await verifyPasswordResetToken(activeRecoveryToken, targetDomain || undefined);
      if (!tokenVerification.valid || !tokenVerification.userId) {
        return NextResponse.json(
          { error: tokenVerification.error || "Invalid, expired, or tenant-mismatched recovery token.", code: "INVALID_TOKEN" },
          { status: 400 }
        );
      }

      // Cross-Tenant Prevention: Verify tenant lock for standard users
      const tokenSchoolId = tokenVerification.schoolId;
      const isSuperAdminToken =
        !tokenSchoolId ||
        Boolean(await basePrisma.superAdmin.findUnique({ where: { id: tokenVerification.userId } }).catch(() => null)) ||
        Boolean(await basePrisma.platformAdmin.findUnique({ where: { id: tokenVerification.userId } }).catch(() => null));

      if (targetDomain && tokenSchoolId && !isSuperAdminToken) {
        const targetSchool = await basePrisma.school.findFirst({
          where: {
            OR: [
              { subdomain: targetDomain },
              { slug: targetDomain },
            ],
            isActive: true,
          },
          select: { id: true, subdomain: true, slug: true },
        });

        if (!targetSchool || targetSchool.id !== tokenSchoolId) {
          return NextResponse.json(
            {
              error: "Cross-tenant security violation: This password recovery token belongs to a different school tenant.",
              code: "CROSS_TENANT_VIOLATION",
            },
            { status: 403 }
          );
        }
      }

      // Complete reset
      const resetResult = await completePasswordReset(activeRecoveryToken, newPassword, clientIp);
      if (!resetResult.success) {
        return NextResponse.json(
          { error: resetResult.error || "Failed to update password.", code: "RESET_FAILED" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Your password has been successfully reset. You may now sign in with your updated credentials.",
      });
    }

    // =========================================================================
    // CASE B: AUTHENTICATED SESSION PASSWORD CHANGE
    // =========================================================================
    let cookieToken: string | undefined = undefined;
    try {
      const cookieStore = await cookies();
      cookieToken =
        cookieStore.get(SESSION_COOKIE_NAME)?.value ||
        cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ||
        cookieStore.get("accessToken")?.value;
    } catch {}

    const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const token = cookieToken || authHeader || bodyToken;

    let userId = "";
    let schoolId: string | null = null;
    let role = "STAFF";
    let payload: any = null;

    if (token) {
      try {
        const verified = await jwtVerify(token, SECRET_KEY);
        payload = verified.payload;
        userId = (payload.userId || payload.sub || payload.id) as string;
        schoolId = (payload.schoolId || payload.tenantId || null) as string | null;
        role = (payload.role || payload.userRole || "STAFF") as string;
      } catch {
        return NextResponse.json(
          { error: "Your session has expired. Please sign in again.", code: "SESSION_EXPIRED" },
          { status: 401 }
        );
      }
    } else if (body.userId) {
      const user = await basePrisma.user.findUnique({ where: { id: body.userId } });
      if (user) {
        userId = user.id;
        schoolId = user.schoolId ?? null;
        role = user.role;
        if (user.role !== 'SUPER_ADMIN' && !schoolId) { throw new Error('schoolId required for non-super-admin'); }
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
        schoolId = user.schoolId ?? null;
        role = user.role;
        if (user.role !== 'SUPER_ADMIN' && !schoolId) { throw new Error('schoolId required for non-super-admin'); }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication session required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // =========================================================================
    // THE SUPER ADMIN "GOLDEN KEY" & TENANT SCOPE CHECK
    // =========================================================================
    const isSuperAdmin = Boolean(await basePrisma.superAdmin.findUnique({ where: { id: userId } }).catch(() => null));
    // Standard Users: Enforce strict tenant isolation against target domain
    if (targetDomain && !isSuperAdmin && schoolId) {
      const targetSchool = await basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: targetDomain },
            { slug: targetDomain },
          ],
          isActive: true,
        },
        select: { id: true, subdomain: true, slug: true },
      });

      if (!targetSchool || targetSchool.id !== schoolId) {
        return NextResponse.json(
          {
            error: "Cross-tenant security violation: You are not authorized to perform actions in this school domain.",
            code: "CROSS_TENANT_VIOLATION",
          },
          { status: 403 }
        );
      }
    }

    // Execute authoritative password change
    const result = await changeUserPassword({
      userId,
      schoolId: schoolId,
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

    // Issue updated session tokens with mustChangePassword = false
    const updatedPayload = {
      ...payload,
      mustChangePassword: false,
      role: isSuperAdmin ? "SUPER_ADMIN" : role,
      isSuperAdmin,
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
      schoolId: schoolId || "",
      role: isSuperAdmin ? "SUPER_ADMIN" : role,
      email: payload?.email || undefined,
      isSuperAdmin,
      mustChangePassword: false,
    });

    const { rawRefreshToken } = await issueRefreshToken({
      userId,
      schoolId: schoolId ?? null,
      ipAddress: clientIp,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully. Other active sessions have been securely terminated.",
      mustChangePassword: false,
      accessToken: newAccessToken,
      role: isSuperAdmin ? "SUPER_ADMIN" : role,
      schoolDomain: payload?.schoolDomain || targetDomain || undefined,
    });

    // Enforce absolute secure transport flags (HttpOnly, Secure, SameSite=Lax)
    const baseSecureCookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    };

    response.cookies.set(SESSION_COOKIE_NAME, newSessionToken, {
      ...baseSecureCookieOptions,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, newAccessToken, {
      ...baseSecureCookieOptions,
      maxAge: 15 * 60,
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, rawRefreshToken, {
      ...baseSecureCookieOptions,
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error("[AUTH_CHANGE_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while changing password.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
