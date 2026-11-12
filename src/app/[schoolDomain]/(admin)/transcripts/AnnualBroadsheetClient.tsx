"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Award,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Search,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Loader2,
  Download,
  BookOpen,
  X,
} from "lucide-react";
import { 
  BroadsheetStudentRow, 
  BroadsheetStats, 
  executeClassPromotionAction, 
  fetchAnnualBroadsheet,
  fetchStudentSubjectBreakdown,
  StudentSubjectBreakdownResponse
} from "./actions";

interface InitialStudent {
  id: string;
  name: string;
  admissionNumber?: string | null;
  currentClass?: string | null;
  status: string;
  cumulativeGPA?: string;
  tierName?: string;
}

interface AnnualBroadsheetClientProps {
  schoolId?: string;
  schoolDomain: string;
  schoolName: string;
  initialStudents: InitialStudent[];
  initialBroadsheet: BroadsheetStudentRow[];
  initialStats: BroadsheetStats;
  initialTier: string;
  initialClass: string;
  academicYear: string;
  academicTiers: string[];
}

const TIER_CLASSES: Record<string, string[]> = {
  "Secondary School": ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"],
  "Primary School": ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  "Creche / Nursery": ["Creche", "Pre-Nursery", "Nursery 1", "Nursery 2"],
  "University": ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"],
  "Polytechnic": ["ND 1", "ND 2", "HND 1", "HND 2"],
  "College of Education": ["NCE 1", "NCE 2", "NCE 3"],
  "Higher Education": ["100 Level", "200 Level", "300 Level", "400 Level"],
};

