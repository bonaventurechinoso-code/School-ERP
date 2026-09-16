"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { upsertExamResult } from "./actions";
import { calculatePercentageToLetter } from "@/lib/gpa";
import { useTenant } from "@/lib/tenant-context";
import { formatTierBadgeCode, resolveSchoolPrefix } from "@/lib/tenant-tier-utils";

type GradingRosterProps = {
  schoolId: string;
  exams: any[];
  students: any[];
  examResults: any[];
  academicTiers?: any[];
  activeTierName?: string;
};

// Canonical classes mapped to each Nigerian Educational Tier
const TIER_CLASSES_MAP: Record<string, string[]> = {
  NURSERY: [
    "Creche",
    "Daycare / Nursery",
    "Nursery 1",
    "Nursery 2",
    "Nursery 3",
    "Pre-School / Kindergarten"
  ],
  PRIMARY: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6"
  ],
  SECONDARY: [
    "JSS 1",
    "JSS 2",
    "JSS 3",
    "SS 1",
    "SS 2",
    "SS 3"
  ],
  UNIVERSITY: [
    "100 Level",
    "200 Level",
    "300 Level",
    "400 Level",
    "500 Level"
  ],
  POLYTECHNIC: [
    "ND 1",
    "ND 2",
    "HND 1",
    "HND 2"
  ],
  COLLEGE: [
    "NCE 1",
    "NCE 2",
    "NCE 3"
  ],
};

function isNurseryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("NURSERY") ||
    norm.includes("DAYCARE") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("PRE-SCHOOL") ||
    norm.includes("PRE SCHOOL") ||
    norm.includes("PLAYGROUP")
  );
}

function isPrimaryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("PRIMARY") ||
    norm.includes("BASIC") ||
    norm.includes("ELEMENTARY") ||
    /\bP[1-6]\b/.test(norm)
  );
}

function isSecondaryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("JSS") ||
    norm.includes("SSS") ||
    /\bSS\s*[1-3]\b/.test(norm) ||
    /\bJS\s*[1-3]\b/.test(norm) ||
    norm.includes("HIGH SCHOOL") ||
    norm.includes("SECONDARY")
  );
}

function isTertiaryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("LEVEL") ||
    norm.includes("ND") ||
    norm.includes("HND") ||
    norm.includes("NCE") ||
    norm.includes("YEAR") ||
    norm.includes("UNI")
  );
}

function isClassInTier(cls: string, tierCode: string): boolean {
  if (tierCode === "NURSERY") return isNurseryClass(cls);
  if (tierCode === "PRIMARY") return isPrimaryClass(cls);
  if (tierCode === "SECONDARY") return isSecondaryClass(cls);
  if (tierCode === "UNIVERSITY" || tierCode === "POLYTECHNIC" || tierCode === "COLLEGE") return isTertiaryClass(cls);
  return true;
}

