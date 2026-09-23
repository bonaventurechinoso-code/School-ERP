import { prisma } from "@/lib/prisma";
import SaasAdminDashboard from "./SaasAdminDashboard";
import { DEFAULT_PLANS } from "@/lib/saas-plans";

export const dynamic = "force-dynamic";

export default async function SaasAdminPage() {
  // 1. Fetch or Seed Baseline Plans
  let rawPlans = await prisma.plan.findMany({
    orderBy: { priceNgn: "asc" },
  });

  if (rawPlans.length === 0) {
    for (const planDef of DEFAULT_PLANS) {
      await prisma.plan.create({ data: planDef }).catch(() => {});
    }
    rawPlans = await prisma.plan.findMany({
      orderBy: { priceNgn: "asc" },
    });
  }

  const plans = rawPlans.map((p) => ({
    id: p.id,
    name: p.name,
    priceNgn: p.priceNgn,
    billingCycle: p.billingCycle,
    maxStudents: p.maxStudents,
    maxStaff: p.maxStaff,
    commissionPercent: p.commissionPercent,
  }));

  // 2. Fetch Platform Settlement Bank Configuration (Corporate Account)
  let platformBank = await prisma.platformBankConfig.findUnique({
    where: { id: "global" },
  });

  if (!platformBank) {
    platformBank = await prisma.platformBankConfig.create({
      data: {
        id: "global",
        bankCode: "035", // Wema Bank
        bankName: "Wema Bank",
        accountNumber: "0123456789",
      },
    });
  }

  // 3. Seed / Sync Baseline Tenants if None Exist in Tenant Table
  const tenantCount = await prisma.tenant.count();
  if (tenantCount === 0) {
    const defaultPlan = rawPlans[0] || null;
    const schools = await prisma.school.findMany();
    for (const s of schools) {
      await prisma.tenant.create({
        data: {
          schoolName: s.name,
          subdomain: s.subdomain,
          adminEmail: `admin@${s.subdomain}.edu.ng`,
          contactPhone: s.contactPhone || "+2348012345678",
          institutionTypes: ["PRIMARY", "SECONDARY"],
          planId: defaultPlan?.id || null,
          status: "ACTIVE",
          settlementBankName: s.settlementBankName || "Access Bank",
          settlementAccountNumber: s.settlementAccountNumber || "0123456789",
          settlementAccountName: s.settlementAccountName || s.name,
          collectionMode: "MANUAL_BANK_TRANSFER",
        },
      }).catch(() => {});
    }
  }

  // 4. Fetch Platform Revenue Mirror
  let platformWallet = await prisma.platformWallet.findFirst();
  if (!platformWallet) {
    platformWallet = await prisma.platformWallet.create({
      data: { balance: 0.0, totalRevenue: 0.0 },
    });
  }

  // 5. Aggregate Tenant Status Counts
  const [totalTenants, activeTenants, suspendedTenants, pendingTenants] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.tenant.count({ where: { status: "SUSPENDED" } }),
      prisma.tenant.count({ where: { status: "PENDING" } }),
    ]);

  // 6. Compute MRR / ARR
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

  // 7. Recent Activity Logs & Transactions
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

  // 8. Fetch Tenants with 30-Day Collections and Manual Bank Transfer Details
  const rawTenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
      subscriptions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      },
    },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const tenants = await Promise.all(
    rawTenants.map(async (t) => {
      const activeSub = t.subscriptions[0];

      // Find matching school for operational finance & verifications metrics
      const matchingSchool = await prisma.school.findUnique({
        where: { subdomain: t.subdomain },
      });

      let pendingVerificationsCount = 0;
      let verifiedTuition30Days = 0;

      if (matchingSchool) {
        pendingVerificationsCount = await prisma.paymentProof.count({
          where: {
            schoolId: matchingSchool.id,
            status: "PENDING",
          },
        });

        const verifiedAgg = await prisma.payment.aggregate({
          where: {
            schoolId: matchingSchool.id,
            createdAt: { gte: thirtyDaysAgo },
          },
          _sum: { amountPaid: true },
        });
        verifiedTuition30Days = Number(verifiedAgg._sum?.amountPaid || 0);
      }

      const settlementBankName =
        matchingSchool?.settlementBankName ||
        t.settlementBankName ||
        null;

      const settlementAccountNumber =
        matchingSchool?.settlementAccountNumber ||
        t.settlementAccountNumber ||
        null;

      const settlementAccountName =
        matchingSchool?.settlementAccountName ||
        t.settlementAccountName ||
        null;

      const collectionMode =
        matchingSchool?.collectionMode ||
        t.collectionMode ||
        "MANUAL_BANK_TRANSFER";

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
        settlementBankName,
        settlementAccountNumber,
        settlementAccountName,
        collectionMode,
        pendingVerificationsCount,
        settlementBankDetails: settlementBankName && settlementAccountNumber
          ? {
              bankCode: matchingSchool?.settlementBankCode || "044",
              bankName: settlementBankName,
              accountNumber: settlementAccountNumber,
              accountName: settlementAccountName,
            }
          : null,
        isImpersonationAllowed: t.isImpersonationAllowed,
        suspendedReason: t.suspendedReason,
        suspendedAt: t.suspendedAt ? t.suspendedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        collection30Days: verifiedTuition30Days,
        commission30Days: 0,
        commissionPercent: 0,
        monthlyRate: Number(activeSub?.amountDue ?? t.plan?.priceNgn ?? 0),
        nextRenewalDate: activeSub?.endsAt ? activeSub.endsAt.toISOString() : null,
        subscriptionStatus: activeSub?.status?.toUpperCase() || t.status?.toUpperCase() || "INACTIVE",
        plan: t.plan
          ? {
              id: t.plan.id,
              name: t.plan.name,
              priceNgn: t.plan.priceNgn,
              billingCycle: t.plan.billingCycle,
              commissionPercent: 0,
            }
          : null,
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
    })
  );


  return (
    <SaasAdminDashboard
      initialMetrics={metrics}
      initialTenants={tenants}
      plans={plans}
      initialPlatformBank={{
        bankCode: platformBank.bankCode || "035",
        bankName: platformBank.bankName || "Wema Bank",
        accountNumber: platformBank.accountNumber || "0123456789",
        updatedAt: platformBank.updatedAt.toISOString(),
      }}
    />
  );
}
