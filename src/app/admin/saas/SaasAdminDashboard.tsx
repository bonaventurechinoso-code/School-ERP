"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  TrendingUp,
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Search,
  ExternalLink,
  Ban,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUpRight,
  Clock,
  Coins,
  History,
  AlertCircle,
  CreditCard,
  LogIn,
} from "lucide-react";
import {
  toggleTenantStatus,
  seedBaselinePlans,
  updateTenantPlan,
  impersonateTenant,
} from "./actions";

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
  paystackSubaccountCode: string | null;
  paystackSplitCode: string | null;
  isImpersonationAllowed: boolean;
  suspendedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    priceNgn: number;
    billingCycle: string;
  } | null;
  wallet: {
    balance: number;
    currency: string;
  };
  subscription: {
    status: string;
    amountDue: number;
    endsAt: string;
    trialEndsAt: string | null;
  } | null;
}

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
    totalTenantWalletFunds: number;
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

export default function SaasAdminDashboard({
  initialMetrics,
  initialTenants,
  plans,
}: {
  initialMetrics: MetricsData;
  initialTenants: TenantItem[];
  plans: PlanItem[];
}) {
  const [metrics, setMetrics] = useState<MetricsData>(initialMetrics);
  const [tenants, setTenants] = useState<TenantItem[]>(initialTenants);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const formatNgn = (amt: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amt);
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
              Paystack Settlement Engine Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1.5">
            Super Admin Tenant & Revenue Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage institutional tenants, Paystack split-settlements, quotas, and platform revenue
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

      {/* Top Level Financial & Status KPIs */}
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
              Cumulative commissions & subscription settlements
            </p>
          </div>
        </div>

        {/* Platform Wallet Balance */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Available Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatNgn(metrics.platformWallet.balance)}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-blue-500" />
              Ready for Paystack platform payout
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
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
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

      {/* Plan Distribution Banner */}
      {plans.length > 0 && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
              Active Tier Quotas:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {plans.map((p) => {
              const count =
                metrics.planDistribution.find((pd) => pd.id === p.id)
                  ?.tenantCount || 0;
              return (
                <div
                  key={p.id}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2 text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    {p.name}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">
                    {formatNgn(p.priceNgn)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                    {count} {count === 1 ? "school" : "schools"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

        {/* Tenants Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-4">School & Subdomain</th>
                  <th className="py-3.5 px-4">Plan & Subscription</th>
                  <th className="py-3.5 px-4">Paystack Subaccount & Split</th>
                  <th className="py-3.5 px-4">Wallet Balance</th>
                  <th className="py-3.5 px-4">Status</th>
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
                    const isActive = tenant.status === "ACTIVE";
                    const isSuspended = tenant.status === "SUSPENDED";
                    const portalUrl = `/${tenant.subdomain}`;

                    return (
                      <tr
                        key={tenant.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition group"
                      >
                        {/* School & Subdomain */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {tenant.schoolName}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 mt-0.5">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                              {tenant.subdomain}
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[180px]">{tenant.adminEmail}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                            {tenant.contactPhone}
                          </div>
                        </td>

                        {/* Plan & Subscription */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                              {tenant.plan?.name || "Unassigned"}
                            </span>
                            {tenant.plan && (
                              <span className="text-slate-500 dark:text-zinc-400 font-medium text-[11px]">
                                {formatNgn(tenant.plan.priceNgn)} / {tenant.plan.billingCycle}
                              </span>
                            )}
                          </div>
                          {tenant.subscription && (
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="capitalize">{tenant.subscription.status}</span>
                              {tenant.subscription.trialEndsAt && (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  (Trial until {new Date(tenant.subscription.trialEndsAt).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Paystack Codes */}
                        <td className="py-4 px-4">
                          <div className="font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                            {tenant.paystackSubaccountCode ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-semibold">
                                {tenant.paystackSubaccountCode}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No subaccount</span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                            {tenant.paystackSplitCode ? (
                              <span>Split: {tenant.paystackSplitCode}</span>
                            ) : (
                              <span className="text-slate-400">Direct ledger</span>
                            )}
                          </div>
                        </td>

                        {/* Wallet Balance */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {formatNgn(tenant.wallet.balance)}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">
                            {tenant.wallet.currency}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          )}
                          {isSuspended && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <Ban className="w-3 h-3" />
                                Suspended
                              </span>
                              {tenant.suspendedReason && (
                                <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 truncate max-w-[140px]" title={tenant.suspendedReason}>
                                  {tenant.suspendedReason}
                                </p>
                              )}
                            </div>
                          )}
                          {tenant.status === "PENDING" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
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
                No platform transactions logged yet. Transactions populate via Paystack splits and fee settlements.
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
