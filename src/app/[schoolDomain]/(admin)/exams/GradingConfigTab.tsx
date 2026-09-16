"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  ACTIVE_INSTITUTIONAL_TIERS,
  InstitutionalTier,
  TIER_DEFAULT_WEIGHTS,
  WeightComponent,
} from "@/lib/assessmentEngine";
import { saveTierAssessmentConfig } from "./actions";
import { Sliders, AlertTriangle, CheckCircle2, Save, RotateCcw } from "lucide-react";

interface GradingConfigTabProps {
  schoolId: string;
  schoolDomain: string;
  initialTierName?: string;
  savedConfigs?: Record<string, Record<string, number>>;
}

export default function GradingConfigTab({
  schoolId,
  schoolDomain,
  initialTierName = "Secondary School",
  savedConfigs = {},
}: GradingConfigTabProps) {
  // Resolve starting tier to one of the 6 canonical tiers
  const resolveInitialTier = (): InstitutionalTier => {
    const match = ACTIVE_INSTITUTIONAL_TIERS.find(
      (t) => t.toLowerCase() === initialTierName.toLowerCase() || initialTierName.toLowerCase().includes(t.toLowerCase())
    );
    return match || "Secondary School";
  };

  const [selectedTier, setSelectedTier] = useState<InstitutionalTier>(resolveInitialTier);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-load matching default or saved weights when tier selection updates
  useEffect(() => {
    const components: WeightComponent[] = TIER_DEFAULT_WEIGHTS[selectedTier] || [];
    const saved = savedConfigs[selectedTier];

    const initialMap: Record<string, number> = {};
    components.forEach((comp) => {
      initialMap[comp.key] = saved && saved[comp.key] != null ? saved[comp.key] : comp.weight;
    });

    setWeights(initialMap);
    setFeedback(null);
  }, [selectedTier, savedConfigs]);

  const components: WeightComponent[] = TIER_DEFAULT_WEIGHTS[selectedTier] || [];

  // Compute live cumulative total
  const cumulativeTotal = Object.values(weights).reduce(
    (acc, curr) => acc + (Number(curr) || 0),
    0
  );
  const isCumulativeBalanced = cumulativeTotal === 100;

  const handleWeightChange = (key: string, value: string) => {
    const num = parseFloat(value);
    setWeights((prev) => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
    setFeedback(null);
  };

  const handleResetDefaults = () => {
    const defaultMap: Record<string, number> = {};
    components.forEach((c) => {
      defaultMap[c.key] = c.weight;
    });
    setWeights(defaultMap);
    setFeedback({
      type: "success",
      message: `Reset weights for ${selectedTier} to standard Nigerian educational defaults.`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCumulativeBalanced) {
      setFeedback({
        type: "error",
        message: `Submission Blocked: Cumulative weight total must equal exactly 100% (currently ${cumulativeTotal}%).`,
      });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const res = await saveTierAssessmentConfig(schoolId, selectedTier, weights);
      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || `Assessment configurations for ${selectedTier} committed successfully!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to commit assessment configurations.",
        });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Information Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Institutional Tier Grading Configurations
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure and calibrate assessment component weights for the selected academic tier.
            </p>
          </div>

          {/* Institutional Tier Config Dropdown */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Active Setup Tier:
            </label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as InstitutionalTier)}
              className="border border-slate-300 dark:border-slate-700 rounded-xl py-2 px-3.5 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
            >
              {ACTIVE_INSTITUTIONAL_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Tier Details Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {selectedTier} Assessment Weights
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adjust percentages for continuous assessments, classwork, tests, and examinations.
            </p>
          </div>

          {/* Live Cumulative Sum Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cumulative Total:
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black font-mono border ${
                isCumulativeBalanced
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                  : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700"
              }`}
            >
              {cumulativeTotal}% / 100%
            </span>
          </div>
        </div>

        {/* Warning Banner when Cumulative Weight != 100% */}
        {!isCumulativeBalanced && (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 flex items-start gap-3 animate-in fade-in duration-200">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="text-sm">
              <div className="font-bold">Validation Alert: Cumulative Total Mismatch</div>
              <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300/90">
                The cumulative assessment weights for <span className="font-semibold">{selectedTier}</span> equal{" "}
                <span className="font-extrabold">{cumulativeTotal}%</span>. Database submissions are strictly blocked until the total equals{" "}
                <span className="font-extrabold underline">exactly 100%</span>.
              </p>
            </div>
          </div>
        )}

        {/* Success Banner when balanced */}
        {isCumulativeBalanced && (
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm font-medium">
              Assessment weights are balanced at 100%. Ready to commit to multi-tenant database.
            </div>
          </div>
        )}

        {/* Interactive Weight Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {components.map((comp) => {
            const currentVal = weights[comp.key] ?? comp.weight;
            return (
              <div
                key={comp.key}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4.5 space-y-2 hover:border-slate-300 dark:hover:border-slate-600 transition"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                    {comp.label}
                  </label>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    Max: {comp.max}
                  </span>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={currentVal}
                    onChange={(e) => handleWeightChange(comp.key, e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg py-2 pl-3 pr-8 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition shadow-2xs"
                    placeholder={comp.placeholder || "0 - 100"}
                  />
                  <span className="absolute right-3 text-sm font-bold text-slate-400 dark:text-slate-500 select-none">
                    %
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-sm font-medium flex items-center gap-2.5 ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 gap-4">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 font-semibold text-sm transition shadow-2xs disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Standards
          </button>

          <button
            type="submit"
            disabled={!isCumulativeBalanced || isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm hover:shadow transition"
          >
            <Save className="w-4 h-4" />
            {isPending ? "Saving Configurations..." : "Save Tier Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
