"use client";

import React, { useState, useTransition } from "react";
import {
  Search,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Printer,
  FileText,
  CreditCard,
  Building2,
  RefreshCw,
  UserCheck,
  X,
  Layers,
  Coins,
} from "lucide-react";
import { recordCounterPayment, searchStudentsWithLedger, BursarContext } from "../actions";

export function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function numberToWords(num: number): string {
  if (!num || num === 0) return "Zero Naira Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function convertLessThanOneThousand(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? "-" + ones[n % 10] : "") + " ";
    return ones[Math.floor(n / 100)] + " Hundred " + (n % 100 !== 0 ? convertLessThanOneThousand(n % 100) : "");
  }

  let words = "";
  let n = Math.floor(num);

  if (n >= 1000000) {
    words += convertLessThanOneThousand(Math.floor(n / 1000000)) + "Million ";
    n %= 1000000;
  }
  if (n >= 1000) {
    words += convertLessThanOneThousand(Math.floor(n / 1000)) + "Thousand ";
    n %= 1000;
  }
  if (n > 0) {
    words += convertLessThanOneThousand(n);
  }

  return words.trim() + " Naira Only";
}

interface StudentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  currentClass: string | null;
  feeStatus: string;
  invoices: Array<{
    id: string;
    description: string;
    amountDue: number;
    amountPaid: number;
    status: string;
    dueDate: Date;
  }>;
}

