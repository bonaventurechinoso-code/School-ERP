"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  Download,
  Building2,
  Receipt,
  Calendar,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { INITIAL_SCHOOLS, INITIAL_PROOFS, SchoolTenant } from "../mock-data";

export default function RevenueAnalyticsPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeSchools = INITIAL_SCHOOLS.filter((s) => s.subscriptionStatus === "Active");
  const totalMRR = activeSchools.reduce((acc, curr) => acc + curr.monthlyRevenue, 0);
  const arr = totalMRR * 12;

  // Breakdown by tier
  const enterpriseRevenue = activeSchools
    .filter((s) => s.tier === "Enterprise")
    .reduce((acc, curr) => acc + curr.monthlyRevenue, 0);
  const premiumRevenue = activeSchools
    .filter((s) => s.tier === "Premium")
    .reduce((acc, curr) => acc + curr.monthlyRevenue, 0);
  const basicRevenue = activeSchools
    .filter((s) => s.tier === "Basic")
    .reduce((acc, curr) => acc + curr.monthlyRevenue, 0);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportFinancials = () => {
    triggerToast("Platform Revenue & Bank Inflow statement exported.");
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-950 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-[95vw]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Monthly Recurring Revenue & Bank Inflow
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Direct Bank Settlement
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Reconciliation ledger, cashflow velocity, and annual run rate analytics across Nigerian schools.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportFinancials}
          className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export Financial Report</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Current Platform MRR
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono">
            ₦{totalMRR.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Monthly recognized inflow</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Annual Run Rate (ARR)
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2 font-mono">
            ₦{(arr / 1000000).toFixed(1)}M
          </div>
          <div className="text-xs text-slate-500 mt-1">Based on current active subscriptions</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Average Revenue / School
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-2 font-mono">
            ₦{activeSchools.length ? Math.round(totalMRR / activeSchools.length).toLocaleString() : 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Per active tenant monthly</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Processing Surcharge
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2 font-mono">
            0% (₦0)
          </div>
          <div className="text-xs text-emerald-700 mt-1">Zero gateway deductions (Bank Model)</div>
        </div>
      </div>

      {/* Revenue Breakdown by Tier */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-7 space-y-6">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Revenue Distribution by Subscription Tier
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-purple-50/60 border border-purple-100 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Enterprise Tier
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono">
                ₦{enterpriseRevenue.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {activeSchools.filter((s) => s.tier === "Enterprise").length} large multi-branch campuses
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-purple-200/60 text-xs font-semibold text-purple-900">
              {totalMRR ? Math.round((enterpriseRevenue / totalMRR) * 100) : 0}% of Platform MRR
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-100 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Premium Tier
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono">
                ₦{premiumRevenue.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {activeSchools.filter((s) => s.tier === "Premium").length} established institutions
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-blue-200/60 text-xs font-semibold text-blue-900">
              {totalMRR ? Math.round((premiumRevenue / totalMRR) * 100) : 0}% of Platform MRR
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Basic Tier
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono">
                ₦{basicRevenue.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {activeSchools.filter((s) => s.tier === "Basic").length} smaller primary institutions
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-semibold text-slate-800">
              {totalMRR ? Math.round((basicRevenue / totalMRR) * 100) : 0}% of Platform MRR
            </div>
          </div>
        </div>
      </div>

      {/* Verified Billing Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Active Tenant Billing Ledger</h3>
            <p className="text-xs text-slate-500 mt-0.5">Institutions with recognized cash inflows</p>
          </div>
          <Link
            href="/dashboard/super-admin/bank-transfers"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Review Pending Receipts &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-6">School</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Last Verified</th>
                <th className="py-3 px-6 text-right">Recognized Inflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeSchools.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-6 font-bold text-slate-900">
                    <Link
                      href={`/dashboard/super-admin/tenants/${s.code.toLowerCase()}`}
                      className="hover:text-blue-600"
                    >
                      {s.name}
                    </Link>
                    <div className="text-xs text-slate-500 font-mono">{s.code}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {s.tier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    Direct Corporate Wire (Zenith/GTBank)
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">
                    {s.lastPaymentDate || "Verified"}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900">
                    ₦{s.monthlyRevenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
