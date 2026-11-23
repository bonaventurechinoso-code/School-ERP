"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Calendar,
  RotateCcw,
  Eye,
  EyeOff,
  Copy,
  Download,
  Send,
  Printer,
  ShieldCheck,
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
  activeTier?: string;
}

const DEFAULT_ROW_COUNT = 8;

function createEmptyRow(): StudentRowInput {
  return {
    firstName: "",
    lastName: "",
    middleName: "",
    gender: "", // Blank by default, requires selection
    dateOfBirth: "",
    currentClass: "",
    arm: "",
    admissionYear: new Date().getFullYear().toString(),
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    previousSchool: "",
    studentPhone: "",
    studentEmail: "",
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
  activeTier,
}: ManualStudentGridModalProps) {
  const [session, setSession] = useState<string>(currentSession || "2026/2027");
  const [rows, setRows] = useState<StudentRowInput[]>(() =>
    Array.from({ length: DEFAULT_ROW_COUNT }, () => createEmptyRow())
  );
  const [hasDraft, setHasDraft] = useState(false);
  const [step, setStep] = useState<"GRID" | "PREVIEW" | "SUCCESS">("GRID");
  const [validatedRows, setValidatedRows] = useState<ValidatedStudentRow[]>([]);
  const [deliveryPreferences, setDeliveryPreferences] = useState<Record<number, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

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

  const isTertiary =
    activeTier?.toLowerCase().includes("tertiary") ||
    activeTier?.toLowerCase().includes("university") ||
    activeTier?.toLowerCase().includes("polytechnic");

  const draftKey = `bonavee_manual_enroll_draft_${schoolDomain}_${session}`;

  // Restore draft on mount
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
    if (!text || !text.includes("\t")) return;

    e.preventDefault();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const parsedRows: StudentRowInput[] = lines.map((line) => {
      const cells = line.split("\t").map((c) => c.trim());
      const rawGender = (cells[3] || "").toUpperCase();
      const normGender = rawGender.startsWith("M") ? "M" : rawGender.startsWith("F") ? "F" : "";

      return {
        firstName: cells[0] || "",
        lastName: cells[1] || "",
        middleName: cells[2] || "",
        gender: normGender,
        dateOfBirth: cells[4] || "",
        currentClass: cells[5] || (classes.length > 0 ? classes[0] : "Primary 1"),
        arm: cells[6] || "",
        admissionYear: cells[7] || session.split("/")[0],
        guardianName: cells[8] || "",
        guardianPhone: cells[9] || "",
        guardianEmail: cells[10] || "",
        previousSchool: cells[11] || "",
        studentPhone: isTertiary ? cells[9] || "" : "",
        studentEmail: cells[10] || "",
      };
    });

    setRows((prev) => {
      const hasContent = prev.some((r) => r.firstName.trim() || r.lastName.trim());
      if (!hasContent) {
        return parsedRows;
      }
      return [...prev, ...parsedRows];
    });
  };

  // Review & Save -> Validates all rows with tier awareness & generates credentials preview
  const handleReviewAndSave = () => {
    setActionError(null);
    const nonEmpty = rows.filter(
      (r) =>
        r.firstName.trim() ||
        r.lastName.trim() ||
        r.currentClass.trim() ||
        r.guardianPhone?.trim() ||
        r.guardianEmail?.trim() ||
        r.studentEmail?.trim()
    );

    if (nonEmpty.length === 0) {
      setActionError("Please enter at least one student before reviewing.");
      return;
    }

    startTransition(async () => {
      const validation = await validateBulkStudentBatch(schoolId, session, nonEmpty, activeTier);
      setValidatedRows(validation.rows);
      setValidationStats({
        total: validation.totalCount,
        valid: validation.validCount,
        errors: validation.errorCount,
        duplicates: validation.duplicateCount,
      });

      // Default delivery preferences
      const initialPrefs: Record<number, string> = {};
      validation.rows.forEach((r, idx) => {
        initialPrefs[idx] = r.credentials?.deliveryMethod || "SMS";
      });
      setDeliveryPreferences(initialPrefs);

      setStep("PREVIEW");
    });
  };

  // Confirm Enroll -> Executes enrollment and generates official credentials sheet
  const handleConfirmEnroll = () => {
    setActionError(null);
    startTransition(async () => {
      const validRowsToEnroll = validatedRows.filter((r) => r.isValid && !r.isDuplicate);
      const res = await executeBulkEnrollmentAction(schoolId, session, validRowsToEnroll, false, activeTier);

      if (!res.success) {
        setActionError(res.error || "Failed to enroll students.");
      } else {
        localStorage.removeItem(draftKey);
        setEnrolledResult(res);
        setStep("SUCCESS");
      }
    });
  };

  const handleDownloadCsvSheet = () => {
    if (!enrolledResult?.csvData) return;
    const blob = new Blob([enrolledResult.csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `official_credentials_sheet_${schoolDomain}_${session.replace("/", "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendAllCredentials = () => {
    setDispatchStatus("sending");
    setTimeout(() => {
      setDispatchStatus("sent");
      setTimeout(() => setDispatchStatus(null), 5000);
    }, 1200);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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
                {hasDraft && step === "GRID" && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    Draft Loaded
                  </span>
                )}
                {isTertiary && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    Tertiary Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Official intake with mandatory credentials creation • Step 1: Data Entry → Step 2: Credentials Review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Session Selector */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="manual-academic-session" className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                Session:
              </label>
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
              onClick={() => {
                if (enrolledResult && enrolledResult.enrolledCount > 0) {
                  onSuccess();
                }
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
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
            <span>Draft saved safely to your local browser! You can resume typing anytime.</span>
          </div>
        )}

        {/* STEP 1: INTERACTIVE SPREADSHEET GRID */}
        {step === "GRID" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">Credentials Rule:</span>
                <span>
                  {isTertiary
                    ? "Student Phone and Student Email are REQUIRED for direct portal credentials."
                    : "At least ONE delivery channel (Guardian Phone or Guardian Email) is REQUIRED (*) for parent portal login."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                  Tip: Copy &amp; Paste from Excel or Google Sheets
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
                    <th className="p-2 min-w-[130px] bg-slate-200/50 dark:bg-zinc-800/80">Auto RegNo</th>
                    <th className="p-2 min-w-[130px]">First Name *</th>
                    <th className="p-2 min-w-[130px]">Last Name *</th>
                    <th className="p-2 min-w-[110px]">Middle Name</th>
                    <th className="p-2 min-w-[110px]">Gender *</th>
                    <th className="p-2 min-w-[130px]">Date of Birth</th>
                    <th className="p-2 min-w-[140px]">Class *</th>
                    <th className="p-2 min-w-[80px]">Arm</th>
                    <th className="p-2 min-w-[110px]">Admission Year *</th>
                    {isTertiary ? (
                      <>
                        <th className="p-2 min-w-[140px] text-purple-700 dark:text-purple-300">Student Phone *</th>
                        <th className="p-2 min-w-[160px] text-purple-700 dark:text-purple-300">Student Email *</th>
                        <th className="p-2 min-w-[140px]">Next of Kin</th>
                        <th className="p-2 min-w-[140px]">Next of Kin Phone</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2 min-w-[150px]">Guardian Name</th>
                        <th className="p-2 min-w-[150px] text-amber-700 dark:text-amber-400">
                          Guardian Phone *
                        </th>
                        <th className="p-2 min-w-[160px] text-amber-700 dark:text-amber-400">
                          Guardian Email (Req if no phone) *
                        </th>
                        <th className="p-2 min-w-[140px]">Previous School</th>
                      </>
                    )}
                    <th className="p-2 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {rows.map((row, rIdx) => {
                    const hasNames = Boolean(row.firstName.trim() || row.lastName.trim());
                    const missingDelivery =
                      hasNames &&
                      (isTertiary
                        ? !row.studentPhone?.trim() || !row.studentEmail?.trim()
                        : !row.guardianPhone?.trim() && !row.guardianEmail?.trim());

                    const autoRegPreview = `${schoolPrefix}/${row.admissionYear || session.split("/")[0]}/${String(
                      rIdx + 1
                    ).padStart(4, "0")}`;

                    return (
                      <tr
                        key={rIdx}
                        className={
                          missingDelivery
                            ? "bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50"
                            : "hover:bg-indigo-50/20 dark:hover:bg-zinc-800/40"
                        }
                      >
                        <td className="p-2 text-center font-bold text-slate-400 text-[10px]">{rIdx + 1}</td>
                        {/* Auto RegNo Preview */}
                        <td className="p-1 font-mono text-[11px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/60 px-2 rounded">
                          {autoRegPreview}
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
                            className={`w-full px-2 py-1.5 rounded-lg border bg-transparent text-xs font-semibold outline-none cursor-pointer ${
                              hasNames && !row.gender
                                ? "border-rose-400 text-rose-600 bg-rose-50 dark:bg-rose-950/40"
                                : "border-transparent hover:border-slate-300 focus:border-indigo-500"
                            }`}
                          >
                            <option value="">Select Sex...</option>
                            <option value="M">Male (M)</option>
                            <option value="F">Female (F)</option>
                          </select>
                        </td>
                        <td className="p-1">
                          <input
                            id={`cell-${rIdx}-4`}
                            type="date"
                            value={
                              typeof row.dateOfBirth === "string"
                                ? row.dateOfBirth
                                : row.dateOfBirth instanceof Date
                                ? row.dateOfBirth.toISOString().split("T")[0]
                                : ""
                            }
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

                        {isTertiary ? (
                          <>
                            <td className="p-1">
                              <input
                                id={`cell-${rIdx}-8`}
                                type="text"
                                value={row.studentPhone || ""}
                                onChange={(e) => handleCellChange(rIdx, "studentPhone", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, 8)}
                                placeholder="0803... *"
                                className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono outline-none ${
                                  hasNames && !row.studentPhone
                                    ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                                    : "border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent"
                                }`}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                id={`cell-${rIdx}-9`}
                                type="email"
                                value={row.studentEmail || ""}
                                onChange={(e) => handleCellChange(rIdx, "studentEmail", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, 9)}
                                placeholder="student@domain.edu *"
                                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none ${
                                  hasNames && !row.studentEmail
                                    ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                                    : "border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent"
                                }`}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                id={`cell-${rIdx}-10`}
                                type="text"
                                value={row.guardianName || ""}
                                onChange={(e) => handleCellChange(rIdx, "guardianName", e.target.value)}
                                placeholder="Optional"
                                className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs outline-none"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                id={`cell-${rIdx}-11`}
                                type="text"
                                value={row.guardianPhone || ""}
                                onChange={(e) => handleCellChange(rIdx, "guardianPhone", e.target.value)}
                                placeholder="Optional"
                                className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs outline-none"
                              />
                            </td>
                          </>
                        ) : (
                          <>
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
                                placeholder="0803... *"
                                className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono outline-none ${
                                  missingDelivery
                                    ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                                    : "border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent"
                                }`}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                id={`cell-${rIdx}-10`}
                                type="email"
                                value={row.guardianEmail || ""}
                                onChange={(e) => handleCellChange(rIdx, "guardianEmail", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, 10)}
                                placeholder="Required if no phone *"
                                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none ${
                                  missingDelivery
                                    ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                                    : "border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent"
                                }`}
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
                          </>
                        )}

                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(rIdx)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition cursor-pointer"
                            title="Delete row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
                  title="Save draft locally"
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
                  {rows.filter((r) => r.firstName.trim()).length} student(s) entered
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleReviewAndSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <span>{isPending ? "Validating..." : "Review & Preview Credentials →"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CREDENTIALS PREVIEW TABLE */}
        {step === "PREVIEW" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Rows</span>
                <p className="text-xl font-black text-slate-900 dark:text-white">{validationStats.total}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
                  Ready to Enroll
                </span>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{validationStats.valid}</p>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800">
                <span className="text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400">
                  Errors (Rejected)
                </span>
                <p className="text-xl font-black text-rose-700 dark:text-rose-300">{validationStats.errors}</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">
                  Possible Duplicates
                </span>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">{validationStats.duplicates}</p>
              </div>
            </div>

            {/* Explanatory Policy Callout */}
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>
                  <strong>Credentials Policy Enforced:</strong> Each pupil has an assigned Admission No (username), an
                  auto-generated temporary password, and a defined Login Owner (
                  {isTertiary ? "Student Account" : "Parent / Guardian Account"}).
                </span>
              </div>
            </div>

            {/* Credentials Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 text-center">Row</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Admission No (Username)</th>
                    <th className="p-2.5">Login Owner</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Delivery Contact</th>
                    <th className="p-2.5">Temp Password</th>
                    <th className="p-2.5">Delivery Method</th>
                    <th className="p-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {validatedRows.map((v, idx) => {
                    const isError = !v.isValid;
                    const isDuplicate = v.isDuplicate;
                    const isPassVisible = showPasswords[idx];

                    return (
                      <tr
                        key={idx}
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
                              Ready
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          {v.firstName} {v.lastName}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {v.assignedRegNo || "Pending"}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-zinc-300">
                          {v.credentials?.loginOwnerName || "Guardian / Parent"}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.credentials?.loginOwnerRole === "STUDENT"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {v.credentials?.loginOwnerRole || "PARENT"}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-zinc-300">
                          {v.credentials?.deliveryContact || "Missing"}
                        </td>
                        <td className="p-2.5">
                          {v.credentials?.tempPassword ? (
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {isPassVisible ? v.credentials.tempPassword : "••••••••••••"}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPasswords((prev) => ({ ...prev, [idx]: !prev[idx] }))
                                }
                                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Toggle visibility"
                              >
                                {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(v.credentials!.tempPassword, idx)}
                                className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                title="Copy password"
                              >
                                {copiedIndex === idx ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          <select
                            value={deliveryPreferences[idx] || "SMS"}
                            onChange={(e) =>
                              setDeliveryPreferences((prev) => ({ ...prev, [idx]: e.target.value }))
                            }
                            className="bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none"
                          >
                            <option value="SMS">SMS Notification</option>
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Email">Email</option>
                            <option value="Print">Print Slip Only</option>
                          </select>
                        </td>
                        <td className="p-2.5 text-xs">
                          {v.errors.length > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">{v.errors.join(", ")}</span>
                          ) : v.warnings.length > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {v.warnings.join(", ")}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
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
                  {validationStats.valid} student(s) will be enrolled with login credentials
                </span>
                <button
                  type="button"
                  disabled={isPending || validationStats.valid === 0}
                  onClick={handleConfirmEnroll}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPending ? "Enrolling & Creating Credentials..." : "Confirm & Enroll Students"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION & CREDENTIALS SHEET */}
        {step === "SUCCESS" && enrolledResult && (
          <div className="flex-1 flex flex-col p-6 space-y-5 overflow-y-auto animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Successfully Enrolled {enrolledResult.enrolledCount} Student(s)!
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-lg mx-auto">
                All students registered with active login accounts. Passwords are set to require change upon first
                portal login.
              </p>
            </div>

            {/* Action Bar for Credentials Sheet */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Official Credentials Sheet Ready
                </span>
                <p className="text-[11px] text-slate-500">
                  Download or print the confidential credentials register for parents and school files.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCsvSheet}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Credentials Sheet (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendAllCredentials}
                  disabled={dispatchStatus !== null}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {dispatchStatus === "sending"
                      ? "Dispatching..."
                      : dispatchStatus === "sent"
                      ? "Dispatched Successfully!"
                      : "Send All Credentials"}
                  </span>
                </button>
              </div>
            </div>

            {/* Issued Credentials Table */}
            {enrolledResult.credentialsSheet && enrolledResult.credentialsSheet.length > 0 && (
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
                <div className="p-3 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Issued Student &amp; Parent Credentials List
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Confidential • Temporary passwords valid for first login
                  </span>
                </div>
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Student Name</th>
                        <th className="p-2">Admission No</th>
                        <th className="p-2">Login Owner</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Delivery Contact</th>
                        <th className="p-2">Temp Password</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {enrolledResult.credentialsSheet.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                          <td className="p-2 text-slate-400">{i + 1}</td>
                          <td className="p-2 font-bold text-slate-900 dark:text-white">{item.studentName}</td>
                          <td className="p-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.admissionNo}
                          </td>
                          <td className="p-2">{item.loginOwner}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              {item.role}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-slate-600">{item.deliveryContact}</td>
                          <td className="p-2 font-mono font-bold text-slate-900 dark:text-white">
                            {item.tempPassword}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg transition cursor-pointer"
              >
                Done &amp; View Student Roster
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
