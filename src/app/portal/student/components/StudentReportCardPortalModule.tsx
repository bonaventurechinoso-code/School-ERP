"use client";

import React, { useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  GraduationCap,
  Printer,
  ShieldCheck,
  Sparkles,
  User,
  Clock,
  TrendingUp,
  FileText,
  FileDown,
} from "lucide-react";
import { StudentProfileData, TierPresentationConfig } from "../types";
import { calculateBonaVeeResult, getGradeRemark } from "@/lib/assessmentEngine";

interface StudentReportCardPortalModuleProps {
  student: StudentProfileData;
  tierConfig: TierPresentationConfig;
  schoolName: string;
  subdomain: string;
}

// Fallback comprehensive multi-subject terminal broadsheets by tier
const DEFAULT_SECONDARY_SUBJECTS = [
  { subject: "Mathematics", ca1: 18, ca2: 17, exam: 54, subjectPosition: "1st", classAverage: 68, remark: "Brilliant mathematical aptitude and precision." },
  { subject: "English Language", ca1: 16, ca2: 18, exam: 50, subjectPosition: "2nd", classAverage: 65, remark: "Eloquent vocabulary and strong comprehension skills." },
  { subject: "Physics", ca1: 17, ca2: 16, exam: 52, subjectPosition: "1st", classAverage: 66, remark: "Outstanding grasp of physical principles and formulas." },
  { subject: "Chemistry", ca1: 15, ca2: 16, exam: 48, subjectPosition: "3rd", classAverage: 64, remark: "Good grasp of chemical reactions and laboratory practicals." },
  { subject: "Biology", ca1: 17, ca2: 17, exam: 53, subjectPosition: "1st", classAverage: 69, remark: "Thorough understanding of biological systems and taxonomy." },
  { subject: "Digital Technologies / ICT", ca1: 19, ca2: 18, exam: 56, subjectPosition: "1st", classAverage: 72, remark: "Exceptional computing and logical problem solving." },
  { subject: "Civic Education", ca1: 16, ca2: 17, exam: 51, subjectPosition: "2nd", classAverage: 67, remark: "Displays high ethical standards and civic awareness." },
  { subject: "Technical Drawing", ca1: 18, ca2: 17, exam: 55, subjectPosition: "1st", classAverage: 70, remark: "Impeccable draughtsmanship and spatial perception." },
];

const DEFAULT_PRIMARY_SUBJECTS = [
  { subject: "Mathematics", assignment: 10, test: 19, project: 9, exam: 54, remark: "Excellent calculation speed and accuracy." },
  { subject: "English Studies", assignment: 9, test: 18, project: 9, exam: 50, remark: "Expressive reading and creative writing." },
  { subject: "Basic Science & Technology", assignment: 9, test: 17, project: 8, exam: 48, remark: "Curious and attentive during practicals." },
  { subject: "Basic Digital Literacy / ICT", assignment: 10, test: 19, project: 10, exam: 56, remark: "Sharp digital literacy and enthusiasm." },
  { subject: "National Values Education", assignment: 9, test: 18, project: 9, exam: 51, remark: "Well behaved with good leadership qualities." },
  { subject: "Cultural & Creative Arts", assignment: 8, test: 17, project: 8, exam: 46, remark: "Very imaginative and cooperative." },
];

const DEFAULT_NURSERY_SUBJECTS = [
  { subject: "Numeracy / Cognitive Skills", observation: 92, classwork: 88, affective: 95, remark: "Rapid number recognition and sorting." },
  { subject: "Literacy / Phonics", observation: 88, classwork: 85, affective: 90, remark: "Clear phonetic sounds and letter tracing." },
  { subject: "Rhymes & Poetry", observation: 95, classwork: 90, affective: 95, remark: "Enthusiastic and expressive recitation." },
  { subject: "Social Norms / Habits", observation: 90, classwork: 85, affective: 90, remark: "Polite, friendly, and shares readily with peers." },
  { subject: "Sensory Play / Creative Arts", observation: 85, classwork: 85, affective: 90, remark: "Good fine motor skills and vibrant color sense." },
];

const DEFAULT_TERTIARY_COURSES = [
  { subject: "GST 111 - Use of English & Library Skills", units: 2, assignment: 9, test: 18, exam: 62, remark: "Distinction in linguistic expression." },
  { subject: "MTH 111 - Logic and Linear Algebra", units: 3, assignment: 10, test: 19, exam: 65, remark: "Mastery of mathematical proofs." },
  { subject: "COS 101 - Introduction to Computer Science", units: 3, assignment: 9, test: 18, exam: 64, remark: "Solid computational thinking." },
  { subject: "PHY 111 - General Physics I (Mechanics)", units: 3, assignment: 8, test: 16, exam: 54, remark: "Clear analytical discourse." },
  { subject: "CHM 111 - General Chemistry I", units: 3, assignment: 9, test: 17, exam: 58, remark: "Strong laboratory comprehension." },
];

