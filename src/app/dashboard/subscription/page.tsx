import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";
import { findSchoolAndTenant } from "@/lib/tenant-status";
import SubscriptionClient from "./SubscriptionClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscription & Billing | Tenant Workspace",
  description: "View platform settlement account and submit offline subscription receipts",
};

export default async function TenantSubscriptionBillingPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  // 1. Fetch Global Platform Owner Bank Account (strictly NO tenantId filter)
  let ownerBank = await prisma.platformOwnerBankAccount.findFirst().catch(() => null);
  let legacyBank = await prisma.platformBankConfig.findUnique({ where: { id: "global" } }).catch(() => null);

  const bankAccount = {
    bankName: ownerBank?.bankName || legacyBank?.bankName || "Fidelity Bank",
    accountNumber: ownerBank?.accountNumber || legacyBank?.accountNumber || "6560627850",
    accountName: ownerBank?.accountName || "BONAVEE ICT CONCEPTS",
    bankCode: ownerBank?.bankCode || legacyBank?.bankCode || "070",
  };

  // 2. Resolve Active Tenant and School
  const candidateIdentifier =
    user?.tenantId ||
    user?.schoolId ||
    user?.subdomain ||
    user?.schoolDomain ||
    "egede";

  let resolvedTenant: any = null;
  let resolvedSchool: any = null;

  const found = await findSchoolAndTenant(candidateIdentifier);
  resolvedTenant = found.tenant;
  resolvedSchool = found.school;

  if (!resolvedTenant && !resolvedSchool) {
    // Fallback: look for the most recently active non-deleted tenant
    resolvedTenant = await prisma.tenant.findFirst({
      where: { status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
    });
    if (resolvedTenant) {
      resolvedSchool = await prisma.school.findFirst({
        where: { subdomain: resolvedTenant.subdomain },
      });
    }
  }

  const tenantDetails = {
    id: resolvedTenant?.id || resolvedSchool?.id || candidateIdentifier,
    schoolName: resolvedSchool?.name || resolvedTenant?.schoolName || "My Educational Institution",
    subdomain: resolvedSchool?.subdomain || resolvedTenant?.subdomain || "portal",
    schoolStatus: resolvedSchool?.status || resolvedTenant?.status || "ACTIVE",
    subscriptionStatus: resolvedTenant?.subscriptionStatus || resolvedSchool?.subscriptionStatus || "ACTIVE",
    trialEndDate: (resolvedSchool?.trialEndDate || resolvedTenant?.trialEndsAt)?.toISOString() || null,
  };

  // 3. Fetch Recent Subscription Payments
  let recentPayments: any[] = [];
  if (resolvedTenant?.id) {
    try {
      const records = await prisma.subscriptionPayment.findMany({
        where: { tenantId: resolvedTenant.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      recentPayments = records.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        receiptUrl: r.receiptUrl,
        status: r.status,
        createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
      }));
    } catch (err) {
      console.error("[TenantSubscriptionBillingPage] Error fetching payments:", err);
    }
  }

  return (
    <SubscriptionClient
      bankAccount={bankAccount}
      tenant={tenantDetails}
      recentPayments={recentPayments}
    />
  );
}

