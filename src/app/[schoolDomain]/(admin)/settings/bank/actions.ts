"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { isValidNubanAccountNumber } from "@/lib/nigerian-banks";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

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
    const session = await getSession(undefined, schoolDomain);
    const role = (session?.role || "").toUpperCase();
    const staffRole = (session?.staffRole || "").toUpperCase();

    const isSuperAdmin =
      role === "SUPER_ADMIN" ||
      role === "SUPERADMIN" ||
      session?.isSuperAdmin === true;

    const isTenantAdmin =
      role === "TENANT_ADMIN" ||
      role === "SCHOOL_ADMIN" ||
      role === "ADMIN" ||
      role === "SCHOOL_OWNER" ||
      role === "TENANT_OWNER" ||
      staffRole.includes("ADMIN") ||
      staffRole.includes("PRINCIPAL") ||
      staffRole.includes("PROPRIETOR") ||
      staffRole.includes("DIRECTOR");

    const isRestrictedOfficer =
      role.includes("REGISTRAR") ||
      role.includes("ADMISSION") ||
      staffRole.includes("REGISTRAR") ||
      staffRole.includes("ADMISSION");

    if (!isSuperAdmin && (!isTenantAdmin || isRestrictedOfficer)) {
      return {
        success: false,
        error:
          "Access Denied: Only the Tenant Administrator has permission to configure or change institutional bank details. Registrars and Admission Officers are restricted.",
      };
    }

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

    // Also synchronize TenantPaymentSettings record
    try {
      const { PaymentSettingsController } = await import("@/lib/payment-settings-controller");
      await PaymentSettingsController.updateTenantSettings(
        school.id,
        {
          manual_transfer_instructions: instruction,
          bank_accounts: [
            {
              bank_name: bankName.trim(),
              account_number: accountNumber.trim(),
              account_name: accountName.trim().toUpperCase(),
              branch_code: bankCode?.trim() || "",
              currency: "NGN",
              swift_bic: "",
            },
          ],
        },
        "SCHOOL_ADMIN",
        "internal-action"
      );
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

export async function resetSchoolBankDetails(schoolDomain: string) {
  try {
    const session = await getSession(undefined, schoolDomain);
    const role = (session?.role || "").toUpperCase();
    const staffRole = (session?.staffRole || "").toUpperCase();

    const isSuperAdmin =
      role === "SUPER_ADMIN" ||
      role === "SUPERADMIN" ||
      session?.isSuperAdmin === true;

    const isTenantAdmin =
      role === "TENANT_ADMIN" ||
      role === "SCHOOL_ADMIN" ||
      role === "ADMIN" ||
      role === "SCHOOL_OWNER" ||
      role === "TENANT_OWNER" ||
      staffRole.includes("ADMIN") ||
      staffRole.includes("PRINCIPAL") ||
      staffRole.includes("PROPRIETOR") ||
      staffRole.includes("DIRECTOR");

    const isRestrictedOfficer =
      role.includes("REGISTRAR") ||
      role.includes("ADMISSION") ||
      staffRole.includes("REGISTRAR") ||
      staffRole.includes("ADMISSION");

    if (!isSuperAdmin && (!isTenantAdmin || isRestrictedOfficer)) {
      return {
        success: false,
        error:
          "Access Denied: Only the Tenant Administrator has permission to reset institutional bank details. Registrars and Admission Officers are strictly restricted.",
      };
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

    await basePrisma.school.update({
      where: { id: school.id },
      data: {
        settlementBankName: null,
        settlementBankCode: null,
        settlementAccountNumber: null,
        settlementAccountName: null,
        paymentInstruction: "",
      },
    });

    try {
      await basePrisma.tenant.updateMany({
        where: { subdomain: cleanDomain },
        data: {
          settlementBankName: null,
          settlementAccountNumber: null,
          settlementAccountName: null,
        },
      });
    } catch {}

    try {
      const { PaymentSettingsController } = await import("@/lib/payment-settings-controller");
      await PaymentSettingsController.updateTenantSettings(
        school.id,
        {
          bank_accounts: [],
        },
        "SCHOOL_ADMIN",
        "internal-reset-action"
      );
    } catch {}

    revalidatePath(`/${cleanDomain}/settings/bank`);
    revalidatePath(`/${cleanDomain}/dashboard`);
    revalidatePath(`/${cleanDomain}/portal/student`);

    return {
      success: true,
      message: "Institutional bank details have been reset successfully.",
    };
  } catch (err: any) {
    console.error("[RESET_BANK_DETAILS_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to reset bank settings." };
  }
}
