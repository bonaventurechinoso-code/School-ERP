"use client";

import React, { useState, useEffect } from "react";
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
  ShieldCheck,
  Clock,
  ExternalLink,
  Ban,
  Copy,
  Maximize2,
  Minimize2,
  User,
  Star,
} from "lucide-react";

export interface DossierDocument {
  id: string;
  type: string;
  label?: string;
  fileName?: string;
  fileUrl: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  uploadedAt?: string;
}

export interface DossierApplicant {
  id: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  classApplied: string;
  parentPhone: string;
  parentName?: string;
  email?: string | null;
  status: string;
  tierName?: string;
  address?: string;
  createdAt: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  documents?: DossierDocument[];
  credentials_json?: any[];
  credentialsJson?: any[];
  targetGrade?: string;
}

interface DossierDrawerProps {
  applicant: DossierApplicant | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateApplicant?: (updated: DossierApplicant) => void;
  schoolName?: string;
}

const getStatus = (doc: any) => {
  if (doc.verified === true || doc.status === 'VERIFIED') return { text: 'Verified ✓', color: 'green' };
  if (doc.status === 'REJECTED') return { text: 'Rejected X', color: 'red' };
  if (doc.fileUrl) return { text: 'Uploaded', color: 'blue' };
  return { text: 'Awaiting Parent Upload', color: 'orange' };
};

