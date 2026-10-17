import { prisma } from "@/lib/prisma";
import BankModuleClient, { BankModuleTenant, BankModuleTransaction } from "./BankModuleClient";

export const dynamic = "force-dynamic";

export default async function BankModulePage() {
  // 1. Fetch Platform Corporate Bank Config
  let platformBank = await prisma.platformBankConfig.findUnique({
    where: { id: "global" },
  });

  if (!platformBank) {
    platformBank = await prisma.platformBankConfig.create({
      data: {
        id: "global",
        bankCode: "035", // Wema Bank default
        bankName: "Wema Bank",
        accountNumber: "0123456789",
      },
    });
  }

  // 2. Fetch Platform Wallet & Revenue
  let platformWallet = await prisma.platformWallet.findFirst();
  if (!platformWallet) {
    platformWallet = await prisma.platformWallet.create({
      data: { balance: 0.0, totalRevenue: 0.0 },
    });
  }

  // 3. Compute Estimated MRR from Active Subscriptions
  const activeSubs = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
  });

  let estimatedMrr = 0;
  for (const sub of activeSubs) {
    estimatedMrr += Number(sub.amount || 0);
  }

  // 4. Fetch All Active Non-Deleted Tenants with Active Plans & Subscriptions
  const rawTenants = await prisma.tenant.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
    },
  });

  const tenants: BankModuleTenant[] = await Promise.all(
    rawTenants.map(async (t) => {
      const matchingSchool = await prisma.school.findFirst({
        where: {
          subdomain: t.subdomain,
          isActive: true,
          deletedAt: null,
        },
        include: {
          subscriptions: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      const activeSub = matchingSchool?.subscriptions[0];

      return {
        id: t.id,
        schoolName: t.schoolName,
        subdomain: t.subdomain,
        status: t.status,
        planName: activeSub?.plan || t.plan?.name || "Standard",
        planPrice: Number(activeSub?.amount ?? t.plan?.priceNgn ?? 25000),
        billingCycle: t.plan?.billingCycle || "termly",
        nextRenewalDate: activeSub?.expiresAt ? activeSub.expiresAt.toISOString() : null,
        adminEmail: t.adminEmail,
      };
    })
  );

  // 5. Fetch Recent Platform Subscription / Corporate Transactions
  const rawTransactions = await prisma.platformTransaction.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
  });

  const recentTransactions: BankModuleTransaction[] = rawTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    reference: tx.reference,
    createdAt: tx.createdAt.toISOString(),
  }));

  return (
    <BankModuleClient
      initialPlatformBank={{
        bankCode: platformBank.bankCode,
        bankName: platformBank.bankName,
        accountNumber: platformBank.accountNumber,
        accountName: "BonaVee ICT Corporate",
        updatedAt: platformBank.updatedAt.toISOString(),
      }}
      wallet={{
        balance: Number(platformWallet.balance),
        totalRevenue: Number(platformWallet.totalRevenue),
      }}
      estimatedMrr={estimatedMrr}
      tenants={tenants}
      recentTransactions={recentTransactions}
    />
  );
}
