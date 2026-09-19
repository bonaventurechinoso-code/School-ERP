"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANS } from "@/lib/saas-plans";

export async function seedBaselinePlans() {
  try {
    for (const planDef of DEFAULT_PLANS) {
      const existing = await prisma.plan.findFirst({
        where: { name: planDef.name },
      });
      if (!existing) {
        await prisma.plan.create({
          data: planDef,
        });
      }
    }
    revalidatePath("/admin/saas");
    return { success: true, message: "Baseline subscription plans seeded successfully" };
  } catch (err: any) {
    console.error("[seedBaselinePlans error]:", err);
    return { success: false, error: err.message || "Failed to seed baseline plans" };
  }
}

export async function toggleTenantStatus(
  tenantId: string,
  targetStatus: "ACTIVE" | "SUSPENDED",
  reason?: string
) {
  try {
    const existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existing) {
      return { success: false, error: "Tenant not found" };
    }

    const isSuspending = targetStatus === "SUSPENDED";

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: targetStatus,
          suspendedReason: isSuspending ? reason || "Administrative suspension" : null,
          suspendedAt: isSuspending ? new Date() : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: "super_admin_ui",
          action: isSuspending ? "suspend_tenant" : "reactivate_tenant",
          tenantId,
          metadata: {
            schoolName: existing.schoolName,
            subdomain: existing.subdomain,
            previousStatus: existing.status,
            newStatus: targetStatus,
            reason: reason || null,
          },
        },
      });
    });

    revalidatePath("/admin/saas");
    return {
      success: true,
      message: `Tenant ${existing.schoolName} is now ${targetStatus}`,
    };
  } catch (err: any) {
    console.error("[toggleTenantStatus error]:", err);
    return { success: false, error: err.message || "Failed to toggle status" };
  }
}

export async function updateTenantPlan(tenantId: string, newPlanId: string) {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: newPlanId } });
    if (!plan) {
      return { success: false, error: "Selected plan does not exist" };
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { success: false, error: "Tenant does not exist" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { planId: newPlanId },
      });

      // Update active subscription plan reference
      const activeSub = await tx.subscription.findFirst({
        where: { tenantId, status: { in: ["active", "trialing"] } },
        orderBy: { createdAt: "desc" },
      });

      if (activeSub) {
        await tx.subscription.update({
          where: { id: activeSub.id },
          data: {
            planId: newPlanId,
            amountDue: plan.priceNgn,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: "super_admin_ui",
          action: "update_tenant_plan",
          tenantId,
          metadata: {
            schoolName: tenant.schoolName,
            newPlanName: plan.name,
            newPlanPrice: plan.priceNgn,
          },
        },
      });
    });

    revalidatePath("/admin/saas");
    return {
      success: true,
      message: `Updated ${tenant.schoolName} to ${plan.name} plan`,
    };
  } catch (err: any) {
    console.error("[updateTenantPlan error]:", err);
    return { success: false, error: err.message || "Failed to update tenant plan" };
  }
}

export async function impersonateTenant(tenantId: string) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { success: false, error: "Tenant not found" };
    if (tenant.status === "SUSPENDED") {
      return { success: false, error: "Cannot impersonate a suspended tenant" };
    }
    if (!tenant.isImpersonationAllowed) {
      return { success: false, error: "Impersonation is disabled by tenant security settings" };
    }

    const { createDatabaseSession } = await import("@/lib/session-manager");
    await createDatabaseSession({
      userId: `sa-impersonate-${tenant.id}`,
      email: tenant.adminEmail,
      tenantId: tenant.id,
      schoolDomain: tenant.subdomain,
      tenantName: tenant.schoolName,
      role: "ADMIN",
      staffRole: "SUPER_ADMIN_IMPERSONATOR",
      activeTiers: Array.isArray(tenant.institutionTypes)
        ? (tenant.institutionTypes as string[])
        : ["PRIMARY", "SECONDARY"],
      permissions: ["*"],
    });

    await prisma.auditLog.create({
      data: {
        actorId: "super_admin_ui",
        action: "impersonate_tenant",
        tenantId: tenant.id,
        metadata: {
          schoolName: tenant.schoolName,
          subdomain: tenant.subdomain,
          adminEmail: tenant.adminEmail,
        },
      },
    });

    return {
      success: true,
      message: `Impersonating ${tenant.schoolName}...`,
      redirectUrl: `/${tenant.subdomain}`,
    };
  } catch (err: any) {
    console.error("[impersonateTenant error]:", err);
    return { success: false, error: err.message || "Failed to impersonate tenant" };
  }
}

export async function updatePlatformSettlementBankAction(
  bankCode: string,
  accountNumber: string
) {
  try {
    const { isValidNubanAccountNumber, getBankByCode } = await import("@/lib/nigerian-banks");
    if (!isValidNubanAccountNumber(accountNumber)) {
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
        accountNumber: accountNumber.trim(),
      },
      update: {
        bankCode: bank.code,
        bankName: bank.name,
        accountNumber: accountNumber.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: "super_admin_action",
        action: "update_platform_settlement_bank",
        metadata: {
          bankCode: bank.code,
          bankName: bank.name,
          accountNumber: accountNumber.trim(),
        },
      },
    });

    revalidatePath("/admin/saas");
    return {
      success: true,
      message: `Platform commission settlement bank set to ${bank.name} (${accountNumber.trim()})`,
      platformBank: {
        bankCode: updated.bankCode,
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  } catch (err: any) {
    console.error("[updatePlatformSettlementBankAction error]:", err);
    return { success: false, error: err.message || "Failed to update platform settlement bank" };
  }
}

export async function updateTenantSettlementBankAction(
  tenantId: string,
  bankCode: string,
  accountNumber: string,
  accountName?: string
) {
  try {
    const { isValidNubanAccountNumber, getBankByCode } = await import("@/lib/nigerian-banks");
    const cleanAcc = accountNumber.trim();
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

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { success: false, error: "Tenant not found." };
    }

    const finalAccountName = (accountName || tenant.schoolName).trim().toUpperCase();

    const bankData = {
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: cleanAcc,
      accountName: finalAccountName,
      updatedAt: new Date().toISOString(),
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settlementBankName: bank.name,
        settlementAccountNumber: cleanAcc,
        settlementAccountName: finalAccountName,
        collectionMode: "MANUAL_BANK_TRANSFER",
        paystackSettlementBank: bankData,
      },
    });

    // Synchronize to the operational School record as well
    await prisma.school.updateMany({
      where: { subdomain: tenant.subdomain },
      data: {
        settlementBankName: bank.name,
        settlementBankCode: bank.code,
        settlementAccountNumber: cleanAcc,
        settlementAccountName: finalAccountName,
        collectionMode: "MANUAL_BANK_TRANSFER",
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: "super_admin_action",
        action: "update_tenant_settlement_bank",
        tenantId,
        metadata: {
          schoolName: tenant.schoolName,
          subdomain: tenant.subdomain,
          bankData,
        },
      },
    });

    revalidatePath("/admin/saas");
    return {
      success: true,
      message: `Direct collection bank for ${tenant.schoolName} set to ${bank.name} (${cleanAcc})`,
      bankData,
    };
  } catch (err: any) {
    console.error("[updateTenantSettlementBankAction error]:", err);
    return { success: false, error: err.message || "Failed to update tenant settlement bank" };
  }
}