function matchesClass(studentClass?: string | null, targetClass?: string): boolean {
  if (!targetClass || targetClass === "ALL") return true;
  if (!studentClass) return false;
  const s = studentClass.trim().toLowerCase();
  const t = targetClass.trim().toLowerCase();
  if (s === t) return true;

  // Normalized compact forms: "jss 1" === "jss1"
  const sCompact = s.replace(/\s+/g, "");
  const tCompact = t.replace(/\s+/g, "");
  if (sCompact === tCompact) return true;

  // SSS vs SS matching: "sss 1" === "ss 1"
  const sNorm = sCompact.replace("sss", "ss");
  const tNorm = tCompact.replace("sss", "ss");
  if (sNorm === tNorm) return true;

  return false;
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

export default function GradingRoster({
  schoolId,
  exams,
  students,
  examResults,
  academicTiers = [],
  activeTierName: initialActiveTierName = "",
}: GradingRosterProps) {
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // 1. Resolve Active Academic Tier (from searchParams, cookies, tenant context, or props)
  const paramTier = searchParams.get("tier");
  const cookieTier =
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find((row) => row.startsWith("activeTier="))
          ?.split("=")[1]
      : null;
  const decodedCookieTier = cookieTier ? decodeURIComponent(cookieTier) : null;
  const tenantActiveTier = (tenant as any)?.activeTier;
  const tenantPreciseTier = tenant.preciseTier;

  const rawActiveTier =
    paramTier ||
    decodedCookieTier ||
    initialActiveTierName ||
    tenantActiveTier ||
    tenantPreciseTier ||
    (academicTiers[0]?.name) ||
    "Secondary School";

  const activeTierCode = formatTierBadgeCode(rawActiveTier);
  const activeTierDisplay =
    activeTierCode === "SECONDARY"
      ? "Secondary School"
      : activeTierCode === "PRIMARY"
      ? "Primary School"
      : activeTierCode === "NURSERY"
      ? "Daycare / Nursery"
      : rawActiveTier;

  // 2. Derive Class Options for Active Tier
  const availableClasses = useMemo(() => {
    const standardClasses = TIER_CLASSES_MAP[activeTierCode] || TIER_CLASSES_MAP.SECONDARY;
    const additionalClasses = new Set<string>();

    students.forEach((s) => {
      if (s.currentClass && isClassInTier(s.currentClass, activeTierCode)) {
        additionalClasses.add(s.currentClass);
      }
    });

    const result = [...standardClasses];
    additionalClasses.forEach((cls) => {
      if (!result.some((r) => matchesClass(r, cls))) {
        result.push(cls);
      }
    });

    return result;
  }, [activeTierCode, students]);

  // 3. Selected Class State (defaults to param or first class of active tier, e.g., "JSS 1")
  const paramClass = searchParams.get("class");
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (paramClass) {
      const matched = availableClasses.find((c) => matchesClass(c, paramClass));
      if (matched) return matched;
    }
    return availableClasses[0] || "JSS 1";
  });

  useEffect(() => {
    if (paramClass) {
      const matched = availableClasses.find((c) => matchesClass(c, paramClass));
      if (matched) setSelectedClass(matched);
    }
  }, [paramClass, availableClasses]);

  // When active tier changes, automatically reset selected class to the first class of that tier
  const prevTierCodeRef = useRef(activeTierCode);
  useEffect(() => {
    if (prevTierCodeRef.current !== activeTierCode) {
      prevTierCodeRef.current = activeTierCode;
      const newClasses = TIER_CLASSES_MAP[activeTierCode] || TIER_CLASSES_MAP.SECONDARY;
      setSelectedClass(newClasses[0] || "JSS 1");
    }
  }, [activeTierCode]);

  // 4. Exams filtered to the active tier
  const tierExams = useMemo(() => {
    const matched = exams.filter((e) => {
      const examTierName = e.course?.tier?.name;
      if (examTierName) {
        return formatTierBadgeCode(examTierName) === activeTierCode;
      }
      return true;
    });
    return matched.length > 0 ? matched : exams;
  }, [exams, activeTierCode]);

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    return tierExams[0]?.id || exams[0]?.id || "";
  });

  useEffect(() => {
    if (tierExams.length > 0 && !tierExams.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(tierExams[0].id);
    }
  }, [tierExams, selectedExamId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  // Map existing results for quick lookup: map[studentId] = result
  const currentExamResults = useMemo(() => {
    const map = new Map();
    examResults.forEach((r) => {
      if (r.examId === selectedExamId) {
        map.set(r.studentId, r);
      }
    });
    return map;
  }, [examResults, selectedExamId]);

  // 5. Strict Academic Tier & Class Isolation Filter
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // a) Status check: only ENROLLED or ACTIVE students
      const status = student.status || "ENROLLED";
      if (status !== "ENROLLED" && status !== "ACTIVE") return false;

      // b) Strict Academic Tier Isolation:
      // If student has tier relation or name, verify it matches activeTierCode
      const studentTierName = student.tier?.name;
      if (studentTierName) {
        const studentTierCode = formatTierBadgeCode(studentTierName);
        if (studentTierCode !== activeTierCode) {
          return false;
        }
      } else if (student.currentClass) {
        if (!isClassInTier(student.currentClass, activeTierCode)) {
          return false;
        }
      }

      // c) Strict Class Isolation:
      // When JSS 1 is selected, student must be enrolled in JSS 1. Completely exclude Nursery, Daycare, JSS 2, etc.
      if (!matchesClass(student.currentClass, selectedClass)) {
        return false;
      }

      return true;
    });
  }, [students, activeTierCode, selectedClass]);

  // 6. Track row input states per student for real-time calculation
  const [scores, setScores] = useState<Record<string, { ca1: string; ca2: string; exam: string }>>({});

  // Reset/sync score calculations whenever Class, Exam, or Student set changes
  useEffect(() => {
    const initialScores: Record<string, { ca1: string; ca2: string; exam: string }> = {};
    filteredStudents.forEach((student) => {
      const res = examResults.find(
        (r) => r.examId === selectedExamId && r.studentId === student.id
      );
      const hasScores =
        res &&
        (res.ca1Score != null || res.ca2Score != null || res.examScore != null) &&
        (res.ca1Score > 0 || res.ca2Score > 0 || res.examScore > 0 || (res.score != null && res.score > 0));

      initialScores[student.id] = {
        ca1: hasScores && res?.ca1Score != null ? String(res.ca1Score) : "",
        ca2: hasScores && res?.ca2Score != null ? String(res.ca2Score) : "",
        exam: hasScores && res?.examScore != null ? String(res.examScore) : "",
      };
    });
    setScores(initialScores);
  }, [selectedExamId, selectedClass, examResults, filteredStudents]);

  const getStudentScores = (studentId: string, result: any) => {
    if (scores[studentId]) {
      return scores[studentId];
    }
    const hasScores =
      result &&
      (result.ca1Score != null || result.ca2Score != null || result.examScore != null) &&
      (result.ca1Score > 0 || result.ca2Score > 0 || result.examScore > 0 || (result.score != null && result.score > 0));

    return {
      ca1: hasScores && result?.ca1Score != null ? String(result.ca1Score) : "",
      ca2: hasScores && result?.ca2Score != null ? String(result.ca2Score) : "",
      exam: hasScores && result?.examScore != null ? String(result.examScore) : "",
    };
  };

  const handleInputChange = (studentId: string, field: "ca1" | "ca2" | "exam", value: string, result: any) => {
    const current = getStudentScores(studentId, result);
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const handleSaveResult = (studentId: string, result: any) => {
    if (!selectedExam) return;

    const studentScores = getStudentScores(studentId, result);
    const ca1Str = studentScores.ca1.trim();
    const ca2Str = studentScores.ca2.trim();
    const examStr = studentScores.exam.trim();

    // Do NOT calculate or save if row is completely empty
    if (ca1Str === "" && ca2Str === "" && examStr === "") {
      return;
    }

    let ca1 = ca1Str !== "" ? parseFloat(ca1Str) : 0;
    let ca2 = ca2Str !== "" ? parseFloat(ca2Str) : 0;
    let exam = examStr !== "" ? parseFloat(examStr) : 0;

    if (isNaN(ca1)) ca1 = 0;
    if (isNaN(ca2)) ca2 = 0;
    if (isNaN(exam)) exam = 0;

    if (ca1 > 15) ca1 = 15;
    if (ca2 > 15) ca2 = 15;
    if (exam > 70) exam = 70;

    const totalScore = Math.round((ca1 + ca2 + exam) * 10) / 10;

    const tierName = selectedExam.course?.tier?.name || activeTierDisplay;
    const isHigherEd =
      tierName.toLowerCase().includes("higher") ||
      tierName.toLowerCase().includes("university") ||
      tierName.toLowerCase().includes("college");

    const percentage = Math.min((totalScore / 100) * 100, 100);
    const letterGrade = calculatePercentageToLetter(percentage, isHigherEd);

    startTransition(() => {
      upsertExamResult(
        schoolId,
        selectedExamId,
        studentId,
        totalScore,
        ca1Str !== "" ? ca1 : undefined,
        ca2Str !== "" ? ca2 : undefined,
        examStr !== "" ? exam : undefined,
        letterGrade,
        ""
      );
    });
  };

  // 7. Enforce Dynamic Sorting by Class Position (Rank from 1st to Last)
  const sortedStudents = useMemo(() => {
    const mapped = filteredStudents.map((student) => {
      const result = currentExamResults.get(student.id);
      const studentScores = getStudentScores(student.id, result);
      const ca1Str = studentScores.ca1.trim();
      const ca2Str = studentScores.ca2.trim();
      const examStr = studentScores.exam.trim();

      const isEmptyRow = ca1Str === "" && ca2Str === "" && examStr === "";

      let ca1 = ca1Str !== "" ? parseFloat(ca1Str) : 0;
      let ca2 = ca2Str !== "" ? parseFloat(ca2Str) : 0;
      let exam = examStr !== "" ? parseFloat(examStr) : 0;

      if (isNaN(ca1)) ca1 = 0;
      if (isNaN(ca2)) ca2 = 0;
      if (isNaN(exam)) exam = 0;

      if (ca1 > 15) ca1 = 15;
      if (ca2 > 15) ca2 = 15;
      if (exam > 70) exam = 70;

      const totalScore = isEmptyRow ? -1 : Math.round((ca1 + ca2 + exam) * 10) / 10;

      return {
        student,
        result,
        studentScores,
        isEmptyRow,
        ca1,
        ca2,
        exam,
        totalScore,
      };
    });

    // Sort descending based on calculated total score
    // Student with highest total score sits at the very top (1st position), ranking down to lowest
    mapped.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      const nameA = `${a.student.lastName} ${a.student.firstName}`.toLowerCase();
      const nameB = `${b.student.lastName} ${b.student.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return mapped;
  }, [filteredStudents, scores, currentExamResults, selectedExamId]);

  // 8. Isolated Class Average Total calculation (strictly for selected class)
  const gradedScores = sortedStudents
    .filter((s) => !s.isEmptyRow && s.totalScore >= 0)
    .map((s) => s.totalScore);

  const classAverage =
    gradedScores.length > 0
      ? (gradedScores.reduce((sum, val) => sum + val, 0) / gradedScores.length).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Active Filtering Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Grading Roster</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {activeTierDisplay}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Class Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Class:
            </label>
            <select
              className="border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment / Exam Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Exam:
            </label>
            <select
              className="border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-3 text-sm min-w-[200px] max-w-[320px] bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {tierExams.map((e) => (
                <option key={e.id} value={e.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {e.name === "Terminal Assessment" ? "Termly Assessment" : e.name} ({e.semester}) - {e.course.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Isolated Class Average Total Metric */}
      {selectedExam && classAverage !== null && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-indigo-800 dark:text-indigo-300 font-semibold">
              Class Average Total ({selectedClass})
            </div>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
              Based on {gradedScores.length} evaluated student{gradedScores.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="text-indigo-900 dark:text-indigo-200 font-extrabold text-2xl">
            {classAverage} / 100
          </div>
        </div>
      )}

      {!selectedExam ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
          No exam selected. Please schedule an exam first.
        </div>
      ) : sortedStudents.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="font-semibold text-base text-slate-700 dark:text-slate-200">
            No students found in {selectedClass}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            No enrolled students are currently assigned to {selectedClass} in {activeTierDisplay}.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold">Reg No</th>
                <th className="px-6 py-4 font-semibold">1st CA (Max: 15)</th>
                <th className="px-6 py-4 font-semibold">2nd CA (Max: 15)</th>
                <th className="px-6 py-4 font-semibold">Termly Exam (Max: 70)</th>
                <th className="px-6 py-4 font-semibold">Total (100)</th>
                <th className="px-6 py-4 font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedStudents.map((item, index) => {
                const { student, result, studentScores, isEmptyRow, totalScore } = item;
                const position = index + 1;

                // Format the standard student registration code matching active academic tier and profile
                const studentClass = student.currentClass || selectedClass || "JSS 1";
                const classCode =
                  studentClass
                    .replace(/Primary\s*/i, "PRI")
                    .replace(/Basic\s*/i, "PRI")
                    .replace(/SSS\s*/i, "SS")
                    .replace(/Grade\s*/i, "G")
                    .replace(/\s+/g, "")
                    .toUpperCase() || "JSS1";

                const schoolPrefix = (tenant?.subdomain ? resolveSchoolPrefix(tenant.subdomain) : "GW") || "GW";
                const regSequence = String(position).padStart(3, "0");
                const studentRegNo =
                  student.admissionNumber && student.admissionNumber.includes(`/${classCode}/`)
                    ? student.admissionNumber
                    : `${schoolPrefix}/2026/${classCode}/${regSequence}`;

                let totalDisplay: string = "—";
                let gradeDisplay: string = "—";

                if (!isEmptyRow && totalScore >= 0) {
                  totalDisplay = String(totalScore);

                  const tierName = selectedExam.course?.tier?.name || activeTierDisplay;
                  const isHigherEd =
                    tierName.toLowerCase().includes("higher") ||
                    tierName.toLowerCase().includes("university") ||
                    tierName.toLowerCase().includes("college");

                  const percentage = Math.min((totalScore / 100) * 100, 100);
                  gradeDisplay = calculatePercentageToLetter(percentage, isHigherEd);
                }

                return (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-md shrink-0 ${
                            position === 1
                              ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                              : position === 2
                              ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
                              : position === 3
                              ? "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          }`}
                          title={`Position in ${selectedClass}: ${getOrdinalSuffix(position)}`}
                        >
                          {getOrdinalSuffix(position)}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {student.lastName}, {student.firstName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-300 select-none">
                      {studentRegNo}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        max="15"
                        step="0.5"
                        disabled={isPending}
                        value={studentScores.ca1}
                        onChange={(e) => handleInputChange(student.id, "ca1", e.target.value, result)}
                        onBlur={() => handleSaveResult(student.id, result)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        max="15"
                        step="0.5"
                        disabled={isPending}
                        value={studentScores.ca2}
                        onChange={(e) => handleInputChange(student.id, "ca2", e.target.value, result)}
                        onBlur={() => handleSaveResult(student.id, result)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        max="70"
                        step="0.5"
                        disabled={isPending}
                        value={studentScores.exam}
                        onChange={(e) => handleInputChange(student.id, "exam", e.target.value, result)}
                        onBlur={() => handleSaveResult(student.id, result)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                      {totalDisplay}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                      {gradeDisplay}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
