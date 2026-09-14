"use client";

import React, { useState } from "react";
import { FeesFinanceData, InvoiceItem, PaymentItem, TierPresentationConfig } from "../types";
import { processStudentFeePaymentAction } from "../actions";
import { 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  ArrowUpRight, 
  Wallet, 
  ShieldCheck,
  Building,
  Sparkles,
  X,
  Loader2,
  ChevronRight
} from "lucide-react";

interface FeesFinanceModuleProps {
  finance: FeesFinanceData;
  tierConfig: TierPresentationConfig;
  schoolId: string;
  studentLoginId: string;
  isOverview?: boolean;
  onViewTransactionHistory?: () => void;
}

export function FeesFinanceModule({
  finance,
  tierConfig,
  schoolId,
  studentLoginId,
  isOverview = false,
  onViewTransactionHistory
}: FeesFinanceModuleProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("CARD");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"INVOICES" | "TRANSACTIONS">("INVOICES");

  const { currency, totalBilled, totalPaid, outstandingBalance, invoices, payments } = finance;

  const handleOpenCheckout = (invoice: InvoiceItem) => {
    setSelectedInvoice(invoice);
    setPaymentSuccess(null);
  };

  const handleExecutePayment = async () => {
    if (!selectedInvoice) return;
    setIsProcessing(true);

    try {
      const res = await processStudentFeePaymentAction({
        schoolId,
        invoiceId: selectedInvoice.id,
        amount: selectedInvoice.amountDue - selectedInvoice.amountPaid,
        paymentMethod,
        studentLoginId,
        tierName: tierConfig.tierName
      });

      if (res.success) {
        setPaymentSuccess(`Payment successful! Reference: ${res.reference}`);
        setTimeout(() => {
          setSelectedInvoice(null);
          setPaymentSuccess(null);
        }, 2500);
      }
    } catch (err: any) {
      alert("Payment processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {isOverview ? (
        <div className="space-y-4">
          {/* Main Account Balance Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {tierConfig.billingTitle} Summary
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Termly tuition & clearance status
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                outstandingBalance > 0
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
              }`}>
                {outstandingBalance > 0 ? "Balance Pending" : "Fees Settled"}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
                Outstanding Balance Due
              </span>
              <p className={`text-2xl sm:text-3xl font-black whitespace-nowrap font-mono tabular-nums tracking-tight ${
                outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              }`}>
                {currency}{outstandingBalance.toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider block">Billed</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono tabular-nums">{currency}{totalBilled.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider block">Reconciled</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">{currency}{totalPaid.toLocaleString()}</span>
              </div>
            </div>

            {outstandingBalance > 0 && invoices.find((inv) => inv.amountDue > inv.amountPaid) && (
              <button
                type="button"
                onClick={() => handleOpenCheckout(invoices.find((inv) => inv.amountDue > inv.amountPaid)!)}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay Outstanding Balance</span>
              </button>
            )}
          </div>

          {/* Clean Sub-Page Link Container: Transaction History */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm shadow-slate-200/50 dark:shadow-none space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Transaction History
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {payments.length} verified receipts & payment logs
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onViewTransactionHistory}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition group"
            >
              <span>View Past Receipts & Paid Invoices</span>
              <ChevronRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Account Balance Billing Tracker Summary: Elevated Color-Coded Financial Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Total Invoiced Fees */}
            <div className="bg-gradient-to-br from-blue-50/80 via-white to-white dark:from-blue-950/30 dark:via-zinc-900 dark:to-zinc-900 rounded-xl p-5 shadow-sm shadow-blue-100/40 dark:shadow-none border border-blue-100/90 dark:border-blue-900/40 relative overflow-hidden group hover:border-blue-300 transition">
              <div className="absolute top-0 inset-x-0 h-1 bg-blue-500" />
              <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider truncate text-slate-500 dark:text-zinc-400">Total Invoiced Fees</span>
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums tracking-tight">
                {currency}{totalBilled.toLocaleString()}
              </p>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1 block truncate">
                {tierConfig.billingTitle}
              </span>
            </div>

            {/* Card 2: Total Reconciled / Paid */}
            <div className="bg-gradient-to-br from-emerald-50/80 via-white to-white dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 rounded-xl p-5 shadow-sm shadow-emerald-100/40 dark:shadow-none border border-emerald-100/90 dark:border-emerald-900/40 relative overflow-hidden group hover:border-emerald-300 transition">
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
              <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider truncate text-slate-500 dark:text-zinc-400">Total Reconciled</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-mono tabular-nums tracking-tight">
                {currency}{totalPaid.toLocaleString()}
              </p>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
                {payments.length} Verified Receipts
              </span>
            </div>

            {/* Card 3: Current Balance Due */}
            <div className="bg-gradient-to-br from-amber-50/80 via-white to-white dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-900 rounded-xl p-5 shadow-sm shadow-amber-100/40 dark:shadow-none border border-amber-100/90 dark:border-amber-900/40 relative overflow-hidden group hover:border-amber-300 transition">
              <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
              <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider truncate text-slate-500 dark:text-zinc-400">Current Balance Due</span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-black whitespace-nowrap font-mono tabular-nums tracking-tight ${outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {currency}{outstandingBalance.toLocaleString()}
              </p>
              <span className={`text-[11px] font-semibold mt-1 block truncate ${outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
                {outstandingBalance > 0 ? "Payment Clearance Pending" : "All Fees Cleared In Full"}
              </span>
            </div>
          </div>

          {/* 2. Invoices & Transactions Tabbed Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-xs">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {tierConfig.billingTitle} Ledger
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Official student financial accounts and billing statements
                  </p>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
            <button
              onClick={() => setActiveTab("INVOICES")}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition ${
                activeTab === "INVOICES"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Active Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab("TRANSACTIONS")}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition ${
                activeTab === "TRANSACTIONS"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Transaction Logs ({payments.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Active Invoices */}
        {activeTab === "INVOICES" && (
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No active invoices found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {invoices.map((invoice) => {
                  const remaining = invoice.amountDue - invoice.amountPaid;
                  const isPaid = invoice.status === "PAID" || remaining <= 0;

                  return (
                    <div
                      key={invoice.id}
                      className="p-4 rounded-xl bg-slate-50/70 dark:bg-zinc-800/40 border-0 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {invoice.invoiceNumber}
                          </span>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              isPaid
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                : invoice.status === "PARTIAL"
                                ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {isPaid ? "PAID IN FULL" : invoice.status}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            Due: {invoice.dueDate}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {invoice.description}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          Category: {invoice.category}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-zinc-700/60">
                        <div className="text-left sm:text-right shrink-0">
                          <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums tracking-tight">
                            {currency}{invoice.amountDue.toLocaleString()}
                          </p>
                          {remaining > 0 && (
                            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap font-mono tabular-nums tracking-tight">
                              {currency}{remaining.toLocaleString()} balance
                            </p>
                          )}
                        </div>

                        {!isPaid ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCheckout(invoice)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition shrink-0"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Now</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200/70 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold shrink-0 cursor-default"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Cleared</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Past Transaction Logs */}
        {activeTab === "TRANSACTIONS" && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No transaction logs recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {payments.map((txn) => (
                  <div
                    key={txn.id}
                    className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-800/40 border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400">
                          {txn.reference}
                        </span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          {txn.status}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          via {txn.method}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {txn.invoiceDescription}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Date: {txn.paymentDate} • Receipt: {txn.receiptNumber}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-zinc-700/60 shrink-0">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-mono tabular-nums tracking-tight">
                        +{currency}{txn.amountPaid.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => alert(`Receipt #${txn.receiptNumber} downloaded successfully.`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 text-[11px] font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-600 transition"
                      >
                        <Download className="w-3 h-3" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* 3. Payment Checkout Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-2xl border-0 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Fee Payment Checkout
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {selectedInvoice.invoiceNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  {paymentSuccess}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 space-y-1">
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Item Description</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedInvoice.description}</p>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 dark:border-zinc-700/60 mt-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Amount Due:</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono whitespace-nowrap tabular-nums tracking-tight">
                      {currency}{(selectedInvoice.amountDue - selectedInvoice.amountPaid).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Gateway Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                    Select Payment Gateway
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("CARD")}
                      className={`p-2.5 rounded-lg transition text-center ${
                        paymentMethod === "CARD"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Debit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("TRANSFER")}
                      className={`p-2.5 rounded-lg transition text-center ${
                        paymentMethod === "TRANSFER"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Bank Transfer
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("PAYSTACK")}
                      className={`p-2.5 rounded-lg transition text-center ${
                        paymentMethod === "PAYSTACK"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Paystack
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleExecutePayment}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing Gateway Payment...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirm & Reconcile Payment</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
