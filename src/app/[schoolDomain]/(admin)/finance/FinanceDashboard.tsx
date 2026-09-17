"use client";

import React, { useState } from "react";
import { Invoice, Payment, Student, FeeTemplate, Transaction } from "@prisma/client";
import { useTenant } from "@/lib/tenant-context";
import { 
  FileText, 
  CreditCard, 
  TrendingDown, 
  Wallet, 
  AlertCircle, 
  PlusCircle, 
  Layers, 
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import InvoiceTable from "./InvoiceTable";
import FeeTemplatesList from "./FeeTemplatesList";
import LedgerTable from "./LedgerTable";

export function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type InvoiceWithDetails = Invoice & {
  student: Student;
  payments: Payment[];
};

export default function FinanceDashboard({
  hasHigherEd,
  invoices,
  students,
  classrooms = [],
  feeTemplates,
  transactions,
  schoolId,
  totalInvoiced,
  totalPaid,
  totalExpenses,
  outstandingBalance,
}: {
  hasHigherEd: boolean;
  invoices: InvoiceWithDetails[];
  students: (Student & { currentClass?: string | null })[];
  classrooms?: string[];
  feeTemplates: FeeTemplate[];
  transactions: Transaction[];
  schoolId: string;
  totalInvoiced: number;
  totalPaid: number;
  totalExpenses: number;
  outstandingBalance: number;
}) {
  const tenant = useTenant();
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "templates" | "ledger">("overview");

  const netCashFlow = totalPaid - totalExpenses;
  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex overflow-x-auto whitespace-nowrap hide-scrollbar border-b border-slate-200 dark:border-zinc-800 gap-4 sm:gap-6 pb-0">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "overview" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "overview" ? tenant.branding.primaryColor : "transparent" }}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "invoices" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "invoices" ? tenant.branding.primaryColor : "transparent" }}
        >
          Invoices & Payments ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "templates" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "templates" ? tenant.branding.primaryColor : "transparent" }}
        >
          Fee Templates ({feeTemplates.length})
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors ${
            activeTab === "ledger" 
              ? "border-b-2 text-slate-900 dark:text-white" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
          style={{ borderBottomColor: activeTab === "ledger" ? tenant.branding.primaryColor : "transparent" }}
        >
          General Ledger & Expenses ({transactions.length})
        </button>
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Quick Action Shortcuts */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Quick Actions:</span>
                <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium hidden sm:inline">
                  Collection Efficiency: <strong className="text-emerald-600 dark:text-emerald-400">{collectionRate}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("invoices")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Issue Invoice</span>
                </button>
                <button
                  onClick={() => setActiveTab("ledger")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Record Expense</span>
                </button>
                <button
                  onClick={() => setActiveTab("templates")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Fee Schedules</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {/* Total Invoiced */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Total Invoiced</h3>
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate font-mono">
                  {formatNaira(totalInvoiced)}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                  {invoices.length} billing items generated
                </p>
              </div>

              {/* Total Collected */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-emerald-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Total Collected</h3>
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 truncate font-mono">
                  {formatNaira(totalPaid)}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 mt-2 font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{collectionRate}% of total receivables collected</span>
                </div>
              </div>

              {/* Total Expenses */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-rose-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Institutional Expenses</h3>
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                </div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate font-mono">
                  {formatNaira(totalExpenses)}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                  Operational & payroll disbursements
                </p>
              </div>

              {/* Net Cash Flow / Ledger Balance */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-indigo-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Net Cash Position</h3>
                  <Wallet className="w-4 h-4 text-indigo-500" />
                </div>
                <p className={`text-2xl sm:text-3xl font-black truncate font-mono ${netCashFlow >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"}`}>
                  {formatNaira(netCashFlow)}
                </p>
                <div className="flex items-center gap-1.5 text-xs mt-2 font-medium">
                  {netCashFlow >= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Positive Net Operating Cash
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5" /> Deficit: Expenses exceed cash receipts
                    </span>
                  )}
                </div>
              </div>

              {/* Outstanding Receivables */}
              <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-amber-500 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Outstanding Receivables</h3>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
                <p className={`text-2xl sm:text-3xl font-black truncate font-mono ${outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                  {formatNaira(outstandingBalance)}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                  {outstandingBalance > 0 ? "Unpaid or partially settled student bills" : "All invoiced fees fully cleared"}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="animate-in fade-in duration-300">
            <InvoiceTable 
              invoices={invoices} 
              students={students} 
              feeTemplates={feeTemplates}
              schoolId={schoolId} 
            />
          </div>
        )}

        {activeTab === "templates" && (
          <div className="animate-in fade-in duration-300">
            <FeeTemplatesList 
              hasHigherEd={hasHigherEd}
              feeTemplates={feeTemplates}
              students={students}
              classrooms={classrooms}
              schoolId={schoolId}
            />
          </div>
        )}

        {activeTab === "ledger" && (
          <div className="animate-in fade-in duration-300">
            <LedgerTable 
              transactions={transactions} 
              schoolId={schoolId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

