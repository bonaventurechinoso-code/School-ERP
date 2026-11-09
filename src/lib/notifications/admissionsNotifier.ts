import { sendMail } from "@/lib/mail";

export type AdmissionsLifecycleEvent =
  | "APPLICATION_INITIATED"
  | "RECEIPT_UPLOADED"
  | "PAYMENT_CONFIRMED"
  | "DOCUMENT_REJECTED"
  | "ASSESSMENT_SCHEDULED"
  | "PROVISIONAL_OFFER"
  | "ENROLLED";

export interface AdmissionsRecipient {
  name: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
}

export interface AdmissionsNotificationPayload {
  tenantId: string;
  schoolName: string;
  schoolSubdomain?: string;
  applicantNumber: string;
  recipient: AdmissionsRecipient;
  event: AdmissionsLifecycleEvent;
  // Tier & Institutional Classification
  tier?: string;
  targetGrade?: string;
  targetClass?: string;
  // Dynamic contextual details
  magicTrackingLink?: string;
  admissionsHotline?: string;
  reviewTimelineHours?: number;
  paymentReference?: string;
  amountPaid?: string | number;
  receiptDownloadUrl?: string;
  rejectedDocumentType?: string;
  rejectionReason?: string;
  reuploadLink?: string;
  assessmentDate?: string;
  assessmentVenue?: string;
  assessmentCbtCredentials?: { username: string; passcode: string };
  offerLetterUrl?: string;
  acceptanceDeadline?: string;
  acceptanceFeeAmount?: string | number;
  matriculationNumber?: string;
  studentPortalUrl?: string;
  portalUsername?: string;
  portalTempPassword?: string;
}

/**
 * Termii SMS Dispatcher
 */
async function sendTermiiSMS(to: string, message: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID || "SchoolERP";

  if (!apiKey) {
    console.log(`[SMS_DEV_STUB] To: ${to} | Msg: ${message}`);
    return { success: true, id: `stub_sms_${Date.now()}` };
  }

  try {
    const formattedPhone = to.startsWith("+") ? to.substring(1) : to.startsWith("0") ? `234${to.substring(1)}` : to;
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: formattedPhone,
        from: senderId,
        sms: message,
        type: "plain",
        channel: "generic",
        api_key: apiKey,
      }),
    });

    const data = await res.json();
    return { success: res.ok, id: data.message_id || data.id, error: data.message };
  } catch (err: any) {
    console.error("[SMS_DISPATCH_EXCEPTION]:", err);
    return { success: false, error: err.message };
  }
}

/**
 * WhatsApp Dispatcher (Meta Cloud API / Termii WhatsApp)
 */
