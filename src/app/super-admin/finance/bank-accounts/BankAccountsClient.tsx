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
  CreditCard,
  Sparkles,
} from "lucide-react";
import { updateGlobalBankAccountAction, z } from "./actions";

const BankAccountSchema = z.object({
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  accountName: z.string().min(2, "Account name must be at least 2 characters"),
  bankCode: z.string().optional(),
});

interface BankConfig {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string | null;
}

export default function BankAccountsClient({ initialConfig }: { initialConfig: BankConfig }) {
  const [formData, setFormData] = useState<BankConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const validation = BankAccountSchema.safeParse(formData);
    if (!validation.success) {
      setFeedback({
        type: "error",
        message: validation.error.issues[0]?.message || "Invalid bank account details",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateGlobalBankAccountAction(formData);
        if (res.success) {
          setFeedback({
            type: "success",
            message: "Global platform bank account configuration saved successfully!",
          });
        } else {
          setFeedback({
            type: "error",
            message: res.error || "Failed to update configuration",
          });
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err.message || "An unexpected error occurred",
        });
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Global Settings
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Platform Treasury
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
          Corporate Bank Account Configs
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Designate the centralized receiving account for all tenant SaaS subscription transfers and renewal settlements
        </p>
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

      {/* Grid: Preview Card + Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Preview Card */}
        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-zinc-950 text-white p-6 sm:p-7 shadow-xl border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-bold">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">
                  Platform Treasury
                </p>
                <p className="text-sm font-black text-white">{formData.bankName || "Bank Name"}</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ACTIVE
            </span>
          </div>

          <div className="py-6 space-y-4">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Account Number (NUBAN)
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-white">
                  {formData.accountNumber || "0000000000"}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(formData.accountNumber)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
                  title="Copy Account Number"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Account Holder Name
              </p>
              <p className="text-sm font-bold text-slate-100 uppercase tracking-wide mt-0.5">
                {formData.accountName || "Corporate Account"}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Global Subscription Clearing</span>
            <span className="font-mono text-[10px] text-indigo-300">ID: global</span>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm p-6 sm:p-7 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Corporate Bank Account Parameters
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Modifications reflect globally across all tenant subscription payment interfaces
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
                  placeholder="e.g. Wema Bank, Zenith Bank, GTBank"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Account Number (10 Digits)
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  pattern="\d{10}"
                  value={formData.accountNumber}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setFormData({ ...formData, accountNumber: clean });
                  }}
                  placeholder="0123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must be exactly 10 numeric digits</p>
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
                  placeholder="e.g. BonaVee ICT Corporate"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Bank Code (Optional)
                </label>
                <input
                  type="text"
                  value={formData.bankCode || ""}
                  onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                  placeholder="e.g. 035"
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
                {isPending ? "Saving Configurations..." : "Save Corporate Account Config"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

