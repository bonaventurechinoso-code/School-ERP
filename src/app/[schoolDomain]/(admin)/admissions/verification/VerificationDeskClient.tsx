"use client";

import React, { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileText,
  AlertTriangle,
  User,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Clock,
  Download,
} from "lucide-react";
import {
  approveAdmissionsDocument,
  rejectAdmissionsDocument,
} from "./actions";

export const DocumentRejectionReason = {
  BLURRY_UNREADABLE: "Blurry or unreadable scan",
  NAME_MISMATCH: "Name mismatch on certificate",
  INSUFFICIENT_CREDITS: "Insufficient credits for selected program",
  EXPIRED_DOCUMENT: "Expired document or invalid issue date",
  WRONG_DOCUMENT_TYPE: "Incorrect document uploaded for slot",
  SUSPECTED_TAMPERING: "Suspected digital alteration or incomplete copy",
  OTHER: "Other institutional compliance reason",
} as const;

interface DocumentItem {
  id: string;
  tenantId: string;
  applicationId: string;
  documentType: string;
  storageKey: string;
  fileMimeType: string;
  fileSizeBytes: number;
  verificationStatus: "PENDING" | "AUTO_VERIFIED" | "MANUALLY_VERIFIED" | "REJECTED";
  rejectionReason?: string | null;
  verifiedByUserId?: string | null;
  verifiedAt?: string | Date | null;
  presignedUrl: string;
  createdAt: string | Date;
}

interface ApplicationItem {
  id: string;
  tenantId: string;
  schoolId: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email: string;
  phoneNumber: string;
  whatsappNumber?: string | null;
  dateOfBirth: string | Date;
  gender: string;
  status: string;
  programId: string;
  tierSpecificData: any;
  documents: DocumentItem[];
  feeTransactions: any[];
}

interface VerificationDeskProps {
  initialApplications: ApplicationItem[];
  schoolId: string;
  schoolName: string;
}

