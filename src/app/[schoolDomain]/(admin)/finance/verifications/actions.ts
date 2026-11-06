"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-logger";

export async function getVerificationQueue(
  schoolDomain: string,
  filterStatus?: string,
  searchQuery?: string
) {
  try {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: schoolDomain.trim().toLowerCase() },
          { id: schoolDomain.trim() },
        ],
      },
      select: { id: true, name: true, subdomain: true },
    });

    if (!school) {
      return { success: false, error: "School not found", proofs: [], stats: null };
    }

    const { reconcileAdmissionFeeReceipts } = await import("@/lib/payment-receipt-service");
    await reconcileAdmissionFeeReceipts(school.id).catch(() => null);

    const whereClause: any = { schoolId: school.id };

    if (filterStatus && filterStatus !== "ALL") {
      whereClause.status = filterStatus.toUpperCase();
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim();
      whereClause.OR = [
        { studentName: { contains: q, mode: "insensitive" } },
        { admissionNumber: { contains: q, mode: "insensitive" } },
        { sessionId: { contains: q, mode: "insensitive" } },
        { payerBankName: { contains: q, mode: "insensitive" } },
      ];
    }

    const receiptWhere: any = {
      OR: [{ tenantId: school.id }, { schoolId: school.id }],
    };
    if (filterStatus && filterStatus !== "ALL") {
      const up = filterStatus.toUpperCase();
      receiptWhere.status = up === "APPROVED" ? "VERIFIED" : up;
    }

    const [rawProofs, rawReceipts] = await Promise.all([
      basePrisma.paymentProof.findMany({
        where: whereClause,
        orderBy: { submittedAt: "desc" },
        take: 100,
        include: {
          invoice: {
            select: {
              id: true,
              description: true,
              amountDue: true,
              amountPaid: true,
              status: true,
            },
          },
        },
      }),
      basePrisma.paymentReceipt
        .findMany({
          where: receiptWhere,
          orderBy: { createdAt: "desc" },
          take: 100,
        })
        .catch(() => []),
    ]);

    const mappedReceipts = rawReceipts.map((rc) => ({
      id: rc.id,
      studentName: rc.payerName,
      admissionNumber: rc.referenceNo,
      amount: rc.amount,
      paidAt: rc.paymentDate || rc.createdAt,
      payerBankName:
        rc.bankName ||
        (rc.moduleType === "ADMISSION_FORM_FEE" ? "Application Fee" : rc.moduleType),
      payerAccountName: rc.depositorName || rc.payerName,
      sessionId: rc.transferReference || rc.txnRef || rc.referenceNo,
      proofImageUrl: rc.fileUrl || rc.proofOfPaymentUrl || "",
      status: rc.status === "VERIFIED" ? "APPROVED" : rc.status,
      submittedAt: rc.createdAt,
      verifiedAt: rc.verifiedAt,
      verifiedByName: rc.verifiedBy,
      rejectionReason: rc.rejectionReason,
      invoice: {
        id: rc.linkedInvoiceId || rc.id,
        description:
          rc.moduleType === "ADMISSION_FORM_FEE"
            ? "Admission Application Fee"
            : rc.moduleType.replace(/_/g, " "),
        amountDue: rc.amount,
        amountPaid: rc.status === "VERIFIED" ? rc.amount : 0,
        status: rc.status === "VERIFIED" ? "PAID" : "PENDING",
      },
    }));

    const proofs = [...rawProofs, ...(mappedReceipts as any)];

    // Compute KPI Stats combining both PaymentProof and PaymentReceipt
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const receiptScope = { OR: [{ tenantId: school.id }, { schoolId: school.id }] };

    const [
      proofPendingCount,
      proofApprovedTodayCount,
      proofRejectedCount,
      proofApprovedAgg,
      rcPendingCount,
      rcApprovedTodayCount,
      rcRejectedCount,
      rcApprovedAgg,
    ] = await Promise.all([
      basePrisma.paymentProof.count({
        where: { schoolId: school.id, status: "PENDING" },
      }),
      basePrisma.paymentProof.count({
        where: {
          schoolId: school.id,
          status: "APPROVED",
          verifiedAt: { gte: today },
        },
      }),
      basePrisma.paymentProof.count({
        where: { schoolId: school.id, status: "REJECTED" },
      }),
      basePrisma.paymentProof.aggregate({
        where: { schoolId: school.id, status: "APPROVED" },
        _sum: { amount: true },
      }),
      basePrisma.paymentReceipt
        .count({ where: { ...receiptScope, status: "PENDING" } })
        .catch(() => 0),
      basePrisma.paymentReceipt
        .count({
          where: {
            ...receiptScope,
            status: "VERIFIED",
            verifiedAt: { gte: today },
          },
        })
        .catch(() => 0),
      basePrisma.paymentReceipt
        .count({ where: { ...receiptScope, status: "REJECTED" } })
        .catch(() => 0),
      basePrisma.paymentReceipt
        .aggregate({
          where: { ...receiptScope, status: "VERIFIED" },
          _sum: { amount: true },
        })
        .catch(() => ({ _sum: { amount: 0 } })),
    ]);

    const pendingCount = proofPendingCount + rcPendingCount;
    const approvedTodayCount = proofApprovedTodayCount + rcApprovedTodayCount;
    const rejectedCount = proofRejectedCount + rcRejectedCount;
    const totalVerifiedRevenue =
      (proofApprovedAgg._sum.amount || 0) + (rcApprovedAgg._sum.amount || 0);

    return {
      success: true,
      school,
      proofs,
      stats: {
        pendingCount,
        approvedTodayCount,
        rejectedCount,
        totalVerifiedRevenue,
      },
    };
  } catch (err: any) {
    console.error("[GET_VERIFICATION_QUEUE_ERROR]:", err);
    return {
      success: false,
      error: err?.message || "Failed to load verification queue.",
      proofs: [],
      stats: null,
    };
  }
}

