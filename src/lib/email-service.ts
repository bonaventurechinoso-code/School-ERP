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
}

/**
 * Sends responsive email notifying applicant of received application and next step to upload documents
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
      subdomain = "udoka",
    } = payload;

    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true, contactPhone: true },
    }).catch(() => null);

    const tenantName = school?.name || payload.schoolName || "School ERP";
    const sub = school?.subdomain || subdomain;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    const trackUrl = `${baseUrl}/${sub}/admissions/track/${applicationNo}`;

    const isDev = process.env.NODE_ENV !== "production";
    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

    if (isDev || !hasSmtp) {
      console.log("[MOCK EMAIL] " + trackUrl);
      return { success: true, trackUrl, trackingUrl: trackUrl };
    }

    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || "School ERP <noreply@bonaveeict.com.ng>",
        to: recipientEmail,
        subject: `Application Received - App No: ${applicationNo}`,
        html: `<p>Dear ${parentName || applicantName},</p><p>Your application (App No: ${applicationNo}) has been received for ${tenantName} (${targetGrade}).</p><p>Next step: upload documents at <a href="${trackUrl}">${trackUrl}</a></p>`,
      });
    } catch (smtpErr: any) {
      console.log("[MOCK EMAIL] " + trackUrl);
    }

    return { success: true, trackUrl, trackingUrl: trackUrl };
  } catch (err: any) {
    return { success: true };
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
    if (schoolId && recipientEmail) {
      setImmediate(async () => {
        try {
          await basePrisma.messageLog.create({
            data: {
              schoolId,
              recipientEmail: recipientEmail,
              recipientType: "PARENT",
              messageType: "EMAIL",
              subject,
              body: emailHtml,
              sentAt: new Date(),
            },
          });
        } catch (dbErr) {
          // Log failure without halting caller
        }
      });
    }

    return {
      success: true,
      messageId,
      recipient: displayRecipient,
      tenantName,
      applicantName,
      subject,
      emailHtml,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to send inquiry acknowledgment email:", err);
    return null;
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
    const messageId = `<reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@schoolerp.internal>`;
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

    let deliveryStatus = "SIMULATED";

    console.log(`[EMAIL_SERVICE] Initiating registration success email for: ${adminEmail}`);
    console.log(`[EMAIL_SERVICE] Config check: RESEND_API_KEY=${!!process.env.RESEND_API_KEY} (length: ${process.env.RESEND_API_KEY?.length || 0}), SMTP_HOST=${process.env.SMTP_HOST || "none"}`);

    // 1. Dispatch via Resend API if RESEND_API_KEY is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const fromAddress = process.env.EMAIL_FROM || "School ERP <noreply@bonaveeict.com.ng>";
        console.log(`[EMAIL_SERVICE] Sending via Resend API (From: "${fromAddress}", To: "${adminEmail}")...`);
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [adminEmail],
            subject,
            html: emailHtml,
          }),
        });
        const resendData = await resendRes.json();
        console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${resendRes.status}`);
        console.log(`[EMAIL_SERVICE] Resend API Response:`, JSON.stringify(resendData));

        if (resendRes.ok) {
          deliveryStatus = `DELIVERED_RESEND (id: ${resendData.id})`;
          console.log(`[EMAIL_DISPATCH] Resend email successfully delivered to ${adminEmail} (id: ${resendData.id})`);
        } else {
          console.error(`[EMAIL_DISPATCH] Resend returned error status ${resendRes.status} for ${adminEmail}:`, resendData);
          if (fromAddress !== "onboarding@resend.dev" && fromAddress !== "School ERP <onboarding@resend.dev>") {
            console.warn(`[EMAIL_SERVICE] Primary sender '${fromAddress}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);
            try {
              const fallbackRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "School ERP <onboarding@resend.dev>",
                  to: [adminEmail],
                  subject,
                  html: emailHtml,
                }),
              });
              const fallbackData = await fallbackRes.json();
              console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${fallbackRes.status}`);
              console.log(`[EMAIL_SERVICE] Fallback Resend API Response:`, JSON.stringify(fallbackData));
              if (fallbackRes.ok) {
                deliveryStatus = `DELIVERED_RESEND_FALLBACK (id: ${fallbackData.id})`;
                console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${adminEmail} (id: ${fallbackData.id})`);
              }
            } catch (fbErr: any) {
              console.error("[EMAIL_DISPATCH] Fallback Resend exception:", fbErr?.message || fbErr);
            }
          }
        }
      } catch (resendErr: any) {
        console.error("[EMAIL_DISPATCH] Resend fetch exception:", resendErr?.message || resendErr);
      }
    }

    // 2. Dispatch via SMTP (Nodemailer) if SMTP is configured
    if (deliveryStatus === "SIMULATED" && process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
          },
        });
        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER || "School ERP <noreply@bonaveeict.com.ng>",
          to: adminEmail,
          subject,
          html: emailHtml,
        });
        deliveryStatus = `DELIVERED_SMTP (id: ${info.messageId})`;
        console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${adminEmail}:`, info.messageId);
      } catch (smtpErr: any) {
        console.error("[EMAIL_DISPATCH] SMTP dispatch exception:", smtpErr?.message || smtpErr);
      }
    }

    if (deliveryStatus === "SIMULATED" && !process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
      console.warn(`[EMAIL_SERVICE] NOTICE: No email provider configured on Render! Add RESEND_API_KEY to Render Environment Variables.`);
    }

    // 3. Fallback / Transport Logging
    console.log("----------------------------------------------------------------");
    console.log(`[REGISTRATION_EMAIL] Dispatched to: ${adminEmail}`);
    console.log(`School: ${schoolName} (${subdomain})`);
    console.log(`Portal URL: ${portalUrl}`);
    console.log(`Delivery Status: ${deliveryStatus}`);
    console.log("----------------------------------------------------------------");

    // Write to local log file
    try {
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFilePath = path.join(logsDir, "registration-emails.log");
      const logEntry = `[${new Date().toISOString()}] STATUS=${deliveryStatus} TO="${adminEmail}" SCHOOL="${schoolName}" PORTAL="${portalUrl}"\n`;
      fs.appendFileSync(logFilePath, logEntry, "utf8");
    } catch {}

    // Persist to MessageLog table
    if (schoolId) {
      try {
        await basePrisma.messageLog.create({
          data: {
            schoolId,
            recipientEmail: adminEmail.toLowerCase().trim(),
            recipientType: "STAFF",
            messageType: "EMAIL",
            subject,
            body: emailHtml,
            sentAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.warn("[EMAIL_SERVICE] Warning: Could not save message log to DB:", dbErr);
      }
    }

    return {
      success: true,
      deliveryStatus,
      recipient: adminEmail,
      schoolName,
      portalUrl,
      subject,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to dispatch registration success email:", err);
    return { success: false, error: err.message };
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
 * Dispatches via Resend API using FROM = "School ERP <noreply@bonaveeict.com.ng>".
 * Uses the same email template style as the school registration welcome email.
 * Non-blocking: logs failures without throwing exceptions.
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
    const messageId = `<student-enroll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@schoolerp.internal>`;
    const subject = `🎉 Enrollment Confirmation - ${studentName} (${tenantName})`;

    // Collect valid recipients (student email and/or parent email)
    const rawRecipients = [parentEmail, studentEmail].filter(
      (e): e is string => typeof e === "string" && e.trim().length > 0 && e.includes("@")
    );
    const recipients = Array.from(new Set(rawRecipients.map((e) => e.trim().toLowerCase())));

    if (recipients.length === 0) {
      console.warn(`[EMAIL_SERVICE] Cannot dispatch student enrollment confirmation: No valid recipient email provided for ${studentName} (ID: ${studentId || "unknown"})`);
      return { success: false, error: "No recipient email address" };
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

    let deliveryStatus = "SIMULATED";
    const fromAddress = "School ERP <noreply@bonaveeict.com.ng>";

    console.log(`[EMAIL_SERVICE] Initiating student enrollment confirmation for: ${recipients.join(", ")}`);

    // 1. Dispatch via Resend API if RESEND_API_KEY is configured
    if (process.env.RESEND_API_KEY) {
      try {
        console.log(`[EMAIL_SERVICE] Sending student enrollment confirmation via Resend API (From: "${fromAddress}", To: ${JSON.stringify(recipients)})...`);
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: recipients,
            subject,
            html: emailHtml,
          }),
        });
        const resendData = await resendRes.json();
        console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${resendRes.status}`);
        console.log(`[EMAIL_SERVICE] Resend API Response:`, JSON.stringify(resendData));

        if (resendRes.ok) {
          deliveryStatus = `DELIVERED_RESEND (id: ${resendData.id})`;
          console.log(`[EMAIL_DISPATCH] Student enrollment confirmation delivered to ${recipients.join(", ")} (id: ${resendData.id})`);
        } else {
          console.error(`[EMAIL_DISPATCH] Resend returned error status ${resendRes.status} for ${recipients.join(", ")}:`, resendData);
          console.warn(`[EMAIL_SERVICE] Primary sender '${fromAddress}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);
          try {
              const fallbackRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "School ERP <onboarding@resend.dev>",
                  to: recipients,
                  subject,
                  html: emailHtml,
                }),
              });
              const fallbackData = await fallbackRes.json();
              console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${fallbackRes.status}`);
              console.log(`[EMAIL_SERVICE] Fallback Resend API Response:`, JSON.stringify(fallbackData));
              if (fallbackRes.ok) {
                deliveryStatus = `DELIVERED_RESEND_FALLBACK (id: ${fallbackData.id})`;
                console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${recipients.join(", ")} (id: ${fallbackData.id})`);
              }
            } catch (fbErr: any) {
              console.error("[EMAIL_DISPATCH] Fallback Resend exception:", fbErr?.message || fbErr);
            }
        }
      } catch (resendErr: any) {
        console.error("[EMAIL_DISPATCH] Resend fetch exception:", resendErr?.message || resendErr);
      }
    }

    // 2. Dispatch via SMTP if configured and Resend not delivered
    if (deliveryStatus === "SIMULATED" && process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
          },
        });
        const info = await transporter.sendMail({
          from: fromAddress,
          to: recipients,
          subject,
          html: emailHtml,
        });
        deliveryStatus = `DELIVERED_SMTP (id: ${info.messageId})`;
        console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${recipients.join(", ")}:`, info.messageId);
      } catch (smtpErr: any) {
        console.error("[EMAIL_DISPATCH] SMTP dispatch exception:", smtpErr?.message || smtpErr);
      }
    }

    // 3. Fallback / Transport Logging
    console.log("----------------------------------------------------------------");
    console.log(`[STUDENT_ENROLLMENT_EMAIL] Dispatched to: ${recipients.join(", ")}`);
    console.log(`School: ${tenantName} (${subdomain || "default"})`);
    console.log(`Student: ${studentName} (${admissionNumber || "N/A"})`);
    console.log(`Delivery Status: ${deliveryStatus}`);
    console.log("----------------------------------------------------------------");

    // Local file log
    try {
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFilePath = path.join(logsDir, "enrollment-emails.log");
      const logEntry = `[${new Date().toISOString()}] TYPE=STUDENT STATUS=${deliveryStatus} TO="${recipients.join(", ")}" SCHOOL="${tenantName}" STUDENT="${studentName}"\n`;
      fs.appendFileSync(logFilePath, logEntry, "utf8");
    } catch {}

    // Persist to MessageLog table
    if (schoolId) {
      for (const recipient of recipients) {
        try {
          await basePrisma.messageLog.create({
            data: {
              schoolId,
              recipientEmail: recipient,
              recipientType: recipient === parentEmail?.toLowerCase().trim() ? "PARENT" : "STUDENT",
              messageType: "EMAIL",
              subject,
              body: emailHtml,
              sentAt: new Date(),
            },
          });
        } catch (dbErr) {
          console.warn("[EMAIL_SERVICE] Warning: Could not save student enrollment message log to DB:", dbErr);
        }
      }
    }

    return {
      success: true,
      deliveryStatus,
      recipients,
      studentName,
      schoolName: tenantName,
      subject,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to dispatch student enrollment confirmation email:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a confirmation email to the staff member upon enrollment.
 * Dispatches via Resend API using FROM = "School ERP <noreply@bonaveeict.com.ng>".
 * Uses the same email template style as the school registration welcome email.
 * Non-blocking: logs failures without throwing exceptions.
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
    const messageId = `<staff-enroll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@schoolerp.internal>`;
    const subject = `🎉 Staff Enrollment Confirmation - Welcome to ${tenantName}`;

    const normalizedStaffEmail = staffEmail?.trim().toLowerCase();
    if (!normalizedStaffEmail || !normalizedStaffEmail.includes("@")) {
      console.warn(`[EMAIL_SERVICE] Cannot dispatch staff enrollment confirmation: No valid email provided for ${staffName} (ID: ${staffId || "unknown"})`);
      return { success: false, error: "No valid staff email address" };
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

    let deliveryStatus = "SIMULATED";
    const fromAddress = "School ERP <noreply@bonaveeict.com.ng>";

    console.log(`[EMAIL_SERVICE] Initiating staff enrollment confirmation for: ${normalizedStaffEmail}`);

    // 1. Dispatch via Resend API if RESEND_API_KEY is configured
    if (process.env.RESEND_API_KEY) {
      try {
        console.log(`[EMAIL_SERVICE] Sending staff enrollment confirmation via Resend API (From: "${fromAddress}", To: "${normalizedStaffEmail}")...`);
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [normalizedStaffEmail],
            subject,
            html: emailHtml,
          }),
        });
        const resendData = await resendRes.json();
        console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${resendRes.status}`);
        console.log(`[EMAIL_SERVICE] Resend API Response:`, JSON.stringify(resendData));

        if (resendRes.ok) {
          deliveryStatus = `DELIVERED_RESEND (id: ${resendData.id})`;
          console.log(`[EMAIL_DISPATCH] Staff enrollment confirmation delivered to ${normalizedStaffEmail} (id: ${resendData.id})`);
        } else {
          console.error(`[EMAIL_DISPATCH] Resend returned error status ${resendRes.status} for ${normalizedStaffEmail}:`, resendData);
          console.warn(`[EMAIL_SERVICE] Primary sender '${fromAddress}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);
          try {
              const fallbackRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "School ERP <onboarding@resend.dev>",
                  to: [normalizedStaffEmail],
                  subject,
                  html: emailHtml,
                }),
              });
              const fallbackData = await fallbackRes.json();
              console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${fallbackRes.status}`);
              console.log(`[EMAIL_SERVICE] Fallback Resend API Response:`, JSON.stringify(fallbackData));
              if (fallbackRes.ok) {
                deliveryStatus = `DELIVERED_RESEND_FALLBACK (id: ${fallbackData.id})`;
                console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${normalizedStaffEmail} (id: ${fallbackData.id})`);
              }
            } catch (fbErr: any) {
              console.error("[EMAIL_DISPATCH] Fallback Resend exception:", fbErr?.message || fbErr);
            }
        }
      } catch (resendErr: any) {
        console.error("[EMAIL_DISPATCH] Resend fetch exception:", resendErr?.message || resendErr);
      }
    }

    // 2. Dispatch via SMTP if configured and Resend not delivered
    if (deliveryStatus === "SIMULATED" && process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
          },
        });
        const info = await transporter.sendMail({
          from: fromAddress,
          to: normalizedStaffEmail,
          subject,
          html: emailHtml,
        });
        deliveryStatus = `DELIVERED_SMTP (id: ${info.messageId})`;
        console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${normalizedStaffEmail}:`, info.messageId);
      } catch (smtpErr: any) {
        console.error("[EMAIL_DISPATCH] SMTP dispatch exception:", smtpErr?.message || smtpErr);
      }
    }

    // 3. Fallback / Transport Logging
    console.log("----------------------------------------------------------------");
    console.log(`[STAFF_ENROLLMENT_EMAIL] Dispatched to: ${normalizedStaffEmail}`);
    console.log(`School: ${tenantName} (${subdomain || "default"})`);
    console.log(`Staff: ${staffName} (${role || "Staff Member"})`);
    console.log(`Delivery Status: ${deliveryStatus}`);
    console.log("----------------------------------------------------------------");

    // Local file log
    try {
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFilePath = path.join(logsDir, "enrollment-emails.log");
      const logEntry = `[${new Date().toISOString()}] TYPE=STAFF STATUS=${deliveryStatus} TO="${normalizedStaffEmail}" SCHOOL="${tenantName}" STAFF="${staffName}"\n`;
      fs.appendFileSync(logFilePath, logEntry, "utf8");
    } catch {}

    // Persist to MessageLog table
    if (schoolId) {
      try {
        await basePrisma.messageLog.create({
          data: {
            schoolId,
            recipientEmail: normalizedStaffEmail,
            recipientType: "STAFF",
            messageType: "EMAIL",
            subject,
            body: emailHtml,
            sentAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.warn("[EMAIL_SERVICE] Warning: Could not save staff enrollment message log to DB:", dbErr);
      }
    }

    return {
      success: true,
      deliveryStatus,
      recipient: normalizedStaffEmail,
      staffName,
      schoolName: tenantName,
      subject,
    };
  } catch (err: any) {
    console.error("[EMAIL_SERVICE] Failed to dispatch staff enrollment confirmation email:", err);
    return { success: false, error: err.message };
  }
}




