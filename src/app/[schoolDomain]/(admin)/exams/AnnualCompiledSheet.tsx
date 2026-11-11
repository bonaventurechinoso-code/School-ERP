"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSubjectsForClassAndTier } from "./ExamsList";
import { useTenant } from "@/lib/tenant-context";
import { formatTierBadgeCode, resolveSchoolPrefix } from "@/lib/tenant-tier-utils";
import {
  Download,
  Printer,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Award,
  Layers,
  Sparkles,
  TrendingUp,
  GraduationCap,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  getTierForClass,
  getClassesForSchool,
  EducationalTierCategory,
} from "@/lib/school-tier-classes";

export type AnnualCompiledSheetProps = {
  schoolId: string;
  schoolDomain?: string;
  schoolName?: string;
  schoolTier?: string;
  exams: any[];
  students: any[];
  examResults: any[];
  gradeRecords?: any[];
  academicRecords?: any[];
  courses?: any[];
  classrooms?: any[];
  academicTiers?: any[];
  activeTierName?: string;
};

export function getNextClass(currentClass: string): string {
  const norm = (currentClass || "").trim();
  const map: Record<string, string> = {
    "Creche": "Nursery 1",
    "Creche / Nursery": "Nursery 1",
    "Nursery 1": "Nursery 2",
    "Nursery 2": "Nursery 3",
    "Nursery 3": "Primary 1",
    "Pre-School / Kindergarten": "Primary 1",
    "Primary 1": "Primary 2",
    "Primary 2": "Primary 3",
    "Primary 3": "Primary 4",
    "Primary 4": "Primary 5",
    "Primary 5": "Primary 6",
    "Primary 6": "JSS 1 (Secondary Entrance)",
    "JSS 1": "JSS 2",
    "JSS 2": "JSS 3",
    "JSS 3": "SS 1 (BECE Graduate)",
    "SS 1": "SS 2",
    "SS 2": "SS 3",
    "SS 3": "Graduated (SSCE / WAEC / NECO)",
    "100 Level": "200 Level",
    "200 Level": "300 Level",
    "300 Level": "400 Level",
    "400 Level": "500 Level / Graduated",
    "500 Level": "Graduated",
    "ND 1": "ND 2",
    "ND 2": "HND 1 (Graduated ND)",
    "HND 1": "HND 2",
    "HND 2": "Graduated HND",
    "NCE 1": "NCE 2",
    "NCE 2": "NCE 3",
    "NCE 3": "Graduated NCE",
  };
  return map[norm] || "Next Class";
}

