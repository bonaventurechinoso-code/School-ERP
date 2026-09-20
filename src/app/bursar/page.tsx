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
  Receipt,
  FileBarChart,
  ArrowRight,
  Clock,
  Building2,
  CheckCircle2,
  Copy,
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

      {/* 4. QUICK SHORTCUT TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Link
          href="/bursar/collect"
          className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-black group-hover:scale-110 transition shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white truncate">
              Collect Payment
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
              Cash, POS & Transfer
            </p>
          </div>
        </Link>

        <Link
          href="/bursar/invoices"
          className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-black group-hover:scale-110 transition shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white truncate">
              Invoices & Billing
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
              Single & Class Batch
            </p>
          </div>
        </Link>

        <Link
          href="/bursar/receipts"
          className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-black group-hover:scale-110 transition shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white truncate">
              Print Receipts
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
              Search & Print Vouchers
            </p>
          </div>
        </Link>

        <Link
          href="/bursar/reports"
          className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-black group-hover:scale-110 transition shrink-0">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white truncate">
              Defaulters Audit
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
              Export Outstanding CSV
            </p>
          </div>
        </Link>
      </div>

      {/* 5. MAIN OPERATIONAL SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Recent Collections Journal */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Recent Payment Journal
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Latest cash, card, and verified transfer receipts
              </p>
            </div>
            <Link
              href="/bursar/receipts"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 transition"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {stats.recentPayments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-zinc-500 italic text-sm">
              No payments recorded yet. Click &quot;Collect Fee&quot; to record the first payment.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {stats.recentPayments.map((p) => {
                const methodColor =
                  p.method === "CASH"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60"
                    : p.method === "TRANSFER"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/60"
                    : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60";

                return (
                  <div
                    key={p.id}
                    className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {p.student.firstName[0]}
                        {p.student.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {p.student.firstName} {p.student.lastName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono uppercase shrink-0">
                            {p.student.admissionNumber}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                          {p.invoice?.description || "Tuition Payment"} &bull; {p.student.currentClass || "General"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-sm text-slate-900 dark:text-white">
                        {formatNaira(p.amountPaid)}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase ${methodColor}`}>
                          {p.method}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(p.paymentDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Bank Account & Pending Slips */}
        <div className="space-y-6">
          {/* Direct Bank Account Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Direct Collection Bank
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Active
              </span>
            </div>

            <div>
              <p className="text-xs text-indigo-200">Bank Name</p>
              <h4 className="font-extrabold text-base text-white">
                {context?.settlementBankName || "Access Bank Plc"}
              </h4>
            </div>

            <div>
              <p className="text-xs text-indigo-200">Account Number (NUBAN)</p>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="font-mono text-xl font-black tracking-widest text-emerald-300">
                  {context?.settlementAccountNumber || "0123456789"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-indigo-800/80">
              <p className="text-[11px] text-indigo-200 truncate">
                Account Name: <strong>{context?.settlementAccountName}</strong>
              </p>
            </div>

            <Link
              href="/bursar/banking"
              className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <span>Manage Bank Settings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Pending Proofs Mini-Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Pending Verification
                </h4>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                {stats.pendingProofsList.length} In Queue
              </span>
            </div>

            {stats.pendingProofsList.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-zinc-500 italic text-xs">
                All uploaded transfer receipts are fully verified!
              </div>
            ) : (
              <div className="space-y-3">
                {stats.pendingProofsList.map((proof) => (
                  <div
                    key={proof.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {proof.studentName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                        {proof.payerBankName} &bull; {proof.admissionNumber}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-900 dark:text-white block">
                        {formatNaira(proof.amount)}
                      </span>
                      <Link
                        href="/bursar/verifications"
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 underline"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
