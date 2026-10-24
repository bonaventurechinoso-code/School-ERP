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
} from "lucide-react";
import { requestApplicantDocsAction } from "./actions";
import { useSession } from "@/lib/session-context";
import { isAdmissionsAuthorized } from "@/lib/admissions-rbac";
import {
  AdmissionRegisterRecord,
  AdmissionStatusLog,
  AdmissionStatus,
} from "@/lib/admissions.types";

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

  // RBAC Permission Profile
  const userRole = (session?.role || session?.staffRole || (session as any)?.userRole || (session?.user as any)?.role || "").toUpperCase();
  const isAuthorized = canMutate || isAdmissionsAuthorized(userRole, session?.staffRole);

  // Normalize credentials documents
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
      if (Array.isArray(rawData.documents)) {
        rawData.documents.forEach((item: any) => items.push(item));
      } else {
        Object.entries(rawData).forEach(([key, val]) => {
          if (key === "TIER_INFO" || key === "statusLogs" || key === "formFeePaid" || key === "convertedFromLead") return;
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
      if (trimmed.startsWith("/api/uploads/")) return trimmed;
      if (trimmed.startsWith("/uploads/")) return `/api${trimmed}`;
      if (trimmed.startsWith("uploads/")) return `/api/${trimmed}`;
      if (trimmed.startsWith("/")) return trimmed;
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

  // Extract status audit logs from credentialsJson.statusLogs
  const timelineLogs = useMemo<AdmissionStatusLog[]>(() => {
    if (!applicant) return [];
    let logs: AdmissionStatusLog[] = [];

    if (typeof applicant.credentialsJson === "object" && applicant.credentialsJson !== null) {
      if (Array.isArray(applicant.credentialsJson.statusLogs)) {
        logs = [...applicant.credentialsJson.statusLogs];
      }
    }

    // If empty, supply standard initial audit creation event
    if (logs.length === 0) {
      logs.push({
        fromStatus: "INQUIRY",
        toStatus: applicant.status,
        changedById: applicant.verifiedBy || "Admissions State Machine",
        reason: "Initial profile created into Admission Register",
        createdAt: applicant.createdAt,
      });
    }

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [applicant]);

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
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Required KYC Documents Checklist ({normalizedDocs.length})
                  </h4>
                  <span className="text-xs text-indigo-600 font-bold">
                    {normalizedDocs.filter((d) => d.verified).length}/{normalizedDocs.length} Verified
                  </span>
                </div>

                {normalizedDocs.length > 0 ? (
                  <div className="space-y-2.5">
                    {normalizedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              doc.verified
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200"
                                : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200"
                            }`}
                          >
                            <FileCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 dark:text-zinc-100 text-xs sm:text-sm truncate">
                              {doc.typeLabel}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">
                              {doc.fileName} {doc.size ? `• ${(doc.size / 1024).toFixed(1)} KB` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            <span>Preview</span>
                          </a>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              doc.verified
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            {doc.verified ? "Verified ✓" : "Uploaded"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl text-xs text-slate-400 space-y-2">
                    <FileCheck className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
                    <p className="font-bold text-slate-600 dark:text-zinc-300">Awaiting Parent KYC Uploads</p>
                    <p className="text-[11px]">No credential files uploaded to this dossier yet.</p>
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
