import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Platform Wallet and Lifetime Revenue
    let platformWallet = await prisma.platformWallet.findFirst();
    if (!platformWallet) {
      platformWallet = await prisma.platformWallet.create({
        data: { balance: 0.0, totalRevenue: 0.0 },
      });
    }

    // 2. Tenant Counts by Status
    const [totalTenants, activeTenants, suspendedTenants, pendingTenants] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: "ACTIVE" } }),
        prisma.tenant.count({ where: { status: "SUSPENDED" } }),
        prisma.tenant.count({ where: { status: "PENDING" } }),
      ]);

    // 3. Active Subscriptions & Estimated MRR
    const activeSubs = await prisma.subscription.findMany({
      where: {
        status: { in: ["active", "trialing"] },
      },
      include: {
        plan: true,
      },
    });

    let estimatedMrr = 0;
    for (const sub of activeSubs) {
      const price = Number(sub.amountDue || sub.plan.priceNgn || 0);
      const cycle = (sub.plan.billingCycle || "termly").toLowerCase();
      if (cycle === "monthly") {
        estimatedMrr += price;
      } else if (cycle === "termly") {
        // Average term length ~3.5 months (3 terms per year)
        estimatedMrr += Math.round(price / 3.5);
      } else if (cycle === "yearly") {
        estimatedMrr += Math.round(price / 12);
      } else {
        estimatedMrr += price;
      }
    }

    // 4. Aggregated Total Tenant Wallet Balances
    const tenantWallets = await prisma.wallet.aggregate({
      _sum: {
        balance: true,
      },
      _count: true,
    });

    // 5. Recent Platform Transactions
    const recentTransactions = await prisma.platformTransaction.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    // 6. Recent Audit Logs
    const recentAuditLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    // 7. Plan Distribution Breakdown
    const plansWithCount = await prisma.plan.findMany({
      select: {
        id: true,
        name: true,
        priceNgn: true,
        _count: {
          select: { tenants: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        platformWallet: {
          balance: Number(platformWallet.balance),
          totalRevenue: Number(platformWallet.totalRevenue),
          updatedAt: platformWallet.updatedAt,
        },
        tenants: {
          total: totalTenants,
          active: activeTenants,
          suspended: suspendedTenants,
          pending: pendingTenants,
        },
        financials: {
          estimatedMrr,
          estimatedArr: estimatedMrr * 12,
          activeSubscriptionsCount: activeSubs.length,
          totalTenantWalletFunds: Number(tenantWallets._sum.balance || 0),
        },
        planDistribution: plansWithCount.map((p) => ({
          id: p.id,
          name: p.name,
          priceNgn: p.priceNgn,
          tenantCount: p._count.tenants,
        })),
        recentTransactions: recentTransactions.map((tx) => ({
          ...tx,
          amount: Number(tx.amount),
        })),
        recentAuditLogs,
      },
    });
  } catch (error: any) {
    console.error("[SuperAdmin:Metrics GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve platform metrics" },
      { status: 500 }
    );
  }
}
