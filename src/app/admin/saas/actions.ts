"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANS } from "@/app/api/super-admin/plans/route";

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

