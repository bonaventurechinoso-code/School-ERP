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

      // B. Locate operational School record and create manual Subscription & SchoolPayment
      const school = await prisma.school.findFirst({
        where: { subdomain: tenant.subdomain },
      });

      const amountPaid = Number(tenant.plan?.priceNgn || 50000);

      if (school) {
        await prisma.subscription.create({
          data: {
            schoolId: school.id,
            plan: tenant.plan?.name || "BASIC",
            amount: amountPaid,
            status: "ACTIVE",
            paymentMethod: "MANUAL",
            verifiedByAdmin: true,
            expiresAt: thirtyDaysForward,
          },
        });

        await prisma.schoolPayment.create({
          data: {
            schoolId: school.id,
            amount: amountPaid,
            type: "SUBSCRIPTION",
            status: "VERIFIED",
          },
        });

        await prisma.school.update({
          where: { id: school.id },
          data: {
            status: "ACTIVE",
            subscriptionStatus: "ACTIVE",
            subscriptionExpiresAt: thirtyDaysForward,
            isActive: true,
          },
        });
      }

      // D. Record Platform Transaction log for manual subscription fee
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

      const school = await prisma.school.findFirst({
        where: { subdomain: tenant.subdomain },
      });

      if (school) {
        await prisma.subscription.updateMany({
          where: { schoolId: school.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });

        await prisma.school.update({
          where: { id: school.id },
          data: {
            status: "PENDING_VERIFICATION",
            subscriptionStatus: "EXPIRED",
          },
        });
      }

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
