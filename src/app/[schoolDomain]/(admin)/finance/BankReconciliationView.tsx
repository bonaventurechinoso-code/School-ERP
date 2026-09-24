"use client";

import React, { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { Transaction, Invoice, Student } from "@prisma/client";
import { formatNaira } from "./FinanceDashboard";
import { createBankDepositAction, matchDepositToInvoiceAction } from "./actions";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlusCircle,
  Search,
  ArrowRight,
  Filter,
  Layers,
  Sparkles,
  X,
  FileCheck,
  CreditCard,
  TrendingUp,
  Receipt,
  RotateCw,
} from "lucide-react";

interface BankReconciliationProps {
  schoolId: string;
  transactions: Transaction[];
  invoices: (Invoice & {
    student: Student & { currentClass?: string | null };
    payments?: any[];
  })[];
}

const NIGERIAN_BANKS = [
  "Zenith Bank",
  "Guaranty Trust Bank (GTBank)",
  "Access Bank",
  "First Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Stanbic IBTC Bank",
  "Fidelity Bank",
  "Sterling Bank",
  "Union Bank",
  "Ecobank Nigeria",
  "Wema Bank / ALAT",
  "Monnify Virtual Account",
  "NIP Direct Bank Transfer",
  "Remita Direct Debit",
  "Raenest",
];

