"use client";

import React, { useState } from "react";
import { FeesFinanceData, InvoiceItem, PaymentItem, TierPresentationConfig } from "../types";
import { 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Download, 
  ArrowLeft, 
  Wallet, 
  Calendar, 
  ShieldCheck, 
  FileText, 
  ExternalLink,
  Search,
  Filter,
  X,
  Printer,
  ChevronRight
} from "lucide-react";

interface TransactionHistoryModuleProps {
  finance: FeesFinanceData;
  tierConfig: TierPresentationConfig;
  schoolId: string;
  studentLoginId: string;
  onBack?: () => void;
}

export function TransactionHistoryModule({
  finance,
  tierConfig,
  schoolId,
  studentLoginId,
  onBack
}: TransactionHistoryModuleProps) {
  const { currency, totalBilled, totalPaid, outstandingBalance, invoices, payments } = finance;
  const [activeTab, setActiveTab] = useState<"RECEIPTS" | "INVOICES">("RECEIPTS");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentItem | null>(null);

  // Filtered payments by search
  const filteredPayments = payments.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.reference.toLowerCase().includes(q) ||
      p.receiptNumber.toLowerCase().includes(q) ||
      p.invoiceDescription.toLowerCase().includes(q) ||
      p.method.toLowerCase().includes(q)
    );
  });

  // Filtered invoices by search
  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.description.toLowerCase().includes(q) ||
      inv.category.toLowerCase().includes(q)
    );
  });

  const handleDownloadReceipt = (receipt: PaymentItem) => {
    setSelectedReceipt(receipt);
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Header Bar with Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-zinc-700 shadow-2xs transition shrink-0"
              title="Return to previous screen"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                Official Ledger
              </span>
              <span className="text-xs text-slate-400 dark:text-zinc-500">
                {tierConfig.billingTitle}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              Transaction History & Receipts
            </h2>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search reference, receipt #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* High-Level Financial Audit Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-blue-500" />
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Invoiced
            </span>
            <Wallet className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums tracking-tight">
            {currency}{totalBilled.toLocaleString()}
          </p>
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1 block">
            {invoices.length} Official Invoices
          </span>
        </div>

        {/* Total Reconciled / Paid */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Reconciled
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-mono tabular-nums tracking-tight">
            {currency}{totalPaid.toLocaleString()}
          </p>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {payments.length} Verified Receipts
          </span>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden">
          <div className={`absolute top-0 inset-x-0 h-1 ${outstandingBalance > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Outstanding Balance
            </span>
            <Clock className={`w-4 h-4 ${outstandingBalance > 0 ? "text-amber-500" : "text-emerald-500"}`} />
          </div>
          <p className={`text-2xl font-black whitespace-nowrap font-mono tabular-nums tracking-tight ${outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {currency}{outstandingBalance.toLocaleString()}
          </p>
          <span className={`text-[11px] font-semibold mt-1 block ${outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
            {outstandingBalance > 0 ? "Pending Settlement" : "All Accounts Cleared"}
          </span>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-zinc-800/80 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab("RECEIPTS")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
            activeTab === "RECEIPTS"
              ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Verified Receipts ({payments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("INVOICES")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
            activeTab === "INVOICES"
              ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Invoice Statements ({invoices.length})</span>
        </button>
      </div>

      {/* TAB 1: VERIFIED RECEIPTS & HISTORICAL PAYMENTS */}
      {activeTab === "RECEIPTS" && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Settled Payment Receipts
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Official institutional electronic receipts with audit references
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {filteredPayments.length} Records
            </span>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
              <p className="text-xs text-slate-400">No payment receipts matching your query.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredPayments.map((txn) => (
                <div
                  key={txn.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition px-2 rounded-lg"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                        {txn.receiptNumber}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        Ref: {txn.reference}
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {txn.status}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        via {txn.method}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {txn.invoiceDescription}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {txn.paymentDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-mono tabular-nums tracking-tight">
                      +{currency}{txn.amountPaid.toLocaleString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(txn)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Receipt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVOICES & STATEMENTS */}
      {activeTab === "INVOICES" && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Invoices & Termly Statements
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Breakdown of billed tuition, levies, and settlement statuses
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              {filteredInvoices.length} Invoices
            </span>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
              <p className="text-xs text-slate-400">No invoices matching your query.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredInvoices.map((inv) => {
                const remaining = inv.amountDue - inv.amountPaid;
                const isPaid = inv.status === "PAID" || remaining <= 0;

                return (
                  <div
                    key={inv.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition px-2 rounded-lg"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                          {inv.invoiceNumber}
                        </span>
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isPaid
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                              : inv.status === "PARTIAL"
                              ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                              : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {isPaid ? "PAID IN FULL" : inv.status}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          Due Date: {inv.dueDate}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {inv.description}
                      </h4>

                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Category: {inv.category}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-base font-black text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums tracking-tight">
                          {currency}{inv.amountDue.toLocaleString()}
                        </p>
                        {remaining > 0 && (
                          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap font-mono tabular-nums tracking-tight">
                            {currency}{remaining.toLocaleString()} balance
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cleared</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Balance Due</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Receipt View Modal (Clean Printable Receipt Dialog) */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Official Fee Receipt
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    #{selectedReceipt.receiptNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-700/60 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-zinc-700/60">
                <span className="text-slate-400">Payment Status</span>
                <span className="font-extrabold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  {selectedReceipt.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Student Login ID</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{studentLoginId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Item Description</span>
                <span className="font-bold text-slate-900 dark:text-white text-right">{selectedReceipt.invoiceDescription}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Payment Channel</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedReceipt.method}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Transaction Date</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedReceipt.paymentDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Audit Reference</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{selectedReceipt.reference}</span>
              </div>
              <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-700/60 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700 dark:text-zinc-300">Amount Paid</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-base">
                  {currency}{selectedReceipt.amountPaid.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
