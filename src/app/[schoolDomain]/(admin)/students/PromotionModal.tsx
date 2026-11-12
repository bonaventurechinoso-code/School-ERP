"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  X,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Layers,
  Users,
} from "lucide-react";
import {
  previewSessionPromotionAction,
  executeSessionPromotionAction,
  undoSessionPromotionAction,
} from "./bulk-enroll-actions";

interface PromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  availableSessions: string[];
  currentSession: string;
}

export default function PromotionModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  availableSessions,
  currentSession,
}: PromotionModalProps) {
  const [fromSession, setFromSession] = useState<string>(() => {
    // Default to previous session if available, or current
    const idx = availableSessions.indexOf(currentSession);
    if (idx > 0) return availableSessions[idx - 1];
    return availableSessions[0] || "2025/2026";
  });
  const [toSession, setToSession] = useState<string>(currentSession || "2026/2027");
  const [step, setStep] = useState<"SELECT" | "PREVIEW" | "SUCCESS">("SELECT");
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePreview = () => {
    if (fromSession === toSession) {
      setActionError("From Session and To Session must be different.");
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const res = await previewSessionPromotionAction(schoolId, fromSession, toSession);
      if (!res.success) {
        setActionError(res.error || "Failed to generate promotion preview.");
      } else {
        setPreviewData(res);
        setStep("PREVIEW");
      }
    });
  };

  const handleConfirmPromotion = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await executeSessionPromotionAction(schoolId, fromSession, toSession);
      if (!res.success) {
        setActionError(res.error || "Failed to execute session promotion.");
      } else {
        setActionSuccess(`Successfully promoted ${res.count} students to session ${toSession}!`);
        setStep("SUCCESS");
      }
    });
  };

  const handleUndoPromotion = () => {
    if (confirm(`Are you sure you want to undo the promotion from ${fromSession} to ${toSession}?`)) {
      setActionError(null);
      startTransition(async () => {
        const res = await undoSessionPromotionAction(schoolId, fromSession, toSession);
        if (!res.success) {
          setActionError(res.error || "Failed to undo session promotion.");
        } else {
          setActionSuccess(`Promotion undone. Reverted ${res.revertedCount} students to their previous classes.`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/80 dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Promote Students to Next Session
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Advances students to the next class level • COHORT and RegNo remain strictly unchanged
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Feedback Banner */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="p-1 hover:bg-rose-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* STEP 1: SELECT SESSIONS */}
        {step === "SELECT" && (
          <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
              <div className="space-y-2">
                <label htmlFor="promo-from-session" className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Promote From Session:
                </label>
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <select
                    id="promo-from-session"
                    value={fromSession}
                    onChange={(e) => setFromSession(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-zinc-100 outline-none cursor-pointer"
                  >
                    {availableSessions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="promo-to-session" className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Promote Into Session:
                </label>
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <select
                    id="promo-to-session"
                    value={toSession}
                    onChange={(e) => setToSession(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-zinc-100 outline-none cursor-pointer"
                  >
                    {availableSessions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-2">
              <div className="font-extrabold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Automatic Progression Rules:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-indigo-800/80 dark:text-indigo-300">
                <li>Primary 1 → Primary 2, Primary 2 → Primary 3, Primary 3 → Primary 4, Primary 4 → Primary 5, Primary 5 → Primary 6</li>
                <li>Final Terminal Grade (Primary 6 / SSS 3) → Automatically transitioned to <strong>ALUMNI (Graduated)</strong></li>
                <li><strong>COHORT and RegNo stay identical</strong> (e.g. Cohort 2026 student moving to Primary 2 remains Cohort 2026).</li>
                <li>Undo is enabled until attendance or grade records are created in the new session.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || fromSession === toSession}
                onClick={handlePreview}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <span>{isPending ? "Generating..." : "Preview Promotion Plan"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW TABLE */}
        {step === "PREVIEW" && previewData && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Enrolled</span>
                <p className="text-xl font-black text-slate-900 dark:text-white">{previewData.totalCount}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-extrabold uppercase text-emerald-600">Advancing Next Level</span>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{previewData.promotedCount}</p>
              </div>
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] font-extrabold uppercase text-blue-600">Graduating to Alumni</span>
                <p className="text-xl font-black text-blue-700 dark:text-blue-300">{previewData.graduatedCount}</p>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Reg Number</th>
                    <th className="p-2.5">COHORT</th>
                    <th className="p-2.5">Current Class ({fromSession})</th>
                    <th className="p-2.5">New Class ({toSession})</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {previewData.students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">{s.name}</td>
                      <td className="p-2.5 font-mono text-slate-500">{s.regNo || "N/A"}</td>
                      <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {s.cohort}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-zinc-400">{s.currentClass}</td>
                      <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                        {s.nextClass}
                      </td>
                      <td className="p-2.5 text-center">
                        {s.isGraduated ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            Graduating (Alumni)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Promoted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setStep("SELECT")}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 transition"
              >
                ← Back
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmPromotion}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPending ? "Executing Promotion..." : `Confirm Promotion to ${toSession}`}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === "SUCCESS" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Session Promotion Complete!
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                All active students have advanced into session <strong>{toSession}</strong>. Their historical COHORT and RegNo remain intact.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleUndoPromotion}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold hover:bg-rose-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo Promotion</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition"
              >
                Done &amp; View Roster
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

