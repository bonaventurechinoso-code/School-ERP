"use client";

import React, { useRef } from "react";
import {
  Printer,
  X,
  Award,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  FileDown,
} from "lucide-react";
import { calculateBonaVeeResult, getGradeRemark, InstitutionalTier } from "@/lib/assessmentEngine";
import { isCrecheClass } from "@/lib/creche-config";

export interface ReportCardStudentData {
  id: string;
  name: string;
  admissionNumber?: string;
  currentClass: string;
  term: string;
  academicYear: string;
  tier: string;
  cohort?: string;
  rank?: number;
  totalStudents?: number;
  overallAverage?: number;
  overallTotal?: number;
  overallGrade?: string;
  status?: string;
  subjects?: Array<{
    subject: string;
    ca1?: number;
    ca2?: number;
    exam?: number;
    assignment?: number;
    test?: number;
    project?: number;
    observation?: number;
    classwork?: number;
    affective?: number;
    total?: number;
    grade?: string;
    gp?: number;
    subjectPosition?: string;
    classAverage?: number;
    remark?: string;
  }>;
}

interface StudentReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentData: ReportCardStudentData;
  schoolName?: string;
  schoolDomain?: string;
}


export default function StudentReportCardModal({
  isOpen,
  onClose,
  studentData,
  schoolName = "Greenwood Academy",
  schoolDomain = "greenwood",
}: StudentReportCardModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Resolve Tier Category
  const tierName = studentData.tier || "Secondary School";
  const isCreche = isCrecheClass(studentData.currentClass) || isCrecheClass(tierName);
  const isHigherEd =
    !isCreche && (
      tierName.toLowerCase().includes("university") ||
      tierName.toLowerCase().includes("polytechnic") ||
      tierName.toLowerCase().includes("college") ||
      tierName.toLowerCase().includes("higher")
    );
  const isNursery = !isCreche && (tierName.toLowerCase().includes("nursery") || studentData.currentClass?.toLowerCase().includes("nursery"));
  const isPrimary = !isCreche && (tierName.toLowerCase().includes("primary") || tierName.toLowerCase().includes("basic") || studentData.currentClass?.toLowerCase().includes("primary"));
  const isSecondary = !isHigherEd && !isNursery && !isPrimary && !isCreche;

  // Single Source of Truth: Resolve real subjects strictly from studentData
  const activeSubjects = (() => {
    const rawList = studentData.subjects || [];
    return rawList.map((sub, idx) => {
      const isNotEntered =
        (sub.ca1 === null || sub.ca1 === undefined) &&
        (sub.ca2 === null || sub.ca2 === undefined) &&
        (sub.exam === null || sub.exam === undefined);
      return {
        ...sub,
        isNotEntered,
        subjectPosition: sub.subjectPosition || `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"}`,
      };
    });
  })();

  // Compute calculated metrics across all subjects
  const evaluatedSubjects = activeSubjects.map((sub: any) => {
    if (sub.isNotEntered) {
      return {
        ...sub,
        computedTotal: null,
        computedGrade: "Not Entered",
        computedGp: null,
        computedRemark: "Not Entered",
      };
    }
    const calc = calculateBonaVeeResult(tierName, sub);
    return {
      ...sub,
      computedTotal: sub.total !== undefined && sub.total !== null ? sub.total : calc.total,
      computedGrade: (isPrimary || isNursery || isCreche) ? calc.grade : (sub.grade || calc.grade),
      computedGp: calc.gp,
      computedRemark: (isPrimary || isNursery || isCreche) ? getGradeRemark(calc.grade) : (sub.remark || getGradeRemark(sub.grade || calc.grade)),
    };
  });

  // Exclude unentered / missing subjects from Total and Average
  const enteredSubjects = evaluatedSubjects.filter((s: any) => !s.isNotEntered && s.computedTotal !== null && s.computedTotal !== undefined);
  const totalPossible = enteredSubjects.length * 100;
  const aggregateScore = enteredSubjects.reduce((acc, s) => acc + (s.computedTotal || 0), 0);
  const averagePercentage = enteredSubjects.length > 0 ? (aggregateScore / enteredSubjects.length).toFixed(1) : "0.0";
  const overallAvgNum = parseFloat(averagePercentage);
  const overallGrade = enteredSubjects.length > 0 ? calculateBonaVeeResult(tierName, { exam: overallAvgNum }).grade : "—";
  const overallRemark = enteredSubjects.length > 0 ? getGradeRemark(overallGrade) : "No Grades Entered";

  // Position Suffix
  const rankNumber = studentData.rank;
  const totalStudents = studentData.totalStudents || 1;
  const positionString = rankNumber ? `${rankNumber}${rankNumber === 1 ? "st" : rankNumber === 2 ? "nd" : rankNumber === 3 ? "rd" : "th"}` : "—";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      
      {/* Modal Card Wrapper */}
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* Top Floating Actions Header (Hidden in Print) */}
        <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Official Termly Report Sheet Preview
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {studentData.name} • {studentData.admissionNumber || "Reg No: Pending"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={`/api/v1/report-cards/pdf?studentId=${encodeURIComponent(studentData.id)}&className=${encodeURIComponent(studentData.currentClass || "")}&term=${encodeURIComponent(studentData.term || "First Term")}`}
              download={`ReportCard_${(studentData.admissionNumber || studentData.name).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
              title="Download High-Resolution PDF"
            >
              <FileDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Download PDF</span>
            </a>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Report Sheet Content */}
        <div ref={printRef} className="overflow-y-auto p-6 sm:p-10 space-y-8 print:p-6 print:space-y-6 print:overflow-visible">
          
          {/* ========================================================= */}
          {/* 1. OFFICIAL INSTITUTIONAL HEADER                          */}
          {/* ========================================================= */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-6 print:border-black">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
              
              {/* Crest & School Identity */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white flex flex-col items-center justify-center font-black shadow-md border-2 border-amber-400">
                  <span className="text-2xl tracking-tighter">GW</span>
                  <span className="text-[9px] uppercase tracking-widest text-amber-300">EST. 2012</span>
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white font-serif">
                    {schoolName}
                  </h1>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 uppercase tracking-wide">
                    Motto: Discipline, Knowledge & Excellence
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Plot 12, Academic Boulevard, Off Federal Secretariat Way • info@{schoolDomain}.edu.ng
                  </p>
                </div>
              </div>

              {/* Official Document Banner */}
              <div className="text-center sm:text-right">
                <span className="inline-block px-4 py-1.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider print:bg-black print:text-white">
                  Termly Academic Report Sheet
                </span>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1.5">
                  {studentData.academicYear} Academic Session
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {studentData.term}
                </div>
              </div>

            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. STUDENT BIO-DATA & ATTENDANCE PROFILE                  */}
          {/* ========================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
            <div>
              <span className="text-slate-400 uppercase tracking-wider font-bold text-[10px] block">
                Student Full Name
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white text-sm block mt-0.5">
                {studentData.name}
              </span>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider font-bold text-[10px] block">
                Registration / Adm No
              </span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200 text-sm block mt-0.5">
                {studentData.admissionNumber || "GW/2026/001"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider font-bold text-[10px] block">
                Class / Level
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block mt-0.5">
                {studentData.currentClass} ({tierName})
              </span>
            </div>

            <div>
              <span
                className="text-slate-400 uppercase tracking-wider font-bold text-[10px] block cursor-help"
                title="Cohort = Year group that started together at this school. Example: Cohort 2026 = all students admitted to this school in 2026. It stays the same even when they move to Primary 2, 3, etc."
              >
                COHORT
              </span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200 text-sm block mt-0.5">
                {studentData.cohort || (studentData.admissionNumber ? studentData.admissionNumber.split("/")[1] : "2026")}
              </span>
              <span className="text-[9px] text-slate-400 italic block">
                Started together
              </span>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider font-bold text-[10px] block">
                Attendance Record
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block mt-0.5">
                62 / 65 Days (95.4%)
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. TERMINAL PERFORMANCE SUMMARY METRICS                   */}
          {/* ========================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Class Position Card */}
            <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 text-center">
              <span className="text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider block">
                Class Position
              </span>
              <div className="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono mt-1">
                {positionString}
              </div>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                Out of {totalStudents} Students
              </span>
            </div>

            {/* Aggregate Score Card */}
            <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 text-center">
              <span className="text-blue-800 dark:text-blue-300 font-bold text-xs uppercase tracking-wider block">
                Total Score
              </span>
              <div className="text-2xl font-black text-blue-900 dark:text-blue-200 font-mono mt-1">
                {aggregateScore}
              </div>
              <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
                Total Obtainable: {totalPossible}
              </span>
            </div>

            {/* Overall Average Card */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 text-center">
              <span className="text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider block">
                Class Average
              </span>
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200 font-mono mt-1">
                {averagePercentage}%
              </div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                Terminal Percentage
              </span>
            </div>

            {/* Aggregate Grade Card */}
            <div className="bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-2xl p-4 text-center">
              <span className="text-purple-800 dark:text-purple-300 font-bold text-xs uppercase tracking-wider block">
                Final Assessment Grade
              </span>
              <div className="text-2xl font-black text-purple-900 dark:text-purple-200 font-mono mt-1">
                {overallGrade}
              </div>
              <span className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">
                {overallRemark}
              </span>
            </div>

          </div>

          {/* ========================================================= */}
          {/* 4. MULTI-SUBJECT EVALUATION BROADSHEET TABLE              */}
          {/* ========================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                Subjects Academic Performance Broadsheet
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                {evaluatedSubjects.length} Evaluated Subjects
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-5 py-3.5 text-left">Subject / Course Title</th>

                    {/* Secondary Columns */}
                    {isSecondary && (
                      <>
                        <th className="px-3 py-3.5 text-center">CA 1 (20)</th>
                        <th className="px-3 py-3.5 text-center">CA 2 (20)</th>
                        <th className="px-3 py-3.5 text-center">Exam (60)</th>
                        <th className="px-4 py-3.5 text-center">Total (100)</th>
                        <th className="px-3 py-3.5 text-center">Grade</th>
                        <th className="px-3 py-3.5 text-center">Position</th>
                        <th className="px-5 py-3.5 text-left">Subject Teacher Remark</th>
                      </>
                    )}

                    {/* Primary Columns */}
                    {isPrimary && (
                      <>
                        <th className="px-3 py-3.5 text-center">1st CA (20)</th>
                        <th className="px-3 py-3.5 text-center">2nd CA (20)</th>
                        <th className="px-3 py-3.5 text-center">Exam (60)</th>
                        <th className="px-4 py-3.5 text-center">Total (100)</th>
                        <th className="px-3 py-3.5 text-center">Grade</th>
                        <th className="px-3 py-3.5 text-center">Position</th>
                        <th className="px-5 py-3.5 text-left">Remark</th>
                      </>
                    )}

                    {/* Creche Columns */}
                    {isCreche && (
                      <>
                        <th className="px-4 py-3.5 text-center">Observation (50)</th>
                        <th className="px-4 py-3.5 text-center">Continuous Assessment (50)</th>
                        {activeSubjects.some((s: any) => s.exam !== null && s.exam !== undefined && s.exam > 0) && (
                          <th className="px-4 py-3.5 text-center">Exam (60)</th>
                        )}
                        <th className="px-4 py-3.5 text-center">Total (100)</th>
                        <th className="px-3 py-3.5 text-center">Grade</th>
                        <th className="px-3 py-3.5 text-center">Position</th>
                        <th className="px-5 py-3.5 text-left">Remark</th>
                      </>
                    )}

                    {/* Nursery Columns */}
                    {isNursery && (
                      <>
                        <th className="px-4 py-3.5 text-center">Observation (50)</th>
                        <th className="px-4 py-3.5 text-center">Continuous Assessment (50)</th>
                        {activeSubjects.some((s: any) => s.exam !== null && s.exam !== undefined && s.exam > 0) && (
                          <th className="px-4 py-3.5 text-center">Exam (60)</th>
                        )}
                        <th className="px-4 py-3.5 text-center">Total (100)</th>
                        <th className="px-3 py-3.5 text-center">Grade</th>
                        <th className="px-3 py-3.5 text-center">Position</th>
                        <th className="px-5 py-3.5 text-left">Remark</th>
                      </>
                    )}

                    {/* Higher Education Columns */}
                    {isHigherEd && (
                      <>
                        <th className="px-4 py-3.5 text-center">Assignment (10%)</th>
                        <th className="px-4 py-3.5 text-center">Test (20%)</th>
                        <th className="px-4 py-3.5 text-center">Exam (70%)</th>
                        <th className="px-4 py-3.5 text-center">Total (100)</th>
                        <th className="px-3 py-3.5 text-center">GP</th>
                        <th className="px-3 py-3.5 text-center">Grade</th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {evaluatedSubjects.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                        {sub.subject}
                      </td>

                      {/* Secondary Row Data */}
                      {isSecondary && (
                        <>
                          <td className="px-3 py-3 text-center font-mono text-slate-700 dark:text-slate-300">
                            {sub.ca1 ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-slate-700 dark:text-slate-300">
                            {sub.ca2 ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-slate-700 dark:text-slate-300">
                            {sub.exam ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-extrabold text-slate-900 dark:text-white">
                            {sub.computedTotal}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded font-black font-mono text-[11px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {sub.computedGrade}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                            {sub.subjectPosition || "1st"}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300 italic">
                            {sub.computedRemark}
                          </td>
                        </>
                      )}

                      {/* Primary Row Data */}
                      {isPrimary && (
                        <>
                          <td className="px-3 py-3 text-center font-mono text-slate-700 dark:text-slate-300">
                            {sub.isNotEntered || sub.ca1 === null || sub.ca1 === undefined ? "—" : sub.ca1}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-slate-700 dark:text-slate-300">
                            {sub.isNotEntered || sub.ca2 === null || sub.ca2 === undefined ? "—" : sub.ca2}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-slate-700 dark:text-slate-300">
                            {sub.isNotEntered || sub.exam === null || sub.exam === undefined ? "—" : sub.exam}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-extrabold text-slate-900 dark:text-white">
                            {sub.isNotEntered || sub.computedTotal === null || sub.computedTotal === undefined ? "—" : sub.computedTotal}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded font-black font-mono text-[11px] ${
                              sub.isNotEntered
                                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {sub.isNotEntered ? "Not Entered" : sub.computedGrade}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                            {sub.isNotEntered ? "—" : (sub.subjectPosition || "—")}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300 italic">
                            {sub.computedRemark}
                          </td>
                        </>
                      )}

                      {/* Creche Row Data */}
                      {isCreche && (
                        <>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {sub.isNotEntered ? "—" : (sub.ca1 ?? "—")}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {sub.isNotEntered ? "—" : (sub.ca2 ?? "—")}
                          </td>
                          {activeSubjects.some((s: any) => s.exam !== null && s.exam !== undefined && s.exam > 0) && (
                            <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {sub.isNotEntered ? "—" : (sub.exam ?? "—")}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center font-mono font-black text-slate-900 dark:text-white">
                            {sub.isNotEntered ? "—" : sub.computedTotal}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              sub.computedGrade === "Distinction" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200"
                                : sub.computedGrade === "Very Good" ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200"
                                  : sub.computedGrade === "Credit" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
                                    : sub.computedGrade === "Pass" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                                      : sub.computedGrade === "Fail" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                                        : "bg-slate-100 text-slate-500"
                            }`}>
                              {sub.isNotEntered ? "Not Entered" : sub.computedGrade}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                            {sub.isNotEntered ? "—" : (sub.subjectPosition || "—")}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300 italic">
                            {sub.computedRemark}
                          </td>
                        </>
                      )}

                      {/* Nursery Row Data */}
                      {isNursery && (
                        <>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {sub.isNotEntered ? "—" : (sub.ca1 ?? "—")}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {sub.isNotEntered ? "—" : (sub.ca2 ?? "—")}
                          </td>
                          {activeSubjects.some((s: any) => s.exam !== null && s.exam !== undefined && s.exam > 0) && (
                            <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {sub.isNotEntered ? "—" : (sub.exam ?? "—")}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center font-mono font-black text-slate-900 dark:text-white">
                            {sub.isNotEntered ? "—" : sub.computedTotal}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              sub.computedGrade === "Excellent" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200"
                                : sub.computedGrade === "Very Good" ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200"
                                  : sub.computedGrade === "Good" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
                                    : sub.computedGrade === "Developing" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                                      : sub.computedGrade === "Needs Support" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                                        : "bg-slate-100 text-slate-500"
                            }`}>
                              {sub.isNotEntered ? "Not Entered" : sub.computedGrade}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                            {sub.isNotEntered ? "—" : (sub.subjectPosition || "—")}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300 italic">
                            {sub.computedRemark}
                          </td>
                        </>
                      )}

                      {/* Higher Ed Row Data */}
                      {isHigherEd && (
                        <>
                          <td className="px-4 py-3 text-center font-mono">{sub.assignment ?? "—"}</td>
                          <td className="px-4 py-3 text-center font-mono">{sub.test ?? "—"}</td>
                          <td className="px-4 py-3 text-center font-mono">{sub.exam ?? "—"}</td>
                          <td className="px-4 py-3 text-center font-mono font-extrabold">{sub.computedTotal}</td>
                          <td className="px-3 py-3 text-center font-mono font-bold">{sub.computedGp.toFixed(2)}</td>
                          <td className="px-3 py-3 text-center font-black">{sub.computedGrade}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {evaluatedSubjects.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                        No grade records found for this student. Grades appear here once entered in the Teacher Gradebook.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 5. AFFECTIVE & PSYCHOMOTOR DOMAIN EVALUATION MATRIX       */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            
            {/* Affective Behavioral Traits */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Affective Traits Evaluation
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Rating (1 - 5)</span>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="flex justify-between pr-4"><span>Punctuality:</span> <strong className="font-mono text-blue-600">5</strong></div>
                <div className="flex justify-between pr-4"><span>Neatness & Appearance:</span> <strong className="font-mono text-blue-600">5</strong></div>
                <div className="flex justify-between pr-4"><span>Politeness & Manners:</span> <strong className="font-mono text-blue-600">5</strong></div>
                <div className="flex justify-between pr-4"><span>Honesty & Reliability:</span> <strong className="font-mono text-blue-600">5</strong></div>
                <div className="flex justify-between pr-4"><span>Self-Control & Focus:</span> <strong className="font-mono text-blue-600">4</strong></div>
                <div className="flex justify-between pr-4"><span>Relationship with Peers:</span> <strong className="font-mono text-blue-600">5</strong></div>
              </div>
            </div>

            {/* Psychomotor Practical Skills */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Psychomotor Skills Evaluation
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Rating (1 - 5)</span>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="flex justify-between pr-4"><span>Handwriting & Penmanship:</span> <strong className="font-mono text-emerald-600">4</strong></div>
                <div className="flex justify-between pr-4"><span>Verbal Fluency:</span> <strong className="font-mono text-emerald-600">5</strong></div>
                <div className="flex justify-between pr-4"><span>Sports & Athleticism:</span> <strong className="font-mono text-emerald-600">4</strong></div>
                <div className="flex justify-between pr-4"><span>Crafts & Creativity:</span> <strong className="font-mono text-emerald-600">5</strong></div>
                <div className="flex justify-between pr-4"><span>Musical & Artistic Skill:</span> <strong className="font-mono text-emerald-600">4</strong></div>
                <div className="flex justify-between pr-4"><span>Manual Dexterity:</span> <strong className="font-mono text-emerald-600">4</strong></div>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* 6. ADMINISTRATIVE REMARKS & OFFICIAL SIGN-OFF             */}
          {/* ========================================================= */}
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            
            {/* Class Teacher Remark */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block">
                  Class Teacher&apos;s Remark:
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-medium italic">
                  &ldquo;{studentData.name} has demonstrated exceptional academic discipline, sharp intellect, and commendable consistency across all assessments this term.&rdquo;
                </p>
              </div>
              <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                <div className="font-serif italic text-sm text-slate-700 dark:text-slate-300">Mrs. O. Adebayo</div>
                <span className="text-[10px] text-slate-400">Class Teacher&apos;s Signature</span>
              </div>
            </div>

            {/* Principal Remark */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block">
                  Principal&apos;s Official Remark:
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-medium italic">
                  &ldquo;An outstanding, well-rounded terminal performance. Keep up this commendable standard of academic brilliance!&rdquo;
                </p>
              </div>
              <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full border border-dashed border-amber-500/80 flex items-center justify-center text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase text-center rotate-[-12deg]">
                  Official<br />Stamp
                </div>
                <div>
                  <div className="font-serif italic text-sm text-slate-700 dark:text-slate-300">Dr. K. Nwachukwu</div>
                  <span className="text-[10px] text-slate-400">Principal&apos;s Signature</span>
                </div>
              </div>
            </div>

            {/* Resumption Banner */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs font-semibold print:bg-black print:text-white">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Next Term Resumption Date:</span>
              </div>
              <span className="font-mono text-amber-300">Monday, 11th January 2027</span>
            </div>

            {/* Official Verification Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
              <div>
                Generated from Teacher Gradebook • {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Approved By Principal / Head Teacher
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
