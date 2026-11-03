import { basePrisma } from "@/lib/tenant-prisma";
import {
  sendReceiptReceivedEmail,
  sendReceiptVerifiedEmail,
  sendReceiptRejectedEmail,
} from "@/lib/email";
import { logAuditEvent } from "@/lib/audit-logger";
import {
  PaymentSettingsController,
  PaymentTransactionMode,
  PaymentTransactionState,
} from "@/lib/payment-settings-controller";
import crypto from "crypto";

export type ModuleType =
  | "ADMISSION_FORM_FEE"
  | "PLATFORM_SUBSCRIPTION"
  | "TUITION"
  | "PTA"
  | "EXAM"
  | "UNIFORM"
  | "BOOKS"
  | "TRANSPORT"
  | "HOSTEL"
  | "TRANSCRIPT_FEE"
  | "RESULT_CHECKING_FEE"
  | "REPORT_CARD_CHECKING_FEE"
  | "OTHER";

export interface ModuleDefinition {
  moduleType: ModuleType;
  defaultTitle: string;
  defaultAmount: number;
  defaultEnabled: boolean;
  category: "ADMISSIONS" | "ACADEMICS" | "FEES" | "SERVICES" | "SUBSCRIPTION";
  description: string;
}

export const ALL_MODULE_TYPES: ModuleDefinition[] = [
  {
    moduleType: "ADMISSION_FORM_FEE",
    defaultTitle: "Application Fee",
    defaultAmount: 5000,
    defaultEnabled: true,
    category: "ADMISSIONS",
    description: "Processing fee required when prospective students submit application forms.",
  },
  {
    moduleType: "TUITION",
    defaultTitle: "School Tuition Fee",
    defaultAmount: 50000,
    defaultEnabled: true,
    category: "FEES",
    description: "Regular termly or annual academic tuition fees.",
  },
  {
    moduleType: "PLATFORM_SUBSCRIPTION",
    defaultTitle: "School Platform Subscription",
    defaultAmount: 25000,
    defaultEnabled: true,
    category: "SUBSCRIPTION",
    description: "Annual institution software license and cloud hosting renewal.",
  },
  {
    moduleType: "RESULT_CHECKING_FEE",
    defaultTitle: "Terminal Result Checking Fee",
    defaultAmount: 2000,
    defaultEnabled: false,
    category: "ACADEMICS",
    description: "Institution fee to unlock student examination result slip / portal view.",
  },
  {
    moduleType: "REPORT_CARD_CHECKING_FEE",
    defaultTitle: "Report Card & Broadsheet Access Fee",
    defaultAmount: 2000,
    defaultEnabled: false,
    category: "ACADEMICS",
    description: "Institution fee to unlock terminal report card and performance sheet download.",
  },
  {
    moduleType: "TRANSCRIPT_FEE",
    defaultTitle: "Official Academic Transcript Fee",
    defaultAmount: 10000,
    defaultEnabled: false,
    category: "ACADEMICS",
    description: "Processing fee for issuing certified student academic transcripts.",
  },
  {
    moduleType: "EXAM",
    defaultTitle: "External / Mock Examination Fee",
    defaultAmount: 15000,
    defaultEnabled: false,
    category: "ACADEMICS",
    description: "Fees for WAEC, NECO, BECE, JAMB, or internal mock exam clearance.",
  },
  {
    moduleType: "PTA",
    defaultTitle: "Parents Teachers Association (PTA) Levy",
    defaultAmount: 3000,
    defaultEnabled: false,
    category: "FEES",
    description: "Termly developmental levy collected on behalf of the PTA.",
  },
  {
    moduleType: "UNIFORM",
    defaultTitle: "School Uniform & Sports Wear",
    defaultAmount: 12000,
    defaultEnabled: false,
    category: "SERVICES",
    description: "Purchase of school uniforms, lab coats, and sportswear.",
  },
  {
    moduleType: "BOOKS",
    defaultTitle: "Books & Instructional Material",
    defaultAmount: 15000,
    defaultEnabled: false,
    category: "SERVICES",
    description: "Mandatory textbooks, workbooks, and instructional stationery packages.",
  },
  {
    moduleType: "TRANSPORT",
    defaultTitle: "School Bus Route Transport Fee",
    defaultAmount: 20000,
    defaultEnabled: false,
    category: "SERVICES",
    description: "Termly school shuttle bus and daily transportation logistics fee.",
  },
  {
    moduleType: "HOSTEL",
    defaultTitle: "Boarding House & Hostel Accommodation",
    defaultAmount: 60000,
    defaultEnabled: false,
    category: "SERVICES",
    description: "Boarding accommodation, meals, and hostel management levy.",
  },
  {
    moduleType: "OTHER",
    defaultTitle: "Special / Miscellaneous Fee",
    defaultAmount: 1000,
    defaultEnabled: false,
    category: "SERVICES",
    description: "Custom administrative fees and special levies.",
  },
];


export type PayerType = "APPLICANT" | "STUDENT" | "PARENT" | "SCHOOL";
export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "POS" | "ONLINE";
export type ReceiptStatus = "PENDING" | "VERIFIED" | "REJECTED" | "FLAGGED";

