"use client";

import React, { useState, useTransition } from "react";
import {
  Landmark,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Copy,
  Check,
  Building2,
  PlusCircle,
  CreditCard,
} from "lucide-react";
import { saveBankAccountAction } from "./actions";

export interface BankAccountItem {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string | null;
  createdAt?: string;
}

export default function BankAccountsClient({
  initialAccounts = [],
}: {
  initialAccounts: BankAccountItem[];
}) {
  const [accounts, setAccounts] = useState<BankAccountItem[]>(initialAccounts);
  const [formData, setFormData] = useState({
    id: initialAccounts[0]?.id || "global",
    bankName: initialAccounts[0]?.bankName || "Fidelity Bank",
    accountNumber: initialAccounts[0]?.accountNumber || "6560627850",
    accountName: initialAccounts[0]?.accountName || "BONAVEE ICT CONCEPTS",
    bankCode: initialAccounts[0]?.bankCode || "070",
  });
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSelectToEdit = (acc: BankAccountItem) => {
    setFormData({
      id: acc.id,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      accountName: acc.accountName,
      bankCode: acc.bankCode || "035",
    });
    setFeedback(null);
  };

  const handleResetForNew = () => {
    setFormData({
      id: `bank_${Date.now()}`,
      bankName: "",
      accountNumber: "",
      accountName: "",
      bankCode: "035",
    });
    setFeedback(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Pure manual client validation - ZERO zod on client
    const cleanBankName = (formData.bankName || "").trim();
    const cleanAccNum = (formData.accountNumber || "").trim().replace(/\D/g, "");
    const cleanAccName = (formData.accountName || "").trim();
    const cleanBankCode = (formData.bankCode || "").trim();

    if (cleanBankName.length < 2) {
      setFeedback({
        type: "error",
        message: "Bank name must be at least 2 characters.",
      });
      return;
    }

    if (!/^\d{10}$/.test(cleanAccNum)) {
      setFeedback({
        type: "error",
        message: "Account number must be exactly 10 numeric digits (e.g., 4058065110).",
      });
      return;
    }

    if (cleanAccName.length < 2) {
      setFeedback({
        type: "error",
        message: "Account name is required (min 2 characters).",
      });
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          id: formData.id || "global",
          bankName: cleanBankName,
          accountNumber: cleanAccNum,
          accountName: cleanAccName,
          bankCode: cleanBankCode || "035",
        };

        const res = await saveBankAccountAction(payload);
        if (res.success) {
          setAccounts((prev) => {
            const exists = prev.some((a) => a.id === payload.id);
            if (exists) {
              return prev.map((a) => (a.id === payload.id ? { ...a, ...payload } : a));
            }
            return [{ ...payload, createdAt: new Date().toISOString() }, ...prev];
          });
          setFeedback({
            type: "success",
            message: `Bank account (${cleanAccNum} - ${cleanBankName}) saved successfully!`,
          });
        } else {
          setFeedback({
            type: "error",
            message: res.error || "Failed to update configuration.",
          });
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || "An unexpected network or server error occurred.",
        });
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Platform Treasury
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Super Admin Finance Desk
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Bank Account Configurations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Configure designated official corporate bank accounts for tenant SaaS subscription transfers and renewal settlements
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetForNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold transition self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Add New Account
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid: Existing Accounts List + Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Existing Bank Accounts */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-500" />
              Existing Accounts ({accounts.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Click to edit
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-400">
              No bank accounts configured yet.
            </div>
          ) : (
            accounts.map((acc, index) => {
              const isSelected = formData.id === acc.id;
              const isCopied = copiedId === acc.id;

              return (
                <div
                  key={acc.id}
                  onClick={() => handleSelectToEdit(acc)}
                  className={`cursor-pointer rounded-3xl p-5 sm:p-6 transition-all duration-200 shadow-md border relative overflow-hidden ${
                    isSelected
                      ? "bg-gradient-to-br from-indigo-900 via-slate-900 to-zinc-950 text-white border-indigo-400 ring-2 ring-indigo-500/30"
                      : "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                          isSelected
                            ? "bg-white/10 text-white"
                            : "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-xs font-black ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>
                          {acc.bankName}
                        </p>
                        <p className={`text-[10px] ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                          Bank Code: {acc.bankCode || "035"}
                        </p>
                      </div>
                    </div>

                    {index === 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        PRIMARY
                      </span>
                    )}
                  </div>

                  <div className="py-3">
                    <div className="flex items-center justify-between">
                      <p className={`font-mono text-xl sm:text-2xl font-black tracking-widest ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>
                        {acc.accountNumber}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(acc.id, acc.accountNumber);
                        }}
                        className={`p-1.5 rounded-lg transition active:scale-95 ${
                          isSelected
                            ? "bg-white/10 hover:bg-white/20 text-white"
                            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200"
                        }`}
                        title="Copy account number"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <p className={`text-xs uppercase font-bold tracking-wide mt-1 truncate ${isSelected ? "text-slate-200" : "text-slate-600 dark:text-zinc-400"}`}>
                      {acc.accountName}
                    </p>
                  </div>

                  <div className={`pt-2 border-t text-[10px] flex items-center justify-between ${isSelected ? "border-white/10 text-indigo-300" : "border-slate-100 dark:border-zinc-800 text-slate-400"}`}>
                    <span>ID: {acc.id}</span>
                    <span>{isSelected ? "Currently Editing" : "Click to Edit"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Account Configuration Form */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm p-6 sm:p-7 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {formData.id === "global" ? "Corporate Settlement Account" : "Bank Account Parameters"}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Updates reflect instantly on tenant billing screens without requiring page reloads
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  placeholder="e.g. Wema Bank"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Account Number (NUBAN — Exactly 10 Digits)
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={formData.accountNumber}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setFormData({ ...formData, accountNumber: clean });
                  }}
                  placeholder="4058065110"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Must be exactly 10 digits (e.g. Wema Bank 4058065110)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Beneficiary Account Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  placeholder="e.g. BONAVEE ICT CONCEPTS"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Bank Code (Optional, e.g. 035 for Wema)
                </label>
                <input
                  type="text"
                  value={formData.bankCode}
                  onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                  placeholder="035"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isPending ? "Saving Bank Account..." : "Save Bank Account Configuration"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
