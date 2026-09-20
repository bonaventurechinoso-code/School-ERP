"use client";

import React, { useState, useTransition } from "react";
import {
  Layers,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Banknote,
  FileSpreadsheet,
  RefreshCw,
  Coins,
} from "lucide-react";
import { BursarContext, createBursarFeeTemplate } from "../actions";

export function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FeesDeskClient({
  context,
  initialTemplates,
}: {
  context: BursarContext;
  initialTemplates: any[];
}) {
  const [templates, setTemplates] = useState<any[]>(initialTemplates);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [billingType, setBillingType] = useState("FLAT");
  const [defaultAmount, setDefaultAmount] = useState("50000");
  const [isPending, startTransition] = useTransition();
  const [formMsg, setFormMsg] = useState<{ success?: boolean; text: string } | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const parsedAmount = parseFloat(defaultAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormMsg({ success: false, text: "Please enter a valid default amount." });
      return;
    }

    startTransition(async () => {
      const res = await createBursarFeeTemplate(
        context.schoolId,
        name.trim(),
        billingType,
        parsedAmount
      );

      if (res.success && res.template) {
        setTemplates([res.template, ...templates]);
        setFormMsg({ success: true, text: "Fee structure template added successfully!" });
        setName("");
        setDefaultAmount("50000");
        setTimeout(() => {
          setShowAddModal(false);
          setFormMsg(null);
        }, 1200);
      } else {
        setFormMsg({ success: false, text: res.error || "Failed to create fee template." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Fee Structures &amp; Tariffs
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Configure termly tuition rates, PTA levies, boarding packages, and sundry fee structures.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Fee Template</span>
        </button>
      </div>

      {/* Grid of Fee Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 dark:text-zinc-500 italic text-sm space-y-2">
            <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
            <p>No fee structure templates created yet. Click &quot;New Fee Template&quot; to begin.</p>
          </div>
        ) : (
          templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {tmpl.billingType || "FLAT RATE"}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {tmpl.name}
                  </h3>
                  <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                    {formatNaira(tmpl.defaultAmount)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>Created {new Date(tmpl.createdAt).toLocaleDateString()}</span>
                {tmpl._count?.invoices !== undefined && (
                  <span className="font-bold text-slate-700 dark:text-zinc-300">
                    {tmpl._count.invoices} Invoices Issued
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE TEMPLATE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Create Fee Structure</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  formMsg.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {formMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{formMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SSS 1 Termly Tuition & PTA"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Billing Category
                </label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="FLAT">Flat Rate (Standard Tuition)</option>
                  <option value="PER_CREDIT">Per-Credit / Unit Basis</option>
                  <option value="OPTIONAL">Optional Levy (Uniforms/Books)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Default Amount (NGN ₦) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={defaultAmount}
                  onChange={(e) => setDefaultAmount(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-md transition flex items-center gap-1.5"
                >
                  {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Save Fee Template</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
