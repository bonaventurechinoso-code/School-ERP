"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

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

    revalidatePath(`/[schoolDomain]/finance`, "page");
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
    const invoice = await tenantDb.invoice.findUnique({ where: { id: data.invoiceId } });
    if (!invoice) throw new Error("Invoice not found");

    // Create payment
    await tenantDb.payment.create({
      data: {
        schoolId,
        studentId: data.studentId,
        invoiceId: data.invoiceId,
        amountPaid: data.amountPaid,
        method: data.method,
      }
    });

    // Check if fully paid
    const payments = await tenantDb.payment.findMany({ where: { invoiceId: data.invoiceId } });
    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);

    const newStatus = totalPaid >= invoice.amountDue ? "PAID" : "PARTIAL";

    await tenantDb.invoice.update({
      where: { id: data.invoiceId },
      data: { status: newStatus }
    });

    revalidatePath(`/[schoolDomain]/finance`, "page");
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
    revalidatePath(`/[schoolDomain]/finance`, "page");
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
    revalidatePath(`/[schoolDomain]/finance`, "page");
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

    revalidatePath(`/[schoolDomain]/finance`, "page");
    return { success: true, count: invoicesData.length };
  } catch (error: any) {
    console.error("[Server Action] Failed to bulk create invoices:", error);
    return { success: false, error: error.message || "Failed to bulk create invoices." };
  }
}