export interface CreateReceiptParams {
  tenantId: string;
  schoolId?: string;
  moduleType: ModuleType;
  payerType: PayerType;
  payerId?: string;
  payerName: string;
  payerEmail?: string;
  referenceNo: string;
  amount: number;
  paymentDate?: Date | string;
  paymentMethod?: PaymentMethod;
  paymentMode?: PaymentTransactionMode;
  depositorName?: string;
  transferReference?: string;
  txnRef?: string;
  bankName?: string;
  fileUrl: string;
  proofOfPaymentUrl?: string;
  fileKey?: string;
  fileName?: string;
  linkedInvoiceId?: string;
  term?: string;
  session?: string;
  ip?: string;
}

export interface VerifyReceiptParams {
  receiptId: string;
  action: "VERIFY" | "REJECT" | "FLAG";
  verifiedBy: string;
  verifiedByUserId?: string;
  rejectionReason?: string;
  ip?: string;
}

/**
 * Generates a tamper-proof fiscal receipt number for settled transactions.
 */
export function generateFiscalReceiptCode(
  tenantId: string,
  receiptId: string,
  amount: number
): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${tenantId}:${receiptId}:${amount}:${Date.now()}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  const year = new Date().getFullYear();
  return `FISCAL-${year}-${digest}`;
}

/**
 * Creates a new PaymentReceipt and dispatches confirmation notifications.
 */
export async function createPaymentReceipt(params: CreateReceiptParams) {
  const paymentDate = params.paymentDate ? new Date(params.paymentDate) : new Date();
  const effectiveMode: PaymentTransactionMode =
    params.paymentMode ||
    (params.paymentMethod === "ONLINE" ? "DIRECT_GATEWAY" : "MANUAL_TRANSFER");

  // Enforce Hierarchical Payment Governance (Super Admin & Tenant Admin)
  if (
    effectiveMode === "MANUAL_TRANSFER" &&
    params.moduleType !== "PLATFORM_SUBSCRIPTION" &&
    params.tenantId !== "super-admin"
  ) {
    const tenantGov = await PaymentSettingsController.getTenantSettings(
      params.tenantId
    ).catch(() => null);
    if (tenantGov && !tenantGov.effective_is_manual_transfer_enabled) {
      throw new Error(
        "Manual Bank Transfer is currently disabled for this institution by payment governance policy."
      );
    }
  }

  const effectiveTransferRef = (
    params.transferReference ||
    params.txnRef ||
    params.referenceNo ||
    ""
  ).trim();
  const effectiveDepositorName = (params.depositorName || params.payerName || "").trim();
  const effectiveProofUrl = params.proofOfPaymentUrl || params.fileUrl;

  // If there's an existing receipt for this referenceNo + moduleType, update or create
  const existing = await basePrisma.paymentReceipt.findFirst({
    where: {
      tenantId: params.tenantId,
      moduleType: params.moduleType,
      referenceNo: params.referenceNo,
    },
    orderBy: { createdAt: "desc" },
  });

  let receipt;
  if (existing && (existing.status === "REJECTED" || existing.status === "PENDING")) {
    receipt = await basePrisma.paymentReceipt.update({
      where: { id: existing.id },
      data: {
        schoolId: params.schoolId || existing.schoolId,
        payerType: params.payerType,
        payerId: params.payerId || existing.payerId,
        payerName: params.payerName,
        amount: params.amount || existing.amount,
        paymentDate,
        paymentMethod: params.paymentMethod || existing.paymentMethod,
        paymentMode: effectiveMode,
        state: "PENDING_VERIFICATION",
        proofOfPaymentUrl: effectiveProofUrl,
        depositorName: effectiveDepositorName || existing.depositorName,
        transferReference: effectiveTransferRef || existing.transferReference,
        txnRef: effectiveTransferRef || existing.txnRef,
        bankName: params.bankName || existing.bankName,
        fileUrl: effectiveProofUrl,
        fileKey: params.fileKey || existing.fileKey,
        fileName: params.fileName || existing.fileName,
        status: "PENDING",
        rejectionReason: null,
        verifiedBy: null,
        verifiedByUserId: null,
        verifiedAt: null,
        linkedInvoiceId: params.linkedInvoiceId || existing.linkedInvoiceId,
        term: params.term || existing.term,
        session: params.session || existing.session,
        updatedAt: new Date(),
      },
    });
  } else {
    receipt = await basePrisma.paymentReceipt.create({
      data: {
        tenantId: params.tenantId,
        schoolId: params.schoolId,
        moduleType: params.moduleType,
        payerType: params.payerType,
        payerId: params.payerId,
        payerName: params.payerName,
        referenceNo: params.referenceNo,
        amount: params.amount,
        paymentDate,
        paymentMethod: params.paymentMethod || "BANK_TRANSFER",
        paymentMode: effectiveMode,
        state: "PENDING_VERIFICATION",
        proofOfPaymentUrl: effectiveProofUrl,
        depositorName: effectiveDepositorName,
        transferReference: effectiveTransferRef,
        txnRef: effectiveTransferRef,
        bankName: params.bankName,
        fileUrl: effectiveProofUrl,
        fileKey: params.fileKey,
        fileName: params.fileName,
        status: "PENDING",
        linkedInvoiceId: params.linkedInvoiceId,
        term: params.term,
        session: params.session,
      },
    });
  }

  // Transition application state to PAYMENT_PENDING_REVIEW without granting final admission clearance yet
  if (params.moduleType === "ADMISSION_FORM_FEE") {
    await markApplicationPendingVerification(params.referenceNo, effectiveTransferRef);
    await logAdmissionAuditTimeline(
      params.referenceNo,
      "Payment Receipt Uploaded (PENDING_VERIFICATION)",
      `Proof of payment for Application Fee (₦${Number(params.amount).toLocaleString()}, Ref: ${effectiveTransferRef}, Depositor: ${effectiveDepositorName}) uploaded. Status: PAYMENT_PENDING_REVIEW.`
    );
  }

  await logAuditEvent({
    actorId: params.payerId || params.payerName,
    action: "PAYMENT_TRANSACTION_SUBMITTED",
    target: `payment_receipt:${receipt.id}`,
    schoolId: params.schoolId || params.tenantId,
    ip: params.ip || "client",
    metadata: {
      receiptId: receipt.id,
      moduleType: params.moduleType,
      paymentMode: effectiveMode,
      state: "PENDING_VERIFICATION",
      amount: params.amount,
      depositorName: effectiveDepositorName,
      transferReference: effectiveTransferRef,
      referenceNo: params.referenceNo,
    },
  });

  // Optional email dispatch to payer if email provided
  if (params.payerEmail) {
    sendReceiptReceivedEmail({
      to: params.payerEmail,
      payerName: params.payerName,
      moduleType: params.moduleType,
      referenceNo: params.referenceNo,
      amount: params.amount,
      paymentDate,
      schoolId: params.schoolId,
    }).catch(() => {});
  }

  return receipt;
}

