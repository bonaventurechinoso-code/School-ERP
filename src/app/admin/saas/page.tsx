import { prisma } from "@/lib/prisma";
import SaasAdminDashboard from "./SaasAdminDashboard";

export const dynamic = "force-dynamic";

export default async function SaasAdminPage() {
  // 1. Fetch Plans
  const rawPlans = await prisma.plan.findMany({
    orderBy: { priceNgn: "asc" },
  });

  const plans = rawPlans.map((p) => ({
    id: p.id,
    name: p.name,
    priceNgn: p.priceNgn,
    billingCycle: p.billingCycle,
    maxStudents: p.maxStudents,
    maxStaff: p.maxStaff,
    commissionPercent: p.commissionPercent,
  }));

  // 2. Fetch Platform Wallet & Revenue
  let platformWallet = await prisma.platformWallet.findFirst();
  if (!platformWallet) {
    platformWallet = await prisma.platformWallet.create({
      data: { balance: 0.0, totalRevenue: 0.0 },
    });
  }

  // 3. Aggregate Tenant Status Counts
  const [totalTenants, activeTenants, suspendedTenants, pendingTenants] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.tenant.count({ where: { status: "SUSPENDED" } }),
      prisma.tenant.count({ where: { status: "PENDING" } }),
    ]);

  // 4. Compute MRR / ARR
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
      estimatedMrr += Math.round(price / 3.5);
    } else if (cycle === "yearly") {
      estimatedMrr += Math.round(price / 12);
    } else {
      estimatedMrr += price;
    }
  }

  const tenantWallets = await prisma.wallet.aggregate({
    _sum: {
      balance: true,
    },
  });

  // 5. Recent Activity Logs & Transactions
  const [recentTransactions, recentAuditLogs, plansWithCount] =
    await Promise.all([
      prisma.platformTransaction.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.plan.findMany({
        select: {
          id: true,
          name: true,
          priceNgn: true,
          _count: { select: { tenants: true } },
        },
      }),
    ]);

  const metrics = {
    platformWallet: {
      balance: Number(platformWallet.balance),
      totalRevenue: Number(platformWallet.totalRevenue),
      updatedAt: platformWallet.updatedAt.toISOString(),
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
      id: tx.id,
      tenantId: tx.tenantId,
      type: tx.type,
      amount: Number(tx.amount),
      reference: tx.reference,
      createdAt: tx.createdAt.toISOString(),
    })),
    recentAuditLogs: recentAuditLogs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      action: log.action,
      tenantId: log.tenantId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    })),
  };

  // 6. Fetch Tenants List
  const rawTenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
      wallets: {
        take: 1,
      },
      subscriptions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      },
    },
  });

  const tenants = rawTenants.map((t) => {
    const primaryWallet = t.wallets[0];
    const activeSub = t.subscriptions[0];
    return {
      id: t.id,
      schoolName: t.schoolName,
      subdomain: t.subdomain,
      customDomain: t.customDomain,
      adminEmail: t.adminEmail,
      contactPhone: t.contactPhone,
      institutionTypes: t.institutionTypes,
      status: t.status,
      kycStatus: t.kycStatus,
      paystackSubaccountCode: t.paystackSubaccountCode,
      paystackSplitCode: t.paystackSplitCode,
      isImpersonationAllowed: t.isImpersonationAllowed,
      suspendedReason: t.suspendedReason,
      suspendedAt: t.suspendedAt ? t.suspendedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      plan: t.plan
        ? {
            id: t.plan.id,
            name: t.plan.name,
            priceNgn: t.plan.priceNgn,
            billingCycle: t.plan.billingCycle,
          }
        : null,
      wallet: primaryWallet
        ? {
            balance: Number(primaryWallet.balance),
            currency: primaryWallet.currency,
          }
        : { balance: 0, currency: "NGN" },
      subscription: activeSub
        ? {
            status: activeSub.status,
            amountDue: Number(activeSub.amountDue),
            endsAt: activeSub.endsAt.toISOString(),
            trialEndsAt: activeSub.trialEndsAt
              ? activeSub.trialEndsAt.toISOString()
              : null,
          }
        : null,
    };
  });

  return (
    <SaasAdminDashboard
      initialMetrics={metrics}
      initialTenants={tenants}
      plans={plans}
    />
  );
}
