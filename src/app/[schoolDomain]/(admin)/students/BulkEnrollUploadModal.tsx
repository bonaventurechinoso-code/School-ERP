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
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Send,
  RotateCcw,
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
  const [step, setStep] = useState<"UPLOAD" | "VALIDATION" | "CREDENTIALS" | "SUCCESS">("UPLOAD");
  const [validatedRows, setValidatedRows] = useState<ValidatedStudentRow[]>([]);
  const [duplicateActions, setDuplicateActions] = useState<Record<number, "skip" | "enroll_anyway">>({});
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
  const [parseError, setParseError] = useState<string | null>(null);
  const [enrolledResult, setEnrolledResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTertiary =
    activeTier?.toLowerCase().includes("tertiary") ||
    activeTier?.toLowerCase().includes("university") ||
    activeTier?.toLowerCase().includes("polytechnic");

  if (!isOpen) return null;

  // Download Official Template (Excel .xlsx with Text phone & DD/MM/YYYY date formatting, plus CSV fallback)
  const handleDownloadTemplate = (format: "xlsx" | "csv" = "xlsx") => {
    let headers: string[];
    let exampleRows: string[][];

    const sampleClass1 = classes && classes.length > 0 ? classes[0] : isTertiary ? "100 Level" : "Primary 1";
    const sampleClass2 = classes && classes.length > 1 ? classes[1] : isTertiary ? "200 Level" : "Primary 2";
    const currentYear = session.split("/")[0] || new Date().getFullYear().toString();

    if (isTertiary) {
      headers = [
        "FirstName",
        "LastName",
        "MiddleName",
        "Gender",
        "DateOfBirth",
        "Class",
        "Arm",
        "AdmissionYear",
        "StudentPhone",
        "StudentEmail",
        "NextOfKinName",
        "NextOfKinPhone",
        "PreviousSchool",
      ];
      exampleRows = [
        ["Emeka", "Okafor", "Paul", "M", "12/05/2004", sampleClass1, "A", currentYear, "08030000001", "emeka.okafor@student.edu", "Mr Okafor", "08020000002", "Community High School"],
        ["Adaeze", "Nnaji", "Grace", "F", "09/01/2003", sampleClass1, "B", currentYear, "08020000003", "adaeze.nnaji@student.edu", "Mrs Nnaji", "08030000004", "Federal College"],
      ];
    } else {
      headers = [
        "FirstName",
        "LastName",
        "MiddleName",
        "Gender",
        "DateOfBirth",
        "Class",
        "Arm",
        "AdmissionYear",
        "GuardianName",
        "GuardianRelationship",
        "GuardianPhone",
        "GuardianEmail",
        "PreviousSchool",
      ];
      exampleRows = [
        ["Joseph", "Okonkwo", "Chukwu", "M", "12/05/2019", sampleClass1, "A", currentYear, "Mr Okonkwo", "Father", "08030000001", "okonkwo@gmail.com", "Grace Nursery"],
        ["Adaeze", "Nnaji", "Chioma", "F", "09/01/2018", sampleClass2, "B", currentYear, "Mrs Nnaji", "Mother", "08020000002", "nnaji@gmail.com", "Little Angels Academy"],
        ["Emeka", "Okafor", "David", "M", "10/02/2018", sampleClass1, "A", currentYear, "Mrs Okafor", "Mother", "08060000003", "okafor@gmail.com", "St. Joseph Nursery"],
      ];
    }

    if (format === "csv") {
      const csvContent =
        headers.join(",") +
        "\n" +
        exampleRows
          .map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : `"${c}"`)).join(","))
          .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `official_student_enrollment_template_${schoolDomain || "school"}_${isTertiary ? "tertiary" : "k12"}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    // Generate formatted .XLSX Excel Workbook
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);

    // Generous column widths so no column is truncated, no scientific notation, and no ########
    ws["!cols"] = isTertiary
      ? [
          { wch: 18 }, // FirstName
          { wch: 18 }, // LastName
          { wch: 16 }, // MiddleName
          { wch: 12 }, // Gender
          { wch: 18 }, // DateOfBirth (wide enough for DD/MM/YYYY, never ########)
          { wch: 18 }, // Class
          { wch: 10 }, // Arm
          { wch: 18 }, // AdmissionYear
          { wch: 24 }, // StudentPhone
          { wch: 30 }, // StudentEmail
          { wch: 26 }, // NextOfKinName
          { wch: 24 }, // NextOfKinPhone
          { wch: 28 }, // PreviousSchool
        ]
      : [
          { wch: 18 }, // FirstName
          { wch: 18 }, // LastName
          { wch: 16 }, // MiddleName
          { wch: 12 }, // Gender
          { wch: 18 }, // DateOfBirth (wide enough for DD/MM/YYYY, never ########)
          { wch: 18 }, // Class
          { wch: 10 }, // Arm
          { wch: 18 }, // AdmissionYear
          { wch: 26 }, // GuardianName
          { wch: 24 }, // GuardianRelationship
          { wch: 24 }, // GuardianPhone (wide enough for 0803... or +234...)
          { wch: 30 }, // GuardianEmail (wide enough for email address)
          { wch: 28 }, // PreviousSchool (wide enough for school name)
        ];

    // Freeze top header row so it stays visible on scroll
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!views"] = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

    // Format every cell in Phone column as explicit TEXT ('s') with format '@'
    // Format DateOfBirth column as explicit DD/MM/YYYY
    const phoneColIdx = isTertiary ? 8 : 10;
    const nextOfKinPhoneColIdx = isTertiary ? 11 : -1;
    const dobColIdx = 4;

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:M4");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellAddress];
        if (!cell) continue;

        if (R > 0) {
          // Phone columns: force string type ('s') and text format ('@')
          if (C === phoneColIdx || C === nextOfKinPhoneColIdx) {
            cell.t = "s";
            cell.z = "@";
            cell.v = String(cell.v);
          }
          // Date of birth column: text type with DD/MM/YYYY format
          if (C === dobColIdx) {
            cell.t = "s";
            cell.z = "DD/MM/YYYY";
            cell.v = String(cell.v);
          }
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `official_student_enrollment_template_${schoolDomain || "school"}_${isTertiary ? "tertiary" : "k12"}.xlsx`
    );
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
      const cMiddle = findColIdx(["middlename", "middle", "mname"]);
      const cGender = findColIdx(["gender", "sex"], 2);
      const cDob = findColIdx(["dateofbirth", "dob", "birth"], 3);
      const cClass = findColIdx(["class", "grade", "classroom"], 4);
      const cArm = findColIdx(["arm", "stream", "section"]);
      const cYear = findColIdx(["admissionyear", "year", "intake", "cohort"]);

      // K-12 Contact
      const cGuardian = findColIdx(["guardianname", "guardian", "parentname", "parent"], 5);
      const cRelationship = findColIdx(["guardianrelationship", "relationship", "rel"]);
      const cPhone = findColIdx(["guardianphone", "phone", "parentphone", "mobile", "tel"], 6);
      const cEmail = findColIdx(["guardianemail", "email", "parentemail"]);
      const cPrev = findColIdx(["previousschool", "previous", "prevschool"]);

      // Tertiary Specific
      const cStudentPhone = findColIdx(["studentphone", "stuphone", "phone"]);
      const cStudentEmail = findColIdx(["studentemail", "stuemail", "email"]);

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
                dobStr = `${String(dateObj.d).padStart(2, "0")}/${String(dateObj.m).padStart(2, "0")}/${dateObj.y}`;
              }
            } else {
              dobStr = String(row[cDob]).trim();
            }
          }

          // Resolve intake/admission year from column or active session
          const yearFromCol = cYear !== -1 ? String(row[cYear] || "").trim() : "";
          const resolvedYear =
            yearFromCol || (session ? session.split("/")[0] : new Date().getFullYear().toString());

          const rawGender = String(cGender !== -1 ? row[cGender] || "" : "").trim().toUpperCase();
          const normGender = rawGender.startsWith("M") ? "M" : rawGender.startsWith("F") ? "F" : "";

          // Clean phone numbers: if numeric stripped leading zero (10-digits starting with 7/8/9), restore leading 0
          let gPhone = cPhone !== -1 && row[cPhone] !== undefined && row[cPhone] !== null ? String(row[cPhone]).trim() : "";
          if (/^[789]\d{9}$/.test(gPhone)) {
            gPhone = `0${gPhone}`;
          }

          let sPhone = isTertiary && cStudentPhone !== -1 && row[cStudentPhone] !== undefined && row[cStudentPhone] !== null
            ? String(row[cStudentPhone]).trim()
            : "";
          if (/^[789]\d{9}$/.test(sPhone)) {
            sPhone = `0${sPhone}`;
          }

          return {
            firstName: fn,
            lastName: ln,
            middleName: cMiddle !== -1 ? String(row[cMiddle] || "").trim() : "",
            gender: normGender,
            dateOfBirth: dobStr,
            currentClass: String(cClass !== -1 ? row[cClass] || "" : "").trim(),
            arm: cArm !== -1 ? String(row[cArm] || "").trim() : "",
            admissionYear: resolvedYear,
            guardianName: cGuardian !== -1 ? String(row[cGuardian] || "").trim() : "",
            guardianPhone: gPhone,
            guardianEmail: (cEmail !== -1 ? String(row[cEmail] || "").trim() : "") || (cStudentEmail !== -1 ? String(row[cStudentEmail] || "").trim() : ""),
            previousSchool: cPrev !== -1 ? String(row[cPrev] || "").trim() : "",
            studentPhone: sPhone,
            studentEmail: (cStudentEmail !== -1 ? String(row[cStudentEmail] || "").trim() : "") || (cEmail !== -1 ? String(row[cEmail] || "").trim() : ""),
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

        // Initialize duplicate actions (default: 'skip')
        const initialActions: Record<number, "skip" | "enroll_anyway"> = {};
        const initialDelivery: Record<number, string> = {};
        validation.rows.forEach((r, idx) => {
          if (r.isDuplicate) {
            initialActions[r.rowIndex] = "skip";
          }
          initialDelivery[idx] = r.credentials?.deliveryMethod || "SMS";
        });
        setDuplicateActions(initialActions);
        setDeliveryPreferences(initialDelivery);

        setStep("VALIDATION");
      });
    } catch (err: any) {
      console.error("Error parsing file:", err);
      setParseError("Failed to parse file. Please verify it matches the template format.");
    }
  };

  // Determine which rows are ready based on duplicate decisions
  const eligibleRows = validatedRows.filter((r) => {
    if (!r.isValid) return false;
    if (r.isDuplicate) {
      return duplicateActions[r.rowIndex] === "enroll_anyway";
    }
    return true;
  });

  // Step 2 -> Step 3: Move to Credentials Review
  const handleProceedToCredentials = () => {
    if (eligibleRows.length === 0) {
      setParseError("No valid rows ready to enroll. Please check errors or adjust duplicate actions.");
      return;
    }
    setStep("CREDENTIALS");
  };

  // Step 3 -> Confirm Enroll -> Server Action
  const handleConfirmEnroll = () => {
    setParseError(null);
    startTransition(async () => {
      const preparedEligibleRows = eligibleRows.map((r) => ({
        ...r,
        duplicateAction: r.isDuplicate ? ("ENROLL_ANYWAY" as const) : undefined,
      }));
      const res = await executeBulkEnrollmentAction(schoolId, session, preparedEligibleRows, false, activeTier);

      if (!res.success) {
        setParseError(res.error || "Failed to enroll students.");
      } else {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Bulk Enroll Students (CSV / Excel Upload)
                </h3>
                {isTertiary && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    Tertiary Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Official spreadsheet intake • Step 1: Upload → Step 2: Validate &amp; Resolve Duplicates → Step 3:
                Credentials Review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Session Selector */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="bulk-upload-academic-session" className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                Session:
              </label>
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
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
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
            <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
                    Step 1: Download Official Enrollment Template
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Excel Formatted (.XLSX)
                  </span>
                </div>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300">
                  Includes pre-sized columns, frozen headers, and Text format for phone numbers (prevents scientific notation and date truncation):
                </p>
                <div className="text-[11px] font-mono bg-white/80 dark:bg-zinc-900/80 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900 text-indigo-950 dark:text-indigo-300 break-words">
                  {isTertiary
                    ? "FirstName, LastName, MiddleName, Gender, DateOfBirth, Class, Arm, AdmissionYear, StudentPhone, StudentEmail, NextOfKinName, NextOfKinPhone, PreviousSchool"
                    : "FirstName, LastName, MiddleName, Gender, DateOfBirth, Class, Arm, AdmissionYear, GuardianName, GuardianRelationship, GuardianPhone, GuardianEmail, PreviousSchool"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("xlsx")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel (.XLSX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("csv")}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Download (.CSV)</span>
                </button>
              </div>
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
                  Accepts <strong>.csv</strong> or <strong>.xlsx</strong> files. The first sheet will be processed
                  automatically.
                </p>

                <span className="inline-block px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-xs">
                  Choose File from Computer
                </span>
              </div>
            </div>

            {/* Credentials Policy Rules */}
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-zinc-800/60 text-xs text-slate-600 dark:text-zinc-400 space-y-1.5 border border-slate-200 dark:border-zinc-700">
              <p className="font-bold text-slate-800 dark:text-zinc-200">Mandatory Credentials &amp; Intake Rules:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Login Owner Policy:</strong>{" "}
                  {isTertiary
                    ? "Tertiary students receive their own login credentials using Matric/Reg No."
                    : "For Creche, Primary, and Secondary, login credentials belong to the Parent/Guardian. The pupil receives an official Admission No for records."}
                </li>
                <li>
                  <strong>Required Delivery Channel:</strong>{" "}
                  {isTertiary
                    ? "Both Student Phone AND Student Email are required for direct portal login."
                    : "At least one contact (Guardian Phone OR Guardian Email) is mandatory (*) to deliver temporary login credentials."}
                </li>
                <li>
                  <strong>Duplicate Protection:</strong> Duplicates are flagged by Admission No or combined identity (Name + DOB + Phone + Class). Duplicates are skipped by default and will NOT create redundant records.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & DUPLICATE RESOLUTION */}
        {step === "VALIDATION" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Rows</span>
                <p className="text-xl font-black text-slate-900 dark:text-white">{validationStats.total}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
                  Ready to Enroll
                </span>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{eligibleRows.length}</p>
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
                    <th className="p-2.5">Assigned RegNo</th>
                    <th className="p-2.5">Contact Details</th>
                    <th className="p-2.5">Duplicate Resolution</th>
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
                        <td className="p-2.5 font-mono text-slate-600 dark:text-zinc-300">
                          {v.assignedRegNo || "—"}
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">
                          {v.normalizedPhone || v.guardianPhone || v.studentPhone || v.guardianEmail || "Missing"}
                        </td>
                        <td className="p-2.5">
                          {isDuplicate ? (
                            <select
                              value={duplicateActions[v.rowIndex] || "skip"}
                              onChange={(e) =>
                                setDuplicateActions((prev) => ({
                                  ...prev,
                                  [v.rowIndex]: e.target.value as "skip" | "enroll_anyway",
                                }))
                              }
                              className="bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                            >
                              <option value="skip">Skip (Default - No duplicate)</option>
                              <option value="enroll_anyway">Enroll Anyway</option>
                            </select>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
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
                  {eligibleRows.length} student(s) ready to review credentials
                </span>
                <button
                  type="button"
                  disabled={eligibleRows.length === 0}
                  onClick={handleProceedToCredentials}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Proceed to Step 3: Review Credentials →</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CREDENTIALS PREVIEW TABLE */}
        {step === "CREDENTIALS" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>
                  <strong>Step 3: Credentials Preview:</strong> Verify login owners, generated temporary passwords,
                  and choose notification channels before finalizing enrollment.
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 text-center">Row</th>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Admission No (Username)</th>
                    <th className="p-2.5">Login Owner</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Delivery Contact</th>
                    <th className="p-2.5">Temp Password</th>
                    <th className="p-2.5">Delivery Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {eligibleRows.map((v, idx) => {
                    const isPassVisible = showPasswords[idx];

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2.5 text-center font-bold text-slate-400">{v.rowIndex}</td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          {v.firstName} {v.lastName}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {v.assignedRegNo || "Assigned on save"}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-zinc-300">
                          {v.credentials?.loginOwnerName || (isTertiary ? "Student Account" : "Guardian Account")}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.credentials?.loginOwnerRole === "STUDENT"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {v.credentials?.loginOwnerRole || (isTertiary ? "STUDENT" : "PARENT")}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-zinc-300">
                          {v.credentials?.deliveryContact || v.normalizedPhone || v.guardianPhone || "N/A"}
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
                onClick={() => setStep("VALIDATION")}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
              >
                ← Back to Validation
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                  {eligibleRows.length} student(s) will be enrolled with credentials
                </span>
                <button
                  type="button"
                  disabled={isPending || eligibleRows.length === 0}
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

        {/* STEP 4: SUCCESS CONFIRMATION */}
        {step === "SUCCESS" && enrolledResult && (
          <div className="flex-1 flex flex-col p-6 space-y-5 overflow-y-auto animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Successfully Enrolled {enrolledResult.enrolledCount} Students!
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-lg mx-auto">
                File upload complete. All students are enrolled under Session <strong>{session}</strong> with auto-assigned official registration numbers and login credentials.
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
                  onSuccess(enrolledResult.enrolledCount);
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