async function sendWhatsAppMessage(
  to: string,
  message: string,
  mediaUrl?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const metaToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!metaToken || !metaPhoneId) {
    console.log(`[WHATSAPP_DEV_STUB] To: ${to} | Msg: ${message} | Media: ${mediaUrl || "None"}`);
    return { success: true, id: `stub_wa_${Date.now()}` };
  }

  try {
    const cleanPhone = to.replace(/[^0-9]/g, "");
    const body: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: { body: message },
    };

    const res = await fetch(`https://graph.facebook.com/v18.0/${metaPhoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return { success: res.ok, id: data?.messages?.[0]?.id, error: data?.error?.message };
  } catch (err: any) {
    console.error("[WHATSAPP_DISPATCH_EXCEPTION]:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Institutional Tier Classification & Terminology Matrix
 * Ensures appropriate language and feature framing for each school category
 */
export type InstitutionalTierType = "CRECHE" | "PRIMARY" | "SECONDARY" | "TERTIARY";

export interface TierTerminology {
  tier: InstitutionalTierType;
  isBasicEducation: boolean;
  candidateRole: string; // "Pupil" vs "Student"
  candidateRolePlural: string; // "Pupils" vs "Students"
  authorityBody: string; // "School Management and Head of School" vs "Principal and Academic Board" vs "Governing Council and Senate"
  idLabel: string; // "Pupil Admission Number" vs "Student Admission Number" vs "Matriculation Number"
  offerHeading: string; // "Provisional Admission Offer"
  enrollmentHeading: string; // "Pupil Enrollment & Admission Identity" vs "Student Enrollment & Identity" vs "Matriculation & Student Identity"
  academicScheduleText: string;
  portalDescription: string;
  enrollmentActionVerb: string; // "enrolled" vs "matriculated"
}

export function resolveInstitutionalTier(payload: AdmissionsNotificationPayload): InstitutionalTierType {
  const combined = [
    payload.tier,
    payload.targetGrade,
    payload.targetClass,
    payload.schoolName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // 1. Creche / Nursery / Early Years
  if (
    combined.includes("creche") ||
    combined.includes("nursery") ||
    combined.includes("toddler") ||
    combined.includes("early year") ||
    combined.includes("kindergarten") ||
    combined.includes("kg") ||
    combined.includes("daycare") ||
    combined.includes("reception")
  ) {
    return "CRECHE";
  }

  // 2. Tertiary / Higher Ed keywords
  if (
    combined.includes("university") ||
    combined.includes("polytechnic") ||
    combined.includes("monotechnic") ||
    combined.includes("college of education") ||
    combined.includes("faculty") ||
    combined.includes("undergraduate") ||
    combined.includes("postgraduate") ||
    combined.includes("degree") ||
    combined.includes("hnd") ||
    combined.includes("ond") ||
    combined.includes("senate")
  ) {
    return "TERTIARY";
  }

  // 3. Secondary / High School keywords
  if (
    combined.includes("secondary") ||
    combined.includes("high school") ||
    combined.includes("jss") ||
    combined.includes("sss") ||
    combined.includes("college") ||
    combined.includes("form 1") ||
    combined.includes("form 2") ||
    combined.includes("form 3") ||
    combined.includes("grade 7") ||
    combined.includes("grade 8") ||
    combined.includes("grade 9") ||
    combined.includes("grade 10") ||
    combined.includes("grade 11") ||
    combined.includes("grade 12") ||
    combined.includes("year 7") ||
    combined.includes("year 8") ||
    combined.includes("year 9") ||
    combined.includes("year 10") ||
    combined.includes("year 11") ||
    combined.includes("year 12")
  ) {
    return "SECONDARY";
  }

  // 4. Primary / Basic keywords (or default to Basic Education)
  return "PRIMARY";
}

export function getTierTerminology(tier: InstitutionalTierType): TierTerminology {
  switch (tier) {
    case "CRECHE":
      return {
        tier: "CRECHE",
        isBasicEducation: true,
        candidateRole: "Pupil",
        candidateRolePlural: "Pupils",
        authorityBody: "the School Management and Head of Early Years",
        idLabel: "Pupil Admission Number",
        offerHeading: "Provisional Admission Offer",
        enrollmentHeading: "Pupil Enrollment & Admission Identity",
        academicScheduleText: "view your allocated class, term learning schedule, and academic calendar",
        portalDescription: "personal pupil dashboard",
        enrollmentActionVerb: "enrolled",
      };

    case "PRIMARY":
      return {
        tier: "PRIMARY",
        isBasicEducation: true,
        candidateRole: "Pupil",
        candidateRolePlural: "Pupils",
        authorityBody: "the School Management and Head of School",
        idLabel: "Pupil Admission Number",
        offerHeading: "Provisional Admission Offer",
        enrollmentHeading: "Pupil Enrollment & Admission Identity",
        academicScheduleText: "view your allocated class, subjects curriculum, term academic calendar, and class timetable",
        portalDescription: "personal pupil dashboard",
        enrollmentActionVerb: "enrolled",
      };

    case "SECONDARY":
      return {
        tier: "SECONDARY",
        isBasicEducation: false,
        candidateRole: "Student",
        candidateRolePlural: "Students",
        authorityBody: "the Principal and School Academic Board",
        idLabel: "Student Admission Number",
        offerHeading: "Provisional Admission Offer",
        enrollmentHeading: "Student Enrollment & Identity",
        academicScheduleText: "view your assigned class arm, enrolled subjects, academic calendar, and class timetable",
        portalDescription: "personal student dashboard",
        enrollmentActionVerb: "enrolled",
      };

    case "TERTIARY":
      return {
        tier: "TERTIARY",
        isBasicEducation: false,
        candidateRole: "Student",
        candidateRolePlural: "Students",
        authorityBody: "the Governing Council and Senate / Academic Board",
        idLabel: "Matriculation Number",
        offerHeading: "Provisional Admission Offer",
        enrollmentHeading: "Matriculation & Student Identity",
        academicScheduleText: "complete semester course registration, download matriculation clearance, and access your lecture timetable",
        portalDescription: "personal student portal",
        enrollmentActionVerb: "matriculated",
      };
  }
}

/**
 * Template Builder for Lifecycle Events
 */
function buildMessageContents(payload: AdmissionsNotificationPayload): {
  subject: string;
  emailHtml: string;
  smsText: string;
  whatsAppText: string;
} {
  const { schoolName, applicantNumber, recipient, event } = payload;
  const name = recipient.name || "Applicant";

  switch (event) {
    case "APPLICATION_INITIATED": {
      const hotline = payload.admissionsHotline || "the admissions office";
      const tracking = payload.magicTrackingLink || "#";
      return {
        subject: `Application Initiated: ${applicantNumber} - ${schoolName}`,
        smsText: `${schoolName}: Dear ${name}, your application ${applicantNumber} is started. Track status at: ${tracking}`,
        whatsAppText: `*${schoolName} - Admissions Portal*\n\nDear *${name}*,\n\nYour admissions application has been initiated with Application ID: *${applicantNumber}*.\n\nYou can track your progress, submit documents, or check status here:\n👉 ${tracking}\n\nFor support, reach out to ${hotline}.`,
        emailHtml: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #1e3a8a; margin-top: 0;">Application Initiated</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>Welcome to <strong>${schoolName}</strong>. Your formal admissions application has been recorded under reference: <strong style="color: #2563eb;">${applicantNumber}</strong>.</p>
            <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px;">Use your one-click magic link below to monitor verification, complete fee payment, and view admission offers at any time:</p>
            </div>
            <p style="text-align: center; margin: 28px 0;">
              <a href="${tracking}" style="background-color: #1e3a8a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Access Applicant Portal</a>
            </p>
            <p style="font-size: 13px; color: #64748b;">Questions? Contact admissions support at: ${hotline}</p>
          </div>
        `,
      };
    }

    case "RECEIPT_UPLOADED": {
      const hours = payload.reviewTimelineHours || 24;
      return {
        subject: `Payment Receipt Received - ${applicantNumber} (${schoolName})`,
        smsText: `${schoolName}: Payment proof for application ${applicantNumber} received. Bursary review in progress (${hours} hrs).`,
        whatsAppText: `*${schoolName}*\n\nPayment receipt for application *${applicantNumber}* has been submitted. Our Bursary Desk is reviewing it within ${hours} hours. You will receive an alert once verified.`,
        emailHtml: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f766e; margin-top: 0;">Payment Proof Submitted</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>Your payment receipt for application <strong>${applicantNumber}</strong> has been successfully uploaded to the institutional review queue.</p>
            <p>Our Bursary and Admissions Reconciliation officers will reconcile this with our ledger within <strong>${hours} business hours</strong>. Upon clearance, your application will advance to full academic credential verification.</p>
          </div>
        `,
      };
    }

    case "PAYMENT_CONFIRMED": {
      const receiptUrl = payload.receiptDownloadUrl || "#";
      return {
        subject: `Official Payment Receipt: ${applicantNumber} Confirmed - ${schoolName}`,
        smsText: `${schoolName}: Payment confirmed for ${applicantNumber}! Official receipt: ${receiptUrl}. Document review unlocked.`,
        whatsAppText: `*${schoolName} - Payment Verified ✅*\n\nDear *${name}*,\n\nYour application fee payment has been verified by the Bursar.\n\n📄 Download Official Receipt: ${receiptUrl}\n\nYour academic document review queue is now officially unlocked!`,
        emailHtml: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #15803d; margin-top: 0;">Payment Verified & Confirmed</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>Your application fee payment for <strong>${applicantNumber}</strong> has been verified by the Bursar. Your application status has transitioned to <strong>SUBMITTED & UNDER REVIEW</strong>.</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${receiptUrl}" style="background-color: #15803d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Download Official Receipt (PDF)</a>
            </p>
            <p>Our admissions faculty will now review your uploaded credentials.</p>
          </div>
        `,
      };
    }

    case "DOCUMENT_REJECTED": {
      const doc = payload.rejectedDocumentType || "Credential";
      const reason = payload.rejectionReason || "Image blur or unreadable scan";
      const link = payload.reuploadLink || payload.magicTrackingLink || "#";
      return {
        subject: `ACTION REQUIRED: ${doc} Verification Query - ${applicantNumber}`,
        smsText: `${schoolName}: Attention! Your ${doc} was queried: "${reason}". Please re-upload within 72 hrs at: ${link}`,
        whatsAppText: `*${schoolName} - Action Required ⚠️*\n\nDear *${name}*,\n\nYour uploaded *${doc}* for application *${applicantNumber}* could not be approved.\n\n*Reason:* ${reason}\n\nPlease click below to re-upload a clear copy within *72 hours*:\n👉 ${link}`,
        emailHtml: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #b91c1c; margin-top: 0;">Action Required: Document Query</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>During credential verification for application <strong>${applicantNumber}</strong>, the Admissions Desk raised a query on your <strong>${doc}</strong>:</p>
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; margin: 18px 0; border-radius: 4px; color: #991b1b;">
              <strong>Query Reason:</strong> ${reason}
            </div>
            <p>To avoid delaying your admission consideration, please re-upload a clear replacement within <strong>72 hours</strong>:</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="background-color: #b91c1c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Re-Upload Corrected Document</a>
            </p>
          </div>
        `,
      };
    }

    case "ASSESSMENT_SCHEDULED": {
      const date = payload.assessmentDate || "TBA";
      const venue = payload.assessmentVenue || "Main Campus CBT Center";
      const creds = payload.assessmentCbtCredentials
        ? `Username: ${payload.assessmentCbtCredentials.username} | Passcode: ${payload.assessmentCbtCredentials.passcode}`
        : "";
      return {
        subject: `Entrance Assessment / Screening Schedule - ${applicantNumber} (${schoolName})`,
        smsText: `${schoolName}: Assessment scheduled for ${applicantNumber} on ${date} at ${venue}. Check email/portal for gate pass.`,
        whatsAppText: `*${schoolName} - Assessment Schedule 🗓️*\n\nDear *${name}*,\n\nYour entrance assessment for application *${applicantNumber}* is scheduled:\n\n📅 *Date/Time:* ${date}\n📍 *Venue:* ${venue}\n${creds ? `🔑 *CBT Login:* ${creds}\n` : ""}Please arrive with your gate pass QR code.`,
        emailHtml: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #4338ca; margin-top: 0;">Entrance Assessment Scheduled</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>You have been scheduled for the entrance screening assessment for application <strong>${applicantNumber}</strong>:</p>
            <ul style="line-height: 1.8;">
              <li><strong>Date & Time:</strong> ${date}</li>
              <li><strong>Venue:</strong> ${venue}</li>
              ${creds ? `<li><strong>CBT Credentials:</strong> ${creds}</li>` : ""}
            </ul>
            <p>Please present your printed gate pass QR code at the campus security checkpoint.</p>
          </div>
        `,
      };
    }

    case "PROVISIONAL_OFFER": {
      const terms = getTierTerminology(resolveInstitutionalTier(payload));
      const deadline = payload.acceptanceDeadline || "within 14 days";
      const fee = payload.acceptanceFeeAmount
        ? `NGN ${typeof payload.acceptanceFeeAmount === "number" ? payload.acceptanceFeeAmount.toLocaleString() : payload.acceptanceFeeAmount}`
        : "TBA";
      const offerLink = payload.offerLetterUrl || payload.magicTrackingLink || "#";
      return {
        subject: `CONGRATULATIONS: Provisional ${terms.candidateRole} Admission Offer - ${applicantNumber} (${schoolName})`,
        smsText: `Congratulations ${name}! You have been offered provisional admission to ${schoolName}. Acceptance deadline: ${deadline}. View offer: ${offerLink}`,
        whatsAppText: `*${schoolName} - ${terms.offerHeading} 🎉*\n\nDear *${name}*,\n\nCongratulations! ${terms.authorityBody} of *${schoolName}* is pleased to grant you provisional admission for your ${terms.candidateRole.toLowerCase()} application (Ref: *${applicantNumber}*).\n\n📄 *Download Formal Offer Letter:* ${offerLink}\n⏳ *Acceptance Deposit & Clearance Deadline:* ${deadline} (${fee})\n\nPlease accept your offer before the deadline to lock your slot.`,
        emailHtml: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 620px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; padding: 6px 14px; background: #ecfdf5; color: #047857; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Admissions Notice</span>
              <h1 style="color: #047857; margin: 12px 0 6px 0; font-size: 24px;">🎉 ${terms.offerHeading}</h1>
              <p style="color: #64748b; font-size: 14px; margin: 0;">Application Ref: <strong>${applicantNumber}</strong></p>
            </div>

            <p style="font-size: 15px; line-height: 1.6;">Dear <strong>${name}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6;">On behalf of <strong>${terms.authorityBody}</strong> of <strong>${schoolName}</strong>, we are delighted to offer you provisional admission into our academic community under application reference <strong>${applicantNumber}</strong>.</p>
            
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; margin: 24px 0; border-radius: 8px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #166534;"><strong>Candidate Role:</strong> ${terms.candidateRole}</p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #166534;"><strong>Acceptance Deadline:</strong> ${deadline}</p>
              <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Acceptance Deposit / Fee:</strong> ${fee}</p>
            </div>

            <p style="font-size: 15px; line-height: 1.6;">Please download and review your official provisional offer letter below. Accept your offer and complete clearance before the stated deadline to confirm your placement.</p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${offerLink}" style="background-color: #047857; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(4, 120, 87, 0.2);">Download Official Offer Letter (PDF)</a>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">This is an automated institutional notification from ${schoolName}. All rights reserved.</p>
          </div>
        `,
      };
    }

    case "ENROLLED": {
      const terms = getTierTerminology(resolveInstitutionalTier(payload));
      const matric = payload.matriculationNumber || applicantNumber;
      const user = payload.portalUsername || payload.recipient.email || matric;
      const tempPass = payload.portalTempPassword || "Welcome@123";
      const portalUrl = payload.studentPortalUrl || "#";
      const directSchoolDomain = payload.schoolSubdomain || "";

      return {
        subject: `Welcome to ${schoolName}! Your ${terms.idLabel}: ${matric}`,
        smsText: `Welcome to ${schoolName}! Your ${terms.idLabel} is ${matric}. Portal Login: ${portalUrl} | User: ${user} | Temp Password: ${tempPass}`,
        whatsAppText: `*${schoolName} - ${terms.enrollmentHeading}! 🎓*\n\nWelcome to ${schoolName}, *${name}*!\n\nYour admission clearance is finalized and you have been formally ${terms.enrollmentActionVerb}:\n\n🆔 *${terms.idLabel}:* ${matric}\n🌐 *Login URL:* ${portalUrl}\n👤 *Username / Login ID:* ${user}\n🔑 *Temporary Password:* ${tempPass}\n\n👉 *Next Step:* Log in to your ${terms.portalDescription} to ${terms.academicScheduleText}.`,
        emailHtml: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 620px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; padding: 6px 14px; background: #eff6ff; color: #1d4ed8; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Official Admission Clearance</span>
              <h1 style="color: #1e3a8a; margin: 12px 0 6px 0; font-size: 24px;">🎓 ${terms.enrollmentHeading}</h1>
              <p style="color: #64748b; font-size: 14px; margin: 0;">Application Ref: <strong>${applicantNumber}</strong></p>
            </div>

            <p style="font-size: 15px; line-height: 1.6;">Dear <strong>${name}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6;">Congratulations! Your admission clearance is finalized and you have been formally ${terms.enrollmentActionVerb} into <strong>${schoolName}</strong>.</p>
            
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 22px; margin: 24px 0; border-radius: 10px;">
              <h3 style="color: #1e3a8a; margin-top: 0; margin-bottom: 14px; font-size: 16px; border-bottom: 1px solid #dbeafe; padding-bottom: 8px;">🔑 Your Personal Access Credentials</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.8;">
                <tr>
                  <td style="color: #475569; width: 42%; padding: 4px 0;"><strong>${terms.idLabel}:</strong></td>
                  <td style="font-size: 15px; font-weight: bold; color: #1e3a8a; padding: 4px 0;">${matric}</td>
                </tr>
                <tr>
                  <td style="color: #475569; padding: 4px 0;"><strong>Username / Login ID:</strong></td>
                  <td style="font-weight: 600; color: #0f172a; padding: 4px 0;"><code>${user}</code></td>
                </tr>
                <tr>
                  <td style="color: #475569; padding: 4px 0;"><strong>Temporary Password:</strong></td>
                  <td style="font-weight: 600; color: #b91c1c; padding: 4px 0;"><code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${tempPass}</code></td>
                </tr>
                ${directSchoolDomain ? `
                <tr>
                  <td style="color: #475569; padding: 4px 0;"><strong>School Code:</strong></td>
                  <td style="font-weight: 600; color: #0f172a; padding: 4px 0;"><code>${directSchoolDomain}</code></td>
                </tr>
                ` : ""}
                <tr>
                  <td style="color: #475569; padding: 4px 0;"><strong>Candidate Role:</strong></td>
                  <td style="color: #0f172a; padding: 4px 0;">${terms.candidateRole} (RBAC: STUDENT)</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${portalUrl}" style="background-color: #1e40af; color: #ffffff; padding: 14px 34px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(30, 64, 175, 0.25);">Login to ${terms.portalDescription}</a>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #334155; line-height: 1.6;">
              <strong style="color: #0f172a;">Next Steps for ${terms.candidateRole}:</strong>
              <p style="margin: 6px 0 0 0;">Please log in immediately to your ${terms.portalDescription} to <strong>${terms.academicScheduleText}</strong>. Upon initial sign-in, you will be prompted to replace the temporary password with your own secure password.</p>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">This is an automated institutional credential dispatch for ${name} at ${schoolName}.</p>
          </div>
        `,
      };
    }
  }
}

