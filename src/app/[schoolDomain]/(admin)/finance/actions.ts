"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}
import { cacheAside, buildCacheKey } from "@/lib/cache";
import { executeCursorPagination, CursorPaginationResult } from "@/lib/pagination";
import { invalidateFinanceNamespace } from "@/lib/cache-invalidation";

/**
 * High-performance cursor-based fetching for Financial Invoices wrapped in Smart Cache-Aside.
 * Flat lookup times across millions of invoice rows.
 */
export async function fetchInvoicesPaginated(
  schoolId: string,
  options?: {
    status?: string;
    studentId?: string;
    cursor?: string | null;
    limit?: number;
  }
): Promise<CursorPaginationResult<any>> {
  const status = options?.status;
  const studentId = options?.studentId;
  const cursor = options?.cursor;
  const limit = options?.limit || 25;

  const cacheKey = buildCacheKey({
    tenantId: schoolId,
    table: "invoices",
    action: "paginated",
    cursor,
    limit,
    filters: { status, studentId },
  });

  return cacheAside<CursorPaginationResult<any>>({
    key: cacheKey,
    ttlSeconds: 1800, // 30 minutes safe sliding TTL
    fetchFn: async () => {
      const tenantDb = getTenantClient(schoolId);
      const whereClause: any = {
        schoolId,
        ...(status && status !== "ALL" ? { status } : {}),
        ...(studentId ? { studentId } : {}),
      };

      return executeCursorPagination(async (args) => {
        return tenantDb.invoice.findMany({
          ...args,
          where: whereClause,
          include: {
            student: true,
            payments: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }, { cursor, limit });
    },
  });
}

/**
 * High-performance cursor-based fetching for Financial Transactions / General Ledger.
 */
export async function fetchTransactionsPaginated(
  schoolId: string,
  options?: {
    type?: string;
    category?: string;
    cursor?: string | null;
    limit?: number;
  }
): Promise<CursorPaginationResult<any>> {
  const type = options?.type;
  const category = options?.category;
  const cursor = options?.cursor;
  const limit = options?.limit || 25;

  const cacheKey = buildCacheKey({
    tenantId: schoolId,
    table: "transactions",
    action: "paginated",
    cursor,
    limit,
    filters: { type, category },
  });

  return cacheAside<CursorPaginationResult<any>>({
    key: cacheKey,
    ttlSeconds: 1800,
    fetchFn: async () => {
      const tenantDb = getTenantClient(schoolId);
      const whereClause: any = {
        schoolId,
        ...(type && type !== "ALL" ? { type } : {}),
        ...(category && category !== "ALL" ? { category } : {}),
      };

      return executeCursorPagination(async (args) => {
        return tenantDb.transaction.findMany({
          ...args,
          where: whereClause,
          orderBy: { createdAt: "desc" },
        });
      }, { cursor, limit });
    },
  });
}

export async function createInvoice(
  schoolId: string,
  data: { studentId: string; amountDue: number; dueDate: string; description: string; feeTemplateId?: string }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.invoice.create({
      data: {
        schoolId, 
        studentId: data.studentId,
        amountDue: data.amountDue,
        dueDate: new Date(data.dueDate),
        description: data.description,
        status: "PENDING",
        feeTemplateId: data.feeTemplateId,
      }
    });

    // Write-Through Cache Invalidation
    await invalidateFinanceNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create invoice:", error);
    return { success: false, error: error.message || "Failed to create invoice." };
  }
}

export async function recordPayment(
  schoolId: string,
  data: { studentId: string; invoiceId: string; amountPaid: number; method: string }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    const invoice = await tenantDb.invoice.findUnique({ 
      where: { id: data.invoiceId },
      include: { student: true }
    });
    if (!invoice) throw new Error("Invoice not found");

    // 1. Create payment entry
    await tenantDb.payment.create({
      data: {
        schoolId,
        studentId: data.studentId,
        invoiceId: data.invoiceId,
        amountPaid: data.amountPaid,
        method: data.method,
      }
    });

    // 2. Check if fully paid
    const payments = await tenantDb.payment.findMany({ where: { invoiceId: data.invoiceId } });
    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);

    const newStatus = totalPaid >= invoice.amountDue ? "PAID" : "PARTIAL";

    await tenantDb.invoice.update({
      where: { id: data.invoiceId },
      data: { status: newStatus }
    });

    // 3. Automatically record INCOME in the General Ledger
    const studentName = invoice.student ? `${invoice.student.firstName} ${invoice.student.lastName}` : "Student";
    await tenantDb.transaction.create({
      data: {
        schoolId,
        type: "INCOME",
        category: "TUITION",
        amount: data.amountPaid,
        description: `Tuition payment received from ${studentName} for Inv #${data.invoiceId.slice(0, 8).toUpperCase()} via ${data.method}`,
        referenceId: data.invoiceId,
      }
    });

    // Write-Through Cache Invalidation
    await invalidateFinanceNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to record payment:", error);
    return { success: false, error: error.message || "Failed to record payment." };
  }
}

