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
        receipt.fileUrl || receipt.proofOfPaymentUrl,
        receipt.payerId
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
 * Deduplicates and merges redundant payment receipts under a single master transaction record.
 * Marks master as VERIFIED, flags clones natively as DUPLICATE with systemic reference to master.
 * Updates reporting metrics accurately without double-counting or altering audit trails.
 */
export async function deduplicatePaymentReceipts(params: {
  masterReceiptId: string;
  duplicateReceiptIds: string[];
  verifiedBy?: string;
  verifiedByUserId?: string;
  reconciliationNotes?: string;
  ip?: string;
}) {
  const {
    masterReceiptId,
    duplicateReceiptIds,
    verifiedBy = "Bursar Desk",
    verifiedByUserId,
    reconciliationNotes,
    ip,
  } = params;

  if (!masterReceiptId) {
    throw new Error("masterReceiptId is required for deduplication");
  }

  const allIds = Array.from(new Set([masterReceiptId, ...(duplicateReceiptIds || [])]));
  const receipts = await basePrisma.paymentReceipt.findMany({
    where: { id: { in: allIds } },
  });

  const masterReceipt = receipts.find((r) => r.id === masterReceiptId);
  if (!masterReceipt) {
    throw new Error(`Master transaction record #${masterReceiptId} not found`);
  }

  const clones = receipts.filter((r) => r.id !== masterReceiptId);
  if (clones.length === 0) {
    throw new Error("At least one competing duplicate transaction must be selected to merge");
  }

  // 1. Generate fiscal receipt code for Master if not already present
  const fiscalReceiptCode =
    masterReceipt.referenceNo && masterReceipt.referenceNo.startsWith("RCP-")
      ? masterReceipt.referenceNo
      : `RCP-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // 2. Update Master Record to VERIFIED & SETTLED
  const updatedMaster = await basePrisma.paymentReceipt.update({
    where: { id: masterReceipt.id },
    data: {
      status: "VERIFIED",
      state: "SETTLED",
      verifiedBy,
      verifiedByUserId: verifiedByUserId || verifiedBy,
      verifiedAt: new Date(),
      rejectionReason: null,
      duplicateNotes: `Master transaction confirmed. Merged ${clones.length} duplicate submission(s): [${clones.map((c) => c.id).join(", ")}]. ${reconciliationNotes || ""}`.trim(),
      updatedAt: new Date(),
    },
  });

  // 3. Update all Clones to DUPLICATE with systemic reference to Master
  const updatedClones = await Promise.all(
    clones.map(async (clone) => {
      return basePrisma.paymentReceipt.update({
        where: { id: clone.id },
        data: {
          status: "DUPLICATE",
          state: "DUPLICATE",
          masterReceiptId: masterReceipt.id,
          duplicateNotes: `Merged as duplicate under master transaction #${masterReceipt.id}. Verified by ${verifiedBy}. ${reconciliationNotes || ""}`.trim(),
          rejectionReason: null, // Clear any previous false rejection
          verifiedBy,
          verifiedByUserId: verifiedByUserId || verifiedBy,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    })
  );

  // 4. Log Immutable Audit Event
  await logAuditEvent({
    actorId: verifiedByUserId || verifiedBy || "BURSAR_DESK",
    action: "PAYMENT_TRANSACTION_DEDUPLICATED",
    target: `payment_receipt:${masterReceipt.id}`,
    schoolId: masterReceipt.schoolId || masterReceipt.tenantId,
    ip: ip || "bursar-desk",
    metadata: {
      masterReceiptId: masterReceipt.id,
      duplicateReceiptIds: clones.map((c) => c.id),
      moduleType: masterReceipt.moduleType,
      amount: masterReceipt.amount,
      referenceNo: masterReceipt.referenceNo,
      payerName: masterReceipt.payerName,
      fiscalReceiptCode,
      notes: reconciliationNotes || "Deduplicated via Universal Payment Receipt Verification Hub",
      verifiedBy,
    },
  });

  // 5. Trigger domain automation for the master verified transaction
  if (masterReceipt.moduleType === "ADMISSION_FORM_FEE") {
    await markAdmissionFormFeePaid(
      masterReceipt.referenceNo,
      verifiedBy,
      masterReceipt.tenantId || masterReceipt.schoolId,
      masterReceipt.amount,
      masterReceipt.transferReference || masterReceipt.txnRef || masterReceipt.referenceNo,
      masterReceipt.fileUrl || masterReceipt.proofOfPaymentUrl,
      masterReceipt.payerId
    );

    // Also record in AdmissionAuditTrail if applicable
    await basePrisma.admissionAuditTrail.create({
      data: {
        tenantId: masterReceipt.tenantId,
        schoolId: masterReceipt.schoolId || masterReceipt.tenantId,
        applicationId: masterReceipt.referenceNo,
        registerId: masterReceipt.referenceNo,
        actorId: verifiedBy || "Bursar Officer",
        action: "PAYMENT_RECEIPTS_DEDUPLICATED",
        fromStage: "PAYMENT_VERIFICATION",
        toStage: "PAYMENT_VERIFIED",
        metadata: {
          masterReceiptId: masterReceipt.id,
          mergedDuplicateIds: clones.map((c) => c.id),
          amount: masterReceipt.amount,
          referenceNo: masterReceipt.referenceNo,
          notes: reconciliationNotes || "Merged duplicate payment receipts under master record",
          mergedAt: new Date().toISOString(),
        },
      },
    }).catch(() => null);
  } else if (masterReceipt.moduleType === "PLATFORM_SUBSCRIPTION") {
    await activatePlatformSubscription(masterReceipt.tenantId, masterReceipt.schoolId);
  } else if (masterReceipt.linkedInvoiceId) {
    await settleLinkedInvoice(masterReceipt.linkedInvoiceId, masterReceipt.amount, {
      paymentMode: (masterReceipt as any).paymentMode || "MANUAL_TRANSFER",
      proofOfPaymentUrl: (masterReceipt as any).proofOfPaymentUrl || masterReceipt.fileUrl,
      depositorName: (masterReceipt as any).depositorName || masterReceipt.payerName,
      transferReference: (masterReceipt as any).transferReference || masterReceipt.txnRef || masterReceipt.referenceNo,
      verifiedByUserId: verifiedByUserId || verifiedBy,
      fiscalReceiptCode,
    });
  }

  // 6. Dispatch receipt verified notification to payer (only once for the master, avoiding redundant emails)
  const moduleSetting = await getModulePaymentSetting(
    masterReceipt.tenantId,
    masterReceipt.moduleType as ModuleType,
    null,
    masterReceipt.term
  ).catch(() => null);

  resolvePayerEmail(masterReceipt).then((email) => {
    if (email) {
      sendReceiptVerifiedEmail({
        to: email,
        payerName: masterReceipt.payerName,
        moduleType: masterReceipt.moduleType,
        referenceNo: masterReceipt.referenceNo,
        amount: masterReceipt.amount,
        schoolId: masterReceipt.schoolId || undefined,
        customWriteup: moduleSetting?.customWriteup,
      }).catch(() => {});
    }
  });

  return {
    success: true,
    message: `Successfully verified master transaction #${masterReceipt.id} and merged ${clones.length} duplicate submission(s).`,
    masterReceipt: { ...updatedMaster, fiscalReceiptCode },
    clones: updatedClones,
    mergedCount: clones.length,
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
  proofUrl?: string | null,
  payerId?: string | null
) {
  try {
    // 1. Update AdmissionRegister if exists (match by applicationNo or payerId)
    const register = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [
          ...(applicationNo ? [{ applicationNo }] : []),
          ...(payerId ? [{ id: payerId }] : []),
        ],
      },
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
      creds.paymentState = "SETTLED";
      creds.formFeeVerifiedAt = new Date().toISOString();
      creds.formFeeVerifiedBy = verifiedBy;
      if (creds.applicationFeeReceipt && typeof creds.applicationFeeReceipt === "object") {
        creds.applicationFeeReceipt = {
          ...creds.applicationFeeReceipt,
          status: "VERIFIED",
          verified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy,
        };
      }

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

    // 2. Also touch linked lead if found by payerId, email, or id
    let lead = payerId
      ? await basePrisma.admissionLead.findUnique({ where: { id: payerId } })
      : null;

    if (!lead && register?.email) {
      lead = await basePrisma.admissionLead.findFirst({
        where: { studentEmail: register.email },
      });
    }

    if (!lead && applicationNo) {
      const cleanRef = applicationNo.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
      lead = await basePrisma.admissionLead.findFirst({
        where: {
          OR: [
            { id: applicationNo },
            ...(cleanRef ? [{ id: { contains: cleanRef, mode: "insensitive" as const } }] : []),
          ],
        },
      });
    }

    if (lead) {
      const leadDocs: any = (lead.documents as any) || {};
      leadDocs.formFeePaid = true;
      leadDocs.formFeeStatus = "PAID";
      leadDocs.feePaid = true;
      leadDocs.paymentState = "SETTLED";
      leadDocs.formFeeVerifiedAt = new Date().toISOString();
      leadDocs.formFeeVerifiedBy = verifiedBy;
      if (leadDocs.applicationFeeReceipt && typeof leadDocs.applicationFeeReceipt === "object") {
        leadDocs.applicationFeeReceipt = {
          ...leadDocs.applicationFeeReceipt,
          status: "VERIFIED",
          verified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy,
        };
      }

      await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          documents: leadDocs,
          updatedAt: new Date(),
        },
      });
    }

    // 3. Atomically synchronize with AdmissionsApplication and AdmissionsFeeTransaction (Modern Admissions Workspace)
    let targetApp = await basePrisma.admissionsApplication.findFirst({
      where: {
        OR: [
          ...(applicationNo ? [{ applicationNumber: applicationNo }] : []),
          ...(payerId ? [{ id: payerId }] : []),
          ...(lead ? [{ id: lead.id }, ...(lead.studentEmail ? [{ email: lead.studentEmail }] : [])] : []),
          ...(register?.email ? [{ email: register.email }] : []),
          ...(register?.applicationNo ? [{ applicationNumber: register.applicationNo }] : []),
          ...(register?.firstName && register?.lastName
            ? [
                {
                  firstName: { equals: register.firstName, mode: "insensitive" as const },
                  lastName: { equals: register.lastName, mode: "insensitive" as const },
                },
              ]
            : []),
        ],
      },
      include: {
        feeTransactions: true,
      },
    });

    if (targetApp) {
      // Find or create the AdmissionsFeeTransaction and mark SETTLED
      const existingFeeTx =
        targetApp.feeTransactions.find(
          (t) => t.paymentStatus === "PENDING" || t.paymentReference === reference
        ) || targetApp.feeTransactions[0];

      if (existingFeeTx) {
        await basePrisma.admissionsFeeTransaction.update({
          where: { id: existingFeeTx.id },
          data: {
            paymentStatus: "SETTLED",
            reconciliationNotes: `Verified and settled by Bursar (${verifiedBy})`,
            verifiedByUserId: verifiedBy,
            ...(proofUrl && !existingFeeTx.proofOfPaymentUrl ? { proofOfPaymentUrl: proofUrl } : {}),
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
          },
        });
      }

      // Also mark APPLICATION_FEE_RECEIPT document as MANUALLY_VERIFIED if present
      await basePrisma.admissionsDocument
        .updateMany({
          where: {
            applicationId: targetApp.id,
            documentType: { in: ["APPLICATION_FEE_RECEIPT", "applicationFeeReceipt", "FORM_FEE_RECEIPT"] },
          },
          data: {
            verificationStatus: "MANUALLY_VERIFIED",
          },
        })
        .catch(() => null);

      const appMeta: any = (targetApp.metadata as any) || {};
      const appMetaDocs: any = { ...(appMeta.documents || {}) };
      if (appMetaDocs.applicationFeeReceipt && typeof appMetaDocs.applicationFeeReceipt === "object") {
        appMetaDocs.applicationFeeReceipt = {
          ...appMetaDocs.applicationFeeReceipt,
          status: "VERIFIED",
          verified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy,
        };
      }
      appMetaDocs.formFeePaid = true;
      appMetaDocs.formFeeStatus = "PAID";
      appMetaDocs.feePaid = true;
      appMetaDocs.paymentState = "SETTLED";

      const appTierData: any = (targetApp.tierSpecificData as any) || {};
      const appTierDocs: any = { ...(appTierData.documents || {}) };
      if (appTierDocs.applicationFeeReceipt && typeof appTierDocs.applicationFeeReceipt === "object") {
        appTierDocs.applicationFeeReceipt = {
          ...appTierDocs.applicationFeeReceipt,
          status: "VERIFIED",
          verified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy,
        };
      }
      appTierDocs.formFeePaid = true;
      appTierDocs.formFeeStatus = "PAID";
      appTierDocs.feePaid = true;
      appTierDocs.paymentState = "SETTLED";
      appTierData.formFeePaid = true;
      appTierData.formFeeStatus = "PAID";
      appTierData.feePaid = true;
      appTierData.paymentState = "SETTLED";

      const nextAppStatus =
        targetApp.status === "PAYMENT_PENDING" || targetApp.status === "DRAFT"
          ? "UNDER_REVIEW"
          : targetApp.status;

      await basePrisma.admissionsApplication.update({
        where: { id: targetApp.id },
        data: {
          status: nextAppStatus,
          metadata: {
            ...appMeta,
            documents: appMetaDocs,
            feeSettledAt: new Date().toISOString(),
            feeSettledBy: verifiedBy,
          },
          tierSpecificData: {
            ...appTierData,
            documents: appTierDocs,
          },
        },
      });
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
 * Automatically reconciles and backfills Application Fee Receipts from AdmissionsApplication,
 * AdmissionRegister, AdmissionLead, and AdmissionsFeeTransaction into PaymentReceipt so that
 * no uploaded application fee receipt is ever missing, orphaned, or blocked by duplicate upload rows.
 */
export async function reconcileAdmissionFeeReceipts(tenantFilter?: string) {
  try {
    const isSpecificTenant =
      Boolean(tenantFilter) && tenantFilter !== "ALL" && tenantFilter !== "super-admin";

    const [apps, registers, leads, existingReceipts] = await Promise.all([
      basePrisma.admissionsApplication
        .findMany({
          where: isSpecificTenant
            ? { OR: [{ schoolId: tenantFilter }, { tenantId: tenantFilter }] }
            : {},
          include: {
            feeTransactions: true,
            documents: true,
          },
          orderBy: { createdAt: "desc" },
          take: 150,
        })
        .catch(() => []),
      basePrisma.admissionRegister
        .findMany({
          where: isSpecificTenant ? { tenantId: tenantFilter } : {},
          orderBy: { createdAt: "desc" },
          take: 150,
        })
        .catch(() => []),
      basePrisma.admissionLead
        .findMany({
          where: isSpecificTenant ? { schoolId: tenantFilter } : {},
          orderBy: { createdAt: "desc" },
          take: 150,
        })
        .catch(() => []),
      basePrisma.paymentReceipt
        .findMany({
          where: {
            moduleType: "ADMISSION_FORM_FEE",
            ...(isSpecificTenant
              ? { OR: [{ tenantId: tenantFilter }, { schoolId: tenantFilter }] }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
        .catch(() => []),
    ]);

    const extractUrl = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === "string" && val.trim().length > 0) return val.trim();
      if (typeof val === "object") {
        const u = val.url || val.fileUrl || val.path || val.storageKey;
        if (typeof u === "string" && u.trim().length > 0) return u.trim();
      }
      return null;
    };

    // Build unified candidate map keyed by canonical application or lead identity
    type CandidateReceiptInfo = {
      tenantId: string;
      schoolId: string;
      payerId: string;
      leadId?: string;
      appId?: string;
      regId?: string;
      payerName: string;
      referenceNo: string;
      legacyAppRef?: string;
      fileUrl: string;
      fileName?: string;
      depositorName?: string;
      transferReference?: string;
      amount: number;
      isVerified: boolean;
    };

    const candidates: CandidateReceiptInfo[] = [];
    const seenIds = new Set<string>();

    for (const app of apps) {
      const meta: any = (app.metadata as any) || {};
      const tierData: any = (app.tierSpecificData as any) || {};
      const metaDocs: any = meta.documents || {};
      const tierDocs: any = tierData.documents || {};
      const linkedLeadId = meta.leadId || tierData.leadId;

      const linkedLead = leads.find(
        (l) =>
          l.id === app.id ||
          (linkedLeadId && l.id === linkedLeadId) ||
          (app.email && l.studentEmail && l.studentEmail.toLowerCase() === app.email.toLowerCase())
      );
      const linkedReg = registers.find(
        (r) =>
          r.id === app.id ||
          r.applicationNo === app.applicationNumber ||
          (linkedLeadId && r.id === linkedLeadId) ||
          (app.email && r.email && r.email.toLowerCase() === app.email.toLowerCase())
      );

      const leadDocs: any = (linkedLead?.documents as any) || {};
      const regCreds: any =
        typeof linkedReg?.credentialsJson === "object" && linkedReg?.credentialsJson
          ? (linkedReg.credentialsJson as any)
          : {};

      const appFeeDoc = (app.documents || []).find((d: any) =>
        ["APPLICATION_FEE_RECEIPT", "applicationFeeReceipt", "FORM_FEE_RECEIPT"].includes(
          d.documentType
        )
      );

      const fileUrl =
        extractUrl(app.feeTransactions?.[0]?.proofOfPaymentUrl) ||
        extractUrl(appFeeDoc?.storageKey) ||
        extractUrl(metaDocs.applicationFeeReceipt) ||
        extractUrl(metaDocs.applicationFeeReceiptUrl) ||
        extractUrl(metaDocs.formFeeReceiptUrl) ||
        extractUrl(tierDocs.applicationFeeReceipt) ||
        extractUrl(tierDocs.applicationFeeReceiptUrl) ||
        extractUrl(linkedReg?.applicationFeeReceiptUrl) ||
        extractUrl(linkedReg?.formFeeReceiptUrl) ||
        extractUrl(regCreds.applicationFeeReceipt) ||
        extractUrl(regCreds.applicationFeeReceiptUrl) ||
        extractUrl(leadDocs.applicationFeeReceipt) ||
        extractUrl(leadDocs.applicationFeeReceiptUrl) ||
        extractUrl(leadDocs.formFeeReceiptUrl);

      if (!fileUrl) continue;

      const hasPendingTx = app.feeTransactions?.some((t: any) => t.paymentStatus === "PENDING");
      const isVerified =
        !hasPendingTx &&
        (app.feeTransactions?.some((t: any) => t.paymentStatus === "SETTLED") ||
          appFeeDoc?.verificationStatus === "MANUALLY_VERIFIED" ||
          Boolean(linkedReg?.formFeePaid) ||
          Boolean(regCreds.formFeePaid) ||
          Boolean(leadDocs.formFeePaid) ||
          metaDocs.applicationFeeReceipt?.status === "VERIFIED" ||
          tierDocs.applicationFeeReceipt?.status === "VERIFIED");

      const payerName = `${app.firstName || ""} ${app.lastName || ""}`.trim() || linkedLead?.applicantName || "Applicant";
      const canonicalRef =
        app.applicationNumber ||
        linkedReg?.applicationNo ||
        `APP-${app.id.slice(0, 6).toUpperCase()}`;
      const legacyAppRef = linkedLead
        ? `APP-${linkedLead.id.slice(0, 6).toUpperCase()}`
        : `APP-${app.id.slice(0, 6).toUpperCase()}`;

      seenIds.add(app.id);
      if (linkedLead) seenIds.add(linkedLead.id);
      if (linkedReg) seenIds.add(linkedReg.id);

      candidates.push({
        tenantId: app.tenantId || app.schoolId,
        schoolId: app.schoolId || app.tenantId,
        payerId: linkedLead?.id || app.id,
        leadId: linkedLead?.id,
        appId: app.id,
        regId: linkedReg?.id,
        payerName,
        referenceNo: canonicalRef,
        legacyAppRef,
        fileUrl,
        fileName:
          metaDocs.applicationFeeReceipt?.fileName ||
          leadDocs.applicationFeeReceipt?.fileName ||
          "application_fee_receipt.jpg",
        depositorName:
          metaDocs.depositorName ||
          leadDocs.depositorName ||
          regCreds.depositorName ||
          payerName,
        transferReference:
          app.feeTransactions?.[0]?.paymentReference ||
          metaDocs.transferReference ||
          leadDocs.transferReference ||
          canonicalRef,
        amount: Number(app.feeTransactions?.[0]?.amount) || 5000,
        isVerified,
      });

      // Ensure AdmissionsFeeTransaction exists in DB for this application
      if (!app.feeTransactions || app.feeTransactions.length === 0) {
        await basePrisma.admissionsFeeTransaction
          .create({
            data: {
              tenantId: app.tenantId || app.schoolId,
              applicationId: app.id,
              paymentMethod: "MANUAL_BANK_TRANSFER",
              amount: 5000,
              currency: "NGN",
              paymentReference: `FEE-${canonicalRef}`,
              proofOfPaymentUrl: fileUrl,
              paymentStatus: isVerified ? "SETTLED" : "PENDING",
              verifiedAt: isVerified ? new Date() : null,
            },
          })
          .catch(() => null);
      }
    }

    // Check remaining registers not yet matched to an AdmissionsApplication
    for (const reg of registers) {
      if (seenIds.has(reg.id)) continue;
      const regCreds: any =
        typeof reg.credentialsJson === "object" && reg.credentialsJson
          ? (reg.credentialsJson as any)
          : {};
      const fileUrl =
        extractUrl(reg.applicationFeeReceiptUrl) ||
        extractUrl(reg.formFeeReceiptUrl) ||
        extractUrl(regCreds.applicationFeeReceipt) ||
        extractUrl(regCreds.applicationFeeReceiptUrl);
      if (!fileUrl) continue;

      seenIds.add(reg.id);
      const payerName = `${reg.firstName || ""} ${reg.lastName || ""}`.trim() || "Applicant";
      candidates.push({
        tenantId: reg.tenantId,
        schoolId: reg.tenantId,
        payerId: reg.id,
        regId: reg.id,
        payerName,
        referenceNo: reg.applicationNo || `APP-${reg.id.slice(0, 6).toUpperCase()}`,
        legacyAppRef: `APP-${reg.id.slice(0, 6).toUpperCase()}`,
        fileUrl,
        depositorName: regCreds.depositorName || payerName,
        transferReference: regCreds.transferReference || reg.applicationNo,
        amount: 5000,
        isVerified: Boolean(reg.formFeePaid || regCreds.formFeePaid),
      });
    }

    // Check remaining leads not yet matched
    for (const lead of leads) {
      if (seenIds.has(lead.id)) continue;
      const leadDocs: any = (lead.documents as any) || {};
      const fileUrl =
        extractUrl(leadDocs.applicationFeeReceipt) ||
        extractUrl(leadDocs.applicationFeeReceiptUrl) ||
        extractUrl(leadDocs.formFeeReceiptUrl);
      if (!fileUrl) continue;

      seenIds.add(lead.id);
      const appNo = `APP-${lead.id.slice(0, 6).toUpperCase()}`;
      candidates.push({
        tenantId: lead.schoolId,
        schoolId: lead.schoolId,
        payerId: lead.id,
        leadId: lead.id,
        payerName: lead.applicantName || "Applicant",
        referenceNo: appNo,
        legacyAppRef: appNo,
        fileUrl,
        depositorName: leadDocs.depositorName || lead.applicantName,
        transferReference: leadDocs.transferReference || appNo,
        amount: 5000,
        isVerified: Boolean(leadDocs.formFeePaid),
      });
    }

    // Reconcile each candidate with PaymentReceipt table
    for (const cand of candidates) {
      const matchingReceipts = existingReceipts.filter((r) => {
        const sameTenant = r.tenantId === cand.tenantId || r.schoolId === cand.schoolId;
        if (!sameTenant) return false;
        const matchPayerId =
          r.payerId &&
          (r.payerId === cand.payerId ||
            r.payerId === cand.appId ||
            r.payerId === cand.leadId ||
            r.payerId === cand.regId);
        const matchRef =
          r.referenceNo === cand.referenceNo ||
          (cand.legacyAppRef && r.referenceNo === cand.legacyAppRef);
        const matchName =
          r.payerName &&
          cand.payerName &&
          r.payerName.trim().toLowerCase() === cand.payerName.trim().toLowerCase();
        return Boolean(matchPayerId || matchRef || matchName);
      });

      if (matchingReceipts.length === 0) {
        // Backfill missing PaymentReceipt so Bursar sees it immediately
        const created = await basePrisma.paymentReceipt
          .create({
            data: {
              tenantId: cand.tenantId,
              schoolId: cand.schoolId,
              moduleType: "ADMISSION_FORM_FEE",
              payerType: "APPLICANT",
              payerId: cand.payerId,
              payerName: cand.payerName,
              referenceNo: cand.referenceNo,
              amount: cand.amount,
              paymentMethod: "BANK_TRANSFER",
              paymentMode: "MANUAL_TRANSFER",
              fileUrl: cand.fileUrl,
              proofOfPaymentUrl: cand.fileUrl,
              fileName: cand.fileName || "application_fee_receipt.jpg",
              depositorName: cand.depositorName || cand.payerName,
              transferReference: cand.transferReference || cand.referenceNo,
              txnRef: cand.transferReference || cand.referenceNo,
              status: cand.isVerified ? "VERIFIED" : "PENDING",
              state: cand.isVerified ? "SETTLED" : "PENDING_VERIFICATION",
              verifiedBy: cand.isVerified ? "Admissions / Bursar Sync" : null,
              verifiedAt: cand.isVerified ? new Date() : null,
            },
          })
          .catch(() => null);
        if (created) (existingReceipts as any[]).unshift(created);
      } else {
        // Pick primary receipt (prefer PENDING if awaiting verification, else VERIFIED, else newest)
        const primary =
          matchingReceipts.find((r) => r.status === "PENDING") ||
          matchingReceipts.find((r) => r.status === "VERIFIED") ||
          matchingReceipts[0];

        // Never overwrite an active PENDING receipt to VERIFIED automatically — let the Bursar verify it
        const needsUpdate =
          primary.referenceNo !== cand.referenceNo ||
          (!primary.fileUrl && cand.fileUrl);

        if (needsUpdate) {
          await basePrisma.paymentReceipt
            .update({
              where: { id: primary.id },
              data: {
                referenceNo: cand.referenceNo,
                fileUrl: cand.fileUrl || primary.fileUrl,
                proofOfPaymentUrl: cand.fileUrl || primary.proofOfPaymentUrl,
              },
            })
            .catch(() => null);
        }

        // Clean up redundant PENDING clones created by repeated uploads for the same applicant
        if (matchingReceipts.length > 1) {
          const redundantClones = matchingReceipts.filter(
            (r) => r.id !== primary.id && r.status === "PENDING"
          );
          if (redundantClones.length > 0) {
            await basePrisma.paymentReceipt
              .deleteMany({
                where: { id: { in: redundantClones.map((c) => c.id) } },
              })
              .catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[RECONCILE_ADMISSION_FEE_RECEIPTS_WARN]:", err);
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
  // Auto-reconcile admission fee receipts so all uploaded receipts reflect accurately
  if (!params.moduleType || params.moduleType === "ALL" || params.moduleType === "ADMISSION_FORM_FEE") {
    await reconcileAdmissionFeeReceipts(params.tenantId || params.schoolId);
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  const andConditions: any[] = [];

  if (params.tenantId && params.tenantId !== "ALL" && params.tenantId !== "super-admin") {
    andConditions.push({
      OR: [{ tenantId: params.tenantId }, { schoolId: params.tenantId }],
    });
  } else if (params.schoolId) {
    andConditions.push({
      OR: [{ schoolId: params.schoolId }, { tenantId: params.schoolId }],
    });
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
    andConditions.push({
      OR: [
        { payerName: { contains: s, mode: "insensitive" } },
        { depositorName: { contains: s, mode: "insensitive" } },
        { referenceNo: { contains: s, mode: "insensitive" } },
        { txnRef: { contains: s, mode: "insensitive" } },
        { transferReference: { contains: s, mode: "insensitive" } },
        { bankName: { contains: s, mode: "insensitive" } },
      ],
    });
  }
  if (andConditions.length > 0) {
    where.AND = andConditions;
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

  // 2. Automated Deduplication Pipeline:
  // Detects multiple transactions sharing same Application/Student ID (referenceNo), Module (moduleType), and Amount
  const candidateCompositePairs = Array.from(
    new Set(
      receipts.map((r: any) =>
        JSON.stringify({
          moduleType: r.moduleType,
          amount: r.amount,
          referenceNo: (r.referenceNo || "").trim().toUpperCase(),
        })
      )
    )
  ).map((s) => JSON.parse(s));

  const compositeDuplicateMap = new Map<string, any[]>();

  if (candidateCompositePairs.length > 0) {
    const compWhere: any = {
      OR: candidateCompositePairs.map((p) => ({
        moduleType: p.moduleType,
        amount: p.amount,
        referenceNo: { equals: p.referenceNo, mode: "insensitive" },
      })),
    };
    if (params.tenantId && params.tenantId !== "ALL" && params.tenantId !== "super-admin") {
      compWhere.tenantId = params.tenantId;
    }

    const matchingCompositeReceipts = await basePrisma.paymentReceipt.findMany({
      where: compWhere,
      select: {
        id: true,
        referenceNo: true,
        payerName: true,
        payerType: true,
        moduleType: true,
        amount: true,
        paymentDate: true,
        paymentMethod: true,
        bankName: true,
        txnRef: true,
        transferReference: true,
        depositorName: true,
        fileUrl: true,
        status: true,
        state: true,
        masterReceiptId: true,
        duplicateNotes: true,
        verifiedBy: true,
        verifiedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    for (const item of matchingCompositeReceipts) {
      const key = `${item.moduleType}::${item.amount}::${(item.referenceNo || "").trim().toUpperCase()}`;
      const list = compositeDuplicateMap.get(key) || [];
      list.push(item);
      compositeDuplicateMap.set(key, list);
    }
  }

  const enrichedReceipts = receipts.map((r: any) => {
    const refKey = (r.transferReference || r.txnRef || "").trim().toUpperCase();
    const matches = refKey ? duplicateMap.get(refKey) || [] : [];
    const others = matches.filter((m) => m.id !== r.id);

    const compKey = `${r.moduleType}::${r.amount}::${(r.referenceNo || "").trim().toUpperCase()}`;
    const allInGroup = compositeDuplicateMap.get(compKey) || [];
    const competingReceipts = allInGroup.filter((m) => m.id !== r.id);

    // Flag as potential duplicate if multiple entries exist in the group and needs resolution
    const isPotentialDuplicate =
      competingReceipts.length > 0 &&
      allInGroup.some((c) => c.status === "PENDING" || c.status === "VERIFIED") &&
      r.status !== "DUPLICATE" &&
      r.status !== "REJECTED";

    return {
      ...r,
      isDuplicateReference: others.length > 0,
      duplicateCount: others.length,
      duplicateWith: others.map((o) => `${o.payerName} (${o.referenceNo})`),
      // Automated Deduplication Pipeline attributes
      isPotentialDuplicate,
      competingReceipts: allInGroup,
      competingCount: competingReceipts.length,
    };
  });

  // Aggregate stats
  const statsWhere: any = {};
  if (params.tenantId && params.tenantId !== "ALL" && params.tenantId !== "super-admin") {
    statsWhere.tenantId = params.tenantId;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingCount, verifiedTodayAgg, amountVerifiedAgg, duplicateCount] = await Promise.all([
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
    basePrisma.paymentReceipt.count({
      where: { ...statsWhere, status: "DUPLICATE" },
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
      duplicateCount,
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


