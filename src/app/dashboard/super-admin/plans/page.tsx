"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Layers,
  Check,
  Building2,
  Sparkles,
  Zap,
  Edit,
  CheckCircle2,
  X,
  ArrowRight,
} from "lucide-react";
import { PRICING_PLANS, INITIAL_SCHOOLS, PricingPlan } from "../mock-data";

export default function PlansPricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>(PRICING_PLANS);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSavePlanPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    const priceNum = parseInt(newPrice, 10) || editingPlan.pricePerTerm;
    setPlans((prev) =>
      prev.map((p) =>
        p.id === editingPlan.id
          ? {
              ...p,
              pricePerTerm: priceNum,
              priceDisplay: `₦${priceNum.toLocaleString()} / term`,
            }
          : p
      )
    );
    setEditingPlan(null);
    triggerToast(`Updated pricing for ${editingPlan.name}.`);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-950 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-[95vw]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              SaaS Subscription Tiers & Pricing
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Per Term (Nigerian Academic Calendar)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure subscription limits, institutional billing rates, student capacity, and module entitlements.
          </p>
        </div>

        <Link
          href="/dashboard/super-admin/tenants"
          className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Building2 className="w-4 h-4 text-slate-500" />
          <span>Manage Active Tenants</span>
        </Link>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const activeTenantsCount = INITIAL_SCHOOLS.filter(
            (s) => s.tier === plan.id
          ).length;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-3xl p-6 sm:p-7 border flex flex-col justify-between relative transition-all hover:shadow-lg ${
                plan.popular
                  ? "border-2 border-blue-500 shadow-md ring-4 ring-blue-500/10"
                  : "border-slate-200/80 shadow-sm"
              }`}
            >
              {plan.badge && (
                <span
                  className={`absolute -top-3 right-6 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm ${
                    plan.popular
                      ? "bg-blue-600 text-white"
                      : "bg-purple-600 text-white"
                  }`}
                >
                  {plan.badge}
                </span>
              )}

              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    plan.id === "Enterprise"
                      ? "bg-purple-50 text-purple-700"
                      : plan.id === "Premium"
                      ? "bg-blue-50 text-blue-700"
                      : plan.id === "Basic"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {plan.name}
                </span>

                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-4 tracking-tight">
                  {plan.priceDisplay}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{plan.tagline}</p>

                <div className="mt-4 p-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-700">
                  Capacity: <span className="font-bold text-slate-900">{plan.maxStudents}</span>
                </div>

                <div className="mt-5 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Included Capabilities:
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2">
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            plan.popular ? "text-blue-600 font-bold" : "text-emerald-500"
                          }`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Active Tenants:{" "}
                  <strong className="text-slate-900 font-mono font-bold">
                    {activeTenantsCount}
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setEditingPlan(plan);
                    setNewPrice(plan.pricePerTerm.toString());
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit Rate</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Price Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                Modify Tier Rate: {editingPlan.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlanPrice} className="py-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Price Per Term in Naira (₦)
                </label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Applies to new subscriptions and renewals via bank transfer.
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-950 text-white rounded-xl font-bold hover:bg-slate-800"
                >
                  Save Tier Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
