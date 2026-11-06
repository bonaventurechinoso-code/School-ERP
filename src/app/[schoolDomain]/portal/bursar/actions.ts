"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful fallback when invoked outside Next.js request context
  }
}

export interface BursarProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  avatarUrl?: string | null;
}

export interface FeeCollectionItem {
  id: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  amount: number;
  paymentDate: string;
  method: string;
  invoiceId: string;
  invoiceDescription: string;
}

export interface InvoiceItem {
  id: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  description: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | string;
  createdAt: string;
}

export interface ExpenseItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  createdAt: string;
  referenceId?: string | null;
}

export interface LedgerItem {
  id: string;
  date: string;
  type: "INCOME" | "EXPENSE" | string;
  category: string;
  description: string;
  amount: number;
}

export interface ArrearsItem {
  id: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  parentPhone?: string | null;
  amountDue: number;
  amountPaid: number;
  arrearsAmount: number;
  dueDate: string;
  status: string;
}

export interface PayrollDisbursalItem {
  id: string;
  staffName: string;
  staffRole: string;
  department: string;
  amount: number;
  status: "PENDING" | "PAID" | string;
  payDate: string;
  receiptCode?: string | null;
}

export interface PaymentProofAuditItem {
  id: string;
  studentName: string;
  admissionNumber: string;
  amount: number;
  paidAt: string;
  payerBankName: string;
  payerAccountName?: string | null;
  sessionId: string;
  proofImageUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
}

export interface BursarPortalData {
  school: {
    id: string;
    name: string;
    subdomain: string;
    logo?: string | null;
  };
  bursar: BursarProfileData;
  metrics: {
    totalFeesCollected: number;
    totalOutstandingBalances: number;
    totalExpensesLogged: number;
    pendingInvoiceApprovals: number;
  };
  recentPayments: FeeCollectionItem[];
  invoices: InvoiceItem[];
  expenses: ExpenseItem[];
  ledger: LedgerItem[];
  arrears: ArrearsItem[];
  payroll: PayrollDisbursalItem[];
  pendingProofs: PaymentProofAuditItem[];
}

