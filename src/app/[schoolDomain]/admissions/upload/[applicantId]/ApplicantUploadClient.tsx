"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Building2,
  X,
  ExternalLink,
  ArrowRight,
  Sparkles,
  CreditCard,
  Clock,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";

export type ChecklistKey =
  | "applicationFeeReceipt"
  | "passportPhoto"
  | "birthCertificate"
  | "academicResults"
  | "ninSlip"
  | "medicalRecords";

export interface ChecklistSlot {
  key: ChecklistKey;
  label: string;
  subLabel?: string;
  mandatory: boolean;
  acceptedTypes: string;
  badge: string;
  description: string;
  url?: string | null;
  status: "VERIFIED" | "PENDING" | "NOT_UPLOADED" | "REJECTED";
  fileName?: string | null;
  fileSize?: number;
}

export interface UploadClientProps {
  schoolDomain: string;
  schoolName: string;
  contactPhone?: string | null;
  applicantId: string;
  token: string;
  applicantName: string;
  parentName: string;
  targetGrade: string;
  tierName: string;
  status: string;
  applicationNo?: string;
  feeState?: "UNPAID" | "PENDING" | "PAID";
  existingFeeReceiptUrl?: string | null;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
  };
  existingDocuments: Record<string, any>;
  existingPassportUrl?: string | null;
  existingAcademicResultsUrl?: string | null;
  existingBirthCertificateUrl?: string | null;
  existingMedicalRecordsUrl?: string | null;
  existingNinSlipUrl?: string | null;
  checklist?: ChecklistSlot[];
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ApplicantUploadClient(props: UploadClientProps) {
  const {
    schoolName,
    contactPhone,
    applicantId,
    token,
    applicantName,
    parentName,
    targetGrade,
    tierName,
    status,
    applicationNo = `APP-${applicantId.slice(0, 6).toUpperCase()}`,
    feeState: initialFeeState = "UNPAID",
    existingFeeReceiptUrl,
    existingDocuments,
    existingPassportUrl,
    existingAcademicResultsUrl,
    existingBirthCertificateUrl,
    existingMedicalRecordsUrl,
    existingNinSlipUrl,
    checklist: incomingChecklist,
  } = props;

  // Build the complete fallback 6-document canonical checklist for active tier (PRIMARY)
  const defaultChecklist: ChecklistSlot[] = [
    {
      key: "applicationFeeReceipt",
      label: "Application Fee Receipt",
      subLabel: "Direct Bank Transfer Verification",
      mandatory: true,
      acceptedTypes: "image/*,application/pdf",
      badge: "PDF or Image",
      description: "Official bank deposit teller, electronic transfer receipt, or proof of payment for admission form.",
      url: existingFeeReceiptUrl || null,
      status: initialFeeState === "PAID" ? "VERIFIED" : (initialFeeState === "PENDING" || existingFeeReceiptUrl) ? "PENDING" : "NOT_UPLOADED",
      fileName: existingDocuments?.applicationFeeReceipt?.fileName || (existingFeeReceiptUrl ? "Payment_Receipt.pdf" : null),
    },
    {
      key: "passportPhoto",
      label: "Recent Passport Photograph",
      subLabel: "Official Identification Photo",
      mandatory: true,
      acceptedTypes: "image/*",
      badge: "Image Only",
      description: "Clear color photo of applicant with plain white background (JPG, PNG, WebP • Max 5MB).",
      url: existingPassportUrl || existingDocuments?.passportPhoto?.url || existingDocuments?.passportPhoto?.fileUrl || null,
      status: (existingDocuments?.passportPhoto?.status === "VERIFIED" || status === "APPROVED" || status === "ENROLLED")
        ? "VERIFIED"
        : (existingPassportUrl || existingDocuments?.passportPhoto?.url)
        ? "PENDING"
        : "NOT_UPLOADED",
      fileName: existingDocuments?.passportPhoto?.fileName || (existingPassportUrl ? "Passport_Photo.jpg" : null),
    },
    {
      key: "birthCertificate",
      label: "NPC National Birth Certificate / Age Declaration",
      subLabel: "Statutory Age Verification",
      mandatory: true,
      acceptedTypes: "image/*,application/pdf",
      badge: "PDF or Image",
      description: "Official birth certificate or statutory declaration of age issued by a competent court.",
      url: existingBirthCertificateUrl || existingDocuments?.birthCertificate?.url || existingDocuments?.birthCertificate?.fileUrl || null,
      status: (existingDocuments?.birthCertificate?.status === "VERIFIED" || status === "APPROVED" || status === "ENROLLED")
        ? "VERIFIED"
        : (existingBirthCertificateUrl || existingDocuments?.birthCertificate?.url)
        ? "PENDING"
        : "NOT_UPLOADED",
      fileName: existingDocuments?.birthCertificate?.fileName || (existingBirthCertificateUrl ? "Birth_Certificate.pdf" : null),
    },
    {
      key: "academicResults",
      label: "Academic Transcripts / Previous Term Results",
      subLabel: "Prior Academic Records",
      mandatory: true,
      acceptedTypes: "image/*,application/pdf",
      badge: "PDF or Image",
      description: "Certified termly report cards or official transcripts from the most recent school attended.",
      url: existingAcademicResultsUrl || existingDocuments?.academicResults?.url || existingDocuments?.academicResults?.fileUrl || null,
      status: (existingDocuments?.academicResults?.status === "VERIFIED" || status === "APPROVED" || status === "ENROLLED")
        ? "VERIFIED"
        : (existingAcademicResultsUrl || existingDocuments?.academicResults?.url)
        ? "PENDING"
        : "NOT_UPLOADED",
      fileName: existingDocuments?.academicResults?.fileName || (existingAcademicResultsUrl ? "Academic_Results.pdf" : null),
    },
    {
      key: "ninSlip",
      label: "NIMC NIN Identification Slip",
      subLabel: "National Identity Verification",
      mandatory: false,
      acceptedTypes: "image/*,application/pdf",
      badge: "Statutory NIN",
      description: "National Identification Number (NIN) registration slip, card, or NIMC verification document.",
      url: existingNinSlipUrl || existingDocuments?.ninSlip?.url || existingDocuments?.ninSlip?.fileUrl || null,
      status: (existingDocuments?.ninSlip?.status === "VERIFIED" || status === "APPROVED" || status === "ENROLLED")
        ? "VERIFIED"
        : (existingNinSlipUrl || existingDocuments?.ninSlip?.url)
        ? "PENDING"
        : "NOT_UPLOADED",
      fileName: existingDocuments?.ninSlip?.fileName || (existingNinSlipUrl ? "NIN_Slip.pdf" : null),
    },
    {
      key: "medicalRecords",
      label: "Medical Certificate of Fitness",
      subLabel: "Health & Immunization Record",
      mandatory: true,
      acceptedTypes: "image/*,application/pdf",
      badge: "PDF or Image",
      description: "Medical clearance, immunization records, or clinical fitness certificate from a registered healthcare facility.",
      url: existingMedicalRecordsUrl || existingDocuments?.medicalRecords?.url || existingDocuments?.medicalRecords?.fileUrl || null,
      status: (existingDocuments?.medicalRecords?.status === "VERIFIED" || status === "APPROVED" || status === "ENROLLED")
        ? "VERIFIED"
        : (existingMedicalRecordsUrl || existingDocuments?.medicalRecords?.url)
        ? "PENDING"
        : "NOT_UPLOADED",
      fileName: existingDocuments?.medicalRecords?.fileName || (existingMedicalRecordsUrl ? "Medical_Report.pdf" : null),
    },
  ];

  // Primary Checklist State containing all 6 canonical document slots
  const [checklist, setChecklist] = useState<ChecklistSlot[]>(
    incomingChecklist && incomingChecklist.length > 0 ? incomingChecklist : defaultChecklist
  );

  // Selected files state
  const [files, setFiles] = useState<{ [K in ChecklistKey]?: File | null }>({});

  // Image previews
  const [previews, setPreviews] = useState<{ [K in ChecklistKey]?: string | null }>({
    passportPhoto: existingPassportUrl || null,
    applicationFeeReceipt: existingFeeReceiptUrl || null,
  });

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingSlots, setUploadingSlots] = useState<{ [K in ChecklistKey]?: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [feeState, setFeeState] = useState<"UNPAID" | "PENDING" | "PAID">(initialFeeState);
  const [depositorName] = useState(applicantName);
  const [transferReference] = useState("");

  // Input refs for clicking dropzones
  const inputRefs = useRef<{ [K in ChecklistKey]?: HTMLInputElement | null }>({});

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Upload single file directly
  const uploadSingleSlotFile = async (key: ChecklistKey, file: File) => {
    setUploadingSlots((prev) => ({ ...prev, [key]: true }));
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("applicantId", applicantId);
      formData.append(key, file);

      if (key === "applicationFeeReceipt") {
        formData.append("receipt", file);
        if (depositorName) formData.append("depositorName", depositorName);
        if (transferReference) formData.append("transferReference", transferReference);
      }

      const res = await fetch(`/api/v1/admissions/upload/${applicantId}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          "x-applicant-token": token,
          "x-upload-token": token,
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to upload ${key}`);
      }

      const returnedDoc = data.documents?.[key];
      const newUrl =
        returnedDoc?.url ||
        returnedDoc?.fileUrl ||
        (key === "applicationFeeReceipt" ? data.receiptUrl : null) ||
        previews[key] ||
        null;

      if (key === "applicationFeeReceipt") {
        const nextFeeState = data.status === "PAID" ? "PAID" : "PENDING";
        setFeeState(nextFeeState as "UNPAID" | "PENDING" | "PAID");
      }

      setChecklist((prev) =>
        prev.map((slot) => {
          if (slot.key === key) {
            return {
              ...slot,
              url: newUrl || slot.url,
              status: key === "applicationFeeReceipt" && data.status === "PAID" ? "VERIFIED" : "PENDING",
              fileName: file.name,
              fileSize: file.size,
            };
          }
          return slot;
        })
      );

      // Clear the pending file selection since it is now uploaded
      setFiles((prev) => ({ ...prev, [key]: null }));
      setIsSuccess(true);
      setSuccessMsg(`"${file.name}" uploaded successfully and recorded under Admissions Review.`);
    } catch (err: any) {
      console.error(`[SINGLE_SLOT_UPLOAD_ERROR] for ${key}:`, err);
      setErrorMsg(err.message || `Failed to upload file. Please try again.`);
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [key]: false }));
    }
  };

  const validateAndSetFile = (key: ChecklistKey, file: File | null) => {
    setErrorMsg(null);
    if (!file) {
      setFiles((prev) => ({ ...prev, [key]: null }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File "${file.name}" exceeds the 5MB maximum limit. Please select a smaller file.`);
      return;
    }

    if (key === "passportPhoto") {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Passport photograph must be an image file (JPG, PNG, or WebP).");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => ({ ...prev, [key]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => ({ ...prev, [key]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }

    setFiles((prev) => ({ ...prev, [key]: file }));

    // For instant bank payment proof upload
    if (key === "applicationFeeReceipt") {
      uploadSingleSlotFile(key, file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, key: ChecklistKey) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(key, e.dataTransfer.files[0]);
    }
  };

  // Submit all newly selected pending files concurrently
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const pendingKeys = (Object.keys(files) as ChecklistKey[]).filter((k) => Boolean(files[k]));
    if (pendingKeys.length === 0) {
      setErrorMsg("Please select at least one new document to upload.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressTimer);
          return 85;
        }
        return prev + 12;
      });
    }, 180);

    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("applicantId", applicantId);

      for (const k of pendingKeys) {
        const file = files[k];
        if (file) {
          formData.append(k, file);
          if (k === "applicationFeeReceipt") {
            formData.append("receipt", file);
          }
        }
      }

      if (depositorName) formData.append("depositorName", depositorName);
      if (transferReference) formData.append("transferReference", transferReference);

      const res = await fetch(`/api/v1/admissions/upload/${applicantId}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          "x-applicant-token": token,
          "x-upload-token": token,
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(progressTimer);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload credential files");
      }

      setUploadProgress(100);

      // Dynamically update checklist states
      setChecklist((prev) =>
        prev.map((slot) => {
          if (pendingKeys.includes(slot.key)) {
            const returnedDoc = data.documents?.[slot.key];
            const newUrl =
              returnedDoc?.url ||
              returnedDoc?.fileUrl ||
              (slot.key === "applicationFeeReceipt" ? data.receiptUrl : null) ||
              previews[slot.key] ||
              slot.url;

            return {
              ...slot,
              url: newUrl,
              status: slot.key === "applicationFeeReceipt" && data.status === "PAID" ? "VERIFIED" : "PENDING",
              fileName: files[slot.key]?.name || returnedDoc?.fileName || slot.fileName,
              fileSize: files[slot.key]?.size || slot.fileSize,
            };
          }
          return slot;
        })
      );

      if (pendingKeys.includes("applicationFeeReceipt")) {
        setFeeState(data.status === "PAID" ? "PAID" : "PENDING");
      }

      // Clear pending selections
      setFiles({});

      setTimeout(() => {
        setIsUploading(false);
        setIsSuccess(true);
        setSuccessMsg("All selected credentials uploaded successfully. Status updated to Under Admissions Review.");
      }, 400);
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsUploading(false);
      setUploadProgress(0);
      setErrorMsg(err.message || "An unexpected error occurred during file upload.");
    }
  };

  const selectedCount = Object.values(files).filter(Boolean).length;
  const uploadedCount = checklist.filter((slot) => Boolean(slot.url) || slot.status === "VERIFIED" || slot.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 flex flex-col justify-between">
      {/* Top Brand Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-sm sticky top-0 z-30 w-full overflow-hidden">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white leading-tight break-words">
                {schoolName}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Admissions &amp; Statutory Credential Intake
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold border border-emerald-200 dark:border-emerald-800/40 shrink-0 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Direct Session</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 overflow-hidden">
        <div className="space-y-6">
          {/* Applicant Context Card - Compact Responsive Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl px-4 py-3.5 sm:px-6 sm:py-4 shadow-lg border border-indigo-900/40 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -mr-16 -mt-16"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30">
                    <span>Application #{applicationNo}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">&bull;</span>
                  <span className="text-[11px] text-indigo-200 font-medium">
                    Class: <strong className="text-white">{targetGrade}</strong> ({tierName})
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight truncate">{applicantName}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
                <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-1.5">
                  <span className="text-indigo-200 text-[11px]">Fee:</span>
                  {feeState === "PAID" ? (
                    <span className="text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                      <Check className="w-3 h-3" /> Paid
                    </span>
                  ) : feeState === "PENDING" ? (
                    <span className="text-blue-300 font-bold text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-pulse" /> Under Admissions Review
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold text-[11px]">Unpaid (₦5,000)</span>
                  )}
                </div>

                <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-1.5">
                  <span className="text-indigo-200 text-[11px]">Parent:</span>
                  <span className="font-bold text-[11px] text-slate-100 max-w-[120px] truncate">{parentName}</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-1.5">
                  <span className="font-bold text-emerald-300 text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Token
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SUCCESS BANNER: Appears at the top without hiding the upload slots */}
          {isSuccess && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 shadow-sm animate-in fade-in slide-in-from-top-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-emerald-950 dark:text-emerald-100">
                    Submission Received Successfully!
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
                    {successMsg ||
                      `Thank you, ${parentName}. Your credentials for ${applicantName} have been recorded in the admissions registry and forwarded to the admissions board for verification.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSuccess(false)}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 p-1 rounded-lg hover:bg-emerald-100/50 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ERROR BANNER */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3 animate-in shake">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* SECTION HEADER WITH REAL-TIME PROGRESS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Statutory Credential Slots ({checklist.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                All 6 required admission checklist categories are unlocked. You may upload credentials concurrently.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {uploadedCount} of {checklist.length} Documents Submitted
              </span>
            </div>
          </div>

          {/* DYNAMIC DROPZONE GRID: MAPS ALL 6 SLOTS INSTANTLY */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {checklist.map((slot, index) => {
                const selectedFile = files[slot.key];
                const isSlotUploading = uploadingSlots[slot.key];
                const previewImg = previews[slot.key];
                const hasExistingUrl = Boolean(slot.url);
                const isVerified = slot.status === "VERIFIED";
                const isUnderReview = slot.status === "PENDING" || (hasExistingUrl && !isVerified);
                const isRejected = slot.status === "REJECTED";

                return (
                  <div
                    key={slot.key}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, slot.key)}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, input")) return;
                      e.preventDefault();
                      e.stopPropagation();
                      inputRefs.current[slot.key]?.click();
                    }}
                    className={`relative p-5 sm:p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col justify-between min-h-[260px] bg-white dark:bg-zinc-900 ${
                      isSlotUploading
                        ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20"
                        : selectedFile
                        ? "border-amber-400 dark:border-amber-500 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs"
                        : isVerified
                        ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : isUnderReview
                        ? "border-blue-400/80 dark:border-blue-600/80 bg-blue-50/20 dark:bg-blue-950/10"
                        : isRejected
                        ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/10"
                        : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <input
                      id={`slot-upload-${slot.key}`}
                      name={slot.key}
                      ref={(el) => {
                        inputRefs.current[slot.key] = el;
                      }}
                      type="file"
                      accept={slot.acceptedTypes}
                      className="hidden"
                      onChange={(e) => {
                        e.stopPropagation();
                        validateAndSetFile(slot.key, e.target.files?.[0] || null);
                      }}
                    />

                    <div>
                      {/* Slot Header */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${
                              slot.key === "applicationFeeReceipt"
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                            }`}
                          >
                            {slot.key === "applicationFeeReceipt" ? (
                              <CreditCard className="w-4 h-4" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 dark:text-white text-sm leading-snug">
                              {slot.label}
                            </h4>
                            {slot.subLabel && (
                              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                {slot.subLabel}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              slot.mandatory
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
                                : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {slot.badge}
                          </span>
                        </div>
                      </div>

                      {/* Real-time Status Pill */}
                      <div className="mb-3">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified by Admissions Desk
                          </span>
                        ) : isUnderReview ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Clock className="w-3 h-3 text-blue-600 animate-pulse" /> Uploaded &bull; Under Admissions Review
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Action Required (Re-upload)
                          </span>
                        ) : selectedFile ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Sparkles className="w-3 h-3 text-amber-600" /> Ready to Submit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                            Not yet uploaded &bull; Pending
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-3">
                        {slot.description}
                      </p>
                    </div>

                    {/* Slot Interactive Content State */}
                    {isSlotUploading ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in duration-200">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                          Uploading to secure registry...
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Encrypting and recording document</p>
                      </div>
                    ) : selectedFile ? (
                      /* File Selected State (Pending Submit) */
                      <div className="flex items-center gap-3 p-3 bg-amber-50/50 dark:bg-zinc-950 rounded-xl border border-amber-200 dark:border-zinc-800">
                        {previewImg ? (
                          <Image
                            src={previewImg}
                            alt="Preview"
                            width={44}
                            height={44}
                            unoptimized
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-amber-600 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate text-slate-800 dark:text-zinc-200">
                            {selectedFile.name}
                          </p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                            {formatFileSize(selectedFile.size)} &bull; Ready to submit
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            uploadSingleSlotFile(slot.key, selectedFile);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shrink-0 cursor-pointer shadow-2xs"
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            validateAndSetFile(slot.key, null);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-rose-600 shrink-0 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : slot.url || isVerified || isUnderReview ? (
                      /* Existing Uploaded Document State */
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                        {previewImg || (slot.key === "passportPhoto" && slot.url) ? (
                          <Image
                            src={previewImg || slot.url || ""}
                            alt="Document preview"
                            width={44}
                            height={44}
                            unoptimized
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <FileCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate text-slate-800 dark:text-zinc-200">
                            {slot.fileName || `${slot.label} Recorded`}
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            {isVerified ? "Verified by Admissions Board" : "Uploaded • Under Admissions Review"}
                          </p>
                        </div>
                        {slot.url && (
                          <a
                            href={slot.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 shrink-0 flex items-center gap-1"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            inputRefs.current[slot.key]?.click();
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 shrink-0 cursor-pointer"
                        >
                          Replace
                        </button>
                      </div>
                    ) : (
                      /* Empty Slot Dropzone State */
                      <div className="text-center py-4 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
                        <UploadCloud className="w-8 h-8 mb-1.5 text-indigo-500/70" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Drop file here or tap to select
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            inputRefs.current[slot.key]?.click();
                          }}
                          className="mt-2.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Select {slot.label.split("/")[0].trim()}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Upload Progress Bar Indicator */}
            {isUploading && (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                    Uploading credentials to secure admissions registry...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Global Submit Action Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 dark:text-zinc-400 text-center sm:text-left">
                {selectedCount > 0 ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    {selectedCount} new document{selectedCount > 1 ? "s" : ""} selected and ready for upload.
                  </span>
                ) : (
                  <span>
                    All {checklist.length} credential categories are monitored by the admissions desk. TLS encrypted.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiles({})}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Clear Selections
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isUploading || selectedCount === 0}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading Documents...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit &amp; Upload {selectedCount > 0 ? `(${selectedCount})` : ""}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-6 text-center text-xs text-slate-500 dark:text-zinc-400">
        <p>&copy; {new Date().getFullYear()} {schoolName}. Admissions Management System.</p>
        <p className="mt-1">Inquiries &amp; Assistance: {contactPhone || "+234 (0) 800-SCHOOL-ERP"}</p>
      </footer>
    </div>
  );
}
