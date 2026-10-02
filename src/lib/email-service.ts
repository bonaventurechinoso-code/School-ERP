import { AdmissionLead, School } from "@prisma/client";
import { basePrisma } from "./tenant-prisma";
import fs from "fs";
import path from "path";

/**
 * Mock Email Service for sending transactional emails.
 * In a real production environment, this integrates with SendGrid, AWS SES, or Nodemailer.
 */

export interface InquiryEmailPayload {
  lead?: AdmissionLead | any;
  leadId?: string;
  school?: School | any;
  schoolId?: string;
}

export interface CredentialItem {
  id: number;
  name: string;
  description: string;
  tag?: string;
}

export const MANDATORY_CREDENTIALS: CredentialItem[] = [
  {
    id: 1,
    name: "Recent Passport Photograph",
    description: "Clear, color passport-sized photograph of the applicant taken against a plain background within the last 6 months.",
    tag: "All Applicants",
  },
  {
    id: 2,
    name: "Scanned Copy of Previous Academic Results / Report Cards",
    description: "Certified termly report cards or official academic transcripts covering the past 1-2 years of study.",
    tag: "All Applicants",
  },
  {
    id: 3,
    name: "Birth Certificate or Valid ID Verification",
    description: "Official government birth certificate, National Identity document, or international passport data page for age and identity verification.",
    tag: "All Applicants",
  },
  {
    id: 4,
    name: "Any Relevant Medical or Behavioral Records",
    description: "Immunization history, physical health assessment, known allergy records, or early childhood behavioral notes.",
    tag: "Mandatory for Nursery / Primary Tiers",
  },
];

export interface ApplicationReceivedEmailPayload {
  schoolId: string;
  applicantName: string;
  applicationNo: string;
  targetGrade?: string;
  recipientEmail: string;
  parentName?: string;
  schoolName?: string;
  subdomain?: string;
  leadId?: string;
  uploadToken?: string;
}

/**
 * Sends responsive email notifying applicant of received application and next step to upload documents.
 * Dispatches via centralized mail service (Resend or SMTP) with tracking and direct upload links.
 */