/**
 * Transitions an application to PAYMENT_PENDING_REVIEW upon manual proof upload
 * without granting final admission/enrollment clearance until verified by an officer.
 */
async function markApplicationPendingVerification(
  applicationNo: string,
  transferReference: string
) {
  try {
    const register = await basePrisma.admissionRegister.findFirst({
      where: { applicationNo },
    });
    if (register) {
      let creds: any = register.credentialsJson || {};
      if (typeof creds === "string") {
        try {
          creds = JSON.parse(creds);
        } catch {
          creds = {};
        }
      }
      creds.formFeeStatus = "PENDING_VERIFICATION";
      creds.paymentState = "PAYMENT_PENDING_REVIEW";
      creds.transferReference = transferReference;
      // Do NOT set formFeePaid = true until officer verifies
      const nextStatus =
        register.status === "new" || register.status === "INQUIRY"
          ? "PAYMENT_PENDING_REVIEW"
          : register.status;

      await basePrisma.admissionRegister.update({
        where: { id: register.id },
        data: {
          status: nextStatus,
          credentialsJson: creds,
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn("[MARK_APPLICATION_PENDING_VERIFICATION_WARN]:", err);
  }
}

/**
 * Verifies, rejects, or flags a payment receipt and triggers atomic domain automation.
 */
export async function verifyPaymentReceipt(params: VerifyReceiptParams) {
  if (params.action === "REJECT" && (!params.rejectionReason || !params.rejectionReason.trim())) {
    throw new Error("A structured rejection reason is mandatory when rejecting a payment.");
  }

  const receipt = await basePrisma.paymentReceipt.findUnique({
    where: { id: params.receiptId },
  });

  if (!receipt) {
    throw new Error(`Receipt not found with id: ${params.receiptId}`);
  }

  const newStatus: ReceiptStatus =
    params.action === "VERIFY"
      ? "VERIFIED"
      : params.action === "REJECT"
      ? "REJECTED"
      : "FLAGGED";

  const newState: PaymentTransactionState =
    params.action === "VERIFY"
      ? "SETTLED"
      : params.action === "REJECT"
      ? "REJECTED"
      : "PENDING_VERIFICATION";

  const fiscalReceiptCode =
    params.action === "VERIFY"
      ? generateFiscalReceiptCode(receipt.tenantId, receipt.id, receipt.amount)
      : null;

  const updatedReceipt = await basePrisma.paymentReceipt.update({
    where: { id: params.receiptId },
    data: {
      status: newStatus,
      state: newState,
      verifiedBy: params.verifiedBy || "Finance Desk",
      verifiedByUserId: params.verifiedByUserId || params.verifiedBy || "Finance Desk",
      verifiedAt: params.action === "VERIFY" ? new Date() : null,
      rejectionReason:
        params.action === "REJECT"
          ? params.rejectionReason?.trim() || "Payment proof invalid"
          : null,
      updatedAt: new Date(),
    },
  });

  await logAuditEvent({
    actorId: params.verifiedByUserId || params.verifiedBy || "FINANCE_OFFICER",
    action:
      params.action === "VERIFY"
        ? "PAYMENT_TRANSACTION_VERIFIED"
        : params.action === "REJECT"
        ? "PAYMENT_TRANSACTION_REJECTED"
        : "PAYMENT_TRANSACTION_FLAGGED",
    target: `payment_receipt:${receipt.id}`,
    schoolId: receipt.schoolId || receipt.tenantId,
    ip: params.ip || "finance-desk",
    metadata: {
      receiptId: receipt.id,
      referenceNo: receipt.referenceNo,
      transferReference: receipt.transferReference || receipt.txnRef,
      depositorName: receipt.depositorName || receipt.payerName,
      amount: receipt.amount,
      old_state: receipt.state || receipt.status,
      new_state: newState,
      fiscalReceiptCode,
      rejectionReason: params.rejectionReason || null,
      verifiedBy: params.verifiedBy,
    },
  });

  // -------------------------------------------------------------
  // DOMAIN SPECIFIC AUTOMATION
  // -------------------------------------------------------------

  if (params.action === "VERIFY") {
    // 1. Admission Form Fee: Mark Form Fee Paid across AdmissionRegister, AdmissionLead, AND AdmissionsApplication / AdmissionsFeeTransaction
    if (receipt.moduleType === "ADMISSION_FORM_FEE") {
      await markAdmissionFormFeePaid(
        receipt.referenceNo,
        receipt.verifiedBy || params.verifiedBy,
        receipt.tenantId || receipt.schoolId,
        receipt.amount,
        receipt.transferReference || receipt.txnRef || receipt.referenceNo,
        receipt.fileUrl || receipt.proofOfPaymentUrl
      );
    }

    // 2. Platform Subscription: Mark Subscription Active
    if (receipt.moduleType === "PLATFORM_SUBSCRIPTION") {
      await activatePlatformSubscription(receipt.tenantId, receipt.schoolId);
    }

    // 3. Tuition / Other Invoices: Settle linked invoice
    if (receipt.linkedInvoiceId) {
      await settleLinkedInvoice(receipt.linkedInvoiceId, receipt.amount, {
        paymentMode: (receipt as any).paymentMode || "MANUAL_TRANSFER",
        proofOfPaymentUrl: (receipt as any).proofOfPaymentUrl || receipt.fileUrl,
        depositorName: (receipt as any).depositorName || receipt.payerName,
        transferReference: (receipt as any).transferReference || receipt.txnRef || receipt.referenceNo,
        verifiedByUserId: params.verifiedByUserId || params.verifiedBy || "FINANCE_OFFICER",
        fiscalReceiptCode: fiscalReceiptCode || "TRANSFER",
      });
    }

    // 4. Academic Access Clearance (TRANSCRIPT_FEE, RESULT_CHECKING_FEE, REPORT_CARD_CHECKING_FEE)
    if (
      receipt.moduleType === "TRANSCRIPT_FEE" ||
      receipt.moduleType === "RESULT_CHECKING_FEE" ||
      receipt.moduleType === "REPORT_CARD_CHECKING_FEE"
    ) {
      console.log(`[ACCESS_UNLOCKED] ${receipt.moduleType} verified and unlocked for ref: ${receipt.referenceNo} by ${params.verifiedBy}`);
    }

    const moduleSetting = await getModulePaymentSetting(
      receipt.tenantId,
      receipt.moduleType as ModuleType,
      null,
      receipt.term
    ).catch(() => null);

    // Dispatch verification notification email if payer email resolved
    resolvePayerEmail(receipt).then((email) => {
      if (email) {
        sendReceiptVerifiedEmail({
          to: email,
          payerName: receipt.payerName,
          moduleType: receipt.moduleType,
          referenceNo: receipt.referenceNo,
          amount: receipt.amount,
          schoolId: receipt.schoolId || undefined,
          customWriteup: moduleSetting?.customWriteup,
        }).catch(() => {});
      }
    });
  } else if (params.action === "REJECT") {
    if (receipt.moduleType === "ADMISSION_FORM_FEE") {
      await logAdmissionAuditTimeline(
        receipt.referenceNo,
        "Payment Receipt Rejected",
        `Receipt rejected by ${params.verifiedBy}. Reason: ${params.rejectionReason || "Verification failed"}. Re-upload required.`
      );
    }

    const moduleSetting = await getModulePaymentSetting(
      receipt.tenantId,
      receipt.moduleType as ModuleType,
      null,
      receipt.term
    ).catch(() => null);


    // Dispatch rejection notification email with re-upload link
    resolvePayerEmail(receipt).then((email) => {
      if (email) {
        const reuploadUrl = receipt.moduleType === "ADMISSION_FORM_FEE"
          ? `/track/${encodeURIComponent(receipt.referenceNo)}`
          : `/portal/student`;
        sendReceiptRejectedEmail({
          to: email,
          payerName: receipt.payerName,
          moduleType: receipt.moduleType,
          referenceNo: receipt.referenceNo,
          amount: receipt.amount,
          rejectionReason: params.rejectionReason || "Verification failed",
          reuploadUrl,
          schoolId: receipt.schoolId || undefined,
          customWriteup: moduleSetting?.customWriteup,
        }).catch(() => {});
      }
    });
  }

  return {
    ...updatedReceipt,
    fiscalReceiptCode,
  };
}


/**
 * Automates Admission Form Fee marking across AdmissionRegister, AdmissionLead, AND AdmissionsApplication / AdmissionsFeeTransaction
 */
async function markAdmissionFormFeePaid(
  applicationNo: string,
  verifiedBy: string,
  tenantId?: string | null,
  amount: number = 5000,
  reference: string = "",
  proofUrl?: string | null
) {
  try {
    // 1. Update AdmissionRegister if exists
    const register = await basePrisma.admissionRegister.findFirst({
      where: { applicationNo },
    });

    if (register) {
      let creds: any = register.credentialsJson || {};
      if (typeof creds === "string") {
        try {
          creds = JSON.parse(creds);
        } catch {
          creds = {};
        }
      }

      creds.formFeePaid = true;
      creds.formFeeStatus = "PAID";
      creds.feePaid = true;
      creds.formFeeVerifiedAt = new Date().toISOString();
      creds.formFeeVerifiedBy = verifiedBy;

      const logs = Array.isArray(creds.statusLogs) ? [...creds.statusLogs] : [];
      logs.push({
        fromStatus: register.status,
        toStatus: register.status,
        changedById: verifiedBy,
        reason: "Application fee payment receipt verified by Bursar (Universal Receipt)",
        createdAt: new Date().toISOString(),
      });
      creds.statusLogs = logs;

      await basePrisma.admissionRegister.update({
        where: { id: register.id },
        data: {
          credentialsJson: creds,
          formFeePaid: true,
          updatedAt: new Date(),
        },
      });
    }

    // 2. Also touch linked lead if found by email or id
    let lead = register?.email
      ? await basePrisma.admissionLead.findFirst({
          where: { studentEmail: register.email },
        })
      : null;

    if (!lead && applicationNo) {
      const cleanRef = applicationNo.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
      lead = await basePrisma.admissionLead.findFirst({
        where: {
          OR: [
            { id: applicationNo },
            { id: { contains: cleanRef, mode: "insensitive" } },
          ],
        },
      });
    }

    if (lead) {
      const leadDocs: any = (lead.documents as any) || {};
      leadDocs.formFeePaid = true;
      leadDocs.formFeeStatus = "PAID";
      leadDocs.feePaid = true;
      leadDocs.formFeeVerifiedAt = new Date().toISOString();
      leadDocs.formFeeVerifiedBy = verifiedBy;

      await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          documents: leadDocs,
          updatedAt: new Date(),
        },
      });
    }

    // 3. Atomically synchronize with AdmissionsApplication and AdmissionsFeeTransaction (Modern Admissions Workspace)
    const schoolTargetId = tenantId || register?.tenantId || lead?.schoolId;
    let targetApp = await basePrisma.admissionsApplication.findFirst({
      where: {
        OR: [
          { applicationNumber: applicationNo },
          ...(lead ? [{ id: lead.id }, { email: lead.studentEmail || "" }] : []),
          ...(register?.email ? [{ email: register.email }] : []),
        ],
      },
      include: {
        feeTransactions: true,
      },
    });

    if (targetApp) {
      // Find or create the AdmissionsFeeTransaction and mark SETTLED
      const existingFeeTx = targetApp.feeTransactions.find(
        (t) => t.paymentStatus === "PENDING" || t.paymentReference === reference
      ) || targetApp.feeTransactions[0];

      if (existingFeeTx) {
        await basePrisma.admissionsFeeTransaction.update({
          where: { id: existingFeeTx.id },
          data: {
            paymentStatus: "SETTLED",
            reconciliationNotes: `Verified and settled by Bursar (${verifiedBy})`,
            verifiedByUserId: verifiedBy,
            verifiedAt: new Date(),
          },
        });
      } else {
        const paymentRef = reference || `BURS-VERIF-${Date.now().toString().slice(-6)}`;
        await basePrisma.admissionsFeeTransaction.create({
          data: {
            tenantId: targetApp.tenantId || targetApp.schoolId,
            applicationId: targetApp.id,
            paymentMethod: "MANUAL_BANK_TRANSFER",
            amount: amount,
            currency: "NGN",
            paymentReference: paymentRef,
            proofOfPaymentUrl: proofUrl || null,
            paymentStatus: "SETTLED",
            reconciliationNotes: `Directly verified and settled by Bursar (${verifiedBy})`,
            verifiedByUserId: verifiedBy,
            verifiedAt: new Date(),
          },
        });
      }

      // If application was still PAYMENT_PENDING, advance it to UNDER_REVIEW
      if (targetApp.status === "PAYMENT_PENDING" || targetApp.status === "DRAFT") {
        await basePrisma.admissionsApplication.update({
          where: { id: targetApp.id },
          data: {
            status: "UNDER_REVIEW",
            metadata: {
              ...((targetApp.metadata as any) || {}),
              feeSettledAt: new Date().toISOString(),
              feeSettledBy: verifiedBy,
            },
          },
        });
      }
    }
  } catch (err: any) {
    console.error("[MARK_FORM_FEE_PAID_ERROR]:", err);
  }
}

/**
 * Automates School Platform Subscription Activation
 */
export async function activatePlatformSubscription(tenantId: string, schoolId?: string | null) {
  try {
    const targetId = schoolId || tenantId;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day billing cycle extension

    await basePrisma.school.updateMany({
      where: {
        OR: [{ id: targetId }, { subdomain: tenantId }, { slug: tenantId }],
      },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: expiresAt,
        status: "ACTIVE",
        isActive: true,
        updatedAt: new Date(),
      },
    });

    await basePrisma.subscription.updateMany({
      where: {
        school: {
          OR: [{ id: targetId }, { subdomain: tenantId }, { slug: tenantId }],
        },
      },
      data: {
        status: "ACTIVE",
        verifiedByAdmin: true,
        expiresAt,
      },
    });

    await basePrisma.schoolPayment.updateMany({
      where: {
        school: {
          OR: [{ id: targetId }, { subdomain: tenantId }, { slug: tenantId }],
        },
        type: "SUBSCRIPTION",
        status: "PENDING_VERIFICATION",
      },
      data: {
        status: "VERIFIED",
      },
    });
  } catch (err: any) {
    console.error("[ACTIVATE_PLATFORM_SUBSCRIPTION_ERROR]:", err);
  }
}

