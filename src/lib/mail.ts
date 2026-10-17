import { Resend } from "resend";
import { basePrisma } from "./tenant-prisma";
import fs from "fs";
import path from "path";

/**
 * ============================================================================
 * UNIFIED BACKEND EMAIL SYNCHRONIZATION SERVICE
 * ============================================================================
 * Central transactional email dispatch layer backed by the official Resend SDK,
 * with resilient SMTP failover, database MessageLog synchronization, and
 * explicit [EMAIL_SYNC_ERROR] logging.
 */

// Initialize Resend Client
export function getResendClient(): Resend | null {
  const apiKey = (process.env.RESEND_API_KEY || process.env.RESEND_KEY || "").trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}
export const resend = getResendClient();

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  schoolId?: string;
  recipientType?: "ADMIN" | "STUDENT" | "PARENT" | "STAFF";
  logCategory?: string;
  attachments?: EmailAttachment[];
  throwOnError?: boolean;
}

export interface MailDispatchResult {
  success: boolean;
  deliveryStatus: string;
  provider: "RESEND" | "SMTP" | "SIMULATED" | "NONE";
  messageId?: string;
  recipients: string[];
  error?: string;
}

/**
 * Resolves current mail configuration from environment variables.
 */
export function getMailConfig() {
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();

  // SMTP Settings
  const host = (process.env.SMTP_HOST || process.env.MAIL_HOST || "").trim();
  const port = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || "587", 10);
  const user = (process.env.SMTP_USER || process.env.MAIL_USERNAME || process.env.MAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || "").trim();
  const secureEnv = (process.env.SMTP_SECURE || process.env.MAIL_SECURE || "").trim().toLowerCase();
  const secure = secureEnv === "true" || secureEnv === "ssl" || port === 465;

  let smtpConfig: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } } | undefined = undefined;
  if (host && user && pass) {
    smtpConfig = { host, port, secure, auth: { user, pass } };
  }

  const fromName = (process.env.EMAIL_FROM_NAME || process.env.MAIL_FROM_NAME || "School ERP").trim();
  const rawFrom = (process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_FROM || "").trim();

  let fullFrom: string;
  let fromEmail: string;

  if (rawFrom) {
    const match = rawFrom.match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      const parsedName = match[1].trim() || fromName;
      fromEmail = match[2].trim();
      fullFrom = `${parsedName} <${fromEmail}>`;
    } else {
      fromEmail = rawFrom;
      fullFrom = `${fromName} <${fromEmail}>`;
    }
  } else if (resendApiKey) {
    // Primary verified system address registered under Resend account
    fromEmail = "noreply@bonaveeict.com.ng";
    fullFrom = `${fromName} <${fromEmail}>`;
  } else if (user && user.includes("@")) {
    fromEmail = user;
    fullFrom = `${fromName} <${fromEmail}>`;
  } else {
    fromEmail = "noreply@bonaveeict.com.ng";
    fullFrom = `${fromName} <${fromEmail}>`;
  }

  return {
    resendApiKey,
    smtpConfig,
    fromEmail,
    fromName,
    fullFrom,
    isConfigured: Boolean(resendApiKey || smtpConfig),
  };
}

/**
 * Universal email dispatcher:
 * Dispatches via Resend SDK with SMTP fallback, database MessageLog sync,
 * and comprehensive error diagnostics.
 */
