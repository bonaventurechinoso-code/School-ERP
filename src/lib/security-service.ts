import { basePrisma, getTenantClient } from "./tenant-prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logAuditEvent } from "./audit-logger";

export const BCRYPT_ROUNDS = 12;

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates password according to strict enterprise security rules:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 numeric digit
 * - At least 1 special character
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }

  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password cannot exceed 128 characters." };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

  if (!hasUppercase) {
    return { valid: false, error: "Password must contain at least 1 uppercase letter." };
  }

  if (!hasDigit) {
    return { valid: false, error: "Password must contain at least 1 numeric digit." };
  }

  if (!hasSpecial) {
    return { valid: false, error: "Password must contain at least 1 special character (e.g., !@#$%^&*)." };
  }

  return { valid: true };
}

/**
 * Computes SHA-256 hash of a string.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Hashes a plaintext password using bcrypt configured to exactly 12 computation rounds.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Ensures legacy persistence tables exist for backwards compatibility.
 */
export async function ensureSecurityTables(): Promise<void> {
  try {
    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bonavee_password_resets (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        email TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bonavee_user_security (
        user_id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        must_change_password BOOLEAN DEFAULT FALSE,
        is_temporary_password BOOLEAN DEFAULT FALSE,
        password_updated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (err) {
    // Graceful no-op
  }
}

/**
 * Checks if a user has the mustChangePassword flag set.
 */
export async function isMustChangePassword(userId: string): Promise<boolean> {
  try {
    // 1. Check User model (authoritative single auth table)
    const user = await basePrisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { staff: { id: userId } },
          { student: { id: userId } },
        ],
      },
      select: { mustChangePassword: true },
    });
    if (user?.mustChangePassword) return true;

    // 2. Legacy table fallback
    await ensureSecurityTables();
    const rows = await basePrisma.$queryRawUnsafe<Array<{ must_change_password: boolean; is_temporary_password?: boolean }>>(
      `SELECT must_change_password, is_temporary_password FROM bonavee_user_security WHERE user_id = $1 LIMIT 1`,
      userId
    );
    if (rows && rows.length > 0) {
      return Boolean(rows[0].must_change_password || rows[0].is_temporary_password);
    }
  } catch {}
  return false;
}

/**
 * Sets or updates the mustChangePassword flag for a user across models.
 */
export async function setUserMustChangePassword(userId: string, schoolId: string, mustChange: boolean): Promise<void> {
  try {
    // Update User model (authoritative single auth table)
    await basePrisma.user.updateMany({
      where: {
        OR: [
          { id: userId },
          { staff: { id: userId } },
          { student: { id: userId } },
        ],
      },
      data: { mustChangePassword: mustChange, updatedAt: new Date() },
    });

    // Update legacy table
    await ensureSecurityTables();
    await basePrisma.$executeRawUnsafe(`
      INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, is_temporary_password, password_updated_at)
      VALUES ($1, $2, $3, $3, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET must_change_password = $3, is_temporary_password = $3;
    `, userId, schoolId, mustChange);
  } catch (err) {
    console.error("[SECURITY_SERVICE] Error setting user must_change_password:", err);
  }
}

/**
 * Records that a user has successfully changed their password, clearing mustChangePassword.
 */
export async function recordPasswordChange(userId: string, schoolId: string): Promise<void> {
  await setUserMustChangePassword(userId, schoolId, false);
}

/**
 * Hardened Password Recovery: Generates a cryptographically secure token using crypto.randomBytes(32).
 * Saves ONLY the SHA-256 hash (tokenHash) to the PasswordResetToken table with a strict 15-minute expiration timestamp.
 * Returns the raw unhashed token to transmit via email.
 */
