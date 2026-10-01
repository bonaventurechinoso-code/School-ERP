"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdmissionLead, AcademicTier } from "@prisma/client";
import {
  Users,
  Search,
  Plus,
  Printer,
  FileText,
  CheckCircle2,
  Clock,
  Phone,
  ArrowRight,
  UserCheck,
  ShieldCheck,
  FileCheck,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { updateLeadStatusAction, enrollApplicantAction } from "./actions";
import ApplicantDossierDrawer from "./ApplicantDossierDrawer";
import NewInquiryModal from "./NewInquiryModal";
import AdmissionRegisterTable from "./AdmissionRegisterTable";

const STAGES = [
  { id: "INQUIRY", label: "Initial Inquiry", color: "border-t-amber-500", bg: "bg-amber-500/10 text-amber-800" },
  { id: "APPLIED", label: "Application & KYC", color: "border-t-blue-500", bg: "bg-blue-500/10 text-blue-800" },
  { id: "INTERVIEW", label: "Entrance Exam", color: "border-t-purple-500", bg: "bg-purple-500/10 text-purple-800" },
  { id: "APPROVED", label: "Provisional Offer", color: "border-t-indigo-500", bg: "bg-indigo-500/10 text-indigo-800" },
  { id: "ENROLLED", label: "Matriculated", color: "border-t-emerald-500", bg: "bg-emerald-500/10 text-emerald-800" },
];

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

type LeadWithTier = AdmissionLead & { tier?: AcademicTier | null; notes?: any[]; targetClass?: string; academicTier?: string; targetClassCohort?: string };

export default function AdmissionsPipeline({
  leads,
  schoolId,
  schoolDomain,
  tiers,
  schoolName = "Greenwood Academy",
}: {
  leads: LeadWithTier[];
  schoolId: string;
  schoolDomain?: string;
  tiers: AcademicTier[];
  schoolName?: string;
}) {
  const router = useRouter();
  const [localLeads, setLocalLeads] = useState<LeadWithTier[]>(leads);
  const [mainTab, setMainTab] = useState<"register" | "leads">("register");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);

  // View Mode & Filters
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("ALL");

  // Drawers & Modals
  const [selectedLead, setSelectedLead] = useState<LeadWithTier | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return localLeads.filter((l) => {
      const matchesSearch =
        !searchQuery.trim() ||
        l.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.targetGrade.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.parentContact && l.parentContact.includes(searchQuery)) ||
        (l.parentName && l.parentName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStage = filterStage === "ALL" || l.status === filterStage;

      return matchesSearch && matchesStage;
    });
  }, [localLeads, searchQuery, filterStage]);

  const handleStageAdvance = (leadId: string, currentStage: string) => {
    const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
    if (currentIndex >= STAGES.length - 1) return;
    const nextStage = STAGES[currentIndex + 1].id;

    startTransition(async () => {
      const res = await updateLeadStatusAction({
        leadId,
        status: nextStage,
        schoolId,
        schoolDomain: schoolDomain || "",
      });
      if (res.success) {
        setLocalLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: nextStage } : l))
        );
        router.refresh();
      }
    });
  };

  const openDossier = (lead: LeadWithTier) => {
    setSelectedLead(lead);
    setIsDrawerOpen(true);
  };

  // -------------------------------------------------------------
  // PRINTABLE PROVISIONAL ADMISSION OFFER LETTER
  // -------------------------------------------------------------
  const printAdmissionOfferLetter = (lead: LeadWithTier) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const offerRef = `ADM-OFFER/${(schoolDomain || "GW").toUpperCase()}/${new Date().getFullYear()}/${lead.id.substring(0, 6).toUpperCase()}`;
    const dateStr = new Date().toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Provisional Admission Offer Letter - ${lead.applicantName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { 
              font-family: Georgia, Cambria, "Times New Roman", Times, serif; 
              padding: 48px; 
              color: #0f172a; 
              max-width: 800px; 
              margin: 0 auto; 
              line-height: 1.6; 
              background-color: #ffffff;
            }
            @media print { 
              .print\\:hidden, [class*="print:hidden"] { display: none !important; }
              body { padding: 0 !important; max-width: 100% !important; } 
            }
          </style>
        </head>
        <body>
          <div class="print:hidden mb-8 flex items-center justify-between border-b pb-4">
            <button onclick="window.close()" class="px-4 py-2 bg-slate-100 text-slate-700 font-sans font-bold rounded-xl text-xs">
              Back to CRM
            </button>
            <button onclick="window.print()" class="px-5 py-2 bg-slate-900 text-white font-sans font-bold rounded-xl text-xs shadow-md">
              Print Official Offer Letter
            </button>
          </div>

          <!-- INSTITUTION LETTERHEAD -->
          <div class="text-center border-b-2 border-slate-900 pb-5 mb-8">
            <div class="inline-block w-16 h-16 rounded-2xl bg-indigo-900 text-white font-sans font-black text-2xl flex items-center justify-center mb-2 border-2 border-amber-400 shadow-sm">
              GW
            </div>
            <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900">${schoolName}</h1>
            <p class="text-xs uppercase tracking-widest text-slate-600 font-sans mt-0.5">
              Office of the Admissions Director & Academic Board
            </p>
            <p class="text-[11px] text-slate-500 font-sans mt-1">
              Official Offer Ref: <strong class="font-mono">${offerRef}</strong> • Date: ${dateStr}
            </p>
          </div>

          <!-- RECIPIENT -->
          <div class="mb-6 font-sans text-xs space-y-1">
            <p class="font-bold text-sm text-slate-900">To the Parents / Guardians of: ${lead.applicantName}</p>
            <p class="text-slate-600">Telephone: ${lead.parentPhone || lead.parentContact}</p>
            <p class="text-slate-600">Offered Placement: <strong>${lead.targetGrade}</strong> (${lead.tier?.name || "Academic Tier"})</p>
          </div>

          <h2 class="text-base font-bold underline mb-5 text-center font-sans uppercase tracking-wide">
            OFFER OF PROVISIONAL ADMISSION FOR THE 2026/2027 ACADEMIC SESSION
          </h2>

          <div class="text-xs space-y-3 leading-relaxed text-slate-800">
            <p>
              Following successful review of the admission application, entrance assessment, and screening credentials, the Academic Admissions Board of <strong>${schoolName}</strong> is pleased to extend an offer of <strong>Provisional Admission</strong> to:
            </p>

            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl my-3 font-sans text-center">
              <span class="text-[11px] uppercase tracking-wider text-slate-500 block font-bold">Candidate Name</span>
              <p class="text-base font-black text-slate-900 mt-0.5">${lead.applicantName}</p>
              <span class="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                Admitted Cohort: ${lead.targetGrade} (${lead.tier?.name || "General Tier"})
              </span>
            </div>

            <h3 class="font-bold font-sans uppercase text-slate-900 text-[11px] mt-4">1. Acceptance of Placement & Enrollment Fee</h3>
            <p>
              To secure this placement, a non-refundable Acceptance Fee of <strong>₦25,000.00</strong> must be lodged into the school bursary bank account within fourteen (14) calendar days of the date of this letter.
            </p>

            <h3 class="font-bold font-sans uppercase text-slate-900 text-[11px] mt-3">2. Statutory Verification Requirements</h3>
            <p>
              This provisional placement is contingent upon satisfactory submission of the original National Population Commission (NPC) Birth Certificate, NIMC National Identification Number (NIN) slip, and Medical Certificate of Fitness prior to orientation.
            </p>

            <h3 class="font-bold font-sans uppercase text-slate-900 text-[11px] mt-3">3. Matriculation</h3>
            <p>
              Upon payment confirmation, the candidate will be assigned an official institutional Admission Number and granted access to the Student Portal.
            </p>
          </div>

          <!-- SIGNATURE BLOCK -->
          <div class="mt-14 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 font-sans text-xs">
            <div>
              <div class="border-b border-slate-900 pb-1 mb-1 font-serif italic text-sm">
                Mrs. O. A. Babatunde
              </div>
              <p class="font-bold text-slate-900">Director of Admissions & Enrollment</p>
              <p class="text-[10px] text-slate-500">${schoolName}</p>
            </div>

            <div class="text-right">
              <div class="border-b border-slate-900 pb-1 mb-1 font-serif italic text-sm">
                Dr. A. B. Adeleke
              </div>
              <p class="font-bold text-slate-900">Registrar & Head of School</p>
              <p class="text-[10px] text-slate-500">Seal of Academic Board</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // -------------------------------------------------------------
  // PRINTABLE ENTRANCE EXAMINATION SLIP
  // -------------------------------------------------------------
  const printExamAdmitSlip = (lead: LeadWithTier) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const examNo = `EXM-${(schoolDomain || "GW").toUpperCase()}-2026-${lead.id.substring(0, 5).toUpperCase()}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Entrance Examination Admit Card - ${lead.applicantName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 32px; 
              background-color: #f8fafc; 
              color: #0f172a; 
            }
            @media print { 
              .print\\:hidden, [class*="print:hidden"] { display: none !important; }
              body { padding: 0 !important; background: transparent !important; }
            }
          </style>
        </head>
        <body class="flex flex-col items-center justify-center min-h-screen">
          <div class="print:hidden mb-6 flex items-center gap-3">
            <button onclick="window.close()" class="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">
              Close
            </button>
            <button onclick="window.print()" class="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md">
              Print Examination Slip
            </button>
          </div>

          <div class="w-full max-w-xl bg-white border-2 border-slate-800 rounded-3xl p-8 shadow-2xl">
            <!-- Header -->
            <div class="text-center border-b-2 border-slate-800 pb-4 mb-5">
              <h2 class="text-xl font-black uppercase text-slate-900">${schoolName}</h2>
              <p class="text-[10px] uppercase tracking-widest font-bold text-slate-500">Entrance Screening & Examination Admit Card</p>
              <span class="inline-block mt-2 font-mono font-bold text-xs bg-slate-900 text-white px-3 py-1 rounded-md">
                Roll No: ${examNo}
              </span>
            </div>

            <!-- Candidate Details -->
            <div class="flex items-center gap-6 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div class="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-[10px] font-bold text-center shrink-0">
                <span>Affix Recent</span>
                <span>Passport Photo</span>
              </div>
              <div class="text-xs space-y-1.5 min-w-0">
                <p><span class="text-slate-500">Candidate Name:</span> <strong class="text-slate-900 text-sm block">${lead.applicantName}</strong></p>
                <p><span class="text-slate-500">Target Grade:</span> <strong class="text-slate-800">${lead.targetGrade}</strong> (${lead.tier?.name || "General"})</p>
                <p><span class="text-slate-500">Parent Telephone:</span> <strong class="text-slate-800 font-mono">${lead.parentPhone || lead.parentContact}</strong></p>
              </div>
            </div>

            <!-- Exam Schedule -->
            <div class="border border-slate-200 rounded-2xl p-4 text-xs space-y-2 mb-6">
              <h4 class="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Screening Schedule & Venue</h4>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-slate-500 block text-[10px]">Test Date</span>
                  <strong class="text-slate-900">Saturday, 27th September 2026</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px]">Arrival & Accreditation</span>
                  <strong class="text-slate-900">08:30 AM Prompt</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px]">Examination Hall</span>
                  <strong class="text-slate-900">Main ICT Complex / Hall A</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px]">Test Subjects</span>
                  <strong class="text-slate-900">Maths, English, General Paper</strong>
                </div>
              </div>
            </div>

            <!-- Instructions -->
            <div class="text-[10px] text-slate-500 border-t border-slate-200 pt-4 space-y-1 leading-relaxed">
              <p>• Candidates must arrive in neat mufti or previous school uniform with this printed slip.</p>
              <p>• Writing materials (HB Pencils, Erasers, Pens) are required. Calculators and mobile phones are strictly prohibited.</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* TABS SWITCHER: ADMISSION REGISTER (LIVE) vs ADMISSION LEADS (LEGACY) */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setMainTab("register")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-2xs ${
            mainTab === "register"
              ? "bg-indigo-600 text-white shadow-indigo-600/20 shadow-md"
              : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Admission Register (Live)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              mainTab === "register"
                ? "bg-white/20 text-white"
                : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab("leads")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-2xs ${
            mainTab === "leads"
              ? "bg-indigo-600 text-white shadow-indigo-600/20 shadow-md"
              : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Admission Leads (Legacy)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              mainTab === "leads"
                ? "bg-white/20 text-white"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
            }`}
          >
            {leads.length}
          </span>
        </button>
      </div>

      {mainTab === "register" ? (
        <AdmissionRegisterTable
          schoolId={schoolId}
          schoolDomain={schoolDomain || ""}
          schoolName={schoolName}
        />
      ) : (
        <>
          {/* TOOLBAR & CONTROLS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Admissions Pipeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Managing {filteredLeads.length} active applicant prospects
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* SEARCH */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student or parent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-56 bg-slate-50/50"
            />
          </div>

          {/* FILTER STAGE */}
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-indigo-500 bg-white shadow-2xs"
          >
            <option value="ALL">All Stages (5)</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          {/* LOG INQUIRY BUTTON */}
          <button
            onClick={() => setIsInquiryModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Log Walk-In Inquiry</span>
          </button>
        </div>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {STAGES.map((stage, sIdx) => {
            const stageLeads = filteredLeads.filter((l) => l.status === stage.id);

            return (
              <div
                key={stage.id}
                className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 flex flex-col gap-3 min-h-[500px]"
              >
                {/* COLUMN HEADER */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-tight text-slate-800 uppercase">
                      {stage.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white border border-slate-200 text-slate-700 shadow-2xs">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* CARDS LIST */}
                <div className="space-y-3 flex-1">
                  {stageLeads.length > 0 ? (
                    stageLeads.map((lead) => {
                      const docCount = Object.keys(lead.documents || {}).length;

                      return (
                        <div
                          key={lead.id}
                          onClick={() => openDossier(lead)}
                          className={`bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition cursor-pointer border-t-4 ${stage.color} space-y-3`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-black text-slate-800 text-xs leading-tight hover:text-indigo-600 transition">
                                {lead.applicantName}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                {lead.targetGrade || (lead as any).targetClass} • <span className="text-indigo-600 font-semibold">{lead.tier?.name || (lead as any).academicTier || deriveTierFromClass(lead.targetGrade || (lead as any).targetClass)}</span>
                              </p>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {lead.id.slice(0, 4).toUpperCase()}
                            </span>
                          </div>

                          {/* PARENT CONTACT */}
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 font-mono">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{lead.parentPhone || lead.parentContact}</span>
                          </div>

                          {/* FOOTER BADGES & ADVANCE */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDossier(lead);
                                }}
                                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-md transition"
                              >
                                Dossier
                              </button>
                              <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                                <FileCheck className="w-3 h-3 text-emerald-500" />
                                <span>{docCount}</span>
                              </span>
                            </div>

                            {sIdx < STAGES.length - 1 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStageAdvance(lead.id, lead.status);
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold rounded-lg transition flex items-center gap-1"
                                title={`Advance to ${STAGES[sIdx + 1].label}`}
                              >
                                <span>Advance</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Enrolled
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl text-[11px] text-slate-400">
                      No applicants in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABULAR ROSTER LIST VIEW */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Candidate & Ref</th>
                  <th className="p-4">Target Cohort</th>
                  <th className="p-4">Parent / Contact</th>
                  <th className="p-4">Current Stage</th>
                  <th className="p-4">KYC Documents</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => {
                    const docCount = Object.keys(lead.documents || {}).length;
                    const stageObj = STAGES.find((s) => s.id === lead.status) || STAGES[0];

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4">
                          <button
                            onClick={() => openDossier(lead)}
                            className="font-bold text-slate-800 hover:text-indigo-600 transition text-left cursor-pointer"
                          >
                            {lead.applicantName}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            ADM-{lead.id.slice(0, 6).toUpperCase()}
                          </span>
                        </td>

                        <td className="p-4 font-semibold text-slate-700">
                          {lead.targetGrade || (lead as any).targetClass}
                          <span className="text-[10px] text-indigo-600 font-medium block">
                            {lead.tier?.name || (lead as any).academicTier || deriveTierFromClass(lead.targetGrade || (lead as any).targetClass)}
                          </span>
                        </td>

                        <td className="p-4 text-slate-600 font-mono">
                          <span className="font-sans font-bold text-slate-800 block">
                            {lead.parentName || "Parent / Guardian"}
                          </span>
                          <span>{lead.parentPhone || lead.parentContact}</span>
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${stageObj.bg}`}>
                            {stageObj.label}
                          </span>
                        </td>

                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{docCount} verified</span>
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openDossier(lead)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition"
                            >
                              Dossier
                            </button>
                            <button
                              onClick={() => printAdmissionOfferLetter(lead)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                              title="Print Offer Letter"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => printExamAdmitSlip(lead)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                              title="Print Exam Admit Slip"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                      No applicants found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* APPLICANT DOSSIER DRAWER */}
      <ApplicantDossierDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLead(null);
        }}
        schoolId={schoolId}
        schoolDomain={schoolDomain || "greenwood"}
        schoolName={schoolName}
        onLeadUpdated={() => router.refresh()}
        onPrintOfferLetter={printAdmissionOfferLetter}
        onPrintExamSlip={printExamAdmitSlip}
      />

      {/* DIRECT INQUIRY MODAL */}
      <NewInquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        schoolId={schoolId}
        schoolDomain={schoolDomain || "greenwood"}
        tiers={tiers}
        onLeadCreated={() => router.refresh()}
      />
    </div>
  );
}
