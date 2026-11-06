"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { cache } from "react";

export interface BursarContext {
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  schoolId: string;
  schoolName: string;
  schoolSubdomain: string;
  settlementBankName?: string | null;
  settlementAccountNumber?: string | null;
  settlementAccountName?: string | null;
  activeTiers: string[];
}

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}

/**
 * 1. Resolves authenticated Bursar context scoped securely via PostgreSQL Staff & School.
 */
export const getBursarContext = cache(async (): Promise<BursarContext | null> => {
  try {
    const session = await getSession();

    let school: any = null;
    if (session?.schoolDomain) {
      school = await basePrisma.school.findUnique({
        where: { subdomain: session.schoolDomain },
        include: {
          academicTiers: { orderBy: { level: "asc" } },
        },
      });
    }

    if (!school) {
      school = await basePrisma.school.findFirst({
        where: { isActive: true },
        include: {
          academicTiers: { orderBy: { level: "asc" } },
        },
      });
    }

    if (!school) return null;

    let staffRecord: any = null;
    if (session?.email) {
      staffRecord = await basePrisma.staff.findFirst({
        where: {
          schoolId: school.id,
          email: session.email.trim().toLowerCase(),
        },
        include: { user: true },
      });
    }

    // Default fallback profile for Bursar desk if staff record is not yet in DB
    const staffName = staffRecord
      ? `${staffRecord.firstName} ${staffRecord.lastName}`
      : session?.email
      ? session.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Mrs. Ngozi Adeleke";

    const staffRole = staffRecord?.user?.role || session?.staffRole || session?.role || "BURSAR";

    return {
      staffId: staffRecord?.id || "bursar-staff-id",
      staffName,
      staffEmail: staffRecord?.email || session?.email || "bursar@greenwood.edu.ng",
      staffRole,
      schoolId: school.id,
      schoolName: school.name,
      schoolSubdomain: school.subdomain,
      settlementBankName: school.settlementBankName || "Access Bank Plc",
      settlementAccountNumber: school.settlementAccountNumber || "0123456789",
      settlementAccountName: school.settlementAccountName || `${school.name} - Tuition Collection`,
      activeTiers: school.academicTiers.map((t: any) => t.name),
    };
  } catch (err) {
    console.error("[GET_BURSAR_CONTEXT_ERROR]:", err);
    return null;
  }
});

/**
 * 2. Fetches high-level financial metrics, pending verifications, and recent payments.
 */