/**
 * Automates settling linked invoices for Tuition and other fees
 */
async function settleLinkedInvoice(
  invoiceId: string,
  paidAmount: number,
  meta?: {
    paymentMode?: string;
    proofOfPaymentUrl?: string | null;
    depositorName?: string | null;
    transferReference?: string | null;
    verifiedByUserId?: string | null;
    fiscalReceiptCode?: string;
  }
) {
  try {
    const invoice = await basePrisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (invoice) {
      const newPaidAmount = (invoice.amountPaid || 0) + paidAmount;
      const isPaid = newPaidAmount >= (invoice.amountDue || 0);
      await basePrisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newPaidAmount,
          paidAt: isPaid ? new Date() : invoice.paidAt,
          status: isPaid ? "PAID" : "PARTIALLY_PAID",
          updatedAt: new Date(),
        },
      });

      await basePrisma.payment.create({
        data: {
          schoolId: invoice.schoolId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          amountPaid: paidAmount,
          paymentDate: new Date(),
          method: meta?.fiscalReceiptCode || "TRANSFER",
          paymentMode: meta?.paymentMode || "MANUAL_TRANSFER",
          state: "SETTLED",
          proofOfPaymentUrl: meta?.proofOfPaymentUrl || null,
          depositorName: meta?.depositorName || null,
          transferReference: meta?.transferReference || null,
          verifiedByUserId: meta?.verifiedByUserId || null,
          verifiedAt: new Date(),
        },
      });
    }
  } catch (err: any) {
    console.error("[SETTLE_LINKED_INVOICE_ERROR]:", err);
  }
}

