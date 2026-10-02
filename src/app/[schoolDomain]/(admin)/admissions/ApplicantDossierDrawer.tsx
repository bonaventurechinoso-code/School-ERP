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

function deriveTierFromClass(cls?: string, fallbackTier?: string): string {
  if (!cls) return fallbackTier || "Secondary School";
  const c = cls.toLowerCase().trim();
  if (["daycare", "playgroup", "pre-nursery", "nursery 1", "nursery 2", "nursery 3", "crèche", "creche"].some((k) => c.includes(k))) {
    return "Daycare / Nursery";
  }
  if (c.includes("primary") || c.includes("basic") || c.includes("elementary")) {
    return "Primary School";
  }
  if (
    c.includes("jss") ||
    c.includes("sss") ||
    c.includes("ss1") ||
    c.includes("ss 1") ||
    c.includes("ss2") ||
    c.includes("ss 2") ||
    c.includes("ss3") ||
    c.includes("ss 3") ||
    c.includes("secondary") ||
    c.includes("high")
  ) {
    return "Secondary School";
  }
  if (
    ["nd", "hnd", "100 level", "200", "300", "400", "university", "polytechnic", "college of education"].some((k) =>
      c.includes(k)
    )
  ) {
    return "Higher Institution / University";
  }
  return fallbackTier || "Secondary School";
}

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

  const handleVerify = (id: string) => () => handleSetDocumentStatus(id, "VERIFIED");
  const handleReject = (id: string) => () => handleSetDocumentStatus(id, "REJECTED");

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
            : "fixed right-0 top-0 w-full sm:w-[600px] md:w-[720px] lg:w-[840px] xl:w-[920px] h-screen z-50"
        } bg-white shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="p-6 md:p-8 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg border-2 border-indigo-400/30">
                {lead.applicantName?.[0] || "A"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl md:text-2xl font-black tracking-tight text-white">
                    {lead.applicantName}
                  </h3>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    lead.status === "ENROLLED"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : lead.status === "APPROVED"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {lead.status}
                  </span>
                </div>
                {(() => {
                  const targetClass = lead.targetClass || lead.targetClassCohort || lead.targetGrade || "N/A";
                  const academicTier = lead.academicTier || lead.tier?.name || deriveTierFromClass(targetClass);
                  return (
                    <p className="text-sm text-indigo-200 mt-1 font-medium flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-indigo-400" />
                      <span>Target: <strong className="text-white font-semibold">{targetClass}</strong> · {academicTier}</span>
                    </p>
                  );
                })()}
                <p className="text-xs text-slate-400 font-mono mt-1">
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
          <div className="flex flex-wrap items-center gap-2.5 mt-4 text-xs sm:text-sm">
            {lead.status !== "ENROLLED" && (
              <button
                onClick={handleFinalizeEnrollment}
                disabled={isPending}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>1-Click Matriculate</span>
              </button>
            )}

            <button
              onClick={() => onPrintOfferLetter && onPrintOfferLetter(lead)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              <span>Offer Letter</span>
            </button>

            <button
              onClick={() => onPrintExamSlip && onPrintExamSlip(lead)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Exam Slip</span>
            </button>

            <button
              onClick={copyUploadPortalLink}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center gap-2 transition ml-auto cursor-pointer"
            >
              <Copy className="w-4 h-4 text-amber-400" />
              <span>{copiedLink ? "Link Copied!" : "Upload Link"}</span>
            </button>
          </div>

          {/* TAB STRIP */}
          <div className="flex items-center gap-2 mt-5 -mb-2 border-b border-slate-800 overflow-x-auto">
            {[
              { id: "bio", label: "Candidate Bio-Data" },
              { id: "documents", label: "Statutory KYC Docs" },
              { id: "screening", label: "Exam & Interview" },
              { id: "offer", label: "Offer & Matriculation" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
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
          <div className={`p-4 text-sm font-semibold flex items-center gap-2.5 ${
            alertMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200" : "bg-red-50 text-red-800 border-b border-red-200"
          }`}>
            {alertMsg.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <span className="leading-normal">{alertMsg.text}</span>
          </div>
        )}

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* TAB 1: BIO-DATA & CONTACT */}
            {activeTab === "bio" && (
              <div className="space-y-6">
                {/* DIRECT COMMUNICATION ACTION BUTTONS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <a
                    href={lead.parentPhone || lead.parentContact ? `tel:${lead.parentPhone || lead.parentContact}` : undefined}
                    className="p-3.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 flex items-center justify-center gap-2.5 font-bold text-xs sm:text-sm transition"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Call Parent</span>
                  </a>

                  <a
                    href={lead.parentPhone || lead.parentContact ? `https://wa.me/${(lead.parentPhone || lead.parentContact).replace(/\D/g, "")}` : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 rounded-xl border bg-green-50 text-green-800 border-green-200 hover:bg-green-100 flex items-center justify-center gap-2.5 font-bold text-xs sm:text-sm transition"
                  >
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={lead.parentEmail ? `mailto:${lead.parentEmail}` : undefined}
                    className="p-3.5 rounded-xl border bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2.5 font-bold text-xs sm:text-sm transition"
                  >
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Send Email</span>
                  </a>
                </div>

                {/* CANDIDATE DETAILS */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
                    Applicant Bio-Data
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Full Name</span>
                      <p className="text-base md:text-lg font-bold text-slate-900 tracking-normal leading-relaxed">{lead.applicantName}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Target Class Cohort</span>
                      <p className="text-base md:text-lg font-bold text-slate-900 tracking-normal leading-relaxed">
                        {lead.targetClass || lead.targetClassCohort || lead.targetGrade}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Academic Tier</span>
                      <p className="text-base md:text-lg font-bold text-slate-900 tracking-normal leading-relaxed">
                        {lead.academicTier || lead.tier?.name || deriveTierFromClass(lead.targetClass || lead.targetGrade)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Inquiry Source</span>
                      <p className="text-base md:text-lg font-bold text-slate-900 tracking-normal leading-relaxed">{lead.source || "Website / Walk-In"}</p>
                    </div>
                  </div>
                </div>

                {/* PARENT / GUARDIAN INFORMATION */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
                    Parent / Guardian Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Parent Name</span>
                      <p className="text-base md:text-lg font-bold text-slate-900 tracking-normal leading-relaxed">{lead.parentName || "Parent / Guardian"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Primary Telephone</span>
                      <p className="text-base md:text-lg font-bold text-slate-900 font-mono tracking-normal leading-relaxed">{lead.parentPhone || lead.parentContact}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Email Address</span>
                      <p className="text-base md:text-lg font-bold text-slate-900 tracking-normal leading-relaxed">{lead.parentEmail || "Not provided"}</p>
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
                directUrl: application.passportPhotoUrl,
              },
              {
                type: "NPC Birth Cert",
                key: "birthCertificate",
                aliases: ["NPC Birth Cert", "birthCertificate", "birth_certificate", "birthCert"],
                label: "NPC Birth Cert",
                directUrl: application.birthCertificateUrl,
              },
              {
                type: "Previous Academic Results",
                key: "academicResults",
                aliases: ["Previous Academic Results", "academicResults", "academic_results", "lastResult", "last_result", "result"],
                label: "Previous Academic Results",
                directUrl: application.academicResultsUrl,
              },
              {
                type: "Medical Fitness",
                key: "medicalRecords",
                aliases: ["Medical Fitness", "medicalRecords", "medical_records", "medical_fitness", "nin"],
                label: "Medical Fitness",
                directUrl: application.medicalRecordsUrl,
              },
            ];

            return (
              <div className="space-y-6">
                {/* UPLOAD PORTAL SHARE CARD */}
                <div className="bg-indigo-900 text-white p-6 md:p-8 rounded-2xl shadow-sm border border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-base md:text-lg font-black">Parent Self-Service Upload Portal</h4>
                    <p className="text-sm text-indigo-200 mt-1 leading-relaxed">
                      Share secure link with parents to upload missing birth certificates and photos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyUploadPortalLink}
                    className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 transition shrink-0 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedLink ? "Link Copied!" : "Copy Portal Link"}</span>
                  </button>
                </div>

                {/* DOCUMENT VERIFICATION CHECKLIST */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
                    Required Admission Documents
                  </h4>
                  <div className="divide-y divide-slate-100 text-sm">
                    {requiredDocs.map((req) => {
                      const doc = docs.find((d: any) =>
                        d.type === req.type ||
                        d.type === req.key ||
                        (req.aliases && (req.aliases.includes(d.type) || req.aliases.includes(d.docType) || req.aliases.includes(d.key)))
                      ) || {};

                      const rawFileUrl = (doc.fileUrl || doc.url || doc.path || req.directUrl || "").trim();
                      let resolvedFileUrl = rawFileUrl;
                      if (resolvedFileUrl) {
                        if (resolvedFileUrl.startsWith("http://") || resolvedFileUrl.startsWith("https://")) {
                          // Already an Uploadthing secure public URL or full URL
                          resolvedFileUrl = rawFileUrl;
                        } else if (resolvedFileUrl.startsWith("/api/uploads/")) {
                          resolvedFileUrl = rawFileUrl;
                        } else if (resolvedFileUrl.startsWith("/uploads/")) {
                          resolvedFileUrl = `/api${resolvedFileUrl}`;
                        } else if (resolvedFileUrl.startsWith("/")) {
                          resolvedFileUrl = rawFileUrl;
                        } else {
                          resolvedFileUrl = `/api/uploads/${resolvedFileUrl}`;
                        }
                      }
                      const hasFile = Boolean(resolvedFileUrl);
                      const isVerified = doc.status === "VERIFIED";
                      const isRejected = doc.status === "REJECTED";
                      const docId = doc.id || req.key;

                      return (
                        <div key={req.key} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isVerified
                                  ? "bg-emerald-100 text-emerald-600"
                                  : isRejected
                                  ? "bg-red-100 text-red-600"
                                  : hasFile
                                  ? "bg-indigo-100 text-indigo-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              <FileCheck className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-base">{req.label}</p>
                              {hasFile ? (
                                <p className="text-xs sm:text-sm text-slate-500 font-mono truncate max-w-[240px] sm:max-w-md mt-0.5">
                                  {doc.fileName || `${req.label}.pdf`} •{" "}
                                  <span className={isVerified ? "text-emerald-600 font-bold" : isRejected ? "text-rose-600 font-bold" : "text-indigo-600 font-semibold"}>
                                    {isVerified ? "Verified ✓" : isRejected ? "Rejected ✗" : "Uploaded"}
                                  </span>
                                </p>
                              ) : (
                                <span className="text-xs sm:text-sm text-amber-600 font-medium">Awaiting Parent Upload</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (resolvedFileUrl) {
                                  window.open(resolvedFileUrl, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              disabled={!resolvedFileUrl}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition border ${
                                !resolvedFileUrl
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 cursor-pointer"
                              }`}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={handleVerify(doc.id || docId)}
                              disabled={doc.status === 'VERIFIED' || !resolvedFileUrl}
                              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition ${
                                doc.status === 'VERIFIED'
                                  ? "bg-emerald-600 text-white shadow-xs cursor-default"
                                  : !resolvedFileUrl
                                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                              }`}
                            >
                              {doc.status === 'VERIFIED' ? "Verified ✓" : "Mark Verified"}
                            </button>
                            <button
                              type="button"
                              onClick={handleReject(doc.id || docId)}
                              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                                doc.status === 'REJECTED'
                                  ? "bg-red-600 text-white shadow-xs"
                                  : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                              }`}
                            >
                              {doc.status === 'REJECTED' ? "Rejected ✗" : "Reject"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 3: SCREENING, EXAM & INTERVIEW */}
          {activeTab === "screening" && (
            <form onSubmit={handleSaveScreening} className="space-y-6">
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
                  Entrance Examination &amp; Interview Evaluation
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                  <div>
                    <label className="text-sm sm:text-base font-bold text-slate-800 mb-2 block">
                      Entrance Exam Aggregate Score (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 84"
                      value={examScore}
                      onChange={(e) => setExamScore(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-slate-300 rounded-xl text-base md:text-lg font-bold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="text-sm sm:text-base font-bold text-slate-800 mb-2 block">
                      Interview Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-2 py-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setInterviewRating(star)}
                          className="p-1.5 hover:scale-110 transition cursor-pointer"
                        >
                          <Star className={`w-6 h-6 ${
                            star <= interviewRating ? "text-amber-400 fill-amber-400" : "text-slate-300"
                          }`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-sm sm:text-base font-bold text-slate-800 mb-2 block">
                      Admissions Committee Recommendation
                    </label>
                    <select
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm sm:text-base font-bold bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none shadow-xs cursor-pointer"
                    >
                      <option value="RECOMMENDED">Recommended for Immediate Placement</option>
                      <option value="CONDITIONAL">Conditional Placement (Supplementary Remediation)</option>
                      <option value="WAITLISTED">Waitlisted (Cohort at Capacity)</option>
                      <option value="UNSUCCESSFUL">Unsuccessful Candidate</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-sm sm:text-base font-bold text-slate-800 mb-2 block">
                      Screening / Examiner Observations
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Candidate demonstrated exceptional grasp of basic numeracy and verbal reasoning..."
                      value={screeningNotes}
                      onChange={(e) => setScreeningNotes(e.target.value)}
                      className="w-full min-h-[140px] p-4 bg-white border border-slate-300 rounded-xl text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none shadow-xs leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
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
            <div className="space-y-6">
              {/* PROVISIONAL OFFER STATUS CARD */}
              <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-800">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                      Admission Placement Status
                    </span>
                    <p className="text-2xl font-black mt-1.5 text-white">
                      {lead.status === "ENROLLED" ? "Candidate Fully Matriculated" : "Provisional Placement Ready"}
                    </p>
                    <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                      Assigned to: <strong className="text-white font-semibold">{lead.targetGrade || lead.targetClass}</strong> ({lead.tier?.name || lead.academicTier || "Academic Tier"})
                    </p>
                  </div>

                  <span className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider ${
                    lead.status === "ENROLLED"
                      ? "bg-emerald-500 text-slate-900"
                      : "bg-indigo-600 text-white"
                  }`}>
                    {lead.status}
                  </span>
                </div>

                {/* ACTION BUTTONS */}
                <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                  <button
                    onClick={() => onPrintOfferLetter && onPrintOfferLetter(lead)}
                    className="px-4 py-2.5 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <span>Print Provisional Offer Letter</span>
                  </button>

                  <button
                    onClick={() => onPrintExamSlip && onPrintExamSlip(lead)}
                    className="px-4 py-2.5 bg-slate-800 text-slate-200 font-bold rounded-xl hover:bg-slate-700 transition flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Print Exam Admit Slip</span>
                  </button>
                </div>
              </div>

              {/* READABLE PROVISIONAL OFFER LETTER DOCUMENT CONSOLE VIEW */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                {/* LETTERHEAD */}
                <div className="text-center border-b-2 border-slate-900 pb-5">
                  <div className="inline-block w-14 h-14 rounded-2xl bg-indigo-900 text-white font-sans font-black text-xl flex items-center justify-center mx-auto mb-2 border-2 border-amber-400 shadow-sm">
                    {schoolName ? schoolName.slice(0, 2).toUpperCase() : "GW"}
                  </div>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900">
                    {schoolName}
                  </h3>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-sans mt-0.5">
                    Office of the Admissions Director &amp; Academic Board
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Official Offer Ref: <strong className="font-mono text-slate-800">ADM-OFFER/{(schoolDomain || "GW").toUpperCase()}/{new Date().getFullYear()}/{lead.id.substring(0, 6).toUpperCase()}</strong>
                  </p>
                </div>

                {/* RECIPIENT & PARAMETERS */}
                <div className="space-y-1.5 font-sans border-b border-slate-100 pb-4">
                  <p className="text-base font-bold text-slate-900">
                    To the Parents / Guardians of: <span className="text-indigo-950 font-black">{lead.applicantName}</span>
                  </p>
                  <p className="text-sm font-medium text-slate-600">
                    Primary Telephone: <strong className="font-mono text-slate-800">{lead.parentPhone || lead.parentContact || "N/A"}</strong>
                  </p>
                  <p className="text-sm font-medium text-slate-600">
                    Offered Placement: <strong className="text-slate-800">{lead.targetGrade || lead.targetClass || lead.targetClassCohort}</strong> ({lead.tier?.name || lead.academicTier || "Academic Tier"})
                  </p>
                </div>

                {/* LETTER TITLE */}
                <h4 className="text-base md:text-lg font-black text-center uppercase tracking-wide text-slate-900 underline">
                  Offer of Provisional Admission for the 2026/2027 Academic Session
                </h4>

                {/* LETTER BODY */}
                <div className="text-base md:text-lg text-slate-800 leading-relaxed tracking-normal space-y-4">
                  <p>
                    Following the successful review of your admission application, entrance assessment, and screening credentials, the Academic Admissions Board of <strong>{schoolName}</strong> is pleased to extend an offer of <strong>Provisional Admission</strong> for candidate <strong className="text-slate-900">{lead.applicantName}</strong>.
                  </p>

                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl my-4 text-center">
                    <span className="text-xs uppercase tracking-wider text-slate-500 block font-bold">
                      Candidate Placement Confirmation
                    </span>
                    <p className="text-lg md:text-xl font-black text-slate-900 mt-1">
                      {lead.applicantName}
                    </p>
                    <span className="inline-block mt-2 px-3.5 py-1 rounded-full text-xs md:text-sm font-bold bg-indigo-100 text-indigo-800">
                      Cohort: {lead.targetGrade || lead.targetClass || lead.targetClassCohort} · {lead.tier?.name || lead.academicTier || "General Tier"}
                    </span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h5 className="font-bold text-slate-900 text-base uppercase tracking-normal">
                      1. Acceptance of Placement &amp; Enrollment Terms
                    </h5>
                    <p className="text-sm md:text-base leading-relaxed text-slate-700">
                      To formally secure this provisional placement, the required Acceptance Fee must be remitted into the institutional bursary account within fourteen (14) calendar days of receipt. Unclaimed allocations may be offered to waitlisted candidates.
                    </p>

                    <h5 className="font-bold text-slate-900 text-base uppercase tracking-normal pt-2">
                      2. Statutory Verification Requirements
                    </h5>
                    <p className="text-sm md:text-base leading-relaxed text-slate-700">
                      This admission remains provisional until satisfactory verification of statutory documents, including the official National Population Commission (NPC) Birth Certificate, National Identification (NIN), and certified Medical Certificate of Fitness.
                    </p>

                    <h5 className="font-bold text-slate-900 text-base uppercase tracking-normal pt-2">
                      3. Matriculation &amp; Student Portal Access
                    </h5>
                    <p className="text-sm md:text-base leading-relaxed text-slate-700">
                      Upon confirmation of acceptance, the candidate will be matriculated with an official institutional student registration number and granted credentials for the student learning portal.
                    </p>
                  </div>
                </div>

                {/* SIGNATURE BLOCK */}
                <div className="mt-8 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-sm">
                  <div>
                    <div className="border-b border-slate-900 pb-1 mb-1 font-serif italic text-base text-slate-800">
                      Mrs. O. A. Babatunde
                    </div>
                    <p className="font-bold text-slate-900">Director of Admissions &amp; Enrollment</p>
                    <p className="text-xs text-slate-500">{schoolName}</p>
                  </div>

                  <div className="text-right">
                    <div className="border-b border-slate-900 pb-1 mb-1 font-serif italic text-base text-slate-800">
                      Dr. A. B. Adeleke
                    </div>
                    <p className="font-bold text-slate-900">Registrar &amp; Head of School</p>
                    <p className="text-xs text-slate-500">Seal of Academic Board</p>
                  </div>
                </div>
              </div>

              {/* 1-CLICK MATRICULATION FINAL STEP */}
              {lead.status !== "ENROLLED" ? (
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
                    Final Matriculation &amp; Student Profile Creation
                  </h4>
                  <p className="text-sm md:text-base text-slate-700 leading-relaxed tracking-normal">
                    Clicking matriculate will automatically generate a unique institutional admission number
                    (e.g. <strong className="font-mono text-indigo-600">GW/SEC/2026/001</strong>), register the candidate into the student roster, and archive this lead.
                  </p>

                  <button
                    onClick={handleFinalizeEnrollment}
                    disabled={isPending}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm sm:text-base shadow-md transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    <UserCheck className="w-5 h-5" />
                    <span>Finalize Enrollment &amp; Matriculate Student</span>
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-6 md:p-8 rounded-2xl text-sm sm:text-base text-emerald-800 flex items-center gap-3.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-base md:text-lg">Student Record Active &amp; Enrolled</p>
                    <p className="mt-1 text-emerald-700 leading-relaxed">
                      This applicant has completed matriculation and is active in the student database.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* BOTTOM DRAWER FOOTER */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between text-xs sm:text-sm text-slate-500">
          <span>{schoolName} • Admissions CRM</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