export async function approvePaymentProof(schoolDomain: string, proofId: string) {
  try {
    const session = await getSession();
    const verifierName = session?.staffRole || session?.name || "School Bursar";
    const verifierId = session?.userId || "bursar";

    // Check if proofId is a PaymentReceipt (such as an ADMISSION_FORM_FEE Application Fee Receipt)
    const existingReceipt = await basePrisma.paymentReceipt
      .findUnique({ where: { id: proofId } })
      .catch(() => null);
    if (existingReceipt) {
      const { verifyPaymentReceipt } = await import("@/lib/payment-receipt-service");
      const updatedRc = await verifyPaymentReceipt({
        receiptId: existingReceipt.id,
        action: "VERIFY",
        verifiedBy: verifierName,
        verifiedByUserId: verifierId,
      });
      const cleanDomain = schoolDomain.trim().toLowerCase();
      try {
        revalidatePath(`/${cleanDomain}/finance/verifications`);
        revalidatePath(`/bursar/verifications`);
        revalidatePath(`/bursar`);
      } catch {}
      return {
        success: true,
        message: `Payment of ₦${Number(updatedRc.amount).toLocaleString()} approved and ledger updated.`,
      };
    }

    const result = await basePrisma.$transaction(async (tx) => {
      const proof = await tx.paymentProof.findUnique({
        where: { id: proofId },
        include: { invoice: true },
      });

      if (!proof) {
        throw new Error("Payment proof record not found.");
      }

      if (proof.status !== "PENDING") {
        throw new Error(`This payment proof has already been marked ${proof.status}.`);
      }

      // 1. Mark Proof Approved & State SETTLED
      const updatedProof = await tx.paymentProof.update({
        where: { id: proof.id },
        data: {
          status: "APPROVED",
          state: "SETTLED",
          verifiedAt: new Date(),
          verifiedById: verifierId,
          verifiedByUserId: verifierId,
          verifiedByName: verifierName,
        },
      });

      // 2. Settle or deduct from target invoice
      let targetInvoiceId = proof.invoiceId;

      if (!targetInvoiceId) {
        // Fallback: find earliest pending invoice for this student
        const openInvoice = await tx.invoice.findFirst({
          where: {
            studentId: proof.studentId,
            status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          },
          orderBy: { dueDate: "asc" },
        });
        if (openInvoice) {
          targetInvoiceId = openInvoice.id;
        }
      }

      if (targetInvoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: targetInvoiceId },
        });

        if (invoice) {
          const newAmountPaid = invoice.amountPaid + proof.amount;
          const newStatus = newAmountPaid >= invoice.amountDue ? "PAID" : "PARTIAL";

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newAmountPaid,
              status: newStatus,
              paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
            },
          });

          // Create formal Payment record with verification metadata
          await tx.payment.create({
            data: {
              schoolId: proof.schoolId,
              studentId: proof.studentId,
              invoiceId: invoice.id,
              amountPaid: proof.amount,
              paymentDate: proof.paidAt || new Date(),
              method: "MANUAL_TRANSFER",
              paymentMode: "MANUAL_TRANSFER",
              state: "SETTLED",
              proofOfPaymentUrl: proof.proofOfPaymentUrl || proof.proofImageUrl,
              depositorName: proof.depositorName || proof.payerAccountName || proof.studentName,
              transferReference: proof.transferReference || proof.sessionId,
              verifiedByUserId: verifierId,
              verifiedAt: new Date(),
            },
          });
        }
      }

      // 3. Update Student feeStatus
      const unpaidInvoices = await tx.invoice.findMany({
        where: {
          studentId: proof.studentId,
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
      });

      const studentFeeStatus = unpaidInvoices.length === 0 ? "PAID" : "PARTIAL";

      await tx.student.update({
        where: { id: proof.studentId },
        data: { feeStatus: studentFeeStatus },
      });

      return updatedProof;
    });

    await logAuditEvent({
      actorId: verifierId,
      action: "PAYMENT_PROOF_VERIFIED_SETTLED",
      target: `payment_proof:${result.id}`,
      schoolId: result.schoolId,
      metadata: {
        proofId: result.id,
        studentId: result.studentId,
        amount: result.amount,
        transferReference: result.transferReference || result.sessionId,
        state: "SETTLED",
        verifiedBy: verifierName,
      },
    });

    const cleanDomain = schoolDomain.trim().toLowerCase();
    revalidatePath(`/${cleanDomain}/finance/verifications`);
    revalidatePath(`/${cleanDomain}/dashboard`);
    revalidatePath(`/${cleanDomain}/finance`);
    revalidatePath(`/${cleanDomain}/portal/student`);

    return {
      success: true,
      message: `Payment of ₦${result.amount.toLocaleString()} approved and ledger updated.`,
    };
  } catch (err: any) {
    console.error("[APPROVE_PROOF_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to approve payment." };
  }
}

