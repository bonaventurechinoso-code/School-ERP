"use client";

import React, { useState } from "react";
import { Invoice, Payment, Student, FeeTemplate, Transaction } from "@prisma/client";
import { useTenant } from "@/lib/tenant-context";
import InvoiceTable from "./InvoiceTable";
import FeeTemplatesList from "./FeeTemplatesList";
import LedgerTable from "./LedgerTable";

type InvoiceWithDetails = Invoice & {
  student: Student;
  payments: Payment[];
};

export default function FinanceDashboard({
  hasHigherEd,
  invoices,
  students,
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
  students: Student[];
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
          Overview
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
          Invoices
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
          Fee Templates
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
          Ledger & Expenses
        </button>
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-blue-500">
              <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2 sm:mb-3">Total Invoiced</h3>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white truncate">${totalInvoiced.toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-emerald-500">
              <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2 sm:mb-3">Total Paid</h3>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white truncate">${totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-amber-500">
              <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2 sm:mb-3">Total Expenses</h3>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white truncate">${totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-indigo-500">
              <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2 sm:mb-3">Ledger Balance</h3>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white truncate">${(totalPaid - totalExpenses).toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-t-4 border-t-rose-500 sm:col-span-2 lg:col-span-1">
              <h3 className="text-slate-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2 sm:mb-3">Outstanding Balance</h3>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white truncate">${outstandingBalance.toFixed(2)}</p>
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
              schoolId={schoolId}
            />
          </div>
        )}

        {activeTab === "ledger" && (
          <div className="animate-in fade-in duration-300">
            <LedgerTable transactions={transactions} />
          </div>
        )}
      </div>
    </div>
  );
}
