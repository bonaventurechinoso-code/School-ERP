import React from "react";
import Link from "next/link";
import { getBursarContext } from "../actions";
import { getVerificationQueue } from "@/app/[schoolDomain]/(admin)/finance/verifications/actions";
import VerificationsTableClient from "@/app/[schoolDomain]/(admin)/finance/verifications/VerificationsTableClient";
import { ShieldCheck, Building2, ExternalLink } from "lucide-react";

export const metadata = {
  title: "Payment Verifications | Bursar Portal",
  description: "Bursar payment verification audit queue for manual bank transfers and teller slips.",
};

export default async function BursarVerificationsPage() {
  const context = await getBursarContext();
  const schoolDomain = context?.schoolSubdomain || "greenwood";

  const data = await getVerificationQueue(schoolDomain);

  const stats = data.stats || {
    pendingCount: 0,
    approvedTodayCount: 0,
    rejectedCount: 0,
    totalVerifiedRevenue: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Bursar Payment Verifications
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Audit Desk
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Audit parent bank transfer screenshots and NIP session IDs against your bank statement to approve or reject fee credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/bursar/banking"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 shadow-xs transition shrink-0"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Bank Account Details</span>
          </Link>
        </div>
      </div>

      <VerificationsTableClient
        schoolDomain={schoolDomain}
        initialProofs={data.proofs as any}
        initialStats={stats}
      />
    </div>
  );
}
