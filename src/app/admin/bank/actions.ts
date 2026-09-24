"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getBankByCode, isValidNubanAccountNumber } from "@/lib/nigerian-banks";

export interface PlatformBankConfigData {
  bankCode: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName?: string;
  updatedAt?: string;
}

/**
 * Updates the Super Admin Platform Subscription Corporate Account.
 * The bank dropdown is powered by NIGERIAN_BANKS (now including Raenest).
 */
export async function updatePlatformCorporateBankAction(
  bankCode: string,
  accountNumber: string,
  accountName?: string
) {
  try {
    const cleanAcc = (accountNumber || "").trim();
    if (!isValidNubanAccountNumber(cleanAcc)) {
      return {
        success: false,
        error: "Invalid Account Number: Must be exactly 10 digits.",
      };
    }

    const bank = getBankByCode(bankCode);
    if (!bank) {
      return { success: false, error: "Invalid Bank selected." };
    }

    const updated = await prisma.platformBankConfig.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        bankCode: bank.code,
        bankName: bank.name,
        accountNumber: cleanAcc,
      },
      update: {
        bankCode: bank.code,
        bankName: bank.name,
        accountNumber: cleanAcc,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: "super_admin_bank_module",
        action: "update_platform_corporate_bank",
        metadata: {
          bankCode: bank.code,
          bankName: bank.name,
          accountNumber: cleanAcc,
          accountName: accountName || "BonaVee ICT Corporate",
        },
      },
    });

    revalidatePath("/admin/bank");
    revalidatePath("/admin/saas");
    revalidatePath("/admin/billings");

    return {
      success: true,
      message: `Platform Corporate Account successfully updated to ${bank.name} (${cleanAcc})`,
      platformBank: {
        bankCode: updated.bankCode,
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        accountName: accountName || "BonaVee ICT Corporate",
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  } catch (err: any) {
    console.error("[updatePlatformCorporateBankAction error]:", err);
    return {
      success: false,
      error: err.message || "Failed to update platform corporate bank account",
    };
  }
}

/**
 * Manually verifies and activates/renews a tenant's platform SaaS subscription.
 * STRICT ZERO-FEE POLICY:
 * Computes exactly 0% transaction fee. The full 100% of the manual subscription
 * payment is credited to the Platform Wallet without deductions.
 */
export async function verifyTenantManualSubscriptionAction({
  tenantId,
  durationDays = 30,
  amountPaid,
  reference,
  notes,
}: {
  tenantId: string;
  durationDays?: number;
  amountPaid: number;
  reference?: string;
  notes?: string;
}) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      return { success: false, error: "Tenant school not found." };
    }

    const safeAmount = Number(amountPaid) > 0 ? Number(amountPaid) : Number(tenant.plan?.priceNgn || 0);

    // Business Rule: 100% manual model, strictly 0% transaction fee
    const transactionFee = 0.00;
    const netCreditedAmount = safeAmount; // 100% credited, 0 deductions

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const txnRef = reference || `SUB-MANUAL-${Date.now().toString(36).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      // 1. Update Tenant Subscription Status
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: "ACTIVE",
          suspendedReason: null,
          suspendedAt: null,
        },
      });

      // 2. Synchronize Operational School model & Subscriptions table
      const matchingSchool = await tx.school.findFirst({
        where: { subdomain: tenant.subdomain },
      });

      if (matchingSchool) {
        await tx.school.update({
          where: { id: matchingSchool.id },
          data: {
            isActive: true,
            isBanned: false,
            subscriptionStatus: "ACTIVE",
            subscriptionStartedAt: now,
            subscriptionExpiresAt: newExpiresAt,
          },
        });

        await tx.subscription.create({
          data: {
            schoolId: matchingSchool.id,
            plan: tenant.plan?.name || "Standard",
            status: "ACTIVE",
            paymentMethod: "MANUAL",
            verifiedByAdmin: true,
            amount: safeAmount,
            expiresAt: newExpiresAt,
          },
        });
      }

      // 3. Update Platform Wallet (100% of amount credited, exactly 0% processing fee deducted)
      let wallet = await tx.platformWallet.findFirst();
      if (!wallet) {
        wallet = await tx.platformWallet.create({
          data: { balance: 0.0, totalRevenue: 0.0 },
        });
      }

      await tx.platformWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: netCreditedAmount },
          totalRevenue: { increment: netCreditedAmount },
        },
      });

      // 4. Log Platform Transaction with explicit 0.00 fee
      await tx.platformTransaction.create({
        data: {
          tenantId: tenant.id,
          type: "MANUAL_SUBSCRIPTION_DEPOSIT",
          amount: safeAmount,
          reference: txnRef,
        },
      });

      // 5. Create System Audit Log
      await tx.auditLog.create({
        data: {
          actorId: "super_admin_bank_module",
          action: "verify_manual_subscription",
          tenantId: tenant.id,
          metadata: {
            schoolName: tenant.schoolName,
            subdomain: tenant.subdomain,
            planName: tenant.plan?.name || "Standard",
            amountPaid: safeAmount,
            feeDeducted: transactionFee,
            durationDays,
            renewalExpiresAt: newExpiresAt.toISOString(),
            reference: txnRef,
            notes: notes || "Manual bank transfer verified with 0% transaction fee.",
          },
        },
      });
    });

    revalidatePath("/admin/bank");
    revalidatePath("/admin/saas");
    revalidatePath("/admin/billings");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Successfully verified manual subscription for ${tenant.schoolName}. Active until ${newExpiresAt.toLocaleDateString()}. Zero processing fees deducted.`,
      nextRenewalDate: newExpiresAt.toISOString(),
    };
  } catch (err: any) {
    console.error("[verifyTenantManualSubscriptionAction error]:", err);
    return {
      success: false,
      error: err.message || "Failed to verify manual subscription payment",
    };
  }
}

/**
 * Records a direct manual corporate bank deposit into the Platform Wallet.
 * STRICT 0% TRANSACTION FEE: Does not compute or deduct processing fees.
 */
export async function recordManualPlatformDepositAction({
  amount,
  reference,
  narration,
}: {
  amount: number;
  reference?: string;
  narration?: string;
}) {
  try {
    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return { success: false, error: "Please enter a valid positive deposit amount." };
    }

    const txnRef = reference?.trim() || `DEP-CORP-${Date.now().toString(36).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      let wallet = await tx.platformWallet.findFirst();
      if (!wallet) {
        wallet = await tx.platformWallet.create({
          data: { balance: 0.0, totalRevenue: 0.0 },
        });
      }

      // Add 100% of deposit without deducting transaction fees
      await tx.platformWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: depositAmount },
          totalRevenue: { increment: depositAmount },
        },
      });

      await tx.platformTransaction.create({
        data: {
          type: "CORPORATE_ACCOUNT_DEPOSIT",
          amount: depositAmount,
          reference: txnRef,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: "super_admin_bank_module",
          action: "record_corporate_deposit",
          metadata: {
            amount: depositAmount,
            feeDeducted: 0.00,
            reference: txnRef,
            narration: narration || "Direct corporate account bank deposit.",
          },
        },
      });
    });

    revalidatePath("/admin/bank");
    revalidatePath("/admin/saas");
    revalidatePath("/admin/billings");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Recorded corporate account deposit of ₦${depositAmount.toLocaleString()}. 100% credited (0% fee).`,
    };
  } catch (err: any) {
    console.error("[recordManualPlatformDepositAction error]:", err);
    return {
      success: false,
      error: err.message || "Failed to record manual corporate deposit",
    };
  }
}