export function StudentReportCardPortalModule({
  student,
  tierConfig,
  schoolName,
  subdomain,
}: StudentReportCardPortalModuleProps) {
  const [selectedSession, setSelectedSession] = useState<string>("2026/2027");
  const [selectedTerm, setSelectedTerm] = useState<string>("First Term");

  const category = tierConfig.category;
  const isHigherEd = category === "HIGHER_ED";
  const isSecondary = category === "SECONDARY";
  const isEarlyChildhood = category === "EARLY_CHILDHOOD";
  const tierName = tierConfig.tierName;

  // Resolve subjects/courses: merge existing student assessments if available with standard tier subjects
  const subjectsList = (() => {
    if (isEarlyChildhood) return DEFAULT_NURSERY_SUBJECTS;
    if (isHigherEd) return DEFAULT_TERTIARY_COURSES;
    if (category === "SECONDARY") {
      const studentCAs = student.academicRank?.continuousAssessments;
      if (studentCAs && studentCAs.length >= 3) {
        return studentCAs.map((ca, idx) => ({
          subject: ca.subject,
          ca1: ca.ca1,
          ca2: ca.ca2,
          exam: ca.exam,
          subjectPosition: idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}th`,
          classAverage: 68,
          remark: ca.total >= 85 ? "Distinction in subject concepts" : "Credit pass",
        }));
      }
      return DEFAULT_SECONDARY_SUBJECTS;
    }
    return DEFAULT_PRIMARY_SUBJECTS;
  })();

  // Compute calculated metrics
  const evaluatedSubjects = subjectsList.map((sub: any) => {
    const calc = calculateBonaVeeResult(tierName, sub);
    return {
      ...sub,
      computedTotal: calc.total,
      computedGrade: calc.grade,
      computedGp: calc.gp,
      computedRemark: sub.remark || getGradeRemark(calc.grade),
    };
  });

  const totalPossible = evaluatedSubjects.length * 100;
  const aggregateScore = evaluatedSubjects.reduce((acc, s) => acc + s.computedTotal, 0);
  const averagePercentage =
    evaluatedSubjects.length > 0 ? (aggregateScore / evaluatedSubjects.length).toFixed(1) : "0.0";
  const overallAvgNum = parseFloat(averagePercentage);
  const overallGrade = calculateBonaVeeResult(tierName, { exam: overallAvgNum }).grade;
  const overallRemark = getGradeRemark(overallGrade);

  const positionDisplay = student.academicRank?.classPosition || "1st of 28";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Portal Controls Bar (Hidden on Print) */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Session Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">
              Academic Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="2026/2027">2026/2027 Session</option>
              <option value="2025/2026">2025/2026 Session</option>
            </select>
          </div>

          {/* Term Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">
              Academic Term
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="First Term">1st Term (Harmattan / Michaelmas)</option>
              <option value="Second Term">2nd Term (Lent / Winter)</option>
              <option value="Third Term">3rd Term (Trinity / Summer)</option>
            </select>
          </div>

        </div>

        {/* Action Buttons: Direct PDF Download & Print */}
        <div className="flex items-center gap-2.5">
          <a
            href={`/api/v1/report-cards/pdf?studentId=${encodeURIComponent(student.id)}&className=${encodeURIComponent(student.currentClass)}&term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}`}
            download={`ReportCard_${student.admissionNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}_${selectedTerm.replace(/\s+/g, "_")}.pdf`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 font-bold text-xs shadow-2xs transition cursor-pointer"
            title="Download Official High-Resolution PDF"
          >
            <FileDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Download PDF</span>
          </a>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-sm hover:shadow transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* 2. Official Printable Report Card Sheet */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-xl p-6 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-6 print:rounded-none print:space-y-6">
        
        {/* ========================================================= */}
        {/* A. OFFICIAL INSTITUTIONAL CREST & HEADER                  */}
        {/* ========================================================= */}
        <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-6 print:border-black">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            
            {/* Crest Emblem & School Identity */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-700 to-slate-900 text-white flex flex-col items-center justify-center font-black shadow-md border-2 border-amber-400 shrink-0">
                <span className="text-2xl tracking-tighter">GW</span>
                <span className="text-[9px] uppercase tracking-widest text-amber-300">EST. 2012</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white font-serif">
                  {schoolName}
                </h1>
                <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mt-0.5 uppercase tracking-wide">
                  Motto: Discipline, Knowledge & Excellence
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Plot 12, Academic Boulevard, Off Federal Secretariat Way • info@{subdomain}.edu.ng
                </p>
              </div>
            </div>

            {/* Official Report Title Block */}
            <div className="text-center sm:text-right shrink-0">
              <span className="inline-block px-4 py-1.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider print:bg-black print:text-white">
                Termly Academic Report Sheet
              </span>
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mt-2">
                {selectedSession} Academic Session
              </div>
              <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {selectedTerm}
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================= */}
        {/* B. STUDENT BIO-DATA & ATTENDANCE PROFILE                  */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-xs">
          <div>
            <span className="text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-bold text-[10px] block">
              Student Full Name
            </span>
            <span className="font-extrabold text-slate-900 dark:text-white text-sm block mt-0.5">
              {student.fullName}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-bold text-[10px] block">
              Admission / Reg No
            </span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm block mt-0.5">
              {student.admissionNumber}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-bold text-[10px] block">
              Current Class
            </span>
            <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm block mt-0.5">
              {student.currentClass}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-bold text-[10px] block">
              Attendance Record
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm block mt-0.5">
              96.4% (52 / 54 Days Present)
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* C. PERFORMANCE SUMMARY METRICS CARDS                      */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Class Position */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
              Class Position
            </span>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {positionDisplay}
            </div>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
              Top Ranked Scholar
            </span>
          </div>

          {/* Aggregate Total */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
              Total Marks Obtained
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {aggregateScore} <span className="text-xs font-normal text-slate-400">/ {totalPossible}</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Across {evaluatedSubjects.length} subjects
            </span>
          </div>

          {/* Terminal Average */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
              Terminal Average
            </span>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {averagePercentage}%
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block mt-0.5">
              Class Target: 70%+
            </span>
          </div>

          {/* Overall Letter Grade */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
              Overall Grade
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {overallGrade}
            </div>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
              {overallRemark}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* D. MULTI-SUBJECT COMPOSITE EVALUATION BROADSHEET          */}
        {/* ========================================================= */}
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
          
          <div className="bg-slate-50 dark:bg-zinc-800/80 px-5 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Continuous Assessment & Examination Broadsheet
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
              Tier: {tierName}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/50 dark:bg-zinc-800/40 border-b border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3">Subject Curriculum</th>
                  {isSecondary && (
                    <>
                      <th className="px-4 py-3 text-center">CA 1 (20)</th>
                      <th className="px-4 py-3 text-center">CA 2 (20)</th>
                      <th className="px-4 py-3 text-center">Exam (60)</th>
                      <th className="px-4 py-3 text-center">Total (100)</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                      <th className="px-4 py-3 text-center">Position</th>
                    </>
                  )}
                  {isEarlyChildhood && (
                    <>
                      <th className="px-4 py-3 text-center">Observation (40%)</th>
                      <th className="px-4 py-3 text-center">Classwork (40%)</th>
                      <th className="px-4 py-3 text-center">Affective (20%)</th>
                      <th className="px-4 py-3 text-center">Total (100)</th>
                      <th className="px-4 py-3 text-center">Rating</th>
                    </>
                  )}
                  {isHigherEd && (
                    <>
                      <th className="px-4 py-3 text-center">Units</th>
                      <th className="px-4 py-3 text-center">Assignment (10%)</th>
                      <th className="px-4 py-3 text-center">Test (20%)</th>
                      <th className="px-4 py-3 text-center">Exam (70%)</th>
                      <th className="px-4 py-3 text-center">Total (100)</th>
                      <th className="px-4 py-3 text-center">GP</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                    </>
                  )}
                  {!isSecondary && !isEarlyChildhood && !isHigherEd && (
                    <>
                      <th className="px-4 py-3 text-center">Assignment (10)</th>
                      <th className="px-4 py-3 text-center">Test (20)</th>
                      <th className="px-4 py-3 text-center">Project (10)</th>
                      <th className="px-4 py-3 text-center">Exam (60)</th>
                      <th className="px-4 py-3 text-center">Total (100)</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                    </>
                  )}
                  <th className="px-5 py-3 text-right">Teacher Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {evaluatedSubjects.map((sub: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">
                      {sub.subject}
                    </td>

                    {isSecondary && (
                      <>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.ca1}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.ca2}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.exam}
                        </td>
                        <td className="px-4 py-3 text-center font-black font-mono text-slate-900 dark:text-white">
                          {sub.computedTotal}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded font-black text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                            {sub.computedGrade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-500 dark:text-zinc-400">
                          {sub.subjectPosition || "—"}
                        </td>
                      </>
                    )}

                    {isEarlyChildhood && (
                      <>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.observation}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.classwork}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.affective}
                        </td>
                        <td className="px-4 py-3 text-center font-black font-mono text-slate-900 dark:text-white">
                          {sub.computedTotal}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded font-black text-xs bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                            {sub.computedGrade}
                          </span>
                        </td>
                      </>
                    )}

                    {isHigherEd && (
                      <>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">
                          {sub.units || 3}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.assignment}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.test}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.exam}
                        </td>
                        <td className="px-4 py-3 text-center font-black font-mono text-slate-900 dark:text-white">
                          {sub.computedTotal}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                          {sub.computedGp?.toFixed(1) || "5.0"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded font-black text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            {sub.computedGrade}
                          </span>
                        </td>
                      </>
                    )}

                    {!isSecondary && !isEarlyChildhood && !isHigherEd && (
                      <>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.assignment}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.test}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.project}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {sub.exam}
                        </td>
                        <td className="px-4 py-3 text-center font-black font-mono text-slate-900 dark:text-white">
                          {sub.computedTotal}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded font-black text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            {sub.computedGrade}
                          </span>
                        </td>
                      </>
                    )}

                    <td className="px-5 py-3 text-right italic text-slate-600 dark:text-zinc-400">
                      {sub.computedRemark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* ========================================================= */}
        {/* E. AFFECTIVE & PSYCHOMOTOR 5-POINT RATING MATRIX          */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          
          {/* Affective Behavioral Traits */}
          <div className="border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4.5 space-y-3 bg-slate-50/50 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-700 pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Affective Domain Evaluation
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Scale (1 - 5)</span>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="flex justify-between pr-4"><span>Punctuality:</span> <strong className="font-mono text-indigo-600 dark:text-indigo-400">5</strong></div>
              <div className="flex justify-between pr-4"><span>Neatness & Decorum:</span> <strong className="font-mono text-indigo-600 dark:text-indigo-400">5</strong></div>
              <div className="flex justify-between pr-4"><span>Politeness & Respect:</span> <strong className="font-mono text-indigo-600 dark:text-indigo-400">5</strong></div>
              <div className="flex justify-between pr-4"><span>Honesty & Integrity:</span> <strong className="font-mono text-indigo-600 dark:text-indigo-400">5</strong></div>
              <div className="flex justify-between pr-4"><span>Self-Control & Focus:</span> <strong className="font-mono text-indigo-600 dark:text-indigo-400">4</strong></div>
              <div className="flex justify-between pr-4"><span>Relationship with Peers:</span> <strong className="font-mono text-indigo-600 dark:text-indigo-400">5</strong></div>
            </div>
          </div>

          {/* Psychomotor Skills */}
          <div className="border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4.5 space-y-3 bg-slate-50/50 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-700 pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Psychomotor Skills Matrix
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Scale (1 - 5)</span>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="flex justify-between pr-4"><span>Handwriting & Penmanship:</span> <strong className="font-mono text-emerald-600">4</strong></div>
              <div className="flex justify-between pr-4"><span>Verbal Fluency & Eloquence:</span> <strong className="font-mono text-emerald-600">5</strong></div>
              <div className="flex justify-between pr-4"><span>Sports & Athleticism:</span> <strong className="font-mono text-emerald-600">4</strong></div>
              <div className="flex justify-between pr-4"><span>Crafts & Creative Design:</span> <strong className="font-mono text-emerald-600">5</strong></div>
              <div className="flex justify-between pr-4"><span>Musical & Artistic Talent:</span> <strong className="font-mono text-emerald-600">4</strong></div>
              <div className="flex justify-between pr-4"><span>Manual Dexterity & Lab Skills:</span> <strong className="font-mono text-emerald-600">5</strong></div>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* F. ADMINISTRATIVE REMARKS & OFFICIAL ENDORSEMENT          */}
        {/* ========================================================= */}
        <div className="space-y-4 pt-2 border-t border-slate-200/80 dark:border-zinc-800">
          
          {/* Class Teacher Remark */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">
                Class Teacher&apos;s Remark:
              </span>
              <p className="text-slate-800 dark:text-zinc-200 font-medium italic">
                &ldquo;{student.fullName} has demonstrated exceptional academic discipline, sharp intellect, and commendable consistency across all assessments this term.&rdquo;
              </p>
            </div>
            <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
              <div className="font-serif italic text-sm text-slate-700 dark:text-zinc-300">Mrs. O. Adebayo</div>
              <span className="text-[10px] text-slate-400">Class Teacher&apos;s Signature</span>
            </div>
          </div>

          {/* Principal Remark */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">
                Principal&apos;s Official Remark:
              </span>
              <p className="text-slate-800 dark:text-zinc-200 font-medium italic">
                &ldquo;An outstanding, well-rounded terminal performance. Keep up this commendable standard of academic brilliance!&rdquo;
              </p>
            </div>
            <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full border border-dashed border-amber-500/80 flex items-center justify-center text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase text-center rotate-[-12deg]">
                Official<br />Stamp
              </div>
              <div>
                <div className="font-serif italic text-sm text-slate-700 dark:text-zinc-300">Dr. K. Nwachukwu</div>
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

        </div>

      </div>

    </div>
  );
}
