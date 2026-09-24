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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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


