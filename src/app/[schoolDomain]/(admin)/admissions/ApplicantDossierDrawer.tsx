"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  GraduationCap,
  Award,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileCheck,
  FileText,
  UserCheck,
  ShieldCheck,
  DollarSign,
  Copy,
  ExternalLink,
  ChevronRight,
  Star,
  Save,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  updateLeadStatusAction,
  updateLeadDocumentsAction,
  updateLeadScreeningAction,
  enrollApplicantAction,
} from "./actions";

export interface ApplicantDossierDrawerProps {
  lead: any | null;
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  schoolDomain: string;
  schoolName: string;
  onLeadUpdated?: () => void;
  onPrintOfferLetter?: (lead: any) => void;
  onPrintExamSlip?: (lead: any) => void;
}

const STAGES = ["INQUIRY", "APPLIED", "INTERVIEW", "APPROVED", "ENROLLED"];

export default function ApplicantDossierDrawer({
  lead,
  isOpen,
  onClose,
  schoolId,
  schoolDomain,
  schoolName,
  onLeadUpdated,
  onPrintOfferLetter,
  onPrintExamSlip,
}: ApplicantDossierDrawerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<"bio" | "documents" | "screening" | "offer">("bio");
  const [isPending, startTransition] = useTransition();
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Screening form state
  const [examScore, setExamScore] = useState<string>("");
  const [interviewRating, setInterviewRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<string>("RECOMMENDED");
  const [screeningNotes, setScreeningNotes] = useState<string>("");

  useEffect(() => {
    if (lead && isOpen) {
      setAlertMsg(null);
      setCopiedLink(false);

      // Extract existing screening logs if available
      const logs = Array.isArray(lead.logs) ? lead.logs : [];
      const screeningLog = logs.slice().reverse().find((l: any) => l.action === "SCREENING_EVALUATED");
      if (screeningLog) {
        setExamScore(screeningLog.examScore !== undefined ? String(screeningLog.examScore) : "");
        setInterviewRating(screeningLog.interviewRating || 4);
        setRecommendation(screeningLog.recommendation || "RECOMMENDED");
        setScreeningNotes(screeningLog.notes || "");
      } else {
        setExamScore("78");
        setInterviewRating(4);
        setRecommendation("RECOMMENDED");
        setScreeningNotes("");
      }
    }
  }, [lead, isOpen]);

  if (!lead) return null;

  const docs = lead.documents || {};
  const currentStageIndex = STAGES.indexOf(lead.status);

  // Document checklist definitions
  const docList = [
    { key: "passportPhoto", label: "Recent Passport Photograph", url: lead.passportPhotoUrl },
    { key: "birthCertificate", label: "NPC National Birth Certificate", url: lead.birthCertificateUrl },
    { key: "academicResults", label: "Previous Term Academic Results", url: lead.academicResultsUrl },
    { key: "medicalRecords", label: "Medical Fitness Certificate", url: lead.medicalRecordsUrl },
  ];

  const handleAdvanceStage = (targetStage: string) => {
    setAlertMsg(null);
    startTransition(async () => {
      const res = await updateLeadStatusAction({
        leadId: lead.id,
        status: targetStage,
        schoolId,
        schoolDomain,
      });
      if (res.success) {
        setAlertMsg({ type: "success", text: `Candidate advanced to ${targetStage} stage!` });
        if (onLeadUpdated) onLeadUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to update stage." });
      }
    });
  };

  const handleToggleDocumentStatus = (docKey: string, currentStatus?: string) => {
    const nextStatus = currentStatus === "VERIFIED" ? "PENDING" : "VERIFIED";
    setAlertMsg(null);
    startTransition(async () => {
      const res = await updateLeadDocumentsAction({
        leadId: lead.id,
        schoolId,
        schoolDomain,
        documentType: docKey,
        status: nextStatus as any,
      });
      if (res.success) {
        setAlertMsg({ type: "success", text: `Updated document verification to ${nextStatus}.` });
        if (onLeadUpdated) onLeadUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to update document." });
      }
    });
  };

  const handleSetDocumentStatus = (docKey: string, nextStatus: "VERIFIED" | "REJECTED" | "PENDING") => {
    setAlertMsg(null);
    startTransition(async () => {
      const res = await updateLeadDocumentsAction({
        leadId: lead.id,
        schoolId,
        schoolDomain,
        documentType: docKey,
        status: nextStatus as any,
      });
      if (res.success) {
        setAlertMsg({ type: "success", text: `Document set to ${nextStatus}.` });
        if (onLeadUpdated) onLeadUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to update document." });
      }
    });
  };

  const handleSaveScreening = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);
    const scoreNum = examScore ? parseFloat(examScore) : undefined;

    startTransition(async () => {
      const res = await updateLeadScreeningAction({
        leadId: lead.id,
        schoolId,
        schoolDomain,
        examScore: scoreNum,
        interviewRating,
        recommendation,
        notes: screeningNotes,
      });
      if (res.success) {
        setAlertMsg({ type: "success", text: "Screening assessment recorded successfully." });
        if (onLeadUpdated) onLeadUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Failed to save assessment." });
      }
    });
  };

  const handleFinalizeEnrollment = () => {
    if (!confirm(`Confirm enrollment of ${lead.applicantName} into ${lead.targetGrade}? This will create an active student record.`)) return;

    setAlertMsg(null);
    startTransition(async () => {
      const res = await enrollApplicantAction({
        leadId: lead.id,
        schoolId,
        schoolDomain,
      });
      if (res.success) {
        setAlertMsg({
          type: "success",
          text: `Applicant successfully matriculated! Admission No: ${res.student?.admissionNumber || "Generated"}`
        });
        if (onLeadUpdated) onLeadUpdated();
      } else {
        setAlertMsg({ type: "error", text: res.error || "Enrollment failed." });
      }
    });
  };

  const copyUploadPortalLink = () => {
    if (typeof window !== "undefined") {
      const link = `${window.location.origin}/${schoolDomain}/admissions/upload/${lead.id}?token=${lead.uploadToken || "secure"}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 ${isOpen ? "flex" : "hidden"}`}>
      <div 
        className={`${
          isMaximized
            ? "fixed inset-0 z-[100] w-screen h-screen max-w-none"
            : "fixed right-0 top-0 w-[480px] h-screen z-50"
        } bg-white shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="p-6 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg border-2 border-indigo-400/30">
                {lead.applicantName?.[0] || "A"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black tracking-tight text-white">
                    {lead.applicantName}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    lead.status === "ENROLLED"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : lead.status === "APPROVED"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {lead.status}
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-0.5 font-medium flex items-center gap-2">
                  <span>Target: {lead.targetGrade}</span>
                  <span>•</span>
                  <span>{lead.tier?.name || "Academic Tier"}</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Applicant Ref: <strong className="text-slate-200">ADM-{lead.id.slice(0, 6).toUpperCase()}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label={isMaximized ? "Minimize drawer" : "Maximize drawer"}
                title={isMaximized ? "Minimize" : "Maximize"}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close drawer"
                title="Close Dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PIPELINE PROGRESS BAR */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              <span>Pipeline Stage Progression</span>
              <span className="text-indigo-400">Step {currentStageIndex + 1} of 5</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {STAGES.map((s, idx) => {
                const isPassed = idx <= currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <button
                    key={s}
                    onClick={() => handleAdvanceStage(s)}
                    disabled={isPending}
                    className={`h-2 rounded-full transition-all ${
                      isCurrent
                        ? "bg-indigo-400 ring-2 ring-indigo-400/50"
                        : isPassed
                        ? "bg-emerald-500"
                        : "bg-slate-800 hover:bg-slate-700"
                    }`}
                    title={`Advance to ${s}`}
                  />
                );
              })}
            </div>
          </div>

          {/* ACTION TOOLBAR */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
            {lead.status !== "ENROLLED" && (
              <button
                onClick={handleFinalizeEnrollment}
                disabled={isPending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>1-Click Matriculate</span>
              </button>
            )}

            <button
              onClick={() => onPrintOfferLetter && onPrintOfferLetter(lead)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Offer Letter</span>
            </button>

            <button
              onClick={() => onPrintExamSlip && onPrintExamSlip(lead)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Exam Slip</span>
            </button>

            <button
              onClick={copyUploadPortalLink}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg flex items-center gap-1.5 transition ml-auto"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>{copiedLink ? "Link Copied!" : "Upload Link"}</span>
            </button>
          </div>

          {/* TAB STRIP */}
          <div className="flex items-center gap-1 mt-4 -mb-2 border-b border-slate-800">
            {[
              { id: "bio", label: "Candidate Bio-Data" },
              { id: "documents", label: "Statutory KYC Docs" },
              { id: "screening", label: "Exam & Interview" },
              { id: "offer", label: "Offer & Matriculation" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 text-xs font-bold transition border-b-2 ${
                  activeTab === tab.id
                    ? "border-indigo-400 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ALERT BANNER */}
        {alertMsg && (
          <div className={`p-3 text-xs font-semibold flex items-center gap-2 ${
            alertMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200" : "bg-red-50 text-red-800 border-b border-red-200"
          }`}>
            {alertMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{alertMsg.text}</span>
          </div>
        )}

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* TAB 1: BIO-DATA & CONTACT */}
          {activeTab === "bio" && (
            <div className="space-y-5">
              {/* DIRECT COMMUNICATION ACTION BUTTONS */}
              <div className="grid grid-cols-3 gap-3">
                <a
                  href={lead.parentPhone || lead.parentContact ? `tel:${lead.parentPhone || lead.parentContact}` : undefined}
                  className="p-3 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 flex items-center justify-center gap-2 font-semibold text-xs transition"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Parent</span>
                </a>

                <a
                  href={lead.parentPhone || lead.parentContact ? `https://wa.me/${(lead.parentPhone || lead.parentContact).replace(/\D/g, "")}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-xl border bg-green-50 text-green-800 border-green-200 hover:bg-green-100 flex items-center justify-center gap-2 font-semibold text-xs transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={lead.parentEmail ? `mailto:${lead.parentEmail}` : undefined}
                  className="p-3 rounded-xl border bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2 font-semibold text-xs transition"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Email</span>
                </a>
              </div>

              {/* CANDIDATE DETAILS */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Applicant Bio-Data
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Full Name</span>
                    <p className="font-bold text-slate-800">{lead.applicantName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Target Class Cohort</span>
                    <p className="font-bold text-slate-800">{lead.targetGrade}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Academic Tier</span>
                    <p className="font-bold text-slate-800">{lead.tier?.name || "General Tier"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Inquiry Source</span>
                    <p className="font-bold text-slate-800">{lead.source || "Website / Walk-In"}</p>
                  </div>
                </div>
              </div>

              {/* PARENT / GUARDIAN INFORMATION */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Parent / Guardian Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Parent Name</span>
                    <p className="font-bold text-slate-800">{lead.parentName || "Parent / Guardian"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Primary Telephone</span>
                    <p className="font-bold text-slate-800 font-mono">{lead.parentPhone || lead.parentContact}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block mb-0.5 font-medium">Email Address</span>
                    <p className="font-bold text-slate-800">{lead.parentEmail || "Not provided"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STATUTORY KYC DOCUMENTS */}
          {activeTab === "documents" && (() => {
            const application = lead;
            const rawDocs = application.documents || application.admissionDocuments || application.kycDocs || application.credentialsJson || [];
            
            let docs: any[] = [];
            if (Array.isArray(rawDocs)) {
              docs = rawDocs.map((d: any) => ({
                ...d,
                type: d.type || d.docType || d.key,
                fileUrl: d.fileUrl || d.url || d.path,
                fileName: d.fileName || d.filename || d.originalName || `${d.type || "Document"}.pdf`,
                status: d.status || "PENDING",
              }));
            } else if (typeof rawDocs === "object" && rawDocs !== null) {
              docs = Object.entries(rawDocs).map(([k, v]: [string, any]) => {
                if (typeof v === "object" && v !== null) {
                  return {
                    ...v,
                    type: v.type || v.docType || k,
                    fileUrl: v.fileUrl || v.url || v.path,
                    fileName: v.fileName || v.filename || v.originalName || `${k}.pdf`,
                    status: v.status || "PENDING",
                  };
                }
                return {
                  type: k,
                  fileUrl: v,
                  fileName: `${k}.pdf`,
                  status: "PENDING",
                };
              });
            }

            // Top-level direct column fallbacks on application record
            if (application.passportPhotoUrl && !docs.some((d) => d.type === "Recent Passport" || d.type === "passportPhoto")) {
              docs.push({ type: "Recent Passport", fileUrl: application.passportPhotoUrl, fileName: "Passport Photograph.jpg" });
              docs.push({ type: "passportPhoto", fileUrl: application.passportPhotoUrl, fileName: "Passport Photograph.jpg" });
            }
            if (application.birthCertificateUrl && !docs.some((d) => d.type === "NPC Birth Cert" || d.type === "birthCertificate")) {
              docs.push({ type: "NPC Birth Cert", fileUrl: application.birthCertificateUrl, fileName: "National Birth Certificate.pdf" });
              docs.push({ type: "birthCertificate", fileUrl: application.birthCertificateUrl, fileName: "National Birth Certificate.pdf" });
            }
            if (application.academicResultsUrl && !docs.some((d) => d.type === "Previous Academic Results" || d.type === "academicResults")) {
              docs.push({ type: "Previous Academic Results", fileUrl: application.academicResultsUrl, fileName: "Previous Academic Results.pdf" });
              docs.push({ type: "academicResults", fileUrl: application.academicResultsUrl, fileName: "Previous Academic Results.pdf" });
            }
            if (application.medicalRecordsUrl && !docs.some((d) => d.type === "Medical Fitness" || d.type === "medicalRecords")) {
              docs.push({ type: "Medical Fitness", fileUrl: application.medicalRecordsUrl, fileName: "Medical Fitness Certificate.pdf" });
              docs.push({ type: "medicalRecords", fileUrl: application.medicalRecordsUrl, fileName: "Medical Fitness Certificate.pdf" });
            }

            console.log("DOCS FOR", application.applicantNo || application.id, docs);

            const requiredDocs = [
              {
                type: "Recent Passport",
                key: "passportPhoto",
                aliases: ["Recent Passport", "passportPhoto", "passport_photo", "passport"],
                label: "Recent Passport",
              },
              {
                type: "NPC Birth Cert",
                key: "birthCertificate",
                aliases: ["NPC Birth Cert", "birthCertificate", "birth_certificate", "birthCert"],
                label: "NPC Birth Cert",
              },
              {
                type: "Previous Academic Results",
                key: "academicResults",
                aliases: ["Previous Academic Results", "academicResults", "academic_results", "lastResult", "last_result", "result"],
                label: "Previous Academic Results",
              },
              {
                type: "Medical Fitness",
                key: "medicalRecords",
                aliases: ["Medical Fitness", "medicalRecords", "medical_records", "medical_fitness", "nin"],
                label: "Medical Fitness",
              },
            ];

            return (
              <div className="space-y-5">
                {/* UPLOAD PORTAL SHARE CARD */}
                <div className="bg-indigo-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-800 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black">Parent Self-Service Upload Portal</h4>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Share secure link with parents to upload missing birth certificates and photos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyUploadPortalLink}
                    className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedLink ? "Link Copied!" : "Copy Portal Link"}</span>
                  </button>
                </div>

                {/* DOCUMENT VERIFICATION CHECKLIST */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                    Required Admission Documents
                  </h4>
                  <div className="divide-y divide-slate-100 text-xs">
                    {requiredDocs.map((req) => {
                      const existingDoc = docs.find((d: any) =>
                        (d.type === req.type || d.type === req.key || req.aliases.includes(d.type) || req.aliases.includes(d.docType)) &&
                        Boolean(d.fileUrl)
                      );

                      if (existingDoc) {
                        let fileUrl = existingDoc.fileUrl;
                        if (fileUrl && fileUrl.startsWith("/uploads/")) {
                          fileUrl = `/api${fileUrl}`;
                        }
                        const isVerified = existingDoc.status === "VERIFIED";
                        const isRejected = existingDoc.status === "REJECTED";

                        return (
                          <div key={req.key} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isVerified ? "bg-emerald-100 text-emerald-600" : isRejected ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                              }`}>
                                <FileCheck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{req.label}</p>
                                <p className="text-[11px] text-slate-500 font-mono truncate max-w-[200px] sm:max-w-xs">
                                  {existingDoc.fileName || `${req.label}.pdf`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition border border-indigo-200"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>View</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleSetDocumentStatus(req.key, "VERIFIED")}
                                disabled={isPending}
                                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                                  isVerified
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                }`}
                              >
                                {isVerified ? "Verified ✓" : "Mark Verified"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetDocumentStatus(req.key, "REJECTED")}
                                disabled={isPending}
                                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                                  isRejected
                                    ? "bg-red-600 text-white shadow-xs"
                                    : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                                }`}
                              >
                                {isRejected ? "Rejected ✗" : "Reject"}
                              </button>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={req.key} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 text-slate-400">
                                <FileCheck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{req.label}</p>
                                <span className="text-[11px] text-amber-600 font-medium">Awaiting Parent Upload</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={true}
                                className="px-3 py-1.5 rounded-lg font-bold text-xs bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                              >
                                Mark Verified
                              </button>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 3: SCREENING, EXAM & INTERVIEW */}
          {activeTab === "screening" && (
            <form onSubmit={handleSaveScreening} className="space-y-5">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Entrance Examination & Interview Evaluation
                </h4>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Entrance Exam Aggregate Score (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 84"
                      value={examScore}
                      onChange={(e) => setExamScore(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Interview Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-1.5 py-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setInterviewRating(star)}
                          className="p-1 hover:scale-110 transition"
                        >
                          <Star className={`w-5 h-5 ${
                            star <= interviewRating ? "text-amber-400 fill-amber-400" : "text-slate-300"
                          }`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Admissions Committee Recommendation
                    </label>
                    <select
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-bold bg-white"
                    >
                      <option value="RECOMMENDED">Recommended for Immediate Placement</option>
                      <option value="CONDITIONAL">Conditional Placement (Supplementary Remediation)</option>
                      <option value="WAITLISTED">Waitlisted (Cohort at Capacity)</option>
                      <option value="UNSUCCESSFUL">Unsuccessful Candidate</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Screening / Examiner Observations
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Candidate demonstrated exceptional grasp of basic numeracy and verbal reasoning..."
                      value={screeningNotes}
                      onChange={(e) => setScreeningNotes(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isPending ? "Saving..." : "Save Assessment"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 4: OFFER LETTER & MATRICULATION */}
          {activeTab === "offer" && (
            <div className="space-y-5">
              {/* PROVISIONAL OFFER STATUS CARD */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                      Admission Placement Status
                    </span>
                    <p className="text-xl font-black mt-1">
                      {lead.status === "ENROLLED" ? "Candidate Fully Matriculated" : "Provisional Placement Ready"}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      Assigned to: <strong className="text-white">{lead.targetGrade}</strong> ({lead.tier?.name})
                    </p>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                    lead.status === "ENROLLED"
                      ? "bg-emerald-500 text-slate-900"
                      : "bg-indigo-600 text-white"
                  }`}>
                    {lead.status}
                  </span>
                </div>

                {/* ACTION BUTTONS */}
                <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                  <button
                    onClick={() => onPrintOfferLetter && onPrintOfferLetter(lead)}
                    className="px-4 py-2 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <span>Print Provisional Offer Letter</span>
                  </button>

                  <button
                    onClick={() => onPrintExamSlip && onPrintExamSlip(lead)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 font-bold rounded-xl hover:bg-slate-700 transition flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Print Exam Admit Slip</span>
                  </button>
                </div>
              </div>

              {/* 1-CLICK MATRICULATION FINAL STEP */}
              {lead.status !== "ENROLLED" ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                    Final Matriculation & Student Profile Creation
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Clicking matriculate will automatically generate a unique institutional admission number
                    (e.g. <strong className="font-mono text-indigo-600">GW/SEC/2026/001</strong>), register the candidate into the student roster, and archive this lead.
                  </p>

                  <button
                    onClick={handleFinalizeEnrollment}
                    disabled={isPending}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 mt-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Finalize Enrollment & Matriculate Student</span>
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl text-xs text-emerald-800 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">Student Record Active & Enrolled</p>
                    <p className="mt-0.5 text-emerald-700">
                      This applicant has completed matriculation and is active in the student database.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM DRAWER FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{schoolName} • Admissions CRM</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
