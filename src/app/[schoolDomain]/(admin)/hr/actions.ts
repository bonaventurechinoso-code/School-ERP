"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

export async function createDepartment(schoolDomain: string, formData: FormData) {
  const name = formData.get("name") as string;
  if (!name) {
    console.error("Name is required");
    return;
  }

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain }
  });

  if (!school) {
    console.error("School not found");
    return;
  }

  try {
    await basePrisma.department.create({
      data: {
        name,
        schoolId: school.id
      }
    });
    revalidatePath(`/${schoolDomain}/hr`);
  } catch (error: any) {
    console.error(error.message);
  }
}

export async function generatePayroll(schoolDomain: string, formData: FormData) {
  const staffId = formData.get("staffId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const payDate = new Date(formData.get("payDate") as string);

  if (!staffId || isNaN(amount) || !payDate) {
    console.error("Invalid input");
    return;
  }

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain }
  });

  if (!school) {
    console.error("School not found");
    return;
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
    revalidatePath(`/${schoolDomain}/hr`);
  } catch (error: any) {
    console.error(error.message);
  }
}

export async function voidPayroll(schoolDomain: string, payrollId: string) {
  try {
    await basePrisma.payrollRecord.delete({
      where: { id: payrollId }
    });
    revalidatePath(`/${schoolDomain}/hr`);
  } catch (error: any) {
    console.error(error.message);
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
      console.error("Record not found");
      return;
    }

    // 2. Check Wallet Balance
    if (school.walletBalance < payroll.amount) {
      console.error("Insufficient school wallet balance. Please add funds.");
      return; 
    }

    // 3. (Simulated) Call the Payout API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payrollId: payroll.id,
        amount: payroll.amount,
        destinationAccount: payroll.staff.bankAccountNumber || "unknown"
      })
    });
    const data = await res.json();
    if (data.status !== "success") {
      console.error("Payout API failed:", data.message);
      return;
    }

    // 4. Deduct balance and update status
    await basePrisma.$transaction([
      basePrisma.school.update({
        where: { id: school.id },
        data: { walletBalance: school.walletBalance - payroll.amount }
      }),
      basePrisma.payrollRecord.update({
        where: { id: payroll.id },
        data: { 
          status: "DISBURSED VIA API",
          receiptCode: data.transactionId
        }
      }),
      basePrisma.transaction.create({
        data: {
          schoolId: school.id,
          type: "EXPENSE",
          category: "PAYROLL",
          amount: payroll.amount,
          description: `Payroll disbursement for ${payroll.staff.firstName} ${payroll.staff.lastName}`,
          referenceId: payroll.id
        }
      })
    ]);

    revalidatePath(`/${schoolDomain}/hr`);
  } catch (error: any) {
    console.error(error.message);
  }
}

export async function updateBankDetails(schoolDomain: string, staffId: string, formData: FormData) {
  try {
    const bankName = formData.get("bankName") as string;
    const accountName = formData.get("accountName") as string;
    const bankAccountNumber = formData.get("bankAccountNumber") as string;

    if (!bankName || !accountName || !bankAccountNumber) return;

    await basePrisma.staff.update({
      where: { id: staffId },
      data: { bankName, accountName, bankAccountNumber }
    });

    revalidatePath(`/${schoolDomain}/hr`);
  } catch (error: any) {
    console.error(error.message);
  }
}