export async function rejectPaymentProof(
  schoolDomain: string,
  proofId: string,
  reason: string
) {
  try {
    if (!reason || !reason.trim()) {
      return { success: false, error: "A clear rejection reason is required." };
    }

    const session = await getSession();
    const verifierName = session?.staffRole || session?.name || "School Bursar";
    const verifierId = session?.userId || "bursar";

    // Check if proofId is a PaymentReceipt (such as an ADMISSION_FORM_FEE Application Fee Receipt)
    const existingReceipt = await basePrisma.paymentReceipt
      .findUnique({ where: { id: proofId } })
      .catch(() => null);
    if (existingReceipt) {
      const { verifyPaymentReceipt } = await import("@/lib/payment-receipt-service");
      await verifyPaymentReceipt({
        receiptId: existingReceipt.id,
        action: "REJECT",
        verifiedBy: verifierName,
        verifiedByUserId: verifierId,
        rejectionReason: reason.trim(),
      });
      const cleanDomain = schoolDomain.trim().toLowerCase();
      try {
        revalidatePath(`/${cleanDomain}/finance/verifications`);
        revalidatePath(`/bursar/verifications`);
        revalidatePath(`/bursar`);
      } catch {}
      return {
        success: true,
        message: "Payment rejected and reason logged for applicant/parent.",
      };
    }

    const result = await basePrisma.$transaction(async (tx) => {
      const proof = await tx.paymentProof.findUnique({
        where: { id: proofId },
      });

      if (!proof) {
        throw new Error("Payment proof record not found.");
      }

      if (proof.status !== "PENDING") {
        throw new Error(`This payment proof has already been marked ${proof.status}.`);
      }

      const updatedProof = await tx.paymentProof.update({
        where: { id: proof.id },
        data: {
          status: "REJECTED",
          state: "REJECTED",
          rejectionReason: reason.trim(),
          verifiedAt: new Date(),
          verifiedById: verifierId,
          verifiedByUserId: verifierId,
          verifiedByName: verifierName,
        },
      });

      // Update Student feeStatus
      const otherPending = await tx.paymentProof.findFirst({
        where: {
          studentId: proof.studentId,
          status: "PENDING",
        },
      });

      if (!otherPending) {
        const openInvoices = await tx.invoice.findMany({
          where: {
            studentId: proof.studentId,
            status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          },
        });

        const feeStatus = openInvoices.length > 0 ? "UNPAID" : "PAID";

        await tx.student.update({
          where: { id: proof.studentId },
          data: { feeStatus },
        });
      }

      return updatedProof;
    });

    await logAuditEvent({
      actorId: verifierId,
      action: "PAYMENT_PROOF_REJECTED",
      target: `payment_proof:${result.id}`,
      schoolId: result.schoolId,
      metadata: {
        proofId: result.id,
        studentId: result.studentId,
        amount: result.amount,
        transferReference: result.transferReference || result.sessionId,
        state: "REJECTED",
        rejectionReason: reason.trim(),
        verifiedBy: verifierName,
      },
    });

    const cleanDomain = schoolDomain.trim().toLowerCase();
    revalidatePath(`/${cleanDomain}/finance/verifications`);
    revalidatePath(`/${cleanDomain}/dashboard`);
    revalidatePath(`/${cleanDomain}/finance`);
    revalidatePath(`/${cleanDomain}/portal/student`);

    return {
      success: true,
      message: "Payment proof rejected and reason recorded for parent.",
    };
  } catch (err: any) {
    console.error("[REJECT_PROOF_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to reject payment." };
  }
}
