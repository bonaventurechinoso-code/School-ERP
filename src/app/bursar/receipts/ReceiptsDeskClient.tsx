"use client";

import React, { useState, useTransition } from "react";
import {
  Receipt,
  Search,
  Printer,
  X,
  RefreshCw,
  Eye,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  Banknote,
  FileText,
} from "lucide-react";
import { BursarContext, getBursarReceipts } from "../actions";
import { numberToWords } from "../collect/CollectPaymentClient";

export function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReceiptsDeskClient({
  context,
  initialReceipts,
  totalCount,
}: {
  context: BursarContext;
  initialReceipts: any[];
  totalCount: number;
}) {
  const [receipts, setReceipts] = useState<any[]>(initialReceipts);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await getBursarReceipts(context.schoolId, { search: searchQuery });
      if (res.success) {
        setReceipts(res.receipts);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Official Bursary Receipts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Search, verify, and print official bursary receipts with cryptographic audit serial numbers.
          </p>
        </div>

        <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">
          Total Issued Receipts: <strong className="text-slate-900 dark:text-white">{totalCount}</strong>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student, admission no, or receipt ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Search</span>}
          </button>
        </form>
      </div>

      {/* Receipts Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {receipts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-zinc-500 italic text-sm space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
            <p>No receipts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Receipt No</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Description / Purpose</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Date Issued</th>
                  <th className="py-3 px-4 text-right">Print Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {receipts.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {r.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {r.studentName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                        {r.admissionNumber} &bull; {r.currentClass}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 font-medium">
                      {r.invoiceDescription}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                      {formatNaira(r.amountPaid)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                        {r.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 font-mono">
                      {new Date(r.paymentDate).toLocaleDateString()} {new Date(r.paymentDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setActiveReceipt(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition shadow-xs cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRINTABLE RECEIPT MODAL */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-300 p-6 sm:p-8 relative space-y-6 animate-in zoom-in-95 print:p-0 print:border-none print:shadow-none">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-base">Print Official Receipt Voucher</h3>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Voucher Card */}
            <div className="border-2 border-slate-800 p-6 rounded-2xl space-y-5 bg-amber-50/20 relative overflow-hidden">
              {/* Watermark Background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none text-slate-900 text-6xl font-black uppercase rotate-12">
                Official Receipt
              </div>

              {/* Institution Header */}
              <div className="text-center space-y-1 border-b pb-3">
                <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {context.schoolName}
                </h2>
                <p className="text-xs font-semibold text-slate-600">
                  BURSARY & TREASURY DEPARTMENT &bull; OFFICIAL RECEIPT
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Receipt No: <strong>{activeReceipt.receiptNumber}</strong> &bull; Date:{" "}
                  {new Date(activeReceipt.paymentDate).toLocaleDateString()}
                </p>
              </div>

              {/* Student & Payment Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Student Name</span>
                  <strong className="text-sm font-extrabold text-slate-900 block">
                    {activeReceipt.studentName}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Admission Number</span>
                  <strong className="text-sm font-mono font-bold text-slate-900 block">
                    {activeReceipt.admissionNumber}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Class / Level</span>
                  <span className="font-semibold text-slate-800">{activeReceipt.currentClass}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Payment Method</span>
                  <span className="font-extrabold text-indigo-700 uppercase">{activeReceipt.method}</span>
                </div>
              </div>

              {/* Amount Box */}
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-center space-y-1">
                <span className="text-xs uppercase font-bold text-slate-500 block">Amount Paid</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-950 block font-mono">
                  {formatNaira(activeReceipt.amountPaid)}
                </span>
                <p className="text-xs font-semibold text-indigo-900 italic pt-1">
                  &ldquo;{numberToWords(activeReceipt.amountPaid)}&rdquo;
                </p>
              </div>

              {/* Purpose */}
              <div className="text-xs bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Being Payment For:</span>
                <p className="font-semibold text-slate-800">{activeReceipt.invoiceDescription}</p>
              </div>

              {/* Signatures & Stamp Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-300 text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Authorized Bursar</p>
                  <p className="font-bold text-slate-900">{context.staffName}</p>
                </div>

                <div className="text-center p-2 rounded-xl border-2 border-dashed border-emerald-600/60 bg-emerald-50 text-emerald-800 font-mono text-[10px] font-bold">
                  <div>OFFICIAL BURSARY STAMP</div>
                  <div className="text-[8px] text-emerald-600">VERIFIED &amp; ACCOUNTED</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
