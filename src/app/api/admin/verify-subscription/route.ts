import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/verify-subscription
 * 100% Manual SaaS Subscription Framework.
 * Super Admin confirmation endpoint to approve or reject manual offline bank subscription payments.
 * 
 * Payload:
 * {
 *   tenantId: string,
 *   action: 'APPROVE' | 'REJECT'
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tenantId, action } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'APPROVE' or 'REJECT'." },
        { status: 400 }
      );
    }

    // 1. Locate the target tenant in PostgreSQL
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { plan: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: `Tenant with ID "${tenantId}" not found.` },
        { status: 404 }
      );
    }

    // =========================================================================
    // ACTION: APPROVE
    // =========================================================================
    if (action === "APPROVE") {
      const now = new Date();
      // Advance next_renewal_date forward by exactly 30 calendar days from the approval moment
      const thirtyDaysForward = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // A. Update Tenant status to ACTIVE
      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: "ACTIVE",
          suspendedReason: null,
          suspendedAt: null,
        },
      });

      // B. Update or create active Subscription record with new renewal timestamp
      const activeSub = tenant.subscriptions[0];
      let updatedSubscription;

      if (activeSub) {
        updatedSubscription = await prisma.subscription.update({
          where: { id: activeSub.id },
          data: {
            status: "active",
            endsAt: thirtyDaysForward,
            amountPaid: activeSub.amountDue || tenant.plan?.priceNgn || 50000,
          },
        });
      } else {
        const defaultPlan = tenant.planId
          ? tenant.plan
          : await prisma.plan.findFirst();

        updatedSubscription = await prisma.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: defaultPlan?.id || "standard-plan",
            status: "active",
            startsAt: now,
            endsAt: thirtyDaysForward,
            amountDue: defaultPlan?.priceNgn || 50000,
            amountPaid: defaultPlan?.priceNgn || 50000,
          },
        });
      }

      // C. Synchronize operational School record
      await prisma.school.updateMany({
        where: { subdomain: tenant.subdomain },
        data: {
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: thirtyDaysForward,
          isActive: true,
        },
      });

      // D. Record Platform Transaction log for manual subscription fee
      const amountPaid = Number(updatedSubscription.amountDue || tenant.plan?.priceNgn || 50000);
      await prisma.platformTransaction.create({
        data: {
          tenantId: tenant.id,
          type: "subscription",
          amount: amountPaid,
          reference: `MANUAL_SUB_${tenant.subdomain.toUpperCase()}_${Date.now()}`,
        },
      }).catch((txErr) => {
        console.warn("[VERIFY_SUBSCRIPTION] Transaction log non-fatal error:", txErr);
      });

      // E. Log Super Admin Audit Trail
      await prisma.auditLog.create({
        data: {
          actorId: "super_admin",
          action: "approve_subscription_payment",
          tenantId: tenant.id,
          metadata: {
            schoolName: tenant.schoolName,
            subdomain: tenant.subdomain,
            approvedAt: now.toISOString(),
            nextRenewalDate: thirtyDaysForward.toISOString(),
            amount: amountPaid,
          },
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Subscription for "${tenant.schoolName}" approved successfully. Active for 30 days.`,
        tenantId: updatedTenant.id,
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        nextRenewalDate: thirtyDaysForward.toISOString(),
        renewalDate: thirtyDaysForward.toISOString(),
      });
    }

    // =========================================================================
    // ACTION: REJECT
    // =========================================================================
    if (action === "REJECT") {
      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: "PAST_DUE",
          suspendedReason: "Offline bank transfer proof unverified or invalid.",
        },
      });

      const activeSub = tenant.subscriptions[0];
      if (activeSub) {
        await prisma.subscription.update({
          where: { id: activeSub.id },
          data: { status: "past_due" },
        });
      }

      await prisma.school.updateMany({
        where: { subdomain: tenant.subdomain },
        data: {
          subscriptionStatus: "PAST_DUE",
        },
      });

      return NextResponse.json({
        success: true,
        message: `Subscription payment for "${tenant.schoolName}" was rejected.`,
        tenantId: updatedTenant.id,
        status: "PAST_DUE",
        subscriptionStatus: "PAST_DUE",
      });
    }

    return NextResponse.json({ success: false, error: "Unhandled action" }, { status: 400 });
  } catch (error: any) {
    console.error("[PATCH /api/admin/verify-subscription Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process subscription verification" },
      { status: 500 }
    );
  }
}
