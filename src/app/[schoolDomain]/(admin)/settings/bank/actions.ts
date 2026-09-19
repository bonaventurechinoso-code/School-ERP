"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { isValidNubanAccountNumber } from "@/lib/nigerian-banks";
import { revalidatePath } from "next/cache";

export async function getSchoolBankDetails(schoolDomain: string) {
  try {
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: schoolDomain.trim().toLowerCase() },
          { id: schoolDomain.trim() },
        ],
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        settlementBankName: true,
        settlementBankCode: true,
        settlementAccountNumber: true,
        settlementAccountName: true,
        paymentInstruction: true,
        collectionMode: true,
      },
    });

    if (!school) return null;
    return school;
  } catch (err) {
    console.error("[GET_BANK_DETAILS_ERROR]:", err);
    return null;
  }
}

export async function updateSchoolBankDetails(
  schoolDomain: string,
  data: {
    bankName: string;
    bankCode?: string;
    accountNumber: string;
    accountName: string;
    paymentInstruction?: string;
  }
) {
  try {
    const { bankName, bankCode, accountNumber, accountName, paymentInstruction } = data;

    if (!bankName || !bankName.trim()) {
      return { success: false, error: "Please select your Nigerian bank." };
    }

    if (!isValidNubanAccountNumber(accountNumber)) {
      return {
        success: false,
        error: "Invalid account number. Please enter a standard 10-digit NUBAN number.",
      };
    }

    if (!accountName || accountName.trim().length < 2) {
      return { success: false, error: "Please enter the authentic account holder name." };
    }

    const cleanDomain = schoolDomain.trim().toLowerCase();

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ subdomain: cleanDomain }, { id: schoolDomain.trim() }],
      },
    });

    if (!school) {
      return { success: false, error: "Institution record not found." };
    }

    const defaultInstruction = "Use Student Admission No as transfer narration";
    const instruction = paymentInstruction?.trim() || defaultInstruction;

    await basePrisma.school.update({
      where: { id: school.id },
      data: {
        settlementBankName: bankName.trim(),
        settlementBankCode: bankCode?.trim() || null,
        settlementAccountNumber: accountNumber.trim(),
        settlementAccountName: accountName.trim().toUpperCase(),
        paymentInstruction: instruction,
        collectionMode: "MANUAL_BANK_TRANSFER",
      },
    });

    // Also sync Tenant SaaS record if exists
    try {
      await basePrisma.tenant.updateMany({
        where: { subdomain: cleanDomain },
        data: {
          settlementBankName: bankName.trim(),
          settlementAccountNumber: accountNumber.trim(),
          settlementAccountName: accountName.trim().toUpperCase(),
          collectionMode: "MANUAL_BANK_TRANSFER",
        },
      });
    } catch {}

    revalidatePath(`/${cleanDomain}/settings/bank`);
    revalidatePath(`/${cleanDomain}/dashboard`);
    revalidatePath(`/${cleanDomain}/portal/student`);

    return {
      success: true,
      message: "School bank account successfully configured.",
    };
  } catch (err: any) {
    console.error("[UPDATE_BANK_DETAILS_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to save bank settings." };
  }
}
