"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Clipboard,
  Calendar,
  Layers,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import {
  StudentRowInput,
  ValidatedStudentRow,
  validateBulkStudentBatch,
  executeBulkEnrollmentAction,
} from "./bulk-enroll-actions";

interface ManualStudentGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  schoolDomain: string;
  schoolName: string;
  schoolPrefix: string;
  currentSession: string;
  availableSessions: string[];
  classes: string[];
}

const DEFAULT_ROW_COUNT = 10;

function createEmptyRow(): StudentRowInput {
  return {
    firstName: "",
    lastName: "",
    middleName: "",
    gender: "M",
    dateOfBirth: "",
    currentClass: "",
    arm: "",
    admissionYear: new Date().getFullYear().toString(),
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    previousSchool: "",
  };
}

export default function ManualStudentGridModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  schoolDomain,
  schoolName,
  schoolPrefix,
  currentSession,
  availableSessions,
  classes,
}: ManualStudentGridModalProps) {
  const [session, setSession] = useState<string>(currentSession || "2026/2027");
  const [rows, setRows] = useState<StudentRowInput[]>(() =>
    Array.from({ length: DEFAULT_ROW_COUNT }, () => createEmptyRow())
  );
  const [hasDraft, setHasDraft] = useState(false);
  const [step, setStep] = useState<"GRID" | "PREVIEW" | "SUCCESS">("GRID");
  const [validatedRows, setValidatedRows] = useState<ValidatedStudentRow[]>([]);
  const [validationStats, setValidationStats] = useState({
    total: 0,
    valid: 0,
    errors: 0,
    duplicates: 0,
  });
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [enrolledResult, setEnrolledResult] = useState<any>(null);
  const [draftSavedMsg, setDraftSavedMsg] = useState(false);

  const draftKey = `bonavee_manual_enroll_draft_${schoolDomain}_${session}`;

  // Restore draft on mount or when session changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRows(parsed);
          setHasDraft(true);
        }
      } else {
        setHasDraft(false);
      }
    } catch {}
  }, [isOpen, session, draftKey]);

  if (!isOpen) return null;

  const handleCellChange = (rowIndex: number, field: keyof StudentRowInput, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleDeleteRow = (index: number) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow()]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Draft to LocalStorage
  const handleSaveDraft = () => {
    try {
      const nonEmptyRows = rows.filter(
        (r) => r.firstName.trim() || r.lastName.trim() || r.guardianPhone?.trim()
      );
      localStorage.setItem(draftKey, JSON.stringify(rows));
      setHasDraft(true);
      setDraftSavedMsg(true);
      setTimeout(() => setDraftSavedMsg(false), 3000);
    } catch (e) {
      console.error("Draft save failed:", e);
    }
  };

  const handleClearDraft = () => {
    if (confirm("Are you sure you want to discard this draft? All typed rows will be reset.")) {
      localStorage.removeItem(draftKey);
      setRows(Array.from({ length: DEFAULT_ROW_COUNT }, () => createEmptyRow()));
      setHasDraft(false);
    }
  };

  // Excel / Google Sheets Paste Handler
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !text.includes("\t")) return; // Only process table paste

    e.preventDefault();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const parsedRows: StudentRowInput[] = lines.map((line) => {
      const cells = line.split("\t").map((c) => c.trim());
      return {
        firstName: cells[0] || "",
        lastName: cells[1] || "",
        middleName: cells[2] || "",
        gender: (cells[3] || "M").toUpperCase().startsWith("F") ? "F" : "M",
        dateOfBirth: cells[4] || "",
        currentClass: cells[5] || (classes.length > 0 ? classes[0] : "Primary 1"),
        arm: cells[6] || "",
        admissionYear: cells[7] || new Date().getFullYear().toString(),
        guardianName: cells[8] || "",
        guardianPhone: cells[9] || "",
        guardianEmail: cells[10] || "",
        previousSchool: cells[11] || "",
      };
    });

    setRows((prev) => {
      // If the current rows are mostly empty, replace with parsed rows
      const hasContent = prev.some((r) => r.firstName.trim() || r.lastName.trim());
      if (!hasContent) {
        return parsedRows;
      }
      return [...prev, ...parsedRows];
    });
  };

  // Review & Save -> Validates all rows
  const handleReviewAndSave = () => {
    setActionError(null);
    const nonEmpty = rows.filter(
      (r) => r.firstName.trim() || r.lastName.trim() || r.currentClass.trim() || r.guardianPhone?.trim()
    );

    if (nonEmpty.length === 0) {
      setActionError("Please enter at least one student before reviewing.");
      return;
    }

    startTransition(async () => {
      const validation = await validateBulkStudentBatch(schoolId, session, nonEmpty);
      setValidatedRows(validation.rows);
      setValidationStats({
        total: validation.totalCount,
        valid: validation.validCount,
        errors: validation.errorCount,
        duplicates: validation.duplicateCount,
      });
      setStep("PREVIEW");
    });
  };

  // Confirm Enroll -> Server Action
  const handleConfirmEnroll = () => {
    setActionError(null);
    startTransition(async () => {
      const validRowsToEnroll = validatedRows.filter((r) => r.isValid && !r.isDuplicate);
      const res = await executeBulkEnrollmentAction(schoolId, session, validRowsToEnroll, true);

      if (!res.success) {
        setActionError(res.error || "Failed to enroll students.");
      } else {
        localStorage.removeItem(draftKey);
        setEnrolledResult(res);
        setStep("SUCCESS");
      }
    });
  };

  // Keyboard Navigation: Enter moves down, Tab moves right
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = document.getElementById(`cell-${rowIndex + 1}-${colIndex}`);
      if (nextInput) {
        nextInput.focus();
      } else if (rowIndex === rows.length - 1) {
        handleAddRow();
        setTimeout(() => {
          const addedInput = document.getElementById(`cell-${rowIndex + 1}-${colIndex}`);
          addedInput?.focus();
        }, 50);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Add Students Manually (Grid Entry)
                </h3>
                {hasDraft && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    Draft Loaded
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Type directly from your school&apos;s physical paper register • Auto-calculates RegNo &amp; COHORT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Session Selector */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="manual-academic-session" className="text-xs font-bold text-slate-600 dark:text-zinc-300">Session:</label>
              <select
                id="manual-academic-session"
                value={session}
                disabled={step !== "GRID"}
                onChange={(e) => setSession(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                {availableSessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action / Error Banner */}
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

        {draftSavedMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Draft saved safely to your local browser! You can safely close or resume anytime.</span>
          </div>
        )}

        {/* STEP 1: INTERACTIVE SPREADSHEET GRID */}
        {step === "GRID" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="font-bold">Instructions:</span>
                <span>Type directly into cells. Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded border font-mono">Tab</kbd> to move right, <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded border font-mono">Enter</kbd> to jump down.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                  Tip: Copy &amp; Paste directly from Excel or Google Sheets
                </span>
              </div>
            </div>

            {/* In-Browser Spreadsheet */}
            <div
              onPaste={handlePaste}
              className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950"
            >
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2 text-center w-10">#</th>
                    <th className="p-2 min-w-[130px]">First Name *</th>
                    <th className="p-2 min-w-[130px]">Last Name *</th>
                    <th className="p-2 min-w-[110px]">Middle Name</th>
                    <th className="p-2 min-w-[90px]">Gender *</th>
                    <th className="p-2 min-w-[130px]">Date of Birth</th>
                    <th className="p-2 min-w-[140px]">Class *</th>
                    <th className="p-2 min-w-[80px]">Arm</th>
                    <th className="p-2 min-w-[110px]">Admission Year *</th>
                    <th className="p-2 min-w-[150px]">Guardian Name</th>
                    <th className="p-2 min-w-[140px]">Guardian Phone</th>
                    <th className="p-2 min-w-[160px]">Guardian Email</th>
                    <th className="p-2 min-w-[140px]">Previous School</th>
                    <th className="p-2 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-indigo-50/20 dark:hover:bg-zinc-800/40">
                      <td className="p-2 text-center font-bold text-slate-400 text-[10px]">
                        {rIdx + 1}
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-0`}
                          type="text"
                          value={row.firstName}
                          onChange={(e) => handleCellChange(rIdx, "firstName", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 0)}
                          placeholder="e.g. Joseph"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-semibold outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-1`}
                          type="text"
                          value={row.lastName}
                          onChange={(e) => handleCellChange(rIdx, "lastName", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 1)}
                          placeholder="e.g. Okonkwo"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-semibold outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-2`}
                          type="text"
                          value={row.middleName || ""}
                          onChange={(e) => handleCellChange(rIdx, "middleName", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 2)}
                          placeholder="Optional"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-medium outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <select
                          id={`cell-${rIdx}-3`}
                          value={row.gender}
                          onChange={(e) => handleCellChange(rIdx, "gender", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-semibold outline-none cursor-pointer"
                        >
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-4`}
                          type="date"
                          value={row.dateOfBirth || ""}
                          onChange={(e) => handleCellChange(rIdx, "dateOfBirth", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 4)}
                          className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-semibold outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <select
                          id={`cell-${rIdx}-5`}
                          value={row.currentClass}
                          onChange={(e) => handleCellChange(rIdx, "currentClass", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-semibold outline-none cursor-pointer"
                        >
                          <option value="">Select Class...</option>
                          {classes.map((cls) => (
                            <option key={cls} value={cls}>
                              {cls}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-6`}
                          type="text"
                          value={row.arm || ""}
                          onChange={(e) => handleCellChange(rIdx, "arm", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 6)}
                          placeholder="e.g. A"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-semibold outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-7`}
                          type="text"
                          value={row.admissionYear}
                          onChange={(e) => handleCellChange(rIdx, "admissionYear", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 7)}
                          placeholder="2026"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-8`}
                          type="text"
                          value={row.guardianName || ""}
                          onChange={(e) => handleCellChange(rIdx, "guardianName", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 8)}
                          placeholder="e.g. Mr Okonkwo"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-medium outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-9`}
                          type="text"
                          value={row.guardianPhone || ""}
                          onChange={(e) => handleCellChange(rIdx, "guardianPhone", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 9)}
                          placeholder="0803..."
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs font-mono outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-10`}
                          type="email"
                          value={row.guardianEmail || ""}
                          onChange={(e) => handleCellChange(rIdx, "guardianEmail", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 10)}
                          placeholder="Optional"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          id={`cell-${rIdx}-11`}
                          type="text"
                          value={row.previousSchool || ""}
                          onChange={(e) => handleCellChange(rIdx, "previousSchool", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 11)}
                          placeholder="Optional"
                          className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs outline-none"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rIdx)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grid Controls Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>+ Add Row</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
                  title="Save draft locally so you can resume typing anytime"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Save Draft</span>
                </button>
                {hasDraft && (
                  <button
                    type="button"
                    onClick={handleClearDraft}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Discard Draft</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">
                  {rows.filter((r) => r.firstName.trim()).length} students entered
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleReviewAndSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <span>{isPending ? "Validating..." : "Review & Save"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & ERROR VALIDATION TABLE */}
        {step === "PREVIEW" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Rows</span>
                <p className="text-xl font-black text-slate-900 dark:text-white">{validationStats.total}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Ready to Enroll</span>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{validationStats.valid}</p>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800">
                <span className="text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400">Errors (Rejected)</span>
                <p className="text-xl font-black text-rose-700 dark:text-rose-300">{validationStats.errors}</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Possible Duplicates</span>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">{validationStats.duplicates}</p>
              </div>
            </div>

            {/* Validation Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 text-center">Row</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Class &amp; Arm</th>
                    <th className="p-2.5">COHORT</th>
                    <th className="p-2.5">Guardian Phone</th>
                    <th className="p-2.5">Validation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {validatedRows.map((v) => {
                    const isError = !v.isValid;
                    const isDuplicate = v.isDuplicate;

                    return (
                      <tr
                        key={v.rowIndex}
                        className={
                          isError
                            ? "bg-rose-50/40 dark:bg-rose-950/30"
                            : isDuplicate
                            ? "bg-amber-50/40 dark:bg-amber-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                        }
                      >
                        <td className="p-2.5 text-center font-bold text-slate-400">{v.rowIndex}</td>
                        <td className="p-2.5">
                          {isError ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              Error
                            </span>
                          ) : isDuplicate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Valid
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          {v.firstName} {v.lastName}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-zinc-300">
                          {v.currentClass} {v.arm ? `(Arm ${v.arm})` : ""}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {v.admissionYear}
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">
                          {v.normalizedPhone || v.guardianPhone || "N/A"}
                        </td>
                        <td className="p-2.5 text-xs">
                          {v.errors.length > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              {v.errors.join(", ")}
                            </span>
                          )}
                          {v.warnings.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {v.warnings.join(", ")}
                            </span>
                          )}
                          {v.errors.length === 0 && v.warnings.length === 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Ready for automatic enrollment
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Preview Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("GRID")}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
              >
                ← Back to Edit Grid
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                  {validationStats.valid} valid students will be enrolled
                </span>
                <button
                  type="button"
                  disabled={isPending || validationStats.valid === 0}
                  onClick={handleConfirmEnroll}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPending ? "Enrolling..." : "Confirm & Enroll Students"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === "SUCCESS" && enrolledResult && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Successfully Enrolled {enrolledResult.enrolledCount} Students!
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                All records have been registered under Session <strong>{session}</strong> with auto-assigned official registration numbers and COHORT.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 max-w-md w-full text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">School Code Prefix:</span>
                <span className="font-mono font-bold">{schoolPrefix}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Enrolled:</span>
                <span className="font-bold text-emerald-600">{enrolledResult.enrolledCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Skipped / Duplicates:</span>
                <span className="font-bold text-amber-600">{enrolledResult.skippedCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition"
            >
              Done &amp; View Student Roster
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

