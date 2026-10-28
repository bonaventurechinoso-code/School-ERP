"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  Building2,
  DollarSign,
  FileText,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  Sparkles,
  X,
  Search,
  Filter,
} from "lucide-react";
import PaymentReceiptUpload from "./PaymentReceiptUpload";

export interface PaymentSettingItem {
  id?: string | null;
  tenantId: string;
  schoolId?: string | null;
  moduleType: string;
  isEnabled: boolean;
  isActive: boolean;
  title: string;
  amount: number;
  currency: string;
  customWriteup?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  category: "ADMISSIONS" | "ACADEMICS" | "FEES" | "SERVICES" | "SUBSCRIPTION";
  description: string;
  isCustomized?: boolean;
}

interface PaymentSettingsManagerProps {
  tenantId?: string;
  schoolName?: string;
  isSuperAdmin?: boolean;
}

export default function PaymentSettingsManager({
  tenantId = "super-admin",
  schoolName,
  isSuperAdmin = false,
}: PaymentSettingsManagerProps) {
  const [settings, setSettings] = useState<PaymentSettingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preview Modal state
  const [previewSetting, setPreviewSetting] = useState<PaymentSettingItem | null>(null);

  // Tenant Enterprise Settlement & Gateway Settings (/api/v1/tenant/settings/payments)
  const [tenantGovernance, setTenantGovernance] = useState<any | null>(null);
  const [savingGovernance, setSavingGovernance] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const [res, govRes] = await Promise.all([
        fetch(`/api/v1/payments/settings?tenantId=${encodeURIComponent(tenantId)}`),
        !isSuperAdmin && tenantId !== "super-admin"
          ? fetch(`/api/v1/tenant/settings/payments?tenant_id=${encodeURIComponent(tenantId)}`)
          : Promise.resolve(null),
      ]);
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
      if (govRes && govRes.ok) {
        const govData = await govRes.json();
        if (govData.success && govData.settings) {
          setTenantGovernance(govData.settings);
        }
      }
    } catch (err: any) {
      setToastMsg({ type: "error", text: "Failed to load payment settings" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTenantGovernance = async () => {
    if (!tenantGovernance) return;
    setSavingGovernance(true);
    setToastMsg(null);
    try {
      const res = await fetch("/api/v1/tenant/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          is_manual_transfer_enabled: tenantGovernance.is_manual_transfer_enabled,
          manual_transfer_instructions: tenantGovernance.manual_transfer_instructions,
          bank_accounts: tenantGovernance.bank_accounts || [],
          supported_online_gateways: tenantGovernance.supported_online_gateways || [],
          auto_expire_unverified_hours: Number(tenantGovernance.auto_expire_unverified_hours) || 72,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTenantGovernance(data.settings);
        setToastMsg({
          type: "success",
          text: "Institutional settlement accounts & payment governance saved!",
        });
      } else {
        setToastMsg({
          type: "error",
          text: data.error || "Failed to update tenant payment governance",
        });
      }
    } catch (err: any) {
      setToastMsg({
        type: "error",
        text: err.message || "Network error updating tenant payment settings",
      });
    } finally {
      setSavingGovernance(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [tenantId]);

  const handleFieldChange = (moduleType: string, field: keyof PaymentSettingItem, value: any) => {
    setSettings((prev) =>
      prev.map((item) =>
        item.moduleType === moduleType ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = async (item: PaymentSettingItem) => {
    setSavingModule(item.moduleType);
    setToastMsg(null);
    try {
      const res = await fetch("/api/v1/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          schoolId: item.schoolId || tenantId,
          moduleType: item.moduleType,
          isEnabled: item.isEnabled,
          isActive: item.isActive,
          title: item.title,
          amount: item.amount,
          currency: item.currency || "NGN",
          customWriteup: item.customWriteup || null,
          accountName: item.accountName || null,
          accountNumber: item.accountNumber || null,
          bankName: item.bankName || null,
          updatedBy: isSuperAdmin ? "Super Admin" : "School Admin",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMsg({
          type: "success",
          text: `Settings for "${item.title}" saved successfully!`,
        });
        setSettings((prev) =>
          prev.map((s) => (s.moduleType === item.moduleType ? { ...s, isCustomized: true } : s))
        );
      } else {
        setToastMsg({ type: "error", text: data.error || "Failed to save setting" });
      }
    } catch (err: any) {
      setToastMsg({ type: "error", text: err.message || "Network error saving setting" });
    } finally {
      setSavingModule(null);
    }
  };

  const isTenant = !isSuperAdmin;

  const visibleSettings = isTenant
    ? settings.filter(
        (s) =>
          s.moduleType !== "PLATFORM_SUBSCRIPTION" &&
          (s as any).type !== "PLATFORM_SUBSCRIPTION" &&
          s.moduleType !== "SUBSCRIPTION" &&
          (s as any).type !== "SUBSCRIPTION" &&
          s.category !== "SUBSCRIPTION"
      )
    : settings;

  const filteredSettings = visibleSettings.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.moduleType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const enabledCount = visibleSettings.filter((s) => s.isEnabled).length;
  const disabledCount = visibleSettings.filter((s) => !s.isEnabled).length;

  const categories = isSuperAdmin
    ? ["ALL", "ACADEMICS", "ADMISSIONS", "FEES", "SERVICES", "SUBSCRIPTION"]
    : ["ALL", "ACADEMICS", "ADMISSIONS", "FEES", "SERVICES"];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold transition shadow-lg ${
            toastMsg.type === "success"
              ? "bg-emerald-500 text-white shadow-emerald-500/20"
              : "bg-red-500 text-white shadow-red-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{toastMsg.text}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {isSuperAdmin
                ? "Platform Payment Activation Defaults"
                : `${schoolName || "Institution"} Payment & Fee Activations`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {isSuperAdmin
                ? "Configure platform-wide default fee settings. Individual schools retain 100% autonomy to activate or deactivate fees for their own portals."
                : "Decide which fees your institution charges. When disabled, access to results, report cards, and transcripts is 100% free with zero blocking."}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center min-w-[110px]">
              <span className="block text-2xl font-black text-emerald-400">{enabledCount}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Active Fees
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center min-w-[110px]">
              <span className="block text-2xl font-black text-slate-300">{disabledCount}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Free / Disabled
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Yellow Warning Banner when Prod DB tables are not migrated */}
      {(tenantGovernance?.id === "fallback" || tenantGovernance?.is_fallback) && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2.5 shadow-sm"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Prod DB tables not migrated — showing fallback config. Run npx prisma migrate deploy on Render shell.
          </span>
        </div>
      )}

      {/* Tenant Enterprise Settlement & Gateway Governance Card */}
      {isTenant && tenantGovernance && (
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Non-Custodial Settlement Accounts &amp; Transfer Governance
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                100% of student &amp; applicant payments route directly to your institution&apos;s designated bank accounts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(tenantGovernance.is_manual_transfer_enabled)}
                  disabled={tenantGovernance.platform_governance?.is_manual_transfer_allowed === false}
                  onChange={(e) =>
                    setTenantGovernance((prev: any) => ({
                      ...prev,
                      is_manual_transfer_enabled: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enable Direct Bank Transfer</span>
              </label>

              <button
                type="button"
                disabled={savingGovernance}
                onClick={handleSaveTenantGovernance}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingGovernance ? "Saving..." : "Save Settlement Settings"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Global Manual Transfer Instructions
              </label>
              <textarea
                rows={2}
                value={tenantGovernance.manual_transfer_instructions || ""}
                onChange={(e) =>
                  setTenantGovernance((prev: any) => ({
                    ...prev,
                    manual_transfer_instructions: e.target.value,
                  }))
                }
                placeholder="Transfer exact fee amount and include the student Admission Number or Application Ref in your bank transfer narration."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Auto-Expire Unverified Attempts (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={720}
                value={tenantGovernance.auto_expire_unverified_hours || 72}
                onChange={(e) =>
                  setTenantGovernance((prev: any) => ({
                    ...prev,
                    auto_expire_unverified_hours: Number(e.target.value) || 72,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="block text-[10px] text-slate-400">
                Default: 72 hours before unverified transfer attempts expire.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search fee modules..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                categoryFilter === cat
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-bold">
          Loading institutional fee modules...
        </div>
      ) : filteredSettings.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs font-bold">
          No fee modules match your search filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSettings.map((item) => {
            const isSaving = savingModule === item.moduleType;

            return (
              <div
                key={item.moduleType}
                className={`rounded-3xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between ${
                  item.isEnabled
                    ? "bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-900/60 ring-1 ring-indigo-500/10"
                    : "bg-slate-50/70 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800 opacity-90"
                }`}
              >
                {/* Card Header with Activation Toggle */}
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800/80 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                          {item.category}
                        </span>
                        {item.isEnabled ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Fee Active &amp; Enforced
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                            Free / Disabled
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    {/* Activation Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleFieldChange(item.moduleType, "isEnabled", !item.isEnabled)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        item.isEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-zinc-700"
                      }`}
                      title={item.isEnabled ? "Click to deactivate fee" : "Click to activate fee"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          item.isEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {!item.isEnabled && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        This service is currently <strong>FREE</strong> for students and parents. No payment slip is required.
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Body: Form Fields */}
                <div className="p-5 sm:p-6 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                        Display Fee Title *
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleFieldChange(item.moduleType, "title", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                        Amount (₦) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                          ₦
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.amount}
                          onChange={(e) =>
                            handleFieldChange(item.moduleType, "amount", parseFloat(e.target.value) || 0)
                          }
                          className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rich Custom Writeup Directive */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1 flex items-center justify-between">
                      <span>Custom Payment Directive / Writeup</span>
                      <span className="text-[10px] text-slate-400 font-normal">Shown to payer on upload</span>
                    </label>
                    <textarea
                      rows={2}
                      value={item.customWriteup || ""}
                      onChange={(e) =>
                        handleFieldChange(item.moduleType, "customWriteup", e.target.value)
                      }
                      placeholder="e.g. Please note that transcript processing takes 3-5 business days upon Bursary clearance. Ensure your matric/admission number is stated."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-medium text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Institutional Settlement Bank Details */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 space-y-3">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Settlement Account Override (Optional)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          placeholder="Bank Name"
                          value={item.bankName || ""}
                          onChange={(e) =>
                            handleFieldChange(item.moduleType, "bankName", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-slate-800 dark:text-zinc-100 outline-none"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Account Number"
                          value={item.accountNumber || ""}
                          onChange={(e) =>
                            handleFieldChange(item.moduleType, "accountNumber", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-bold text-slate-800 dark:text-zinc-100 outline-none"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Account Name"
                          value={item.accountName || ""}
                          onChange={(e) =>
                            handleFieldChange(item.moduleType, "accountName", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-slate-800 dark:text-zinc-100 outline-none truncate"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-zinc-850/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewSetting(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Preview Payer View</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSave(item)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? "Saving..." : "Save Setting"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Payer Preview Modal */}
      {previewSetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                  Live Preview Mode
                </span>
                <h3 className="text-sm font-bold text-slate-200">
                  What students and parents see for: {previewSetting.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewSetting(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <PaymentReceiptUpload
                moduleType={previewSetting.moduleType as any}
                payerType="STUDENT"
                payerName="Sample Student Name"
                referenceNo="SAMPLE/2026/001"
                tenantId={tenantId}
                amount={previewSetting.amount}
                title={previewSetting.title}
                customWriteup={previewSetting.customWriteup}
                bankDetails={{
                  bankName: previewSetting.bankName || "Sample Bank Plc",
                  accountNumber: previewSetting.accountNumber || "0123456789",
                  accountName: previewSetting.accountName || "Official School Account",
                  paymentInstruction: `Include Ref SAMPLE/2026/001 in bank transfer description.`,
                }}
                previewMode={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