export async function createFeeTemplate(
  schoolId: string,
  data: { name: string; defaultAmount: number; billingType?: string }
) {
  const tenantDb = getTenantClient(schoolId);
  try {
    await tenantDb.feeTemplate.create({
      data: {
        schoolId,
        name: data.name,
        defaultAmount: data.defaultAmount,
        billingType: data.billingType || "FLAT",
      }
    });

    // Write-Through Cache Invalidation
    await invalidateFinanceNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create fee template:", error);
    return { success: false, error: error.message || "Failed to create fee template." };
  }
}

export async function deleteFeeTemplate(schoolId: string, id: string) {
  const tenantDb = getTenantClient(schoolId);
  try {
    await tenantDb.feeTemplate.delete({
      where: { id }
    });

    // Write-Through Cache Invalidation
    await invalidateFinanceNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete fee template:", error);
    return { success: false, error: error.message || "Failed to delete fee template." };
  }
}

export async function bulkCreateInvoices(
  schoolId: string,
  data: { templateId: string; studentIds: string[]; dueDate: string }
) {
  const tenantDb = getTenantClient(schoolId);
  try {
    const template = await tenantDb.feeTemplate.findUnique({
      where: { id: data.templateId }
    });
    
    if (!template) throw new Error("Fee template not found");

    const invoicesData = data.studentIds.map(studentId => ({
      schoolId,
      studentId,
      amountDue: template.defaultAmount,
      dueDate: new Date(data.dueDate),
      description: template.name,
      status: "PENDING",
      feeTemplateId: template.id,
    }));

    await tenantDb.invoice.createMany({
      data: invoicesData
    });

    // Write-Through Cache Invalidation
    await invalidateFinanceNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true, count: invoicesData.length };
  } catch (error: any) {
    console.error("[Server Action] Failed to bulk create invoices:", error);
    return { success: false, error: error.message || "Failed to bulk create invoices." };
  }
}

export async function createTransaction(
  schoolId: string,
  data: {
    type: "INCOME" | "EXPENSE";
    category: string;
    amount: number;
    description: string;
    referenceId?: string;
  }
) {
  const tenantDb = getTenantClient(schoolId);
  try {
    if (!data.amount || data.amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }
    if (!data.description || data.description.trim() === "") {
      throw new Error("Description is required.");
    }

    const txn = await tenantDb.transaction.create({
      data: {
        schoolId,
        type: data.type,
        category: data.category.toUpperCase(),
        amount: Math.round(data.amount * 100) / 100,
        description: data.description.trim(),
        referenceId: data.referenceId || null,
      },
    });

    // Write-Through Cache Invalidation
    await invalidateFinanceNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true, transaction: txn };
  } catch (error: any) {
    console.error("[Server Action] Failed to create transaction:", error);
    return { success: false, error: error.message || "Failed to record transaction." };
  }
}

export async function deleteInvoice(schoolId: string, invoiceId: string) {
  const tenantDb = getTenantClient(schoolId);
  try {
    const invoice = await tenantDb.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) throw new Error("Invoice not found.");

    if (invoice.payments.length > 0) {
      throw new Error("Cannot delete an invoice that already has recorded payments. Reconcile or void payments first.");
    }

    await tenantDb.invoice.delete({
      where: { id: invoiceId },
    });

    // Write-Through Cache Invalidation
    await invalidateFinanceNamespace(schoolId);

    safeRevalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete invoice:", error);
    return { success: false, error: error.message || "Failed to delete invoice." };
  }
}

