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
} from "lucide-react";
import {
  updateLeadStatusAction,
  sendBankDetailsEmailAction,
  markFormFeePaidAction,
} from "./actions";
import ApplicantDossierDrawer from "./ApplicantDossierDrawer";
import NewInquiryModal from "./NewInquiryModal";
import AdmissionRegisterTable from "./AdmissionRegisterTable";

export const STAGES = [
  { id: "INQUIRY", label: "INQUIRY", dotColor: "bg-slate-400" },
  { id: "DOCS_PENDING", label: "DOCS PENDING", dotColor: "bg-amber-500" },
  { id: "VERIFIED", label: "SCREENED & VERIFIED", dotColor: "bg-blue-500" },
  { id: "INTERVIEW", label: "EXAM/INTERVIEW", dotColor: "bg-purple-500" },
  { id: "APPROVED", label: "PROVISIONAL OFFER", dotColor: "bg-indigo-500" },
  { id: "ENROLLED", label: "MATRICULATED", dotColor: "bg-emerald-500" },
];

function leadMatchesStage(leadStatus: string | null | undefined, stageId: string): boolean {
  const norm = (leadStatus || "INQUIRY").toUpperCase();
  if (norm === stageId) return true;
  if (stageId === "DOCS_PENDING" && norm === "APPLIED") return true;
  if (stageId === "VERIFIED" && (norm === "SCREENED" || norm === "DOCS_VERIFIED")) return true;
  if (stageId === "INTERVIEW" && (norm === "EXAM" || norm === "SCREENING")) return true;
  if (stageId === "APPROVED" && (norm === "OFFER" || norm === "OFFERED")) return true;
  if (stageId === "ENROLLED" && (norm === "CONVERTED" || norm === "ADMITTED")) return true;
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
};

