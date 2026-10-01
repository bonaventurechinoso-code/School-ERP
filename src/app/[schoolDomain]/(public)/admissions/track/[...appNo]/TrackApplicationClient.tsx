"use client";

import React, { useState, useRef, useTransition } from "react";
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Building2,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  Clock,
  ArrowRight,
  UserCheck,
  Copy,
  FileCheck,
  Sparkles,
} from "lucide-react";
import { uploadApplicantDocsAction } from "./actions";
import DocumentViewer from "./components/DocumentViewer";

interface TrackClientProps {
  schoolDomain: string;
  schoolId: string;
  schoolName: string;
  contactPhone?: string | null;
  brandColor?: string;
  applicant: {
    id: string;
    applicationNo: string;
    firstName: string;
    lastName: string;
    classApplied: string;
    parentPhone: string;
    email?: string | null;
    status: string;
    credentialsJson?: Array<{
      type?: string;
      name?: string;
      originalName?: string;
      url?: string;
      path?: string;
      uploadedAt?: string;
    }> | null;
    createdAt: string;
  };
}

export default function TrackApplicationClient({
  schoolDomain,
  schoolId,
  schoolName,
  contactPhone,
  brandColor = "#4f46e5",
  applicant,
}: TrackClientProps) {
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState<string>(applicant.status || "docs_pending");
  const [credentials, setCredentials] = useState<any[]>(applicant.credentialsJson || []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedAppNo, setCopiedAppNo] = useState(false);

  // Selected files
  const [files, setFiles] = useState<{
    birthCertificate: File | null;
    passportPhoto: File | null;
    lastResult: File | null;
    nin: File | null;
  }>({
    birthCertificate: null,
    passportPhoto: null,
    lastResult: null,
    nin: null,
  });

  const birthInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  const resultInputRef = useRef<HTMLInputElement>(null);
  const ninInputRef = useRef<HTMLInputElement>(null);

  const handleCopyAppNo = () => {
    navigator.clipboard.writeText(applicant.applicationNo);
    setCopiedAppNo(true);
    setTimeout(() => setCopiedAppNo(false), 2000);
  };

  const handleFileChange = (key: "birthCertificate" | "passportPhoto" | "lastResult" | "nin", file: File | null) => {
    setErrorMessage(null);
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleSubmitUpload = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const hasAnyFile = files.birthCertificate || files.passportPhoto || files.lastResult || files.nin;
    if (!hasAnyFile) {
      setErrorMessage("Please select at least one document to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("schoolId", schoolId);
    formData.append("schoolDomain", schoolDomain);
    formData.append("appNo", applicant.applicationNo);

    if (files.birthCertificate) formData.append("birthCertificate", files.birthCertificate);
    if (files.passportPhoto) formData.append("passportPhoto", files.passportPhoto);
    if (files.lastResult) formData.append("lastResult", files.lastResult);
    if (files.nin) formData.append("nin", files.nin);

    startTransition(async () => {
      const res = await uploadApplicantDocsAction(formData);
      if (res.success) {
        setCurrentStatus("docs_submitted");
        setCredentials(res.credentials || []);
        setSuccessMessage(res.message || "Documents uploaded successfully! Status updated to Documents Submitted.");
        // Reset file inputs
        setFiles({ birthCertificate: null, passportPhoto: null, lastResult: null, nin: null });
      } else {
        setErrorMessage(res.error || "Failed to upload documents.");
      }
    });
  };

  // Determine current step index
  const normalizedStatus = currentStatus.toLowerCase();
  const getStepProgress = () => {
    if (normalizedStatus === "admitted") return 4;
    if (normalizedStatus === "docs_submitted" || normalizedStatus === "under_review" || normalizedStatus === "approved") return 3;
    if (normalizedStatus === "docs_pending" || normalizedStatus === "new") return 2;
    return 1;
  };

  const activeStep = getStepProgress();

  const steps = [
    { number: 1, title: "Application Received", desc: "Initial inquiry registered" },
    { number: 2, title: "Documents Pending", desc: "Upload statutory credentials" },
    { number: 3, title: "Documents Submitted", desc: "Under admissions review" },
    { number: 4, title: "Admitted & Enrolled", desc: "Official student placement" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 flex flex-col justify-between">
      {/* BRAND TOP HEADER */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-black shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
                {schoolName}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Admissions Tracking &amp; KYC Verification</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800/40">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Direct Session</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 space-y-8">
        {/* APPLICANT BIO BANNER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/40 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30 mb-3">
                <span>Admissions Tracker</span>
                <span>&bull;</span>
                <span className="font-mono">App #{applicant.applicationNo}</span>
                <button
                  onClick={handleCopyAppNo}
                  className="hover:text-white transition ml-1"
                  title="Copy Application Number"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copiedAppNo && <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                {applicant.firstName} {applicant.lastName}
              </h2>
              <p className="text-indigo-200 text-sm mt-1 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                <span>Class Applied: <strong className="text-white">{applicant.classApplied}</strong></span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-xs space-y-2 shrink-0 min-w-[260px]">
              <div className="flex justify-between items-center">
                <span className="text-indigo-200">Current Status:</span>
                <span className="font-bold text-amber-300 uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30">
                  {currentStatus.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-indigo-200">Parent Phone:</span>
                <span className="font-mono font-semibold">{applicant.parentPhone || "N/A"}</span>
              </div>
              {applicant.email && (
                <div className="flex justify-between items-center">
                  <span className="text-indigo-200">Email:</span>
                  <span className="font-medium truncate max-w-[140px]">{applicant.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STATUS STEPPER */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 dark:border-zinc-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-6">
            Admissions Pipeline Progress
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
            {steps.map((step) => {
              const isPassed = step.number < activeStep;
              const isCurrent = step.number === activeStep;

              return (
                <div
                  key={step.number}
                  className={`p-4 rounded-2xl border transition-all ${
                    isPassed
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                      : isCurrent
                      ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-700 shadow-sm"
                      : "bg-slate-50/50 dark:bg-zinc-800/20 border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        isPassed
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950"
                          : "bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : step.number}
                    </div>
                    <span className="text-xs font-black tracking-tight">{step.title}</span>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed opacity-80">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* PROCESSED DOCUMENTS VAULT (IF ANY ALREADY UPLOADED) */}
        {credentials.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Submitted Credential Documents ({credentials.length})
              </h3>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                Stored in Document Vault
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {credentials.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="truncate">
                      <p className="font-bold text-slate-800 dark:text-zinc-200 truncate">
                        {doc.name || doc.type || `Document ${idx + 1}`}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {doc.originalName || doc.filename || "Attached credential"}
                      </p>
                    </div>
                  </div>
                  {(doc.url || doc.path) && (
                    <DocumentViewer
                      url={doc.url}
                      path={doc.path}
                      name={doc.name || doc.originalName}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOCUMENT UPLOAD FORM */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 dark:border-zinc-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Upload Required Documents
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Please attach clear scanned copies or photographs of the 4 statutory credentials below.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400">PDF, JPG, PNG &bull; Max 10MB</span>
          </div>

          <form onSubmit={handleSubmitUpload} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1. BIRTH CERTIFICATE */}
              <div
                onClick={() => birthInputRef.current?.click()}
                className={`p-5 rounded-2xl border-2 border-dashed transition cursor-pointer flex flex-col justify-between min-h-[160px] ${
                  files.birthCertificate
                    ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                <input
                  ref={birthInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange("birthCertificate", e.target.files?.[0] || null)}
                />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      1. Birth Certificate *
                    </span>
                    <UploadCloud className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    NPC Birth certificate or statutory age declaration
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-zinc-300 truncate">
                    {files.birthCertificate ? files.birthCertificate.name : "Click to select file"}
                  </span>
                  {files.birthCertificate && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
              </div>

              {/* 2. PASSPORT PHOTOGRAPH */}
              <div
                onClick={() => passportInputRef.current?.click()}
                className={`p-5 rounded-2xl border-2 border-dashed transition cursor-pointer flex flex-col justify-between min-h-[160px] ${
                  files.passportPhoto
                    ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                <input
                  ref={passportInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileChange("passportPhoto", e.target.files?.[0] || null)}
                />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      2. Passport Photograph *
                    </span>
                    <UploadCloud className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Recent passport-sized photo with white background
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-zinc-300 truncate">
                    {files.passportPhoto ? files.passportPhoto.name : "Click to select image"}
                  </span>
                  {files.passportPhoto && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
              </div>

              {/* 3. LAST RESULT */}
              <div
                onClick={() => resultInputRef.current?.click()}
                className={`p-5 rounded-2xl border-2 border-dashed transition cursor-pointer flex flex-col justify-between min-h-[160px] ${
                  files.lastResult
                    ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                <input
                  ref={resultInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange("lastResult", e.target.files?.[0] || null)}
                />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      3. Last Academic Result *
                    </span>
                    <UploadCloud className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Previous term report card, transcript, or terminal score sheet
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-zinc-300 truncate">
                    {files.lastResult ? files.lastResult.name : "Click to select file"}
                  </span>
                  {files.lastResult && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
              </div>

              {/* 4. NIN (NATIONAL IDENTIFICATION NUMBER) */}
              <div
                onClick={() => ninInputRef.current?.click()}
                className={`p-5 rounded-2xl border-2 border-dashed transition cursor-pointer flex flex-col justify-between min-h-[160px] ${
                  files.nin
                    ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : "border-slate-300 dark:border-zinc-700 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                <input
                  ref={ninInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange("nin", e.target.files?.[0] || null)}
                />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      4. NIN Slip / Card *
                    </span>
                    <UploadCloud className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    NIMC National Identity Number registration slip or ID card
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-zinc-300 truncate">
                    {files.nin ? files.nin.name : "Click to select file"}
                  </span>
                  {files.nin && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                After submission, your status will advance to <strong>Documents Submitted</strong> for registrar audit.
              </span>
              <button
                type="submit"
                disabled={isPending || (!files.birthCertificate && !files.passportPhoto && !files.lastResult && !files.nin)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2"
                style={{ backgroundColor: brandColor }}
              >
                {isPending ? (
                  <span>Uploading Documents...</span>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload &amp; Submit Documents</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-6 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} {schoolName}. All rights reserved. Admissions Portal.</p>
        {contactPhone && <p className="mt-1 font-semibold text-slate-500">Admissions Desk: {contactPhone}</p>}
      </footer>
    </div>
  );
}