export default function AnnualBroadsheetClient({
  schoolId,
  schoolDomain,
  schoolName,
  initialStudents,
  initialBroadsheet,
  initialStats,
  initialTier,
  initialClass,
  academicYear = "2026/2027",
  academicTiers = [],
}: AnnualBroadsheetClientProps) {
  const [activeTab, setActiveTab] = useState<"broadsheet" | "transcripts">("broadsheet");
  const [selectedTier, setSelectedTier] = useState<string>(initialTier || "Secondary School");
  const [selectedClass, setSelectedClass] = useState<string>(initialClass || "JSS 1");
  const [selectedSession, setSelectedSession] = useState<string>(academicYear);
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptTierFilter, setTranscriptTierFilter] = useState<string>("ALL");

  const [broadsheet, setBroadsheet] = useState<BroadsheetStudentRow[]>(initialBroadsheet);
  const [stats, setStats] = useState<BroadsheetStats>(initialStats);
  const [isPending, startTransition] = useTransition();

  // Promotion Confirmation Modal State
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionFeedback, setPromotionFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  // Subject Performance Quick Inspector Modal State
  const [inspectedStudent, setInspectedStudent] = useState<StudentSubjectBreakdownResponse | null>(null);
  const [isLoadingSubjectModal, setIsLoadingSubjectModal] = useState(false);

  // Available classes for selected tier
  const availableClasses = useMemo(() => {
    return TIER_CLASSES[selectedTier] || TIER_CLASSES["Secondary School"];
  }, [selectedTier]);

  // Reactive data loader when filters change
  const loadBroadsheetData = (tier: string, cls: string, session: string) => {
    startTransition(async () => {
      const res = await fetchAnnualBroadsheet(schoolId || schoolDomain, {
        className: cls,
        tierName: tier,
        academicYear: session,
      });
      if (res.success) {
        setBroadsheet(res.broadsheet);
        setStats(res.stats);
      }
    });
  };

  // Handle tier change: automatically reset class to first available and reload
  const handleTierChange = (newTier: string) => {
    setSelectedTier(newTier);
    const classes = TIER_CLASSES[newTier] || ["JSS 1"];
    const targetClass = classes[0];
    setSelectedClass(targetClass);
    loadBroadsheetData(newTier, targetClass, selectedSession);
  };

  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    loadBroadsheetData(selectedTier, newClass, selectedSession);
  };

  const handleSessionChange = (newSession: string) => {
    setSelectedSession(newSession);
    loadBroadsheetData(selectedTier, selectedClass, newSession);
  };

  // Filtered broadsheet based on search
  const filteredBroadsheet = useMemo(() => {
    if (!searchQuery.trim()) return broadsheet;
    const q = searchQuery.toLowerCase();
    return broadsheet.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.admissionNumber.toLowerCase().includes(q)
    );
  }, [broadsheet, searchQuery]);

  // Filtered cumulative transcripts roster
  const filteredTranscripts = useMemo(() => {
    return initialStudents.filter((s) => {
      if (transcriptTierFilter !== "ALL") {
        const allowedClasses = TIER_CLASSES[transcriptTierFilter] || [];
        const matchesTier =
          (s.tierName && s.tierName.toLowerCase().includes(transcriptTierFilter.toLowerCase())) ||
          (s.currentClass && allowedClasses.some((c) => c.toLowerCase() === s.currentClass?.toLowerCase()));
        if (!matchesTier) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q)) ||
        (s.currentClass && s.currentClass.toLowerCase().includes(q))
      );
    });
  }, [initialStudents, searchQuery, transcriptTierFilter]);

  // Trigger print layout
  const handlePrint = () => {
    window.print();
  };

  // 1-Click CSV / Spreadsheet Export
  const handleExportCsv = () => {
    if (!broadsheet || broadsheet.length === 0) return;

    const headers = [
      "POSITION",
      "Registration Number",
      "Student Full Name",
      "Current Class",
      "1st Term Avg (%)",
      "2nd Term Avg (%)",
      "3rd Term Avg (%)",
      "Annual Composite Avg (%)",
      "Annual Grade",
      "Attendance Rate (%)",
      "Promotion Status",
      "Next Class Destination",
    ];

    const rows = broadsheet.map((r) => [
      `"${r.positionString}"`,
      `"${r.admissionNumber}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.currentClass}"`,
      r.term1Average,
      r.term2Average,
      r.term3Average,
      r.annualAverage,
      `"${r.annualGrade}"`,
      `${r.attendanceRate}%`,
      `"${r.promotionStatus === "PROMOTED" ? "Promoted" : r.promotionStatus === "PROMOTED_ON_TRIAL" ? "Promoted on Trial" : "Repeat Grade"}"`,
      `"${r.isGraduation ? "Graduated / Alumni" : r.nextClass || `Repeats ${r.currentClass}`}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeSession = selectedSession.replace(/[^a-zA-Z0-9_-]/g, "-");
    const safeClass = selectedClass.replace(/[^a-zA-Z0-9_-]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `${schoolName}_Broadsheet_${safeClass}_${safeSession}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Open Subject Breakdown Modal
  const handleOpenSubjectInspector = async (studentId: string) => {
    setIsLoadingSubjectModal(true);
    try {
      const res = await fetchStudentSubjectBreakdown(schoolId || schoolDomain, studentId, selectedSession);
      if (res.success) {
        setInspectedStudent(res);
      }
    } catch (err) {
      console.error("Failed to inspect student subjects:", err);
    } finally {
      setIsLoadingSubjectModal(false);
    }
  };

  // Handle mass promotion execution
  const handleExecutePromotion = async () => {
    setIsPromoting(true);
    const repeatingIds = broadsheet
      .filter((r) => r.promotionStatus === "REPEAT")
      .map((r) => r.id);

    try {
      const res = await executeClassPromotionAction(schoolId || schoolDomain, {
        tierName: selectedTier,
        repeatingStudentIds: repeatingIds,
      });

      if (res.success) {
        setPromotionFeedback({
          message: `Sessional promotion processed successfully! ${res.promotedCount} student(s) advanced to their next grade, ${res.graduatedCount} graduated to Alumni, and ${res.repeatedCount} set to repeat.`,
          type: "success",
        });
        setShowPromotionModal(false);
      } else {
        setPromotionFeedback({
          message: res.error || "Failed to process sessional promotion.",
          type: "error",
        });
      }
    } catch (err: any) {
      setPromotionFeedback({
        message: err.message || "Failed to process promotion.",
        type: "error",
      });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Academic Performance & Certification</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Transcripts & Annual Broadsheet
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cumulative annual grade computation, promotion decisions, and official multi-year academic transcripts.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("broadsheet")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "broadsheet"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Annual Broadsheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transcripts")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "transcripts"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student Transcripts</span>
          </button>
        </div>
      </div>

      {/* 2. TAB 1: ANNUAL MASTER PROMOTION BROADSHEET */}
      {activeTab === "broadsheet" && (
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              
              {/* Session Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Academic Session
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="2026/2027">2026/2027 Session</option>
                  <option value="2025/2026">2025/2026 Session</option>
                  <option value="2024/2025">2024/2025 Session</option>
                </select>
              </div>

              {/* Tier Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Academic Tier
                </label>
                <select
                  value={selectedTier}
                  onChange={(e) => handleTierChange(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Secondary School">Secondary School</option>
                  <option value="Primary School">Primary School</option>
                  <option value="Creche / Nursery">Creche / Nursery</option>
                  <option value="University">University</option>
                  <option value="Polytechnic">Polytechnic</option>
                  <option value="College of Education">College of Education</option>
                </select>
              </div>

              {/* Class Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-help"
                    title="Cohort = Year group that started together at this school. Example: Cohort 2026 = all students admitted to this school in 2026. It stays the same even when they move to Primary 2, 3, etc."
                  >
                    Class Cohort
                  </label>
                  {isPending && (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <select
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  Cohort = Year group that started together
                </p>
              </div>

            </div>

            {/* Actions: Print, Export & Promotion */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-bold text-xs shadow-2xs transition cursor-pointer"
                title="Download formatted CSV spreadsheet for Ministry of Education & Academic Board"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-bold text-xs shadow-2xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Print Broadsheet</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPromotionModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-sm hover:shadow transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Process Promotion</span>
              </button>
            </div>
          </div>

          {/* Promotion Feedback Notification */}
          {promotionFeedback && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-300 ${
                promotionFeedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {promotionFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span className="font-semibold">{promotionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setPromotionFeedback(null)}
                className="underline font-bold ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 print:hidden">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                <Users className="w-4 h-4 text-slate-500" />
                <span
                  className="cursor-help"
                  title="Cohort = Year group that started together at this school. Example: Cohort 2026 = all students admitted to this school in 2026. It stays the same even when they move to Primary 2, 3, etc."
                >
                  Enrolled Cohort
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {stats.totalEnrolled}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {selectedClass} • {selectedSession}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Promoted</span>
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {stats.promotedCount}
              </div>
              <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                {stats.promotionRate}% Pass Rate
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Trial / Repeat</span>
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {stats.promotedOnTrialCount + stats.repeatedCount}
              </div>
              <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                {stats.repeatedCount} Repeating
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Class Mean</span>
              </div>
              <div className="text-2xl font-black text-blue-600 mt-1">
                {stats.classMeanScore}%
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Average Annual Total
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Top Performer</span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {stats.highestScore}%
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                1st Position Score
              </span>
            </div>
          </div>

          {/* Printable Broadsheet Header (Visible on print only) */}
          <div className="hidden print:block border-b-2 border-black pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">{schoolName}</h1>
                <p className="text-xs font-semibold uppercase">Official Annual Promotion Broadsheet</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">{selectedTier} • {selectedClass}</p>
                <p>{selectedSession} Academic Session</p>
                <p className="text-slate-500">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Master Broadsheet Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            
            {/* Quick Search */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 print:hidden">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or Reg No..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing {filteredBroadsheet.length} of {broadsheet.length} students
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 text-center">POSITION</th>
                    <th className="px-5 py-3.5">Student Profile</th>
                    <th className="px-4 py-3.5 text-center">1st Term</th>
                    <th className="px-4 py-3.5 text-center">2nd Term</th>
                    <th className="px-4 py-3.5 text-center">3rd Term</th>
                    <th className="px-5 py-3.5 text-center">Annual Avg</th>
                    <th className="px-4 py-3.5 text-center">Grade</th>
                    <th className="px-4 py-3.5 text-center">Attendance</th>
                    <th className="px-5 py-3.5">Promotion Decision</th>
                    <th className="px-5 py-3.5">Next Class</th>
                    <th className="px-5 py-3.5 text-right print:hidden">Official Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBroadsheet.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                        No student records match the selected cohort criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBroadsheet.map((student) => {
                      const isTop3 = student.rank <= 3;
                      const rankBadge =
                        student.rank === 1
                          ? "bg-amber-100 text-amber-900 border-amber-300 font-extrabold"
                          : student.rank === 2
                          ? "bg-slate-200 text-slate-800 border-slate-300 font-bold"
                          : student.rank === 3
                          ? "bg-orange-100 text-orange-900 border-orange-200 font-bold"
                          : "bg-slate-100 text-slate-600 border-slate-200";

                      return (
                        <tr
                          key={student.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Rank / Position */}
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-full text-xs border ${rankBadge}`}
                            >
                              {student.positionString}
                            </span>
                          </td>

                          {/* Student Name & Reg */}
                          <td className="px-5 py-3.5">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {student.name}
                              </span>
                              <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                                {student.admissionNumber}
                              </span>
                            </div>
                          </td>

                          {/* 1st Term */}
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {student.term1Average}%
                          </td>

                          {/* 2nd Term */}
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {student.term2Average}%
                          </td>

                          {/* 3rd Term */}
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {student.term3Average}%
                          </td>

                          {/* Annual Composite Score */}
                          <td className="px-5 py-3.5 text-center">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {student.annualAverage}%
                            </span>
                          </td>

                          {/* Annual Grade */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-block font-bold text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {student.annualGrade}
                            </span>
                          </td>

                          {/* Attendance */}
                          <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {student.attendanceRate}%
                          </td>

                          {/* Promotion Status */}
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${student.promotionBadgeClass}`}
                            >
                              {student.promotionStatus === "PROMOTED" && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              {student.promotionStatus === "PROMOTED_ON_TRIAL" && (
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                              )}
                              {student.promotionStatus === "REPEAT" && (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              <span>
                                {student.promotionStatus === "PROMOTED"
                                  ? "Promoted"
                                  : student.promotionStatus === "PROMOTED_ON_TRIAL"
                                  ? "Promoted (Trial)"
                                  : "Repeat Grade"}
                              </span>
                            </span>
                          </td>

                          {/* Next Grade Destination */}
                          <td className="px-5 py-3.5">
                            {student.isGraduation ? (
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                Graduated / Alumni
                              </span>
                            ) : student.nextClass ? (
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {student.currentClass} → <strong>{student.nextClass}</strong>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Repeats {student.currentClass}</span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="px-5 py-3.5 text-right print:hidden">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenSubjectInspector(student.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold transition cursor-pointer shadow-2xs"
                                title="Inspect Continuous Assessment & Subject Breakdown"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Subjects</span>
                              </button>

                              <Link
                                href={`/${schoolDomain}/transcripts/${student.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 text-xs font-bold transition shadow-2xs"
                              >
                                <span>Transcript</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Broadsheet Footer Summary */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  Promotion Threshold: Annual Average $\ge 50\%$ & Attendance $\ge 75\%$
                </span>
              </div>

              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Annual Broadsheet compiled using Nigerian Educational Assessment Standard
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 3. TAB 2: CUMULATIVE STUDENT TRANSCRIPTS DIRECTORY */}
      {activeTab === "transcripts" && (
        <div className="space-y-5">
          
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name, admission #, or class..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Tier Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {["ALL", "Secondary School", "Primary School", "Creche / Nursery"].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setTranscriptTierFilter(tier)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      transcriptTierFilter === tier
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tier === "ALL" ? "All Tiers" : tier}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium shrink-0">
              Total Student Records: {filteredTranscripts.length}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Registration Number</th>
                    <th className="px-6 py-4">Class Level</th>
                    <th className="px-6 py-4">Enrollment Status</th>
                    <th className="px-6 py-4 text-center">Cumulative Record</th>
                    <th className="px-6 py-4 text-right">Official Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTranscripts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No students found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredTranscripts.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        {/* Name */}
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {student.name}
                          </span>
                        </td>

                        {/* Admission No */}
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {student.admissionNumber || "—"}
                        </td>

                        {/* Class */}
                        <td className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {student.currentClass || "Unassigned"}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {student.status}
                          </span>
                        </td>

                        {/* Cumulative Record */}
                        <td className="px-6 py-4 text-center">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {student.cumulativeGPA ? `CGPA ${student.cumulativeGPA}` : "Available"}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/${schoolDomain}/transcripts/${student.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>View Official Transcript</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 4. Sessional Promotion Confirmation Modal */}
      {showPromotionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Execute Sessional Promotion
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedTier} • {selectedClass} • {selectedSession}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Evaluated:</span>
                <strong className="text-slate-800 dark:text-slate-200">{stats.totalEnrolled} students</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-600 font-semibold">Eligible to Advance:</span>
                <strong className="text-emerald-600">{stats.promotedCount + stats.promotedOnTrialCount} students</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-600 font-semibold">Retained to Repeat:</span>
                <strong className="text-rose-600">{stats.repeatedCount} students</strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Advancing promoted students will transition their active class slot to the next academic level (e.g. JSS 1 → JSS 2). Terminal cohorts (SS 3 / Year 6) will be archived to Alumni.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPromotionModal(false)}
                disabled={isPromoting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={isPromoting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                {isPromoting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Promotion...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Advance Cohort</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. Subject Performance Quick Inspector Modal */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {inspectedStudent.student?.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{inspectedStudent.student?.admissionNumber}</span>
                    <span>•</span>
                    <span>{inspectedStudent.student?.currentClass}</span>
                    <span>•</span>
                    <span className="font-bold text-blue-600">Annual Composite: {inspectedStudent.student?.overallAverage}% ({inspectedStudent.student?.overallGrade})</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-3.5 py-2.5">Code</th>
                    <th className="px-3.5 py-2.5">Subject</th>
                    <th className="px-3 py-2.5 text-center">CA1 (20)</th>
                    <th className="px-3 py-2.5 text-center">CA2 (20)</th>
                    <th className="px-3 py-2.5 text-center">Exam (60)</th>
                    <th className="px-3 py-2.5 text-center">1st Term</th>
                    <th className="px-3 py-2.5 text-center">2nd Term</th>
                    <th className="px-3 py-2.5 text-center">3rd Term</th>
                    <th className="px-3.5 py-2.5 text-center">Annual %</th>
                    <th className="px-3.5 py-2.5 text-center">Grade</th>
                    <th className="px-3.5 py-2.5 text-right">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inspectedStudent.subjects.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 font-semibold">{sub.code}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white">{sub.name}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300 font-mono">{sub.ca1}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300 font-mono">{sub.ca2}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300 font-mono">{sub.exam}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{sub.term1Total}%</td>
                      <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{sub.term2Total}%</td>
                      <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{sub.term3Total}%</td>
                      <td className="px-3.5 py-2.5 text-center font-extrabold text-slate-900 dark:text-white">{sub.annualAverage}%</td>
                      <td className="px-3.5 py-2.5 text-center font-bold text-blue-600 dark:text-blue-400">{sub.grade}</td>
                      <td className="px-3.5 py-2.5 text-right text-slate-600 dark:text-slate-400 italic">{sub.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Continuous Assessment weights: 40% Continuous Assessment (CA1 + CA2) + 60% Termly Exam</span>
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