export async function sendMail(options: MailOptions): Promise<MailDispatchResult> {
  const {
    to,
    subject,
    html,
    text,
    from: customFrom,
    schoolId,
    recipientType = "STAFF",
    logCategory = "GENERAL",
    attachments,
    throwOnError = false,
  } = options;

  // 1. Sanitize recipients
  const rawRecipients = Array.isArray(to) ? to : [to];
  const recipients = Array.from(
    new Set(
      rawRecipients
        .filter((e): e is string => typeof e === "string" && e.trim().length > 0 && e.includes("@"))
        .map((e) => e.trim().toLowerCase())
    )
  );

  if (recipients.length === 0) {
    const errorMsg = `No valid recipient email address provided. (to: ${JSON.stringify(to)})`;
    console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] ${errorMsg}`);
    if (throwOnError) {
      throw new Error(`[EMAIL_SYNC_ERROR] ${errorMsg}`);
    }
    return {
      success: false,
      deliveryStatus: "FAILED_NO_RECIPIENT",
      provider: "NONE",
      recipients: [],
      error: errorMsg,
    };
  }

  const config = getMailConfig();
  const verifiedSystemFrom = `${config.fromName} <noreply@bonaveeict.com.ng>`;
  const effectiveFrom = customFrom || verifiedSystemFrom;

  console.log(`[EMAIL_DISPATCH] [${logCategory}] Initiating delivery to [${recipients.join(", ")}] | Subject: "${subject}" | From: "${effectiveFrom}"`);

  let deliveryStatus = "UNATTEMPTED";
  let deliveryError: string | undefined = undefined;
  let activeProvider: MailDispatchResult["provider"] = "NONE";
  let resultMessageId: string | undefined = undefined;

  // Prepare attachments for Resend
  const resendAttachments = attachments?.map((att) => ({
    filename: att.filename,
    content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content),
  }));

  // ---------------------------------------------------------------------------
  // Provider 1: Resend SDK
  // ---------------------------------------------------------------------------
  const resendClient = getResendClient();
  if (resendClient) {
    try {
      console.log(`[EMAIL_DISPATCH] [${logCategory}] Attempting delivery via Resend SDK...`);
      const { data, error } = await resendClient.emails.send({
        from: effectiveFrom,
        to: recipients,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        attachments: resendAttachments,
      });

      if (error) {
        deliveryError = `Resend API Error: ${error.name || "Error"} - ${error.message}`;
        console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend SDK returned an error:`, {
          error,
          from: effectiveFrom,
          to: recipients,
          subject,
        });

        // If domain verification failed and custom from was used, retry with verified system domain
        if (
          error.message?.toLowerCase().includes("domain") ||
          error.message?.toLowerCase().includes("verify") ||
          error.message?.toLowerCase().includes("from") ||
          error.name === "validation_error"
        ) {
          console.warn(`[EMAIL_DISPATCH] [${logCategory}] Sender domain unverified. Retrying with '${verifiedSystemFrom}'...`);
          try {
            const fallbackResult = await resendClient.emails.send({
              from: verifiedSystemFrom,
              to: recipients,
              subject,
              html,
              text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
              attachments: resendAttachments,
            });

            if (fallbackResult.data?.id) {
              resultMessageId = fallbackResult.data.id;
              deliveryStatus = `DELIVERED_RESEND_SANDBOX (id: ${fallbackResult.data.id})`;
              activeProvider = "RESEND";
              deliveryError = undefined;
              console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via Resend sandbox to [${recipients.join(", ")}] (id: ${fallbackResult.data.id})`);
            } else if (fallbackResult.error) {
              console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend sandbox fallback also failed:`, fallbackResult.error);
            }
          } catch (fbEx: any) {
            console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend sandbox fallback exception:`, fbEx);
          }
        }
      } else if (data?.id) {
        resultMessageId = data.id;
        deliveryStatus = `DELIVERED_RESEND (id: ${data.id})`;
        activeProvider = "RESEND";
        console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via Resend SDK to [${recipients.join(", ")}] (id: ${data.id})`);
      }
    } catch (resendEx: any) {
      deliveryError = `Resend SDK exception: ${resendEx?.message || String(resendEx)}`;
      console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend SDK execution exception:`, resendEx);
    }
  }

  // ---------------------------------------------------------------------------
  // Provider 2: SMTP Fallback (Nodemailer)
  // ---------------------------------------------------------------------------
  if ((!activeProvider || activeProvider === "NONE") && config.smtpConfig) {
    try {
      console.log(`[EMAIL_DISPATCH] [${logCategory}] Attempting SMTP delivery via ${config.smtpConfig.host}:${config.smtpConfig.port}...`);
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: config.smtpConfig.host,
        port: config.smtpConfig.port,
        secure: config.smtpConfig.secure,
        auth: {
          user: config.smtpConfig.auth.user,
          pass: config.smtpConfig.auth.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const info = await transporter.sendMail({
        from: effectiveFrom,
        to: recipients,
        subject,
        html,
        text,
        attachments: attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });

      resultMessageId = info.messageId;
      deliveryStatus = `DELIVERED_SMTP (id: ${info.messageId})`;
      activeProvider = "SMTP";
      deliveryError = undefined;
      console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via SMTP to [${recipients.join(", ")}] (id: ${info.messageId})`);
    } catch (smtpEx: any) {
      deliveryError = `SMTP dispatch failed: ${smtpEx?.message || String(smtpEx)}`;
      console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] SMTP dispatch exception:`, smtpEx);
    }
  }

  // ---------------------------------------------------------------------------
  // Provider 3: Simulated Development fallback
  // ---------------------------------------------------------------------------
  if (!activeProvider || activeProvider === "NONE") {
    if (!config.isConfigured) {
      const isProd = process.env.NODE_ENV === "production";
      if (isProd) {
        deliveryStatus = "FAILED_NO_PROVIDER_CONFIGURED";
        deliveryError =
          "No transactional email provider configured. Please set RESEND_API_KEY or SMTP credentials in your environment variables.";
        console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] ❌ CRITICAL: ${deliveryError}`);
        activeProvider = "NONE";
      } else {
        deliveryStatus = "SIMULATED_DEV";
        deliveryError = undefined;
        console.warn(`[EMAIL_DISPATCH] [${logCategory}] ℹ️ Local Dev: Email simulated for [${recipients.join(", ")}]. Subject: "${subject}".`);
        activeProvider = "SIMULATED";
      }
    } else {
      deliveryStatus = "FAILED_DELIVERY_ERROR";
      console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] ❌ All configured delivery mechanisms failed for [${recipients.join(", ")}]: ${deliveryError}`);
    }
  }

  const isSuccess = activeProvider === "RESEND" || activeProvider === "SMTP" || activeProvider === "SIMULATED";

  // ---------------------------------------------------------------------------
  // Audit Trail Logging: File system log
  // ---------------------------------------------------------------------------
  try {
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFilePath = path.join(logsDir, "transactional-emails.log");
    const logEntry = `[${new Date().toISOString()}] CATEGORY=${logCategory} STATUS=${deliveryStatus} PROVIDER=${activeProvider} TO="${recipients.join(", ")}" SUBJECT="${subject}" ERROR="${deliveryError || "none"}"\n`;
    fs.appendFileSync(logFilePath, logEntry, "utf8");
  } catch {}

  // ---------------------------------------------------------------------------
  // Database State Synchronization: basePrisma.messageLog
  // ---------------------------------------------------------------------------
  if (schoolId) {
    for (const recipient of recipients) {
      try {
        await basePrisma.messageLog.create({
          data: {
            schoolId,
            recipientEmail: recipient,
            recipientType,
            messageType: "EMAIL",
            subject,
            body: html,
            sentAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.warn(`[EMAIL_DISPATCH] [${logCategory}] Warning: Could not record message log in DB:`, dbErr);
      }
    }
  }

  if (!isSuccess && throwOnError) {
    throw new Error(`[EMAIL_SYNC_ERROR] Failed to dispatch email to [${recipients.join(", ")}]: ${deliveryError || deliveryStatus}`);
  }

  return {
    success: isSuccess,
    deliveryStatus,
    error: deliveryError,
    provider: activeProvider,
    messageId: resultMessageId,
    recipients,
  };
}

/**
 * Backward-compatible alias for dispatchEmail.
 */
export const dispatchEmail = sendMail;

// Re-export high-level transactional mail helpers for unified import from @/lib/mail
export {
  sendPasswordResetEmail,
  sendStudentEnrollmentConfirmationEmail,
  sendStaffEnrollmentConfirmationEmail,
  sendSchoolRegistrationSuccessEmail,
  sendDocsRequestEmail,
  sendAdmissionOfferEmail,
  sendInquiryAcknowledgmentEmail,
  sendExamAdmitSlipEmail,
  sendDocumentRejectedEmail,
  sendDirectCommunicationEmail,
  sendBroadcastNoticeEmail,
  sendApplicationReceivedEmail,
  sendParentWelcomeEmail,
  sendSchoolApprovalEmail,
  sendAcademicResultPublishedNotification,
  sendParentFeeReminderEmail,
  sendParentAttendanceAlertEmail,
  sendPasswordRecommendationEmail,
} from "./email-service";