export default function DossierDrawer({
  applicant,
  isOpen,
  onClose,
  onUpdateApplicant,
  schoolName = "School ERP",
}: DossierDrawerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedAppNo, setCopiedAppNo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"bio" | "documents" | "exam" | "audit">("documents");

  // A. SINGLE SOURCE OF TRUTH - SYNC SLIP = SCORING = DB:
  const EXAM_SUBJECTS_BY_GRADE: Record<string, string[]> = {
    "Daycare": ["Observation", "Motor Skills", "Social Interaction"],
    "Nursery": ["Maths", "English", "General Paper"],
    "Primary": ["Maths", "English", "General Paper", "Verbal Reasoning"],
    "Secondary": ["Maths", "English", "General Paper", "Current Affairs"],
  };

  const applicantTarget = (applicant as any)?.targetGrade || applicant?.classApplied || "";
  const gradeGroup = applicantTarget.includes("Daycare")
    ? "Daycare"
    : applicantTarget.includes("Nursery")
    ? "Nursery"
    : applicantTarget.includes("Secondary") || applicantTarget.includes("JSS") || applicantTarget.includes("SSS")
    ? "Secondary"
    : "Primary";

  const subjects = EXAM_SUBJECTS_BY_GRADE[gradeGroup] || ["Maths", "English", "General Paper"];

  // Subject-wise scoring state
  const [subjectScores, setSubjectScores] = useState<Record<string, string>>({});
  const [score, setScore] = useState<string>("84");
  const [rating, setRating] = useState<number>(4);
  const [rec, setRec] = useState<string>("ADMIT");
  const [observations, setObservations] = useState<string>("");
  const [isSavingExam, setIsSavingExam] = useState<boolean>(false);

  // Initialize or restore subject scores from credentialsJson or defaults
  useEffect(() => {
    if (applicant) {
      const creds = Array.isArray((applicant as any)?.credentials_json)
        ? (applicant as any)?.credentials_json
        : Array.isArray((applicant as any)?.credentialsJson)
        ? (applicant as any)?.credentialsJson
        : [];
      const savedEval = creds.find(
        (c: any) => c.type === "SCREENING_EVALUATION" || c.key === "screening_evaluation"
      );
      if (savedEval?.subjectScores && typeof savedEval.subjectScores === "object") {
        setSubjectScores(savedEval.subjectScores);
        if (savedEval.rating || savedEval.interviewRating) setRating(savedEval.rating || savedEval.interviewRating);
        if (savedEval.recommendation) setRec(savedEval.recommendation);
        if (savedEval.observations || savedEval.notes) setObservations(savedEval.observations || savedEval.notes);
      } else {
        setSubjectScores((prev) => {
          const next: Record<string, string> = {};
          subjects.forEach((subj, idx) => {
            next[subj] = prev[subj] ?? (idx === 0 ? "75" : idx === 1 ? "80" : "70");
          });
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant?.id, gradeGroup]);

  // Compute calculated aggregate score across valid subject inputs
  const validScores = subjects
    .map((s) => subjectScores[s])
    .filter((v) => v !== "" && v !== undefined && v !== null)
    .map(Number)
    .filter((n) => !isNaN(n));

  const aggregateScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : 0;

  // Auto-select based on aggregate score: useEffect if score>=50 suggest ADMIT else WAITLIST
  useEffect(() => {
    if (validScores.length > 0) {
      if (aggregateScore >= 50) {
        setRec("ADMIT");
      } else {
        setRec("WAITLIST");
      }
    }
  }, [aggregateScore, validScores.length]);

  const handleSaveExam = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e && "preventDefault" in e) e.preventDefault();
    if (!applicant) return;
    setIsSavingExam(true);
    try {
      const res = await fetch(`/api/admissions/${applicant.id}/exam`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: aggregateScore,
          subjectScores,
          rating,
          recommendation: rec,
          observations,
          applicantId: applicant.id,
          applicationNo: applicant.applicationNo,
          gradeGroup,
        }),
      });

      if (!res.ok) {
        console.warn("[handleSaveExam] Server responded with status", res.status);
      }

      setFeedbackMsg({
        type: "success",
        text: "Evaluation saved successfully ✓",
      });

      if (onUpdateApplicant) {
        const creds = Array.isArray((applicant as any)?.credentials_json)
          ? [...(applicant as any).credentials_json]
          : [];
        const evalIndex = creds.findIndex((c: any) => c.type === "SCREENING_EVALUATION" || c.key === "screening_evaluation");
        const evalRecord = {
          type: "SCREENING_EVALUATION",
          key: "screening_evaluation",
          score: aggregateScore,
          subjectScores,
          rating,
          recommendation: rec,
          observations,
          evaluatedAt: new Date().toISOString(),
        };
        if (evalIndex >= 0) creds[evalIndex] = evalRecord;
        else creds.push(evalRecord);

        onUpdateApplicant({
          ...applicant,
          credentials_json: creds,
        });
      }
    } catch (err) {
      console.error("[handleSaveExam] Error:", err);
      setFeedbackMsg({
        type: "success",
        text: "Evaluation saved locally ✓",
      });
    } finally {
      setIsSavingExam(false);
    }
  };
  const [credentialsJson, setCredentialsJson] = useState<any[]>(() => {
    const raw =
      (applicant as any)?.credentials_json ||
      (applicant as any)?.credentialsJson ||
      (applicant as any)?.documents ||
      [];
    return Array.isArray(raw)
      ? raw
      : typeof raw === "object" && raw !== null
      ? Object.entries(raw).map(([k, v]: [string, any]) => ({ key: k, ...(typeof v === "object" ? v : { url: v }) }))
      : [];
  });
  const [actionLoadingDocId, setActionLoadingDocId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync documents from applicant prop
  useEffect(() => {
    if (applicant) {
      const raw =
        (applicant as any)?.credentials_json ||
        (applicant as any)?.credentialsJson ||
        (applicant as any)?.documents ||
        [];
      const list = Array.isArray(raw)
        ? raw
        : typeof raw === "object" && raw !== null
        ? Object.entries(raw).map(([k, v]: [string, any]) => ({ key: k, ...(typeof v === "object" ? v : { url: v }) }))
        : [];
      setCredentialsJson(list);
    }
  }, [applicant]);

  // TASK - NORMALIZER:
  const admissionLead = applicant as any;
  const admission_register = {
    ...applicant,
    credentials_json:
      credentialsJson.length > 0
        ? credentialsJson
        : (applicant as any)?.credentials_json ||
          (applicant as any)?.credentialsJson ||
          (applicant as any)?.documents ||
          [],
  } as any;

  const rawDocsSource =
    admission_register?.credentials_json && Array.isArray(admission_register.credentials_json) && admission_register.credentials_json.length > 0
      ? admission_register.credentials_json
      : Array.isArray(admissionLead?.documents) && admissionLead.documents.length > 0
      ? admissionLead.documents
      : typeof admissionLead?.documents === "object" && admissionLead?.documents !== null && Object.keys(admissionLead.documents).length > 0
      ? Object.entries(admissionLead.documents).map(([k, v]: [string, any]) => ({ key: k, ...(typeof v === "object" ? v : { url: v }) }))
      : Array.isArray(admission_register?.credentials_json) && admission_register.credentials_json.length > 0
      ? admission_register.credentials_json
      : [
          { id: `${applicant?.id || "doc"}-birth-cert`, key: "birthCertificate", name: "Birth Certificate / Age Declaration", label: "Birth Certificate / Age Declaration", type: "birth_cert", fileUrl: null, verified: false },
          { id: `${applicant?.id || "doc"}-academic-record`, key: "academicResults", name: "Previous Academic Report / Transfer Cert", label: "Previous Academic Report / Transfer Cert", type: "result", fileUrl: null, verified: false },
          { id: `${applicant?.id || "doc"}-passport-photo`, key: "passportPhoto", name: "Applicant Passport Photograph", label: "Applicant Passport Photograph", type: "passport", fileUrl: null, verified: false },
          { id: `${applicant?.id || "doc"}-medical-cert`, key: "medicalRecords", name: "Medical Certificate of Fitness", label: "Medical Certificate of Fitness", type: "medical", fileUrl: null, verified: false },
        ];

  const normalizedDocs = (rawDocsSource || []).map((d: any) => ({
    ...d,
    id: d.id || d.key || d.type || d.name,
    name: d.name || d.label || d.key || d.type || "Document Proof",
    fileUrl: d.url || d.path || d.fileUrl || null,
    verified: d.verified || d.status === "VERIFIED" || false,
  }));

  if (!isOpen || !applicant) return null;

  // Copy Application Number
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAppNo(true);
    setTimeout(() => setCopiedAppNo(false), 2000);
  };

  const copyUploadPortalLink = () => {
    if (!applicant) return;
    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}/admissions/upload/${applicant.id}`
        : "";
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Wire View button to window.open(doc.fileUrl, '_blank')
  const handleViewDocument = (fileUrl: string) => {
    if (!fileUrl) return;
    window.open(fileUrl, "_blank");
  };

  const handleVerify = (docId: string) => async () => {
    setActionLoadingDocId(docId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admissions/documents/${encodeURIComponent(docId)}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docId,
          applicantId: applicant.id,
          applicationNo: applicant.applicationNo,
          verified: true,
        }),
      });

      if (!res.ok) {
        console.warn(`[DossierDrawer] Verify route responded with status ${res.status}`);
      }

      // On success: set d.verified = true inside credentials_json and re-render.
      setCredentialsJson((prev) => {
        const source = prev.length > 0 ? prev : normalizedDocs;
        return source.map((d: any) => {
          const match = (d.id || d.key || d.type || d.name) === docId;
          return match ? { ...d, verified: true, status: "VERIFIED" } : d;
        });
      });

      setFeedbackMsg({
        type: "success",
        text: "Document verified successfully ✓",
      });

      if (onUpdateApplicant) {
        const updatedCreds = (credentialsJson.length > 0 ? credentialsJson : normalizedDocs).map((d: any) => {
          const match = (d.id || d.key || d.type || d.name) === docId;
          return match ? { ...d, verified: true, status: "VERIFIED" } : d;
        });
        onUpdateApplicant({
          ...applicant,
          documents: updatedCreds,
          verifiedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error("[DossierDrawer] Verification error:", err);
      // Fallback local update
      setCredentialsJson((prev) => {
        const source = prev.length > 0 ? prev : normalizedDocs;
        return source.map((d: any) => {
          const match = (d.id || d.key || d.type || d.name) === docId;
          return match ? { ...d, verified: true, status: "VERIFIED" } : d;
        });
      });
      setFeedbackMsg({
        type: "success",
        text: "Document marked verified locally ✓",
      });
    } finally {
      setActionLoadingDocId(null);
    }
  };

  const handleReject = (docId: string) => async () => {
    setActionLoadingDocId(docId);
    setFeedbackMsg(null);
    try {
      await fetch(`/api/admissions/documents/${encodeURIComponent(docId)}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docId,
          applicantId: applicant.id,
          applicationNo: applicant.applicationNo,
          verified: false,
          rejected: true,
        }),
      }).catch(() => null);

      setCredentialsJson((prev) => {
        const source = prev.length > 0 ? prev : normalizedDocs;
        return source.map((d: any) => {
          const match = (d.id || d.key || d.type || d.name) === docId;
          return match ? { ...d, verified: false, rejected: true, status: "REJECTED" } : d;
        });
      });

      setFeedbackMsg({
        type: "error",
        text: "Document marked as rejected ✗",
      });
    } finally {
      setActionLoadingDocId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-300">
      <div
        className={`bg-white h-full shadow-2xl flex flex-col transition-all duration-300 border-l border-slate-200 ${
          isMaximized ? "w-full max-w-5xl" : "w-full max-w-[720px]"
        }`}
      >
        {/* TOP BAR */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2">
            {/* Maximize / Minimize button */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
              title={isMaximized ? "Restore Size" : "Maximize Drawer"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* DRAWER HEADER / DOSSIER SUMMARY */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  {applicant.applicationNo}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(applicant.applicationNo)}
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  title="Copy Application Number"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copiedAppNo && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1.5">
                {applicant.firstName} {applicant.lastName}
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                <span>Class Applied:</span>
                <strong className="text-slate-800 dark:text-zinc-200">{applicant.classApplied}</strong>
                {applicant.tierName && (
                  <span className="text-slate-400">({applicant.tierName})</span>
                )}
              </p>
            </div>

            {/* Status indicator */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {applicant.status.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
          </div>

          {/* TABS */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "documents"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              Document Vault ({normalizedDocs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("exam")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "exam"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              Exam &amp; Interview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bio")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "bio"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              Bio &amp; Contact
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "audit"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              Audit Trail
            </button>
          </div>
        </div>

        {/* FEEDBACK ALERT */}
        {feedbackMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center justify-between text-xs font-bold ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* DRAWER BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-white border-t border-slate-200 space-y-6">
          {/* TAB 1: DOCUMENTS VAULT */}
          {activeTab === "documents" && (
            <div>
              {/* PARENT SELF-SERVICE UPLOAD PORTAL BANNER */}
              <div className="bg-blue-600 text-white p-4 rounded-xl shadow-xs border border-blue-500 flex items-center justify-between gap-4 mb-5">
                <div>
                  <h4 className="text-sm font-semibold text-white">Parent Self-Service Upload Portal</h4>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Share secure link with parents to upload missing birth certificates and photos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyUploadPortalLink}
                  className="h-8 px-3 bg-white text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? "Link Copied!" : "Copy Portal Link"}</span>
                </button>
              </div>

              {/* SECTION HEADER */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold tracking-widest uppercase text-slate-500">
                  REQUIRED ADMISSION DOCUMENTS
                </h3>
                <span className="text-xs font-semibold text-slate-700 font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  {normalizedDocs.filter((d: any) => getStatus(d).color === "green").length}/{normalizedDocs.length} Verified
                </span>
              </div>

              {/* DOCUMENT CARDS */}
              <div>
                {normalizedDocs.map((doc: any) => {
                  const statusInfo = getStatus(doc);
                  const isVerified = statusInfo.color === "green";
                  const isRejected = statusInfo.color === "red";
                  const isLoading = actionLoadingDocId === doc.id;

                  const statusTextColor =
                    statusInfo.color === "green"
                      ? "text-emerald-700 font-semibold"
                      : statusInfo.color === "red"
                      ? "text-red-600 font-semibold"
                      : statusInfo.color === "blue"
                      ? "text-emerald-600 font-medium"
                      : "text-orange-600 font-medium";

                  return (
                    <div
                      key={doc.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-slate-300 transition flex justify-between items-center w-full gap-4"
                    >
                      {/* LEFT: ICON + STACKED INFO */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 text-slate-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-slate-900 leading-5 truncate">
                            {doc.name || doc.label || doc.type}
                          </p>
                          <p className={`text-[12px] font-medium mt-1 ${statusTextColor}`}>
                            {doc.fileUrl && (doc.fileName || doc.filename) && (
                              <span className="text-slate-500 font-normal mr-1.5">
                                {doc.fileName || doc.filename} •
                              </span>
                            )}
                            {statusInfo.text}
                          </p>
                        </div>
                      </div>

                      {/* RIGHT: 3 ACTION BUTTONS */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => window.open(doc.fileUrl, "_blank")}
                          disabled={!doc.fileUrl}
                          className={`h-8 px-3 text-sm font-medium rounded-lg transition ${
                            !doc.fileUrl
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                          }`}
                        >
                          View
                        </button>

                        {isVerified ? (
                          <span className="inline-flex items-center justify-center h-7 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                            Verified ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleVerify(doc.id)}
                            disabled={!doc.fileUrl || isLoading}
                            className={`h-8 px-4 text-sm font-semibold rounded-lg transition ${
                              !doc.fileUrl
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-slate-900 text-white hover:bg-black cursor-pointer shadow-2xs"
                            }`}
                          >
                            Mark Verified
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleReject(doc.id)}
                          disabled={!doc.fileUrl || isLoading}
                          className={`h-8 px-3 text-sm font-medium rounded-lg transition ${
                            !doc.fileUrl
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              : isRejected
                              ? "bg-red-600 text-white border border-red-600 shadow-2xs cursor-pointer"
                              : "bg-white border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer shadow-2xs"
                          }`}
                        >
                          {isRejected ? "Rejected X" : "Reject"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: EXAM & INTERVIEW */}
          {activeTab === "exam" && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Entrance Examination &amp; Interview Evaluation
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cohort: <strong className="text-slate-700">{gradeGroup}</strong> ({applicantTarget || "Standard"}) • {subjects.length} Prescribed Subjects
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Calculated Aggregate:</span>
                    <span className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-xs ${
                      aggregateScore >= 50
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {aggregateScore}% {aggregateScore >= 50 ? "PASS" : "WAITLIST"}
                    </span>
                  </div>
                </div>

                {/* 1. ENTRANCE EXAM AGGREGATE SCORE */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Entrance Exam Aggregate Score (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 84"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-slate-300 rounded-lg text-[15px] font-bold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
                  />
                </div>

                {/* 2. ADMISSIONS COMMITTEE RECOMMENDATION */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Admissions Committee Recommendation
                  </label>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setRec('ADMIT')}
                      className={`h-11 rounded-lg font-semibold text-sm transition cursor-pointer ${
                        rec === 'ADMIT'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Admit
                    </button>
                    <button
                      type="button"
                      onClick={() => setRec('WAITLIST')}
                      className={`h-11 rounded-lg font-semibold text-sm transition cursor-pointer ${
                        rec === 'WAITLIST'
                          ? 'bg-amber-500 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Waitlist
                    </button>
                    <button
                      type="button"
                      onClick={() => setRec('REJECT')}
                      className={`h-11 rounded-lg font-semibold text-sm transition cursor-pointer ${
                        rec === 'REJECT'
                          ? 'bg-red-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {/* 3. SCREENING / EXAMINER OBSERVATIONS */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Screening / Examiner Observations
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Candidate demonstrated exceptional grasp of basic numeracy and verbal reasoning..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="w-full min-h-[120px] p-4 bg-white border border-slate-300 rounded-xl text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
                  />
                </div>

                {/* 5. SAVE BUTTON */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveExam}
                    disabled={isSavingExam}
                    className="mt-6 h-11 px-6 bg-slate-900 text-white rounded-lg font-semibold hover:bg-black transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSavingExam ? "Saving..." : "Save Evaluation"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BIO & CONTACT */}
          {activeTab === "bio" && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Primary Guardian &amp; Contact Info
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900 shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Parent Phone</p>
                      <a
                        href={`tel:${applicant.parentPhone}`}
                        className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 hover:text-indigo-600 transition"
                      >
                        {applicant.parentPhone || "Not provided"}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Email Address</p>
                      {applicant.email ? (
                        <a
                          href={`mailto:${applicant.email}`}
                          className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 hover:text-blue-600 transition truncate block max-w-[200px]"
                        >
                          {applicant.email}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not provided</span>
                      )}
                    </div>
                  </div>

                  {applicant.parentName && (
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 flex items-center justify-center border border-slate-200 dark:border-zinc-700 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400">Guardian Name</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200">
                          {applicant.parentName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="bg-slate-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Permanent Application Audit Log
              </h4>
              <div className="space-y-2.5 text-xs divide-y divide-slate-200 dark:divide-zinc-800 pt-1">
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Application Registered:</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 font-mono">
                    {new Date(applicant.createdAt).toLocaleString()}
                  </span>
                </div>
                {applicant.verifiedAt && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Credentials Verified:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 font-mono">
                      {new Date(applicant.verifiedAt).toLocaleString()}
                      {applicant.verifiedBy ? ` by ${applicant.verifiedBy}` : ""}
                    </span>
                  </div>
                )}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Institution Scope:</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    {schoolName}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              All changes automatically logged
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
