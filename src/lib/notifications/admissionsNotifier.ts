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
      const deadline = payload.acceptanceDeadline || "within 14 days";
      const fee = payload.acceptanceFeeAmount ? `NGN ${payload.acceptanceFeeAmount}` : "TBA";
      const offerLink = payload.offerLetterUrl || payload.magicTrackingLink || "#";
      return {
        subject: `CONGRATULATIONS: Provisional Admission Offer - ${applicantNumber} (${schoolName})`,
        smsText: `Congratulations ${name}! You have been offered provisional admission to ${schoolName}. Acceptance deadline: ${deadline}. View offer: ${offerLink}`,
        whatsAppText: `*${schoolName} - Provisional Offer of Admission 🎉*\n\nDear *${name}*,\n\nCongratulations! You have been granted provisional admission (Ref: *${applicantNumber}*).\n\n📄 *Download Formal Offer Letter:* ${offerLink}\n⏳ *Acceptance Fee & Clearance Deadline:* ${deadline} (${fee})\n\nPlease accept your offer before the deadline to lock your slot.`,
        emailHtml: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #047857; margin-top: 0;">🎉 Provisional Offer of Admission</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>On behalf of the Governing Council and Academic Board of <strong>${schoolName}</strong>, we are thrilled to offer you provisional admission under application <strong>${applicantNumber}</strong>.</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 18px; margin: 20px 0; border-radius: 8px;">
              <p style="margin: 0 0 8px 0;"><strong>Acceptance Deadline:</strong> ${deadline}</p>
              <p style="margin: 0;"><strong>Acceptance Deposit:</strong> ${fee}</p>
            </div>
            <p style="text-align: center; margin: 28px 0;">
              <a href="${offerLink}" style="background-color: #047857; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Download Official Offer Letter (PDF)</a>
            </p>
          </div>
        `,
      };
    }

    case "ENROLLED": {
      const matric = payload.matriculationNumber || applicantNumber;
      const portalUrl = payload.studentPortalUrl || "#";
      const user = payload.portalUsername || payload.recipient.email || matric;
      const tempPass = payload.portalTempPassword || "Welcome@123";
      return {
        subject: `Welcome to ${schoolName}! Your Matriculation No: ${matric}`,
        smsText: `Welcome to ${schoolName}! Your Matric/Admission No is ${matric}. Portal: ${portalUrl} (User: ${user})`,
        whatsAppText: `*${schoolName} - Matriculation & Enrolled! 🎓*\n\nWelcome to ${schoolName}, *${name}*!\n\nYour clearance is complete and you are formally enrolled:\n\n🆔 *Matriculation / Admission No:* ${matric}\n🌐 *Student Portal:* ${portalUrl}\n👤 *Username:* ${user}\n🔑 *Temporary Password:* ${tempPass}\n\nPlease log in and update your password immediately.`,
        emailHtml: `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #1e3a8a; margin-top: 0;">🎓 Formal Enrollment & Student Identity</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>Congratulations! Your admission clearance is finalized and you have been formally matriculated into <strong>${schoolName}</strong>.</p>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 18px; margin: 20px 0; border-radius: 8px;">
              <p style="margin: 0 0 6px 0;"><strong>Matriculation / Admission Number:</strong> <span style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${matric}</span></p>
              <p style="margin: 0 0 6px 0;"><strong>Portal Login URL:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
              <p style="margin: 0 0 6px 0;"><strong>Username:</strong> ${user}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> <code>${tempPass}</code></p>
            </div>
            <p>Please log in immediately to complete course registration and access your lecture timetable.</p>
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
