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

interface ScoreEntry {
  firstCa: string;
  secondCa: string;
  exam: string;
  ca1?: string;
  ca2?: string;
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

  // The 'Position' column must ONLY be visible for K-12 tiers ('Daycare / Nursery', 'Primary School', 'Secondary School')
  // If a tertiary tier (University, Polytechnic, College of Education) is active, hide the Position column entirely
  const rawTierUpper = (rawActiveTier || "").toUpperCase();
  const displayTierUpper = (activeTierDisplay || "").toUpperCase();

  const isTertiaryTier =
    activeTierCode === "UNIVERSITY" ||
    activeTierCode === "POLYTECHNIC" ||
    activeTierCode === "COLLEGE" ||
    rawTierUpper.includes("UNIVERSITY") ||
    rawTierUpper.includes("POLYTECHNIC") ||
    rawTierUpper.includes("COLLEGE") ||
    rawTierUpper.includes("TERTIARY") ||
    rawTierUpper.includes("HIGHER") ||
    rawTierUpper.includes("EDUCATION") ||
    displayTierUpper.includes("UNIVERSITY") ||
    displayTierUpper.includes("POLYTECHNIC") ||
    displayTierUpper.includes("COLLEGE") ||
    displayTierUpper.includes("EDUCATION");

  const isK12Tier =
    !isTertiaryTier &&
    (activeTierDisplay === "Daycare / Nursery" ||
      activeTierDisplay === "Primary School" ||
      activeTierDisplay === "Secondary School" ||
      activeTierCode === "NURSERY" ||
      activeTierCode === "PRIMARY" ||
      activeTierCode === "SECONDARY" ||
      rawTierUpper.includes("NURSERY") ||
      rawTierUpper.includes("DAYCARE") ||
      rawTierUpper.includes("PRIMARY") ||
      rawTierUpper.includes("SECONDARY"));

  const showPositionColumn = isK12Tier && !isTertiaryTier;

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
      if (!matchesClass(student.currentClass, selectedClass)) {
        return false;
      }

