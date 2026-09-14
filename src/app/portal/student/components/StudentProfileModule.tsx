"use client";

import React, { useState } from "react";
import { StudentProfileData, TierPresentationConfig } from "../types";
import { 
  User, 
  ShieldCheck, 
  Copy, 
  Check, 
  Award, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  Users, 
  FileText, 
  BookOpen,
  TrendingUp,
  AlertCircle,
  QrCode,
  Sparkles,
  X,
  ChevronRight,
  Info
} from "lucide-react";

interface StudentProfileModuleProps {
  student: StudentProfileData;
  tierConfig: TierPresentationConfig;
  showFullBioGrid?: boolean;
}

export function StudentProfileModule({ 
  student, 
  tierConfig, 
  showFullBioGrid = false 
}: StudentProfileModuleProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [bioDrawerOpen, setBioDrawerOpen] = useState(false);

  const isHigherEd = tierConfig.category === "HIGHER_ED";
  const isSecondary = tierConfig.category === "SECONDARY";
  const isEarlyChildhood = tierConfig.category === "EARLY_CHILDHOOD";

  const handleCopyId = () => {
    navigator.clipboard.writeText(student.admissionNumber);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Reusable Bio Details Render Component
  const renderBioDetails = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Student Bio Data Record */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Student Bio Data
          </h3>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
          <div>
            <dt className="text-slate-400 dark:text-zinc-500 font-medium">Full Legal Name</dt>
            <dd className="font-bold text-slate-900 dark:text-white mt-0.5">{student.fullName}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-zinc-500 font-medium">Date of Birth</dt>
            <dd className="font-bold text-slate-900 dark:text-white mt-0.5">{student.dateOfBirth}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-zinc-500 font-medium">State / Region of Origin</dt>
            <dd className="font-bold text-slate-900 dark:text-white mt-0.5">{student.stateOfOrigin}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-zinc-500 font-medium">Gender</dt>
            <dd className="font-bold text-slate-900 dark:text-white mt-0.5">{student.gender || "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-zinc-500 font-medium">Enrollment Date</dt>
            <dd className="font-bold text-slate-900 dark:text-white mt-0.5">{student.enrollmentDate}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-zinc-500 font-medium">Academic Level</dt>
            <dd className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{student.currentClass}</dd>
          </div>
        </dl>
      </div>

      {/* Contact & Guardian Record */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {isEarlyChildhood ? "Parent & Guardian Bio Profile" : "Contact & Guardian Record"}
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Users className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 dark:text-zinc-500 font-medium block">Guardian / Parent Name</span>
              <span className="font-bold text-slate-900 dark:text-white">{student.parentName} ({student.parentOccupation})</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-slate-400 dark:text-zinc-500 font-medium block">
                {isHigherEd ? "Institutional Email" : "Guardian Email"}
              </span>
              <span className="font-bold text-slate-900 dark:text-white truncate block">
                {student.email || student.parentEmail}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 dark:text-zinc-500 font-medium block">Emergency Phone / WhatsApp</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{student.parentPhone}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 dark:text-zinc-500 font-medium block">Registered Residence Address</span>
              <span className="font-bold text-slate-900 dark:text-white">{student.emergencyAddress}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      {/* 1. Profile Header Card: Clean SaaS White Card with Color Accent Banner */}
      <div className="bg-gradient-to-r from-indigo-50/50 via-white to-white dark:from-indigo-950/20 dark:via-zinc-900 dark:to-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/80 dark:border-zinc-800 relative overflow-hidden transition-all before:absolute before:top-0 before:inset-x-0 before:h-1 before:bg-gradient-to-r before:from-indigo-500 before:to-purple-600">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar Profile Image Layout */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-600/20">
                {student.firstName.charAt(0)}{student.lastName.charAt(0)}
              </div>
              <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-zinc-900 shadow-xs" title="Enrolled & Active">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {student.fullName}
                </h2>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {student.status}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-zinc-300">
                {student.currentClass}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Academic Tier: <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{tierConfig.tierName}</strong>
              </p>
            </div>
          </div>

          {/* Student ID & Slide-Over Action */}
          <div className="w-full sm:w-auto flex flex-wrap sm:flex-col items-start sm:items-end justify-between gap-2.5 p-3.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/60 shadow-2xs">
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-1.5 sm:justify-end">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">
                  {isHigherEd ? "Matriculation / Login ID" : "Student Login ID"}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold">
                  {tierConfig.badgeCode}
                </span>
              </div>
              <p className="text-sm font-black font-mono text-slate-900 dark:text-white tracking-wide mt-0.5 whitespace-nowrap">
                {student.admissionNumber}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyId}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-700 border border-slate-200/80 dark:border-zinc-600 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-600 transition shrink-0"
              >
                {copiedId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>

              {!showFullBioGrid && (
                <button
                  onClick={() => setBioDrawerOpen(true)}
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Bio Records</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. When in Dedicated Profile Tab: Render Full Bio Data directly */}
      {showFullBioGrid && renderBioDetails()}

      {/* 3. Slide-Over Drawer Container for Structural Database Bio Records (Overview mode) */}
      {!showFullBioGrid && bioDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setBioDrawerOpen(false)}
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative w-full max-w-lg bg-slate-50 dark:bg-zinc-950 shadow-2xl h-full overflow-y-auto z-10 p-5 sm:p-6 space-y-5 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Student Structural Bio Records
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Isolated database identity details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBioDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderBioDetails()}

            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4" />
                <span>Tenant Identity Records</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Bio-data updates and legal name modifications require official verification from the school registrar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. DYNAMIC ACADEMIC LEVEL PRESENTATION CONDITIONAL LOGIC */}

      {/* HIGHER ED: GPA MATRIX TRACKING & COURSE CREDIT UNIT LOADING */}
      {isHigherEd && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-7 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  Collegiate GPA Matrix Tracking & Standing
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {student.academicRank.faculty} • {student.academicRank.department}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
                {student.academicRank.degreeClassification}
              </span>
            </div>
          </div>

          {/* Matrix Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-zinc-700/60">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Current Semester GPA</span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                {student.academicRank.semesterGpa?.toFixed(2)}
              </p>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 block font-medium">Scale 4.00 (First Class)</span>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-zinc-700/60">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Cumulative CGPA</span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                {student.academicRank.cumulativeGpa?.toFixed(2)}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-semibold">Across all collegiate semesters</span>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-zinc-700/60">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Active Credit Units Load</span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                {student.academicRank.creditUnitsRegistered} <span className="text-xs font-normal text-slate-400">/ {student.academicRank.creditUnitsMax} Units</span>
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-semibold">Dean Approved</span>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-zinc-700/60">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Matriculation Standing</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">Good Standing</p>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block font-mono whitespace-nowrap">{student.admissionNumber}</span>
            </div>
          </div>

          {/* GPA Matrix Breakdown Table / Stack */}
          <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-zinc-700/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Semester-by-Semester GPA Historical Matrix</span>
            </h4>
            <div className="divide-y divide-slate-200/60 dark:divide-zinc-700/60 text-xs">
              {(student.academicRank.gpaMatrixBreakdown || []).map((sem, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{sem.semester}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">{sem.level} • {sem.credits} Registered Units</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-extrabold text-sm text-amber-600 dark:text-amber-400">{sem.gpa.toFixed(2)}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {sem.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECONDARY: CLASS POSITION, CA BREAKDOWN & MIDTERM DETAILS */}
      {isSecondary && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Academic Rank & Assessment Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Continuous Assessment (CA1, CA2) and Terminal Examination Performance
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                Rank: {student.academicRank.classPosition}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                Avg: {student.academicRank.termAverage}
              </span>
            </div>
          </div>

          {/* CA Scores Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 font-bold">
                  <th className="py-2.5 pr-4">Subject</th>
                  <th className="py-2.5 px-3 text-center">CA 1 (15)</th>
                  <th className="py-2.5 px-3 text-center">CA 2 (15)</th>
                  <th className="py-2.5 px-3 text-center">Exam (70)</th>
                  <th className="py-2.5 px-3 text-center">Total (100)</th>
                  <th className="py-2.5 pl-3 text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {(student.academicRank.continuousAssessments || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                    <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">{item.subject}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600 dark:text-zinc-300 font-mono">{item.ca1}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600 dark:text-zinc-300 font-mono">{item.ca2}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600 dark:text-zinc-300 font-mono">{item.exam}</td>
                    <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white font-mono">{item.total}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className="inline-block px-2 py-0.5 rounded font-black text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        {item.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DAYCARE / NURSERY / PRIMARY: PARENT-ORIENTED DEVELOPMENTAL RATING & PICK-UP LOGS */}
      {isEarlyChildhood && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 sm:p-6 shadow-sm shadow-slate-200/60 dark:shadow-none border border-slate-200/60 dark:border-zinc-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Early Learning Stage & Security Pick-up Log
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Childcare Milestone Assessments & Verified Security Pick-up Authorizations
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
              {student.academicRank.developmentalRating}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Developmental Milestone Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-pink-500" />
                <span>Early Learning Milestone Indicators</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-zinc-400">Cognitive & Phonics Recognition</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Exceeding Stage</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-zinc-400">Fine Motor Coordination</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Proficient</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-zinc-400">Social Interaction & Manners</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Well Developed</span>
                </div>
              </div>
            </div>

            {/* Authorized Guardian Pick-up Log */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Authorized Pick-up Persons (Security Gate)</span>
              </h4>
              <div className="space-y-2.5">
                {(student.academicRank.pickupAuthorizedPersons || []).map((person, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-zinc-900 shadow-xs text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{person.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">{person.relation} • {person.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[10px]">
                      {person.securityPin}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