export default function AdmissionsPipeline({
  leads,
  schoolId,
  schoolDomain,
  tiers,
  schoolName = "Institution Admissions Desk",
  canMutate = false,
}: {
  leads: LeadWithTier[];
  schoolId: string;
  schoolDomain?: string;
  tiers: AcademicTier[];
  schoolName?: string;
  canMutate?: boolean;
}) {
  const router = useRouter();
  const [localLeads, setLocalLeads] = useState<LeadWithTier[]>(leads);
  const [mainTab, setMainTab] = useState<"leads" | "register">("leads");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);

  // Search & Stage Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");

  // Modals & Drawers
  const [selectedLead, setSelectedLead] = useState<LeadWithTier | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

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
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (l.applicantName && l.applicantName.toLowerCase().includes(q)) ||
        (l.targetGrade && l.targetGrade.toLowerCase().includes(q)) ||
        (l.parentContact && l.parentContact.includes(q)) ||
        (l.parentPhone && l.parentPhone.includes(q)) ||
        (l.id && l.id.toLowerCase().includes(q));

      const matchesStage = selectedStage === "ALL" || leadMatchesStage(l.status, selectedStage);
      return matchesSearch && matchesStage;
    });
  }, [localLeads, searchQuery, selectedStage]);

  // Stage advance handler
  const handleStageAdvance = (leadId: string, currentStage: string) => {
    const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
    if (currentIndex >= STAGES.length - 1) return;
    const nextStage = STAGES[currentIndex + 1].id;

    startTransition(async () => {
      try {
        const res = await updateLeadStatusAction({
          leadId,
          status: nextStage,
          schoolId,
          schoolDomain: schoolDomain || "",
        });
        if (res && res.success) {
          setLocalLeads((prev) =>
            prev.map((l) => (l.id === leadId ? { ...l, status: nextStage } : l))
          );
          router.refresh();
        }
      } catch (err) {
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
        setFeeModalToast({ type: "success", text: `Bank details sent successfully to ${targetEmail}` });
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
        // Update local state
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
        setFeeModalToast({ type: "success", text: "Form fee marked as PAID successfully." });
        setTimeout(() => {
          setFeeModalLead(null);
          router.refresh();
        }, 1200);
      } else {
        setFeeModalToast({ type: "error", text: res?.error || "Failed to update payment status." });
      }
    } catch (err: any) {
      setFeeModalToast({ type: "error", text: err.message || "Failed to update payment status." });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. TABS: Clean pill with blue active underline */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMainTab("leads")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 relative transition cursor-pointer ${
            mainTab === "leads"
              ? "text-blue-600 dark:text-blue-400 font-extrabold"
              : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <span>Admission Leads (Kanban)</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            • {localLeads.length}
          </span>
          {mainTab === "leads" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab("register")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 relative transition cursor-pointer ${
            mainTab === "register"
              ? "text-blue-600 dark:text-blue-400 font-extrabold"
              : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <span>Admissions Register (Live)</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
            Live
          </span>
          {mainTab === "register" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      {mainTab === "register" ? (
        <AdmissionRegisterTable
          schoolId={schoolId}
          schoolDomain={schoolDomain || ""}
          schoolName={schoolName}
          canMutate={canMutate}
        />
      ) : (
        <>
          {/* 2. TOOLBAR: ONE row flex - Search + Select All Stages + + Log Walk-in Inquiry button */}
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
            <div className="flex flex-1 items-center gap-3 w-full">
              {/* Search input with icon */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by candidate name, app no, or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition text-slate-800 dark:text-zinc-100"
                />
              </div>

              {/* Select All Stages dropdown */}
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-zinc-200 shadow-2xs shrink-0"
              >
                <option value="ALL">All Stages ({STAGES.length})</option>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* + Log Walk-in Inquiry blue button */}
            <button
              type="button"
              onClick={() => setIsInquiryModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs sm:text-sm transition shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Log Walk-in Inquiry</span>
            </button>
          </div>

          {/* 3. PIPELINE KANBAN: flex gap-4 overflow-x-auto, min-w-[320px] per column, FULL NAME */}
          <div className="flex gap-4 overflow-x-auto pb-6 pt-1 w-full items-start">
            {STAGES.map((stage, sIdx) => {
              const stageLeads = filteredLeads.filter((l) => leadMatchesStage(l.status, stage.id));

              return (
                <div
                  key={stage.id}
                  className="min-w-[320px] max-w-[320px] bg-[#f8f9fa] dark:bg-zinc-800/50 rounded-xl p-3 border border-slate-200/90 dark:border-zinc-800 flex flex-col gap-3 shrink-0"
                >
                  {/* Column Header with count badge + color dot */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${stage.dotColor} shrink-0`}></span>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {stage.label}
                      </h3>
                    </div>
                    <span className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 rounded-full text-xs font-bold text-slate-700 dark:text-zinc-300 shadow-2xs shrink-0">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards inside column */}
                  <div className="space-y-3 min-h-[350px]">
                    {stageLeads.length > 0 ? (
                      stageLeads.map((lead) => {
                        const appNo = `APP-${lead.id.slice(0, 6).toUpperCase()}`;
                        const leadDocs = (lead.documents as any) || {};
                        const isFeePaid = Boolean(leadDocs.formFeePaid);
                        const initials = getInitials(lead.applicantName);
                        const docCount = Object.keys(leadDocs).filter((k) => k !== "formFeePaid" && k !== "passwordHash").length;
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
                            className="p-4 bg-white dark:bg-zinc-900 shadow-sm rounded-lg border border-slate-200/90 dark:border-zinc-800 hover:shadow-md transition cursor-pointer space-y-3"
                          >
                            {/* Card Top: Avatar + FULL NAME + App No */}
                            <div className="flex items-start gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                {/* FULL NAME - NO TRUNCATION */}
                                <h4 className="font-extrabold text-slate-900 dark:text-zinc-50 text-sm leading-snug break-words">
                                  {lead.applicantName}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                                    {appNo}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Class + Date Info */}
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

                            {/* Bottom Row: Fee Badge + Actions */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
                              {/* Fee Badge */}
                              <div>
                                {isFeePaid ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    <Check className="w-3 h-3" />
                                    <span>Paid ✓</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFeeModalLead(lead);
                                      setFeeModalToast(null);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 transition cursor-pointer"
                                    title="Click to view bank details and payment action"
                                  >
                                    <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                    <span>⏳ Pending</span>
                                  </button>
                                )}
                              </div>

                              {/* Dossier & Advance action buttons */}
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                  <FileCheck className="w-3.5 h-3.5 text-blue-500" />
                                  <span>{docCount}</span>
                                </span>

                                {canMutate && sIdx < STAGES.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStageAdvance(lead.id, lead.status);
                                    }}
                                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-blue-50 hover:text-blue-600 text-slate-700 dark:text-zinc-300 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                    title={`Advance to ${STAGES[sIdx + 1].label}`}
                                  >
                                    <span>Advance</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}

                                {sIdx >= STAGES.length - 1 && (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Enrolled</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-400 dark:text-zinc-500">
                        No candidates in this stage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* FORM FEE PAYMENT MODAL: Zenith Bank Read-only + Send to Email + Mark Paid */}
      {feeModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                    Form Fee Payment Action
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

            {/* Notification alert */}
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

            {/* Read-Only Central Bursar Account Banner */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-[11px] font-bold text-amber-900 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                Central Bursar Account - Configured by Tenant Admin Only
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">READ-ONLY</span>
            </div>

            {/* Bank Details Grid */}
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
                    Form Fee Amount
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    ₦{Number(bankDetails.formFeeAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 dark:border-zinc-700/60 pt-2.5">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Payment Reference / Ref
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 text-xs">
                      {`APP-${feeModalLead.id.slice(0, 6).toUpperCase()}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`APP-${feeModalLead.id.slice(0, 6).toUpperCase()}`, "ref")}
                      className="text-slate-400 hover:text-blue-600 transition p-0.5 cursor-pointer"
                      title="Copy reference"
                    >
                      {copiedField === "ref" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Candidate Name
                  </span>
                  <span className="font-bold text-slate-900 dark:text-zinc-50 truncate block text-xs">
                    {feeModalLead.applicantName}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              Admissions officers cannot edit central bank settings. Tenant administrators configure official accounts in Finance Settings.
            </p>

            {/* Action Buttons: Close + Send Bank Details to Email + Mark as Paid */}
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
