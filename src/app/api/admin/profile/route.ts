import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { basePrisma } from "@/lib/tenant-prisma";
import { logAuditEvent } from "@/lib/audit-logger";
import { SESSION_COOKIE_NAME } from "@/lib/session-manager";
import { getSession, isSuperAdminUser } from "@/lib/auth";

const ACCESS_TOKEN_COOKIE_NAME = "accessToken";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getAuthenticatedSuperAdmin(req: Request) {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token =
      cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ||
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      cookieStore.get("accessToken")?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      cookieStore.get("__Secure-next-auth.session-token")?.value;
  } catch {}

  const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const effectiveToken = token || authHeader;

  let effectiveEmail: string | undefined;
  let effectiveUserId: string | undefined;
  let isSuper = false;

  if (effectiveToken) {
    try {
      const verified = await jwtVerify(effectiveToken, SECRET_KEY);
      const payload = verified.payload;
      const role = ((payload.role as string) || (payload.userRole as string) || "").toUpperCase();
      effectiveEmail = ((payload.email as string) || "").toLowerCase().trim();
      effectiveUserId = payload.userId as string | undefined;
      isSuper = Boolean(
        payload.isSuperAdmin ||
        role === "SUPER_ADMIN" ||
        effectiveEmail === "bonaventure.chinoso@gmail.com" ||
        effectiveEmail === "admin@bonaveeict.com.ng"
      );
    } catch {}
  }

  // Also check getSession() if not yet verified
  if (!isSuper) {
    try {
      const session = await getSession();
      if (session && isSuperAdminUser(session)) {
        isSuper = true;
        effectiveEmail = session.email?.toLowerCase().trim();
        effectiveUserId = session.userId;
      }
    } catch {}
  }

  // Target Super Admin email to search / initialize
  const targetEmail = effectiveEmail || "bonaventure.chinoso@gmail.com";

  // Check the SAME sources as the login flow:
  // 1. SuperAdmin table
  const superAdmin = await basePrisma.superAdmin.findFirst({
    where: {
      OR: [
        ...(effectiveUserId ? [{ id: effectiveUserId }] : []),
        { email: targetEmail },
        { email: "bonaventure.chinoso@gmail.com" },
        { email: "admin@bonaveeict.com.ng" },
      ],
    },
  });

  // 2. PlatformAdmin table
  const platformAdmin = await basePrisma.platformAdmin.findFirst({
    where: {
      OR: [
        ...(effectiveUserId ? [{ id: effectiveUserId }] : []),
        { email: targetEmail },
        { email: "bonaventure.chinoso@gmail.com" },
        { email: "admin@bonaveeict.com.ng" },
      ],
    },
  });

  // 3. Central User table
  const userSuperAdmin = await (basePrisma.user as any).findFirst({
    where: {
      email: { in: [targetEmail, "bonaventure.chinoso@gmail.com", "admin@bonaveeict.com.ng"], mode: "insensitive" },
      role: "SUPER_ADMIN",
      schoolId: null,
    },
  });

  let saRecord = superAdmin;
  let paRecord = platformAdmin;

  // One-time migration: If Super Admin is missing from DB, migrate initial password (bcrypt 12 rounds) to DB once
  if (!saRecord && !paRecord && !userSuperAdmin && isSuper) {
    const initialHash = await bcrypt.hash("Password1234", 12);
    const adminEmail = targetEmail === "admin@bonaveeict.com.ng" ? "admin@bonaveeict.com.ng" : "bonaventure.chinoso@gmail.com";

    paRecord = await basePrisma.platformAdmin.upsert({
      where: { email: adminEmail },
      update: { password: initialHash },
      create: {
        email: adminEmail,
        password: initialHash,
        twoFactorEnabled: false,
      },
    });

    saRecord = await basePrisma.superAdmin.upsert({
      where: { email: adminEmail },
      update: { passwordHash: initialHash },
      create: {
        email: adminEmail,
        passwordHash: initialHash,
      },
    });
  }

  const existingEmail = saRecord?.email || paRecord?.email || userSuperAdmin?.email || targetEmail;
  const existingId = paRecord?.id || saRecord?.id || userSuperAdmin?.id || effectiveUserId || "master-superadmin-001";
  const existingPassword = paRecord?.password || saRecord?.passwordHash || userSuperAdmin?.passwordHash || null;
  const twoFactorEnabled = paRecord?.twoFactorEnabled ?? false;
  const createdAt = paRecord?.createdAt || saRecord?.createdAt || new Date();

  // If found in any of the tables, return unified Super Admin entity
  if (saRecord || paRecord || userSuperAdmin) {
    return {
      id: existingId,
      email: existingEmail,
      password: existingPassword,
      twoFactorEnabled,
      createdAt,
      isInitialized: Boolean(existingPassword),
    };
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const admin = await getAuthenticatedSuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized access.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: admin.id,
        email: admin.email,
        role: "SUPER_ADMIN",
        twoFactorEnabled: admin.twoFactorEnabled,
        createdAt: admin.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to retrieve profile." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const oldPassword = body.oldPassword || body.currentPassword;
    const newPassword = body.newPassword;
    const confirmPassword = body.confirmPassword;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current password and new password are required." },
        { status: 400 }
      );
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "New password cannot be the same as your current password." },
        { status: 400 }
      );
    }

    const admin = await getAuthenticatedSuperAdmin(req);
    if (!admin || !admin.password) {
      return NextResponse.json(
        { error: "Unauthorized access or Super Admin account not found in database.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Authoritative verification of current password strictly against database hash
    const isOldPasswordValid = await bcrypt.compare(oldPassword, admin.password).catch(() => false);
    if (!isOldPasswordValid) {
      return NextResponse.json(
        { error: "Incorrect current/old password." },
        { status: 400 }
      );
    }

    // Hash new password with 12 salt rounds (NIST SP 800-63B compliant)
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    const targetEmail = admin.email; // Preserves exact super-admin email

    // Synchronize / Initialize PlatformAdmin (upsert initializes if missing, updates if exists)
    await basePrisma.platformAdmin.upsert({
      where: { email: targetEmail },
      update: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
      create: {
        email: targetEmail,
        password: hashedNewPassword,
        twoFactorEnabled: false,
      },
    });

    // Synchronize / Initialize SuperAdmin (upsert initializes if missing, updates if exists)
    await basePrisma.superAdmin.upsert({
      where: { email: targetEmail },
      update: {
        passwordHash: hashedNewPassword,
        updatedAt: new Date(),
      },
      create: {
        email: targetEmail,
        passwordHash: hashedNewPassword,
      },
    });

    // Also synchronize central User table if a Super Admin entry exists
    await (basePrisma.user as any).updateMany({
      where: {
        email: { equals: targetEmail, mode: "insensitive" },
        role: "SUPER_ADMIN",
        schoolId: null,
      },
      data: {
        passwordHash: hashedNewPassword,
        updatedAt: new Date(),
      },
    }).catch(() => {});

    // Invalidate sessions and refresh tokens
    await basePrisma.session.updateMany({
      where: { userId: admin.id },
      data: { isRevoked: true },
    }).catch(() => {});

    await basePrisma.refreshToken.updateMany({
      where: { userId: admin.id },
      data: { isRevoked: true },
    }).catch(() => {});

    // Authoritative Audit Log
    await logAuditEvent({
      actorId: admin.id,
      action: "SUPER_ADMIN_PASSWORD_CHANGE",
      target: admin.email,
      schoolId: null,
      ip: clientIp,
      metadata: {
        actor_email: admin.email,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Super Admin password updated successfully.",
      mustChangePassword: false,
    });
  } catch (error: any) {
    console.error("[SUPER_ADMIN_PROFILE_UPDATE_ERROR]:", error?.message || error);
    return NextResponse.json(
      { error: "An unexpected error occurred while updating Super Admin password." },
      { status: 500 }
    );
  }
}

export { POST as PUT, POST as PATCH };
