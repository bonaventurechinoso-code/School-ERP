"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { dispatchAdmissionsNotification } from "@/lib/notifications/admissionsNotifier";

export async function fetchAdmissionsReconciliationsQueue(schoolId: string) {
  try {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ id: schoolId }, { subdomain: schoolId.toLowerCase() }, { slug: schoolId.toLowerCase() }],
      },
      select: { id: true, name: true, subdomain: true },
    });

    const targetSchoolId = school?.id || schoolId;

    const transactions = await basePrisma.admissionsFeeTransaction.findMany({
      where: {
        application: {
          schoolId: targetSchoolId,
        },
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            whatsappNumber: true,
            programId: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, transactions, school };
  } catch (error: any) {
    console.error("[fetchAdmissionsReconciliationsQueue error]:", error);
    return { success: false, transactions: [], error: error.message };
  }
}

export async function approveAdmissionsFeeTransaction({
  transactionId,
  schoolId,
  reconciliationNotes = "Reconciled with institutional bank ledger",
  verifiedByUserId = "Bursar Officer",
}: {
  transactionId: string;
  schoolId: string;
  reconciliationNotes?: string;
  verifiedByUserId?: string;
}) {
  try {
    const txRecord = await basePrisma.admissionsFeeTransaction.findUnique({
      where: { id: transactionId },
      include: { application: true },
    });

    if (!txRecord) {
      return { success: false, error: "Payment transaction record not found." };
    }

    if (txRecord.application.schoolId !== schoolId && txRecord.tenantId !== schoolId) {
      return { success: false, error: "403 Forbidden: Cross-tenant ledger reconciliation rejected." };
    }

    const school = await basePrisma.school.findFirst({
      where: { id: txRecord.application.schoolId },
      select: { name: true, subdomain: true },
    });

    // Execute atomic reconciliation: update transaction and advance application to SUBMITTED
    const updated = await basePrisma.$transaction(async (prismaTx) => {
      const settledTx = await prismaTx.admissionsFeeTransaction.update({
        where: { id: transactionId },
        data: {
          paymentStatus: "SETTLED",
          reconciliationNotes,
          verifiedByUserId,
          verifiedAt: new Date(),
        },
      });

      // Transition application from DRAFT/PAYMENT_PENDING to SUBMITTED
      const updatedApp = await prismaTx.admissionsApplication.update({
        where: { id: txRecord.applicationId },
        data: {
          status: "SUBMITTED",
          metadata: {
            ...((txRecord.application.metadata as any) || {}),
            settledPaymentRef: txRecord.paymentReference,
            settledAt: new Date().toISOString(),
          },
        },
      });

      return { settledTx, updatedApp };
    });

    // Generate verified fiscal receipt URL with verification QR code
    const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";
    const receiptDownloadUrl = `${host}/${school?.subdomain || "portal"}/admissions/receipt/${txRecord.id}`;

    // Dispatch real-time omnichannel PAYMENT_CONFIRMED event via admissionsNotifier
    await dispatchAdmissionsNotification({
      tenantId: txRecord.tenantId,
      schoolName: school?.name || "School ERP",
      applicantNumber: txRecord.application.applicationNumber,
      recipient: {
        name: `${txRecord.application.firstName} ${txRecord.application.lastName}`,
        email: txRecord.application.email,
        phone: txRecord.application.phoneNumber,
        whatsappNumber: txRecord.application.whatsappNumber || txRecord.application.phoneNumber,
      },
      event: "PAYMENT_CONFIRMED",
      paymentReference: txRecord.paymentReference,
      amountPaid: Number(txRecord.amount),
      receiptDownloadUrl,
    }).catch((notifErr) => {
      console.warn("[PAYMENT_CONFIRMED_NOTIFICATION_WARN]:", notifErr);
    });

    revalidatePath("/[schoolDomain]/finance/admissions-reconciliations", "page");
    return { success: true, transaction: updated.settledTx, receiptUrl: receiptDownloadUrl };
  } catch (error: any) {
    console.error("[approveAdmissionsFeeTransaction error]:", error);
    return { success: false, error: error.message || "Failed to settle payment." };
  }
}

export async function rejectAdmissionsFeeTransaction({
  transactionId,
  schoolId,
  reason,
  verifiedByUserId = "Bursar Officer",
}: {
  transactionId: string;
  schoolId: string;
  reason: string;
  verifiedByUserId?: string;
}) {
  try {
    const txRecord = await basePrisma.admissionsFeeTransaction.findUnique({
      where: { id: transactionId },
      include: { application: true },
    });

    if (!txRecord) {
      return { success: false, error: "Payment transaction record not found." };
    }

    if (txRecord.application.schoolId !== schoolId && txRecord.tenantId !== schoolId) {
      return { success: false, error: "403 Forbidden: Cross-tenant ledger reconciliation rejected." };
    }

    const school = await basePrisma.school.findFirst({
      where: { id: txRecord.application.schoolId },
      select: { name: true, subdomain: true },
    });

    const updated = await basePrisma.admissionsFeeTransaction.update({
      where: { id: transactionId },
      data: {
        paymentStatus: "REJECTED",
        reconciliationNotes: reason,
        verifiedByUserId,
        verifiedAt: new Date(),
      },
    });

    // Alert applicant with instructions to upload valid payment proof
    const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";
    const reuploadLink = `${host}/${school?.subdomain || "portal"}/admissions/upload/${txRecord.applicationId}`;

    await dispatchAdmissionsNotification({
      tenantId: txRecord.tenantId,
      schoolName: school?.name || "School ERP",
      applicantNumber: txRecord.application.applicationNumber,
      recipient: {
        name: `${txRecord.application.firstName} ${txRecord.application.lastName}`,
        email: txRecord.application.email,
        phone: txRecord.application.phoneNumber,
        whatsappNumber: txRecord.application.whatsappNumber || txRecord.application.phoneNumber,
      },
      event: "DOCUMENT_REJECTED",
      rejectedDocumentType: "Application Fee Payment Proof",
      rejectionReason: `Proof rejected by Bursary: ${reason}. Please upload valid bank teller or mobile transfer slip.`,
      reuploadLink,
    }).catch((notifErr) => {
      console.warn("[PAYMENT_REJECTION_NOTIF_WARN]:", notifErr);
    });

    revalidatePath("/[schoolDomain]/finance/admissions-reconciliations", "page");
    return { success: true, transaction: updated };
  } catch (error: any) {
    console.error("[rejectAdmissionsFeeTransaction error]:", error);
    return { success: false, error: error.message || "Failed to reject transaction." };
  }
}
