import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import { getCachedPlatformBank } from "@/lib/cache";
import { notFound } from "next/navigation";
import BillingProofClient from "./BillingProofClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscription & Billing | School ERP",
  description:
    "View your SaaS portal subscription status and submit offline bank transfer proof for renewal.",
};

async function getBillingData(schoolDomain: string) {
  try {
    const cleanDomain = (schoolDomain || "").trim().toLowerCase();
    let school: any = null;
    let tenant: any = null;

    try {
      school = await basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: cleanDomain },
            { slug: cleanDomain },
            { id: cleanDomain },
          ],
        },
      });
    } catch (e) {
      console.warn("[BILLING_PAGE] school findFirst fallback:", e);
    }

    try {
      tenant = await basePrisma.tenant.findFirst({
        where: {
          OR: [
            { subdomain: cleanDomain },
            { slug: cleanDomain },
            { id: cleanDomain },
          ],
        },
      });
    } catch (e) {
      console.warn("[BILLING_PAGE] tenant findFirst fallback:", e);
    }

    let platformBank: any = null;
    try {
      platformBank = await basePrisma.platformOwnerBankAccount.findFirst({
        where: { isActive: true },
        orderBy: { isPrimary: "desc" },
      });
    } catch (e) {
      console.warn("[BILLING_PAGE] platformOwnerBankAccount lookup fallback:", e);
    }

    if (!platformBank) {
      platformBank = await getCachedPlatformBank().catch(() => null);
    }

    let paymentHistory: any[] = [];
    try {
      const records = await basePrisma.tenantSubscriptionPayment.findMany({
        where: {
          OR: [
            { tenantId: cleanDomain },
            { schoolSlug: cleanDomain },
            ...(school?.id ? [{ tenantId: school.id }] : []),
            ...(tenant?.id ? [{ tenantId: tenant.id }] : []),
          ],
        },
        orderBy: { submittedAt: "desc" },
        take: 10,
      });

      paymentHistory = records.map((p) => ({
        id: p.id,
        amount: p.amount,
        nipSessionId: p.nipSessionId,
        senderBank: p.senderBank,
        status: p.status,
        submittedAt: p.submittedAt.toISOString(),
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
        notes: p.notes,
      }));
    } catch (e) {
      console.warn("[BILLING_PAGE] paymentHistory fallback:", e);
    }

    const merged = {
      id: school?.id || tenant?.id || cleanDomain,
      name: school?.name || tenant?.schoolName || cleanDomain,
      subdomain: school?.subdomain || tenant?.subdomain || cleanDomain,
      subscriptionPlan: school?.subscriptionPlan || tenant?.planTier || "BASIC",
      subscriptionStatus: tenant?.subscriptionStatus || school?.subscriptionStatus || "ACTIVE",
      subscriptionExpiresAt: school?.subscriptionExpiresAt || tenant?.subscriptionExpiresAt || null,
    };

    return { school: merged, platformBank, paymentHistory };
  } catch (err) {
    console.error("[BILLING_PAGE_ERROR]:", err);
    return {
      school: {
        id: schoolDomain,
        name: schoolDomain,
        subdomain: schoolDomain,
        subscriptionPlan: "BASIC",
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: null,
      },
      platformBank: null,
      paymentHistory: [],
    };
  }
}

export default async function BillingPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = await paramsPromise;
  const schoolDomain = params.schoolDomain;

  const { school, platformBank, paymentHistory } = await getBillingData(schoolDomain);

  if (!school) {
    notFound();
  }

  return (
    <div className="space-y-6 py-4 max-w-3xl">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
          Subscription &amp; Billing
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          View your portal subscription status and submit offline bank transfer proof for renewal.
        </p>
      </div>

      {/* Client Component receives all pre-fetched data */}
      <BillingProofClient
        schoolDomain={school.subdomain}
        subscriptionPlan={school.subscriptionPlan ?? undefined}
        subscriptionStatus={school.subscriptionStatus ?? undefined}
        subscriptionExpiresAt={school.subscriptionExpiresAt?.toISOString() ?? null}
        platformBankName={platformBank?.bankName ?? undefined}
        platformAccountNumber={platformBank?.accountNumber ?? undefined}
        platformAccountName={platformBank?.accountName ?? undefined}
        initialPayments={paymentHistory}
      />
    </div>
  );
}
