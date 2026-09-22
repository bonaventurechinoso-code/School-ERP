import React from "react";
import Link from "next/link";
import { getBursarContext, getBursarDashboardStats } from "./actions";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  ShieldCheck,
  Banknote,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";

function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}


export default async function BursarDashboardPage() {
  const context = await getBursarContext();
  const schoolId = context?.schoolId || "default-school";
  const stats = await getBursarDashboardStats(schoolId);

  return (
    <div className="space-y-6">
      {/* 1. HERO GREETING & COMMAND STRIP */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Bursary Treasury Active &bull; {context?.schoolName}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Bursar Command Center
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl font-medium">
              Real-time tuition cashflow, counter payments, parent bank transfer approvals, and institutional financial accounting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/bursar/collect"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              <span>Collect Fee</span>
            </Link>
            <Link
              href="/bursar/verifications"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify Transfers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. URGENT PENDING BANK PROOFS BANNER */}
      {stats.pendingVerificationsCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {stats.pendingVerificationsCount} Bank Transfer {stats.pendingVerificationsCount === 1 ? "Receipt" : "Receipts"} Awaiting Bursar Approval
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300/80">
                Parents have uploaded manual payment proofs. Confirm funds in the school account and credit student invoices.
              </p>
            </div>
          </div>
          <Link
            href="/bursar/verifications"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-xs whitespace-nowrap self-start sm:self-auto"
          >
            <span>Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 3. FOUR CORE FINANCIAL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Invoiced */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Invoiced
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatNaira(stats.totalInvoiced)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1">
              Across {stats.totalInvoicesCount} student fee invoices
            </p>
          </div>
        </div>

        {/* Total Collected */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Collections
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatNaira(stats.totalCollected)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                {stats.collectionRate}% Recovered
              </span>
            </div>
          </div>
        </div>

        {/* Outstanding Balances */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Outstanding Debt
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {formatNaira(stats.outstandingBalance)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1">
              Unpaid tuition & sundry levies
            </p>
          </div>
        </div>

        {/* Today's Cashflow */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Today&apos;s Inflow
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {formatNaira(stats.todayCollected)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1">
              Collections recorded today
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