export default function VerificationDeskClient({
  initialApplications,
  schoolId,
  schoolName,
}: VerificationDeskProps) {
  const [applications, setApplications] = useState<ApplicationItem[]>(initialApplications);
  const [selectedAppId, setSelectedAppId] = useState<string>(
    initialApplications[0]?.id || ""
  );
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Pan & Zoom Document Viewer State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Rejection Modal State
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>(
    DocumentRejectionReason.BLURRY_UNREADABLE
  );
  const [rejectionNotes, setRejectionNotes] = useState<string>("");
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const selectedApp = applications.find((a) => a.id === selectedAppId);
  const currentDoc =
    selectedApp?.documents.find((d) => d.id === selectedDocId) ||
    selectedApp?.documents[0];

  const filteredApps = applications.filter((app) => {
    const fullName = `${app.firstName} ${app.lastName} ${app.applicationNumber}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase());
    if (statusFilter === "ALL") return matchesSearch;
    return matchesSearch && app.status === statusFilter;
  });

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetView = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleApprove = (docId: string) => {
    startTransition(async () => {
      const res = await approveAdmissionsDocument(docId, schoolId);
      if (res.success) {
        setApplications((prev) =>
          prev.map((app) => {
            if (app.id !== selectedAppId) return app;
            return {
              ...app,
              documents: app.documents.map((d) =>
                d.id === docId
                  ? {
                      ...d,
                      verificationStatus: "MANUALLY_VERIFIED",
                      rejectionReason: null,
                    }
                  : d
              ),
            };
          })
        );
        setActionFeedback({
          type: "success",
          message: "Credential verified and atomically locked.",
        });
        setTimeout(() => setActionFeedback(null), 4000);
      } else {
        setActionFeedback({ type: "error", message: res.error || "Approval failed." });
      }
    });
  };

  const handleRejectSubmit = () => {
    if (!rejectingDocId) return;

    startTransition(async () => {
      const res = await rejectAdmissionsDocument({
        documentId: rejectingDocId,
        schoolId,
        reason: rejectionReason,
        customNotes: rejectionNotes,
      });

      if (res.success) {
        setApplications((prev) =>
          prev.map((app) => {
            if (app.id !== selectedAppId) return app;
            return {
              ...app,
              status: "ACTION_REQUIRED",
              documents: app.documents.map((d) =>
                d.id === rejectingDocId
                  ? {
                      ...d,
                      verificationStatus: "REJECTED",
                      rejectionReason: rejectionNotes
                        ? `${rejectionReason}: ${rejectionNotes}`
                        : rejectionReason,
                    }
                  : d
              ),
            };
          })
        );
        setRejectingDocId(null);
        setRejectionNotes("");
        setActionFeedback({
          type: "success",
          message: "Document marked rejected. Real-time alert dispatched to applicant with 72-hr re-upload link.",
        });
        setTimeout(() => setActionFeedback(null), 5000);
      } else {
        setActionFeedback({ type: "error", message: res.error || "Rejection failed." });
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 dark:bg-zinc-950 font-sans">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              Admissions Verification Desk
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {schoolName} • Split-Screen Credential Audit & Clearance
            </p>
          </div>
        </div>

        {actionFeedback && (
          <div
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              actionFeedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300"
            }`}
          >
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Split-Screen Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Leftmost: Applicant Selector Sidebar */}
        <div className="w-80 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200 dark:border-zinc-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search applicant name / ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold"
            >
              <option value="ALL">All Application Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER REVIEW</option>
              <option value="ACTION_REQUIRED">ACTION REQUIRED</option>
              <option value="OFFER_ACCEPTED">OFFER ACCEPTED</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredApps.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching applications in queue.
              </div>
            ) : (
              filteredApps.map((app) => {
                const isSelected = app.id === selectedAppId;
                const pendingCount = app.documents.filter(
                  (d) => d.verificationStatus === "PENDING"
                ).length;
                return (
                  <button
                    key={app.id}
                    onClick={() => {
                      setSelectedAppId(app.id);
                      setSelectedDocId(app.documents[0]?.id || "");
                    }}
                    className={`w-full text-left p-3.5 transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {app.firstName} {app.lastName}
                      </p>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                        {app.applicationNumber}
                      </p>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {app.programId}
                      </span>
                    </div>
                    {pendingCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                        {pendingCount} req
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel: Applicant Bio-Data & Credential Checklist */}
        <div className="w-[450px] bg-slate-50 dark:bg-zinc-900/60 border-r border-slate-200 dark:border-zinc-800 flex flex-col shrink-0 overflow-y-auto">
          {selectedApp ? (
            <div className="p-5 space-y-6">
              {/* Profile Card */}
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black">
                    {selectedApp.firstName[0]}
                    {selectedApp.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                      {selectedApp.firstName} {selectedApp.lastName}
                    </h2>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                      {selectedApp.applicationNumber}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{selectedApp.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{selectedApp.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{new Date(selectedApp.dateOfBirth).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{selectedApp.programId}</span>
                  </div>
                </div>
              </div>

              {/* Tier-Specific Academic Matrix (e.g. O'Level 2-Sitting or K12 Records) */}
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Academic Credentials & Subject Matrix
                </h3>

                {selectedApp.tierSpecificData?.oLevel ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-800 p-2 rounded-lg font-bold">
                      <span>Exam: {selectedApp.tierSpecificData.oLevel.examBoard || "WAEC/NECO"}</span>
                      <span>Sittings: {selectedApp.tierSpecificData.oLevel.sittings || 1}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {(selectedApp.tierSpecificData.oLevel.subjects || []).map(
                        (sub: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-zinc-800/80 rounded-lg border border-slate-200 dark:border-zinc-700/60"
                          >
                            <span className="truncate font-semibold">{sub.name}</span>
                            <span
                              className={`font-black px-1.5 py-0.5 rounded text-[11px] ${
                                ["A1", "B2", "B3", "C4", "C5", "C6"].includes(sub.grade)
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {sub.grade}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : selectedApp.tierSpecificData?.jamb ? (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-indigo-900 dark:text-indigo-200">
                      JAMB / UTME Score: {selectedApp.tierSpecificData.jamb.score || "N/A"}
                    </p>
                    <p className="text-indigo-700 dark:text-indigo-300">
                      Reg No: {selectedApp.tierSpecificData.jamb.regNumber || "N/A"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Standard institutional intake profile. No secondary sitting matrix required.
                  </p>
                )}
              </div>

              {/* Uploaded Documents List */}
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Uploaded Credentials ({selectedApp.documents.length})
                </h3>

                <div className="space-y-2">
                  {selectedApp.documents.map((doc) => {
                    const isDocSelected = doc.id === currentDoc?.id;
                    const isVerified = doc.verificationStatus === "MANUALLY_VERIFIED" || doc.verificationStatus === "AUTO_VERIFIED";
                    const isRejected = doc.verificationStatus === "REJECTED";

                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isDocSelected
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30"
                            : "border-slate-200 dark:border-zinc-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {doc.documentType.replace(/_/g, " ")}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isVerified
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : isRejected
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {doc.verificationStatus}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 truncate font-mono">
                          {doc.storageKey.split("/").pop()}
                        </p>

                        {isRejected && doc.rejectionReason && (
                          <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-1.5 rounded-md">
                            <strong>Query:</strong> {doc.rejectionReason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons for Current Active Document */}
              {currentDoc && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 space-y-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                    Audit Action: <span className="text-slate-900 dark:text-white">{currentDoc.documentType.replace(/_/g, " ")}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={isPending || currentDoc.verificationStatus === "MANUALLY_VERIFIED"}
                      onClick={() => handleApprove(currentDoc.id)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{currentDoc.verificationStatus === "MANUALLY_VERIFIED" ? "Verified & Locked" : "Approve Credential"}</span>
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => setRejectingDocId(currentDoc.id)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-2 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject / Query</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              Select an applicant from the list to begin audit.
            </div>
          )}
        </div>

        {/* Right Panel: Pan-and-Zoom High-Fidelity Document Viewer */}
        <div className="flex-1 bg-slate-900 flex flex-col relative overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="bg-slate-950/80 backdrop-blur-xs border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>{currentDoc ? currentDoc.documentType.replace(/_/g, " ") : "Document Viewer"}</span>
              </span>
              {currentDoc && (
                <span className="text-[11px] font-mono text-slate-500">
                  ({(currentDoc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={handleZoomIn}
                title="Zoom In"
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                title="Zoom Out"
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotate}
                title="Rotate 90deg"
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetView}
                title="Reset View"
                className="px-2 py-1 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              {currentDoc && (
                <a
                  href={currentDoc.presignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open Presigned Link in New Tab"
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Canvas Viewport */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-950">
            {currentDoc ? (
              currentDoc.fileMimeType.includes("pdf") ? (
                <iframe
                  src={`${currentDoc.presignedUrl}#toolbar=0`}
                  title="PDF Credential"
                  className="w-full h-full rounded-xl bg-white shadow-2xl border border-slate-800"
                />
              ) : (
                <div
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: "transform 0.15s ease-out",
                  }}
                  className="max-w-full max-h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                >
                  <img
                    src={currentDoc.presignedUrl}
                    alt="Applicant Document"
                    className="max-h-[80vh] object-contain rounded-lg shadow-2xl border border-slate-800 select-none pointer-events-none"
                  />
                </div>
              )
            ) : (
              <div className="text-center text-slate-500 text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <span>No document loaded for preview.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Structured Rejection Modal */}
      {rejectingDocId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Reject / Query Credential
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Selecting a rejection reason will instantly alert the applicant via WhatsApp and Email with an authenticated link to re-upload within 72 hours.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Mandatory Rejection Category:
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  {Object.values(DocumentRejectionReason).map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Specific Instructions / Auditor Notes:
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. WAEC scratch card pin not readable or birth date does not match bio-data."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingDocId(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRejectSubmit}
                className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-xs"
              >
                {isPending ? "Dispatching Alert..." : "Confirm & Send Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

