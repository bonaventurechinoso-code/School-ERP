import React from "react";
import { getVerificationQueue } from "./actions";
import VerificationsTableClient from "./VerificationsTableClient";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, Settings } from "lucide-react";

export default async function VerificationsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = await paramsPromise;
  const schoolDomain = params.schoolDomain;

  const data = await getVerificationQueue(schoolDomain);

  if (!data.school) {
    notFound();
  }

  const stats = data.stats || {
    pendingCount: 0,
    approvedTodayCount: 0,
    rejectedCount: 0,
    totalVerifiedRevenue: 0,
  };

  return (
    <div className="space-y-6 py-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
              Payment Verifications
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Manual Bank Transfer
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Audit parent bank transfer alerts, confirm NIP session IDs against your bank statement, and credit student fee balances.
          </p>
        </div>

        <Link
          href={`/${schoolDomain}/settings/bank`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 shadow-xs transition shrink-0"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <span>Collection Bank Settings</span>
        </Link>
      </div>

      <VerificationsTableClient
        schoolDomain={schoolDomain}
        initialProofs={data.proofs as any}
        initialStats={stats}
      />
    </div>
  );
}
