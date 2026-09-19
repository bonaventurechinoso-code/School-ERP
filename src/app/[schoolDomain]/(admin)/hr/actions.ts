"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}

export async function createDepartment(schoolDomain: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { success: false, error: "Department name is required." };
  }

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain }
  });

  if (!school) {
    return { success: false, error: "School not found." };
  }

  try {
    await basePrisma.department.create({
      data: {
        name,
        schoolId: school.id
      }
    });
    safeRevalidatePath(`/${schoolDomain}/hr`);
    return { success: true };
  } catch (error: any) {
    console.error("[HR Server Action] Failed to create department:", error);
    return { success: false, error: error.message || "Failed to create department." };
  }
}

export async function deleteDepartment(schoolDomain: string, departmentId: string) {
  try {
    const staffCount = await basePrisma.staff.count({
      where: { departmentId }
    });

    if (staffCount > 0) {
      return { 
        success: false, 
        error: `Cannot delete department: ${staffCount} staff member(s) are currently assigned to it. Please reassign them first.` 
      };
    }

    await basePrisma.department.delete({
      where: { id: departmentId }
    });

    safeRevalidatePath(`/${schoolDomain}/hr`);
    return { success: true };
  } catch (error: any) {
    console.error("[HR Server Action] Failed to delete department:", error);
    return { success: false, error: error.message || "Failed to delete department." };
  }
}

export async function generatePayroll(schoolDomain: string, formData: FormData) {
  const staffId = formData.get("staffId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const payDateStr = formData.get("payDate") as string;
  const payDate = payDateStr ? new Date(payDateStr) : null;

  if (!staffId || isNaN(amount) || amount <= 0 || !payDate) {
    return { success: false, error: "Invalid payroll parameters. Please provide staff, positive amount, and pay date." };
  }

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain }
  });

  if (!school) {
    return { success: false, error: "School not found." };
  }

  try {
    await basePrisma.payrollRecord.create({
      data: {
        staffId,
        amount,
        payDate,
        schoolId: school.id,
        status: "PENDING"
      }
    });
    safeRevalidatePath(`/${schoolDomain}/hr`);
    return { success: true };
  } catch (error: any) {
    console.error("[HR Server Action] Failed to generate payroll:", error);
    return { success: false, error: error.message || "Failed to generate payroll." };
  }
}

export async function voidPayroll(schoolDomain: string, payrollId: string) {
  try {
    await basePrisma.payrollRecord.delete({
      where: { id: payrollId }
    });
    safeRevalidatePath(`/${schoolDomain}/hr`);
    return { success: true };
  } catch (error: any) {
    console.error("[HR Server Action] Failed to void payroll:", error);
    return { success: false, error: error.message || "Failed to void payroll." };
  }
}

export async function disbursePayroll(schoolDomain: string, payrollId: string) {
  try {
    // 1. Fetch school and payroll record
    const school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain }
    });
    const payroll = await basePrisma.payrollRecord.findUnique({
      where: { id: payrollId },
      include: { staff: true }
    });

    if (!school || !payroll) {
      return { success: false, error: "School or Payroll record not found." };
    }

    if (payroll.status.includes("DISBURSED")) {
      return { success: false, error: "This payroll record has already been disbursed." };
    }

    // 2. CBN Model A Compliance: No platform wallet check or mutation.
    // Payroll is disbursed via external banking / direct settlement and logged for analytical accounting.
    // Generate receipt reference
    const receiptCode = `TXN_PAY_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 3. Mark disbursed and record analytical expense
    await basePrisma.$transaction([
      basePrisma.payrollRecord.update({
        where: { id: payroll.id },
        data: { 
          status: "DISBURSED",
          receiptCode,
        }
      }),
      basePrisma.transaction.create({
        data: {
          schoolId: school.id,
          type: "EXPENSE",
          category: "PAYROLL",
          amount: payroll.amount,
          description: `Salary disbursement for ${payroll.staff.firstName} ${payroll.staff.lastName} (${payroll.staff.role}) - Settled via external bank instruction`,
          referenceId: payroll.id
        }
      })
    ]);

    safeRevalidatePath(`/${schoolDomain}/hr`);
    safeRevalidatePath(`/${schoolDomain}`, "layout");
    return { success: true, receiptCode };
  } catch (error: any) {
    console.error("[HR Server Action] Failed to disburse payroll:", error);
    return { success: false, error: error.message || "Disbursement processing failed." };
  }
}

export async function updateBankDetails(schoolDomain: string, staffId: string, formData: FormData) {
  try {
    const bankName = (formData.get("bankName") as string)?.trim();
    const accountName = (formData.get("accountName") as string)?.trim();
    const bankAccountNumber = (formData.get("bankAccountNumber") as string)?.trim();

    if (!bankName || !accountName || !bankAccountNumber) {
      return { success: false, error: "All bank account fields are required." };
    }

    await basePrisma.staff.update({
      where: { id: staffId },
      data: { bankName, accountName, bankAccountNumber }
    });

    safeRevalidatePath(`/${schoolDomain}/hr`);
    return { success: true };
  } catch (error: any) {
    console.error("[HR Server Action] Failed to update bank details:", error);
    return { success: false, error: error.message || "Failed to update bank details." };
  }
}
