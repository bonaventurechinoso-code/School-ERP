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
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 font-medium text-sm transition-colors ${
            activeTab === "overview" 
              ? "border-b-2 text-slate-900" 
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ borderBottomColor: activeTab === "overview" ? tenant.branding.primaryColor : "transparent" }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 font-medium text-sm transition-colors ${
            activeTab === "invoices" 
              ? "border-b-2 text-slate-900" 
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ borderBottomColor: activeTab === "invoices" ? tenant.branding.primaryColor : "transparent" }}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 font-medium text-sm transition-colors ${
            activeTab === "templates" 
              ? "border-b-2 text-slate-900" 
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ borderBottomColor: activeTab === "templates" ? tenant.branding.primaryColor : "transparent" }}
        >
          Fee Templates
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 font-medium text-sm transition-colors ${
            activeTab === "ledger" 
              ? "border-b-2 text-slate-900" 
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ borderBottomColor: activeTab === "ledger" ? tenant.branding.primaryColor : "transparent" }}
        >
          Ledger & Expenses
        </button>
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-blue-500">
              <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Total Invoiced</h3>
              <p className="text-4xl font-black text-slate-800">${totalInvoiced.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-green-500">
              <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Total Paid</h3>
              <p className="text-4xl font-black text-slate-800">${totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-amber-500">
              <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Total Expenses</h3>
              <p className="text-4xl font-black text-slate-800">${totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-slate-800">
              <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Ledger Balance</h3>
              <p className="text-4xl font-black text-slate-800">${(totalPaid - totalExpenses).toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-red-500">
              <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider mb-4">Outstanding Balance</h3>
              <p className="text-4xl font-black text-slate-800">${outstandingBalance.toFixed(2)}</p>
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
