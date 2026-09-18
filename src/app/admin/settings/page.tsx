import { prisma } from "@/lib/prisma";
import { updatePlanParameters } from "./actions";
import {
  Settings,
  Sliders,
  CreditCard,
  ShieldCheck,
  Save,
  CheckCircle2,
  KeyRound,
  Layers,
  Cpu,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { priceNgn: "asc" },
  });

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY ? "••••••••••••••••" : "Missing";
  const platformSubaccount = process.env.PLATFORM_SUBACCOUNT_CODE || "Not Configured";

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700">
              Module 5
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Global Control Plane
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Platform Configuration & Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Modify SaaS tier quotas, platform split commission percentages, and gateway parameters
          </p>
        </div>
      </div>

      {/* Gateway Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
            <KeyRound className="w-4 h-4 text-indigo-500" />
            Paystack Secret Key
          </div>
          <div className="font-mono text-sm font-bold text-slate-800 dark:text-zinc-200">
            {paystackSecret}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Encrypted via Environment
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
            <CreditCard className="w-4 h-4 text-blue-500" />
            Platform Subaccount Code
          </div>
          <div className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {platformSubaccount}
          </div>
          <span className="text-[10px] text-slate-500">Destination for platform commissions</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
            <Cpu className="w-4 h-4 text-purple-500" />
            Cluster Isolation Engine
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-zinc-200">
            Hybrid Multi-Tenant Tiered
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            Active & Auto-Routing
          </span>
        </div>
      </div>

      {/* Plan Parameters Configuration */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              SaaS Subscription Plan Parameters & Commission Overrides
            </h3>
          </div>
          <span className="text-xs text-slate-400">Direct Prisma persistence</span>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {plans.map((plan) => (
            <form
              key={plan.id}
              action={updatePlanParameters}
              className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end"
            >
              <input type="hidden" name="planId" value={plan.id} />

              {/* Plan Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Plan Tier
                </label>
                <div className="text-sm font-black text-slate-900 dark:text-white py-1">
                  {plan.name}
                </div>
                <span className="text-[10px] text-slate-400 capitalize">{plan.billingCycle}</span>
              </div>

              {/* Price NGN */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Base Price (NGN)
                </label>
                <input
                  type="number"
                  name="priceNgn"
                  defaultValue={plan.priceNgn}
                  className="w-full text-xs font-bold p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Commission Percent */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Platform Cut (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="commissionPercent"
                  defaultValue={plan.commissionPercent}
                  className="w-full text-xs font-bold p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Max Students */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Max Students
                </label>
                <input
                  type="number"
                  name="maxStudents"
                  defaultValue={plan.maxStudents}
                  className="w-full text-xs font-bold p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Max Staff */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Max Staff
                </label>
                <input
                  type="number"
                  name="maxStaff"
                  defaultValue={plan.maxStaff}
                  className="w-full text-xs font-bold p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Save Button */}
              <div>
                <input type="hidden" name="isActive" value="true" />
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-bold transition shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