      return true;
    });
  }, [students, activeTierCode, selectedClass]);

  // 6. Assign Permanent, Stable Registration Numbers (Never shifts with rank positions)
  const studentsWithRegNo = useMemo(() => {
    const classCode =
      selectedClass
        .replace(/Primary\s*/i, "PRI")
        .replace(/Basic\s*/i, "PRI")
        .replace(/SSS\s*/i, "SS")
        .replace(/Grade\s*/i, "G")
        .replace(/\s+/g, "")
        .toUpperCase() || "JSS1";

    const schoolPrefix = (tenant?.subdomain ? resolveSchoolPrefix(tenant.subdomain) : "GW") || "GW";

    // Stable deterministic sort by student admissionNumber or ID
    const stableList = [...filteredStudents].sort((a, b) => {
      if (a.admissionNumber && b.admissionNumber) {
        return a.admissionNumber.localeCompare(b.admissionNumber);
      }
      return a.id.localeCompare(b.id);
    });

    return stableList.map((student, stableIndex) => {
      const regSequence = String(stableIndex + 1).padStart(3, "0");
      const regNo =
        student.admissionNumber && student.admissionNumber.includes(`/${classCode}/`)
          ? student.admissionNumber
          : `${schoolPrefix}/2026/${classCode}/${regSequence}`;

      return {
        ...student,
        regNo,
      };
    });
  }, [filteredStudents, selectedClass, tenant?.subdomain]);

  // Helper to calculate initial scores & totals synchronously for SSR & hydration
  const computeInitialState = () => {
    const initScores: Record<string, ScoreEntry> = {};
    const initTotals: Record<string, number> = {};

    studentsWithRegNo.forEach((student) => {
      const res = examResults.find(
        (r) => r.examId === selectedExamId && r.studentId === student.id
      );
      const hasScores =
        res &&
        (res.ca1Score != null || res.ca2Score != null || res.examScore != null) &&
        (res.ca1Score > 0 || res.ca2Score > 0 || res.examScore > 0 || (res.score != null && res.score > 0));

      const firstCa =
        hasScores && res?.ca1Score != null
          ? String(Math.min(Math.max(res.ca1Score, 0), 15))
          : "";
      const secondCa =
        hasScores && res?.ca2Score != null
          ? String(Math.min(Math.max(res.ca2Score, 0), 15))
          : "";
      const exam =
        hasScores && res?.examScore != null
          ? String(Math.min(Math.max(res.examScore, 0), 70))
          : "";

      initScores[student.regNo] = {
        firstCa,
        secondCa,
        exam,
        ca1: firstCa,
        ca2: secondCa,
      };

      if (hasScores) {
        let ca1 = res.ca1Score != null ? res.ca1Score : 0;
        let ca2 = res.ca2Score != null ? res.ca2Score : 0;
        let examScore = res.examScore != null ? res.examScore : 0;
        if (ca1 > 15) ca1 = 15;
        if (ca2 > 15) ca2 = 15;
        if (examScore > 70) examScore = 70;
        const total = res.score > 0 ? res.score : Math.round((ca1 + ca2 + examScore) * 10) / 10;
        initTotals[student.regNo] = total;
      } else {
        initTotals[student.regNo] = -1; // Un-submitted / absent
      }
    });

    return { initScores, initTotals };
  };

  // 7. Input State strictly keyed by student.regNo
  const [scores, setScores] = useState<Record<string, ScoreEntry>>(() => computeInitialState().initScores);
  const [committedTotals, setCommittedTotals] = useState<Record<string, number>>(() => computeInitialState().initTotals);
  const [activeInputKey, setActiveInputKey] = useState<string | null>(null);

  // Sync scores state explicitly keyed by student.regNo when selectedExamId or class changes
  useEffect(() => {
    const { initScores, initTotals } = computeInitialState();
    setScores(initScores);
    setCommittedTotals(initTotals);
  }, [selectedExamId, selectedClass, examResults, studentsWithRegNo]);

  const getStudentScores = (regNo: string, studentId: string, result: any): ScoreEntry => {
    if (scores[regNo]) {
      return scores[regNo];
    }
    if (scores[studentId]) {
      return scores[studentId];
    }
    const hasScores =
      result &&
      (result.ca1Score != null || result.ca2Score != null || result.examScore != null) &&
      (result.ca1Score > 0 || result.ca2Score > 0 || result.examScore > 0 || (result.score != null && result.score > 0));

    const firstCa =
      hasScores && result?.ca1Score != null
        ? String(Math.min(Math.max(result.ca1Score, 0), 15))
        : "";
    const secondCa =
      hasScores && result?.ca2Score != null
        ? String(Math.min(Math.max(result.ca2Score, 0), 15))
        : "";
    const exam =
      hasScores && result?.examScore != null
        ? String(Math.min(Math.max(result.examScore, 0), 70))
        : "";

    return {
      firstCa,
      secondCa,
      exam,
      ca1: firstCa,
      ca2: secondCa,
    };
  };

  // Explicitly keyed update handler bound directly to student.regNo with strict score validation
  const handleInputChange = (
    regNo: string,
    field: "firstCa" | "secondCa" | "exam",
    value: string,
    studentId: string,
    result: any
  ) => {
    let sanitizedValue = value;
    if (sanitizedValue !== "") {
      const num = parseFloat(sanitizedValue);
      if (!isNaN(num)) {
        if ((field === "firstCa" || field === "secondCa") && num > 15) {
          sanitizedValue = "15";
        } else if (field === "exam" && num > 70) {
          sanitizedValue = "70";
        } else if (num < 0) {
          sanitizedValue = "0";
        }
      }
    }

    const current = getStudentScores(regNo, studentId, result);
    setScores((prev) => ({
      ...prev,
      [regNo]: {
        ...current,
        [field]: sanitizedValue,
        ca1: field === "firstCa" ? sanitizedValue : current.firstCa,
        ca2: field === "secondCa" ? sanitizedValue : current.secondCa,
      },
    }));
  };

  const handleSaveResult = (regNo: string, student: any, result: any) => {
    if (!selectedExam) return;

    const studentScores = getStudentScores(regNo, student.id, result);
    const ca1Str = (studentScores.firstCa || "").trim();
    const ca2Str = (studentScores.secondCa || "").trim();
    const examStr = (studentScores.exam || "").trim();

    // Do NOT calculate or save if row is completely empty
    if (ca1Str === "" && ca2Str === "" && examStr === "") {
      setCommittedTotals((prev) => ({
        ...prev,
        [regNo]: -1,
      }));
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

    // Commit new total into finished dataset
    setCommittedTotals((prev) => ({
      ...prev,
      [regNo]: totalScore,
    }));

    startTransition(() => {
      upsertExamResult(
        schoolId,
        selectedExamId,
        student.id,
        totalScore,
        ca1Str !== "" ? ca1 : undefined,
        ca2Str !== "" ? ca2 : undefined,
        examStr !== "" ? exam : undefined,
        letterGrade,
        ""
      );
    });
  };

  // 8. Dynamic Ranking calculation based on the finished total dataset
  const rankMap = useMemo(() => {
    const list = studentsWithRegNo.map((s) => {
      const score = committedTotals[s.regNo] ?? -1;
      return {
        regNo: s.regNo,
        totalScore: score,
        name: `${s.lastName} ${s.firstName}`.toLowerCase(),
      };
    });

    list.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.name.localeCompare(b.name);
    });

    const ranks: Record<string, number> = {};
    let currentRank = 1;
    list.forEach((item) => {
      if (item.totalScore >= 0) {
        ranks[item.regNo] = currentRank;
        currentRank++;
      } else {
        ranks[item.regNo] = 0; // Unranked / empty
      }
    });

    return ranks;
  }, [studentsWithRegNo, committedTotals]);

  // 9. Stable Display Order: Protected from shuffling while user is actively typing in a cell
  const [displayOrder, setDisplayOrder] = useState<string[]>(() => {
    const { initTotals } = computeInitialState();
    const sorted = [...studentsWithRegNo].sort((a, b) => {
      const scoreA = initTotals[a.regNo] ?? -1;
      const scoreB = initTotals[b.regNo] ?? -1;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return sorted.map((s) => s.regNo);
  });

  useEffect(() => {
    // If the teacher is actively typing inside an active column cell, do NOT shuffle visible rows
    if (activeInputKey !== null) return;

    const sorted = [...studentsWithRegNo].sort((a, b) => {
      const scoreA = committedTotals[a.regNo] ?? -1;
      const scoreB = committedTotals[b.regNo] ?? -1;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setDisplayOrder(sorted.map((s) => s.regNo));
  }, [studentsWithRegNo, committedTotals, activeInputKey]);

  // Map displayOrder back to student records
  const orderedStudents = useMemo(() => {
    const map = new Map(studentsWithRegNo.map((s) => [s.regNo, s]));
    const list: typeof studentsWithRegNo = [];
    displayOrder.forEach((regNo) => {
      const s = map.get(regNo);
      if (s) list.push(s);
    });
    // Add any student missing from displayOrder
    studentsWithRegNo.forEach((s) => {
      if (!displayOrder.includes(s.regNo)) {
        list.push(s);
      }
    });
    return list;
  }, [studentsWithRegNo, displayOrder]);

  // 10. Isolated Class Average Total calculation (strictly for finished scores in selected class)
  const evaluatedScores = Object.values(committedTotals).filter((val) => val >= 0);
  const classAverage =
    evaluatedScores.length > 0
      ? (evaluatedScores.reduce((sum, val) => sum + val, 0) / evaluatedScores.length).toFixed(1)
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
              Based on {evaluatedScores.length} evaluated student{evaluatedScores.length === 1 ? "" : "s"}
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
      ) : orderedStudents.length === 0 ? (
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
                {showPositionColumn && (
                  <th className="px-6 py-4 font-semibold text-center">Position</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orderedStudents.map((student) => {
                const result = currentExamResults.get(student.id);
                const studentScores = getStudentScores(student.regNo, student.id, result);
                const ca1Str = (studentScores.firstCa || "").trim();
                const ca2Str = (studentScores.secondCa || "").trim();
                const examStr = (studentScores.exam || "").trim();

                const isEmptyRow = ca1Str === "" && ca2Str === "" && examStr === "";
                const position = rankMap[student.regNo] || 0;

                let totalDisplay: string = "—";
                let gradeDisplay: string = "—";

                if (!isEmptyRow) {
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
                  totalDisplay = String(totalScore);

                  const tierName = selectedExam.course?.tier?.name || activeTierDisplay;
                  const isHigherEd =
                    tierName.toLowerCase().includes("higher") ||
                    tierName.toLowerCase().includes("university") ||
                    tierName.toLowerCase().includes("college");

                  const percentage = Math.min((totalScore / 100) * 100, 100);
                  gradeDisplay = calculatePercentageToLetter(percentage, isHigherEd);
                }

                const isCa1Over =
                  ca1Str !== "" && (parseFloat(ca1Str) > 15 || parseFloat(ca1Str) < 0);
                const isCa2Over =
                  ca2Str !== "" && (parseFloat(ca2Str) > 15 || parseFloat(ca2Str) < 0);
                const isExamOver =
                  examStr !== "" && (parseFloat(examStr) > 70 || parseFloat(examStr) < 0);

                return (
                  <tr key={student.regNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {student.lastName}, {student.firstName}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-300 select-none">
                      {student.regNo}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        id={`input-${student.regNo}-ca1`}
                        type="number"
                        min="0"
                        max="15"
                        step="0.5"
                        disabled={isPending}
                        value={studentScores.firstCa}
                        onFocus={() => setActiveInputKey(student.regNo)}
                        onChange={(e) => handleInputChange(student.regNo, "firstCa", e.target.value, student.id, result)}
                        onBlur={() => {
                          setActiveInputKey(null);
                          handleSaveResult(student.regNo, student, result);
                        }}
                        className={`w-20 border rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                          isCa1Over
                            ? "border-rose-500 ring-2 ring-rose-500 text-rose-600 dark:text-rose-400 focus:ring-rose-500"
                            : "border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                        }`}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        id={`input-${student.regNo}-ca2`}
                        type="number"
                        min="0"
                        max="15"
                        step="0.5"
                        disabled={isPending}
                        value={studentScores.secondCa}
                        onFocus={() => setActiveInputKey(student.regNo)}
                        onChange={(e) => handleInputChange(student.regNo, "secondCa", e.target.value, student.id, result)}
                        onBlur={() => {
                          setActiveInputKey(null);
                          handleSaveResult(student.regNo, student, result);
                        }}
                        className={`w-20 border rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                          isCa2Over
                            ? "border-rose-500 ring-2 ring-rose-500 text-rose-600 dark:text-rose-400 focus:ring-rose-500"
                            : "border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                        }`}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        id={`input-${student.regNo}-exam`}
                        type="number"
                        min="0"
                        max="70"
                        step="0.5"
                        disabled={isPending}
                        value={studentScores.exam}
                        onFocus={() => setActiveInputKey(student.regNo)}
                        onChange={(e) => handleInputChange(student.regNo, "exam", e.target.value, student.id, result)}
                        onBlur={() => {
                          setActiveInputKey(null);
                          handleSaveResult(student.regNo, student, result);
                        }}
                        className={`w-20 border rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                          isExamOver
                            ? "border-rose-500 ring-2 ring-rose-500 text-rose-600 dark:text-rose-400 focus:ring-rose-500"
                            : "border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                        }`}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                      {totalDisplay}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                      {gradeDisplay}
                    </td>
                    {showPositionColumn && (
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 text-xs font-bold rounded-md ${
                            position === 1
                              ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-sm"
                              : position === 2
                              ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-sm"
                              : position === 3
                              ? "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700 shadow-sm"
                              : position > 3
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                              : "bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700"
                          }`}
                          title={position > 0 ? `Position in ${selectedClass}: ${getOrdinalSuffix(position)}` : "Unranked / Absent"}
                        >
                          {position > 0 ? getOrdinalSuffix(position) : "—"}
                        </span>
                      </td>
                    )}
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
