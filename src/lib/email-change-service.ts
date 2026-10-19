import crypto from "crypto";
import bcrypt from "bcryptjs";
import { basePrisma } from "./tenant-prisma";
import * as mailService from "./mail";
import { logAuditEvent } from "./audit-logger";
import { revokeAllUserSessions } from "./session-manager";

// Maximum failed OTP attempts before temporary lockout
const MAX_FAILED_ATTEMPTS = 3;
// Lockout duration after 3 failed attempts: 30 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;
// OTP expiration: 15 minutes
const OTP_EXPIRATION_MS = 15 * 60 * 1000;
// Maximum email change requests per hour
const MAX_REQUESTS_PER_HOUR = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export interface PendingEmailChange {
  id: string;
  userId: string;
  schoolId: string | null;
  userRole: string;
  currentEmail: string;
  newEmail: string;
  otpHash: string;
  attempts: number;
  lockedUntil: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

// In-memory state for rate-limiting and fast resilient fallback
const rateLimitMap = new Map<string, number[]>(); // userId -> timestamps
const pendingChangesMap = new Map<string, PendingEmailChange>(); // userId -> pending change

let tableInitialized = false;

/**
 * Ensures the backing database table exists for persistent OTP state across processes.
 */
export async function ensureEmailChangeTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS email_change_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        school_id TEXT,
        user_role TEXT NOT NULL,
        current_email TEXT NOT NULL,
        new_email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        attempts INT DEFAULT 0,
        locked_until TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await basePrisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_email_change_user ON email_change_requests(user_id)
    `);
    tableInitialized = true;
  } catch (err: any) {
    // Fail-safe: In-memory store continues functioning even if DDL execution is constrained
    console.warn("[EMAIL_CHANGE] DB table initialization notice:", err?.message || err);
  }
}

/**
 * Computes a secure hash of the 6-digit OTP with a user-specific salt.
 */
function hashOtp(otp: string, userId: string): string {
  const secret = process.env.JWT_SECRET_KEY || "schoolerp-email-otp-salt";
  return crypto.createHash("sha256").update(`${otp}:${userId}:${secret}`).digest("hex");
}

/**
 * Validates email format.
 */
export function isValidEmailFormat(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return typeof email === "string" && email.length >= 5 && email.length <= 254 && re.test(email);
}

/**
 * Request an email change:
 * 1. Validates current password via BCrypt
 * 2. Validates format and checks uniqueness
 * 3. Enforces max 3 requests per hour
 * 4. Generates 6-digit OTP, stores hashed (15 min expiry)
 * 5. Sends OTP to NEW email only
 */
export async function requestEmailChange(params: {
  userId: string;
  currentEmail: string;
  newEmail: string;
  currentPassword: string;
  clientIp?: string;
  userRole: string;
  schoolId?: string | null;
}): Promise<{ success: boolean; message: string; code?: string }> {
  await ensureEmailChangeTable();

  const { userId, currentEmail, newEmail: rawNewEmail, currentPassword, clientIp, userRole, schoolId } = params;

  // 1. Normalize and format check
  const normalizedNewEmail = (rawNewEmail || "").trim().toLowerCase();
  const normalizedCurrentEmail = (currentEmail || "").trim().toLowerCase();

  if (!isValidEmailFormat(normalizedNewEmail)) {
    return { success: false, message: "Please provide a valid email address.", code: "INVALID_EMAIL" };
  }

  if (normalizedNewEmail === normalizedCurrentEmail) {
    return {
      success: false,
      message: "The new email address cannot be the same as your current email.",
      code: "SAME_EMAIL",
    };
  }

  // 2. Check rate limit: Max 3 requests per hour per user
  const now = Date.now();
  const userTimestamps = (rateLimitMap.get(userId) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (userTimestamps.length >= MAX_REQUESTS_PER_HOUR) {
    const oldest = userTimestamps[0];
    const waitMinutes = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / (60 * 1000));
    return {
      success: false,
      message: `You have reached the maximum of ${MAX_REQUESTS_PER_HOUR} email change requests per hour. Please wait ${waitMinutes} minute(s) before trying again.`,
      code: "RATE_LIMIT_EXCEEDED",
    };
  }

  // 3. Authenticate current password against database
  let passwordValid = false;
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  // Check central/tenant User table first
  const user = await basePrisma.user.findFirst({
    where: { id: userId },
  });
  if (user && user.passwordHash) {
    passwordValid = await bcrypt.compare(currentPassword, user.passwordHash).catch(() => false);
  }

  // If not validated and user is Super Admin, check SuperAdmin / PlatformAdmin tables
  if (!passwordValid && isSuperAdmin) {
    const sa = await basePrisma.superAdmin.findFirst({
      where: {
        OR: [{ id: userId }, { email: normalizedCurrentEmail }],
      },
    });
    const pa = await basePrisma.platformAdmin.findFirst({
      where: {
        OR: [{ id: userId }, { email: normalizedCurrentEmail }],
      },
    });
    const targetHash = sa?.passwordHash || pa?.password;
    if (targetHash) {
      passwordValid = await bcrypt.compare(currentPassword, targetHash).catch(() => false);
    }
  }

  if (!passwordValid) {
    await logAuditEvent({
      actorId: userId,
      action: "EMAIL_CHANGE_PASSWORD_MISMATCH",
      target: normalizedNewEmail,
      schoolId: schoolId || null,
      ip: clientIp || "unknown",
      metadata: { attemptedEmail: normalizedNewEmail },
    });
    return {
      success: false,
      message: "Incorrect current password. Please verify your credentials.",
      code: "INCORRECT_PASSWORD",
    };
  }

  // 4. Ensure new email is not already in use
  if (isSuperAdmin) {
    const existingSA = await basePrisma.superAdmin.findUnique({ where: { email: normalizedNewEmail } });
    const existingPA = await basePrisma.platformAdmin.findUnique({ where: { email: normalizedNewEmail } });
    const existingUser = await basePrisma.user.findFirst({
      where: {
        email: { equals: normalizedNewEmail, mode: "insensitive" },
        role: "SUPER_ADMIN",
      },
    });
    if (existingSA || existingPA || existingUser) {
      return {
        success: false,
        message: "This email address is already assigned to a Super-Admin account.",
        code: "EMAIL_IN_USE",
      };
    }
  } else {
    // Check within tenant
    const existingUser = await basePrisma.user.findFirst({
      where: {
        email: { equals: normalizedNewEmail, mode: "insensitive" },
        ...(schoolId ? { schoolId } : {}),
      },
    });
    if (existingUser) {
      return {
        success: false,
        message: "This email address is already registered to another account in this school.",
        code: "EMAIL_IN_USE",
      };
    }
  }

  // 5. Generate secure 6-digit OTP
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const hashedOtp = hashOtp(rawOtp, userId);
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

  // Store in DB & memory
  const pendingRecord: PendingEmailChange = {
    id: crypto.randomUUID(),
    userId,
    schoolId: schoolId || null,
    userRole,
    currentEmail: normalizedCurrentEmail,
    newEmail: normalizedNewEmail,
    otpHash: hashedOtp,
    attempts: 0,
    lockedUntil: null,
    expiresAt,
    createdAt: new Date(),
  };

  pendingChangesMap.set(userId, pendingRecord);

  try {
    await basePrisma.$executeRawUnsafe(`
      INSERT INTO email_change_requests (
        id, user_id, school_id, user_role, current_email, new_email,
        otp_hash, attempts, locked_until, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        new_email = EXCLUDED.new_email,
        otp_hash = EXCLUDED.otp_hash,
        attempts = 0,
        locked_until = NULL,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
    `, pendingRecord.id, userId, schoolId || null, userRole, normalizedCurrentEmail, normalizedNewEmail, hashedOtp, 0, null, expiresAt);
  } catch (dbErr: any) {
    console.warn("[EMAIL_CHANGE] DB store fallback to memory:", dbErr?.message || dbErr);
  }

  // Record rate limit timestamp
  userTimestamps.push(now);
  rateLimitMap.set(userId, userTimestamps);

  // 6. Send OTP to NEW email only
  const isLocalDev = process.env.NODE_ENV !== "production";
  if (isLocalDev) {
    console.log("================================================================");
    console.log(`[EMAIL_CHANGE_OTP] Local Dev Simulated Code for ${normalizedNewEmail}:`);
    console.log(`>>> OTP: ${rawOtp} <<< (Expires in 15 minutes)`);
    console.log("================================================================");
  }

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Email Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #4f46e5; padding: 28px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
        .content { padding: 32px 28px; line-height: 1.6; }
        .code-box { background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1; }
        .code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; }
        .notice { font-size: 13px; color: #64748b; background: #f8fafc; border-left: 3px solid #4f46e5; padding: 12px; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px 28px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Security Desk • Email Change Verification</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>You have requested to change your account email address to <strong>${normalizedNewEmail}</strong>.</p>
          <p>Please enter the 6-digit one-time verification code below to confirm this change:</p>
          
          <div class="code-box">
            <div class="code">${rawOtp}</div>
          </div>

          <div class="notice">
            <strong>Security Notice:</strong> This code is strictly confidential and will automatically expire in <strong>15 minutes</strong>. If you did not initiate this request, no changes will be made to your account.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} School ERP Security Platform. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `.trim();

  // Send via centralized mail service (Resend in production) with verified sender
  const VERIFIED_SYSTEM_FROM = "noreply@bonaveeict.com.ng";
  let mailResult;
  try {
    mailResult = await mailService.sendMail({
      to: normalizedNewEmail,
      from: VERIFIED_SYSTEM_FROM,
      subject: `[Security Code] ${rawOtp} is your email change verification code`,
      html: emailHtml,
      schoolId: schoolId || undefined,
      recipientType: "STAFF",
      logCategory: "EMAIL_CHANGE_OTP",
    });
  } catch (mailErr: any) {
    console.error("[EMAIL_CHANGE] Failed to dispatch OTP email:", mailErr?.message || mailErr);
    mailResult = {
      success: false,
      deliveryStatus: "FAILED_EXCEPTION",
      error: mailErr?.message || "Email dispatch exception",
      provider: "NONE" as const,
      recipients: [normalizedNewEmail],
    };
  }

  // Critical: Require actual live provider delivery (RESEND or SMTP).
  // Disallow and bypass SIMULATED_DEV fallback from returning a false positive "delivered" status.
  const isSimulated = mailResult?.provider === "SIMULATED" || mailResult?.deliveryStatus === "SIMULATED_DEV";
  const isActualDeliverySuccess = Boolean(
    mailResult?.success && !isSimulated && (mailResult.provider === "RESEND" || mailResult.provider === "SMTP")
  );

  if (!isActualDeliverySuccess) {
    const errorDetail = isSimulated
      ? "Real email dispatch was bypassed (SIMULATED_DEV). A live transactional email provider (RESEND_API_KEY or SMTP credentials) is required to deliver verification codes to real inboxes."
      : mailResult?.error || mailResult?.deliveryStatus || "Email provider dispatch failed";
    console.error(`[EMAIL_CHANGE] ❌ Failed to dispatch verification email to ${normalizedNewEmail}:`, errorDetail);

    // Rollback DB record and in-memory pending record
    pendingChangesMap.delete(userId);
    try {
      await basePrisma.$executeRawUnsafe(
        `DELETE FROM email_change_requests WHERE user_id = $1`,
        userId
      );
    } catch {}

    // Rollback rate limit timestamp so infrastructure failure does not consume user's rate limit
    const currentTimestamps = rateLimitMap.get(userId) || [];
    const idx = currentTimestamps.lastIndexOf(now);
    if (idx !== -1) {
      currentTimestamps.splice(idx, 1);
      rateLimitMap.set(userId, currentTimestamps);
    }

    return {
      success: false,
      message: `Failed to deliver verification code to ${normalizedNewEmail}: ${errorDetail}. Please check your email configuration or contact support.`,
      code: "DELIVERY_FAILED",
    };
  }

  await logAuditEvent({
    actorId: userId,
    action: "EMAIL_CHANGE_REQUESTED",
    target: normalizedNewEmail,
    schoolId: schoolId || null,
    ip: clientIp || "unknown",
    metadata: { currentEmail: normalizedCurrentEmail, newEmail: normalizedNewEmail },
  });

  return {
    success: true,
    message: `Verification code sent to ${normalizedNewEmail}. It will expire in 15 minutes.`,
  };
}

/**
 * Confirm OTP and finalize email update:
 * 1. Checks lockout (3 failed attempts -> 30 min lock)
 * 2. Verifies 15-minute expiration
 * 3. Compares hashed OTP
 * 4. On success:
 *    - Updates database email (SuperAdmin/PlatformAdmin/User)
 *    - Logs to AuditLog table (IP, old email, new email)
 *    - Sends confirmation email to BOTH old and new addresses
 *    - Revokes all other sessions via revokeAllUserSessions(userId)
 */
export async function confirmEmailChange(params: {
  userId: string;
  otp: string;
  clientIp?: string;
}): Promise<{
  success: boolean;
  message: string;
  code?: string;
  newEmail?: string;
}> {
  await ensureEmailChangeTable();

  const { userId, otp: rawOtp, clientIp } = params;
  const inputOtp = (rawOtp || "").trim();

  if (!inputOtp || inputOtp.length !== 6) {
    return { success: false, message: "Please enter a valid 6-digit code.", code: "INVALID_OTP_FORMAT" };
  }

  // 1. Fetch pending record from memory or DB
  let pending = pendingChangesMap.get(userId);

  if (!pending) {
    try {
      const rows: any[] = await basePrisma.$queryRawUnsafe(`
        SELECT * FROM email_change_requests WHERE user_id = $1 LIMIT 1;
      `, userId);
      if (rows && rows.length > 0) {
        const row = rows[0];
        pending = {
          id: row.id,
          userId: row.user_id,
          schoolId: row.school_id,
          userRole: row.user_role,
          currentEmail: row.current_email,
          newEmail: row.new_email,
          otpHash: row.otp_hash,
          attempts: Number(row.attempts || 0),
          lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
          expiresAt: new Date(row.expires_at),
          createdAt: new Date(row.created_at),
        };
      }
    } catch (err: any) {
      console.warn("[EMAIL_CHANGE] DB query fallback:", err?.message || err);
    }
  }

  if (!pending) {
    return {
      success: false,
      message: "No pending email change request found or it has expired. Please initiate a new request.",
      code: "NO_PENDING_REQUEST",
    };
  }

  const now = new Date();

  // 2. Check Lockout Status: Lock after 3 failed attempts for 30 minutes
  if (pending.lockedUntil && pending.lockedUntil > now) {
    const remainingMinutes = Math.ceil((pending.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
    return {
      success: false,
      message: `Account verification temporarily locked due to 3 failed attempts. Please try again in ${remainingMinutes} minute(s).`,
      code: "VERIFICATION_LOCKED",
    };
  }

  // 3. Check Expiration: Expires in 15 minutes
  if (now > pending.expiresAt) {
    pendingChangesMap.delete(userId);
    try {
      await basePrisma.$executeRawUnsafe(`DELETE FROM email_change_requests WHERE user_id = $1`, userId);
    } catch {}
    return {
      success: false,
      message: "The verification code has expired. Please request a new code.",
      code: "OTP_EXPIRED",
    };
  }

  // 4. Verify OTP Hash
  const computedHash = hashOtp(inputOtp, userId);
  const isMatch = crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(pending.otpHash, "hex"));

  if (!isMatch) {
    const updatedAttempts = (pending.attempts || 0) + 1;
    let lockedUntil: Date | null = null;

    if (updatedAttempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    pending.attempts = updatedAttempts;
    pending.lockedUntil = lockedUntil;
    pendingChangesMap.set(userId, pending);

    try {
      await basePrisma.$executeRawUnsafe(`
        UPDATE email_change_requests
        SET attempts = $1, locked_until = $2, updated_at = NOW()
        WHERE user_id = $3
      `, updatedAttempts, lockedUntil, userId);
    } catch {}

    await logAuditEvent({
      actorId: userId,
      action: "EMAIL_CHANGE_OTP_FAILED",
      target: pending.newEmail,
      schoolId: pending.schoolId || null,
      ip: clientIp || "unknown",
      metadata: { attempts: updatedAttempts, isLocked: Boolean(lockedUntil) },
    });

    if (lockedUntil) {
      return {
        success: false,
        message: "You have failed 3 verification attempts. This verification is locked for 30 minutes.",
        code: "VERIFICATION_LOCKED",
      };
    }

    const remaining = MAX_FAILED_ATTEMPTS - updatedAttempts;
    return {
      success: false,
      message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      code: "INVALID_OTP",
    };
  }

  // 5. OTP Match! Update Email in authoritative tables transactionally with strict re-read verification
  const { newEmail, currentEmail, userRole, schoolId } = pending;
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  try {
    await basePrisma.$transaction(async (tx) => {
      // 1. Check if user exists in User table (authoritative table for tenant admins, staff, students, parents, and platform users)
      const userRecord = await tx.user.findUnique({
        where: { id: userId },
      });

      if (userRecord) {
        // Update User strictly where: { id: userId } - not by role, not by email string
        await tx.user.update({
          where: { id: userId },
          data: { email: newEmail, updatedAt: new Date() },
        });

        // Immediate re-read & verify email === newEmail (case-insensitive)
        const reReadUser = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });

        if (!reReadUser || reReadUser.email.trim().toLowerCase() !== newEmail.trim().toLowerCase()) {
          throw new Error(`DATABASE_VERIFICATION_FAILED: Re-read email "${reReadUser?.email}" does not match requested email "${newEmail}"`);
        }
      } else if (isSuperAdmin) {
        // Super Admin existing exclusively in PlatformAdmin or SuperAdmin table
        const paUpdated = await tx.platformAdmin.updateMany({
          where: { OR: [{ id: userId }, { email: currentEmail }] },
          data: { email: newEmail, updatedAt: new Date() },
        });
        const saUpdated = await tx.superAdmin.updateMany({
          where: { OR: [{ id: userId }, { email: currentEmail }] },
          data: { email: newEmail, updatedAt: new Date() },
        });

        if (paUpdated.count === 0 && saUpdated.count === 0) {
          throw new Error("DATABASE_VERIFICATION_FAILED: SuperAdmin/PlatformAdmin record not found for update.");
        }
      } else {
        throw new Error(`DATABASE_VERIFICATION_FAILED: User record with ID "${userId}" not found in database.`);
      }

      // 2. If user is also SuperAdmin, synchronize PlatformAdmin and SuperAdmin tables
      if (isSuperAdmin) {
        await tx.platformAdmin.updateMany({
          where: { OR: [{ id: userId }, { email: currentEmail }] },
          data: { email: newEmail, updatedAt: new Date() },
        });
        await tx.superAdmin.updateMany({
          where: { OR: [{ id: userId }, { email: currentEmail }] },
          data: { email: newEmail, updatedAt: new Date() },
        });
      }

      // 3. Synchronize linked staff, student, or parent records if present
      await tx.staff.updateMany({
        where: { userId },
        data: { email: newEmail, updatedAt: new Date() },
      });

      await tx.student.updateMany({
        where: { userId },
        data: { email: newEmail },
      });

      if (schoolId) {
        await tx.parent.updateMany({
          where: { email: currentEmail, schoolId },
          data: { email: newEmail },
        });
      }
    });
  } catch (txErr: any) {
    console.error("[EMAIL_CHANGE_TRANSACTION_FAILED]", txErr?.message || txErr);
    // If verification fails: transaction rolls back, log EMAIL_CHANGE_FAILED, send NO email, revoke NO sessions, return error
    await logAuditEvent({
      actorId: userId,
      action: "EMAIL_CHANGE_FAILED",
      target: newEmail,
      schoolId: schoolId || null,
      ip: clientIp || "unknown",
      metadata: {
        oldEmail: currentEmail,
        attemptedNewEmail: newEmail,
        error: txErr?.message || String(txErr),
      },
    });

    return {
      success: false,
      message: "Database verification failed: unable to apply email change. No modifications were made.",
      code: "DATABASE_VERIFICATION_FAILED",
    };
  }

  // 6. Audit Trail Logging
  await logAuditEvent({
    actorId: userId,
    action: "EMAIL_CHANGE_SUCCESS",
    target: newEmail,
    schoolId: schoolId || null,
    ip: clientIp || "unknown",
    metadata: {
      oldEmail: currentEmail,
      newEmail: newEmail,
      userRole,
    },
  });

  // 7. Send confirmation email to BOTH old and new addresses
  const confirmationOldHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Security Alert: Email Changed</title></head>
    <body style="font-family:sans-serif; background:#f8fafc; padding:32px 16px; color:#1e293b;">
      <div style="max-width:540px; margin:0 auto; background:#fff; border-radius:12px; border:1px solid #e2e8f0; padding:28px;">
        <h2 style="color:#0f172a; margin-top:0;">Account Email Changed</h2>
        <p>This is a security notification that the login email address for your account has been changed from <strong>${currentEmail}</strong> to <strong>${newEmail}</strong>.</p>
        <p>If you made this change, no further action is required.</p>
        <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:12px; border-radius:6px; font-size:13px; color:#991b1b; margin:20px 0;">
          <strong>Didn't make this change?</strong> Please contact institutional support immediately to secure your account.
        </div>
        <p style="font-size:12px; color:#94a3b8; margin-bottom:0;">Automated security notification • ${new Date().toUTCString()}</p>
      </div>
    </body>
    </html>
  `.trim();

  const confirmationNewHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Email Address Confirmed</title></head>
    <body style="font-family:sans-serif; background:#f8fafc; padding:32px 16px; color:#1e293b;">
      <div style="max-width:540px; margin:0 auto; background:#fff; border-radius:12px; border:1px solid #e2e8f0; padding:28px;">
        <h2 style="color:#0f172a; margin-top:0;">Email Successfully Updated</h2>
        <p>Your account email address has been successfully updated to <strong>${newEmail}</strong>.</p>
        <p>All active sessions have been invalidated for security. Please sign in with your new email address to continue.</p>
        <p style="font-size:12px; color:#94a3b8; margin-bottom:0;">School ERP Platform Security Desk • ${new Date().toUTCString()}</p>
      </div>
    </body>
    </html>
  `.trim();

  try {
    const VERIFIED_SYSTEM_FROM = "noreply@bonaveeict.com.ng";
    await Promise.allSettled([
      mailService.sendMail({
        to: currentEmail,
        from: VERIFIED_SYSTEM_FROM,
        subject: "[Security Alert] Your account email address was changed",
        html: confirmationOldHtml,
        schoolId: schoolId || undefined,
        recipientType: "STAFF",
        logCategory: "EMAIL_CHANGE_CONFIRM_OLD",
      }),
      mailService.sendMail({
        to: newEmail,
        from: VERIFIED_SYSTEM_FROM,
        subject: "[Confirmation] Your account email address has been updated",
        html: confirmationNewHtml,
        schoolId: schoolId || undefined,
        recipientType: "STAFF",
        logCategory: "EMAIL_CHANGE_CONFIRM_NEW",
      }),
    ]);
  } catch (notifyErr) {
    console.warn("[EMAIL_CHANGE] Dual confirmation dispatch notice:", notifyErr);
  }

  // 8. Revoke all active sessions to force re-login
  try {
    await revokeAllUserSessions(userId);
  } catch (revokeErr) {
    console.warn("[EMAIL_CHANGE] Session revocation notice:", revokeErr);
  }

  // 9. Cleanup pending record
  pendingChangesMap.delete(userId);
  try {
    await basePrisma.$executeRawUnsafe(`DELETE FROM email_change_requests WHERE user_id = $1`, userId);
  } catch {}

  return {
    success: true,
    message: "Email changed successfully! All other sessions have been logged out. Please sign in with your new email.",
    newEmail,
  };
}