export async function createPasswordResetToken(params: {
  schoolId: string;
  email: string;
  userId: string;
  userType: "STAFF" | "STUDENT" | "PLATFORM_ADMIN" | "USER";
  expiresMinutes?: number;
  ip?: string;
}): Promise<string> {
  // Generate cryptographically secure 32-byte raw token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  // Strict 15-minute expiration timestamp
  const minutes = params.expiresMinutes || 15;
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  // Invalidate any existing unused reset tokens for this user in PasswordResetToken
  await basePrisma.passwordResetToken.deleteMany({
    where: { userId: params.userId },
  }).catch(() => {});

  // Persist strictly the SHA-256 hash in PasswordResetToken
  await basePrisma.passwordResetToken.create({
    data: {
      userId: params.userId,
      schoolId: params.schoolId,
      tokenHash,
      expiresAt,
    },
  });

  // Legacy sync
  await ensureSecurityTables();
  try {
    await basePrisma.$executeRawUnsafe(`
      UPDATE bonavee_password_resets 
      SET used_at = NOW() 
      WHERE school_id = $1 AND email = $2 AND used_at IS NULL;
    `, params.schoolId, params.email.toLowerCase().trim());

    await basePrisma.$executeRawUnsafe(`
      INSERT INTO bonavee_password_resets (id, school_id, email, user_id, user_type, token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7);
    `, crypto.randomUUID(), params.schoolId, params.email.toLowerCase().trim(), params.userId, params.userType, rawToken, expiresAt);
  } catch {}

  // Commit audit event
  await logAuditEvent({
    actorId: params.userId,
    action: "PASSWORD_RESET_REQUEST",
    target: params.email,
    schoolId: params.schoolId,
    ip: params.ip || "unknown",
  });

  // Return the raw unhashed token to be embedded in the recovery URL
  return rawToken;
}

/**
 * Verifies a password reset token by looking up its SHA-256 hash and validating 15-minute expiration.
 */
export async function verifyPasswordResetToken(rawToken: string, schoolDomain?: string): Promise<{
  valid: boolean;
  error?: string;
  schoolId?: string;
  userId?: string;
  userType?: string;
  email?: string;
}> {
  if (!rawToken || typeof rawToken !== "string") {
    return { valid: false, error: "Reset token is missing or invalid." };
  }

  const tokenHash = hashToken(rawToken.trim());
  const now = new Date();

  // 1. Look up by tokenHash in PasswordResetToken table
  const tokenRecord = await basePrisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { school: true },
  });

  if (tokenRecord) {
    if (tokenRecord.expiresAt < now) {
      // Token expired, delete row
      await basePrisma.passwordResetToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
      return { valid: false, error: "This recovery link has expired (15-minute validity exceeded). Please request a new link." };
    }

    // Verify schoolDomain match if provided (bypass for superadmin accounts)
    const isSuperAdminAccount =
      tokenRecord.schoolId === "global-saas" ||
      ["superadmin", "platform", "admin", "central"].includes((schoolDomain || "").toLowerCase().trim()) ||
      Boolean(await basePrisma.superAdmin.findUnique({ where: { id: tokenRecord.userId } }).catch(() => null)) ||
      Boolean(await basePrisma.platformAdmin.findUnique({ where: { id: tokenRecord.userId } }).catch(() => null));

    if (schoolDomain && tokenRecord.school && !isSuperAdminAccount) {
      const match =
        tokenRecord.school.subdomain.toLowerCase() === schoolDomain.toLowerCase() ||
        tokenRecord.school.slug?.toLowerCase() === schoolDomain.toLowerCase();
      if (!match) {
        return { valid: false, error: "This recovery token is not authorized for this school domain." };
      }
    }

    // Resolve email from user record
    let userEmail: string | undefined = undefined;
    const staff = await basePrisma.staff.findUnique({
      where: { id: tokenRecord.userId },
      select: { email: true },
    });
    if (staff) {
      userEmail = staff.email;
    } else {
      const student = await basePrisma.student.findUnique({
        where: { id: tokenRecord.userId },
        select: { email: true },
      });
      if (student) {
        userEmail = student.email || undefined;
      } else {
        const user = await basePrisma.user.findUnique({
          where: { id: tokenRecord.userId },
          select: { email: true },
        });
        if (user) {
          userEmail = user.email;
        } else {
          const superAdmin = await basePrisma.superAdmin.findUnique({
            where: { id: tokenRecord.userId },
            select: { email: true },
          });
          if (superAdmin) {
            userEmail = superAdmin.email;
          } else {
            const platformAdmin = await basePrisma.platformAdmin.findUnique({
              where: { id: tokenRecord.userId },
              select: { email: true },
            });
            if (platformAdmin) userEmail = platformAdmin.email;
          }
        }
      }
    }

    return {
      valid: true,
      schoolId: tokenRecord.schoolId,
      userId: tokenRecord.userId,
      email: userEmail,
    };
  }

  // 2. Fallback check legacy table
  await ensureSecurityTables();
  try {
    const rows = await basePrisma.$queryRawUnsafe<Array<{
      id: string;
      school_id: string;
      email: string;
      user_id: string;
      user_type: string;
      expires_at: Date;
      used_at: Date | null;
    }>>(
      `SELECT * FROM bonavee_password_resets WHERE token = $1 LIMIT 1`,
      rawToken.trim()
    );

    if (rows && rows.length > 0) {
      const record = rows[0];
      if (record.used_at) {
        return { valid: false, error: "This password recovery link has already been used. Please request a new one." };
      }
      if (new Date(record.expires_at) < now) {
        return { valid: false, error: "This recovery link has expired. Please request a new reset link." };
      }
      return {
        valid: true,
        schoolId: record.school_id,
        userId: record.user_id,
        userType: record.user_type,
        email: record.email,
      };
    }
  } catch {}

  return { valid: false, error: "Invalid or unrecognized recovery token." };
}

