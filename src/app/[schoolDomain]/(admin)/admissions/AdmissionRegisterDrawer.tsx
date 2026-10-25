"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  FileText,
  UserCheck,
  ShieldCheck,
  Clock,
  ExternalLink,
  Ban,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  Lock,
  GitMerge,
  History,
  Check,
  ChevronRight,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { requestApplicantDocsAction } from "./actions";
import { useSession } from "@/lib/session-context";
import { isAdmissionsAuthorized } from "@/lib/admissions-rbac";
import {
  AdmissionRegisterRecord,
  AdmissionStatusLog,
  AdmissionStatus,
} from "@/lib/admissions.types";
import { resolveApplicantDocs, CanonicalDocument } from "@/lib/admissions-docs";
import PaymentReceiptVerify from "@/components/payments/PaymentReceiptVerify";
import PaymentReceiptUpload from "@/components/payments/PaymentReceiptUpload";

export type { AdmissionRegisterRecord };

interface AdmissionRegisterDrawerProps {
  applicant: AdmissionRegisterRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onVerifyDocs: (id: string) => Promise<void>;
  onAdmit: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  schoolName?: string;
  schoolDomain?: string;
  canMutate?: boolean;
}

export default function AdmissionRegisterDrawer({
  applicant,
  isOpen,
  onClose,
  onVerifyDocs,
  onAdmit,
  onReject,
  schoolName = "Greenwood Academy",
  schoolDomain,
  canMutate = false,
}: AdmissionRegisterDrawerProps) {
  const { session } = useSession();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedAppNo, setCopiedAppNo] = useState(false);
  const [activeTab, setActiveTab] = useState<"dossier" | "timeline">("dossier");

  const [localApplicant, setLocalApplicant] = useState<AdmissionRegisterRecord | null>(applicant);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [applicantReceipt, setApplicantReceipt] = useState<any | null>(null);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);

  React.useEffect(() => {
    setLocalApplicant(applicant);
    setToastMsg(null);
    setApplicantReceipt(null);
    setShowReceiptUpload(false);

    if (applicant?.applicationNo) {
      fetch(`/api/v1/payments/receipt/list?referenceNo=${applicant.applicationNo}&moduleType=ADMISSION_FORM_FEE&limit=1`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.receipts?.length > 0) {
            setApplicantReceipt(d.receipts[0]);
          }
        })
        .catch(() => {});
    }
  }, [applicant]);

  // RBAC Permission Profile
  const userRole = (session?.role || session?.staffRole || (session as any)?.userRole || (session?.user as any)?.role || "").toUpperCase();
  const isAuthorized = canMutate || isAdmissionsAuthorized(userRole, session?.staffRole);

  // Canonical KYC Documents Resolution (5 docs: 4 Mandatory, 1 Optional)
  const canonicalDocs = useMemo<CanonicalDocument[]>(() => {
    return resolveApplicantDocs(localApplicant);
  }, [localApplicant]);

  const mandatoryDocs = useMemo(() => canonicalDocs.filter((d) => !d.isOptional), [canonicalDocs]);
  const optionalDocs = useMemo(() => canonicalDocs.filter((d) => d.isOptional), [canonicalDocs]);

  const mandatoryVerifiedCount = mandatoryDocs.filter((d) => d.verified).length;
  const mandatoryUploadedCount = mandatoryDocs.filter((d) => d.hasFile).length;
  const optionalUploadedCount = optionalDocs.filter((d) => d.hasFile).length;
  const totalUploadedCount = canonicalDocs.filter((d) => d.hasFile).length;

  const handlePreview = (doc: CanonicalDocument) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
    } else {
      setToastMsg({
        type: "error",
        text: "File not found on server — please re-upload",
      });
    }
  };

  const handleVerifyDoc = async (docKey: string) => {
    if (!localApplicant) return;
    try {
      setIsProcessing(true);
      const tenantId = (session as any)?.schoolId || localApplicant.tenantId;
      const res = await fetch(`/api/v1/admissions/${localApplicant.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          "x-user-role": userRole,
          ...(session?.staffRole ? { "x-staff-role": session.staffRole } : {}),
        },
        body: JSON.stringify({
          docType: docKey,
          verified: true,
          verifiedBy: session?.name || "Admissions Officer",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to verify document on server");
      }

      setLocalApplicant((prev: any) => {
        if (!prev) return prev;
        const creds = prev.credentialsJson || [];
        let updatedCreds: any;
        if (Array.isArray(creds)) {
          let found = false;
          updatedCreds = creds.map((c: any) => {
            const k = (c.key || c.docType || c.type || "").toLowerCase();
            if (k.includes(docKey.toLowerCase()) || docKey.toLowerCase().includes(k)) {
              found = true;
              return { ...c, verified: true, status: "VERIFIED" };
            }
            return c;
          });
          if (!found) {
            updatedCreds.push({ key: docKey, type: docKey, verified: true, status: "VERIFIED" });
          }
        } else {
          const docs = Array.isArray(creds.documents) ? [...creds.documents] : [];
          let found = false;
          const newDocs = docs.map((c: any) => {
            const k = (c.key || c.docType || c.type || "").toLowerCase();
            if (k.includes(docKey.toLowerCase()) || docKey.toLowerCase().includes(k)) {
              found = true;
              return { ...c, verified: true, status: "VERIFIED" };
            }
            return c;
          });
          if (!found) newDocs.push({ key: docKey, type: docKey, verified: true, status: "VERIFIED" });
          updatedCreds = { ...creds, documents: newDocs };
        }
        return { ...prev, credentialsJson: updatedCreds };
      });

      setToastMsg({ type: "success", text: `${docKey} marked as verified.` });
    } catch (err: any) {
      setToastMsg({ type: "error", text: err.message || "Failed to verify document" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (docKey: string, file?: File | null) => {
    if (!file || !localApplicant) return;
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("token", "admin-session");
      formData.append(docKey, file);

      const targetId = (localApplicant as any).leadId || localApplicant.id;
      const res = await fetch(`/api/v1/admissions/upload/${targetId}?token=admin`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload file");
      }

      const newUrl = data.documents?.[docKey]?.url || data.documents?.[docKey]?.fileUrl;

      // Immediately turn badge GREEN and update local applicant state
      setLocalApplicant((prev: any) => {
        if (!prev) return prev;
        const creds = prev.credentialsJson || [];
        let updatedCreds: any;
        const docEntry = {
          key: docKey,
          type: docKey,
          docType: docKey,
          fileUrl: newUrl,
          url: newUrl,
          fileName: file.name,
          verified: false,
        };
        if (Array.isArray(creds)) {
          const filtered = creds.filter(
            (c: any) => !(c.key || c.type || "").toLowerCase().includes(docKey.toLowerCase())
          );
          updatedCreds = [...filtered, docEntry];
        } else {
          const docs = Array.isArray(creds.documents) ? [...creds.documents] : [];
          const filtered = docs.filter(
            (c: any) => !(c.key || c.type || "").toLowerCase().includes(docKey.toLowerCase())
          );
          updatedCreds = { ...creds, documents: [...filtered, docEntry] };
        }
        return { ...prev, credentialsJson: updatedCreds };
      });

      setToastMsg({ type: "success", text: `New document uploaded successfully!` });
    } catch (err: any) {
      setToastMsg({ type: "error", text: err.message || "Upload failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Extract status audit logs from credentialsJson.statusLogs
  const timelineLogs = useMemo<AdmissionStatusLog[]>(() => {
    if (!localApplicant) return [];
    let logs: AdmissionStatusLog[] = [];

    if (typeof localApplicant.credentialsJson === "object" && localApplicant.credentialsJson !== null) {
      if (Array.isArray(localApplicant.credentialsJson.statusLogs)) {
        logs = [...localApplicant.credentialsJson.statusLogs];
      }
    }

    // If empty, supply standard initial audit creation event
    if (logs.length === 0) {
      logs.push({
        fromStatus: "INQUIRY",
        toStatus: localApplicant.status,
        changedById: localApplicant.verifiedBy || "Admissions State Machine",
        reason: "Initial profile created into Admission Register",
        createdAt: localApplicant.createdAt,
      });
    }

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [localApplicant]);

  const formFeePaid = Boolean(
    applicant?.formFeePaid ||
    (typeof applicant?.credentialsJson === "object" && applicant?.credentialsJson?.formFeePaid)
  );

  const leadSource =
    applicant?.leadSource ||
    (typeof applicant?.credentialsJson === "object" && applicant?.credentialsJson?.leadSource) ||
    "Portal Application";

  if (!isOpen || !applicant) return null;

  const renderStatusBadge = (status: string) => {
    const s = (status || "INQUIRY").toUpperCase();
    if (s === "INQUIRY") {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
          INQUIRY
        </span>
      );
    }
    if (s === "DOCS_PENDING" || s === "NEW" || s === "DOCS_SUBMITTED" || s === "UNDER_REVIEW") {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> DOCS_PENDING
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5" /> VERIFIED
        </span>
      );
    }
    if (s === "APPROVED") {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
        </span>
      );
    }
    if (s === "REJECTED") {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1.5">
          <Ban className="w-3.5 h-3.5" /> REJECTED
        </span>
      );
    }
    if (s === "CONVERTED" || s === "ADMITTED" || s === "ENROLLED") {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-300 dark:border-violet-800 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" /> CONVERTED TO STUDENT
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  const handleCopyAppNo = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(applicant.applicationNo);
      setCopiedAppNo(true);
      setTimeout(() => setCopiedAppNo(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity duration-300">
      <div
        className={`w-full ${
          isMaximized ? "max-w-full" : "max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
        } bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col transition-all duration-300 border-l border-slate-200 dark:border-zinc-800`}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-zinc-100 truncate">
                  {applicant.firstName} {applicant.lastName}
                </h2>
                {renderStatusBadge(applicant.status)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleCopyAppNo}
                  className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 transition"
                >
                  <span>{applicant.applicationNo}</span>
                  <Copy className="w-3 h-3" />
                </button>
                {copiedAppNo && (
                  <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition hidden sm:inline-flex cursor-pointer"
              title={isMaximized ? "Restore view" : "Maximize view"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TABS: DOSSIER vs TIMELINE */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("dossier")}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "dossier"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Candidate Dossier</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "timeline"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Timeline ({timelineLogs.length})</span>
          </button>
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === "dossier" ? (
            <>
              {/* TOAST ALERT BANNER */}
              {toastMsg && (
                <div
                  className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold transition ${
                    toastMsg.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-emerald-800 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-800 dark:text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {toastMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{toastMsg.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToastMsg(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* ESSENTIAL CARDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {/* Cohort */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Assigned Class
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-100">
                    <GraduationCap className="w-4 h-4 text-indigo-500" />
                    <span className="truncate">{applicant.assignedClass || applicant.classApplied}</span>
                  </div>
                </div>

                {/* Form Fee */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Form Fee Status
                  </span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {formFeePaid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <Check className="w-4 h-4" /> Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                        <Clock className="w-4 h-4" /> Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Lead Source */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Lead Source
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-100 truncate">
                    <GitMerge className="w-4 h-4 text-violet-500 shrink-0" />
                    <span className="truncate">{leadSource}</span>
                  </div>
                </div>

                {/* Registered Date */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Date Filed
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-slate-800 dark:text-zinc-200">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{new Date(applicant.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* CONTACT DETAILS */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Guardian / Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-200">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono">{applicant.parentPhone}</span>
                  </div>
                  {applicant.email && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-200 truncate">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{applicant.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* DOCUMENTS CHECKLIST */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      Required & Optional KYC Documents (5)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      4 Mandatory documents • 1 Optional medical report
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {totalUploadedCount}/5 Uploaded
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {mandatoryVerifiedCount}/4 Mandatory
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                      {optionalUploadedCount}/1 Optional
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {canonicalDocs.map((doc) => (
                    <div
                      key={doc.key}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            doc.verified
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200"
                              : doc.hasFile
                              ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200"
                              : doc.isMissing
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700"
                          }`}
                        >
                          <FileCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 dark:text-zinc-100 text-xs sm:text-sm truncate">
                              {doc.label}
                            </p>
                            {doc.isOptional ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                                Optional
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Mandatory
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono truncate mt-0.5">
                            {doc.fileName ? (
                              <span className="text-slate-500 dark:text-zinc-400">
                                {doc.fileName} {doc.size ? `• ${(doc.size / 1024).toFixed(1)} KB` : ""}
                              </span>
                            ) : doc.isMissing ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                File not found on server — please re-upload
                              </span>
                            ) : doc.isOptional ? (
                              <span className="text-slate-400 dark:text-zinc-500 font-medium">
                                Optional document — Not required for admission
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-500">
                                Awaiting document upload
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                        {/* PREVIEW BUTTON */}
                        <button
                          type="button"
                          onClick={() => handlePreview(doc)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            doc.fileUrl
                              ? "border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700"
                              : "border-slate-200 dark:border-zinc-800 text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          <span>Preview</span>
                        </button>

                        {/* RE-UPLOAD / UPLOAD ACTION */}
                        <label className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition flex items-center gap-1.5 cursor-pointer">
                          <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{doc.hasFile ? "Re-upload" : "Upload"}</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileUpload(doc.key, e.target.files[0]);
                              }
                            }}
                          />
                        </label>

                        {/* VERIFY BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleVerifyDoc(doc.key)}
                          disabled={doc.verified || isProcessing}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                            doc.verified
                              ? "bg-emerald-600 text-white cursor-default"
                              : !doc.fileUrl
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                          }`}
                        >
                          {doc.verified ? "Verified ✓" : "Mark Verified"}
                        </button>

                        {/* UPLOADED / VERIFIED STATUS BADGE */}
                        {doc.verified ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                            Verified ✓
                          </span>
                        ) : doc.hasFile ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                            Uploaded
                          </span>
                        ) : doc.isMissing || doc.hasFileName ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                            Missing
                          </span>
                        ) : doc.isOptional ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                            Optional — Not Uploaded
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                            Not Uploaded
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* UNIVERSAL BURSAR FORM FEE RECEIPT SECTION */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      Bursar Form Fee Payment Receipt
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      Central Finance Clearance & Verification
                    </p>
                  </div>
                  {formFeePaid ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Form Fee Paid
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Form Fee Pending
                    </span>
                  )}
                </div>

                {applicantReceipt ? (
                  <PaymentReceiptVerify
                    receipt={applicantReceipt}
                    compact={true}
                    canVerify={isAuthorized}
                    onVerifySuccess={(updated) => {
                      setApplicantReceipt(updated);
                      setLocalApplicant((prev: any) => ({
                        ...prev,
                        formFeePaid: true,
                        credentialsJson: {
                          ...(typeof prev?.credentialsJson === "object" ? prev.credentialsJson : {}),
                          formFeePaid: true,
                        },
                      }));
                      setToastMsg({ type: "success", text: "Form fee verified successfully! Form Fee set to Paid." });
                    }}
                  />
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 py-1">
                    <span>No bank payment slip attached yet for {applicant.applicationNo}.</span>
                    <button
                      type="button"
                      onClick={() => setShowReceiptUpload((v) => !v)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 transition self-start sm:self-auto cursor-pointer"
                    >
                      {showReceiptUpload ? "Close Upload" : "+ Record / Attach Receipt"}
                    </button>
                  </div>
                )}

                {showReceiptUpload && (
                  <div className="pt-2">
                    <PaymentReceiptUpload
                      moduleType="ADMISSION_FORM_FEE"
                      payerType="APPLICANT"
                      payerId={applicant.id}
                      payerName={`${applicant.firstName} ${applicant.lastName}`}
                      payerEmail={applicant.email || undefined}
                      referenceNo={applicant.applicationNo}
                      tenantId={applicant.tenantId}
                      schoolId={applicant.tenantId}
                      onUploadSuccess={(newR) => {
                        setApplicantReceipt(newR);
                        setShowReceiptUpload(false);
                        setToastMsg({ type: "success", text: "Receipt uploaded successfully for Bursar verification." });
                      }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* TIMELINE (from AdmissionStatusLog) */
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Audited State Transitions ({timelineLogs.length})
              </h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
                {timelineLogs.map((log, lIdx) => (
                  <div key={lIdx} className="relative group">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] shadow-xs">
                      <Check className="w-3 h-3" />
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <span className="text-slate-500 uppercase text-[10px]">{log.fromStatus}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-indigo-600 dark:text-indigo-400 uppercase font-black">{log.toStatus}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-zinc-200 font-medium">
                        {log.reason || "Status transition recorded."}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Authorized by: <strong className="text-slate-600 dark:text-zinc-300">{log.changedById}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS: PERMISSION GATED VIA canMutate */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {!isAuthorized ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Read-Only Mode: Structural state changes reserved for authorized staff.</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full justify-between sm:justify-end">
              {applicant.status !== "REJECTED" && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await onReject(applicant.id);
                    setIsProcessing(false);
                  }}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Reject File</span>
                </button>
              )}

              {applicant.status !== "VERIFIED" && applicant.status !== "CONVERTED" && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await onVerifyDocs(applicant.id);
                    setIsProcessing(false);
                  }}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Mark Verified</span>
                </button>
              )}

              {applicant.status !== "CONVERTED" && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await onAdmit(applicant.id);
                    setIsProcessing(false);
                  }}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Convert to Student</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
