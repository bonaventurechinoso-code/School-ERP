import { sendMail } from "@/lib/mail";

export interface ReceiptEmailParams {
  to: string;
  payerName: string;
  moduleType: string;
  referenceNo: string;
  amount: number;
  paymentDate?: Date | string;
  schoolName?: string;
  schoolId?: string;
  customWriteup?: string | null;
}

export interface ReceiptRejectedEmailParams extends ReceiptEmailParams {
  rejectionReason: string;
  reuploadUrl: string;
}

export interface PaymentInstructionEmailParams {
  to: string;
  applicantName: string;
  applicationNo: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  narration: string;
  uploadUrl: string;
  schoolName?: string;
  schoolId?: string;
  customWriteup?: string | null;
}


/**
 * 1. Receipt Received Notification
 */
export async function sendReceiptReceivedEmail(params: ReceiptEmailParams) {
  const dateStr = params.paymentDate
    ? new Date(params.paymentDate).toLocaleDateString()
    : new Date().toLocaleDateString();

  return sendMail({
    to: params.to,
    schoolId: params.schoolId,
    subject: `Payment Receipt Received — ${params.referenceNo} [${params.schoolName || "School Administration"}]`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Payment Receipt Acknowledged</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">${params.schoolName || "School Bursary Clearance"}</p>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Dear <strong>${params.payerName}</strong>,
        </p>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          We have received your payment proof submission for <strong>${params.moduleType.replace(/_/g, " ")}</strong>. Our Bursary Desk has queued your receipt for formal verification.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Reference No:</td>
              <td style="color: #0f172a; font-weight: bold; text-align: right; padding: 4px 0;">${params.referenceNo}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Amount Paid:</td>
              <td style="color: #059669; font-weight: bold; text-align: right; padding: 4px 0;">₦${Number(params.amount).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Payment Date:</td>
              <td style="color: #0f172a; text-align: right; padding: 4px 0;">${dateStr}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Current Status:</td>
              <td style="color: #d97706; font-weight: bold; text-align: right; padding: 4px 0;">PENDING VERIFICATION</td>
            </tr>
          </table>
        </div>

        ${
          params.customWriteup
            ? `
        <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #334155;">
          <strong>Institution Payment Note:</strong><br />
          ${params.customWriteup}
        </div>
        `
            : ""
        }

        <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          This is an automated receipt confirmation from ${params.schoolName || "SchoolERP Platform"}.
        </p>
      </div>
    `,
  }).catch((err) => console.warn("[EMAIL_SEND_RECEIPT_RECEIVED_WARN]:", err));
}

/**
 * 2. Receipt Verified Notification
 */
export async function sendReceiptVerifiedEmail(params: ReceiptEmailParams) {
  const isAccessFee =
    params.moduleType === "TRANSCRIPT_FEE" ||
    params.moduleType === "RESULT_CHECKING_FEE" ||
    params.moduleType === "REPORT_CARD_CHECKING_FEE";

  const accessMessage = isAccessFee
    ? `<div style="background-color: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 12px 16px; margin: 16px 0; color: #065f46; font-size: 13px;">
         <strong>✓ Access Clearance Unlocked:</strong> Your clearance for <strong>${params.moduleType.replace(/_/g, " ")}</strong> is now active. You may now immediately view and download your official document or results from your student portal.
       </div>`
    : "";

  return sendMail({
    to: params.to,
    schoolId: params.schoolId,
    subject: `Payment Receipt Verified ✓ — ${params.referenceNo} [${params.schoolName || "School Administration"}]`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #065f46; margin: 0; font-size: 20px;">Payment Verified &amp; Settled ✓</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Official Bursary Clearance</p>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Dear <strong>${params.payerName}</strong>,
        </p>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Your payment receipt for <strong>${params.moduleType.replace(/_/g, " ")}</strong> has been formally verified and approved by the Bursar.
        </p>

        ${accessMessage}

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #166534; padding: 4px 0;">Reference No:</td>
              <td style="color: #0f172a; font-weight: bold; text-align: right; padding: 4px 0;">${params.referenceNo}</td>
            </tr>
            <tr>
              <td style="color: #166534; padding: 4px 0;">Verified Amount:</td>
              <td style="color: #059669; font-weight: bold; text-align: right; padding: 4px 0;">₦${Number(params.amount).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #166534; padding: 4px 0;">Status:</td>
              <td style="color: #10b981; font-weight: bold; text-align: right; padding: 4px 0;">SETTLED &amp; CLEARED ✓</td>
            </tr>
          </table>
        </div>

        ${
          params.customWriteup
            ? `
        <div style="background-color: #f1f5f9; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #334155;">
          <strong>Institution Clearance Note:</strong><br />
          ${params.customWriteup}
        </div>
        `
            : ""
        }

        <p style="color: #334155; font-size: 13px;">
          Your record has been updated across the portal. Thank you for your prompt settlement.
        </p>
      </div>

    `,
  }).catch((err) => console.warn("[EMAIL_SEND_RECEIPT_VERIFIED_WARN]:", err));
}

/**
 * 3. Receipt Rejected Notification (with Reason + Re-upload link)
 */
export async function sendReceiptRejectedEmail(params: ReceiptRejectedEmailParams) {
  return sendMail({
    to: params.to,
    schoolId: params.schoolId,
    subject: `Action Required: Payment Receipt Issue — ${params.referenceNo}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #991b1b; margin: 0; font-size: 20px;">Payment Receipt Rejected</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Bursary Clearance Notice</p>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Dear <strong>${params.payerName}</strong>,
        </p>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          The finance desk could not verify your payment receipt proof for <strong>${params.moduleType.replace(/_/g, " ")}</strong> (Ref: <strong>${params.referenceNo}</strong>).
        </p>

        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0;">
          <p style="color: #991b1b; font-weight: bold; margin: 0 0 4px 0; font-size: 13px;">Reason from Bursar:</p>
          <p style="color: #7f1d1d; margin: 0; font-size: 13px;">${params.rejectionReason}</p>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Please upload a valid replacement receipt or updated transfer confirmation slip using the link below:
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.reuploadUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px; display: inline-block;">
            Re-Upload Payment Receipt
          </a>
        </div>
      </div>
    `,
  }).catch((err) => console.warn("[EMAIL_SEND_RECEIPT_REJECTED_WARN]:", err));
}

/**
 * 4. Payment Instruction Email (includes Account Details for Admissions)
 */
export async function sendPaymentInstructionEmail(params: PaymentInstructionEmailParams) {
  return sendMail({
    to: params.to,
    schoolId: params.schoolId,
    subject: `Payment Instructions for Application ${params.applicationNo} [${params.schoolName || "Admissions"}]`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Application Form Fee Payment Details</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">${params.schoolName || "Institution Admissions Desk"}</p>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Dear <strong>${params.applicantName}</strong> (or Guardian),
        </p>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Thank you for filing your admission application (Application No: <strong>${params.applicationNo}</strong>). Please complete payment of the mandatory application processing fee into the official institution account below:
        </p>

        <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #4338ca; padding: 6px 0;">Bank:</td>
              <td style="color: #1e1b4b; font-weight: bold; text-align: right; padding: 6px 0;">${params.bankName}</td>
            </tr>
            <tr>
              <td style="color: #4338ca; padding: 6px 0;">Account Number:</td>
              <td style="color: #4338ca; font-mono; font-size: 16px; font-weight: bold; text-align: right; padding: 6px 0;">${params.accountNumber}</td>
            </tr>
            <tr>
              <td style="color: #4338ca; padding: 6px 0;">Account Name:</td>
              <td style="color: #1e1b4b; font-weight: bold; text-align: right; padding: 6px 0;">${params.accountName}</td>
            </tr>
            <tr>
              <td style="color: #4338ca; padding: 6px 0;">Amount:</td>
              <td style="color: #059669; font-weight: bold; text-align: right; padding: 6px 0;">₦${Number(params.amount).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #4338ca; padding: 6px 0;">Required Narration:</td>
              <td style="color: #b45309; font-weight: bold; text-align: right; padding: 6px 0;">${params.narration || params.applicationNo}</td>
            </tr>
          </table>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          After making the transfer, please upload your payment receipt slip on your applicant tracking page so our Bursary can clear your dossier:
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.uploadUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px; display: inline-block;">
            Upload Payment Receipt
          </a>
        </div>
      </div>
    `,
  }).catch((err) => console.warn("[EMAIL_SEND_PAYMENT_INSTRUCTION_WARN]:", err));
}