export async function sendApplicationReceivedEmail(payload: ApplicationReceivedEmailPayload) {
  try {
    const {
      schoolId,
      applicantName,
      applicationNo,
      targetGrade = "Class 1",
      recipientEmail,
      parentName = "Parent / Guardian",
      subdomain = "portal",
      leadId,
      uploadToken: propUploadToken,
    } = payload;

    const school = await basePrisma.school.findFirst({
      where: { OR: [{ id: schoolId }, { subdomain: schoolId }] },
      select: { id: true, name: true, subdomain: true, contactPhone: true },
    }).catch(() => null);

    const tenantName = school?.name || payload.schoolName || "School ERP";
    const sub = school?.subdomain || subdomain;
    const brandColor = (school as any)?.branding?.primaryColor || "#312e81";
    const secondaryColor = "#4338ca";

    // Resolve upload token if missing
    let uploadToken = propUploadToken;
    if (!uploadToken && leadId) {
      const lead = await basePrisma.admissionLead.findUnique({
        where: { id: leadId },
        select: { uploadToken: true },
      }).catch(() => null);
      uploadToken = lead?.uploadToken || undefined;
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const trackUrl = `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(applicationNo)}`;
    const uploadUrl = leadId && uploadToken
      ? `${baseUrl}/${sub}/admissions/upload/${leadId}?token=${uploadToken}`
      : trackUrl;

    const subject = `Application Received (App No: ${applicationNo}) - ${tenantName}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, ${brandColor} 0%, ${secondaryColor} 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 800; }
    .body { padding: 32px; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .btn { display: inline-block; font-size: 14px; font-weight: 700; padding: 14px 32px; text-decoration: none; border-radius: 10px; background-color: ${brandColor}; color: #ffffff; }
    .footer { padding: 24px 32px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Application Confirmation</div>
      <h1>${tenantName}</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">Admission Intake Confirmation</p>
    </div>
    <div class="body">
      <h2 style="font-size: 18px; font-weight: 700; margin-top: 0;">Dear ${parentName || applicantName},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        Thank you for submitting an admission application to <strong>${tenantName}</strong>. We are pleased to confirm that your application has been received and registered into our admissions intake system.
      </p>

      <div class="info-card">
        <div class="info-row">
          <span style="color: #64748b;">Application Number:</span>
          <strong style="color: #0f172a; font-family: monospace;">${applicationNo}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Applicant Name:</span>
          <strong style="color: #0f172a;">${applicantName}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Target Grade / Class:</span>
          <strong style="color: #0f172a;">${targetGrade}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Current Status:</span>
          <strong style="color: #d97706;">DOCUMENTS PENDING</strong>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0 20px 0;">
        <a href="${uploadUrl}" class="btn" style="color: #ffffff !important;">Complete Document Upload Now &rarr;</a>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
        <strong>Direct Upload &amp; Tracking Portal Link:</strong><br />
        <a href="${uploadUrl}" style="color: ${secondaryColor}; font-weight: 600;">${uploadUrl}</a><br />
        <span style="color: #94a3b8;">(Unique secure access token included &bull; Valid for 30 days &bull; Keep this for your records)</span>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
        You can also track your application status at: <a href="${trackUrl}" style="color: ${secondaryColor}; font-weight: 600;">${trackUrl}</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${tenantName}. All rights reserved.<br>
      Admissions &amp; Records Bureau &bull; School Contact: ${school?.contactPhone || "+234 (0) 800-SCHOOL-ERP"}
    </div>
  </div>
</body>
</html>
    `.trim();

    const dispatchResult = await dispatchEmail({
      to: recipientEmail,
      subject,
      html: emailHtml,
      schoolId: school?.id || schoolId,
      recipientType: "PARENT",
      logCategory: "ADMISSIONS_RECEIVED",
    });

    console.log(`[EMAIL_SERVICE] Dispatched application received email via ${dispatchResult.provider} to ${recipientEmail}:`, dispatchResult);
    return { success: true, trackUrl, uploadUrl, dispatchResult };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Error in sendApplicationReceivedEmail:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Sends a responsive HTML email acknowledging an Admissions inquiry and requesting
 * required credential documents for stage progression.
 */
export async function sendInquiryAcknowledgmentEmail(payload: InquiryEmailPayload) {
  try {
    let lead = payload.lead;
    let school = payload.school;

    // Fetch lead if only leadId was provided
    if (!lead && payload.leadId) {
      lead = await basePrisma.admissionLead.findUnique({
        where: { id: payload.leadId },
        include: { tier: true },
      });
    }

    if (!lead) {
      console.warn("[EMAIL_SERVICE] Cannot send inquiry acknowledgment: Lead not found.", payload);
      return null;
    }

    // Fetch school if not provided
    const schoolId = lead.schoolId || payload.schoolId;
    if (!school && schoolId) {
      school = await basePrisma.school.findUnique({
        where: { id: schoolId },
      });
    }

    const tenantName = school?.name || "Udoka International School";
    const subdomain = school?.subdomain || "udoka";
    const brandColor = (school as any)?.branding?.primaryColor || "#312e81";
    const secondaryColor = "#4338ca";

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const portalUrl = `${baseUrl}/${subdomain}/admissions`;

    // Ensure or generate secure upload token for applicant credentials submission
    let uploadToken = (lead as any).uploadToken;
    const isTokenExpired = (lead as any).uploadExpiresAt && new Date((lead as any).uploadExpiresAt) < new Date();
    
    if (!uploadToken || isTokenExpired) {
      uploadToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day upload window
      
      try {
        await basePrisma.admissionLead.update({
          where: { id: lead.id },
          data: {
            uploadToken,
            uploadExpiresAt: expiresAt,
          } as any,
        });
        (lead as any).uploadToken = uploadToken;
        (lead as any).uploadExpiresAt = expiresAt;
      } catch (tokenUpdateErr) {
        console.warn("[EMAIL_SERVICE] Warning: Could not persist uploadToken to DB:", tokenUpdateErr);
      }
    }

    const uploadPortalUrl = `${baseUrl}/${subdomain}/admissions/upload/${lead.id}?token=${uploadToken}`;

    const parentName = lead.parentName || "Parent / Guardian";
    const recipientEmail = lead.parentEmail || lead.studentEmail || (lead.parentContact?.includes("@") ? lead.parentContact : null);
    const displayRecipient = recipientEmail || `${parentName} (No registered email - simulated dispatch)`;

    const refId = (lead.id || "INQ").split("-")[0].toUpperCase();
    const applicantName = lead.applicantName || "Applicant";
    const targetGrade = lead.targetGrade || "Unspecified Grade";
    const tierName = lead.tier?.name || "Standard Tier";
    const isEarlyYears = tierName.toUpperCase().includes("NURSERY") || tierName.toUpperCase().includes("PRIMARY") || tierName.toUpperCase().includes("DAYCARE");

    const messageId = `<inquiry-ack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${subdomain}.internal>`;
    const subject = `Application Inquiry Acknowledged & Required Credentials - ${tenantName}`;

    // Clean, modern responsive HTML email template
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 30px 15px;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, ${brandColor} 0%, ${secondaryColor} 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .body {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .intro-text {
      font-size: 15px;
      line-height: 1.65;
      color: #334155;
      margin-bottom: 24px;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 28px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 14px;
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 28px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .credentials-container {
      margin-bottom: 28px;
    }
    .credential-item {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid ${brandColor};
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 12px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .credential-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .credential-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .credential-tag {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 6px;
      background-color: #eff6ff;
      color: #2563eb;
      border: 1px solid #dbeafe;
    }
    .credential-tag-special {
      background-color: #fef3c7;
      color: #d97706;
      border: 1px solid #fde68a;
    }
    .credential-desc {
      font-size: 13px;
      line-height: 1.5;
      color: #475569;
      margin: 0;
    }
    .action-box {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 32px 0 20px 0;
    }
    .action-box p {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: #334155;
      font-weight: 500;
    }
    .btn {
      display: inline-block;
      background-color: ${brandColor};
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 13px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer a {
      color: #64748b;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Admissions Registry</div>
      <h1>${tenantName}</h1>
      <p>Official Admission & Application Intake Notice</p>
    </div>

    <div class="body">
      <h2 class="greeting">Dear ${parentName},</h2>
      <p class="intro-text">
        Thank you for your interest in <strong>${tenantName}</strong>. We are pleased to formally acknowledge that your admission inquiry for <strong>${applicantName}</strong> has been received and enrolled in our active admissions pipeline.
      </p>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Application Reference:</span>
          <span class="info-value">#${refId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Applicant Name:</span>
          <span class="info-value">${applicantName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Target Grade:</span>
          <span class="info-value">${targetGrade}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Academic Tier:</span>
          <span class="info-value">${tierName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Current Status:</span>
          <span class="info-value" style="color: #4338ca;">INQUIRY / INITIAL REVIEW</span>
        </div>
      </div>

      <div class="section-title">
        <span>Required Credential Documents</span>
      </div>
      <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0;">
        To advance your application to the admissions review and interview stage, please prepare and submit the following required documents:
      </p>

      <div class="credentials-container">
        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">1. Recent Passport Photograph</span>
            <span class="credential-tag">Required</span>
          </div>
          <p class="credential-desc">Clear, color passport-sized photograph of the applicant taken against a plain background within the last 6 months.</p>
        </div>

        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">2. Scanned Copy of Previous Academic Results / Report Cards</span>
            <span class="credential-tag">Required</span>
          </div>
          <p class="credential-desc">Certified termly report cards or official academic transcripts from the most recent 1-2 years of schooling.</p>
        </div>

        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">3. Birth Certificate or Valid ID Verification</span>
            <span class="credential-tag">Required</span>
          </div>
          <p class="credential-desc">Government-issued birth certificate, statutory declaration of age, or valid international passport biodata page.</p>
        </div>

        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">4. Any Relevant Medical or Behavioral Records</span>
            <span class="credential-tag ${isEarlyYears ? 'credential-tag-special' : ''}">
              ${isEarlyYears ? 'Mandatory for Tier' : 'If Applicable'}
            </span>
          </div>
          <p class="credential-desc">Immunization card, medical emergency contacts, allergy profiles, or behavioral/developmental records (mandatory for Nursery and Primary tier applicants).</p>
        </div>
      </div>

      <div class="action-box">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a;">
          Upload Your Credentials Online
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">
          To complete your file and advance to the interview stage, please use your dedicated secure upload portal:
        </p>
        <a href="${uploadPortalUrl}" class="btn" style="display: inline-block; font-size: 15px; font-weight: 700; padding: 15px 36px; text-decoration: none; border-radius: 10px; background-color: ${brandColor}; color: #ffffff; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">
          Upload Required Credentials &rarr;
        </a>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
          <strong>Direct Secure Access Link:</strong><br />
          <a href="${uploadPortalUrl}" style="color: ${secondaryColor}; font-weight: 600;">${uploadPortalUrl}</a><br />
          <span style="color: #94a3b8;">(Unique temporary link &bull; Valid for 30 days &bull; No password required)</span>
        </div>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
        If you have any questions regarding these credential requirements, please do not hesitate to contact our Admissions Office at <strong>${school?.contactPhone || "+234 (0) 800-SCHOOL-ERP"}</strong>.
      </p>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} ${tenantName}. All rights reserved.<br>
      Admissions & Records Bureau &bull; Multi-Tenant Academic Management System
    </div>
  </div>
</body>
</html>
    `.trim();

    // Standard Transport Console Wrapper (Simulated Nodemailer / SMTP Transport)
    console.log("\n" + "=".repeat(80));
    console.log("📨 [SIMULATED EMAIL TRANSPORT - NODEMAILER / SMTP DISPATCH]");
    console.log("=".repeat(80));
    console.log(`STATUS:       250 OK (Simulated Transport Delivered)`);
    console.log(`MESSAGE-ID:   ${messageId}`);
    console.log(`TIMESTAMP:    ${new Date().toISOString()}`);
    console.log(`TENANT:       ${tenantName} (${subdomain})`);
    console.log(`RECIPIENT:    ${parentName} <${displayRecipient}>`);
    console.log(`APPLICANT:    ${applicantName} (Target: ${targetGrade} • Tier: ${tierName})`);
    console.log(`SUBJECT:      ${subject}`);
    console.log(`UPLOAD LINK:  ${uploadPortalUrl}`);
    console.log("-".repeat(80));
    console.log("REQUESTED CREDENTIAL DOCUMENTS:");
    console.log("  1. Recent Passport Photograph (Color photo within last 6 months)");
    console.log("  2. Scanned Copy of Previous Academic Results / Report Cards (Past 1-2 years)");
    console.log("  3. Birth Certificate or Valid ID Verification (Government-issued)");
    console.log(`  4. Any Relevant Medical or Behavioral Records (${isEarlyYears ? "Mandatory for Nursery/Primary" : "If applicable"})`);
    console.log("-".repeat(80));
    console.log(`PAYLOAD SIZE: ~${Math.round(Buffer.byteLength(emailHtml, 'utf8') / 1024)} KB | FORMAT: Responsive HTML`);
    console.log("=".repeat(80) + "\n");

    // Write transport log entry to local test log file asynchronously
    try {
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFilePath = path.join(logsDir, "admissions-email-transport.log");
      const logEntry = `[${new Date().toISOString()}] [250 OK] ID=${messageId} TO="${displayRecipient}" TENANT="${tenantName}" APPLICANT="${applicantName}" CREDENTIALS="1.Passport, 2.Report Cards, 3.Birth Certificate, 4.Medical/Behavioral"\n`;
      fs.appendFileSync(logFilePath, logEntry, "utf8");
    } catch (fsErr) {
      // Non-blocking file logging
    }

    // Persist to MessageLog table asynchronously in background
    // Dispatch email via Resend / SMTP service
    let dispatchResult: any = null;
    if (recipientEmail && recipientEmail.includes("@")) {
      dispatchResult = await dispatchEmail({
        to: recipientEmail,
        subject,
        html: emailHtml,
        schoolId: school?.id || schoolId,
        recipientType: "PARENT",
        logCategory: "ADMISSIONS_INQUIRY_ACK",
      });
      console.log(`[EMAIL_SERVICE] Dispatched inquiry acknowledgment email via ${dispatchResult.provider} to ${recipientEmail}:`, dispatchResult);
    }

    return {
      success: true,
      messageId,
      recipient: displayRecipient,
      tenantName,
      applicantName,
      subject,
      emailHtml,
      dispatchResult,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to send inquiry acknowledgment email:", err);
    return null;
  }
}

export interface DocsRequestEmailPayload {
  schoolId: string;
  applicantName: string;
  parentName?: string;
  applicationNo: string;
  targetGrade?: string;
  recipientEmail: string;
  uploadUrl: string;
  trackUrl?: string;
  schoolName?: string;
  subdomain?: string;
  customMessage?: string;
}

/**
 * Sends a high-priority, responsive HTML email requesting pending credential documents
 * with direct authenticated upload link and tracking link via Resend.
 */
export async function sendDocsRequestEmail(payload: DocsRequestEmailPayload) {
  try {
    const {
      schoolId,
      applicantName,
      parentName = "Parent / Guardian",
      applicationNo,
      targetGrade = "Selected Grade",
      recipientEmail,
      uploadUrl,
      trackUrl,
      schoolName,
      subdomain,
      customMessage,
    } = payload;

    const school = await basePrisma.school.findFirst({
      where: { OR: [{ id: schoolId }, { subdomain: schoolId }] },
      select: { id: true, name: true, subdomain: true, contactPhone: true },
    }).catch(() => null);

    const tenantName = school?.name || schoolName || "School ERP";
    const brandColor = (school as any)?.branding?.primaryColor || "#312e81";
    const secondaryColor = "#4338ca";

    const subject = `Action Required: Upload Verification Documents (App No: ${applicationNo}) - ${tenantName}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, ${brandColor} 0%, ${secondaryColor} 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 800; }
    .body { padding: 32px; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .btn { display: inline-block; font-size: 14px; font-weight: 700; padding: 14px 32px; text-decoration: none; border-radius: 10px; background-color: ${brandColor}; color: #ffffff; }
    .doc-item { padding: 10px 14px; margin-bottom: 8px; border-radius: 8px; background-color: #f1f5f9; border-left: 4px solid #f59e0b; font-size: 13px; }
    .footer { padding: 24px 32px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Action Required</div>
      <h1>${tenantName}</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">Admissions &amp; Records Bureau</p>
    </div>
    <div class="body">
      <h2 style="font-size: 18px; font-weight: 700; margin-top: 0;">Dear ${parentName || applicantName},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        The Admissions Office at <strong>${tenantName}</strong> is actively reviewing the admission file for <strong>${applicantName}</strong>. To advance the application to our admission board review, please upload the requested verification documentation.
      </p>

      ${customMessage ? `<div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400e;"><strong>Registrar Note:</strong> ${customMessage}</div>` : ""}

      <div class="info-card">
        <div class="info-row">
          <span style="color: #64748b;">Application Number:</span>
          <strong style="color: #0f172a; font-family: monospace;">${applicationNo}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Applicant Name:</span>
          <strong style="color: #0f172a;">${applicantName}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Target Grade:</span>
          <strong style="color: #0f172a;">${targetGrade}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Status:</span>
          <strong style="color: #d97706;">DOCUMENTS PENDING</strong>
        </div>
      </div>

      <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 20px 0 10px 0;">Required Documents:</h3>
      <div class="doc-item"><strong>1. Recent Passport Photograph</strong> &ndash; Clear color photo with white background.</div>
      <div class="doc-item"><strong>2. Previous Academic Results</strong> &ndash; Recent termly report cards or transcripts.</div>
      <div class="doc-item"><strong>3. Birth Certificate or Valid ID</strong> &ndash; NPC birth certificate or valid ID card.</div>
      <div class="doc-item"><strong>4. NIN / Medical Fitness</strong> &ndash; National Identity slip or medical report.</div>

      <div style="text-align: center; margin: 30px 0 20px 0;">
        <a href="${uploadUrl}" class="btn" style="color: #ffffff !important;">Upload Pending Documents Now &rarr;</a>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
        <strong>Direct Upload Link:</strong><br />
        <a href="${uploadUrl}" style="color: ${secondaryColor}; font-weight: 600;">${uploadUrl}</a>
      </div>

      ${trackUrl ? `
      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
        You can also check your live application status at: <a href="${trackUrl}" style="color: ${secondaryColor}; font-weight: 600;">${trackUrl}</a>
      </p>
      ` : ""}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${tenantName}. All rights reserved.<br>
      Admissions &amp; Records Bureau &bull; Contact: ${school?.contactPhone || "+234 (0) 800-SCHOOL-ERP"}
    </div>
  </div>
</body>
</html>
    `.trim();

    const dispatchResult = await dispatchEmail({
      to: recipientEmail,
      subject,
      html: emailHtml,
      schoolId: school?.id || schoolId,
      recipientType: "PARENT",
      logCategory: "ADMISSIONS_DOCS_REQUEST",
    });

    console.log(`[EMAIL_SERVICE] Dispatched docs request email via ${dispatchResult.provider} to ${recipientEmail}:`, dispatchResult);
    return { success: true, uploadUrl, dispatchResult };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Error in sendDocsRequestEmail:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

export interface DocumentRejectedEmailPayload {
  schoolId: string;
  applicantName: string;
  parentName?: string;
  applicationNo: string;
  targetGrade?: string;
  recipientEmail: string;
  documentType?: string;
  feedback?: string;
  uploadUrl?: string;
  trackUrl?: string;
  schoolName?: string;
  subdomain?: string;
}

/**
 * Sends a notification email via Resend to the applicant when an uploaded document
 * is rejected by an admissions administrator.
 */
export async function sendDocumentRejectedEmail(payload: DocumentRejectedEmailPayload) {
  try {
    const {
      schoolId,
      applicantName,
      parentName = "Parent / Guardian",
      applicationNo,
      targetGrade = "Selected Grade",
      recipientEmail,
      documentType = "Credential Document",
      feedback,
      uploadUrl,
      trackUrl,
      schoolName,
      subdomain,
    } = payload;

    const school = await basePrisma.school.findFirst({
      where: { OR: [{ id: schoolId }, { subdomain: schoolId }] },
      select: { id: true, name: true, subdomain: true, contactPhone: true },
    }).catch(() => null);

    const tenantName = school?.name || schoolName || "School ERP";
    const sub = school?.subdomain || subdomain || "portal";
    const brandColor = (school as any)?.branding?.primaryColor || "#991b1b";
    const secondaryColor = "#dc2626";

    const subject = `Application Update: Document Rejected (App No: ${applicationNo}) - ${tenantName}`;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const effectiveTrackUrl = trackUrl || `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(applicationNo)}`;
    const effectiveUploadUrl = uploadUrl || effectiveTrackUrl;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, ${brandColor} 0%, ${secondaryColor} 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 800; }
    .body { padding: 32px; }
    .alert-banner { background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin: 18px 0; color: #991b1b; font-size: 14px; font-weight: 600; }
    .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .btn { display: inline-block; font-size: 14px; font-weight: 700; padding: 14px 32px; text-decoration: none; border-radius: 10px; background-color: #dc2626; color: #ffffff; }
    .footer { padding: 24px 32px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Action Required</div>
      <h1>${tenantName}</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">Admissions &amp; Records Bureau</p>
    </div>
    <div class="body">
      <h2 style="font-size: 18px; font-weight: 700; margin-top: 0; color: #0f172a;">Dear ${parentName || applicantName},</h2>
      
      <div class="alert-banner">
        Application Update: Document Rejected. Please log into your portal to view feedback and re-upload.
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        During the admissions verification review for <strong>${applicantName}</strong>, the submitted file for <strong>${documentType}</strong> was reviewed and could not be accepted.
      </p>

      ${feedback ? `<div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400e;"><strong>Registrar Feedback:</strong> ${feedback}</div>` : ""}

      <div class="info-card">
        <div class="info-row">
          <span style="color: #64748b;">Application Number:</span>
          <strong style="color: #0f172a; font-family: monospace;">${applicationNo}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Applicant Name:</span>
          <strong style="color: #0f172a;">${applicantName}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Rejected Item:</span>
          <strong style="color: #dc2626;">${documentType}</strong>
        </div>
        <div class="info-row">
          <span style="color: #64748b;">Current Status:</span>
          <strong style="color: #dc2626;">REJECTED / NEEDS ATTENTION</strong>
        </div>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        Please click below to access your applicant portal and re-upload a clear, valid copy of the required document.
      </p>

      <div style="text-align: center; margin: 30px 0 20px 0;">
        <a href="${effectiveUploadUrl}" class="btn" style="color: #ffffff !important;">Log In to Re-Upload Document &rarr;</a>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
        <strong>Direct Portal Link:</strong><br />
        <a href="${effectiveUploadUrl}" style="color: #dc2626; font-weight: 600;">${effectiveUploadUrl}</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${tenantName}. All rights reserved.<br>
      Admissions &amp; Records Bureau &bull; Contact: ${school?.contactPhone || "+234 (0) 800-SCHOOL-ERP"}
    </div>
  </div>
</body>
</html>
    `.trim();

    const dispatchResult = await dispatchEmail({
      to: recipientEmail,
      subject,
      html: emailHtml,
      schoolId: school?.id || schoolId,
      recipientType: "PARENT",
      logCategory: "ADMISSIONS_DOC_REJECTED",
    });

    console.log(`[EMAIL_SERVICE] Dispatched document rejection email via ${dispatchResult.provider} to ${recipientEmail}:`, dispatchResult);
    return { success: true, dispatchResult };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Error in sendDocumentRejectedEmail:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Sends admission offer email when an applicant is approved.
 */
export async function sendAdmissionOfferEmail(
  lead: AdmissionLead,
  school: School,
  token: string
) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
  const secureLink = `${baseUrl}/${school.subdomain}/admissions/accept?token=${token}`;
  const brandColor = (school as any).branding?.primaryColor || "#0f172a";

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admission Offer - ${school.name}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: ${brandColor}; padding: 30px 40px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px; color: #334155; line-height: 1.6; }
        .content p { margin: 0 0 16px 0; font-size: 16px; }
        .details-box { background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${brandColor}; }
        .details-box p { margin: 8px 0; font-size: 15px; }
        .details-box strong { color: #0f172a; }
        .action-container { text-align: center; margin: 40px 0 20px 0; }
        .button { background-color: ${brandColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: opacity 0.2s; }
        .footer { padding: 20px 40px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${school.name}</h1>
        </div>
        <div class="content">
          <p>Dear ${lead.parentName || "Parent/Guardian"},</p>
          <p>We are absolutely thrilled to inform you that <strong>${lead.applicantName}</strong> has been offered admission to ${school.name}!</p>
          
          <div class="details-box">
            <p><strong>Applicant:</strong> ${lead.applicantName}</p>
            <p><strong>Target Class:</strong> ${lead.targetGrade}</p>
            <p><strong>Reference ID:</strong> ${lead.id.split('-')[0].toUpperCase()}</p>
          </div>
          
          <p>To finalize enrollment and secure the placement, please review the offer details and submit your decision through our secure portal.</p>
          
          <div class="action-container">
            <a href="${secureLink}" class="button">Review Admission Offer</a>
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center;">This secure link is unique to your application and will expire in 7 days.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${school.name}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  console.log("----------------------------------------------------------------");
  console.log(`[EMAIL DISPATCH] Mocking email send to: ${lead.parentEmail || lead.parentContact}`);
  console.log(`Subject: 🎉 Admission Offer - ${school.name}`);
  console.log(`Token Link: ${secureLink}`);
  console.log("----------------------------------------------------------------");
  
  return emailHtml;
}

/**
 * Sends direct communication (Email or SMS notification) to a student, parent, or staff member.
 */
export async function sendDirectCommunicationEmail(payload: {
  schoolId: string;
  recipientEmail: string;
  recipientType: string;
  messageType?: string;
  subject: string;
  body: string;
}) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { id: payload.schoolId },
    });

    const tenantName = school?.name || "Institution";
    const brandColor = (school as any)?.branding?.primaryColor || "#312e81";
    const messageId = `<msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@schoolerp.internal>`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: ${brandColor}; padding: 24px 28px; color: #ffffff; text-align: left; }
          .header h2 { margin: 0; font-size: 20px; font-weight: 700; }
          .content { padding: 28px; line-height: 1.6; }
          .subject { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .body-text { font-size: 15px; color: #334155; white-space: pre-wrap; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>${tenantName}</h2>
          </div>
          <div class="content">
            <div class="subject">${payload.subject}</div>
            <div class="body-text">${payload.body}</div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${tenantName} &bull; Direct Communication Bureau
          </div>
        </div>
      </body>
      </html>
    `.trim();

    console.log(`[EMAIL_DISPATCH] Sent direct message to ${payload.recipientEmail} (${payload.recipientType}) | Subject: ${payload.subject}`);

    return {
      success: true,
      messageId,
      html: emailHtml,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to send direct communication:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcasts an announcement notice via email to all appropriate recipients
 */
export async function sendBroadcastNoticeEmail(payload: {
  schoolId: string;
  noticeId: string;
}) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { id: payload.schoolId },
    });

    const notice = await basePrisma.notice.findUnique({
      where: { id: payload.noticeId },
    });

    if (!notice || !school) {
      return { success: false, error: "Notice or School record not found." };
    }

    // Collect recipient emails according to target audience
    const recipientEmails: string[] = [];

    if (notice.targetAudience === "ALL" || notice.targetAudience === "STAFF") {
      const staffList = await basePrisma.staff.findMany({
        where: { schoolId: payload.schoolId, status: { not: "TERMINATED" } },
        select: { email: true },
      });
      staffList.forEach((s) => {
        if (s.email && !recipientEmails.includes(s.email)) recipientEmails.push(s.email);
      });
    }

    if (notice.targetAudience === "ALL" || notice.targetAudience === "STUDENTS") {
      const studentList = await basePrisma.student.findMany({
        where: { schoolId: payload.schoolId, status: { in: ["ENROLLED", "ACTIVE"] } },
        select: { email: true, parentEmail: true },
      });
      studentList.forEach((st) => {
        if (st.email && !recipientEmails.includes(st.email)) recipientEmails.push(st.email);
        if (st.parentEmail && !recipientEmails.includes(st.parentEmail)) recipientEmails.push(st.parentEmail);
      });
    }

    console.log(`[BROADCAST_EMAIL] Broadcasting "${notice.title}" to ${recipientEmails.length} recipients for ${school.name}`);

    // Log message entries for the broadcast
    const logPromises = recipientEmails.slice(0, 50).map((email) =>
      basePrisma.messageLog.create({
        data: {
          schoolId: payload.schoolId,
          recipientEmail: email,
          recipientType: notice.targetAudience,
          messageType: "EMAIL",
          subject: `[ANNOUNCEMENT] ${notice.title}`,
          body: notice.content,
          sentAt: new Date(),
        },
      })
    );

    await Promise.allSettled(logPromises);

    return {
      success: true,
      recipientsCount: recipientEmails.length,
      noticeTitle: notice.title,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to broadcast notice email:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a transactional password recovery email containing a secure, time-limited reset link.
 */
export async function sendPasswordResetEmail(payload: {
  school: School | any;
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
  expiresMinutes?: number;
}) {
  try {
    const { school, recipientEmail, recipientName, resetUrl, expiresMinutes = 60 } = payload;
    const tenantName = school?.name || "Institution";
    const brandColor = (school as any)?.branding?.primaryColor || "#312e81";
    const messageId = `<reset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@schoolerp.internal>`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request - ${tenantName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${brandColor}; padding: 32px 36px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 6px 0 0 0; opacity: 0.85; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
          .content { padding: 36px; line-height: 1.6; }
          .content h2 { margin-top: 0; font-size: 18px; color: #0f172a; font-weight: 600; }
          .content p { margin: 0 0 16px 0; font-size: 15px; color: #334155; }
          .security-callout { background-color: #f1f5f9; padding: 18px 20px; border-radius: 10px; margin: 24px 0; border-left: 4px solid ${brandColor}; font-size: 14px; color: #475569; }
          .action-container { text-align: center; margin: 32px 0; }
          .button { background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .link-fallback { word-break: break-all; font-size: 12px; color: #64748b; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px; }
          .footer { padding: 24px 36px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${tenantName}</h1>
            <p>Institutional Security Desk</p>
          </div>
          <div class="content">
            <h2>Password Recovery Request</h2>
            <p>Hello <strong>${recipientName || "User"}</strong>,</p>
            <p>We received a request to reset the password associated with your account for <strong>${tenantName}</strong>.</p>
            <p>Click the secure button below to choose a brand-new password:</p>
            
            <div class="action-container">
              <a href="${resetUrl}" class="button" target="_blank" rel="noopener noreferrer">Reset Your Password</a>
            </div>

            <div class="security-callout">
              <strong>Security Notice:</strong> This recovery link is strictly time-limited and will automatically expire in <strong>${expiresMinutes} minutes</strong>. If you did not initiate this password reset request, you can safely disregard this email; your current password remains secure.
            </div>

            <p style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this secure link directly into your browser:</p>
            <div class="link-fallback">${resetUrl}</div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${tenantName}. All rights reserved.<br/>
            Automated security dispatch. Please do not reply directly to this message.
          </div>
        </div>
      </body>
      </html>
    `.trim();

    console.log("----------------------------------------------------------------");
    console.log(`[PASSWORD_RESET_EMAIL] Dispatched to: ${recipientEmail} for ${tenantName}`);
    console.log(`Reset Link: ${resetUrl}`);
    console.log("----------------------------------------------------------------");

    // Persist message record in MessageLog
    try {
      if (school?.id) {
        await basePrisma.messageLog.create({
          data: {
            schoolId: school.id,
            recipientEmail: recipientEmail.toLowerCase().trim(),
            recipientType: "STAFF",
            messageType: "EMAIL",
            subject: `[SECURITY] Password Reset Request - ${tenantName}`,
            body: `Password recovery initiated. Reset link: ${resetUrl}`,
            sentAt: new Date(),
          },
        });
      }
    } catch (logErr) {
      console.warn("[EMAIL_SERVICE] Notice log warning:", logErr);
    }

    return {
      success: true,
      messageId,
      html: emailHtml,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to dispatch password reset email:", err);
    return { success: false, error: err.message };
  }
}

export interface MailConfig {
  resendApiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  fromEmail: string;
  fromName: string;
  fullFrom: string;
  isConfigured: boolean;
}

/**
 * Resolves email configuration from environment variables, supporting all standard
 * variable names and hosting provider conventions (Render, Heroku, Docker, etc.).
 */
export function getMailConfig(): MailConfig {
  const resendApiKey = (process.env.RESEND_API_KEY || process.env.RESEND_KEY || "").trim() || undefined;

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

  let smtp: MailConfig["smtp"] = undefined;
  if (host && user && pass) {
    smtp = {
      host,
      port,
      secure,
      auth: { user, pass },
    };
  }

  // From Name
  const fromName = (
    process.env.EMAIL_FROM_NAME ||
    process.env.MAIL_FROM_NAME ||
    "School ERP"
  ).trim();

  // Raw From Address (priority: EMAIL_FROM -> MAIL_FROM -> SMTP_FROM)
  const rawFrom = (
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
  } else if (user && user.includes("@")) {
    fromEmail = user;
    fullFrom = `${fromName} <${fromEmail}>`;
  } else {
    fromEmail = "noreply@bonaveeict.com.ng";
    fullFrom = `${fromName} <${fromEmail}>`;
  }

  const isConfigured = Boolean(resendApiKey || smtp);

  return {
    resendApiKey,
    smtp,
    fromEmail,
    fromName,
    fullFrom,
    isConfigured,
  };
}

export interface DispatchEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  schoolId?: string;
  recipientType?: "ADMIN" | "STUDENT" | "PARENT" | "STAFF";
  logCategory?: string;
}

export interface DispatchEmailResult {
  success: boolean;
  deliveryStatus: string;
  error?: string;
  provider: "RESEND" | "SMTP" | "SIMULATED" | "NONE";
  messageId?: string;
  recipients: string[];
}

/**
 * Universal resilient email dispatcher with multi-provider failover, timeout protection,
 * comprehensive status reporting, and database audit logging.
 */
export async function dispatchEmail(options: DispatchEmailOptions): Promise<DispatchEmailResult> {
  const { to, subject, html, text, schoolId, recipientType = "STAFF", logCategory = "GENERAL" } = options;

  const rawRecipients = Array.isArray(to) ? to : [to];
  const recipients = Array.from(
    new Set(
      rawRecipients
        .filter((e): e is string => typeof e === "string" && e.trim().length > 0 && e.includes("@"))
        .map((e) => e.trim().toLowerCase())
    )
  );

  if (recipients.length === 0) {
    const errorMsg = "No valid recipient email address provided.";
    console.warn(`[EMAIL_DISPATCH] [${logCategory}] Rejected dispatch: ${errorMsg}`);
    return {
      success: false,
      deliveryStatus: "FAILED_NO_RECIPIENT",
      error: errorMsg,
      provider: "NONE",
      recipients: [],
    };
  }

  const config = getMailConfig();
  console.log(`[EMAIL_DISPATCH] [${logCategory}] Initiating delivery to [${recipients.join(", ")}].`);
  console.log(
    `[EMAIL_DISPATCH] [${logCategory}] Config check: Resend=${Boolean(config.resendApiKey)}, SMTP=${Boolean(config.smtp)} (Host: ${config.smtp?.host || "none"}, Port: ${config.smtp?.port || "none"}), Sender="${config.fullFrom}"`
  );

  let deliveryStatus = "UNATTEMPTED";
  let deliveryError: string | undefined = undefined;
  let activeProvider: DispatchEmailResult["provider"] = "NONE";
  let resultMessageId: string | undefined = undefined;

  // 1. Dispatch via Resend API if configured
  if (config.resendApiKey) {
    try {
      console.log(`[EMAIL_DISPATCH] [${logCategory}] Attempting delivery via Resend API (From: "${config.fullFrom}", To: [${recipients.join(", ")}])...`);
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fullFrom,
          to: recipients,
          subject,
          html,
          text,
        }),
      });

      const resendData = await resendRes.json();
      console.log(`[EMAIL_DISPATCH] [${logCategory}] Resend HTTP Status: ${resendRes.status}, Response:`, JSON.stringify(resendData));

      if (resendRes.ok && resendData?.id) {
        resultMessageId = resendData.id;
        deliveryStatus = `DELIVERED_RESEND (id: ${resendData.id})`;
        activeProvider = "RESEND";
        console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via Resend API to [${recipients.join(", ")}] (id: ${resendData.id})`);
      } else {
        const resendErrString = resendData?.message || JSON.stringify(resendData);
        deliveryError = `Resend Error (${resendRes.status}): ${resendErrString}`;
        console.error(`[EMAIL_DISPATCH] [${logCategory}] Resend returned error:`, deliveryError);

        // Fallback for Resend test sandbox sender if domain unverified
        if (config.fullFrom !== "School ERP <onboarding@resend.dev>") {
          console.warn(`[EMAIL_DISPATCH] [${logCategory}] Primary sender rejected. Retrying dispatch via Resend test sandbox 'onboarding@resend.dev'...`);
          try {
            const fallbackRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "School ERP <onboarding@resend.dev>",
                to: recipients,
                subject,
                html,
                text,
              }),
            });
            const fallbackData = await fallbackRes.json();
            if (fallbackRes.ok && fallbackData?.id) {
              resultMessageId = fallbackData.id;
              deliveryStatus = `DELIVERED_RESEND_FALLBACK (id: ${fallbackData.id})`;
              activeProvider = "RESEND";
              deliveryError = undefined;
              console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully delivered via Resend fallback to [${recipients.join(", ")}] (id: ${fallbackData.id})`);
            } else {
              console.error(`[EMAIL_DISPATCH] [${logCategory}] Resend sandbox fallback also failed:`, fallbackData);
            }
          } catch (fbEx: any) {
            console.error(`[EMAIL_DISPATCH] [${logCategory}] Resend sandbox fallback exception:`, fbEx?.message || fbEx);
          }
        }
      }
    } catch (resendEx: any) {
      deliveryError = `Resend network exception: ${resendEx?.message || resendEx}`;
      console.error(`[EMAIL_DISPATCH] [${logCategory}] Resend network exception:`, resendEx);
    }
  }

  // 2. Dispatch via SMTP (Nodemailer) if Resend did not deliver and SMTP is configured
  if (!activeProvider || activeProvider === "NONE") {
    if (config.smtp) {
      try {
        console.log(`[EMAIL_DISPATCH] [${logCategory}] Attempting SMTP delivery via ${config.smtp.host}:${config.smtp.port} (User: ${config.smtp.auth.user})...`);
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: {
            user: config.smtp.auth.user,
            pass: config.smtp.auth.pass,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });

        const info = await transporter.sendMail({
          from: config.fullFrom,
          to: recipients,
          subject,
          html,
          text,
        });

        resultMessageId = info.messageId;
        deliveryStatus = `DELIVERED_SMTP (id: ${info.messageId})`;
        activeProvider = "SMTP";
        deliveryError = undefined;
        console.log(`[EMAIL_DISPATCH] [${logCategory}] Successfully sent via SMTP to [${recipients.join(", ")}]: ${info.messageId}`);
      } catch (smtpEx: any) {
        deliveryError = `SMTP dispatch failed: ${smtpEx?.message || smtpEx}`;
        console.error(`[EMAIL_DISPATCH] [${logCategory}] SMTP dispatch exception:`, smtpEx);
      }
    }
  }

  // 3. Fallback for unconfigured or local dev environments
  if (!activeProvider || activeProvider === "NONE") {
    if (!config.isConfigured) {
      const isProd = process.env.NODE_ENV === "production";
      deliveryStatus = isProd ? "FAILED_NO_PROVIDER_CONFIGURED" : "SIMULATED_DEV";
      deliveryError =
        "No transactional email provider configured. Please set RESEND_API_KEY or SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) in Render Environment Variables.";
      if (isProd) {
        console.error(`[EMAIL_DISPATCH] [${logCategory}] ❌ CRITICAL: ${deliveryError}`);
      } else {
        console.warn(`[EMAIL_DISPATCH] [${logCategory}] ℹ️ Local Dev: Email simulated for [${recipients.join(", ")}]. Subject: "${subject}".`);
      }
      activeProvider = isProd ? "NONE" : "SIMULATED";
    } else {
      deliveryStatus = "FAILED_DELIVERY_ERROR";
      console.error(`[EMAIL_DISPATCH] [${logCategory}] ❌ All configured delivery mechanisms failed for [${recipients.join(", ")}]: ${deliveryError}`);
    }
  }

  const isSuccess = activeProvider === "RESEND" || activeProvider === "SMTP" || activeProvider === "SIMULATED";

  // Append to local transport audit log
  try {
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFilePath = path.join(logsDir, "transactional-emails.log");
    const logEntry = `[${new Date().toISOString()}] CATEGORY=${logCategory} STATUS=${deliveryStatus} PROVIDER=${activeProvider} TO="${recipients.join(", ")}" SUBJECT="${subject}" ERROR="${deliveryError || "none"}"\n`;
    fs.appendFileSync(logFilePath, logEntry, "utf8");
  } catch {}

  // Record in Database MessageLog
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

  return {
    success: isSuccess,
    deliveryStatus,
    error: deliveryError,
    provider: activeProvider,
    messageId: resultMessageId,
    recipients,
  };
}

export interface SchoolRegistrationEmailPayload {
  schoolName: string;
  subdomain: string;
  adminEmail: string;
  adminPassword?: string;
  contactPhone?: string | null;
  tiers?: string[];
  schoolId?: string;
}

/**
 * Sends a welcome email containing school name, portal URL, and admin login credentials
 * upon successful school registration.
 */
export async function sendSchoolRegistrationSuccessEmail(payload: SchoolRegistrationEmailPayload) {
  try {
    const { schoolName, subdomain, adminEmail, adminPassword, contactPhone, schoolId } = payload;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const portalUrl = `${baseUrl}/login?school=${encodeURIComponent(subdomain)}`;
    const brandColor = "#4f46e5";
    const subject = `🎉 Welcome to School ERP - ${schoolName} Portal Access Credentials`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>School Registration Successful - ${schoolName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${brandColor}; padding: 36px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .content { padding: 36px 32px; line-height: 1.6; }
          .welcome-text { font-size: 16px; color: #334155; margin-bottom: 24px; }
          .credentials-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 5px solid ${brandColor}; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
          .cred-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; }
          .action-area { text-align: center; margin: 32px 0 20px 0; }
          .login-btn { display: inline-block; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.35); }
          .direct-link { font-size: 13px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-top: 20px; }
          .footer { padding: 24px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName}</h1>
            <p>School Administrative Workspace Provisioned</p>
          </div>
          <div class="content">
            <p class="welcome-text">
              Congratulations! Your institutional workspace for <strong>${schoolName}</strong> has been successfully configured and activated on the School ERP platform.
            </p>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">School Name</span>
                <span class="cred-value">${schoolName}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Portal URL</span>
                <span class="cred-value">${portalUrl}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Admin Login</span>
                <span class="cred-value">${adminEmail}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Password</span>
                <span class="cred-value">${adminPassword || "(Configured during registration)"}</span>
              </div>
            </div>

            <div class="action-area">
              <a href="${portalUrl}" class="login-btn" target="_blank" rel="noopener noreferrer">
                Access School Admin Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              You can access your portal directly anytime at:
            </p>
            <div class="direct-link">
              <a href="${portalUrl}" style="color: ${brandColor}; font-weight: 600;">${portalUrl}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${schoolName} &bull; Powered by School ERP<br/>
            Need assistance? Contact support or reply directly to this notification.
          </div>
        </div>
      </body>
      </html>
    `.trim();

    const dispatchResult = await dispatchEmail({
      to: adminEmail,
      subject,
      html: emailHtml,
      schoolId,
      recipientType: "ADMIN",
      logCategory: "TENANT_REGISTRATION",
    });

    console.log("----------------------------------------------------------------");
    console.log(`[REGISTRATION_EMAIL] Dispatched to: ${adminEmail}`);
    console.log(`School: ${schoolName} (${subdomain})`);
    console.log(`Portal URL: ${portalUrl}`);
    console.log(`Delivery Status: ${dispatchResult.deliveryStatus}`);
    console.log("----------------------------------------------------------------");

    return {
      success: dispatchResult.success,
      deliveryStatus: dispatchResult.deliveryStatus,
      recipient: adminEmail,
      schoolName,
      portalUrl,
      subject,
      error: dispatchResult.error,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to dispatch registration success email:", err);
    return { success: false, error: err.message, deliveryStatus: "FAILED_EXCEPTION" };
  }
}

export interface StudentEnrollmentConfirmationEmailPayload {
  schoolId: string;
  studentId?: string;
  schoolName?: string;
  subdomain?: string;
  studentName: string;
  admissionNumber?: string | null;
  currentClass?: string | null;
  tierName?: string | null;
  studentEmail?: string | null;
  parentEmail?: string | null;
  parentName?: string | null;
  temporaryPassword?: string | null;
}

export interface StaffEnrollmentConfirmationEmailPayload {
  schoolId: string;
  staffId?: string;
  schoolName?: string;
  subdomain?: string;
  staffName: string;
  staffEmail: string;
  role?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  temporaryPassword?: string | null;
}

/**
 * Sends a confirmation email to the student and/or parent when a student is enrolled.
 * Dispatches via centralized mail service (Resend or SMTP) with automatic failovers.
 */
export async function sendStudentEnrollmentConfirmationEmail(payload: StudentEnrollmentConfirmationEmailPayload) {
  try {
    const {
      schoolId,
      studentId,
      studentName,
      admissionNumber,
      currentClass,
      tierName,
      studentEmail,
      parentEmail,
      parentName,
      temporaryPassword,
    } = payload;

    // Resolve school details if missing
    let schoolName = payload.schoolName;
    let subdomain = payload.subdomain;
    if ((!schoolName || !subdomain) && schoolId) {
      try {
        const school = await basePrisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true, subdomain: true },
        });
        if (school) {
          schoolName = schoolName || school.name;
          subdomain = subdomain || school.subdomain;
        }
      } catch (err) {
        console.warn("[EMAIL_SERVICE] Warning: Could not fetch school for student enrollment email:", err);
      }
    }

    const tenantName = schoolName || "School ERP";
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const portalUrl = subdomain ? `${baseUrl}/login?school=${encodeURIComponent(subdomain)}` : `${baseUrl}/login`;
    const brandColor = "#4f46e5";
    const subject = `🎉 Enrollment Confirmation - ${studentName} (${tenantName})`;

    // Collect valid recipients (student email and/or parent email)
    const rawRecipients = [parentEmail, studentEmail].filter(
      (e): e is string => typeof e === "string" && e.trim().length > 0 && e.includes("@")
    );
    const recipients = Array.from(new Set(rawRecipients.map((e) => e.trim().toLowerCase())));

    if (recipients.length === 0) {
      console.warn(`[EMAIL_SERVICE] Cannot dispatch student enrollment confirmation: No valid recipient email provided for ${studentName} (ID: ${studentId || "unknown"})`);
      return { success: false, deliveryStatus: "NO_RECIPIENT", error: "No recipient email address" };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student Enrollment Confirmed - ${tenantName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${brandColor}; padding: 36px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .content { padding: 36px 32px; line-height: 1.6; }
          .welcome-text { font-size: 16px; color: #334155; margin-bottom: 24px; }
          .credentials-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 5px solid ${brandColor}; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
          .cred-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; }
          .action-area { text-align: center; margin: 32px 0 20px 0; }
          .login-btn { display: inline-block; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.35); }
          .direct-link { font-size: 13px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-top: 20px; }
          .footer { padding: 24px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${tenantName}</h1>
            <p>Student Enrollment Confirmation</p>
          </div>
          <div class="content">
            <p class="welcome-text">
              ${parentName ? `Dear <strong>${parentName}</strong>,<br/><br/>` : ""}Congratulations! We are delighted to confirm that <strong>${studentName}</strong> has been successfully enrolled at <strong>${tenantName}</strong>. Welcome to our academic community!
            </p>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">Student Name</span>
                <span class="cred-value">${studentName}</span>
              </div>
              ${admissionNumber ? `
              <div class="cred-row">
                <span class="cred-label">Admission Number</span>
                <span class="cred-value">${admissionNumber}</span>
              </div>` : ""}
              ${currentClass ? `
              <div class="cred-row">
                <span class="cred-label">Class / Grade</span>
                <span class="cred-value">${currentClass}</span>
              </div>` : ""}
              ${tierName ? `
              <div class="cred-row">
                <span class="cred-label">Academic Tier</span>
                <span class="cred-value">${tierName}</span>
              </div>` : ""}
              <div class="cred-row">
                <span class="cred-label">Portal URL</span>
                <span class="cred-value">${portalUrl}</span>
              </div>
              ${studentEmail ? `
              <div class="cred-row">
                <span class="cred-label">Student Login</span>
                <span class="cred-value">${studentEmail}</span>
              </div>` : ""}
              ${temporaryPassword ? `
              <div class="cred-row">
                <span class="cred-label">Temporary Password</span>
                <span class="cred-value">${temporaryPassword}</span>
              </div>` : ""}
            </div>

            <div class="action-area">
              <a href="${portalUrl}" class="login-btn" target="_blank" rel="noopener noreferrer">
                Access Student Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              You can access the portal directly anytime at:
            </p>
            <div class="direct-link">
              <a href="${portalUrl}" style="color: ${brandColor}; font-weight: 600;">${portalUrl}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${tenantName} &bull; Powered by School ERP<br/>
            Need assistance? Contact the school admissions office or reply directly to this notification.
          </div>
        </div>
      </body>
      </html>
    `.trim();

    const dispatchResult = await dispatchEmail({
      to: recipients,
      subject,
      html: emailHtml,
      schoolId,
      recipientType: "STUDENT",
      logCategory: "STUDENT_ENROLLMENT",
    });

    console.log("----------------------------------------------------------------");
    console.log(`[STUDENT_ENROLLMENT_EMAIL] Dispatched to: ${recipients.join(", ")}`);
    console.log(`School: ${tenantName} (${subdomain || "default"})`);
    console.log(`Student: ${studentName} (${admissionNumber || "N/A"})`);
    console.log(`Delivery Status: ${dispatchResult.deliveryStatus}`);
    console.log("----------------------------------------------------------------");

    return {
      success: dispatchResult.success,
      deliveryStatus: dispatchResult.deliveryStatus,
      recipients,
      studentName,
      schoolName: tenantName,
      subject,
      error: dispatchResult.error,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to dispatch student enrollment confirmation email:", err);
    return { success: false, error: err.message, deliveryStatus: "FAILED_EXCEPTION" };
  }
}

/**
 * Sends a confirmation email to the staff member upon enrollment.
 * Dispatches via centralized mail service (Resend or SMTP).
 */
export async function sendStaffEnrollmentConfirmationEmail(payload: StaffEnrollmentConfirmationEmailPayload) {
  try {
    const {
      schoolId,
      staffId,
      staffName,
      staffEmail,
      role,
      departmentId,
      temporaryPassword,
    } = payload;

    // Resolve school details if missing
    let schoolName = payload.schoolName;
    let subdomain = payload.subdomain;
    if ((!schoolName || !subdomain) && schoolId) {
      try {
        const school = await basePrisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true, subdomain: true },
        });
        if (school) {
          schoolName = schoolName || school.name;
          subdomain = subdomain || school.subdomain;
        }
      } catch (err) {
        console.warn("[EMAIL_SERVICE] Warning: Could not fetch school for staff enrollment email:", err);
      }
    }

    // Resolve department name if missing
    let departmentName = payload.departmentName;
    if (!departmentName && departmentId) {
      try {
        const dept = await basePrisma.department.findUnique({
          where: { id: departmentId },
          select: { name: true },
        });
        if (dept) {
          departmentName = dept.name;
        }
      } catch {}
    }

    const tenantName = schoolName || "School ERP";
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const portalUrl = subdomain ? `${baseUrl}/login?school=${encodeURIComponent(subdomain)}` : `${baseUrl}/login`;
    const brandColor = "#4f46e5";
    const subject = `🎉 Staff Enrollment Confirmation - Welcome to ${tenantName}`;

    const normalizedStaffEmail = staffEmail?.trim().toLowerCase();
    if (!normalizedStaffEmail || !normalizedStaffEmail.includes("@")) {
      console.warn(`[EMAIL_SERVICE] Cannot dispatch staff enrollment confirmation: No valid email provided for ${staffName} (ID: ${staffId || "unknown"})`);
      return { success: false, deliveryStatus: "NO_RECIPIENT", error: "No valid staff email address" };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Staff Enrollment Confirmed - ${tenantName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${brandColor}; padding: 36px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .content { padding: 36px 32px; line-height: 1.6; }
          .welcome-text { font-size: 16px; color: #334155; margin-bottom: 24px; }
          .credentials-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 5px solid ${brandColor}; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
          .cred-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; }
          .action-area { text-align: center; margin: 32px 0 20px 0; }
          .login-btn { display: inline-block; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.35); }
          .direct-link { font-size: 13px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-top: 20px; }
          .footer { padding: 24px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${tenantName}</h1>
            <p>Staff Enrollment & Onboarding Confirmation</p>
          </div>
          <div class="content">
            <p class="welcome-text">
              Congratulations! Your staff account for <strong>${tenantName}</strong> has been successfully configured and enrolled on the School ERP platform.
            </p>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">Staff Name</span>
                <span class="cred-value">${staffName}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Role / Position</span>
                <span class="cred-value">${role || "Staff Member"}</span>
              </div>
              ${departmentName ? `
              <div class="cred-row">
                <span class="cred-label">Department</span>
                <span class="cred-value">${departmentName}</span>
              </div>` : ""}
              <div class="cred-row">
                <span class="cred-label">Portal URL</span>
                <span class="cred-value">${portalUrl}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Staff Login</span>
                <span class="cred-value">${normalizedStaffEmail}</span>
              </div>
              ${temporaryPassword ? `
              <div class="cred-row">
                <span class="cred-label">Temporary Password</span>
                <span class="cred-value">${temporaryPassword}</span>
              </div>` : ""}
            </div>

            <div class="action-area">
              <a href="${portalUrl}" class="login-btn" target="_blank" rel="noopener noreferrer">
                Access Staff Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              You can access the portal directly anytime at:
            </p>
            <div class="direct-link">
              <a href="${portalUrl}" style="color: ${brandColor}; font-weight: 600;">${portalUrl}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${tenantName} &bull; Powered by School ERP<br/>
            Need assistance? Contact the school administration or reply directly to this notification.
          </div>
        </div>
      </body>
      </html>
    `.trim();

    const dispatchResult = await dispatchEmail({
      to: normalizedStaffEmail,
      subject,
      html: emailHtml,
      schoolId,
      recipientType: "STAFF",
      logCategory: "STAFF_ENROLLMENT",
    });

    console.log("----------------------------------------------------------------");
    console.log(`[STAFF_ENROLLMENT_EMAIL] Dispatched to: ${normalizedStaffEmail}`);
    console.log(`School: ${tenantName} (${subdomain || "default"})`);
    console.log(`Staff: ${staffName} (${role || "Staff Member"})`);
    console.log(`Delivery Status: ${dispatchResult.deliveryStatus}`);
    console.log("----------------------------------------------------------------");

    return {
      success: dispatchResult.success,
      deliveryStatus: dispatchResult.deliveryStatus,
      recipient: normalizedStaffEmail,
      staffName,
      schoolName: tenantName,
      subject,
      error: dispatchResult.error,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to dispatch staff enrollment confirmation email:", err);
    return { success: false, error: err.message, deliveryStatus: "FAILED_EXCEPTION" };
  }
}

export interface ExamAdmitSlipEmailPayload {
  schoolId: string;
  applicantName: string;
  parentName?: string;
  applicationNo?: string;
  targetGrade?: string;
  tierName?: string;
  recipientEmail: string;
  rollNo: string;
  examDate?: string;
  arrivalTime?: string;
  venue?: string;
  subjects?: string | string[];
  admitSlipUrl?: string;
  schoolName?: string;
  subdomain?: string;
}

/**
 * Sends responsive email notifying applicant and parents of their Entrance Screening & Examination Admit Slip.
 * Dispatches via centralized Resend email service with complete schedule, venue details, and direct print link.
 */
export async function sendExamAdmitSlipEmail(payload: ExamAdmitSlipEmailPayload) {
  try {
    const {
      schoolId,
      applicantName,
      parentName = "Parent / Guardian",
      applicationNo,
      targetGrade = "Selected Grade",
      tierName = "General",
      recipientEmail,
      rollNo,
      examDate = "Saturday, 27th September 2026",
      arrivalTime = "08:30 AM Prompt",
      venue = "Main ICT Complex / Hall A",
      subjects = "Maths, English, General Paper",
      admitSlipUrl: propAdmitSlipUrl,
      schoolName: propSchoolName,
      subdomain: propSubdomain,
    } = payload;

    const school = await basePrisma.school.findFirst({
      where: { OR: [{ id: schoolId }, { subdomain: schoolId }] },
      select: { id: true, name: true, subdomain: true, contactPhone: true },
    }).catch(() => null);

    const tenantName = school?.name || propSchoolName || "School ERP";
    const sub = school?.subdomain || propSubdomain || "portal";
    const brandColor = (school as any)?.branding?.primaryColor || "#312e81";
    const secondaryColor = "#4338ca";

    const subjectsString = Array.isArray(subjects) ? subjects.join(", ") : subjects;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const admitSlipUrl = propAdmitSlipUrl || `${baseUrl}/${sub}/admissions/admit-slip/${encodeURIComponent(applicationNo || rollNo)}`;

    const subject = `Entrance Examination Admit Slip (Roll No: ${rollNo}) - ${tenantName}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; color: #1e293b; }
    .wrapper { max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, ${brandColor} 0%, ${secondaryColor} 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 800; }
    .body { padding: 32px; }
    .roll-box { background: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .roll-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
    .roll-value { font-size: 20px; font-weight: 900; font-family: monospace; letter-spacing: 1.5px; color: #38bdf8; margin-top: 4px; }
    .schedule-card { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 22px; margin: 24px 0; border-left: 5px solid #4f46e5; }
    .schedule-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; margin-bottom: 14px; }
    .schedule-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .schedule-item { padding: 4px 0; }
    .schedule-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 3px; }
    .schedule-val { font-size: 14px; font-weight: 700; color: #0f172a; }
    .btn-container { text-align: center; margin: 32px 0 20px 0; }
    .btn { display: inline-block; font-size: 15px; font-weight: 700; padding: 14px 36px; text-decoration: none; border-radius: 10px; background-color: #4f46e5; color: #ffffff; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); }
    .instructions-box { background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 16px 20px; margin: 24px 0; font-size: 13px; color: #92400e; line-height: 1.5; }
    .footer { padding: 24px 32px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Entrance Examination Admit Card</div>
      <h1>${tenantName}</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">Admissions &amp; Academic Board</p>
    </div>
    <div class="body">
      <h2 style="font-size: 18px; font-weight: 700; margin-top: 0; color: #0f172a;">Dear ${parentName || applicantName},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        Your entrance screening examination for candidate <strong>${applicantName}</strong> has been officially scheduled. Please review your screening schedule, assigned examination hall, and roll number below:
      </p>

      <div class="roll-box">
        <div class="roll-label">Official Examination Roll Number</div>
        <div class="roll-value">${rollNo}</div>
      </div>

      <div class="schedule-card">
        <div class="schedule-title">Screening Schedule &amp; Venue Details</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; width: 45%; vertical-align: top;">
              <span class="schedule-label">Candidate Name</span>
              <strong class="schedule-val">${applicantName}</strong>
            </td>
            <td style="padding: 6px 0; width: 55%; vertical-align: top;">
              <span class="schedule-label">Target Cohort / Tier</span>
              <strong class="schedule-val">${targetGrade} (${tierName})</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0 6px 0; vertical-align: top;">
              <span class="schedule-label">Test Date</span>
              <strong class="schedule-val">${examDate}</strong>
            </td>
            <td style="padding: 10px 0 6px 0; vertical-align: top;">
              <span class="schedule-label">Arrival &amp; Accreditation</span>
              <strong class="schedule-val">${arrivalTime}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0 6px 0; vertical-align: top;">
              <span class="schedule-label">Examination Hall</span>
              <strong class="schedule-val">${venue}</strong>
            </td>
            <td style="padding: 10px 0 6px 0; vertical-align: top;">
              <span class="schedule-label">Tested Subjects</span>
              <strong class="schedule-val">${subjectsString}</strong>
            </td>
          </tr>
        </table>
      </div>

      <div class="btn-container">
        <a href="${admitSlipUrl}" class="btn" target="_blank" rel="noopener noreferrer">
          View &amp; Print Exam Admit Slip &rarr;
        </a>
      </div>

      <div class="instructions-box">
        <strong>Important Examination Instructions:</strong>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>Candidates must arrive with a printed copy of this official Examination Admit Slip.</li>
          <li>Accreditation begins promptly at ${arrivalTime} at ${venue}.</li>
          <li>Writing materials (HB Pencils, Erasers, Pens) are required. Calculators and mobile devices are strictly prohibited.</li>
        </ul>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
        <strong>Direct Slip Access Link:</strong><br />
        <a href="${admitSlipUrl}" style="color: #4f46e5; font-weight: 600;">${admitSlipUrl}</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${tenantName}. All rights reserved.<br>
      Admissions &amp; Academic Board &bull; Contact: ${school?.contactPhone || "+234 (0) 800-SCHOOL-ERP"}
    </div>
  </div>
</body>
</html>
    `.trim();

    let dispatchResult: any = null;
    if (recipientEmail && recipientEmail.includes("@")) {
      dispatchResult = await dispatchEmail({
        to: recipientEmail,
        subject,
        html: emailHtml,
        schoolId: school?.id || schoolId,
        recipientType: "PARENT",
        logCategory: "ADMISSIONS_EXAM_ADMIT_SLIP",
      });
      console.log(`[EMAIL_SERVICE] Dispatched exam admit slip email via ${dispatchResult.provider} to ${recipientEmail}:`, dispatchResult);
    }

    return {
      success: true,
      recipient: recipientEmail,
      rollNo,
      tenantName,
      applicantName,
      subject,
      admitSlipUrl,
      dispatchResult,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to send exam admit slip email:", err);
    return { success: false, error: err?.message || String(err) };
  }
}