/**
 * Completes a password recovery submission:
 * Validates tokenHash, verifies 15-minute expiration, updates password with bcrypt (12 rounds),
 * invalidates all active sessions/refresh tokens for that user,
 * immediately purges the token row from the database (single-use constraint),
 * and commits an event to the AuditLog.
 */
export async function completePasswordReset(
  rawToken: string,
  newPassword: string,
  ip?: string
): Promise<{
  success: boolean;
  error?: string;
  email?: string;
}> {
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const tokenCheck = await verifyPasswordResetToken(rawToken);
  if (!tokenCheck.valid || !tokenCheck.userId || !tokenCheck.schoolId) {
    return { success: false, error: tokenCheck.error || "Invalid or expired recovery token." };
  }

  const tokenHash = hashToken(rawToken.trim());
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  try {
    // 1. Update User table (authoritative single auth table)
    await basePrisma.user.updateMany({
      where: {
        OR: [
          { id: tokenCheck.userId },
          { staff: { id: tokenCheck.userId } },
          { student: { id: tokenCheck.userId } },
        ],
      },
      data: { passwordHash: hashedPassword, mustChangePassword: false, updatedAt: new Date() },
    });

    // 4. Update PlatformAdmin / SuperAdmin if matching
    await basePrisma.platformAdmin.updateMany({
      where: { id: tokenCheck.userId },
      data: { password: hashedPassword },
    });
    await basePrisma.superAdmin.updateMany({
      where: { id: tokenCheck.userId },
      data: { passwordHash: hashedPassword },
    });

    // 5. Invalidate all active sessions and refresh tokens for this user
    await basePrisma.session.updateMany({
      where: { userId: tokenCheck.userId },
      data: { isRevoked: true },
    });
    await basePrisma.refreshToken.updateMany({
      where: { userId: tokenCheck.userId },
      data: { isRevoked: true },
    });

    // 6. IMMEDIATELY PURGE the token row from the database (single-use constraint)
    await basePrisma.passwordResetToken.deleteMany({
      where: { tokenHash },
    });

    // Update legacy used_at
    await basePrisma.$executeRawUnsafe(`
      UPDATE bonavee_password_resets SET used_at = NOW() WHERE token = $1;
    `, rawToken.trim()).catch(() => {});

    await recordPasswordChange(tokenCheck.userId, tokenCheck.schoolId);

    // 7. Commit event to AuditLog
    await logAuditEvent({
      actorId: tokenCheck.userId,
      action: "PASSWORD_RESET_SUCCESS",
      target: tokenCheck.userId,
      schoolId: tokenCheck.schoolId,
      ip: ip || "unknown",
      metadata: { method: "recovery_token", timestamp: new Date().toISOString() },
    });

    return { success: true, email: tokenCheck.email };
  } catch (err: any) {
    console.error("[SECURITY_SERVICE] Error executing password recovery update:", err);
    return { success: false, error: "Failed to update password. Please try again." };
  }
}

