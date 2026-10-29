import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";
import { clearTenantCache, reactivateTenant, notifyTenantAdmins } from "@/lib/tenant-status";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const rawRole = (user?.role || user?.userRole || "").toUpperCase();
    const isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

    if (!session || !isSuperAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin access required." },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: "Missing receipt ID." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = (body.action || "APPROVE").toUpperCase();
    const rejectionReason = body.rejectionReason;

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Subscription payment not found." }, { status: 404 });
    }

    if (action === "REJECT") {
      await prisma.subscriptionPayment.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: rejectionReason || "Payment proof unverified",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Subscription payment rejected.",
      });
    }

    const now = new Date();
    const future30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Atomic transaction per specification:
    // 1. tx.subscriptionPayment.update({ where: { id }, data: { status: 'VERIFIED', verifiedAt: now } })
    // 2. tx.school.update({ where: { id: tenant.schoolId }, data: { status: 'ACTIVE', isActive: true, isBanned: false } })
    // 3. tx.tenant.update({ where: { id: tenant.id }, data: { status: 'ACTIVE', subscriptionStatus: 'ACTIVE' } })
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPayment.update({
        where: { id },
        data: {
          status: "VERIFIED",
          verifiedAt: now,
        },
      });

      await tx.tenant.update({
        where: { id: payment.tenantId },
        data: {
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          suspendedAt: null,
          suspendedReason: null,
          statusReason: null,
          trialEndsAt: future30Days,
        },
      });

      await tx.school.updateMany({
        where: {
          OR: [
            { id: payment.tenantId },
            { subdomain: payment.tenant.subdomain },
          ],
        },
        data: {
          status: "ACTIVE",
          isActive: true,
          isBanned: false,
          deletedAt: null,
          subscriptionStatus: "ACTIVE",
          trialEndDate: future30Days,
          subscriptionExpiresAt: future30Days,
        },
      });
    });

    // Invalidate caches and reactivate tenant using single source of truth
    await clearTenantCache(payment.tenant.subdomain, payment.tenantId);
    await reactivateTenant(payment.tenant.id, { silent: true });
    await notifyTenantAdmins(
      payment.tenant.subdomain,
      "REACTIVATED",
      "Platform subscription payment verified. School portal reactivated with 30 days access."
    );

    return NextResponse.json({
      success: true,
      message: "Subscription payment verified and approved. Tenant is now ACTIVE.",
    });
  } catch (err: any) {
    console.error("[POST /api/super-admin/finance/verify/[id]] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify subscription payment." },
      { status: 500 }
    );
  }
}

