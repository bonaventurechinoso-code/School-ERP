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
} from "lucide-react";
import { requestApplicantDocsAction } from "./actions";

export interface AdmissionRegisterRecord {
  id: string;
  tenantId: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  classApplied: string;
  parentPhone: string;
  email?: string | null;
  credentialsJson?: Array<{
    type?: string;
    docType?: string;
    url?: string;
    path?: string;
    filename?: string;
    originalName?: string;
    name?: string;
    verified?: boolean;
    size?: number;
    uploadedAt?: string;
  }> | Record<string, any> | any | null;
  status: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  admittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdmissionRegisterDrawerProps {
  applicant: AdmissionRegisterRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onVerifyDocs: (id: string) => Promise<void>;
  onAdmit: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  schoolName?: string;
  schoolDomain?: string;
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
}: AdmissionRegisterDrawerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedAppNo, setCopiedAppNo] = useState(false);

  // Normalize and parse uploaded credentials from Array, Object Map, or JSON String
  const normalizedDocs = useMemo(() => {
    if (!applicant?.credentialsJson) return [];

    let rawData: any = applicant.credentialsJson;
    if (typeof rawData === "string") {
      try {
        rawData = JSON.parse(rawData);
      } catch {
        rawData = [];
      }
    }

    const items: any[] = [];
    if (Array.isArray(rawData)) {
      rawData.forEach((item) => {
        if (item && typeof item === "object") {
          // Exclude internal metadata nodes like TIER_INFO
          if (
            item.type === "TIER_INFO" ||
            (!item.url && !item.fileUrl && !item.path && !item.filename && !item.fileName && !item.savedName)
          ) {
            return;
          }
          items.push(item);
        }
      });
    } else if (rawData && typeof rawData === "object") {
      Object.entries(rawData).forEach(([key, val]) => {
        if (key === "TIER_INFO") return;
        if (val && typeof val === "object") {
          items.push({
            docKey: key,
            ...val,
          });
        } else if (typeof val === "string" && val.trim().length > 0) {
          items.push({
            docKey: key,
            url: val,
            fileUrl: val,
            fileName: val.split("/").pop() || key,
          });
        }
      });
    }

    const getDocTitle = (item: any) => {
      const key = (item.docType || item.type || item.key || item.docKey || "").toLowerCase();
      if (key.includes("passport")) return "Passport Photograph";
      if (key.includes("birth")) return "Birth Certificate / Age Declaration";
      if (key.includes("result") || key.includes("academic")) return "Previous Academic Results";
      if (key.includes("medical")) return "Medical Certificate of Fitness";
      if (key.includes("transfer") || key.includes("transcript")) return "Transfer Certificate / Transcript";
      return item.name || item.originalName || item.docType || item.type || "Official Credential Document";
    };

    const resolveUrl = (raw?: string | null) => {
      if (!raw) return "";
      const trimmed = raw.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("data:")
      ) {
        return trimmed;
      }
      if (trimmed.startsWith("/api/uploads/")) {
        return trimmed;
      }
      if (trimmed.startsWith("/uploads/")) {
        return `/api${trimmed}`;
      }
      if (trimmed.startsWith("uploads/")) {
        return `/api/${trimmed}`;
      }
      if (trimmed.startsWith("/")) {
        return trimmed;
      }
      return `/api/uploads/${trimmed}`;
    };

    return items
      .map((item, idx) => {
        const rawUrl = item.url || item.fileUrl || item.path || item.link || item.assetUrl || "";
        const fileUrl = resolveUrl(rawUrl);
        const fileName =
          item.fileName ||
          item.filename ||
          item.savedName ||
          item.originalName ||
          (rawUrl ? rawUrl.split("/").pop()?.split("?")[0] : "") ||
          `${item.docKey || "credential"}-${idx + 1}`;
        const typeLabel = getDocTitle(item);

        return {
          id: item.id || `doc-${idx}`,
          typeLabel,
          fileName,
          fileUrl,
          verified: Boolean(item.verified),
          size: item.size || item.fileSize,
        };
      })
      .filter((d) => Boolean(d.fileUrl));
  }, [applicant?.credentialsJson]);

  if (!isOpen || !applicant) return null;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            New Application
          </span>
        );
      case "docs_pending":
      case "under_review":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Documents Pending / Review
          </span>
        );
      case "admitted":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Admitted &amp; Enrolled
          </span>
        );
      case "rejected":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1.5 shadow-2xs">
            <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700">
            {status}
          </span>
        );
    }
  };

  const handleCopyAppNo = () => {
    navigator.clipboard.writeText(applicant.applicationNo);
    setCopiedAppNo(true);
    setTimeout(() => setCopiedAppNo(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full ${
          isMaximized
            ? "max-w-7xl sm:max-w-7xl md:max-w-7xl lg:max-w-7xl xl:max-w-full"
            : "sm:max-w-2xl md:max-w-3xl"
        } bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-zinc-800 transition-all duration-300 animate-in slide-in-from-right`}
      >
        {/* DRAWER HEADER */}
        <div className="p-6 md:p-8 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-900/80">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5">
                {applicant.applicationNo}
                <button
                  onClick={handleCopyAppNo}
                  className="hover:text-indigo-800 dark:hover:text-indigo-200 transition"
                  title="Copy Application Number"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </span>
              {copiedAppNo && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  Copied!
                </span>
              )}
              {getStatusBadge(applicant.status)}
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
              {applicant.firstName} {applicant.lastName}
            </h3>
            <p className="text-sm md:text-base font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-1">
              <GraduationCap className="w-4 h-4 text-indigo-500" />
              Applying for: <strong className="text-slate-800 dark:text-zinc-200">{applicant.classApplied}</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
              aria-label={isMaximized ? "Restore sheet width" : "Maximize sheet width"}
              title={isMaximized ? "Restore standard width" : "Maximize width"}
            >
              {isMaximized ? (
                <Minimize2 className="w-5 h-5 text-slate-600 dark:text-zinc-300" />
              ) : (
                <Maximize2 className="w-5 h-5 text-slate-600 dark:text-zinc-300" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
              aria-label="Close sheet"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* DRAWER BODY */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* PARENT / GUARDIAN CONTACT DETAILS */}
          <div className="bg-slate-50 dark:bg-zinc-800/40 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Primary Contact &amp; Guardian Info
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Parent Phone</p>
                  <a
                    href={`tel:${applicant.parentPhone}`}
                    className="text-base font-bold text-slate-800 dark:text-zinc-200 hover:text-indigo-600 transition font-mono"
                  >
                    {applicant.parentPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                  {applicant.email ? (
                    <a
                      href={`mailto:${applicant.email}`}
                      className="text-base font-bold text-slate-800 dark:text-zinc-200 hover:text-blue-600 transition truncate block max-w-[240px]"
                    >
                      {applicant.email}
                    </a>
                  ) : (
                    <span className="text-base text-slate-400 italic">Not provided</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CREDENTIALS & DOCUMENTS VAULT */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Verified Credentials &amp; Uploads
              </h4>
              <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-zinc-400">
                {normalizedDocs.length} file{normalizedDocs.length === 1 ? "" : "s"} uploaded
              </span>
            </div>

            {normalizedDocs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/20">
                <FileText className="w-9 h-9 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">
                  No credentials uploaded yet
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Applicant has not submitted documentary proof via the public upload portal.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {normalizedDocs.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="group p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-100 truncate">
                            {doc.typeLabel}
                          </p>
                          {doc.verified && (
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5 truncate" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs hover:shadow-xs"
                        title={`Open and preview ${doc.fileName} in new tab`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Preview File</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PERMANENT AUDIT TRAIL */}
          <div className="bg-slate-50 dark:bg-zinc-800/40 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Official Audit Trail (Permanent)
            </h4>
            <div className="space-y-3 text-sm divide-y divide-slate-200 dark:divide-zinc-800">
              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Application Submitted:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 font-mono">
                  {new Date(applicant.createdAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>

              {applicant.verifiedAt && (
                <div className="pt-2.5 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Credentials Verified:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 font-mono">
                    {new Date(applicant.verifiedAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {applicant.verifiedBy && ` by ${applicant.verifiedBy}`}
                  </span>
                </div>
              )}

              {applicant.admittedAt && (
                <div className="pt-2.5 flex items-center justify-between">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Admitted &amp; Enrolled:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                    {new Date(applicant.admittedAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}

              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Last Modified:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 font-mono">
                  {new Date(applicant.updatedAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* DRAWER FOOTER / ONE-CLICK ACTIONS */}
        <div className="p-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/80 flex items-center justify-between gap-3">
          {applicant.status !== "rejected" && (
            <button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                await onReject(applicant.id);
                setIsProcessing(false);
              }}
              className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              Reject
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {applicant.status !== "docs_pending" && applicant.status !== "admitted" && (
              <button
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  await onVerifyDocs(applicant.id);
                  setIsProcessing(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-bold text-xs transition flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                Verify Docs
              </button>
            )}

            {applicant.status.toLowerCase() === "docs_pending" || applicant.status.toLowerCase() === "new" ? (
              <button
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    const domain = schoolDomain || "portal";
                    const url = `${window.location.origin}/${domain}/admissions/track/${applicant.applicationNo}`;
                    if (typeof window !== "undefined") {
                      navigator.clipboard.writeText(url);
                    }

                    const res = await requestApplicantDocsAction({
                      admissionId: applicant.id,
                      applicationNo: applicant.applicationNo,
                      schoolId: applicant.tenantId,
                      schoolDomain: domain,
                      recipientEmail: applicant.email || undefined,
                    });

                    if (res && res.success) {
                      alert(`${res.message || "Document request email successfully dispatched!"}\n\nUpload link copied to clipboard:\n${url}`);
                      applicant.status = "docs_pending";
                    } else {
                      alert(`${res?.error || "Failed to dispatch email."}\n\nUpload link copied to clipboard:\n${url}`);
                    }
                  } catch (err: any) {
                    alert(err?.message || "Failed to send request docs email.");
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                title="Send Document Request Email & Copy Link"
              >
                <Clock className="w-4 h-4" />
                Request Docs
              </button>
            ) : (applicant.status.toLowerCase() === "docs_submitted" || applicant.status.toLowerCase() === "approved") ? (
              <button
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  await onAdmit(applicant.id);
                  setIsProcessing(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm hover:shadow-md transition flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                Admit Student
              </button>
            ) : applicant.status.toLowerCase() === "admitted" ? (
              <span className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Student Enrolled
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
