"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Search,
  ExternalLink,
  Ban,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowUpRight,
  Clock,
  Coins,
  History,
  AlertCircle,
  CreditCard,
  LogIn,
  Landmark,
  Edit2,
  Save,
  X,
  Lock,
  Info,
  Calendar,
} from "lucide-react";

import {
  toggleTenantStatus,
  seedBaselinePlans,
  updateTenantPlan,
  impersonateTenant,
  updatePlatformSettlementBankAction,
  updateTenantSettlementBankAction,
} from "./actions";
import {
  NIGERIAN_BANKS,
  isValidNubanAccountNumber,
  getBankByCode,
  SettlementBankDetails,
} from "@/lib/nigerian-banks";
import { formatCurrency } from "@/lib/format-utils";

interface PlanItem {
  id: string;
  name: string;
  priceNgn: number;
  billingCycle: string;
  maxStudents: number;
  maxStaff: number;
  commissionPercent: number;
}

interface TenantItem {
  id: string;
  schoolName: string;
  subdomain: string;
  customDomain: string | null;
  adminEmail: string;
  contactPhone: string;
  institutionTypes: any;
  status: string;
  kycStatus: string;
  settlementBankName?: string | null;
  settlementAccountNumber?: string | null;
  settlementAccountName?: string | null;
  collectionMode?: string | null;
  pendingVerificationsCount?: number;
  settlementBankDetails?: SettlementBankDetails | null;
  isImpersonationAllowed: boolean;
  suspendedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  collection30Days?: number;
  commission30Days?: number;
  commissionPercent?: number;
  monthlyRate?: number;
  nextRenewalDate?: string | null;
  subscriptionStatus?: string;
  plan: {
    id: string;
    name: string;
    priceNgn: number;
    billingCycle: string;
    commissionPercent?: number;
  } | null;
  subscription: {
    status: string;
    amountDue: number;
    endsAt: string;
    trialEndsAt: string | null;
  } | null;
}

const BASE_PLATFORM_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BASE_URL ||
  "https://bonaveeict.com.ng"
).replace(/\/$/, "");

interface MetricsData {
  platformWallet: {
    balance: number;
    totalRevenue: number;
    updatedAt: string;
  };
  tenants: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
  };
  financials: {
    estimatedMrr: number;
    estimatedArr: number;
    activeSubscriptionsCount: number;
  };
  planDistribution: Array<{
    id: string;
    name: string;
    priceNgn: number;
    tenantCount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    tenantId: string | null;
    type: string;
    amount: number;
    reference: string;
    createdAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    actorId: string;
    action: string;
    tenantId: string | null;
    metadata: any;
    createdAt: string;
  }>;
}

interface PlatformBankState {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  updatedAt?: string;
}