/**
 * Changes a user's password from their Security Settings view.
 * Requirements:
 * 1. Require oldPassword, verify via hash comparison
 * 2. Enforce strong complexity rules (min 8 chars, 1 uppercase, 1 digit, 1 special character)
 * 3. Save new hash using bcrypt (12 rounds)
 * 4. Invalidate all active refresh token rows and sessions for that specific user
 * 5. Commit event to AuditLog
 */
export async function changeUserPassword(params: {
  userId: string;
  schoolId: string;
  role: string;
  currentPassword?: string;
  oldPassword?: string;
  newPassword: string;
  confirmPassword?: string;
  ip?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, schoolId, role, newPassword, confirmPassword, ip } = params;
  const oldPassword = params.oldPassword || params.currentPassword || "";

  if (!oldPassword) {
    return { success: false, error: "Old/current password is required." };
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return { success: false, error: "New password and Confirm Password do not match." };
  }

  if (oldPassword === newPassword) {
    return { success: false, error: "New password cannot be the same as your current password." };
  }

  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const canonicalRole = (role || "").toUpperCase();
  let verified = false;

  // 1. Verify credentials against User table (Authoritative single auth table)
  let user = await basePrisma.user.findFirst({
    where: {
      OR: [
        { id: userId },
        { staff: { id: userId } },
        { student: { id: userId } },
      ],
    },
  });

  if (user && user.passwordHash) {
    verified = await bcrypt.compare(oldPassword, user.passwordHash).catch(() => false);
  }

  // Fallback for Super Admin
  if (!verified && canonicalRole === "SUPER_ADMIN") {
    const superAdmin = await basePrisma.superAdmin.findUnique({ where: { id: userId } });
    if (superAdmin && superAdmin.passwordHash) {
      verified = await bcrypt.compare(oldPassword, superAdmin.passwordHash).catch(() => false);
    }
    const platAdmin = await basePrisma.platformAdmin.findUnique({ where: { id: userId } });
    if (!verified && platAdmin && platAdmin.password) {
      verified = await bcrypt.compare(oldPassword, platAdmin.password).catch(() => false);
    }
  }

  if (!verified) {
    return { success: false, error: "Incorrect current/old password." };
  }

  // 2. Hash new password with 12 computation rounds
  const newHashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // 3. Save new hash in User table (authoritative single auth table)
  if (user) {
    await basePrisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHashed,
        mustChangePassword: false,
        updatedAt: new Date(),
      },
    });
  } else {
    await basePrisma.user.updateMany({
      where: {
        OR: [
          { id: userId },
          { staff: { id: userId } },
          { student: { id: userId } },
        ],
      },
      data: {
        passwordHash: newHashed,
        mustChangePassword: false,
        updatedAt: new Date(),
      },
    });
  }

  if (canonicalRole === "SUPER_ADMIN") {
    await basePrisma.superAdmin.updateMany({
      where: { id: userId },
      data: { passwordHash: newHashed },
    });
    await basePrisma.platformAdmin.updateMany({
      where: { id: userId },
      data: { password: newHashed },
    });
  }

  await recordPasswordChange(user?.id || userId, schoolId);

  // 4. Invalidate all active refresh token rows and sessions for that specific user
  await basePrisma.refreshToken.updateMany({
    where: { userId },
    data: { isRevoked: true },
  });
  await basePrisma.session.updateMany({
    where: { userId },
    data: { isRevoked: true },
  });

  // 5. Commit event to the AuditLog
  await logAuditEvent({
    actorId: userId,
    action: "PASSWORD_CHANGE",
    target: userId,
    schoolId: schoolId,
    ip: ip || "unknown",
    metadata: {
      role: canonicalRole,
      timestamp: new Date().toISOString(),
      invalidatedSessions: true,
    },
  });

  return { success: true };
}