export default function BankReconciliationView({
  schoolId,
  transactions,
  invoices,
}: BankReconciliationProps) {
  const [isPending, startTransition] = useTransition();

  // Filter State
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNALLOCATED" | "RECONCILED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [bankFilter, setBankFilter] = useState<string>("ALL");

  // Modal States
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState<Transaction | null>(null);

  // Deposit Form State
  const [depositForm, setDepositForm] = useState({
    bankName: "Zenith Bank",
    accountNumber: "1012345678",
    depositorName: "",
    tellerOrRef: "",
    amount: 0,
    depositDate: new Date().toISOString().split("T")[0],
    notes: "",
    selectedInvoiceId: "",
  });

  // Match Modal Form State
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Searchable bank dropdown for the deposit modal
  const [bankDepositSearch, setBankDepositSearch] = useState("");
  const [bankDepositDropdownOpen, setBankDepositDropdownOpen] = useState(false);
  const bankDepositDropdownRef = useRef<HTMLDivElement>(null);

  const filteredDepositBanks = NIGERIAN_BANKS.filter((b) =>
    b.toLowerCase().includes(bankDepositSearch.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankDepositDropdownRef.current && !bankDepositDropdownRef.current.contains(e.target as Node)) {
        setBankDepositDropdownOpen(false);
        setBankDepositSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Helper to determine if transaction is reconciled
  const isReconciled = (t: Transaction) => {
    return Boolean(
      (t.referenceId && t.referenceId.includes("INV:")) ||
      t.description.includes("[RECONCILED") ||
      t.category === "TUITION"
    );
  };

  // Filter bank deposit / tuition transactions
  const bankTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.category === "BANK_DEPOSIT" || t.category === "TUITION" || t.type === "INCOME"
    );
  }, [transactions]);

  // Filtered transactions for the view
  const filteredDeposits = useMemo(() => {
    return bankTransactions.filter((t) => {
      const reconciled = isReconciled(t);

      if (statusFilter === "UNALLOCATED" && reconciled) return false;
      if (statusFilter === "RECONCILED" && !reconciled) return false;

      if (bankFilter !== "ALL") {
        if (!t.description.toLowerCase().includes(bankFilter.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = t.description.toLowerCase();
        const ref = (t.referenceId || "").toLowerCase();
        return desc.includes(q) || ref.includes(q);
      }

      return true;
    });
  }, [bankTransactions, statusFilter, bankFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalInflow = 0;
    let reconciledAmount = 0;
    let unallocatedAmount = 0;
    let unallocatedCount = 0;

    bankTransactions.forEach((t) => {
      totalInflow += t.amount;
      if (isReconciled(t)) {
        reconciledAmount += t.amount;
      } else {
        unallocatedAmount += t.amount;
        unallocatedCount += 1;
      }
    });

    const rate = totalInflow > 0 ? Math.round((reconciledAmount / totalInflow) * 100) : 100;

    return {
      totalInflow,
      reconciledAmount,
      unallocatedAmount,
      unallocatedCount,
      rate,
    };
  }, [bankTransactions]);

  // Unpaid invoices available for allocation
  const pendingInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === "PENDING" || inv.status === "PARTIAL");
  }, [invoices]);

  // Invoices for selected student in Match modal
  const studentPendingInvoices = useMemo(() => {
    if (!selectedStudentId) return [];
    return pendingInvoices.filter((inv) => inv.studentId === selectedStudentId);
  }, [pendingInvoices, selectedStudentId]);

  // Unique students with pending invoices
  const studentsWithPendingInvoices = useMemo(() => {
    const map = new Map<string, { id: string; name: string; currentClass?: string | null; count: number }>();
    pendingInvoices.forEach((inv) => {
      if (!map.has(inv.studentId)) {
        map.set(inv.studentId, {
          id: inv.studentId,
          name: `${inv.student.firstName} ${inv.student.lastName}`,
          currentClass: inv.student.currentClass,
          count: 1,
        });
      } else {
        const entry = map.get(inv.studentId)!;
        entry.count += 1;
      }
    });
    return Array.from(map.values());
  }, [pendingInvoices]);

  // Handle logging new deposit
  const handleCreateDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      let matchedStudentId: string | undefined = undefined;
      if (depositForm.selectedInvoiceId) {
        const inv = invoices.find((i) => i.id === depositForm.selectedInvoiceId);
        matchedStudentId = inv?.studentId;
      }

      const res = await createBankDepositAction(schoolId, {
        bankName: depositForm.bankName,
        accountNumber: depositForm.accountNumber,
        depositorName: depositForm.depositorName,
        tellerOrRef: depositForm.tellerOrRef,
        amount: Number(depositForm.amount),
        depositDate: depositForm.depositDate,
        notes: depositForm.notes,
        invoiceId: depositForm.selectedInvoiceId || undefined,
        studentId: matchedStudentId,
      });

      if (res.success) {
        setShowDepositModal(false);
        setDepositForm({
          bankName: "Zenith Bank",
          accountNumber: "1012345678",
          depositorName: "",
          tellerOrRef: "",
          amount: 0,
          depositDate: new Date().toISOString().split("T")[0],
          notes: "",
          selectedInvoiceId: "",
        });
        setFeedback({
          type: "success",
          message: `Bank deposit of ${formatNaira(depositForm.amount)} logged successfully!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to log bank deposit.",
        });
      }
    });
  };

  // Handle matching deposit to invoice
  const handleMatchDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMatchModal || !selectedInvoiceId || !selectedStudentId) return;

    setFeedback(null);
    startTransition(async () => {
      const res = await matchDepositToInvoiceAction(schoolId, {
        transactionId: showMatchModal.id,
        invoiceId: selectedInvoiceId,
        studentId: selectedStudentId,
        allocatedAmount: showMatchModal.amount,
      });

      if (res.success) {
        setShowMatchModal(null);
        setSelectedStudentId("");
        setSelectedInvoiceId("");
        setFeedback({
          type: "success",
          message: `Deposit of ${formatNaira(showMatchModal.amount)} reconciled with Invoice #${selectedInvoiceId.slice(0, 8).toUpperCase()}!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to reconcile deposit.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
            <Building2 className="w-4 h-4" />
            <span>Bursary & Electronic Clearing Hub</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Bank Reconciliation & Deposit Allocation
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Match bank electronic transfers (NIP), teller lodgements, and POS transactions directly with unpaid student tuition invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDepositModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-sm hover:shadow transition cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Log Bank Deposit / Teller</span>
        </button>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-300 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Reconciliation Cockpit Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        {/* Total Inflow */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Total Bank Deposits</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatNaira(metrics.totalInflow)}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {bankTransactions.length} recorded banking transactions
          </span>
        </div>

        {/* Reconciled Collections */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm border-t-4 border-t-emerald-500">
          <div className="flex items-center justify-between text-xs text-emerald-600 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Reconciled Collections</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatNaira(metrics.reconciledAmount)}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium block mt-1">
            {metrics.rate}% of bank deposits matched
          </span>
        </div>

        {/* Unallocated Deposits */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm border-t-4 border-t-amber-500">
          <div className="flex items-center justify-between text-xs text-amber-600 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Unallocated Deposits</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatNaira(metrics.unallocatedAmount)}
          </div>
          <span className="text-[10px] text-amber-600 font-semibold block mt-1">
            {metrics.unallocatedCount} deposit(s) awaiting student allocation
          </span>
        </div>

        {/* Reconciliation Rate */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-indigo-600 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Audit Match Rate</span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {metrics.rate}%
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Institutional clearance velocity
          </span>
        </div>

      </div>

      {/* 3. Filters & Search Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search depositor, teller #, bank..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
              }`}
            >
              All Deposits
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("UNALLOCATED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === "UNALLOCATED"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              Unallocated ({metrics.unallocatedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("RECONCILED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === "RECONCILED"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              Reconciled
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 shrink-0 font-medium">
          Showing {filteredDeposits.length} deposit records
        </div>
      </div>

      {/* 4. Bank Deposits Register Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Banking Institution & Details</th>
                <th className="px-5 py-3.5">Payer / Depositor Name</th>
                <th className="px-5 py-3.5">Teller / NIP Reference</th>
                <th className="px-5 py-3.5">Deposit Date</th>
                <th className="px-5 py-3.5 text-right">Amount (₦)</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No bank deposits found matching active filters.
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((deposit) => {
                  const reconciled = isReconciled(deposit);
                  return (
                    <tr key={deposit.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                      
                      {/* Bank Details */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {deposit.description.split("]")[0].replace("[", "") || "Commercial Bank"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {deposit.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Depositor Name */}
                      <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                        {deposit.description.includes("Depositor:")
                          ? deposit.description.split("Depositor:")[1]?.split("-")[0]?.trim()
                          : "Direct Transfer"}
                      </td>

                      {/* Teller / Reference */}
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {deposit.referenceId?.split("|")[0] || "NIP-DIRECT"}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(deposit.createdAt).toLocaleDateString("en-NG", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 text-right font-black text-slate-900 dark:text-white font-mono text-sm">
                        {formatNaira(deposit.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        {reconciled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Reconciled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Unallocated</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        {reconciled ? (
                          <span className="text-[11px] text-slate-400 font-semibold">
                            Cleared
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMatchModal(deposit);
                              setSelectedStudentId("");
                              setSelectedInvoiceId("");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white font-bold text-xs transition cursor-pointer"
                          >
                            <span>Match & Allocate</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. MODAL: LOG NEW BANK DEPOSIT / TELLER                   */}
      {/* ========================================================= */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Log Inward Bank Deposit / Teller
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDeposit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Searchable Bank Institution Dropdown */}
                <div ref={bankDepositDropdownRef}>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bank Institution
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setBankDepositDropdownOpen((o) => !o); setBankDepositSearch(""); }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between text-xs"
                    >
                      <span>{depositForm.bankName || "Select bank..."}</span>
                      <span className="text-slate-400 text-xs">&#9660;</span>
                    </button>

                    {bankDepositDropdownOpen && (
                      <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-slate-100 dark:border-zinc-700">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              autoFocus
                              type="text"
                              value={bankDepositSearch}
                              onChange={(e) => setBankDepositSearch(e.target.value)}
                              placeholder="Search bank name..."
                              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <ul className="max-h-48 overflow-y-auto">
                          {filteredDepositBanks.length === 0 ? (
                            <li className="px-3 py-3 text-xs text-slate-400 text-center">No banks found.</li>
                          ) : (
                            filteredDepositBanks.map((b) => (
                              <li
                                key={b}
                                onClick={() => {
                                  setDepositForm({ ...depositForm, bankName: b });
                                  setBankDepositDropdownOpen(false);
                                  setBankDepositSearch("");
                                }}
                                className={`px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/40 transition ${
                                  depositForm.bankName === b
                                    ? "bg-blue-50 dark:bg-blue-950/40 font-bold text-blue-700 dark:text-blue-300"
                                    : "text-slate-800 dark:text-zinc-200"
                                }`}
                              >
                                {b}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Number */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    School Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={depositForm.accountNumber}
                    onChange={(e) => setDepositForm({ ...depositForm, accountNumber: e.target.value })}
                    placeholder="e.g. 1029384756"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Depositor / Payer Name */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Depositor / Payer Name
                  </label>
                  <input
                    type="text"
                    required
                    value={depositForm.depositorName}
                    onChange={(e) => setDepositForm({ ...depositForm, depositorName: e.target.value })}
                    placeholder="e.g. Chief Emeka Okonkwo"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Teller / NIP Ref */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teller No / NIP Session ID
                  </label>
                  <input
                    type="text"
                    required
                    value={depositForm.tellerOrRef}
                    onChange={(e) => setDepositForm({ ...depositForm, tellerOrRef: e.target.value })}
                    placeholder="e.g. 9847291048 or NIP/2026/04"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Deposit Amount */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount Paid (₦)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={depositForm.amount || ""}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Date of Deposit */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date of Deposit
                  </label>
                  <input
                    type="date"
                    required
                    value={depositForm.depositDate}
                    onChange={(e) => setDepositForm({ ...depositForm, depositDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Optional Immediate Match to Student Invoice */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Immediate Allocation (Optional)
                </label>
                <select
                  value={depositForm.selectedInvoiceId}
                  onChange={(e) => setDepositForm({ ...depositForm, selectedInvoiceId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Leave as Unallocated (Reconcile Later)</option>
                  {pendingInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.student.firstName} {inv.student.lastName} ({inv.student.currentClass}) — {inv.description} (Due: {formatNaira(inv.amountDue)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Recording..." : "Save Bank Deposit"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL: MATCH UNALLOCATED DEPOSIT TO INVOICE            */}
      {/* ========================================================= */}
      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Reconcile & Allocate Deposit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMatchModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Deposit Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Deposit Amount:</span>
                <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                  {formatNaira(showMatchModal.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Bank Ref / Teller:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {showMatchModal.referenceId || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Description:</span>
                <span className="text-slate-700 dark:text-slate-300 text-right truncate max-w-[280px]">
                  {showMatchModal.description}
                </span>
              </div>
            </div>

            <form onSubmit={handleMatchDeposit} className="space-y-4 text-xs">
              
              {/* Step 1: Select Student */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Select Student with Outstanding Fees
                </label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value);
                    setSelectedInvoiceId("");
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Student...</option>
                  {studentsWithPendingInvoices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.currentClass || "Unassigned"}) — {s.count} outstanding bill(s)
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Invoice to allocate against */}
              {selectedStudentId && (
                <div className="animate-in fade-in duration-200">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    2. Select Target Invoice to Credit
                  </label>
                  {studentPendingInvoices.length === 0 ? (
                    <p className="text-slate-400 text-xs italic">No pending invoices for this student.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {studentPendingInvoices.map((inv) => (
                        <label
                          key={inv.id}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            selectedInvoiceId === inv.id
                              ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40"
                              : "border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="targetInvoice"
                              value={inv.id}
                              checked={selectedInvoiceId === inv.id}
                              onChange={() => setSelectedInvoiceId(inv.id)}
                              className="text-blue-600"
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {inv.description}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Due Date: {new Date(inv.dueDate).toLocaleDateString("en-NG")}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-black font-mono text-slate-900 dark:text-white">
                              {formatNaira(inv.amountDue)}
                            </span>
                            <span className="block text-[10px] font-bold text-amber-600">
                              {inv.status}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowMatchModal(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedInvoiceId || isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Reconciling..." : `Confirm & Allocate ${formatNaira(showMatchModal.amount)}`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
