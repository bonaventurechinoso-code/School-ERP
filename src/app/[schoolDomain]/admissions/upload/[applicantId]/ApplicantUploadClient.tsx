"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
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
} from "lucide-react";

interface UploadClientProps {
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
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ApplicantUploadClient(props: UploadClientProps) {
  const {
    schoolDomain,
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
    feeState = "UNPAID",
    existingFeeReceiptUrl,
    bankDetails = {
      bankName: "Zenith Bank",
      accountNumber: "1012345678",
      accountName: `${schoolName} Admissions`,
      amount: 5000,
    },
    existingDocuments,
    existingPassportUrl,
    existingAcademicResultsUrl,
    existingBirthCertificateUrl,
    existingMedicalRecordsUrl,
  } = props;

  // Selected files state
  const [files, setFiles] = useState<{
    applicationFeeReceipt: File | null;
    passportPhoto: File | null;
    academicResults: File | null;
    birthCertificate: File | null;
    medicalRecords: File | null;
  }>({
    applicationFeeReceipt: null,
    passportPhoto: null,
    academicResults: null,
    birthCertificate: null,
    medicalRecords: null,
  });

  const [previews, setPreviews] = useState<{
    passportPhoto?: string | null;
    applicationFeeReceipt?: string | null;
  }>({
    passportPhoto: existingPassportUrl || null,
    applicationFeeReceipt: existingFeeReceiptUrl || null,
  });

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, any>>(existingDocuments || {});
  const [depositorName, setDepositorName] = useState(applicantName);
  const [transferReference, setTransferReference] = useState("");

  // Input refs for clicking dropzones
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  const resultsInputRef = useRef<HTMLInputElement>(null);
  const birthInputRef = useRef<HTMLInputElement>(null);
  const medicalInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateAndSetFile = (
    field: "applicationFeeReceipt" | "passportPhoto" | "academicResults" | "birthCertificate" | "medicalRecords",
    file: File | null
  ) => {
    setErrorMsg(null);
    if (!file) {
      setFiles((prev) => ({ ...prev, [field]: null }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File "${file.name}" exceeds the 5MB maximum limit. Please select a smaller file.`);
      return;
    }

    if (field === "passportPhoto") {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Passport photograph must be an image file (JPG, PNG, or WebP).");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => ({ ...prev, passportPhoto: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }

    if (field === "applicationFeeReceipt") {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews((prev) => ({ ...prev, applicationFeeReceipt: e.target?.result as string }));
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews((prev) => ({ ...prev, applicationFeeReceipt: null }));
      }
    }

    setFiles((prev) => ({ ...prev, [field]: file }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (
    e: React.DragEvent,
    field: "applicationFeeReceipt" | "passportPhoto" | "academicResults" | "birthCertificate" | "medicalRecords"
  ) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(field, e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const hasNewFiles =
      files.applicationFeeReceipt ||
      files.passportPhoto ||
      files.academicResults ||
      files.birthCertificate ||
      files.medicalRecords;
    if (!hasNewFiles) {
      setErrorMsg("Please select at least one document or application fee receipt to upload.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);

    // Simulate animated progress while sending
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

      if (files.applicationFeeReceipt) {
        formData.append("applicationFeeReceipt", files.applicationFeeReceipt);
      }
      if (depositorName) formData.append("depositorName", depositorName);
      if (transferReference) formData.append("transferReference", transferReference);
      if (files.passportPhoto) formData.append("passportPhoto", files.passportPhoto);
      if (files.academicResults) formData.append("academicResults", files.academicResults);
      if (files.birthCertificate) formData.append("birthCertificate", files.birthCertificate);
      if (files.medicalRecords) formData.append("medicalRecords", files.medicalRecords);

      const res = await fetch(`/api/v1/admissions/upload/${applicantId}?token=${token}`, {
        method: "POST",
        headers: {
          "x-applicant-token": token,
          "x-upload-token": token,
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(progressTimer);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload credential files");
      }

      setUploadProgress(100);
      setUploadedDocs(data.documents || {});
      setTimeout(() => {
        setIsUploading(false);
        setIsSuccess(true);
      }, 400);
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsUploading(false);
      setUploadProgress(0);
      setErrorMsg(err.message || "An unexpected error occurred during file upload.");
    }
  };

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
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Admissions & Credential Intake</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold border border-emerald-200 dark:border-emerald-800/40 shrink-0 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Direct Session</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-12 flex-1 overflow-hidden">
        {/* SUCCESS STATE */}
        {isSuccess ? (
          <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-12 shadow-xl border border-emerald-100 dark:border-emerald-900/30 text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Submission Received
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Credentials Submitted Successfully!
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-300 mt-3 max-w-lg mx-auto leading-relaxed">
              Thank you, <strong>{parentName}</strong>. The uploaded credential documents for <strong>{applicantName}</strong> have been securely recorded in our admissions registry.
            </p>

            {/* Uploaded Summary List */}
            <div className="mt-8 text-left bg-slate-50 dark:bg-zinc-950/60 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">
                Processed Credentials
              </h4>
              <div className="space-y-2.5">
                {Object.entries(uploadedDocs).map(([key, doc]: [string, any]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                        {doc.fileName || key}
                      </span>
                    </div>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 shrink-0 ml-2"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => setIsSuccess(false)}
                className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold transition-all"
              >
                Upload Additional or Updated Files
              </button>
            </div>
          </div>
        ) : (
          /* FORM UPLOAD VIEW */
          <div className="space-y-8">
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
                        <Clock className="w-3 h-3 animate-pulse" /> Pending
                      </span>
                    ) : (
                      <span className="text-amber-300 font-bold text-[11px]">
                        Unpaid (₦5,000)
                      </span>
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

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3 animate-in shake">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMsg}</div>
                <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Dropzone Grid */}
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. DEDICATED APPLICATION FEE RECEIPT OR PASSPORT PHOTOGRAPH */}
                {feeState !== "PAID" ? (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "applicationFeeReceipt")}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, input")) return;
                      e.preventDefault();
                      e.stopPropagation();
                      receiptInputRef.current?.click();
                    }}
                    className={`relative p-5 sm:p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col justify-between min-h-[260px] bg-white dark:bg-zinc-900 ${
                      files.applicationFeeReceipt || existingFeeReceiptUrl
                        ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : "border-indigo-400 dark:border-indigo-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20"
                    }`}
                  >
                    <input
                      id="receipt-upload"
                      name="applicationFeeReceipt"
                      ref={receiptInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        e.stopPropagation();
                        validateAndSetFile("applicationFeeReceipt", e.target.files?.[0] || null);
                      }}
                    />

                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 dark:text-white text-sm">
                              Upload Application Fee Receipt
                            </h3>
                            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                              Direct Bank Transfer Verification
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200">
                          PDF or Image
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-3">
                        Upload your official bank payment receipt or electronic transfer slip (Max 5MB).
                      </p>
                    </div>

                    {files.applicationFeeReceipt || existingFeeReceiptUrl ? (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <FileCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate text-slate-800 dark:text-zinc-200">
                            {files.applicationFeeReceipt?.name || "Application Fee Receipt Uploaded"}
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            {files.applicationFeeReceipt
                              ? formatFileSize(files.applicationFeeReceipt.size)
                              : feeState === "PENDING"
                              ? "Uploaded • Under Admissions Review"
                              : "Ready for verification"}
                          </p>
                        </div>
                        {existingFeeReceiptUrl && (
                          <a
                            href={existingFeeReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 shrink-0"
                          >
                            View
                          </a>
                        )}
                        {files.applicationFeeReceipt && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              validateAndSetFile("applicationFeeReceipt", null);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
                        <UploadCloud className="w-8 h-8 mb-1.5 text-indigo-500/80" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Drop payment receipt here or tap below
                        </p>
                        <button
                          type="button"
                          id="receipt-picker-trigger"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            receiptInputRef.current?.click();
                          }}
                          className="mt-2.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Select Receipt File</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Passport Photograph (Rendered once Fee is Settled) */
                  <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "passportPhoto")}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, input")) return;
                      e.preventDefault();
                      e.stopPropagation();
                      passportInputRef.current?.click();
                    }}
                    className={`relative p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col justify-between min-h-[260px] bg-white dark:bg-zinc-900 ${
                      files.passportPhoto || existingPassportUrl
                        ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <input
                      id="passport-upload"
                      name="passportPhoto"
                      ref={passportInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        e.stopPropagation();
                        validateAndSetFile("passportPhoto", e.target.files?.[0] || null);
                      }}
                    />

                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            1
                          </div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Recent Passport Photograph</h3>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Image Only
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                        Clear color photo of applicant with plain white background (JPG, PNG, WebP &bull; Max 5MB).
                      </p>
                    </div>

                    {previews.passportPhoto ? (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <Image
                          src={previews.passportPhoto}
                          alt="Passport preview"
                          width={48}
                          height={48}
                          unoptimized
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate text-slate-800 dark:text-zinc-200">
                            {files.passportPhoto?.name || "Existing Passport Photo"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {files.passportPhoto ? formatFileSize(files.passportPhoto.size) : "Ready on server"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            validateAndSetFile("passportPhoto", null);
                            setPreviews((p) => ({ ...p, passportPhoto: null }));
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-4 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
                        <UploadCloud className="w-8 h-8 mb-2 text-indigo-500/70" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Drop passport photograph here or tap below
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            passportInputRef.current?.click();
                          }}
                          className="mt-2.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Select Passport Photo</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Previous Academic Results */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, "academicResults")}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a, input")) return;
                    e.preventDefault();
                    e.stopPropagation();
                    resultsInputRef.current?.click();
                  }}
                  className={`relative p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col justify-between min-h-[220px] bg-white dark:bg-zinc-900 ${
                    files.academicResults || existingAcademicResultsUrl
                      ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <input
                    id="results-upload"
                    name="academicResults"
                    ref={resultsInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      e.stopPropagation();
                      validateAndSetFile("academicResults", e.target.files?.[0] || null);
                    }}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                          2
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Previous Academic Results</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        PDF or Image
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                      Certified termly report cards or official transcripts from the most recent school year (Max 5MB).
                    </p>
                  </div>

                  {files.academicResults || existingAcademicResultsUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <FileText className="w-8 h-8 text-indigo-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-slate-800 dark:text-zinc-200">
                          {files.academicResults?.name || "Report Cards Uploaded"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {files.academicResults ? formatFileSize(files.academicResults.size) : "Ready on server"}
                        </p>
                      </div>
                      {files.academicResults && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            validateAndSetFile("academicResults", null);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
                      <UploadCloud className="w-8 h-8 mb-2 text-indigo-500/70" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Drop PDF or scanned results here or tap below
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          resultsInputRef.current?.click();
                        }}
                        className="mt-2.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Select Results File</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Birth Certificate / ID */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, "birthCertificate")}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a, input")) return;
                    e.preventDefault();
                    e.stopPropagation();
                    birthInputRef.current?.click();
                  }}
                  className={`relative p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col justify-between min-h-[220px] bg-white dark:bg-zinc-900 ${
                    files.birthCertificate || existingBirthCertificateUrl
                      ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <input
                    id="birth-upload"
                    name="birthCertificate"
                    ref={birthInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      e.stopPropagation();
                      validateAndSetFile("birthCertificate", e.target.files?.[0] || null);
                    }}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                          3
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Birth Certificate or ID</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        PDF or Image
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                      Official birth certificate, statutory declaration of age, or international passport data page (Max 5MB).
                    </p>
                  </div>

                  {files.birthCertificate || existingBirthCertificateUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <FileCheck className="w-8 h-8 text-indigo-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-slate-800 dark:text-zinc-200">
                          {files.birthCertificate?.name || "Birth Certificate Uploaded"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {files.birthCertificate ? formatFileSize(files.birthCertificate.size) : "Ready on server"}
                        </p>
                      </div>
                      {files.birthCertificate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            validateAndSetFile("birthCertificate", null);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
                      <UploadCloud className="w-8 h-8 mb-2 text-indigo-500/70" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Drop birth certificate or valid ID here or tap below
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          birthInputRef.current?.click();
                        }}
                        className="mt-2.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Select Birth Certificate</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Medical / Behavioral Records */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, "medicalRecords")}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a, input")) return;
                    e.preventDefault();
                    e.stopPropagation();
                    medicalInputRef.current?.click();
                  }}
                  className={`relative p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col justify-between min-h-[220px] bg-white dark:bg-zinc-900 ${
                    files.medicalRecords || existingMedicalRecordsUrl
                      ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <input
                    id="medical-upload"
                    name="medicalRecords"
                    ref={medicalInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      e.stopPropagation();
                      validateAndSetFile("medicalRecords", e.target.files?.[0] || null);
                    }}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                          4
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Medical / Behavioral Records</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Optional
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                      Immunization cards, medical clearance, or developmental observations (recommended for Early Years).
                    </p>
                  </div>

                  {files.medicalRecords || existingMedicalRecordsUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <FileText className="w-8 h-8 text-indigo-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-slate-800 dark:text-zinc-200">
                          {files.medicalRecords?.name || "Medical Records Uploaded"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {files.medicalRecords ? formatFileSize(files.medicalRecords.size) : "Ready on server"}
                        </p>
                      </div>
                      {files.medicalRecords && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            validateAndSetFile("medicalRecords", null);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
                      <UploadCloud className="w-8 h-8 mb-2 text-indigo-500/70" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Drop medical documents here or tap below
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          medicalInputRef.current?.click();
                        }}
                        className="mt-2.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Select Medical Record</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Progress Indicator */}
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

              {/* Submit Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <p className="text-xs text-slate-500 dark:text-zinc-400 text-center sm:text-left">
                  Files are transferred securely with TLS encryption and directly mapped to your application profile.
                </p>

                <button
                  type="submit"
                  disabled={
                    isUploading ||
                    (!files.applicationFeeReceipt &&
                      !files.passportPhoto &&
                      !files.academicResults &&
                      !files.birthCertificate &&
                      !files.medicalRecords)
                  }
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <span>Uploading Documents...</span>
                  ) : (
                    <>
                      <span>Submit & Upload Credentials</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-6 text-center text-xs text-slate-500 dark:text-zinc-400">
        <p>&copy; {new Date().getFullYear()} {schoolName}. Admissions Management System.</p>
        <p className="mt-1">Inquiries & Assistance: {contactPhone || "+234 (0) 800-SCHOOL-ERP"}</p>
      </footer>
    </div>
  );
}
