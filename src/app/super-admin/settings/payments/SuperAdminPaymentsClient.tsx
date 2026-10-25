"use client";

import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Save,
  Building2,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  X,
  Search,
  ShieldCheck,
  Layers,
  Calendar,
  Clock,
  Landmark,
  Check,
} from "lucide-react";

export interface SubscriptionSettingItem {
  id?: string | null;
  moduleType: string;
  title: string;
  amount: number;
  currency: string;
  isEnabled: boolean;
  isActive: boolean;
  category: "SUBSCRIPTION";
  isPlatformFee: true;
  isPlatformOnly: true;
  description: string;
  customWriteup?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
}

interface SuperAdminPaymentsClientProps {
  initialPlans: SubscriptionSettingItem[];
}

export default function SuperAdminPaymentsClient({
  initialPlans,
}: SuperAdminPaymentsClientProps) {
  const [plans, setPlans] = useState<SubscriptionSettingItem[]>(initialPlans);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleFieldChange = (
    moduleType: string,
    field: keyof SubscriptionSettingItem,
    value: any
  ) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.moduleType === moduleType ? { ...plan, [field]: value } : plan
      )
    );
  };

  const handleSave = async (plan: SubscriptionSettingItem) => {
    setSavingModule(plan.moduleType);
    setToastMsg(null);

    try {
      const res = await fetch("/api/v1/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "super-admin",
          schoolId: "super-admin",
          moduleType: plan.moduleType,
          isEnabled: plan.isEnabled,
          isActive: plan.isActive,
          title: plan.title,
          amount: Number(plan.amount) || 0,
          currency: plan.currency || "NGN",
          customWriteup: plan.customWriteup || null,
          accountName: plan.accountName || null,
          accountNumber: plan.accountNumber || null,
          bankName: plan.bankName || null,
          updatedBy: "Super Admin",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMsg({
          type: "success",
          text: `Subscription plan "${plan.title}" saved successfully!`,
        });
      } else {
        setToastMsg({
          type: "error",
          text: data.error || "Failed to save subscription plan settings",
        });
      }
    } catch (err: any) {
      setToastMsg({
        type: "error",
        text: err?.message || "Network error saving subscription plan",
      });
    } finally {
      setSavingModule(null);
    }
  };

  // Filter plans by search term (only subscription plans exist)
  const filteredPlans = plans.filter((plan) => {
    const s = searchTerm.toLowerCase();
    return (
      plan.title.toLowerCase().includes(s) ||
      plan.description.toLowerCase().includes(s) ||
      plan.moduleType.toLowerCase().includes(s)
    );
  });

  // 4. Counts: Fix counters — count ONLY subscription plans, not school fees
  const activePlansCount = plans.filter((p) => p.isEnabled).length;
  const inactivePlansCount = plans.filter((p) => !p.isEnabled).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="alert"
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold transition shadow-lg ${
            toastMsg.type === "success"
              ? "bg-emerald-600 text-white shadow-emerald-500/20"
              : "bg-rose-600 text-white shadow-rose-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Banner: Platform Subscription Management */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PLATFORM CORE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SUBSCRIPTION ONLY
              </span>
            </div>
            {/* 2. UI: Change title to Platform Subscription Management */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Platform Subscription Management
            </h1>
            {/* 2. UI: Subtitle */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Configure SaaS subscription plans. Schools manage their own fees independently.
            </p>
          </div>

          {/* 4. Quick Metrics Counters: Count ONLY subscription plans */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center min-w-[120px]">
              <span className="block text-2xl font-black text-emerald-400">
                {activePlansCount}
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Active Plans
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center min-w-[120px]">
              <span className="block text-2xl font-black text-slate-300">
                {inactivePlansCount}
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Free / Inactive
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar (No ACADEMICS, ADMISSIONS, FEES, SERVICES tabs - SUBSCRIPTION ONLY) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search subscription plans..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 px-3 py-1.5 rounded-xl">
            Active Module: SUBSCRIPTION
          </span>
          <span className="text-xs text-slate-400">
            {filteredPlans.length} {filteredPlans.length === 1 ? "plan" : "plans"} configured
          </span>
        </div>
      </div>

      {/* Subscription Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => {
          const isSaving = savingModule === plan.moduleType;

          return (
            <div
              key={plan.moduleType}
              className={`flex flex-col justify-between rounded-3xl border transition-all duration-200 p-6 space-y-6 shadow-sm ${
                plan.isEnabled
                  ? "bg-white dark:bg-zinc-900 border-indigo-200/80 dark:border-indigo-950/80 shadow-indigo-500/5 ring-1 ring-indigo-500/10"
                  : "bg-slate-50/60 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800 opacity-80"
              }`}
            >
              {/* Header & Toggle */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        SaaS Plan
                      </span>
                      {plan.isEnabled && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {plan.title}
                    </h3>
                  </div>

                  {/* Activation Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      handleFieldChange(plan.moduleType, "isEnabled", !plan.isEnabled)
                    }
                    className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition cursor-pointer"
                    title={plan.isEnabled ? "Disable Plan" : "Enable Plan"}
                  >
                    {plan.isEnabled ? (
                      <ToggleRight className="w-8 h-8 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  {plan.description}
                </p>
              </div>

              {/* Price & Currency Form */}
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Plan Fee (Price)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">
                      {plan.currency === "NGN" ? "₦" : "$"}
                    </span>
                    <input
                      type="number"
                      value={plan.amount}
                      onChange={(e) =>
                        handleFieldChange(
                          plan.moduleType,
                          "amount",
                          Number(e.target.value) || 0
                        )
                      }
                      className="w-full pl-8 pr-20 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                    />
                    <select
                      value={plan.currency}
                      onChange={(e) =>
                        handleFieldChange(plan.moduleType, "currency", e.target.value)
                      }
                      className="absolute right-2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 border-none outline-none cursor-pointer"
                    >
                      <option value="NGN">NGN (₦)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                {/* Platform Bank Settlement Account Info */}
                <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                    <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Settlement Destination</span>
                  </div>

                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={plan.bankName || ""}
                      onChange={(e) =>
                        handleFieldChange(plan.moduleType, "bankName", e.target.value)
                      }
                      placeholder="Bank Name (e.g. Wema Bank)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={plan.accountNumber || ""}
                      onChange={(e) =>
                        handleFieldChange(plan.moduleType, "accountNumber", e.target.value)
                      }
                      placeholder="Account Number (10 digits)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={plan.accountName || ""}
                      onChange={(e) =>
                        handleFieldChange(plan.moduleType, "accountName", e.target.value)
                      }
                      placeholder="Account Name (e.g. SchoolERP Central)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Custom Writeup / Terms */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Subscription Terms & Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={plan.customWriteup || ""}
                    onChange={(e) =>
                      handleFieldChange(plan.moduleType, "customWriteup", e.target.value)
                    }
                    placeholder="Instructions visible to subscribing institution admins..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              {/* Action Save Button */}
              <button
                type="button"
                onClick={() => handleSave(plan)}
                disabled={isSaving}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Saving Plan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Plan Settings</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
