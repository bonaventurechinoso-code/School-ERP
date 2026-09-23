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
    const [school, platformBank] = await Promise.all([
      basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: schoolDomain.trim().toLowerCase() },
            { id: schoolDomain.trim() },
          ],
        },
        select: {
          id: true,
          name: true,
          subdomain: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
      }),
      getCachedPlatformBank(),
    ]);

    return { school, platformBank };
  } catch (err) {
    console.error("[BILLING_PAGE_ERROR]:", err);
    return { school: null, platformBank: null };
  }
}

export default async function BillingPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = await paramsPromise;
  const schoolDomain = params.schoolDomain;

  const { school, platformBank } = await getBillingData(schoolDomain);

  if (!school) {
    notFound();
  }

  return (
    <div className="space-y-6 py-4 max-w-2xl">
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
      />
    </div>
  );
}
