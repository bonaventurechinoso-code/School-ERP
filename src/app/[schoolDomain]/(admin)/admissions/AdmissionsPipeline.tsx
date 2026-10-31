"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdmissionLead, AcademicTier } from "@prisma/client";
import {
  Users,
  Search,
  Plus,
  Phone,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Calendar,
  CreditCard,
  Send,
  Check,
  Copy,
  X,
  Lock,
  FileCheck,
  FileText,
  Layers,
  Settings,
  AlertTriangle,
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  updateLeadStatusAction,
  sendBankDetailsEmailAction,
  markFormFeePaidAction,
  createAdmissionTrackAction,
  configureAdmissionStageAction,
  transitionCandidateStageAction,
  saveManualEntranceScoreAction,
} from "./actions";
import ApplicantDossierDrawer from "./ApplicantDossierDrawer";
import NewInquiryModal from "./NewInquiryModal";
import AdmissionRegisterTable from "./AdmissionRegisterTable";

export interface PipelineStageConfig {
  id: string;
  name: string;
  label?: string;
  sequenceOrder: number;
  constraints?: {
    require_payment?: boolean;
    require_birth_cert?: boolean;
    require_passport?: boolean;
    require_academic_results?: boolean;
    require_jamb?: boolean;
    require_exam_score?: boolean;
    min_exam_score?: number;
    min_age?: number;
    [key: string]: any;
  } | null;
  color?: string | null;
  dotColor?: string;
}

export interface PipelineTrackConfig {
  id: string;
  tenantId: string;
  name: string;
  tierType: "NURSERY" | "PRIMARY" | "SECONDARY" | "TERTIARY";
  description?: string | null;
  isActive: boolean;
  stages: PipelineStageConfig[];
}

export const FALLBACK_STAGES: PipelineStageConfig[] = [
  { id: "INQUIRY", name: "Inquiry Logged", label: "INQUIRY", sequenceOrder: 0, color: "#94a3b8", dotColor: "bg-slate-400" },
  { id: "DOCS_PENDING", name: "Dossier Intake", label: "DOCS PENDING", sequenceOrder: 1, color: "#f59e0b", dotColor: "bg-amber-500", constraints: { require_birth_cert: true } },
  { id: "VERIFIED", name: "Screened & Verified", label: "SCREENED & VERIFIED", sequenceOrder: 2, color: "#3b82f6", dotColor: "bg-blue-500" },
  { id: "INTERVIEW", name: "Assessment & Exam", label: "EXAM / INTERVIEW", sequenceOrder: 3, color: "#8b5cf6", dotColor: "bg-purple-500", constraints: { require_payment: true } },
  { id: "APPROVED", name: "Provisional Offer", label: "PROVISIONAL OFFER", sequenceOrder: 4, color: "#6366f1", dotColor: "bg-indigo-500" },
  { id: "ENROLLED", name: "Matriculated", label: "MATRICULATED", sequenceOrder: 5, color: "#10b981", dotColor: "bg-emerald-500" },
];

function leadMatchesStage(
  lead: LeadWithTier,
  stage: PipelineStageConfig
): boolean {
  if (lead.stageId && lead.stageId === stage.id) return true;
  const leadNorm = (lead.status || "INQUIRY").toUpperCase();
  const stageNameUpper = (stage.name || "").toUpperCase();
  const stageIdUpper = (stage.id || "").toUpperCase();

  if (leadNorm === stageNameUpper || leadNorm === stageIdUpper) return true;
  if (stageIdUpper === "DOCS_PENDING" && (leadNorm === "APPLIED" || leadNorm.includes("DOC"))) return true;
  if (stageIdUpper === "VERIFIED" && (leadNorm === "SCREENED" || leadNorm === "DOCS_VERIFIED")) return true;
  if (stageIdUpper === "INTERVIEW" && (leadNorm === "EXAM" || leadNorm === "SCREENING" || leadNorm.includes("CBT"))) return true;
  if (stageIdUpper === "APPROVED" && (leadNorm === "OFFER" || leadNorm === "OFFERED" || leadNorm.includes("PROVISIONAL"))) return true;
  if (stageIdUpper === "ENROLLED" && (leadNorm === "CONVERTED" || leadNorm === "ADMITTED" || leadNorm === "MATRICULATED")) return true;
  return false;
}