/**
 * Omnichannel Admissions Notification Dispatcher
 * Dispatches Email, SMS, and WhatsApp concurrently with error isolation
 */
export async function dispatchAdmissionsNotification(
  payload: AdmissionsNotificationPayload
): Promise<{
  success: boolean;
  emailSent: boolean;
  smsSent: boolean;
  whatsAppSent: boolean;
  errors: string[];
}> {
  const { subject, emailHtml, smsText, whatsAppText } = buildMessageContents(payload);
  const errors: string[] = [];

  let emailSent = false;
  let smsSent = false;
  let whatsAppSent = false;

  const phone = payload.recipient.phone;
  const whatsapp = payload.recipient.whatsappNumber || phone;
  const email = payload.recipient.email;

  const promises: Promise<any>[] = [];

  // 1. Email Dispatch
  if (email && email.includes("@")) {
    promises.push(
      sendMail({
        to: email,
        subject,
        html: emailHtml,
        schoolId: payload.tenantId,
        logCategory: "ADMISSIONS_NOTIFIER",
      })
        .then((res) => {
          if (res.success) emailSent = true;
          else errors.push(`Email error: ${res.error || "delivery failed"}`);
        })
        .catch((err) => errors.push(`Email exception: ${err.message}`))
    );
  }

  // 2. SMS Dispatch
  if (phone) {
    promises.push(
      sendTermiiSMS(phone, smsText)
        .then((res) => {
          if (res.success) smsSent = true;
          else errors.push(`SMS error: ${res.error}`);
        })
        .catch((err) => errors.push(`SMS exception: ${err.message}`))
    );
  }

  // 3. WhatsApp Dispatch
  if (whatsapp) {
    promises.push(
      sendWhatsAppMessage(whatsapp, whatsAppText)
        .then((res) => {
          if (res.success) whatsAppSent = true;
          else errors.push(`WhatsApp error: ${res.error}`);
        })
        .catch((err) => errors.push(`WhatsApp exception: ${err.message}`))
    );
  }

  await Promise.allSettled(promises);

  return {
    success: emailSent || smsSent || whatsAppSent,
    emailSent,
    smsSent,
    whatsAppSent,
    errors,
  };
}