/**
 * Logs an audit event to the candidate audit timeline in credentialsJson
 */
async function logAdmissionAuditTimeline(applicationNo: string, event: string, reason: string) {
  try {
    const register = await basePrisma.admissionRegister.findFirst({
      where: { applicationNo },
    });

    if (register) {
      let creds: any = register.credentialsJson || {};
      if (typeof creds === "string") {
        try {
          creds = JSON.parse(creds);
        } catch {
          creds = {};
        }
      }

      const logs = Array.isArray(creds.statusLogs) ? [...creds.statusLogs] : [];
      logs.push({
        fromStatus: register.status,
        toStatus: register.status,
        changedById: "Bursar Receipt Engine",
        reason: `${event} — ${reason}`,
        createdAt: new Date().toISOString(),
      });
      creds.statusLogs = logs;

      await basePrisma.admissionRegister.update({
        where: { id: register.id },
        data: {
          credentialsJson: creds,
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn("[LOG_ADMISSION_AUDIT_TIMELINE_ERROR]:", err);
  }
}

/**
 * Queries payment receipts with filtering, pagination, and statistical summaries.
 */
export async function getPaymentReceipts(params: {
  tenantId?: string;
  schoolId?: string;
  moduleType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.tenantId && params.tenantId !== "ALL" && params.tenantId !== "super-admin") {
    where.tenantId = params.tenantId;
  }
  if (params.schoolId) {
    where.schoolId = params.schoolId;
  }
  if (params.moduleType && params.moduleType !== "ALL") {
    where.moduleType = params.moduleType;
  }
  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  }
  if (params.startDate || params.endDate) {
    where.paymentDate = {};
    if (params.startDate) where.paymentDate.gte = new Date(params.startDate);
    if (params.endDate) where.paymentDate.lte = new Date(params.endDate);
  }
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    where.OR = [
      { payerName: { contains: s, mode: "insensitive" } },
      { depositorName: { contains: s, mode: "insensitive" } },
      { referenceNo: { contains: s, mode: "insensitive" } },
      { txnRef: { contains: s, mode: "insensitive" } },
      { transferReference: { contains: s, mode: "insensitive" } },
      { bankName: { contains: s, mode: "insensitive" } },
    ];
  }

  const [receipts, totalCount] = await Promise.all([
    basePrisma.paymentReceipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    basePrisma.paymentReceipt.count({ where }),
  ]);

  // Duplicate Reference Detector: check if another student/applicant used the same transferReference or txnRef
  const candidateRefs = Array.from(
    new Set(
      receipts
        .map((r: any) => (r.transferReference || r.txnRef || "").trim())
        .filter((ref: string) => ref.length >= 4)
    )
  );

  const duplicateMap = new Map<string, Array<{ id: string; payerName: string; referenceNo: string }>>();
  if (candidateRefs.length > 0) {
    const dupWhere: any = {
      OR: [
        { transferReference: { in: candidateRefs } },
        { txnRef: { in: candidateRefs } },
      ],
    };
    if (params.tenantId && params.tenantId !== "ALL" && params.tenantId !== "super-admin") {
      dupWhere.tenantId = params.tenantId;
    }

    const matchingRefReceipts = await basePrisma.paymentReceipt.findMany({
      where: dupWhere,
      select: {
        id: true,
        payerName: true,
        referenceNo: true,
        transferReference: true,
        txnRef: true,
      },
    });

    for (const item of matchingRefReceipts) {
      const refKey = (item.transferReference || item.txnRef || "").trim().toUpperCase();
      if (!refKey) continue;
      const list = duplicateMap.get(refKey) || [];
      list.push({
        id: item.id,
        payerName: item.payerName,
        referenceNo: item.referenceNo,
      });
      duplicateMap.set(refKey, list);
    }
  }

  const enrichedReceipts = receipts.map((r: any) => {
    const refKey = (r.transferReference || r.txnRef || "").trim().toUpperCase();
    const matches = refKey ? duplicateMap.get(refKey) || [] : [];
    const others = matches.filter((m) => m.id !== r.id);
    return {
      ...r,
      isDuplicateReference: others.length > 0,
      duplicateCount: others.length,
      duplicateWith: others.map((o) => `${o.payerName} (${o.referenceNo})`),
    };
  });

  // Aggregate stats
  const statsWhere: any = {};
  if (params.tenantId && params.tenantId !== "ALL" && params.tenantId !== "super-admin") {
    statsWhere.tenantId = params.tenantId;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingCount, verifiedTodayAgg, amountVerifiedAgg] = await Promise.all([
    basePrisma.paymentReceipt.count({
      where: { ...statsWhere, status: "PENDING" },
    }),
    basePrisma.paymentReceipt.count({
      where: {
        ...statsWhere,
        status: "VERIFIED",
        verifiedAt: { gte: todayStart },
      },
    }),
    basePrisma.paymentReceipt.aggregate({
      where: { ...statsWhere, status: "VERIFIED" },
      _sum: { amount: true },
    }),
  ]);

  return {
    receipts: enrichedReceipts,
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
    stats: {
      pendingCount,
      verifiedToday: verifiedTodayAgg,
      amountVerified: amountVerifiedAgg._sum.amount || 0,
    },
  };
}

/**
 * Resolves email for payer from receipt, applicant, lead, or student records
 */
async function resolvePayerEmail(receipt: any): Promise<string | null> {
  try {
    if (receipt.payerEmail && receipt.payerEmail.includes("@")) {
      return receipt.payerEmail.trim();
    }

    if (receipt.moduleType === "ADMISSION_FORM_FEE") {
      const reg = await basePrisma.admissionRegister.findFirst({
        where: { applicationNo: receipt.referenceNo },
        select: { email: true },
      });
      if (reg?.email && reg.email.includes("@")) return reg.email.trim();
    }

    if (receipt.payerId) {
      const student = await basePrisma.student.findUnique({
        where: { id: receipt.payerId },
        select: { email: true, parentEmail: true },
      });
      if (student?.email && student.email.includes("@")) return student.email.trim();
      if (student?.parentEmail && student.parentEmail.includes("@")) return student.parentEmail.trim();
    }
  } catch (err) {
    console.warn("[RESOLVE_PAYER_EMAIL_WARN]:", err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// TENANT PAYMENT SETTINGS & ACTIVATION ENGINE
// ---------------------------------------------------------------------------

export interface UpsertPaymentSettingParams {
  tenantId: string;
  schoolId?: string;
  moduleType: ModuleType;
  isEnabled: boolean;
  isActive?: boolean;
  title: string;
  amount: number;
  currency?: string;
  customWriteup?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  classId?: string | null;
  term?: string | null;
  session?: string | null;
  updatedBy?: string;
}

/**
 * Returns all 13 module payment configurations for a given tenant.
 * Does not overwrite existing configurations, returning institutional settings where present
 * and safe defaults where not yet customized.
 */
export async function getTenantPaymentSettings(tenantId: string) {
  const existingSettings = await basePrisma.paymentSetting.findMany({
    where: { tenantId },
  });

  const existingMap = new Map<string, any>();
  for (const s of existingSettings) {
    // Key by moduleType (general school-wide setting)
    const key = `${s.moduleType}_${s.classId || "ALL"}_${s.term || "ALL"}`;
    existingMap.set(key, s);
    if (!s.classId && !s.term) {
      existingMap.set(s.moduleType, s);
    }
  }

  return ALL_MODULE_TYPES.map((def) => {
    const existing = existingMap.get(def.moduleType);
    if (existing) {
      return {
        id: existing.id,
        tenantId: existing.tenantId,
        schoolId: existing.schoolId,
        moduleType: existing.moduleType as ModuleType,
        isEnabled: existing.isEnabled,
        isActive: existing.isActive,
        title: existing.title || def.defaultTitle,
        amount: existing.amount,
        currency: existing.currency || "NGN",
        customWriteup: existing.customWriteup || null,
        accountName: existing.accountName || null,
        accountNumber: existing.accountNumber || null,
        bankName: existing.bankName || null,
        classId: existing.classId || null,
        term: existing.term || null,
        session: existing.session || null,
        updatedBy: existing.updatedBy || null,
        category: def.category,
        description: def.description,
        isCustomized: true,
      };
    }

    // Default institutional configuration (not yet overridden in DB)
    return {
      id: null,
      tenantId,
      schoolId: null,
      moduleType: def.moduleType,
      isEnabled: def.defaultEnabled,
      isActive: true,
      title: def.defaultTitle,
      amount: def.defaultAmount,
      currency: "NGN",
      customWriteup: null,
      accountName: null,
      accountNumber: null,
      bankName: null,
      classId: null,
      term: null,
      session: null,
      updatedBy: null,
      category: def.category,
      description: def.description,
      isCustomized: false,
    };
  });
}

/**
 * Retrieves the active payment setting for a specific tenant and module.
 */
export async function getModulePaymentSetting(
  tenantId: string,
  moduleType: ModuleType,
  classId?: string | null,
  term?: string | null
) {
  const def = ALL_MODULE_TYPES.find((m) => m.moduleType === moduleType);

  try {
    const setting = await basePrisma.paymentSetting.findFirst({
      where: {
        tenantId,
        moduleType,
        classId: classId || null,
        term: term || null,
      },
    });

    if (setting) {
      return {
        ...setting,
        title: setting.title || def?.defaultTitle || moduleType.replace(/_/g, " "),
        amount: setting.amount ?? def?.defaultAmount ?? 0,
        currency: setting.currency || "NGN",
      };
    }
  } catch (err) {
    console.warn(`[GET_MODULE_SETTING_WARN] ${moduleType}:`, err);
  }

  // Safe fallback default without throwing
  return {
    id: null,
    tenantId,
    schoolId: null,
    moduleType,
    isEnabled: def?.defaultEnabled ?? false,
    isActive: true,
    title: def?.defaultTitle ?? moduleType.replace(/_/g, " "),
    amount: def?.defaultAmount ?? 0,
    currency: "NGN",
    customWriteup: null,
    accountName: null,
    accountNumber: null,
    bankName: null,
    classId: null,
    term: null,
    session: null,
    updatedBy: null,
  };
}

/**
 * Creates or updates an institution's payment setting for a module.
 */
export async function upsertPaymentSetting(params: UpsertPaymentSettingParams) {
  const existing = await basePrisma.paymentSetting.findFirst({
    where: {
      tenantId: params.tenantId,
      moduleType: params.moduleType,
      classId: params.classId || null,
      term: params.term || null,
    },
  });

  if (existing) {
    return basePrisma.paymentSetting.update({
      where: { id: existing.id },
      data: {
        schoolId: params.schoolId || existing.schoolId,
        isEnabled: params.isEnabled,
        isActive: params.isActive !== undefined ? params.isActive : existing.isActive,
        title: params.title,
        amount: params.amount,
        currency: params.currency || existing.currency || "NGN",
        customWriteup: params.customWriteup !== undefined ? params.customWriteup : existing.customWriteup,
        accountName: params.accountName !== undefined ? params.accountName : existing.accountName,
        accountNumber: params.accountNumber !== undefined ? params.accountNumber : existing.accountNumber,
        bankName: params.bankName !== undefined ? params.bankName : existing.bankName,
        session: params.session !== undefined ? params.session : existing.session,
        updatedBy: params.updatedBy || existing.updatedBy,
        updatedAt: new Date(),
      },
    });
  }

  return basePrisma.paymentSetting.create({
    data: {
      tenantId: params.tenantId,
      schoolId: params.schoolId,
      moduleType: params.moduleType,
      isEnabled: params.isEnabled,
      isActive: params.isActive !== undefined ? params.isActive : true,
      title: params.title,
      amount: params.amount,
      currency: params.currency || "NGN",
      customWriteup: params.customWriteup || null,
      accountName: params.accountName || null,
      accountNumber: params.accountNumber || null,
      bankName: params.bankName || null,
      classId: params.classId || null,
      term: params.term || null,
      session: params.session || null,
      updatedBy: params.updatedBy || null,
    },
  });
}

export interface CheckFeeAccessParams {
  tenantId: string;
  moduleType: ModuleType;
  referenceNo: string;
  studentId?: string;
  classId?: string | null;
  term?: string | null;
}

export interface FeeAccessResult {
  allowed: boolean;
  feeRequired: boolean;
  status: "NOT_REQUIRED" | "UNLOCKED" | "PAYMENT_PENDING" | "PAYMENT_REQUIRED";
  setting: any;
  receipt?: any;
}

/**
 * Access gatekeeper for academic items (Result Checking, Report Card, Transcript).
 * If the institution has disabled the fee (isEnabled = false), access is instantly granted.
 * If enabled, requires a verified PaymentReceipt.
 */
export async function checkFeeAccess(params: CheckFeeAccessParams): Promise<FeeAccessResult> {
  const setting = await getModulePaymentSetting(
    params.tenantId,
    params.moduleType,
    params.classId,
    params.term
  );

  // 1. Institution has fee disabled: Immediate access with zero friction
  if (!setting.isEnabled || !setting.isActive) {
    return {
      allowed: true,
      feeRequired: false,
      status: "NOT_REQUIRED",
      setting,
    };
  }

  // 2. Fee is enabled: Look for verified receipt for this student/reference
  const candidateRefs = [params.referenceNo];
  if (params.studentId && params.studentId !== params.referenceNo) {
    candidateRefs.push(params.studentId);
  }

  const receipts = await basePrisma.paymentReceipt.findMany({
    where: {
      tenantId: params.tenantId,
      moduleType: params.moduleType,
      OR: [
        { referenceNo: { in: candidateRefs } },
        ...(params.studentId ? [{ payerId: params.studentId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const verifiedReceipt = receipts.find((r) => r.status === "VERIFIED");
  if (verifiedReceipt) {
    return {
      allowed: true,
      feeRequired: true,
      status: "UNLOCKED",
      setting,
      receipt: verifiedReceipt,
    };
  }

  const pendingReceipt = receipts.find((r) => r.status === "PENDING");
  if (pendingReceipt) {
    return {
      allowed: false,
      feeRequired: true,
      status: "PAYMENT_PENDING",
      setting,
      receipt: pendingReceipt,
    };
  }

  return {
    allowed: false,
    feeRequired: true,
    status: "PAYMENT_REQUIRED",
    setting,
    receipt: receipts[0] || null,
  };
}