export async function fetchBursarPortalInitialData(
  schoolId: string,
  bursarEmail?: string
): Promise<BursarPortalData> {
  // 1. Fetch School Entity
  const school = await basePrisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      subdomain: true,
      logo: true,
    },
  });

  if (!school) {
    throw new Error("School not found");
  }

  // 2. Resolve Bursar profile
  let bursarUser: any = null;
  if (bursarEmail) {
    bursarUser = await basePrisma.user.findFirst({
      where: { schoolId, email: bursarEmail },
      include: { staff: true },
    });

    if (!bursarUser) {
      bursarUser = await basePrisma.staff.findFirst({
        where: { schoolId, email: bursarEmail },
      });
    }
  }

  const bursarProfile: BursarProfileData = {
    id: bursarUser?.id || "bursar-officer",
    name: bursarUser?.firstName && bursarUser?.lastName
      ? `${bursarUser.firstName} ${bursarUser.lastName}`
      : bursarEmail
      ? bursarEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Chief Bursar & Finance Officer",
    email: bursarEmail || bursarUser?.email || "bursar@school.edu",
    role: "BURSAR",
    title: "Chief Finance Controller & Bursar",
    avatarUrl: null,
  };

  // 3. Parallel Database Reads for Financial Modules
  const [
    payments,
    invoicesList,
    transactions,
    payrollRecords,
    paymentProofs,
  ] = await Promise.all([
    basePrisma.payment.findMany({
      where: { schoolId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            currentClass: true,
          },
        },
        invoice: {
          select: {
            id: true,
            description: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 40,
    }),
    basePrisma.invoice.findMany({
      where: { schoolId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            currentClass: true,
            parentPhone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    basePrisma.transaction.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    basePrisma.payrollRecord.findMany({
      where: { schoolId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { payDate: "desc" },
      take: 40,
    }),
    basePrisma.paymentProof.findMany({
      where: { schoolId, status: "PENDING" },
      orderBy: { submittedAt: "desc" },
      take: 20,
    }),
  ]);

  // Also reconcile and load pending PaymentReceipts (including Application Fee Receipts) for Bursar visibility
  const { reconcileAdmissionFeeReceipts, verifyPaymentReceipt } = await import(
    "@/lib/payment-receipt-service"
  );
  await reconcileAdmissionFeeReceipts(schoolId).catch(() => null);
  const pendingReceipts = await basePrisma.paymentReceipt
    .findMany({
      where: {
        OR: [{ tenantId: schoolId }, { schoolId }],
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    })
    .catch(() => []);

  // Calculations for Metrics
  const totalFeesCollected = payments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);

  const totalOutstandingBalances = invoicesList.reduce((acc, inv) => {
    const balance = Math.max(0, (inv.amountDue || 0) - (inv.amountPaid || 0));
    return acc + balance;
  }, 0);

  const totalExpensesLogged = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const pendingInvoiceApprovals = paymentProofs.length + pendingReceipts.length;

  // Format Payments
  const recentPayments: FeeCollectionItem[] = payments.map((p) => ({
    id: p.id,
    studentName: `${p.student.firstName} ${p.student.lastName}`,
    admissionNumber: p.student.admissionNumber || "N/A",
    className: p.student.currentClass || "General Cohort",
    amount: p.amountPaid,
    paymentDate: p.paymentDate.toISOString().split("T")[0],
    method: p.method,
    invoiceId: p.invoiceId,
    invoiceDescription: p.invoice?.description || "Tuition / Fee Payment",
  }));

  // Format Invoices
  const invoices: InvoiceItem[] = invoicesList.map((inv) => ({
    id: inv.id,
    studentName: `${inv.student.firstName} ${inv.student.lastName}`,
    admissionNumber: inv.student.admissionNumber || "N/A",
    className: inv.student.currentClass || "General Cohort",
    description: inv.description,
    amountDue: inv.amountDue,
    amountPaid: inv.amountPaid,
    balance: Math.max(0, inv.amountDue - inv.amountPaid),
    dueDate: inv.dueDate.toISOString().split("T")[0],
    status: inv.status,
    createdAt: inv.createdAt.toISOString().split("T")[0],
  }));

  // Format Expenses
  const expenses: ExpenseItem[] = transactions
    .filter((t) => t.type === "EXPENSE")
    .map((t) => ({
      id: t.id,
      description: t.description,
      category: t.category,
      amount: t.amount,
      createdAt: t.createdAt.toISOString().split("T")[0],
      referenceId: t.referenceId,
    }));

  // Format Ledger
  const ledger: LedgerItem[] = transactions.map((t) => ({
    id: t.id,
    date: t.createdAt.toISOString().split("T")[0],
    type: t.type,
    category: t.category,
    description: t.description,
    amount: t.amount,
  }));

  // Format Arrears (Only overdue or partially unpaid invoices)
  const arrears: ArrearsItem[] = invoicesList
    .filter((inv) => inv.amountPaid < inv.amountDue)
    .map((inv) => ({
      id: inv.id,
      studentName: `${inv.student.firstName} ${inv.student.lastName}`,
      admissionNumber: inv.student.admissionNumber || "N/A",
      className: inv.student.currentClass || "General Cohort",
      parentPhone: inv.student.parentPhone,
      amountDue: inv.amountDue,
      amountPaid: inv.amountPaid,
      arrearsAmount: inv.amountDue - inv.amountPaid,
      dueDate: inv.dueDate.toISOString().split("T")[0],
      status: inv.status,
    }));

  // Format Payroll
  const payroll: PayrollDisbursalItem[] = payrollRecords.map((pr) => ({
    id: pr.id,
    staffName: `${pr.staff.firstName} ${pr.staff.lastName}`,
    staffRole: "Faculty Member",
    department: pr.staff.department?.name || "Academic Department",
    amount: pr.amount,
    status: pr.status,
    payDate: pr.payDate.toISOString().split("T")[0],
    receiptCode: pr.receiptCode,
  }));

  // Format Proofs (combining PaymentProof and PaymentReceipt so Application Fee Receipts reflect in Bursar Portal)
  const pendingProofs: PaymentProofAuditItem[] = [
    ...paymentProofs.map((pf) => ({
      id: pf.id,
      studentName: pf.studentName,
      admissionNumber: pf.admissionNumber,
      amount: pf.amount,
      paidAt: pf.paidAt.toISOString().split("T")[0],
      payerBankName: pf.payerBankName,
      payerAccountName: pf.payerAccountName,
      sessionId: pf.sessionId,
      proofImageUrl: pf.proofImageUrl,
      status: pf.status,
    })),
    ...pendingReceipts.map((rc) => ({
      id: rc.id,
      studentName: rc.payerName,
      admissionNumber: rc.referenceNo,
      amount: rc.amount,
      paidAt: (rc.paymentDate || rc.createdAt).toISOString().split("T")[0],
      payerBankName: rc.bankName || (rc.moduleType === "ADMISSION_FORM_FEE" ? "Application Fee" : rc.moduleType),
      payerAccountName: rc.depositorName || rc.payerName,
      sessionId: rc.transferReference || rc.txnRef || rc.referenceNo,
      proofImageUrl: rc.fileUrl || rc.proofOfPaymentUrl || "",
      status: rc.status,
    })),
  ];

  return {
    school,
    bursar: bursarProfile,
    metrics: {
      totalFeesCollected,
      totalOutstandingBalances,
      totalExpensesLogged,
      pendingInvoiceApprovals,
    },
    recentPayments,
    invoices,
    expenses,
    ledger,
    arrears,
    payroll,
    pendingProofs,
  };
}

export async function verifyPaymentProofAction(
  schoolId: string,
  proofId: string,
  newStatus: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  try {
    const proof = await basePrisma.paymentProof.findUnique({
      where: { id: proofId },
    });

    if (!proof) {
      // Check if it is a Universal PaymentReceipt (e.g. ADMISSION_FORM_FEE Application Fee Receipt)
      const receipt = await basePrisma.paymentReceipt.findUnique({
        where: { id: proofId },
      });
      if (receipt) {
        const { verifyPaymentReceipt } = await import("@/lib/payment-receipt-service");
        const updatedReceipt = await verifyPaymentReceipt({
          receiptId: receipt.id,
          action: newStatus === "APPROVED" ? "VERIFY" : "REJECT",
          verifiedBy: "Bursar Office",
          verifiedByUserId: "BURSAR_PORTAL",
          rejectionReason:
            newStatus === "REJECTED" ? rejectionReason || "Rejected by Bursar" : undefined,
        });
        safeRevalidate(`/${schoolId}/portal/bursar`);
        return { success: true, updated: updatedReceipt };
      }
      throw new Error("Payment proof record not found or tenant mismatch.");
    }

    if (proof.schoolId !== schoolId) {
      throw new Error("Payment proof record not found or tenant mismatch.");
    }

    const updated = await basePrisma.paymentProof.update({
      where: { id: proofId },
      data: {
        status: newStatus,
        verifiedAt: new Date(),
        rejectionReason: newStatus === "REJECTED" ? rejectionReason || "Rejected by Bursar" : null,
      },
    });

    // If approved and invoiceId is attached, credit the invoice
    if (newStatus === "APPROVED" && proof.invoiceId) {
      const invoice = await basePrisma.invoice.findUnique({
        where: { id: proof.invoiceId },
      });

      if (invoice) {
        const newPaid = invoice.amountPaid + proof.amount;
        const invoiceStatus = newPaid >= invoice.amountDue ? "PAID" : "PARTIAL";

        await basePrisma.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newPaid,
            status: invoiceStatus,
            paidAt: invoiceStatus === "PAID" ? new Date() : undefined,
          },
        });

        await basePrisma.payment.create({
          data: {
            schoolId,
            studentId: proof.studentId,
            invoiceId: invoice.id,
            amountPaid: proof.amount,
            method: "TRANSFER",
          },
        });
      }
    }

    safeRevalidate(`/${schoolId}/portal/bursar`);
    return { success: true, updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to verify payment proof" };
  }
}

export async function disbursePayrollRecordAction(schoolId: string, recordId: string) {
  try {
    const updated = await basePrisma.payrollRecord.updateMany({
      where: {
        id: recordId,
        schoolId,
      },
      data: {
        status: "PAID",
        receiptCode: `DISB-${Date.now().toString().slice(-6)}`,
      },
    });

    safeRevalidate(`/${schoolId}/portal/bursar`);
    return { success: true, count: updated.count };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to disburse payroll" };
  }
}