export function CollectPaymentClient({ context }: { context: BursarContext }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);

  // Form states
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"CASH" | "POS" | "TRANSFER" | "CHEQUE">("CASH");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success Receipt Modal
  const [issuedReceipt, setIssuedReceipt] = useState<any | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    startSearchTransition(async () => {
      const res = await searchStudentsWithLedger(context.schoolId, searchQuery);
      if (res.success) {
        setSearchResults(res.students as any);
        if (res.students.length === 1) {
          handleSelectStudent(res.students[0] as any);
        }
      }
    });
  };

  const handleSelectStudent = (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setErrorMessage(null);

    // Pick first pending or partial invoice
    const pendingInv = student.invoices.find((i) => i.status === "PENDING" || i.status === "PARTIAL");
    if (pendingInv) {
      setSelectedInvoiceId(pendingInv.id);
      const remaining = Math.max(0, pendingInv.amountDue - pendingInv.amountPaid);
      setAmount(remaining.toString());
      setNotes(pendingInv.description);
    } else {
      setSelectedInvoiceId("");
      setAmount("");
      setNotes("Tuition Fee Payment");
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedAmount = parseFloat(amount);
    if (!selectedStudent) {
      setErrorMessage("Please select a student first.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Please enter a valid payment amount greater than zero.");
      return;
    }

    startSubmitTransition(async () => {
      const res = await recordCounterPayment({
        schoolId: context.schoolId,
        studentId: selectedStudent.id,
        invoiceId: selectedInvoiceId || undefined,
        amount: parsedAmount,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        setIssuedReceipt({
          ...res,
          bursarName: context.staffName,
          schoolName: context.schoolName,
          settlementBank: context.settlementBankName,
        });

        // Reset form for next entry
        setAmount("");
        setReference("");
        setNotes("");
        setSelectedStudent(null);
        setSearchQuery("");
        setSearchResults([]);
      } else {
        setErrorMessage(res.error || "Failed to record payment.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Rapid Fee Collection Counter
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Instant counter collection for tuition, development levies, uniforms, and books with instant printable receipt.
          </p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Student Lookup & Fee Summary */}
        <div className="lg:col-span-5 space-y-5">
          {/* Search Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-500" />
              <span>Step 1: Student Lookup</span>
            </h3>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Admission No (e.g. RIV/NUR/2026/002 or ADA-0143) or Name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-3 pr-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Search</span>}
              </button>
            </form>

            {/* Results dropdown list */}
            {searchResults.length > 0 && !selectedStudent && (
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectStudent(s)}
                    className="w-full p-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {s.admissionNumber} &bull; {s.currentClass || "Unassigned"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        s.feeStatus === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {s.feeStatus}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Student Ledger Summary */}
          {selectedStudent ? (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md border border-indigo-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    Active Student Profile
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-slate-400 hover:text-white text-xs font-bold transition"
                >
                  Change
                </button>
              </div>

              <div>
                <h4 className="text-lg font-black text-white">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </h4>
                <div className="flex items-center gap-2 text-xs text-indigo-200 font-mono mt-0.5">
                  <span>{selectedStudent.admissionNumber}</span>
                  <span>&bull;</span>
                  <span>{selectedStudent.currentClass || "General Class"}</span>
                </div>
              </div>

              {/* Invoices Breakdown */}
              <div className="space-y-2 pt-2 border-t border-indigo-800/80">
                <p className="text-xs font-bold text-indigo-200">Pending Invoices:</p>
                {selectedStudent.invoices.length === 0 ? (
                  <p className="text-xs text-emerald-300 italic">No pending invoices found. You can create an ad-hoc collection.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {selectedStudent.invoices.map((inv) => {
                      const balance = Math.max(0, inv.amountDue - inv.amountPaid);
                      const isSelected = selectedInvoiceId === inv.id;

                      return (
                        <div
                          key={inv.id}
                          onClick={() => {
                            setSelectedInvoiceId(inv.id);
                            setAmount(balance.toString());
                            setNotes(inv.description);
                          }}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-400 text-white"
                              : "bg-white/10 border-white/10 text-slate-200 hover:bg-white/15"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold truncate">{inv.description}</p>
                            <p className="text-[10px] text-indigo-200">
                              Due: {new Date(inv.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold block">{formatNaira(balance)}</span>
                            <span className="text-[9px] uppercase font-bold opacity-80">{inv.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500 space-y-2">
              <Coins className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
              <p className="text-xs font-medium">
                Search and select a student above to inspect their fee ledger and allocate payments.
              </p>
            </div>
          )}
        </div>

        {/* Right Column (7 cols): Cashier Entry Form */}
        <div className="lg:col-span-7">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span>Step 2: Enter Payment Details</span>
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                Official Receipt Mode
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                  Payment Channel / Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["CASH", "POS", "TRANSFER", "CHEQUE"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                        method === m
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {m === "CASH" && <Banknote className="w-3.5 h-3.5" />}
                      {m === "POS" && <CreditCard className="w-3.5 h-3.5" />}
                      {m === "TRANSFER" && <Building2 className="w-3.5 h-3.5" />}
                      {m === "CHEQUE" && <FileText className="w-3.5 h-3.5" />}
                      <span>{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount to Pay */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Amount Received (NGN ₦) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400">
                    ₦
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full h-11 pl-8 pr-3 text-base font-black rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                    Amount in words: {numberToWords(parseFloat(amount))}
                  </p>
                )}
              </div>

              {/* Teller / Reference / POS Slip Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Reference Code / Teller No / POS RRN (Optional)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. POS-STANBIC-98124 or Teller #3401"
                  className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Payment Notes / Narration */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Payment Purpose / Narration
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 1st Term Tuition & Bus Fee"
                  className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedStudent || !amount}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Recording & Generating Official Receipt...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Confirm & Issue Official Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 6. PRINTABLE OFFICIAL RECEIPT MODAL */}
      {issuedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-300 p-6 sm:p-8 relative space-y-6 animate-in zoom-in-95 duration-200 print:p-0 print:border-none print:shadow-none">
            {/* Header with Close */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Official Bursary Receipt</h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Receipt No: {issuedReceipt.receiptNumber}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIssuedReceipt(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 print:hidden transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Printable Voucher Card */}
            <div className="border-2 border-slate-800 p-6 rounded-2xl space-y-5 bg-amber-50/20 relative overflow-hidden">
              {/* Watermark Background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none text-slate-900 text-6xl font-black uppercase rotate-12">
                Official Receipt
              </div>

              {/* Institution Header */}
              <div className="text-center space-y-1 border-b pb-3">
                <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {issuedReceipt.schoolName}
                </h2>
                <p className="text-xs font-semibold text-slate-600">
                  BURSARY & TREASURY DEPARTMENT &bull; PAYMENT ACKNOWLEDGEMENT
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Date: {new Date(issuedReceipt.paidAt).toLocaleDateString()} &bull; Time:{" "}
                  {new Date(issuedReceipt.paidAt).toLocaleTimeString()}
                </p>
              </div>

              {/* Student & Payment Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Received From</span>
                  <strong className="text-sm font-extrabold text-slate-900 block">
                    {issuedReceipt.studentName}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Admission Number</span>
                  <strong className="text-sm font-mono font-bold text-slate-900 block">
                    {issuedReceipt.admissionNumber}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Class / Grade</span>
                  <span className="font-semibold text-slate-800">{issuedReceipt.currentClass}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Payment Channel</span>
                  <span className="font-extrabold text-indigo-700 uppercase">{issuedReceipt.method}</span>
                </div>
              </div>

              {/* Amount Box */}
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-center space-y-1">
                <span className="text-xs uppercase font-bold text-slate-500 block">Amount Paid</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-950 block font-mono">
                  {formatNaira(issuedReceipt.amount)}
                </span>
                <p className="text-xs font-semibold text-indigo-900 italic pt-1">
                  &ldquo;{numberToWords(issuedReceipt.amount)}&rdquo;
                </p>
              </div>

              {/* Signatures & Stamp Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-300 text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Authorized Bursar</p>
                  <p className="font-bold text-slate-900">{issuedReceipt.bursarName}</p>
                </div>

                <div className="text-center p-2 rounded-xl border-2 border-dashed border-emerald-600/60 bg-emerald-50 text-emerald-800 font-mono text-[10px] font-bold">
                  <div>VERIFIED &amp; POSTED</div>
                  <div className="text-[8px] text-emerald-600">SCHOOL BURSAR STAMP</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setIssuedReceipt(null)}
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