function getOrdinalSuffix(rank: number): string {
  if (rank <= 0) return "—";
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

function resolveTierGrade(tierCategory: EducationalTierCategory, score: number) {
  if (score >= 75) {
    return {
      letter: tierCategory === "SECONDARY" ? "A1" : "A",
      remark: "Distinction / Excellent",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    };
  }
  if (score >= 70) {
    return {
      letter: tierCategory === "SECONDARY" ? "B2" : "B",
      remark: "Very Good",
      badgeColor: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
    };
  }
  if (score >= 65) {
    return {
      letter: tierCategory === "SECONDARY" ? "B3" : "B",
      remark: "Good",
      badgeColor: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
    };
  }
  if (score >= 60) {
    return {
      letter: tierCategory === "SECONDARY" ? "C4" : "C",
      remark: "Credit",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    };
  }
  if (score >= 50) {
    return {
      letter: tierCategory === "SECONDARY" ? "C6" : "C",
      remark: "Credit",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    };
  }
  if (score >= 45) {
    return {
      letter: tierCategory === "SECONDARY" ? "D7" : "D",
      remark: "Pass",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    };
  }
  if (score >= 40) {
    return {
      letter: tierCategory === "SECONDARY" ? "E8" : "E",
      remark: "Pass",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    };
  }
  return {
    letter: tierCategory === "SECONDARY" ? "F9" : "F",
    remark: "Fail / Incomplete",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  };
}

function matchesClass(studentClass?: string | null, targetClass?: string): boolean {
  if (!targetClass || targetClass === "ALL") return true;
  if (!studentClass) return false;
  const s = studentClass.trim().toLowerCase();
  const t = targetClass.trim().toLowerCase();
  if (s === t) return true;

  const sCompact = s.replace(/\s+/g, "");
  const tCompact = t.replace(/\s+/g, "");
  if (sCompact === tCompact) return true;

  const sNorm = sCompact.replace("sss", "ss");
  const tNorm = tCompact.replace("sss", "ss");
  return sNorm === tNorm;
}

export default function AnnualCompiledSheet({
  schoolId,
  schoolDomain,
  schoolName,
  schoolTier,
  exams = [],
  students = [],
  examResults = [],
  gradeRecords = [],
  academicRecords = [],
}: AnnualCompiledSheetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = useTenant();

  const effectiveDomain = schoolDomain || tenant?.subdomain || "demo";
  const isDemo = effectiveDomain === "demo";
  const schoolDisplayName = schoolName || tenant?.name || "School";

  // Tier-scoped classes
  const schoolClassesResult = useMemo(() => {
    return getClassesForSchool(
      {
        schoolId,
        name: schoolDisplayName,
        subdomain: effectiveDomain,
        tier: schoolTier,
      },
      {
        students,
      }
    );
  }, [schoolId, schoolDisplayName, effectiveDomain, schoolTier, students]);

  const { allClasses: availableClasses, defaultClass: schoolDefaultClass, tierInfo } = schoolClassesResult;

  const paramClass = searchParams.get("class");
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (paramClass) {
      const matched = availableClasses.find((c: string) => matchesClass(c, paramClass));
      if (matched) return matched;
    }
    return schoolDefaultClass || availableClasses[0] || "JSS 1";
  });

  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.some((c: string) => matchesClass(c, selectedClass))) {
      setSelectedClass(schoolDefaultClass || availableClasses[0]);
    }
  }, [availableClasses, schoolDefaultClass, selectedClass]);

  const selectedClassTier = useMemo(() => {
    return getTierForClass(selectedClass);
  }, [selectedClass]);

  const tierCategory: EducationalTierCategory = selectedClassTier.category;

  const [academicSession, setAcademicSession] = useState<string>("2026/2027");
  const [passMarkThreshold, setPassMarkThreshold] = useState<number>(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Curriculum subjects
  const classSubjects = useMemo(() => {
    const standardSubjects = getSubjectsForClassAndTier(selectedClass, tierCategory);
    const subjectsSet = new Set<string>(standardSubjects);

    gradeRecords.forEach((gr) => {
      if (matchesClass(gr.className, selectedClass)) {
        if (gr.subject && gr.subject.trim()) subjectsSet.add(gr.subject.trim());
      }
    });

    academicRecords.forEach((ar) => {
      if (matchesClass(ar.className, selectedClass)) {
        if (ar.subject && ar.subject.trim()) subjectsSet.add(ar.subject.trim());
      }
    });

    return Array.from(subjectsSet);
  }, [selectedClass, tierCategory, gradeRecords, academicRecords]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const status = student.status || "ENROLLED";
      if (status !== "ENROLLED" && status !== "ACTIVE") return false;
      return matchesClass(student.currentClass, selectedClass);
    });
  }, [students, selectedClass]);

  // Assign permanent registration numbers
  const studentsWithRegNo = useMemo(() => {
    const classCode = selectedClass.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
    const schoolPrefix = resolveSchoolPrefix(effectiveDomain);

    return filteredStudents.map((student, index) => {
      const regSequence = String(index + 1).padStart(3, "0");
      const regNo =
        student.admissionNumber && student.admissionNumber.includes(`/${classCode}/`)
          ? student.admissionNumber
          : `${schoolPrefix}/2026/${classCode}/${regSequence}`;

      return {
        ...student,
        regNo,
      };
    });
  }, [filteredStudents, selectedClass, effectiveDomain]);

  // Lookup Term Score: checks 1st Term, 2nd Term, 3rd Term
  const getTermScore = useCallback((studentId: string, subject: string, termName: string) => {
    const tLower = termName.toLowerCase();
    const termVariants = tLower.includes("1")
      ? ["1st Term", "First Term", "Term 1", "1st term"]
      : tLower.includes("2")
      ? ["2nd Term", "Second Term", "Term 2", "2nd term"]
      : ["3rd Term", "Third Term", "Term 3", "3rd term"];

    // 1. GradeRecord
    const gr = gradeRecords.find(
      (r) =>
        r.studentId === studentId &&
        r.subject?.toLowerCase() === subject.toLowerCase() &&
        termVariants.includes(r.term) &&
        matchesClass(r.className, selectedClass)
    );
    if (gr) {
      return Number(gr.totalScore) || (Number(gr.ca1) || 0) + (Number(gr.ca2) || 0) + (Number(gr.exam) || 0);
    }

    // 2. AcademicRecord
    const ar = academicRecords.find(
      (r) =>
        r.studentId === studentId &&
        r.subject?.toLowerCase() === subject.toLowerCase() &&
        termVariants.includes(r.term)
    );
    if (ar) {
      return Number(ar.totalScore) || (Number(ar.test1) || 0) + (Number(ar.test2) || 0) + (Number(ar.finalExam) || 0);
    }

    return null;
  }, [gradeRecords, academicRecords, selectedClass]);

  // Annual Master Broadsheet Computation
  const annualBroadsheetData = useMemo(() => {
    const rows = studentsWithRegNo.map((student) => {
      let term1Sum = 0;
      let term2Sum = 0;
      let term3Sum = 0;
      let annualGrandTotal = 0;
      let evaluatedSubjectsCount = 0;

      const subjectData: Record<
        string,
        {
          t1: number | null;
          t2: number | null;
          t3: number | null;
          annualTotal: number;
          annualAverage: number;
          grade: string;
          badgeColor: string;
        }
      > = {};

      classSubjects.forEach((sub) => {
        let t1 = getTermScore(student.id, sub, "1st Term");
        let t2 = getTermScore(student.id, sub, "2nd Term");
        let t3 = getTermScore(student.id, sub, "3rd Term");

        // Demo simulation: if demo tenant and 1st term has score, simulate realistic progression for 2nd & 3rd term
        if (isDemo && t1 !== null) {
          if (t2 === null) {
            // slight human variance +/- 3
            t2 = Math.min(98, Math.max(25, Math.round(t1 + ((student.lastName.length % 5) - 2))));
          }
          if (t3 === null) {
            t3 = Math.min(99, Math.max(28, Math.round(t2 + ((student.firstName.length % 5) - 2))));
          }
        }

        const validScores = [t1, t2, t3].filter((s): s is number => s !== null);
        const subCount = validScores.length;

        if (subCount > 0) {
          evaluatedSubjectsCount++;
          if (t1 !== null) term1Sum += t1;
          if (t2 !== null) term2Sum += t2;
          if (t3 !== null) term3Sum += t3;

          const annualTotal = validScores.reduce((a, b) => a + b, 0);
          const annualAverage = annualTotal / subCount;
          const gradeInfo = resolveTierGrade(tierCategory, annualAverage);

          subjectData[sub] = {
            t1,
            t2,
            t3,
            annualTotal,
            annualAverage,
            grade: gradeInfo.letter,
            badgeColor: gradeInfo.badgeColor,
          };
          annualGrandTotal += annualAverage;
        } else {
          subjectData[sub] = {
            t1: null,
            t2: null,
            t3: null,
            annualTotal: 0,
            annualAverage: 0,
            grade: "—",
            badgeColor: "",
          };
        }
      });

      const term1Average = classSubjects.length > 0 ? term1Sum / classSubjects.length : 0;
      const term2Average = classSubjects.length > 0 ? term2Sum / classSubjects.length : 0;
      const term3Average = classSubjects.length > 0 ? term3Sum / classSubjects.length : 0;
      const annualCumulativeAverage =
        classSubjects.length > 0 ? annualGrandTotal / classSubjects.length : 0;

      // Final Annual Promotion Verdict:
      let promotionVerdict = "—";
      let promotionBadge = "";
      const nextCls = getNextClass(selectedClass);

      if (evaluatedSubjectsCount > 0) {
        if (annualCumulativeAverage >= passMarkThreshold) {
          promotionVerdict = `PROMOTED TO ${nextCls.toUpperCase()}`;
          promotionBadge = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300";
        } else if (annualCumulativeAverage >= passMarkThreshold - 10) {
          promotionVerdict = `PROMOTED ON TRIAL (${nextCls.toUpperCase()})`;
          promotionBadge = "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300";
        } else {
          promotionVerdict = `REPEAT ${selectedClass.toUpperCase()}`;
          promotionBadge = "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300";
        }
      }

      return {
        student,
        subjectData,
        term1Sum,
        term2Sum,
        term3Sum,
        term1Average,
        term2Average,
        term3Average,
        annualCumulativeAverage,
        evaluatedSubjectsCount,
        promotionVerdict,
        promotionBadge,
      };
    });

    // Rank by annual cumulative average descending
    const sorted = [...rows].sort((a, b) => b.annualCumulativeAverage - a.annualCumulativeAverage);
    const rankMap = new Map<string, string>();
    let currentRank = 1;

    sorted.forEach((item, index) => {
      if (item.evaluatedSubjectsCount > 0) {
        if (index > 0 && item.annualCumulativeAverage < sorted[index - 1].annualCumulativeAverage) {
          currentRank = index + 1;
        }
        rankMap.set(item.student.id, getOrdinalSuffix(currentRank));
      } else {
        rankMap.set(item.student.id, "—");
      }
    });

    return sorted.map((row) => ({
      ...row,
      position: rankMap.get(row.student.id) || "—",
    }));
  }, [studentsWithRegNo, classSubjects, getTermScore, tierCategory, selectedClass, passMarkThreshold, isDemo]);

  // Search filter
  const filteredBroadsheet = useMemo(() => {
    if (!searchQuery.trim()) return annualBroadsheetData;
    const q = searchQuery.toLowerCase();
    return annualBroadsheetData.filter(
      (r) =>
        `${r.student.lastName} ${r.student.firstName}`.toLowerCase().includes(q) ||
        r.student.regNo.toLowerCase().includes(q)
    );
  }, [annualBroadsheetData, searchQuery]);

  // Aggregate Annual Analytics
  const analytics = useMemo(() => {
    const evaluatedRows = annualBroadsheetData.filter((r) => r.evaluatedSubjectsCount > 0);
    const count = evaluatedRows.length;
    if (count === 0) {
      return {
        count: 0,
        average: "—",
        highest: "—",
        lowest: "—",
        promotedCount: 0,
        trialCount: 0,
        repeatCount: 0,
        passRate: "—",
      };
    }

    const sumAvg = evaluatedRows.reduce((acc, curr) => acc + curr.annualCumulativeAverage, 0);
    const average = (sumAvg / count).toFixed(2);
    const highest = Math.max(...evaluatedRows.map((r) => r.annualCumulativeAverage)).toFixed(2);
    const lowest = Math.min(...evaluatedRows.map((r) => r.annualCumulativeAverage)).toFixed(2);

    const promotedCount = evaluatedRows.filter((r) => r.promotionVerdict.startsWith("PROMOTED TO")).length;
    const trialCount = evaluatedRows.filter((r) => r.promotionVerdict.startsWith("PROMOTED ON TRIAL")).length;
    const repeatCount = evaluatedRows.filter((r) => r.promotionVerdict.startsWith("REPEAT")).length;
    const passRate = `${Math.round(((promotedCount + trialCount) / count) * 100)}%`;

    return {
      count,
      average: `${average}%`,
      highest: `${highest}%`,
      lowest: `${lowest}%`,
      promotedCount,
      trialCount,
      repeatCount,
      passRate,
    };
  }, [annualBroadsheetData]);

  // Export Annual Broadsheet to CSV
  const handleExportCSV = () => {
    const headers = [
      "Position",
      "Student Name",
      "Admission No",
      ...classSubjects.flatMap((s) => [`${s} (T1)`, `${s} (T2)`, `${s} (T3)`, `${s} (Annual Avg)`]),
      "1st Term Avg (%)",
      "2nd Term Avg (%)",
      "3rd Term Avg (%)",
      "Annual Cumulative Avg (%)",
      "Annual Promotion Verdict",
    ];

    const rows = annualBroadsheetData.map((row) => {
      const subjectCols: string[] = [];
      classSubjects.forEach((sub) => {
        const sc = row.subjectData[sub];
        subjectCols.push(
          sc.t1 !== null ? String(sc.t1) : "-",
          sc.t2 !== null ? String(sc.t2) : "-",
          sc.t3 !== null ? String(sc.t3) : "-",
          sc.annualAverage > 0 ? sc.annualAverage.toFixed(1) : "-"
        );
      });

      return [
        `"${row.position}"`,
        `"${row.student.lastName}, ${row.student.firstName}"`,
        `"${row.student.regNo}"`,
        ...subjectCols,
        `"${row.term1Average.toFixed(2)}%"`,
        `"${row.term2Average.toFixed(2)}%"`,
        `"${row.term3Average.toFixed(2)}%"`,
        `"${row.annualCumulativeAverage.toFixed(2)}%"`,
        `"${row.promotionVerdict}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Annual_Compiled_Master_Sheet_${selectedClass}_${academicSession.replace(/\//g, "-")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Control Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Annual Compiled Master Sheet
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${selectedClassTier.badgeColor}`}>
                  {selectedClassTier.badgeLabel}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Session-wide cumulative compilation across 1st, 2nd, and 3rd Terms with auto-calculated promotion verdicts.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>School: <strong className="text-slate-700 dark:text-slate-200">{schoolDisplayName}</strong></span>
                <span>•</span>
                <span>Session: <strong className="text-indigo-600 dark:text-indigo-400">{academicSession}</strong></span>
                <span>•</span>
                <span>Next Class Destination: <strong className="text-emerald-600 dark:text-emerald-400">{getNextClass(selectedClass)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Selector */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Class:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {availableClasses.map((cls: string) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Session */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Session:
            </label>
            <select
              value={academicSession}
              onChange={(e) => setAcademicSession(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
            </select>
          </div>

          {/* Promotion Benchmark */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Pass Benchmark:
            </label>
            <select
              value={passMarkThreshold}
              onChange={(e) => setPassMarkThreshold(Number(e.target.value) || 50)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={40}>40% Pass Mark</option>
              <option value={45}>45% Pass Mark</option>
              <option value={50}>50% Pass Mark (Standard)</option>
              <option value={60}>60% Pass Mark (Merit)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Download Master Annual Broadsheet CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Print Annual Broadsheet Landscape"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Annual Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${selectedClass} annual results...`}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Subjects: <strong className="text-slate-900 dark:text-white">{classSubjects.length}</strong></span>
          <span>•</span>
          <span>Students: <strong className="text-slate-900 dark:text-white">{annualBroadsheetData.length}</strong></span>
        </div>
      </div>

      {/* Annual Compiled Table */}
      {filteredBroadsheet.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="font-bold text-base text-slate-700 dark:text-slate-200">
            No students found in {selectedClass}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No enrolled students match this stream or query.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              {/* TABLE HEADERS */}
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-center w-14 sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-left sticky left-14 z-20 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 min-w-[180px]">
                    Student Name
                  </th>
                  <th className="px-3 py-3 text-left border-r border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                    Reg No
                  </th>

                  {/* Subject Columns: Each subject shows Annual Cumulative Average */}
                  {classSubjects.map((sub) => (
                    <th
                      key={sub}
                      className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-800 min-w-[90px]"
                      title={sub}
                    >
                      <div className="truncate max-w-[120px] font-bold" title={sub}>
                        {sub}
                      </div>
                      <span className="text-[9px] font-normal text-slate-400 block lowercase">
                        (Annual Avg)
                      </span>
                    </th>
                  ))}

                  {/* Term Summary Columns */}
                  <th className="px-3 py-3 text-center bg-slate-100/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-l border-r border-slate-200 dark:border-slate-700 w-20">
                    1st Term
                  </th>
                  <th className="px-3 py-3 text-center bg-slate-100/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-20">
                    2nd Term
                  </th>
                  <th className="px-3 py-3 text-center bg-slate-100/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-20">
                    3rd Term
                  </th>

                  {/* Cumulative Annual Average */}
                  <th className="px-3 py-3 text-center bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-r border-indigo-200 dark:border-indigo-900 w-24">
                    Annual Avg
                  </th>

                  {/* Final Promotion Verdict */}
                  <th className="px-4 py-3 text-center bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 min-w-[180px]">
                    Promotion Recommendation
                  </th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredBroadsheet.map((row) => (
                  <tr
                    key={row.student.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Position */}
                    <td className="px-3 py-3 text-center font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                      {row.position}
                    </td>

                    {/* Student Name */}
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white sticky left-14 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                      {row.student.lastName}, {row.student.firstName}
                    </td>

                    {/* Reg No */}
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                      {row.student.regNo}
                    </td>

                    {/* Subject Scores: Annual Average */}
                    {classSubjects.map((sub) => {
                      const sc = row.subjectData[sub];
                      return (
                        <td
                          key={sub}
                          className="px-3 py-3 text-center border-r border-slate-100 dark:border-slate-800"
                        >
                          {sc && sc.annualAverage > 0 ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                sc.annualAverage >= 70
                                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : sc.annualAverage >= 60
                                  ? "text-teal-700 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300"
                                  : sc.annualAverage >= 50
                                  ? "text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300"
                                  : sc.annualAverage >= 40
                                  ? "text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300"
                              }`}
                              title={`T1: ${sc.t1 ?? "-"}, T2: ${sc.t2 ?? "-"}, T3: ${sc.t3 ?? "-"}`}
                            >
                              {sc.annualAverage.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-xs">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* 1st Term Average */}
                    <td className="px-3 py-3 text-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300 border-l border-r border-slate-100 dark:border-slate-800">
                      {row.evaluatedSubjectsCount > 0 && row.term1Average > 0 ? `${row.term1Average.toFixed(1)}%` : "—"}
                    </td>

                    {/* 2nd Term Average */}
                    <td className="px-3 py-3 text-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {row.evaluatedSubjectsCount > 0 && row.term2Average > 0 ? `${row.term2Average.toFixed(1)}%` : "—"}
                    </td>

                    {/* 3rd Term Average */}
                    <td className="px-3 py-3 text-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {row.evaluatedSubjectsCount > 0 && row.term3Average > 0 ? `${row.term3Average.toFixed(1)}%` : "—"}
                    </td>

                    {/* Annual Cumulative Average */}
                    <td className="px-3 py-3 text-center font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/30 border-r border-indigo-100 dark:border-indigo-950">
                      {row.evaluatedSubjectsCount > 0 ? `${row.annualCumulativeAverage.toFixed(2)}%` : "—"}
                    </td>

                    {/* Final Promotion Verdict */}
                    <td className="px-4 py-3 text-center">
                      {row.evaluatedSubjectsCount > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[11px] font-mono border shadow-2xs ${row.promotionBadge}`}
                        >
                          <Award className="w-3.5 h-3.5 shrink-0" />
                          {row.promotionVerdict}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AGGREGATE SUMMARY FOOTER */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Annual Class Average */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Annual Class Average
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono shrink-0">
                    {analytics.average}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    ({analytics.count} students)
                  </span>
                </div>
              </div>

              {/* Card 2: Highest Annual Average */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Highest Annual Average
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                    {analytics.highest}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    Valedictorian
                  </span>
                </div>
              </div>

              {/* Card 3: Lowest Annual Average */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Lowest Annual Average
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono shrink-0">
                    {analytics.lowest}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    Cut-off Floor
                  </span>
                </div>
              </div>

              {/* Card 4: Annual Subjects */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Assessed Subjects
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono shrink-0">
                    {classSubjects.length}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    Across 3 Terms
                  </span>
                </div>
              </div>

              {/* Card 5: Full Width Annual Promotion Outcome */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden col-span-2 lg:col-span-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                      Annual Promotion Outcome ({passMarkThreshold}% Standard Benchmark)
                    </span>
                    <div className="mt-1 flex items-baseline gap-2 flex-wrap min-w-0">
                      <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                        {analytics.passRate}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        Advanced to Next Academic Level
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Promoted: {analytics.promotedCount}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      On Trial: {analytics.trialCount}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      Repeat: {analytics.repeatCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
