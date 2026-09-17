"use client";

import React, { useState, useMemo, useTransition } from "react";
import { Transaction } from "@prisma/client";
import { createTransaction } from "./actions";
import { formatNaira } from "./FinanceDashboard";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Layers
} from "lucide-react";

const EXPENSE_CATEGORIES = [
  "MAINTENANCE",
  "UTILITIES",
  "SUPPLIES",
  "FACILITY",
  "TECHNOLOGY",
  "SECURITY",
  "SPORTS",
  "TRANSPORTATION",
  "PAYROLL",
  "MISCELLANEOUS",
];

const INCOME_CATEGORIES = [
  "TUITION",
  "DONATION",
  "GRANT",
  "EXAM_FEES",
  "UNIFORMS",
  "BOOKS",
  "TOP_UP",
  "MISCELLANEOUS",
];

export default function LedgerTable({ 
  transactions,
  schoolId 
}: { 
  transactions: Transaction[];
  schoolId?: string;
}) {
  const [isPending, startTransition] = useTransition();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Record Transaction Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    category: "MAINTENANCE",
    amount: 0,
    description: "",
    referenceId: "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Extract distinct categories from existing transactions
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      // Type filter
      if (typeFilter !== "ALL" && txn.type !== typeFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== "ALL" && txn.category !== categoryFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const desc = txn.description.toLowerCase();
        const cat = (txn.category || "").toLowerCase();
        return desc.includes(q) || cat.includes(q);
      }
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, searchQuery]);

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionAlert(null);

    if (!schoolId) {
      setErrorMsg("School identifier missing.");
      return;
    }

    startTransition(async () => {
      const res = await createTransaction(schoolId, {
        type: formData.type,
        category: formData.category,
        amount: formData.amount,
        description: formData.description,
        referenceId: formData.referenceId || undefined,
      });

      if (res.success) {
        setShowModal(false);
        setFormData({
          type: "EXPENSE",
          category: "MAINTENANCE",
          amount: 0,
          description: "",
          referenceId: "",
        });
        setActionAlert({ 
          type: "success", 
          text: `Successfully logged ${formData.type} transaction of ${formatNaira(formData.amount)} to the General Ledger!` 
        });
      } else {
        setErrorMsg(res.error || "Failed to record transaction.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Alert Banner */}
      {actionAlert && (
        <div className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between animate-in fade-in duration-300 ${
          actionAlert.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800" 
            : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2.5">
            {actionAlert.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{actionAlert.text}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Toolbar: Search, Filters & Record Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, reference, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
          {/* Type Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTypeFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                typeFilter === "ALL"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter("INCOME")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                typeFilter === "INCOME"
                  ? "bg-emerald-500 text-white shadow-2xs font-bold"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setTypeFilter("EXPENSE")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                typeFilter === "EXPENSE"
                  ? "bg-rose-500 text-white shadow-2xs font-bold"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
              }`}
            >
              Expenses
            </button>
          </div>

          {/* Category Filter */}
          {availableCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {/* Record Expense Button */}
          {schoolId && (
            <button
              onClick={() => {
                setShowModal(true);
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Transaction</span>
            </button>
          )}
        </div>
      </div>

      {/* Record Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Ledger Transaction</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Log operational expenditure or general institutional income.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordTransaction} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Transaction Type Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Transaction Nature
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "EXPENSE", category: "MAINTENANCE" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      formData.type === "EXPENSE"
                        ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300"
                        : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    <span>Expense (Outflow)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "INCOME", category: "DONATION" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      formData.type === "INCOME"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300"
                        : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Income (Inflow)</span>
                  </button>
                </div>
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                  >
                    {(formData.type === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Amount (₦)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 45000"
                    value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Description / Purpose
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Generator diesel 100L purchase & servicing"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                />
              </div>

              {/* Reference / Invoice Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Reference / Receipt ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VOUCHER-2026-089"
                  value={formData.referenceId}
                  onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-mono"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-zinc-400 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isPending}
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Logging Entry..." : "Post to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Ledger Records Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Audit Records</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {filteredTransactions.length} of {transactions.length}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium hidden sm:inline">
            Double-entry general institutional ledger
          </div>
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <div className="p-8 sm:p-12 text-center">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">No Matching Transactions</h3>
            <p className="text-slate-500 dark:text-zinc-400 mt-1 text-xs sm:text-sm">
              {transactions.length === 0 ? "Any tuition payments, operational expenses, and top-ups will automatically register here." : "No transactions match your current search or category filter."}
            </p>
          </div>
        )}

        {/* DESKTOP TABLE VIEW (md+) */}
        {filteredTransactions.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-300 whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4 font-semibold">Date & Time</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold">Description</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredTransactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="p-4">
                      <div className="text-slate-900 dark:text-white font-medium">{new Date(txn.createdAt).toLocaleDateString("en-NG")}</div>
                      <div className="text-xs text-slate-400 dark:text-zinc-500 font-mono">{new Date(txn.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                        txn.type === 'INCOME' 
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                      }`}>
                        {txn.type === 'INCOME' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {txn.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md text-xs font-medium border border-slate-200 dark:border-zinc-700">
                        {txn.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-800 dark:text-zinc-200">
                      <div className="max-w-[320px] truncate" title={txn.description}>{txn.description}</div>
                      {txn.referenceId && (
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {txn.referenceId}</div>
                      )}
                    </td>
                    <td className={`p-4 font-bold text-right font-mono text-sm ${txn.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-zinc-100'}`}>
                      {txn.type === 'INCOME' ? '+' : '-'}{formatNaira(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MOBILE CARDS VIEW (< md) - Zero Features Dropped */}
        {filteredTransactions.length > 0 && (
          <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredTransactions.map(txn => (
              <div key={txn.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm break-words">
                      {txn.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        {new Date(txn.createdAt).toLocaleDateString("en-NG")} {new Date(txn.createdAt).toLocaleTimeString("en-NG", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded text-[10px] font-semibold uppercase">
                        {txn.category}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-base font-bold font-mono block ${txn.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                      {txn.type === 'INCOME' ? '+' : '-'}{formatNaira(txn.amount)}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                      txn.type === 'INCOME' 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                    }`}>
                      {txn.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