export default function SaasAdminDashboard({
  initialMetrics,
  initialTenants,
  plans,
  initialPlatformBank,
}: {
  initialMetrics: MetricsData;
  initialTenants: TenantItem[];
  plans: PlanItem[];
  initialPlatformBank: PlatformBankState;
}) {
  const [metrics] = useState<MetricsData>(initialMetrics);
  const [tenants, setTenants] = useState<TenantItem[]>(initialTenants);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ===========================================================================
  // SUPER ADMIN PLATFORM SETTLEMENT BANK STATE
  // ===========================================================================
  const [platformBank, setPlatformBank] = useState<PlatformBankState>(initialPlatformBank);
  const [platformBankForm, setPlatformBankForm] = useState({
    bankCode: initialPlatformBank.bankCode || "035",
    accountNumber: initialPlatformBank.accountNumber || "0123456789",
  });
  const [isSavingPlatformBank, setIsSavingPlatformBank] = useState(false);
  const [platformBankError, setPlatformBankError] = useState<string | null>(null);

  // ===========================================================================
  // TENANT SETTLEMENT BANK CONFIGURATION MODAL / INLINE STATE
  // ===========================================================================
  const [tenantBankModal, setTenantBankModal] = useState<{
    isOpen: boolean;
    tenant: TenantItem | null;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    tenant: null,
    bankCode: "044",
    accountNumber: "",
    accountName: "",
    isSubmitting: false,
    error: null,
  });

  // Suspension Modal State
  const [suspensionModal, setSuspensionModal] = useState<{
    isOpen: boolean;
    tenant: TenantItem | null;
    targetStatus: "ACTIVE" | "SUSPENDED";
    reason: string;
  }>({
    isOpen: false,
    tenant: null,
    targetStatus: "SUSPENDED",
    reason: "",
  });

  // Change Plan Modal State
  const [planModal, setPlanModal] = useState<{
    isOpen: boolean;
    tenant: TenantItem | null;
    selectedPlanId: string;
  }>({
    isOpen: false,
    tenant: null,
    selectedPlanId: "",
  });

  const showToast = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // ===========================================================================
  // HANDLER: SUPER ADMIN VERIFY OFFLINE SUBSCRIPTION PAYMENT
  // ===========================================================================
  const [verifyingTenantId, setVerifyingTenantId] = useState<string | null>(null);

  const handleVerifyPayment = async (tenantId: string, action: "APPROVE" | "REJECT" = "APPROVE") => {
    setVerifyingTenantId(tenantId);
    try {
      const res = await fetch("/api/admin/verify-subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process payment verification");
      }

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId
            ? {
                ...t,
                status: data.status,
                subscriptionStatus: data.subscriptionStatus || data.status,
                nextRenewalDate: data.nextRenewalDate || t.nextRenewalDate,
              }
            : t
        )
      );

      showToast("success", data.message || "Payment verified successfully. Subscription activated for 30 days.");
    } catch (err: any) {
      showToast("error", err.message || "Failed to verify payment");
    } finally {
      setVerifyingTenantId(null);
    }
  };

  // ===========================================================================
  // HANDLER: SAVE SUPER ADMIN PLATFORM BANK SETTINGS
  // ===========================================================================
  const handleSavePlatformBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlatformBankError(null);

    const cleanAcc = platformBankForm.accountNumber.trim();
    if (!isValidNubanAccountNumber(cleanAcc)) {
      setPlatformBankError("Account Number must be exactly 10 numeric digits.");
      return;
    }

    const selectedBank = getBankByCode(platformBankForm.bankCode);
    if (!selectedBank) {
      setPlatformBankError("Please select a valid Nigerian commercial or digital bank.");
      return;
    }

    setIsSavingPlatformBank(true);
    try {
      // Direct call to API endpoint /api/saas
      const res = await fetch("/api/saas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "platform",
          bankCode: selectedBank.code,
          bankName: selectedBank.name,
          accountNumber: cleanAcc,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update platform settlement bank");
      }

      setPlatformBank({
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        accountNumber: cleanAcc,
        updatedAt: new Date().toISOString(),
      });

      showToast(
        "success",
        `Platform commission settlement bank saved: ${selectedBank.name} (${cleanAcc})`
      );
    } catch (err: any) {
      // Fallback to server action if API fetch encountered network issue
      const actionRes = await updatePlatformSettlementBankAction(
        selectedBank.code,
        cleanAcc
      );
      if (actionRes.success && actionRes.platformBank) {
        setPlatformBank({
          bankCode: actionRes.platformBank.bankCode || selectedBank.code,
          bankName: actionRes.platformBank.bankName || selectedBank.name,
          accountNumber: actionRes.platformBank.accountNumber || cleanAcc,
          updatedAt: actionRes.platformBank.updatedAt,
        });
        showToast("success", actionRes.message || "Platform settlement bank updated");
      } else {
        setPlatformBankError(err.message || actionRes.error || "Update failed");
        showToast("error", err.message || actionRes.error || "Update failed");
      }
    } finally {
      setIsSavingPlatformBank(false);
    }
  };

  // ===========================================================================
  // HANDLER: OPEN TENANT BANK CONFIGURATION
  // ===========================================================================
  const handleOpenTenantBankConfig = (tenant: TenantItem) => {
    const existingBank = tenant.settlementBankDetails;
    const existingBankName = tenant.settlementBankName || existingBank?.bankName || "";
    const matchingBank = NIGERIAN_BANKS.find(
      (b) =>
        b.name.toLowerCase() === existingBankName.toLowerCase() ||
        b.code === existingBank?.bankCode
    );

    setTenantBankModal({
      isOpen: true,
      tenant,
      bankCode: matchingBank?.code || existingBank?.bankCode || "044",
      accountNumber: tenant.settlementAccountNumber || existingBank?.accountNumber || "",
      accountName:
        tenant.settlementAccountName ||
        (existingBank as any)?.accountName ||
        tenant.schoolName.toUpperCase(),
      isSubmitting: false,
      error: null,
    });
  };

  // ===========================================================================
  // HANDLER: SAVE TENANT SETTLEMENT BANK
  // ===========================================================================
  const handleSaveTenantBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantBankModal.tenant) return;

    const { tenant, bankCode, accountNumber, accountName } = tenantBankModal;
    const cleanAcc = accountNumber.trim();
    const cleanName = (accountName || tenant.schoolName).trim().toUpperCase();

    if (!isValidNubanAccountNumber(cleanAcc)) {
      setTenantBankModal((prev) => ({
        ...prev,
        error: "Account Number must be exactly 10 numeric digits.",
      }));
      return;
    }

    const selectedBank = getBankByCode(bankCode);
    if (!selectedBank) {
      setTenantBankModal((prev) => ({
        ...prev,
        error: "Please select a valid Nigerian bank.",
      }));
      return;
    }

    setTenantBankModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      // Send PATCH request to /api/saas
      const res = await fetch("/api/saas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          bankCode: selectedBank.code,
          bankName: selectedBank.name,
          accountNumber: cleanAcc,
          accountName: cleanName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update tenant settlement bank");
      }

      const updatedBankData: SettlementBankDetails = {
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        accountNumber: cleanAcc,
        updatedAt: new Date().toISOString(),
      };

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id
            ? {
                ...t,
                settlementBankName: selectedBank.name,
                settlementAccountNumber: cleanAcc,
                settlementAccountName: cleanName,
                collectionMode: "MANUAL_BANK_TRANSFER",
                settlementBankDetails: updatedBankData,
              }
            : t
        )
      );

      setTenantBankModal({
        isOpen: false,
        tenant: null,
        bankCode: "044",
        accountNumber: "",
        accountName: "",
        isSubmitting: false,
        error: null,
      });

      showToast(
        "success",
        `Direct collection bank for ${tenant.schoolName} set to ${selectedBank.name} (${cleanAcc})`
      );
    } catch (err: any) {
      // Fallback to server action
      const actionRes = await updateTenantSettlementBankAction(
        tenant.id,
        selectedBank.code,
        cleanAcc,
        cleanName
      );
      if (actionRes.success && actionRes.bankData) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenant.id
              ? {
                  ...t,
                  settlementBankName: selectedBank.name,
                  settlementAccountNumber: cleanAcc,
                  settlementAccountName: cleanName,
                  collectionMode: "MANUAL_BANK_TRANSFER",
                  settlementBankDetails: actionRes.bankData as any,
                }
              : t
          )
        );
        setTenantBankModal({
          isOpen: false,
          tenant: null,
          bankCode: "044",
          accountNumber: "",
          accountName: "",
          isSubmitting: false,
          error: null,
        });
        showToast("success", actionRes.message || "Tenant collection bank updated");
      } else {
        setTenantBankModal((prev) => ({
          ...prev,
          isSubmitting: false,
          error: err.message || actionRes.error || "Update failed",
        }));
      }
    }
  };

  const handleSeedPlans = () => {
    startTransition(async () => {
      const res = await seedBaselinePlans();
      if (res.success) {
        showToast("success", res.message || "Plans seeded successfully");
        window.location.reload();
      } else {
        showToast("error", res.error || "Failed to seed plans");
      }
    });
  };

  const handleConfirmStatusToggle = () => {
    if (!suspensionModal.tenant) return;
    const { tenant, targetStatus, reason } = suspensionModal;

    startTransition(async () => {
      const res = await toggleTenantStatus(tenant.id, targetStatus, reason);
      if (res.success) {
        showToast("success", res.message || "Status updated");
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenant.id
              ? {
                  ...t,
                  status: targetStatus,
                  suspendedReason:
                    targetStatus === "SUSPENDED" ? reason : null,
                  suspendedAt:
                    targetStatus === "SUSPENDED"
                      ? new Date().toISOString()
                      : null,
                }
              : t
          )
        );
        setSuspensionModal({
          isOpen: false,
          tenant: null,
          targetStatus: "SUSPENDED",
          reason: "",
        });
      } else {
        showToast("error", res.error || "Failed to update status");
      }
    });
  };

  const handleConfirmPlanChange = () => {
    if (!planModal.tenant || !planModal.selectedPlanId) return;
    const { tenant, selectedPlanId } = planModal;
    const targetPlan = plans.find((p) => p.id === selectedPlanId);

    startTransition(async () => {
      const res = await updateTenantPlan(tenant.id, selectedPlanId);
      if (res.success) {
        showToast("success", res.message || "Plan updated");
        if (targetPlan) {
          setTenants((prev) =>
            prev.map((t) =>
              t.id === tenant.id
                ? {
                    ...t,
                    plan: {
                      id: targetPlan.id,
                      name: targetPlan.name,
                      priceNgn: targetPlan.priceNgn,
                      billingCycle: targetPlan.billingCycle,
                      commissionPercent: targetPlan.commissionPercent,
                    },
                  }
                : t
            )
          );
        }
        setPlanModal({ isOpen: false, tenant: null, selectedPlanId: "" });
      } else {
        showToast("error", res.error || "Failed to change plan");
      }
    });
  };

  const handleImpersonate = (tenant: TenantItem) => {
    if (tenant.status === "SUSPENDED") {
      showToast("error", "Cannot impersonate a suspended tenant");
      return;
    }
    if (!tenant.isImpersonationAllowed) {
      showToast("error", "Impersonation is disabled by tenant security policy");
      return;
    }
    startTransition(async () => {
      const res = await impersonateTenant(tenant.id);
      if (res.success && res.redirectUrl) {
        showToast("success", res.message || `Impersonating ${tenant.schoolName}`);
        window.open(res.redirectUrl, "_blank");
      } else {
        showToast("error", res.error || "Impersonation failed");
      }
    });
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesStatus =
      statusFilter === "ALL" ? true : tenant.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tenant.schoolName.toLowerCase().includes(q) ||
      tenant.subdomain.toLowerCase().includes(q) ||
      tenant.adminEmail.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const formatNgn = (amt?: number | string | null) => {
    return formatCurrency(amt);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border backdrop-blur-md flex items-center gap-3 transition-all duration-300 ${
            feedback.type === "success"
              ? "bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50/95 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              SaaS Multi-Tenant Core
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              100% Manual Subscription Framework (0% Transaction Fees)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1.5">
            Super Admin SaaS Subscription Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage institutional tenants, flat monthly SaaS portal subscriptions, and platform corporate collection account
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {plans.length === 0 && (
            <button
              onClick={handleSeedPlans}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-xs shadow-sm shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Seed Default SaaS Plans
            </button>
          )}

          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/80 font-semibold text-xs shadow-xs transition"
          >
            Switch to Legacy Console
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MANDATORY 0% FEE COMPLIANCE BANNER                                     */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-zinc-900 shadow-xs flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
              100% Manual SaaS Subscription & Payment Verification Framework
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
              0% Transaction Fees
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed">
            <strong className="text-blue-700 dark:text-blue-400">Strict Scope Boundary:</strong> The platform does not process school fees or take transaction percentages (0% charges). Schools collect student tuition independently outside the platform directly to their school bank accounts. The platform handles and tracks only the tenant&apos;s flat monthly SaaS portal subscription manually.
          </p>
        </div>
      </div>

      {/* Top Level Financial & Status KPIs (Flat SaaS Management) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Platform Revenue */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Platform Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNgn(metrics.platformWallet.totalRevenue)}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-emerald-500" />
              Cumulative flat SaaS portal subscriptions
            </p>
          </div>
        </div>

        {/* Corporate Account Balance */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Corporate Account Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNgn(metrics.platformWallet.balance)}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
              Direct SaaS platform subscription revenue
            </p>
          </div>
        </div>

        {/* Estimated MRR */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Estimated MRR
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNgn(metrics.financials.estimatedMrr)}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              ARR: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatNgn(metrics.financials.estimatedArr)}</span>
            </p>
          </div>
        </div>

        {/* Total Tenants by Status */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Tenants Roster
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {metrics.tenants.total}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-zinc-400 mt-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{metrics.tenants.active} active</span>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{metrics.tenants.pending} pending</span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{metrics.tenants.suspended} suspended</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUPER ADMIN PLATFORM SUBSCRIPTION CORPORATE ACCOUNT CONFIGURATION     */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Platform Subscription Corporate Account (Super Admin)
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Corporate bank account where tenants manually pay their flat monthly software fee. Platform charges 0% transaction fees on school tuition.
              </p>
            </div>
          </div>

          {/* Active Configuration Snapshot */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
            <span className="text-slate-500 dark:text-zinc-400 font-medium">Currently Active:</span>
            <span className="font-bold text-slate-800 dark:text-zinc-100">
              {platformBank.bankName || "Wema Bank"}
            </span>
            <span className="text-slate-400 dark:text-zinc-600">•</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {platformBank.accountNumber || "0123456789"}
            </span>
          </div>
        </div>


        {/* Configuration Form */}
        <form onSubmit={handleSavePlatformBank} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Bank Dropdown Selection */}
            <div className="md:col-span-6 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Settlement Bank Selection
              </label>
              <div className="relative">
                <select
                  value={platformBankForm.bankCode}
                  onChange={(e) =>
                    setPlatformBankForm((prev) => ({ ...prev, bankCode: e.target.value }))
                  }
                  className="w-full text-xs font-semibold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition appearance-none cursor-pointer"
                >
                  {NIGERIAN_BANKS.map((bank) => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name} ({bank.code})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            </div>

            {/* Account Number Input (Strict 10-digit validation) */}
            <div className="md:col-span-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  NUBAN Account Number
                </label>
                <span className="text-[11px] font-mono font-medium text-slate-400">
                  {platformBankForm.accountNumber.length}/10 digits
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit NUBAN (e.g., 0123456789)"
                value={platformBankForm.accountNumber}
                onChange={(e) => {
                  const numericOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPlatformBankForm((prev) => ({ ...prev, accountNumber: numericOnly }));
                }}
                className={`w-full text-xs font-mono font-bold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                  platformBankForm.accountNumber.length === 10
                    ? "border-emerald-500/60 focus:ring-emerald-500/20"
                    : "border-slate-200 dark:border-zinc-800 focus:ring-indigo-500/20 focus:border-indigo-500"
                }`}
              />
            </div>

            {/* Save Button */}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSavingPlatformBank || platformBankForm.accountNumber.length !== 10}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSavingPlatformBank ? "Saving..." : "Save Platform Bank"}
              </button>
            </div>
          </div>

          {platformBankError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{platformBankError}</span>
            </div>
          )}
        </form>
      </div>

      {/* Main Content Area: Filter & Tenant Directory */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 overflow-x-auto text-xs">
            {(["ALL", "ACTIVE", "PENDING", "SUSPENDED"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                  statusFilter === tab
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab === "ALL" && `All (${tenants.length})`}
                {tab === "ACTIVE" && `Active (${metrics.tenants.active})`}
                {tab === "PENDING" && `Pending (${metrics.tenants.pending})`}
                {tab === "SUSPENDED" && `Suspended (${metrics.tenants.suspended})`}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search school name, subdomain, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 3. TENANTS TABLE: 100% MANUAL SAAS SUBSCRIPTION FRAMEWORK              */}
        {/* ======================================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60 text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-bold">
                  {/* Column 1 */}
                  <th className="py-3.5 px-4">School & Subdomain</th>
                  {/* Column 2 */}
                  <th className="py-3.5 px-4">Plan & Subscription</th>
                  {/* Column 3 */}
                  <th className="py-3.5 px-4">Monthly Rate</th>
                  {/* Column 4 */}
                  <th className="py-3.5 px-4">Subscription Status</th>
                  {/* Column 5 */}
                  <th className="py-3.5 px-4">Next Renewal Date</th>
                  {/* Column 6 */}
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                      <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-zinc-700" />
                      <p className="font-semibold text-sm">No tenants match the specified criteria</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        New tenants created via the SaaS onboarding route will appear here automatically.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => {
                    const effectiveStatus = (
                      tenant.subscriptionStatus ||
                      tenant.subscription?.status ||
                      tenant.status ||
                      "INACTIVE"
                    ).toUpperCase();
                    const isActive = effectiveStatus === "ACTIVE";
                    const isSuspended = effectiveStatus === "SUSPENDED" || tenant.status === "SUSPENDED";
                    const isPastDue = effectiveStatus === "PAST_DUE";
                    const portalUrl = `${BASE_PLATFORM_URL}/${tenant.subdomain}/dashboard`;
                    const monthlyRate =
                      tenant.monthlyRate ||
                      tenant.subscription?.amountDue ||
                      tenant.plan?.priceNgn ||
                      0;
                    const renewalDateObj = tenant.nextRenewalDate || tenant.subscription?.endsAt;

                    return (
                      <tr
                        key={tenant.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition group"
                      >
                        {/* 1. SCHOOL & SUBDOMAIN */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {tenant.schoolName}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 mt-0.5">
                            <Link
                              href={portalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1"
                              title={`Navigate to ${portalUrl}`}
                            >
                              <span>/{tenant.subdomain}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </Link>
                            <span>•</span>
                            <span className="truncate max-w-[170px]">{tenant.adminEmail}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                            {tenant.contactPhone}
                          </div>
                        </td>

                        {/* 2. PLAN & SUBSCRIPTION */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                              {tenant.plan?.name || "Standard Secondary Tier"}
                            </span>
                            <span className="text-slate-500 dark:text-zinc-400 font-medium text-[11px]">
                              / {tenant.plan?.billingCycle || "monthly"}
                            </span>
                          </div>
                          {tenant.subscription?.trialEndsAt && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Trial until {new Date(tenant.subscription.trialEndsAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </td>

                        {/* 3. MONTHLY RATE */}
                        <td className="py-4 px-4">
                          <div className="font-mono font-black text-slate-900 dark:text-white text-sm">
                            {formatNgn(monthlyRate)}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">
                            Flat Software Rate
                          </span>
                        </td>

                        {/* 4. SUBSCRIPTION STATUS */}
                        <td className="py-4 px-4">
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              ACTIVE
                            </span>
                          )}
                          {isPastDue && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Clock className="w-3 h-3" />
                              PAST DUE
                            </span>
                          )}
                          {isSuspended && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <Ban className="w-3 h-3" />
                                SUSPENDED
                              </span>
                              {tenant.suspendedReason && (
                                <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 truncate max-w-[140px]" title={tenant.suspendedReason}>
                                  {tenant.suspendedReason}
                                </p>
                              )}
                            </div>
                          )}
                          {!isActive && !isPastDue && !isSuspended && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                              <Clock className="w-3 h-3" />
                              {effectiveStatus}
                            </span>
                          )}
                        </td>

                        {/* 5. NEXT RENEWAL DATE */}
                        <td className="py-4 px-4">
                          <div className="font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>
                              {renewalDateObj
                                ? new Date(renewalDateObj).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "Pending Renewal"}
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 block mt-0.5">
                            Manual Invoice Cycle
                          </span>
                        </td>

                        {/* 6. ACTIONS */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Portal Access */}
                            <Link
                              href={portalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition"
                              title="Open Tenant School Portal"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            {/* Impersonate Access */}
                            {tenant.isImpersonationAllowed && (
                              <button
                                onClick={() => handleImpersonate(tenant)}
                                disabled={isPending || isSuspended}
                                className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 transition disabled:opacity-40"
                                title="Impersonate Tenant School Admin"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Change Plan Button */}
                            {plans.length > 0 && (
                              <button
                                onClick={() =>
                                  setPlanModal({
                                    isOpen: true,
                                    tenant,
                                    selectedPlanId: tenant.plan?.id || plans[0].id,
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-medium text-[11px] transition"
                              >
                                Plan
                              </button>
                            )}

                            {/* Suspend / Reactivate */}
                            {isActive ? (
                              <button
                                onClick={() =>
                                  setSuspensionModal({
                                    isOpen: true,
                                    tenant,
                                    targetStatus: "SUSPENDED",
                                    reason: "Administrative policy suspension",
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-[11px] border border-rose-200 dark:border-rose-800 transition"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  setSuspensionModal({
                                    isOpen: true,
                                    tenant,
                                    targetStatus: "ACTIVE",
                                    reason: "Administrative reactivation",
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800 transition"
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Activity & Audit Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Platform Transactions */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Platform Ledger Transactions
              </h3>
            </div>
            <span className="text-xs text-slate-400">Recent 10 entries</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {metrics.recentTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 py-6 text-center">
                No platform transactions logged yet. Records populate via manual flat SaaS subscriptions and renewals.
              </p>
            ) : (
              metrics.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 capitalize">
                      {tx.type}
                    </span>
                    <p className="font-mono text-[10px] text-slate-400">{tx.reference}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatNgn(tx.amount)}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Super Admin Audit Stream
              </h3>
            </div>
            <span className="text-xs text-slate-400">Immutable trace</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {metrics.recentAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 py-6 text-center">
                No administrative actions logged yet. Tenant creation and status changes appear here.
              </p>
            ) : (
              metrics.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 font-mono text-[11px]">
                      {log.action}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      by <span className="font-medium">{log.actorId}</span>
                      {log.metadata?.schoolName && ` • ${log.metadata.schoolName}`}
                    </p>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TENANT SETTLEMENT BANK CONFIGURATION MODAL                             */}
      {/* ========================================================================= */}
      {tenantBankModal.isOpen && tenantBankModal.tenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Configure Settlement Bank
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {tenantBankModal.tenant.schoolName} ({tenantBankModal.tenant.subdomain})
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setTenantBankModal({
                    isOpen: false,
                    tenant: null,
                    bankCode: "044",
                    accountNumber: "",
                    accountName: "",
                    isSubmitting: false,
                    error: null,
                  })
                }
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTenantBank} className="mt-4 space-y-4">
              {/* Bank Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Nigerian Settlement Bank
                </label>
                <div className="relative">
                  <select
                    value={tenantBankModal.bankCode}
                    onChange={(e) =>
                      setTenantBankModal((prev) => ({
                        ...prev,
                        bankCode: e.target.value,
                      }))
                    }
                    className="w-full text-xs font-semibold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition appearance-none cursor-pointer"
                  >
                    {NIGERIAN_BANKS.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name} ({bank.code})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>
              </div>

              {/* Account Number Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                    10-Digit NUBAN Account Number
                  </label>
                  <span className="text-[11px] font-mono font-medium text-slate-400">
                    {tenantBankModal.accountNumber.length}/10 digits
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="e.g., 0123456789"
                  value={tenantBankModal.accountNumber}
                  onChange={(e) => {
                    const numeric = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setTenantBankModal((prev) => ({
                      ...prev,
                      accountNumber: numeric,
                    }));
                  }}
                  className={`w-full text-xs font-mono font-bold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                    tenantBankModal.accountNumber.length === 10
                      ? "border-emerald-500/60 focus:ring-emerald-500/20"
                      : "border-slate-200 dark:border-zinc-800 focus:ring-indigo-500/20 focus:border-indigo-500"
                  }`}
                />
              </div>

              {/* Account Holder Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., GREENWOOD ACADEMY LTD"
                  value={tenantBankModal.accountName}
                  onChange={(e) =>
                    setTenantBankModal((prev) => ({
                      ...prev,
                      accountName: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full text-xs font-semibold py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              {/* Direct Collection Notice */}
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  100% Direct Collection: Parents transfer tuition directly into this commercial bank account. Zero platform escrow or split fee is deducted. Proofs of payment are verified by the school bursar.
                </span>
              </div>

              {tenantBankModal.error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{tenantBankModal.error}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() =>
                    setTenantBankModal({
                      isOpen: false,
                      tenant: null,
                      bankCode: "044",
                      accountNumber: "",
                      accountName: "",
                      isSubmitting: false,
                      error: null,
                    })
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tenantBankModal.isSubmitting || tenantBankModal.accountNumber.length !== 10}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition disabled:opacity-40"
                >
                  {tenantBankModal.isSubmitting ? "Updating..." : "Update Tenant Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspension / Reactivation Modal */}
      {suspensionModal.isOpen && suspensionModal.tenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              {suspensionModal.targetStatus === "SUSPENDED" ? (
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {suspensionModal.targetStatus === "SUSPENDED"
                    ? "Suspend Tenant Access"
                    : "Reactivate Tenant Access"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {suspensionModal.tenant.schoolName} ({suspensionModal.tenant.subdomain})
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Administrative Reason
              </label>
              <textarea
                value={suspensionModal.reason}
                onChange={(e) =>
                  setSuspensionModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                rows={3}
                placeholder="State the reason for this action..."
                className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setSuspensionModal({
                    isOpen: false,
                    tenant: null,
                    targetStatus: "SUSPENDED",
                    reason: "",
                  })
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmStatusToggle}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition disabled:opacity-50 ${
                  suspensionModal.targetStatus === "SUSPENDED"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
                }`}
              >
                {isPending ? "Processing..." : `Confirm ${suspensionModal.targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {planModal.isOpen && planModal.tenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Update Subscription Tier
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {planModal.tenant.schoolName}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Select New Plan
              </label>
              {plans.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition text-xs ${
                    planModal.selectedPlanId === p.id
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200"
                      : "border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40 text-slate-700 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="planSelect"
                      value={p.id}
                      checked={planModal.selectedPlanId === p.id}
                      onChange={() =>
                        setPlanModal((prev) => ({ ...prev, selectedPlanId: p.id }))
                      }
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-bold">{p.name}</span>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Up to {p.maxStudents} students • {p.commissionPercent}% platform fee
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatNgn(p.priceNgn)}
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setPlanModal({ isOpen: false, tenant: null, selectedPlanId: "" })
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmPlanChange}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition disabled:opacity-50"
              >
                {isPending ? "Updating..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