function getInitials(name?: string): string {
  if (!name) return "ST";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type LeadWithTier = AdmissionLead & {
  tier?: AcademicTier | null;
  notes?: any[];
  targetClass?: string;
  academicTier?: string;
  targetClassCohort?: string;
  trackId?: string | null;
  stageId?: string | null;
};

export default function AdmissionsPipeline({
  leads,
  schoolId,
  schoolDomain,
  tiers,
  schoolName = "Institution Admissions Desk",
  canMutate = false,
  isTenantAdmin = false,
  initialTracks = [],
}: {
  leads: LeadWithTier[];
  schoolId: string;
  schoolDomain?: string;
  tiers: AcademicTier[];
  schoolName?: string;
  canMutate?: boolean;
  isTenantAdmin?: boolean;
  initialTracks?: PipelineTrackConfig[];
}) {
  const router = useRouter();
  const [localLeads, setLocalLeads] = useState<LeadWithTier[]>(leads);
  const [mainTab, setMainTab] = useState<"leads" | "register">("leads");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);

  // Tracks State
  const [tracks, setTracks] = useState<PipelineTrackConfig[]>(initialTracks || []);

  // Filter tracks strictly by the parent school's operating tier metadata
  const visibleTracks = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    if (!tiers || tiers.length === 0) return tracks;

    const operatingTiers = new Set<string>();
    for (const t of tiers) {
      const lower = t.name.toLowerCase();
      if (lower.includes("nursery") || lower.includes("daycare") || lower.includes("creche") || lower.includes("early")) {
        operatingTiers.add("NURSERY");
      }
      if (lower.includes("primary") || lower.includes("basic") || lower.includes("elementary")) {
        operatingTiers.add("PRIMARY");
      }
      if (lower.includes("secondary") || lower.includes("high") || lower.includes("jss") || lower.includes("sss") || (lower.includes("college") && !lower.includes("education"))) {
        operatingTiers.add("SECONDARY");
      }
      if (lower.includes("university") || lower.includes("polytechnic") || lower.includes("tertiary") || lower.includes("undergraduate") || lower.includes("education")) {
        operatingTiers.add("TERTIARY");
      }
    }

    if (operatingTiers.size === 0) {
      operatingTiers.add("PRIMARY");
    }

    const filtered = tracks.filter((t) => operatingTiers.has(t.tierType));
    return filtered.length > 0 ? filtered : tracks;
  }, [tracks, tiers]);

  const [activeTrackId, setActiveTrackId] = useState<string>(() => {
    if (visibleTracks && visibleTracks.length > 0) return visibleTracks[0].id;
    if (initialTracks && initialTracks.length > 0) return initialTracks[0].id;
    return "default";
  });

  useEffect(() => {
    if (visibleTracks.length > 0 && !visibleTracks.some((t) => t.id === activeTrackId)) {
      setActiveTrackId(visibleTracks[0].id);
    }
  }, [visibleTracks, activeTrackId]);

  // Active track and stages
  const activeTrack = useMemo(() => {
    return visibleTracks.find((t) => t.id === activeTrackId) || visibleTracks[0] || null;
  }, [visibleTracks, activeTrackId]);

  const stages: PipelineStageConfig[] = useMemo(() => {
    if (activeTrack && activeTrack.stages && activeTrack.stages.length > 0) {
      return [...activeTrack.stages].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    }
    return FALLBACK_STAGES;
  }, [activeTrack]);

  // Offline Entrance Exam Score Editing on Kanban Cards
  const [editingScoreLeadId, setEditingScoreLeadId] = useState<string | null>(null);
  const [inlineScoreInput, setInlineScoreInput] = useState<string>("");
  const [savingCardScoreId, setSavingCardScoreId] = useState<string | null>(null);

  const handleSaveCardScore = async (leadId: string, scoreVal: string) => {
    const parsed = parseFloat(scoreVal);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      alert("Please enter a valid score between 0 and 100.");
      return;
    }
    setSavingCardScoreId(leadId);
    try {
      const res = await saveManualEntranceScoreAction({
        leadId,
        score: parsed,
        schoolId,
        schoolDomain: schoolDomain || "",
        notes: "Offline exam mark entered on Kanban card",
      });
      if (res.success) {
        setLocalLeads((prev) =>
          prev.map((l) => {
            if (l.id !== leadId) return l;
            const docs = (l.documents as any) || {};
            return {
              ...l,
              documents: {
                ...docs,
                entranceScore: parsed,
                examScore: parsed,
                examAggregate: parsed,
                manualScoreEntry: true,
                examPassed: parsed >= 50,
              },
            };
          })
        );
        setEditingScoreLeadId(null);
        setInlineScoreInput("");
      } else {
        alert(res.error || "Failed to save exam score.");
      }
    } catch (err: any) {
      console.error("Save card score error:", err);
      alert(err.message || "Failed to save exam score.");
    } finally {
      setSavingCardScoreId(null);
    }
  };

  // Mobile Active Stage Tab (Sticky bar on small screens)
  const [mobileActiveStageId, setMobileActiveStageId] = useState<string>("");

  useEffect(() => {
    if (stages.length > 0 && !mobileActiveStageId) {
      setMobileActiveStageId(stages[0].id);
    }
  }, [stages, mobileActiveStageId]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>("ALL");

  // Modals & Drawers
  const [selectedLead, setSelectedLead] = useState<LeadWithTier | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  // Stage Guardrail Alert Dialog
  const [guardrailAlert, setGuardrailAlert] = useState<{
    stageName: string;
    missingPrerequisites: string[];
    lead: LeadWithTier;
  } | null>(null);

  // Track & Stage Configuration Modals (Tenant Admin Only)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCreateTrackModalOpen, setIsCreateTrackModalOpen] = useState(false);
  const [selectedStageForConfig, setSelectedStageForConfig] = useState<PipelineStageConfig | null>(null);
  const [configModalToast, setConfigModalToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [pipelineToast, setPipelineToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Fee Dialog State (for manual mobile bank transfer)
  const [feeModalLead, setFeeModalLead] = useState<LeadWithTier | null>(null);
  const [isSendingBankEmail, setIsSendingBankEmail] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [feeModalToast, setFeeModalToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Central Bursar Bank Details (Read-only)
  const bankDetails = {
    bankName: "Zenith Bank",
    accountNumber: "1012345678",
    accountName: `${schoolName} Admissions`,
    formFeeAmount: 5000,
  };

  const handleCopy = (text: string, fieldId: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return localLeads.filter((l) => {
      // Filter by active track if trackId is set
      if (activeTrack && l.trackId && l.trackId !== activeTrack.id) {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (l.applicantName && l.applicantName.toLowerCase().includes(q)) ||
        (l.targetGrade && l.targetGrade.toLowerCase().includes(q)) ||
        (l.parentContact && l.parentContact.includes(q)) ||
        (l.parentPhone && l.parentPhone.includes(q)) ||
        (l.id && l.id.toLowerCase().includes(q));

      const matchesStage =
        selectedStageFilter === "ALL" ||
        stages.some((s) => s.id === selectedStageFilter && leadMatchesStage(l, s));

      return matchesSearch && matchesStage;
    });
  }, [localLeads, searchQuery, selectedStageFilter, activeTrack, stages]);

  // Stage advance handler with Guardrail Verification
  const handleStageAdvance = (lead: LeadWithTier, currentStageIndex: number) => {
    if (currentStageIndex >= stages.length - 1) return;
    const targetStage = stages[currentStageIndex + 1];

    startTransition(async () => {
      try {
        const res = await transitionCandidateStageAction({
          leadId: lead.id,
          targetStageId: targetStage.id,
          targetStatus: targetStage.name,
          schoolId,
          schoolDomain: schoolDomain || "",
        });

        if (res && res.success) {
          setLocalLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id
                ? { ...l, status: targetStage.name, stageId: targetStage.id }
                : l
            )
          );
          router.refresh();
        } else {
          // Guardrail triggered or error returned
          const castRes = res as any;
          if (castRes?.missingPrerequisites && castRes.missingPrerequisites.length > 0) {
            setGuardrailAlert({
              stageName: targetStage.name,
              missingPrerequisites: castRes.missingPrerequisites,
              lead,
            });
          } else {
            alert(res?.error || "Failed to advance stage.");
          }
        }
      } catch (err: any) {
        console.error("Failed to advance stage:", err);
      }
    });
  };

  // Send Bank Details to Email action
  const handleSendBankDetailsEmail = async () => {
    if (!feeModalLead) return;
    setIsSendingBankEmail(true);
    setFeeModalToast(null);

    const targetEmail =
      feeModalLead.studentEmail ||
      feeModalLead.parentEmail ||
      (feeModalLead.parentContact?.includes("@") ? feeModalLead.parentContact : null) ||
      "bonaveeict@gmail.com";

    const appNo = `APP-${feeModalLead.id.slice(0, 6).toUpperCase()}`;

    try {
      const res = await sendBankDetailsEmailAction({
        registerId: feeModalLead.id,
        schoolDomain: schoolDomain || "egede",
        guardianEmail: targetEmail,
        applicantName: feeModalLead.applicantName,
        applicationNo: appNo,
        amount: bankDetails.formFeeAmount,
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        accountName: bankDetails.accountName,
      });

      if (res && res.success) {
        setFeeModalToast({ type: "success", text: `Bank details dispatched to ${targetEmail}` });
      } else {
        setFeeModalToast({ type: "error", text: res?.error || "Failed to dispatch email." });
      }
    } catch (err: any) {
      setFeeModalToast({ type: "error", text: err.message || "Failed to dispatch email." });
    } finally {
      setIsSendingBankEmail(false);
    }
  };

  // Mark Form Fee Paid action
  const handleMarkAsPaid = async () => {
    if (!feeModalLead) return;
    setIsMarkingPaid(true);
    setFeeModalToast(null);

    try {
      const res = await markFormFeePaidAction({
        registerId: feeModalLead.id,
        schoolDomain: schoolDomain || "egede",
      });

      if (res && res.success) {
        setLocalLeads((prev) =>
          prev.map((l) => {
            if (l.id === feeModalLead.id) {
              const docs = (l.documents as any) || {};
              docs.formFeePaid = true;
              return { ...l, documents: docs };
            }
            return l;
          })
        );
        setFeeModalToast({ type: "success", text: "Application fee marked as PAID successfully." });
        setTimeout(() => {
          setFeeModalLead(null);
          router.refresh();
        }, 1000);
      } else {
        setFeeModalToast({ type: "error", text: res?.error || "Failed to update payment status." });
      }
    } catch (err: any) {
      setFeeModalToast({ type: "error", text: err.message || "Failed to update payment status." });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Candidate Data-Dense Card Render Helper
  const renderApplicantCard = (lead: LeadWithTier, sIdx: number) => {
    const appNo = `APP-${lead.id.slice(0, 6).toUpperCase()}`;
    const leadDocs = (lead.documents as any) || {};
    const isFeePaid = Boolean(
      leadDocs.formFeePaid ||
      leadDocs.feePaid ||
      leadDocs.formFeeStatus === "PAID" ||
      lead.status === "APPROVED" ||
      lead.status === "ENROLLED"
    );
    const isFeePending = Boolean(
      !isFeePaid && (
        leadDocs.formFeeStatus === "PENDING" ||
        leadDocs.formFeeStatus === "PENDING_VERIFICATION" ||
        leadDocs.paymentState === "PAYMENT_PENDING_REVIEW" ||
        leadDocs.applicationFeeReceiptUrl ||
        leadDocs.formFeeReceiptUrl ||
        leadDocs.paymentReceiptUrl ||
        leadDocs.applicationFeeReceipt?.url ||
        leadDocs.paymentReceipt?.url ||
        (Array.isArray(leadDocs.documents) && leadDocs.documents.some((d: any) =>
          (d.key === "applicationFeeReceipt" || d.type === "applicationFeeReceipt" || d.key === "paymentReceipt" || d.type === "PAYMENT_RECEIPT")
        ))
      )
    );
    const initials = getInitials(lead.applicantName);

    // Document checklist metrics
    const hasBirthCert = Boolean(lead.birthCertificateUrl || leadDocs.birthCertificate || leadDocs.birthCert);
    const hasPassport = Boolean(lead.passportPhotoUrl || leadDocs.passportPhoto || leadDocs.passport);
    const hasAcademicResults = Boolean(lead.academicResultsUrl || leadDocs.academicResults);
    const totalRequiredDocs = 3;
    const uploadedDocsCount = (hasBirthCert ? 1 : 0) + (hasPassport ? 1 : 0) + (hasAcademicResults ? 1 : 0);

    // Age calculation helper
    const dobStr = leadDocs.dateOfBirth;
    let candidateAge: number | null = null;
    if (dobStr) {
      const birth = new Date(dobStr);
      if (!isNaN(birth.getTime())) {
        candidateAge = Math.abs(new Date(Date.now() - birth.getTime()).getUTCFullYear() - 1970);
      }
    }

    // Stage constraint alert check for this card
    const targetStage = stages[sIdx + 1];
    const targetMinAge = targetStage?.constraints?.min_age;
    const isUnderage = Boolean(targetMinAge && candidateAge !== null && candidateAge < targetMinAge);

    const dateFormatted = new Date(lead.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <div
        key={lead.id}
        onClick={() => {
          setSelectedLead(lead);
          setIsDossierOpen(true);
        }}
        className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-md rounded-xl border border-slate-200/90 dark:border-zinc-800 transition-all cursor-pointer space-y-3 w-full max-w-full overflow-hidden"
      >
        {/* Card Header: Avatar + FULL NAME (break-words) + Micro-badges */}
        <div className="flex items-start gap-2.5 w-full">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-slate-900 dark:text-zinc-50 text-sm leading-snug break-words">
              {lead.applicantName}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                {appNo}
              </span>
              {/* Assigned Academic Tier Text Pill */}
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                {lead.tier?.name || activeTrack?.tierType || "PRIMARY"}
              </span>
            </div>
          </div>
        </div>

        {/* Micro-Badges Bar: Age Warning & Missing File Indicators */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* Age Marker */}
          {candidateAge !== null && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                isUnderage
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300"
                  : "bg-slate-50 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
              }`}
            >
              {isUnderage && <AlertTriangle className="w-3 h-3 text-amber-600 animate-pulse" />}
              <span>Age {candidateAge} yrs</span>
            </span>
          )}

          {/* Missing Document Indicators */}
          {!hasBirthCert && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
              Missing Birth Cert
            </span>
          )}

          {uploadedDocsCount === totalRequiredDocs && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
              <Check className="w-3 h-3" />
              <span>Docs 3/3</span>
            </span>
          )}
        </div>

        {/* Target Grade + Date */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80 pt-2.5">
          <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-zinc-200">
            <GraduationCap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">{lead.targetGrade || "Class Pending"}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{dateFormatted}</span>
          </div>
        </div>

        {/* Parent Phone */}
        {(lead.parentPhone || lead.parentContact) && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{lead.parentPhone || lead.parentContact}</span>
          </div>
        )}

        {/* Offline Entrance Assessment Score Inline Entry */}
        {(() => {
          const currentStage = stages[sIdx];
          const isAssessmentStage =
            Boolean(currentStage?.constraints?.require_exam_score) ||
            (currentStage?.name || "").toUpperCase().includes("EXAM") ||
            (currentStage?.name || "").toUpperCase().includes("ASSESSMENT") ||
            (currentStage?.name || "").toUpperCase().includes("SCREENING") ||
            (currentStage?.name || "").toUpperCase().includes("INTERVIEW") ||
            (lead.status || "").toUpperCase().includes("INTERVIEW") ||
            (lead.status || "").toUpperCase().includes("EXAM");

          const docs = (lead.documents as any) || {};
          const currentScore =
            docs.entranceScore ?? docs.examScore ?? docs.examAggregate ?? null;
          const isEditing = editingScoreLeadId === lead.id;
          const hasScore = currentScore !== null && currentScore !== undefined;
          const hasPassed = hasScore && Number(currentScore) >= 50;

          if (!isAssessmentStage && !hasScore) return null;

          return (
            <div
              className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Entrance Mark:</span>
                </span>

                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={inlineScoreInput}
                      onChange={(e) => setInlineScoreInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveCardScore(lead.id, inlineScoreInput);
                        if (e.key === "Escape") setEditingScoreLeadId(null);
                      }}
                      placeholder="0-100"
                      className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold bg-white dark:bg-zinc-800 border-2 border-indigo-400 rounded outline-none text-slate-900 dark:text-zinc-50 text-center"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={savingCardScoreId === lead.id}
                      onClick={() => handleSaveCardScore(lead.id, inlineScoreInput)}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition disabled:opacity-50"
                    >
                      {savingCardScoreId === lead.id ? "..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingScoreLeadId(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : hasScore ? (
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border inline-flex items-center gap-1 ${
                        hasPassed
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {hasPassed ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                      )}
                      <span>{currentScore}%</span>
                    </span>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingScoreLeadId(lead.id);
                          setInlineScoreInput(String(currentScore));
                        }}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingScoreLeadId(lead.id);
                          setInlineScoreInput("");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Enter Mark</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Bottom Row: Fee Badge + Advance Action */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
          <div>
            {isFeePaid ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <Check className="w-3 h-3" />
                <span>Paid</span>
              </span>
            ) : isFeePending ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLead(lead);
                  setIsDossierOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700 transition cursor-pointer shadow-xs"
                title="Application fee receipt uploaded by parent. Click to inspect dossier & Mark as Paid"
              >
                <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
                <span>Pending</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFeeModalLead(lead);
                  setFeeModalToast(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 transition cursor-pointer"
                title="Click to view bank details and payment action"
              >
                <span>Unpaid</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {canMutate && sIdx < stages.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageAdvance(lead, sIdx);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-zinc-200 font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-slate-200/80 dark:border-zinc-700"
                title={`Advance to ${stages[sIdx + 1]?.name}`}
              >
                <span>Advance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {sIdx >= stages.length - 1 && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enrolled</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Streamlined Enterprise Empty State inside stage column
  const renderInteractiveEmptyState = (stage: PipelineStageConfig) => {
    const rules: string[] = [];
    if (stage.constraints?.require_payment) rules.push("Fee Payment Verified");
    if (stage.constraints?.require_birth_cert) rules.push("Birth Certificate Required");
    if (stage.constraints?.require_passport) rules.push("Passport Photo");
    if (stage.constraints?.require_academic_results) rules.push("Transcripts Required");
    if (stage.constraints?.require_exam_score) {
      rules.push(
        stage.constraints.min_exam_score
          ? `Min Exam Score: ${stage.constraints.min_exam_score}%`
          : "Exam Score Required"
      );
    }
    if (stage.constraints?.min_age) rules.push(`Min Age: ${stage.constraints.min_age} yrs`);

    return (
      <div className="border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl py-6 px-3 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/40 dark:bg-zinc-900/20">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800/70 flex items-center justify-center text-slate-400 dark:text-zinc-500">
          <Users className="w-3.5 h-3.5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-300">
            No Candidates in Stage
          </h4>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-normal max-w-[260px]">
            {rules.length > 0
              ? `Rules: ${rules.join(", ")}`
              : "Ready for incoming candidate progression"}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      {/* 1. TOP NAVIGATION & WORKSPACE TABS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-2">
        {/* Main Tab Pill */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setMainTab("leads")}
            className={`pb-2 text-sm font-bold flex items-center gap-2 relative transition cursor-pointer ${
              mainTab === "leads"
                ? "text-blue-600 dark:text-blue-400 font-extrabold"
                : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span>Admission Pipeline (Kanban)</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              • {filteredLeads.length}
            </span>
            {mainTab === "leads" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab("register")}
            className={`pb-2 text-sm font-bold flex items-center gap-2 relative transition cursor-pointer ${
              mainTab === "register"
                ? "text-blue-600 dark:text-blue-400 font-extrabold"
                : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span>Admissions Register</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
              Live
            </span>
            {mainTab === "register" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Dynamic Multi-Track Selector filtered strictly to operating academic tiers */}
        {visibleTracks && visibleTracks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Track:</span>
            </span>
            {visibleTracks.length === 1 ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>{visibleTracks[0].name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700">
                {visibleTracks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTrackId(t.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTrack?.id === t.id
                        ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {isTenantAdmin && (
              <button
                type="button"
                onClick={() => setIsCreateTrackModalOpen(true)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold transition cursor-pointer"
                title="Create New Admission Track (Tenant Admin)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {pipelineToast && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all animate-in fade-in ${
            pipelineToast.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          <span>{pipelineToast.text}</span>
          <button
            type="button"
            onClick={() => setPipelineToast(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {mainTab === "register" ? (
        <AdmissionRegisterTable
          schoolId={schoolId}
          schoolDomain={schoolDomain || ""}
          schoolName={schoolName}
          canMutate={canMutate}
          isTenantAdmin={isTenantAdmin}
          leads={filteredLeads}
          stages={stages}
          activeTrackName={activeTrack?.name || "Active Track"}
          onLeadUpdated={(updatedLead) => {
            setLocalLeads((prev) =>
              prev.map((l) => (l.id === updatedLead.id ? { ...l, ...updatedLead } : l))
            );
          }}
          onLeadDeleted={(deletedId) => {
            setLocalLeads((prev) => prev.filter((l) => l.id !== deletedId));
          }}
        />
      ) : (
        <>
          {/* 2. TOOLBAR: Search + Filter + Actions */}
          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
            <div className="flex flex-1 items-center gap-3 w-full flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by candidate name, app no, or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition text-slate-800 dark:text-zinc-100"
                />
              </div>

              <select
                value={selectedStageFilter}
                onChange={(e) => setSelectedStageFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-zinc-200 shadow-2xs shrink-0"
              >
                <option value="ALL">All Stages ({stages.length})</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isTenantAdmin && activeTrack && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStageForConfig(stages[0] || null);
                    setIsConfigModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  title="Configure Stage Constraints & Rules"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Stage Rules</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsInquiryModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs sm:text-sm transition shadow-sm cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Log Walk-in Inquiry</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* STEP 4: MOBILE & TABLET VIEWPORT RESPONSIVENESS SWAP                       */}
          {/* ========================================================================= */}

          {/* 4A. MOBILE VIEW (<768px): Sticky Top Stage Navigation Bar + Single Responsive Column */}
          <div className="md:hidden space-y-3 w-full">
            {/* Sticky Top Stage Navigation Pills */}
            <div className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md -mx-2 px-2 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {stages.map((stage, idx) => {
                const count = filteredLeads.filter((l) => leadMatchesStage(l, stage)).length;
                const isActive = (mobileActiveStageId || stages[0]?.id) === stage.id;

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setMobileActiveStageId(stage.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
                    }`}
                  >
                    <span>{stage.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Single Mobile Column of Cards */}
            {(() => {
              const activeStage =
                stages.find((s) => s.id === (mobileActiveStageId || stages[0]?.id)) ||
                stages[0];
              if (!activeStage) return null;

              const stageIndex = stages.findIndex((s) => s.id === activeStage.id);
              const stageLeads = filteredLeads.filter((l) => leadMatchesStage(l, activeStage));

              return (
                <div className="p-3 bg-slate-100/70 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3 w-full">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                      {activeStage.name} ({stageLeads.length})
                    </h3>
                    {isTenantAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStageForConfig(activeStage);
                          setIsConfigModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Edit Rules
                      </button>
                    )}
                  </div>

                  {stageLeads.length > 0 ? (
                    <div className="space-y-3">
                      {stageLeads.map((lead) => renderApplicantCard(lead, stageIndex))}
                    </div>
                  ) : (
                    renderInteractiveEmptyState(activeStage)
                  )}
                </div>
              );
            })()}
          </div>

          {/* 4B. TABLET & DESKTOP VIEW (>=768px): Fluid Horizontal Panning Kanban Board */}
          <div className="hidden md:flex gap-4 overflow-x-auto pb-6 pt-1 w-full items-start">
            {stages.map((stage, sIdx) => {
              const stageLeads = filteredLeads.filter((l) => leadMatchesStage(l, stage));
              const hasConstraints =
                stage.constraints &&
                Object.values(stage.constraints).some(Boolean);

              return (
                <div
                  key={stage.id}
                  className="min-w-[320px] max-w-[340px] bg-[#f8f9fa] dark:bg-zinc-900/50 rounded-xl p-3 border border-slate-200/90 dark:border-zinc-800 flex flex-col gap-3 shrink-0"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color || "#3b82f6" }}
                      />
                      <h3
                        className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 truncate"
                        title={stage.name}
                      >
                        {stage.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTenantAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStageForConfig(stage);
                            setConfigModalToast(null);
                            setIsConfigModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-md transition cursor-pointer"
                          title="Configure Stage Gatekeeper Rules"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {hasConstraints && (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-500"
                          title="Stage constraints and prerequisites active"
                        />
                      )}
                      <span className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 rounded-full text-xs font-bold text-slate-700 dark:text-zinc-300 shadow-2xs">
                        {stageLeads.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards List or Interactive Empty State */}
                  <div className="space-y-3 min-h-[350px]">
                    {stageLeads.length > 0 ? (
                      stageLeads.map((lead) => renderApplicantCard(lead, sIdx))
                    ) : (
                      renderInteractiveEmptyState(stage)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* STAGE GUARDRAIL TRIGGER ALERT MODAL                                       */}
      {/* ========================================================================= */}
      {guardrailAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/60 max-w-md w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                  Stage Guardrail Triggered
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Prerequisites required for <strong>{guardrailAlert.stageName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGuardrailAlert(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-2 text-xs">
              <p className="font-bold text-rose-900 dark:text-rose-200">
                Cannot advance {guardrailAlert.lead.applicantName}. The following guardrails failed:
              </p>
              <ul className="list-disc list-inside space-y-1 text-rose-800 dark:text-rose-300">
                {guardrailAlert.missingPrerequisites.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setGuardrailAlert(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Dismiss
              </button>
              {guardrailAlert.missingPrerequisites.some((r) => r.toLowerCase().includes("fee") || r.toLowerCase().includes("payment")) && (
                <button
                  type="button"
                  onClick={() => {
                    const lead = guardrailAlert.lead;
                    setGuardrailAlert(null);
                    setFeeModalLead(lead);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  Settle Application Fee Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIGURE STAGE RULES MODAL (TENANT ADMIN ONLY)                           */}
      {/* ========================================================================= */}
      {isConfigModalOpen && selectedStageForConfig && isTenantAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                    Configure Stage Guardrails
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Tenant Admin Pipeline Rules ({activeTrack?.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingConfig(true);
                setConfigModalToast(null);

                const formData = new FormData(e.currentTarget);
                const name = (formData.get("name") as string) || selectedStageForConfig.name;
                const reqPayment = formData.get("require_payment") === "on";
                const reqBirthCert = formData.get("require_birth_cert") === "on";
                const reqPassport = formData.get("require_passport") === "on";
                const reqResults = formData.get("require_academic_results") === "on";
                const reqExamScore = formData.get("require_exam_score") === "on";
                const minExamScoreRaw = formData.get("min_exam_score");
                const minExamScoreVal =
                  minExamScoreRaw !== null && minExamScoreRaw !== ""
                    ? Number(minExamScoreRaw)
                    : undefined;
                const minAgeVal = Number(formData.get("min_age")) || 0;

                const constraints: PipelineStageConfig["constraints"] = {
                  require_payment: reqPayment,
                  require_birth_cert: reqBirthCert,
                  require_passport: reqPassport,
                  require_academic_results: reqResults,
                  require_exam_score: reqExamScore,
                  min_exam_score:
                    typeof minExamScoreVal === "number" && !isNaN(minExamScoreVal)
                      ? minExamScoreVal
                      : undefined,
                  min_age: minAgeVal > 0 ? minAgeVal : undefined,
                };

                try {
                  const res = await configureAdmissionStageAction({
                    schoolId,
                    schoolDomain: schoolDomain || "",
                    stageId: selectedStageForConfig.id,
                    name,
                    constraints,
                  });

                  if (res?.success) {
                    // Update local track state immediately so UI updates without full refresh
                    setTracks((prevTracks) =>
                      prevTracks.map((tr) => ({
                        ...tr,
                        stages: tr.stages.map((st) =>
                          st.id === selectedStageForConfig.id
                            ? { ...st, name, constraints }
                            : st
                        ),
                      }))
                    );

                    setConfigModalToast({
                      type: "success",
                      text: `Stage "${name}" gatekeeper rules updated successfully.`,
                    });
                    setPipelineToast({
                      type: "success",
                      text: `Stage "${name}" rules updated successfully.`,
                    });

                    setTimeout(() => {
                      setIsConfigModalOpen(false);
                      setConfigModalToast(null);
                      router.refresh();
                    }, 700);
                  } else {
                    setConfigModalToast({
                      type: "error",
                      text: res?.error || "Failed to update stage rules.",
                    });
                  }
                } catch (err: any) {
                  setConfigModalToast({
                    type: "error",
                    text: err.message || "Failed to update stage rules.",
                  });
                } finally {
                  setIsSavingConfig(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Stage Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={selectedStageForConfig.name}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-semibold"
                />
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="font-extrabold text-slate-900 dark:text-white block uppercase tracking-wider text-[11px]">
                  Automated Gatekeeper Constraints
                </span>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="require_payment"
                    defaultChecked={Boolean(selectedStageForConfig.constraints?.require_payment)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                      Require Application Fee Payment Verification
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Candidates must be settled as PAID before entering this stage.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="require_birth_cert"
                    defaultChecked={Boolean(selectedStageForConfig.constraints?.require_birth_cert)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                      Require Birth Certificate Upload
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Candidate dossier must contain an unrejected birth certificate.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="require_passport"
                    defaultChecked={Boolean(selectedStageForConfig.constraints?.require_passport)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                      Require Passport Photograph
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Candidate must have a valid passport photograph attached.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="require_academic_results"
                    defaultChecked={Boolean(selectedStageForConfig.constraints?.require_academic_results)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                      Require Academic Results / Transcripts
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Previous academic report cards or transcript required.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="require_exam_score"
                    defaultChecked={Boolean(selectedStageForConfig.constraints?.require_exam_score)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                      Require Entrance Exam / Assessment Score
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Candidate dossier must record a verified entrance examination score before advancing.
                    </span>
                  </div>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Minimum Exam Score (0-100)
                    </label>
                    <input
                      type="number"
                      name="min_exam_score"
                      min="0"
                      max="100"
                      defaultValue={selectedStageForConfig.constraints?.min_exam_score ?? 50}
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Minimum Age Threshold (Years)
                    </label>
                    <input
                      type="number"
                      name="min_age"
                      min="0"
                      max="30"
                      defaultValue={selectedStageForConfig.constraints?.min_age || ""}
                      placeholder="e.g. 5 (Leave blank if none)"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-semibold"
                    />
                  </div>
                </div>
              </div>

              {configModalToast && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold transition-all animate-in fade-in ${
                    configModalToast.type === "success"
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {configModalToast.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfigModalOpen(false);
                    setConfigModalToast(null);
                  }}
                  className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingConfig ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Stage Rules</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE NEW ADMISSION TRACK MODAL (TENANT ADMIN ONLY)                      */}
      {/* ========================================================================= */}
      {isCreateTrackModalOpen && isTenantAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-w-md w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                    Create Admission Track
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Define distinct workflow for educational tier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateTrackModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get("name") as string;
                const tierType = formData.get("tierType") as any;
                const description = formData.get("description") as string;

                const res = await createAdmissionTrackAction({
                  schoolId,
                  schoolDomain: schoolDomain || "",
                  name,
                  tierType,
                  description,
                });

                if (res?.success && res.track) {
                  setTracks((prev) => [...prev, res.track as any]);
                  setActiveTrackId(res.track.id);
                  setIsCreateTrackModalOpen(false);
                  router.refresh();
                } else {
                  alert(res?.error || "Failed to create track.");
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Track Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Senior Secondary Science Track"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Academic Tier Type
                </label>
                <select
                  name="tierType"
                  defaultValue="SECONDARY"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-semibold"
                >
                  <option value="NURSERY">Nursery / Daycare</option>
                  <option value="PRIMARY">Primary School</option>
                  <option value="SECONDARY">Secondary School</option>
                  <option value="TERTIARY">Tertiary / University</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Target applicant population and curriculum criteria..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateTrackModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition shadow-xs"
                >
                  Create Pipeline Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORM FEE PAYMENT MODAL */}
      {feeModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                    Application Fee Payment Action
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Manual Mobile Transfer Bank Instructions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeeModalLead(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feeModalToast && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  feeModalToast.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {feeModalToast.text}
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-[11px] font-bold text-amber-900 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                Central Bursar Account - Configured by Tenant Admin Only
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">READ-ONLY</span>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Bank
                  </span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100">
                    {bankDetails.bankName}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Account Number
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-slate-900 dark:text-zinc-50 text-sm">
                      {bankDetails.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(bankDetails.accountNumber, "acc")}
                      className="text-slate-400 hover:text-blue-600 transition p-0.5 cursor-pointer"
                      title="Copy account number"
                    >
                      {copiedField === "acc" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 dark:border-zinc-700/60 pt-2.5">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Account Name
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate block">
                    {bankDetails.accountName}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Application Fee Amount
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    ₦{Number(bankDetails.formFeeAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setFeeModalLead(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendBankDetailsEmail}
                disabled={isSendingBankEmail || isMarkingPaid}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-300/80 transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingBankEmail ? "Sending..." : "Send Bank Details to Email"}</span>
              </button>
              <button
                type="button"
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid || isSendingBankEmail}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isMarkingPaid ? "Updating..." : "Mark as Paid"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPLICANT DOSSIER DRAWER */}
      <ApplicantDossierDrawer
        lead={selectedLead}
        isOpen={isDossierOpen}
        onClose={() => {
          setIsDossierOpen(false);
          setSelectedLead(null);
        }}
        schoolId={schoolId}
        schoolDomain={schoolDomain || ""}
        schoolName={schoolName}
        canMutate={canMutate}
        onLeadUpdated={() => router.refresh()}
      />

      {/* LOG WALK-IN INQUIRY MODAL */}
      <NewInquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        schoolId={schoolId}
        schoolDomain={schoolDomain || ""}
        tiers={tiers}
        onLeadCreated={() => router.refresh()}
      />
    </div>
  );
}
