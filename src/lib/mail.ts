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
  const resendApiKey = (process.env.RESEND_API_KEY || process.env.RESEND_KEY || "").trim();

  // SMTP Settings - Support all common environment variable conventions
  const host = (
    process.env.SMTP_HOST ||
    process.env.MAIL_HOST ||
    process.env.EMAIL_HOST ||
    ""
  ).trim();
  const portStr = (
    process.env.SMTP_PORT ||
    process.env.MAIL_PORT ||
    process.env.EMAIL_PORT ||
    ""
  ).trim();
  const port = parseInt(portStr || "587", 10);
  const user = (
    process.env.SMTP_USER ||
    process.env.SMTP_USERNAME ||
    process.env.MAIL_USERNAME ||
    process.env.MAIL_USER ||
    process.env.EMAIL_USER ||
    ""
  ).trim();
  const pass = (
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.MAIL_PASSWORD ||
    process.env.MAIL_PASS ||
    process.env.EMAIL_PASSWORD ||
    ""
  ).trim();
  const secureEnv = (
    process.env.SMTP_SECURE ||
    process.env.MAIL_SECURE ||
    process.env.MAIL_ENCRYPTION ||
    ""
  ).trim().toLowerCase();
  const secure = secureEnv === "true" || secureEnv === "ssl" || port === 465;

  let smtpConfig: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } } | undefined = undefined;
  if (host && user && pass) {
    smtpConfig = { host, port, secure, auth: { user, pass } };
  }

  const fromName = (
    process.env.EMAIL_FROM_NAME ||
    process.env.MAIL_FROM_NAME ||
    "School ERP"
  ).trim();
  const rawFrom = (
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM ||
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    ""
  ).trim();

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
  const resendSandboxFrom = `${config.fromName} <onboarding@resend.dev>`;
  const effectiveFrom = customFrom || config.fullFrom;

  console.log(`[EMAIL_DISPATCH] [${logCategory}] Initiating delivery to [${recipients.join(", ")}] | Subject: "${subject}" | From: "${effectiveFrom}"`);

  let deliveryStatus = "UNATTEMPTED";
  let deliveryError: string | undefined = undefined;
  let activeProvider: MailDispatchResult["provider"] = "NONE";
  let resultMessageId: string | undefined = undefined;

  // ---------------------------------------------------------------------------
  // Transactional Headers & Delivery Configuration (RFC 5322, RFC 2076 & RFC 2156)
  // ---------------------------------------------------------------------------
  // Injects push-triggering headers so mobile mail applications (Gmail, Outlook,
  // Apple Mail) wake up immediately via APNs/FCM and place the notification directly
  // in the Primary Inbox, rather than waiting for background network refresh.
  const emailDomain = (effectiveFrom.match(/@([^>]+)/)?.[1] || "bonaveeict.com.ng").trim();
  const customMessageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${emailDomain}>`;
  const rfcDate = new Date().toUTCString();

  const transactionalHeaders: Record<string, string> = {
    "X-Priority": "1",               // 1 = Highest
    "Priority": "urgent",            // RFC 2156
    "Importance": "high",            // RFC 2076
    "X-MSMail-Priority": "High",     // Microsoft Outlook/Exchange immediate push
    "Precedence": "first-class",     // Prevents classification as bulk/promotions
    "Auto-Submitted": "auto-generated", // Identifies critical transactional automated notice
    "X-Auto-Response-Suppress": "All, OOF, AutoReply",
    "X-Mailer": "SchoolERP-Transactional-Engine/2.0",
    "Date": rfcDate,
    "Message-ID": customMessageId,
  };

  const plainTextContent = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // Prepare attachments for Resend
  const resendAttachments = attachments?.map((att) => ({
    filename: att.filename,
    content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content),
  }));

  const resendClient = getResendClient();
  const preferSmtp = Boolean(
    (process.env.EMAIL_PROVIDER || process.env.MAIL_PROVIDER || "").toUpperCase() === "SMTP" ||
    (config.smtpConfig && !config.resendApiKey)
  );

  type DispatchOutcome = {
    success: boolean;
    provider: MailDispatchResult["provider"];
    deliveryStatus: string;
    messageId?: string;
    error?: string;
  };

  // Helper: Attempt SMTP delivery
  const dispatchViaSmtp = async (): Promise<DispatchOutcome | null> => {
    if (!config.smtpConfig) return null;
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
        pool: false,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        tls: {
          rejectUnauthorized: false,
          minVersion: "TLSv1.2",
        },
      });

      // Align SMTP sender with authenticated SMTP user to prevent 550 sender rejection (e.g. Gmail / Brevo)
      let smtpFrom = effectiveFrom;
      const smtpUser = config.smtpConfig.auth.user;
      if (smtpUser && smtpUser.includes("@")) {
        const smtpUserDomain = smtpUser.split("@")[1]?.toLowerCase();
        const effectiveDomain = effectiveFrom.match(/@([^>]+)/)?.[1]?.toLowerCase();
        if (!effectiveDomain || effectiveDomain !== smtpUserDomain) {
          smtpFrom = `${config.fromName} <${smtpUser}>`;
        }
      }

      const info = await transporter.sendMail({
        from: smtpFrom,
        to: recipients,
        replyTo: effectiveFrom !== smtpFrom ? effectiveFrom : undefined,
        subject,
        html,
        text: plainTextContent,
        priority: "high",
        date: new Date(),
        messageId: customMessageId,
        headers: transactionalHeaders,
        attachments: attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });

      const messageId = info.messageId || customMessageId;
      console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via SMTP to [${recipients.join(", ")}] (id: ${messageId})`);
      return {
        success: true,
        provider: "SMTP",
        deliveryStatus: `DELIVERED_SMTP (id: ${messageId})`,
        messageId,
      };
    } catch (smtpEx: any) {
      const err = `SMTP dispatch failed: ${smtpEx?.message || String(smtpEx)}`;
      console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] SMTP dispatch exception:`, smtpEx);
      return {
        success: false,
        provider: "NONE",
        deliveryStatus: "FAILED_SMTP",
        error: err,
      };
    }
  };

  // Helper: Attempt Resend delivery
  const dispatchViaResend = async (): Promise<DispatchOutcome | null> => {
    if (!resendClient) return null;
    try {
      console.log(`[EMAIL_DISPATCH] [${logCategory}] Attempting delivery via Resend SDK...`);
      const { data, error } = await resendClient.emails.send({
        from: effectiveFrom,
        to: recipients,
        subject,
        html,
        text: plainTextContent,
        headers: transactionalHeaders,
        attachments: resendAttachments,
      });

      if (error) {
        let resendError = `Resend API Error: ${error.name || "Error"} - ${error.message}`;
        console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend SDK returned an error:`, {
          error,
          from: effectiveFrom,
          to: recipients,
          subject,
        });

        // If domain verification failed and custom from was used, retry with verified sandbox domain
        if (
          (error.message?.toLowerCase().includes("domain") ||
          error.message?.toLowerCase().includes("verify") ||
          error.message?.toLowerCase().includes("from") ||
          error.name === "validation_error") &&
          effectiveFrom !== resendSandboxFrom
        ) {
          console.warn(`[EMAIL_DISPATCH] [${logCategory}] Sender domain unverified (${effectiveFrom}). Retrying with Resend sandbox '${resendSandboxFrom}'...`);
          try {
            const fallbackResult = await resendClient.emails.send({
              from: resendSandboxFrom,
              to: recipients,
              subject,
              html,
              text: plainTextContent,
              headers: transactionalHeaders,
              attachments: resendAttachments,
            });

            if (fallbackResult.data?.id) {
              console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via Resend sandbox to [${recipients.join(", ")}] (id: ${fallbackResult.data.id})`);
              return {
                success: true,
                provider: "RESEND",
                deliveryStatus: `DELIVERED_RESEND_SANDBOX (id: ${fallbackResult.data.id})`,
                messageId: fallbackResult.data.id,
              };
            } else if (fallbackResult.error) {
              resendError = `Resend API Error: ${fallbackResult.error.name || "Error"} - ${fallbackResult.error.message}`;
              console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend sandbox fallback also failed:`, fallbackResult.error);
            }
          } catch (fbEx: any) {
            resendError = `Resend fallback exception: ${fbEx?.message || String(fbEx)}`;
            console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend sandbox fallback exception:`, fbEx);
          }
        }

        return {
          success: false,
          provider: "NONE",
          deliveryStatus: "FAILED_RESEND",
          error: resendError,
        };
      } else if (data?.id) {
        console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via Resend SDK to [${recipients.join(", ")}] (id: ${data.id})`);
        return {
          success: true,
          provider: "RESEND",
          deliveryStatus: `DELIVERED_RESEND (id: ${data.id})`,
          messageId: data.id,
        };
      }
    } catch (resendEx: any) {
      const err = `Resend SDK exception: ${resendEx?.message || String(resendEx)}`;
      console.error(`[EMAIL_SYNC_ERROR] [${logCategory}] Resend SDK execution exception:`, resendEx);
      return {
        success: false,
        provider: "NONE",
        deliveryStatus: "FAILED_RESEND_EXCEPTION",
        error: err,
      };
    }
    return null;
  };

  // Execute in resolved preference order
  let outcome: DispatchOutcome | null = null;
  if (preferSmtp) {
    outcome = await dispatchViaSmtp();
    if (!outcome?.success) {
      const resendOutcome = await dispatchViaResend();
      if (resendOutcome?.success) {
        outcome = resendOutcome;
      } else if (resendOutcome?.error) {
        deliveryError = `${outcome?.error || "SMTP failed"} | ${resendOutcome.error}`;
      }
    }
  } else {
    outcome = await dispatchViaResend();
    if (!outcome?.success) {
      const smtpOutcome = await dispatchViaSmtp();
      if (smtpOutcome?.success) {
        outcome = smtpOutcome;
      } else if (smtpOutcome?.error) {
        deliveryError = `${outcome?.error || "Resend failed"} | ${smtpOutcome.error}`;
      }
    }
  }

  if (outcome?.success) {
    activeProvider = outcome.provider;
    deliveryStatus = outcome.deliveryStatus;
    resultMessageId = outcome.messageId;
    deliveryError = undefined;
  } else if (outcome?.error) {
    deliveryError = outcome.error;
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
