"use client";

import React, { useState, useRef, useTransition } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calendar,
  FileText,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  StudentRowInput,
  ValidatedStudentRow,
  validateBulkStudentBatch,
  executeBulkEnrollmentAction,
} from "./bulk-enroll-actions";

interface BulkEnrollUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count?: number) => void;
  schoolId: string;
  schoolDomain: string;
  schoolName: string;
  schoolPrefix: string;
  currentSession: string;
  availableSessions: string[];
  classes: string[];
  activeTier?: string;
}

export default function BulkEnrollUploadModal({
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
}: BulkEnrollUploadModalProps) {
  const [session, setSession] = useState<string>(currentSession || "2026/2027");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<"UPLOAD" | "PREVIEW" | "SUCCESS">("UPLOAD");
  const [validatedRows, setValidatedRows] = useState<ValidatedStudentRow[]>([]);
  const [validationStats, setValidationStats] = useState({
    total: 0,
    valid: 0,
    errors: 0,
    duplicates: 0,
  });
  const [isPending, startTransition] = useTransition();
  const [parseError, setParseError] = useState<string | null>(null);
  const [enrolledResult, setEnrolledResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download CSV Template with exact columns & example rows requested
  const handleDownloadTemplate = () => {
    const headers = [
      "First Name",
      "Last Name",
      "Gender",
      "Date of Birth",
      "Class",
      "Guardian Name",
      "Guardian Phone",
    ];

    const sampleClass1 = classes && classes.length > 0 ? classes[0] : "Primary 1";
    const sampleClass2 = classes && classes.length > 1 ? classes[1] : sampleClass1;

    const exampleRows = [
      ["Joseph", "Okonkwo", "M", "2019-05-12", sampleClass1, "Mr Okonkwo", "08031234567"],
      ["Adaeze", "Nnaji", "F", "2018-09-01", sampleClass2, "Mrs Nnaji", "08029876543"],
      ["Emeka", "Okafor", "M", "2018-02-10", sampleClass1, "Mrs Okafor", "08061112233"],
    ];

    const csvContent =
      headers.join(",") +
      "\n" +
      exampleRows
        .map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `student_enrollment_template_${schoolDomain || "school"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust parser for both CSV and XLSX
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError(null);

    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv");
    const isXlsx = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCsv && !isXlsx) {
      setParseError("Unsupported file type. Please upload a .csv or .xlsx Excel file.");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

      if (!jsonData || jsonData.length < 2) {
        setParseError("The uploaded spreadsheet is empty or has no student rows.");
        return;
      }

      // Clean headers for resilient keyword matching
      const rawHeaders = (jsonData[0] as any[]).map((h) =>
        String(h || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      );
      const dataRows = jsonData.slice(1);

      // Map columns by keyword aliases; return -1 if not matched
      const findColIdx = (aliases: string[], fallbackIdx: number = -1): number => {
        const found = rawHeaders.findIndex((h) => aliases.some((a) => h.includes(a)));
        if (found !== -1) return found;
        return fallbackIdx;
      };

      const cFirst = findColIdx(["firstname", "first", "fname"], 0);
      const cLast = findColIdx(["lastname", "last", "surname", "lname"], 1);
      const cGender = findColIdx(["gender", "sex"], 2);
      const cDob = findColIdx(["dateofbirth", "dob", "birth"], 3);
      const cClass = findColIdx(["class", "grade", "classroom"], 4);
      const cGuardian = findColIdx(["guardianname", "guardian", "parentname", "parent"], 5);
      const cPhone = findColIdx(["guardianphone", "phone", "parentphone", "mobile", "tel"], 6);

      // Optional extended columns
      const cMiddle = findColIdx(["middlename", "middle", "mname"]);
      const cArm = findColIdx(["arm", "stream", "section"]);
      const cYear = findColIdx(["admissionyear", "year", "intake", "cohort"]);
      const cEmail = findColIdx(["guardianemail", "email", "parentemail"]);
      const cPrev = findColIdx(["previousschool", "previous"]);

      const parsedStudents: StudentRowInput[] = dataRows
        .map((row: any) => {
          if (!row || !Array.isArray(row)) return null;

          const fn = String(cFirst !== -1 ? row[cFirst] || "" : "").trim();
          const ln = String(cLast !== -1 ? row[cLast] || "" : "").trim();
          if (!fn && !ln) return null; // Ignore completely blank rows

          // Parse DateOfBirth safely if Excel serialized as number
          let dobStr = "";
          if (cDob !== -1 && row[cDob] !== undefined && row[cDob] !== null) {
            if (typeof row[cDob] === "number") {
              const dateObj = XLSX.SSF.parse_date_code(row[cDob]);
              if (dateObj) {
                dobStr = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
              }
            } else {
              dobStr = String(row[cDob]).trim();
            }
          }

          // Resolve intake/admission year from column or active session
          const yearFromCol = cYear !== -1 ? String(row[cYear] || "").trim() : "";
          const resolvedYear =
            yearFromCol || (session ? session.split("/")[0] : new Date().getFullYear().toString());

          return {
            firstName: fn,
            lastName: ln,
            middleName: cMiddle !== -1 ? String(row[cMiddle] || "").trim() : "",
            gender: String(cGender !== -1 ? row[cGender] || "M" : "M")
              .trim()
              .toUpperCase()
              .startsWith("F")
              ? "F"
              : "M",
            dateOfBirth: dobStr,
            currentClass: String(cClass !== -1 ? row[cClass] || "" : "").trim(),
            arm: cArm !== -1 ? String(row[cArm] || "").trim() : "",
            admissionYear: resolvedYear,
            guardianName: cGuardian !== -1 ? String(row[cGuardian] || "").trim() : "",
            guardianPhone: cPhone !== -1 ? String(row[cPhone] || "").trim() : "",
            guardianEmail: cEmail !== -1 ? String(row[cEmail] || "").trim() : "",
            previousSchool: cPrev !== -1 ? String(row[cPrev] || "").trim() : "",
          };
        })
        .filter(Boolean) as StudentRowInput[];

      if (parsedStudents.length === 0) {
        setParseError("Could not find any student records in the file.");
        return;
      }

      // Run server validation with tier awareness
      startTransition(async () => {
        const validation = await validateBulkStudentBatch(schoolId, session, parsedStudents, activeTier);
        setValidatedRows(validation.rows);
        setValidationStats({
          total: validation.totalCount,
          valid: validation.validCount,
          errors: validation.errorCount,
          duplicates: validation.duplicateCount,
        });
        setStep("PREVIEW");
      });
    } catch (err: any) {
      console.error("Error parsing file:", err);
      setParseError("Failed to parse file. Please verify it matches the template format.");
    }
  };

  // Confirm Enroll -> Server Action
  const handleConfirmEnroll = () => {
    setParseError(null);
    startTransition(async () => {
      const validRowsToEnroll = validatedRows.filter((r) => r.isValid && !r.isDuplicate);
      const res = await executeBulkEnrollmentAction(schoolId, session, validRowsToEnroll, true, activeTier);

      if (!res.success) {
        setParseError(res.error || "Failed to enroll students.");
      } else {
        setEnrolledResult(res);
        setStep("SUCCESS");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Bulk Enroll Students (CSV / Excel Upload)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Upload existing computer spreadsheets (.csv or .xlsx) • Auto-creates Cohorts &amp; Reg Numbers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Session Selector */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="bulk-upload-academic-session" className="text-xs font-bold text-slate-600 dark:text-zinc-300">Session:</label>
              <select
                id="bulk-upload-academic-session"
                value={session}
                disabled={step !== "UPLOAD"}
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
                  onSuccess(enrolledResult.enrolledCount);
                }
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {parseError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{parseError}</span>
            </div>
            <button onClick={() => setParseError(null)} className="p-1 hover:bg-rose-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* STEP 1: FILE UPLOAD & TEMPLATE DOWNLOAD */}
        {step === "UPLOAD" && (
          <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
            {/* Step 1: Download Template */}
            <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
                  Step 1: Download Official CSV Template
                </h4>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300">
                  Pre-formatted with exact column order: FirstName, LastName, Gender, Class, AdmissionYear, GuardianPhone, etc.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-4 h-4" />
                <span>Download Template (.CSV)</span>
              </button>
            </div>

            {/* Step 2: Upload Zone */}
            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200">
                Step 2: Upload Filled CSV or Excel File
              </h4>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition bg-slate-50/50 dark:bg-zinc-950/50 hover:bg-indigo-50/10"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-4 shadow-sm">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>

                <h5 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Click to select file or drag and drop
                </h5>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
                  Accepts <strong>.csv</strong> or <strong>.xlsx</strong> files. The first sheet will be processed automatically.
                </p>

                <span className="inline-block px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-xs">
                  Choose File from Computer
                </span>
              </div>
            </div>

            {/* Notice regarding cohort definition */}
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-zinc-800/60 text-xs text-slate-600 dark:text-zinc-400 space-y-1 border border-slate-200 dark:border-zinc-700">
              <p className="font-bold text-slate-800 dark:text-zinc-200">Important Rules:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li><strong>AdmissionYear</strong> is required for every row (defines student COHORT).</li>
                <li>Classes must match your school&apos;s active tier (e.g. {classes.slice(0, 4).join(", ")}).</li>
                <li>Nigerian phone numbers (0803... or +234...) will be normalized automatically.</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & ERROR VALIDATION TABLE */}
        {step === "PREVIEW" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            {/* Stats */}
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

            {/* Table */}
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

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setStep("UPLOAD");
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
              >
                ← Upload Different File
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
                File upload processed. All students are now enrolled in Session <strong>{session}</strong> with auto-assigned official registration numbers and COHORT.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 max-w-md w-full text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">School Code:</span>
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
                onSuccess(enrolledResult.enrolledCount);
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition cursor-pointer"
            >
              Done &amp; View Student Roster
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