export async function getBursarDashboardStats(schoolId: string) {
  try {
    const { reconcileAdmissionFeeReceipts } = await import("@/lib/payment-receipt-service");
    await reconcileAdmissionFeeReceipts(schoolId).catch(() => null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      invoicedAgg,
      paidAgg,
      pendingProofCount,
      pendingReceiptCount,
      todayPaymentsAgg,
      totalStudentsCount,
      recentPayments,
      pendingProofsRaw,
      pendingReceiptsRaw,
    ] = await Promise.all([
      basePrisma.invoice.aggregate({
        where: { schoolId },
        _sum: { amountDue: true, amountPaid: true },
        _count: { id: true },
      }),
      basePrisma.payment.aggregate({
        where: { schoolId },
        _sum: { amountPaid: true },
        _count: { id: true },
      }),
      basePrisma.paymentProof.count({
        where: { schoolId, status: "PENDING" },
      }),
      basePrisma.paymentReceipt
        .count({
          where: {
            OR: [{ tenantId: schoolId }, { schoolId }],
            status: "PENDING",
          },
        })
        .catch(() => 0),
      basePrisma.payment.aggregate({
        where: { schoolId, paymentDate: { gte: today } },
        _sum: { amountPaid: true },
        _count: { id: true },
      }),
      basePrisma.student.count({
        where: { schoolId, status: { in: ["ENROLLED", "PROSPECT", "APPLICANT"] } },
      }),
      basePrisma.payment.findMany({
        where: { schoolId },
        orderBy: { paymentDate: "desc" },
        take: 8,
        include: {
          student: {
            select: { firstName: true, lastName: true, admissionNumber: true, currentClass: true },
          },
          invoice: {
            select: { description: true, amountDue: true },
          },
        },
      }),
      basePrisma.paymentProof.findMany({
        where: { schoolId, status: "PENDING" },
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: {
          id: true,
          studentName: true,
          admissionNumber: true,
          amount: true,
          paidAt: true,
          payerBankName: true,
          sessionId: true,
          proofImageUrl: true,
        },
      }),
      basePrisma.paymentReceipt
        .findMany({
          where: {
            OR: [{ tenantId: schoolId }, { schoolId }],
            status: "PENDING",
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
        .catch(() => []),
    ]);

    const pendingVerificationsCount = pendingProofCount + pendingReceiptCount;
    const pendingProofsList = [
      ...pendingProofsRaw,
      ...pendingReceiptsRaw.map((rc) => ({
        id: rc.id,
        studentName: rc.payerName,
        admissionNumber: rc.referenceNo,
        amount: rc.amount,
        paidAt: rc.paymentDate || rc.createdAt,
        payerBankName:
          rc.bankName ||
          (rc.moduleType === "ADMISSION_FORM_FEE" ? "Application Fee" : rc.moduleType),
        sessionId: rc.transferReference || rc.txnRef || rc.referenceNo,
        proofImageUrl: rc.fileUrl || rc.proofOfPaymentUrl || "",
      })),
    ].slice(0, 5);

    const totalInvoiced = invoicedAgg._sum.amountDue || 0;
    const totalCollected = paidAgg._sum.amountPaid || 0;
    const outstandingBalance = Math.max(0, totalInvoiced - totalCollected);
    const todayCollected = todayPaymentsAgg._sum.amountPaid || 0;
    const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

    return {
      success: true,
      totalInvoiced,
      totalCollected,
      outstandingBalance,
      todayCollected,
      collectionRate,
      totalInvoicesCount: invoicedAgg._count.id,
      totalStudentsCount,
      pendingVerificationsCount,
      recentPayments,
      pendingProofsList,
    };
  } catch (err: any) {
    console.error("[GET_BURSAR_STATS_ERROR]:", err);
    return {
      success: false,
      error: err.message,
      totalInvoiced: 0,
      totalCollected: 0,
      outstandingBalance: 0,
      todayCollected: 0,
      collectionRate: 0,
      totalInvoicesCount: 0,
      totalStudentsCount: 0,
      pendingVerificationsCount: 0,
      recentPayments: [],
      pendingProofsList: [],
    };
  }
}

/**
 * 3. Rapid Cashier Counter: Record counter payment with immediate official receipt issuance.
 */
export async function recordCounterPayment(params: {
  schoolId: string;
  studentId: string;
  invoiceId?: string;
  amount: number;
  method: "CASH" | "POS" | "TRANSFER" | "CHEQUE";
  reference?: string;
  notes?: string;
}) {
  const { schoolId, studentId, amount, method, reference, notes } = params;

  if (!schoolId || !studentId || !amount || amount <= 0) {
    return { success: false, error: "Invalid payment parameters. Amount must be greater than zero." };
  }

  try {
    const student = await basePrisma.student.findUnique({
      where: { id: studentId },
      include: {
        invoices: {
          where: { status: { in: ["PENDING", "PARTIAL"] } },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!student) {
      return { success: false, error: "Student not found." };
    }

    let targetInvoiceId = params.invoiceId;

    // If no specific invoice specified, match against oldest pending invoice or create one
    if (!targetInvoiceId) {
      if (student.invoices.length > 0) {
        targetInvoiceId = student.invoices[0].id;
      } else {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30);
        const newInvoice = await basePrisma.invoice.create({
          data: {
            schoolId,
            studentId,
            amountDue: amount,
            amountPaid: 0,
            dueDate: defaultDueDate,
            status: "PENDING",
            description: notes || "Tuition & Sundry Levies",
          },
        });
        targetInvoiceId = newInvoice.id;
      }
    }

    // Atomic transaction: Create payment, credit invoice, update student feeStatus, record transaction
    const result = await basePrisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          schoolId,
          studentId,
          invoiceId: targetInvoiceId!,
          amountPaid: amount,
          method: method || "CASH",
          paymentDate: new Date(),
        },
      });

      const invoice = await tx.invoice.findUnique({
        where: { id: targetInvoiceId! },
      });

      if (invoice) {
        const updatedPaid = invoice.amountPaid + amount;
        const newStatus = updatedPaid >= invoice.amountDue ? "PAID" : "PARTIAL";
        await tx.invoice.update({
          where: { id: targetInvoiceId! },
          data: {
            amountPaid: updatedPaid,
            status: newStatus,
            paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
          },
        });
      }

      // Check all invoices for student to update student.feeStatus
      const allStudentInvoices = await tx.invoice.findMany({
        where: { studentId },
      });
      const hasUnpaid = allStudentInvoices.some((inv) => inv.status === "PENDING" || inv.status === "PARTIAL");
      await tx.student.update({
        where: { id: studentId },
        data: {
          feeStatus: hasUnpaid ? "PARTIAL" : "PAID",
        },
      });

      // Record General Ledger Income Transaction
      const refCode = reference || `BURSAR-${Date.now().toString(36).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          schoolId,
          type: "INCOME",
          category: "TUITION",
          amount,
          description: `Counter Collection [${method}]: ${student.firstName} ${student.lastName} (${student.admissionNumber}) - ${notes || "Tuition Payment"}`,
          referenceId: refCode,
        },
      });

      return {
        paymentId: payment.id,
        receiptNumber: `REC-${new Date().getFullYear()}-${payment.id.slice(0, 8).toUpperCase()}`,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        currentClass: student.currentClass || "Unassigned",
        amount,
        method,
        reference: refCode,
        paidAt: payment.paymentDate,
      };
    });

    safeRevalidatePath("/bursar");
    safeRevalidatePath("/bursar/receipts");
    safeRevalidatePath("/bursar/invoices");

    return { success: true, ...result };
  } catch (err: any) {
    console.error("[RECORD_COUNTER_PAYMENT_ERROR]:", err);
    return { success: false, error: err.message || "Failed to record payment." };
  }
}

/**
 * 4. Search and filter students with their financial ledger.
 */
export async function searchStudentsWithLedger(schoolId: string, query: string) {
  try {
    const q = (query || "").trim();
    const students = await basePrisma.student.findMany({
      where: {
        schoolId,
        status: { in: ["ENROLLED", "PROSPECT", "APPLICANT"] },
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { admissionNumber: { contains: q, mode: "insensitive" } },
                { currentClass: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      take: 30,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        currentClass: true,
        feeStatus: true,
        invoices: {
          select: {
            id: true,
            description: true,
            amountDue: true,
            amountPaid: true,
            status: true,
            dueDate: true,
          },
          orderBy: { dueDate: "desc" },
        },
      },
    });

    return { success: true, students };
  } catch (err: any) {
    console.error("[SEARCH_STUDENTS_LEDGER_ERROR]:", err);
    return { success: false, students: [] };
  }
}

/**
 * 5. Fetch Invoices with filtering by status and class.
 */
export async function getBursarInvoices(
  schoolId: string,
  options?: {
    status?: string;
    classroom?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  try {
    const { status, classroom, search, limit = 50, offset = 0 } = options || {};

    const whereClause: any = { schoolId };

    if (status && status !== "ALL") {
      whereClause.status = status.toUpperCase();
    }

    if (classroom && classroom !== "ALL") {
      whereClause.student = { ...whereClause.student, currentClass: classroom };
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { student: { firstName: { contains: q, mode: "insensitive" } } },
        { student: { lastName: { contains: q, mode: "insensitive" } } },
        { student: { admissionNumber: { contains: q, mode: "insensitive" } } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const [invoices, totalCount] = await Promise.all([
      basePrisma.invoice.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: true },
          },
          payments: {
            orderBy: { paymentDate: "desc" },
            take: 3,
          },
        },
      }),
      basePrisma.invoice.count({ where: whereClause }),
    ]);

    return { success: true, invoices, totalCount };
  } catch (err: any) {
    console.error("[GET_BURSAR_INVOICES_ERROR]:", err);
    return { success: false, invoices: [], totalCount: 0 };
  }
}

/**
 * 6. Create single or bulk invoices for a class or student.
 */
export async function createBursarInvoice(params: {
  schoolId: string;
  studentId?: string;
  classroomId?: string;
  templateId?: string;
  description: string;
  amount: number;
  dueDate: string;
}) {
  const { schoolId, studentId, classroomId, templateId, description, amount, dueDate } = params;

  if (!schoolId || !description || !amount || amount <= 0) {
    return { success: false, error: "Please provide valid invoice details and amount." };
  }

  const parsedDueDate = new Date(dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000);

  try {
    // Single Student Billing
    if (studentId) {
      const invoice = await basePrisma.invoice.create({
        data: {
          schoolId,
          studentId,
          feeTemplateId: templateId || null,
          amountDue: amount,
          amountPaid: 0,
          status: "PENDING",
          dueDate: parsedDueDate,
          description,
        },
      });

      safeRevalidatePath("/bursar/invoices");
      safeRevalidatePath("/bursar");
      return { success: true, createdCount: 1, invoiceId: invoice.id };
    }

    // Bulk Billing for entire class
    if (classroomId) {
      const students = await basePrisma.student.findMany({
        where: {
          schoolId,
          currentClass: classroomId,
          status: { in: ["ENROLLED", "PROSPECT"] },
        },
        select: { id: true },
      });

      if (students.length === 0) {
        return { success: false, error: "No active students found in the selected class." };
      }

      await basePrisma.invoice.createMany({
        data: students.map((s) => ({
          schoolId,
          studentId: s.id,
          feeTemplateId: templateId || null,
          amountDue: amount,
          amountPaid: 0,
          status: "PENDING",
          dueDate: parsedDueDate,
          description,
        })),
      });

      safeRevalidatePath("/bursar/invoices");
      safeRevalidatePath("/bursar");
      return { success: true, createdCount: students.length };
    }

    return { success: false, error: "Please specify either a student or a class." };
  } catch (err: any) {
    console.error("[CREATE_BURSAR_INVOICE_ERROR]:", err);
    return { success: false, error: err.message || "Failed to create invoice." };
  }
}

/**
 * 7. Fetch official receipts list for inspection and printing.
 */
export async function getBursarReceipts(
  schoolId: string,
  options?: { search?: string; limit?: number; offset?: number }
) {
  try {
    const { search, limit = 50, offset = 0 } = options || {};

    const whereClause: any = { schoolId };

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { student: { firstName: { contains: q, mode: "insensitive" } } },
        { student: { lastName: { contains: q, mode: "insensitive" } } },
        { student: { admissionNumber: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [payments, paymentsCount, rawPaymentReceipts, receiptsCount] = await Promise.all([
      basePrisma.payment.findMany({
        where: whereClause,
        orderBy: { paymentDate: "desc" },
        skip: offset,
        take: limit,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: true },
          },
          invoice: {
            select: { id: true, description: true, amountDue: true, amountPaid: true },
          },
        },
      }),
      basePrisma.payment.count({ where: whereClause }),
      basePrisma.paymentReceipt
        .findMany({
          where: {
            OR: [{ schoolId }, { tenantId: schoolId }],
            status: { in: ["VERIFIED", "APPROVED"] },
            ...(search && search.trim()
              ? {
                  OR: [
                    { payerName: { contains: search.trim(), mode: "insensitive" as const } },
                    { referenceNo: { contains: search.trim(), mode: "insensitive" as const } },
                    { txnRef: { contains: search.trim(), mode: "insensitive" as const } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
        .catch(() => []),
      basePrisma.paymentReceipt
        .count({
          where: {
            OR: [{ schoolId }, { tenantId: schoolId }],
            status: { in: ["VERIFIED", "APPROVED"] },
          },
        })
        .catch(() => 0),
    ]);

    const formattedPayments = payments.map((p) => ({
      id: p.id,
      receiptNumber: `REC-${p.paymentDate.getFullYear()}-${p.id.slice(0, 8).toUpperCase()}`,
      studentId: p.studentId,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
      admissionNumber: p.student.admissionNumber,
      currentClass: p.student.currentClass || "General",
      amountPaid: p.amountPaid,
      method: p.method,
      paymentDate: p.paymentDate,
      invoiceDescription: p.invoice?.description || "Tuition & School Levies",
      totalInvoiceDue: p.invoice?.amountDue || p.amountPaid,
      totalInvoicePaid: p.invoice?.amountPaid || p.amountPaid,
    }));

    const formattedAdmissionReceipts = rawPaymentReceipts.map((rc) => ({
      id: rc.id,
      receiptNumber: `REC-${new Date(rc.paymentDate || rc.createdAt).getFullYear()}-${rc.id.slice(0, 8).toUpperCase()}`,
      studentId: rc.payerId || rc.referenceNo,
      studentName: rc.payerName || "Applicant",
      admissionNumber: rc.referenceNo || "N/A",
      currentClass: (rc as any).academicTier || rc.term || "Admissions",
      amountPaid: Number(rc.amount) || 5000,
      method: rc.paymentMethod || "BANK_TRANSFER",
      paymentDate: rc.paymentDate || rc.createdAt,
      invoiceDescription: rc.moduleType === "ADMISSION_FORM_FEE" ? "Admissions Application Fee" : (rc.moduleType || "Fee Receipt").replace(/_/g, " "),
      totalInvoiceDue: Number(rc.amount) || 5000,
      totalInvoicePaid: Number(rc.amount) || 5000,
    }));

    const combinedReceipts = [...formattedPayments, ...formattedAdmissionReceipts].sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );

    return {
      success: true,
      receipts: combinedReceipts.slice(0, limit),
      totalCount: paymentsCount + receiptsCount,
    };
  } catch (err: any) {
    console.error("[GET_BURSAR_RECEIPTS_ERROR]:", err);
    return { success: false, receipts: [], totalCount: 0 };
  }
}

/**
 * 8. Defaulters Report & Outstanding Balances by Class.
 */
export async function getBursarDefaultersReport(
  schoolId: string,
  options?: { classroom?: string; minDebt?: number }
) {
  try {
    const { classroom, minDebt = 0 } = options || {};

    const whereClause: any = {
      schoolId,
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      ...(classroom && classroom !== "ALL"
        ? { student: { currentClass: classroom } }
        : {}),
    };

    const overdueInvoices = await basePrisma.invoice.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            currentClass: true,
            parentPhone: true,
            parentEmail: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Aggregate by student
    const studentDebtMap = new Map<string, {
      studentId: string;
      studentName: string;
      admissionNumber: string;
      currentClass: string;
      parentPhone: string | null;
      parentEmail: string | null;
      totalDue: number;
      totalPaid: number;
      balance: number;
      oldestDueDate: Date;
      unpaidInvoicesCount: number;
    }>();

    for (const inv of overdueInvoices) {
      const balance = Math.max(0, inv.amountDue - inv.amountPaid);
      if (balance <= 0) continue;

      const existing = studentDebtMap.get(inv.studentId);
      if (existing) {
        existing.totalDue += inv.amountDue;
        existing.totalPaid += inv.amountPaid;
        existing.balance += balance;
        existing.unpaidInvoicesCount += 1;
        if (inv.dueDate < existing.oldestDueDate) {
          existing.oldestDueDate = inv.dueDate;
        }
      } else {
        studentDebtMap.set(inv.studentId, {
          studentId: inv.studentId,
          studentName: `${inv.student.firstName} ${inv.student.lastName}`,
          admissionNumber: inv.student.admissionNumber || "N/A",
          currentClass: inv.student.currentClass || "Unassigned",
          parentPhone: inv.student.parentPhone,
          parentEmail: inv.student.parentEmail,
          totalDue: inv.amountDue,
          totalPaid: inv.amountPaid,
          balance,
          oldestDueDate: inv.dueDate,
          unpaidInvoicesCount: 1,
        });
      }
    }

    const defaulters = Array.from(studentDebtMap.values())
      .filter((d) => d.balance >= minDebt)
      .sort((a, b) => b.balance - a.balance);

    const totalOutstanding = defaulters.reduce((acc, curr) => acc + curr.balance, 0);

    return {
      success: true,
      defaulters,
      totalOutstanding,
      count: defaulters.length,
    };
  } catch (err: any) {
    console.error("[GET_BURSAR_DEFAULTERS_ERROR]:", err);
    return { success: false, defaulters: [], totalOutstanding: 0, count: 0 };
  }
}

/**
 * 9. Fee Structures / Templates.
 */
export async function getBursarFeeTemplates(schoolId: string) {
  try {
    const templates = await basePrisma.feeTemplate.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { invoices: true } },
      },
    });
    return { success: true, templates };
  } catch (err: any) {
    console.error("[GET_BURSAR_FEE_TEMPLATES_ERROR]:", err);
    return { success: false, templates: [] };
  }
}

export async function createBursarFeeTemplate(
  schoolId: string,
  name: string,
  billingType: string,
  defaultAmount: number
) {
  if (!schoolId || !name || defaultAmount <= 0) {
    return { success: false, error: "Please specify template name and valid amount." };
  }

  try {
    const template = await basePrisma.feeTemplate.create({
      data: {
        schoolId,
        name: name.trim(),
        billingType: billingType || "FLAT",
        defaultAmount,
      },
    });

    safeRevalidatePath("/bursar/fees");
    return { success: true, template };
  } catch (err: any) {
    console.error("[CREATE_BURSAR_FEE_TEMPLATE_ERROR]:", err);
    return { success: false, error: err.message || "Failed to create fee template." };
  }
}

/**
 * 10. Direct Collection Bank Account Setup.
 */
export async function updateSchoolSettlementBank(
  schoolId: string,
  bankName: string,
  bankCode: string,
  accountNumber: string,
  accountName: string
) {
  if (!schoolId || !accountNumber || accountNumber.length !== 10) {
    return { success: false, error: "Valid 10-digit NUBAN account number required." };
  }

  try {
    const updated = await basePrisma.school.update({
      where: { id: schoolId },
      data: {
        settlementBankName: bankName.trim(),
        settlementBankCode: bankCode.trim(),
        settlementAccountNumber: accountNumber.trim(),
        settlementAccountName: accountName.trim(),
      },
    });

    safeRevalidatePath("/bursar/banking");
    safeRevalidatePath("/bursar");
    return { success: true, school: updated };
  } catch (err: any) {
    console.error("[UPDATE_SETTLEMENT_BANK_ERROR]:", err);
    return { success: false, error: err.message || "Failed to update settlement account." };
  }
}
