"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { upsertExamResult } from "./actions";
import { useTenant } from "@/lib/tenant-context";
import { formatTierBadgeCode, resolveSchoolPrefix } from "@/lib/tenant-tier-utils";
import {
  calculateBonaVeeResult,
  normalizeTierLevel,
  getGradeRemark,
  InstitutionalTier,
} from "@/lib/assessmentEngine";

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
    "Pre-School / Kindergarten",
  ],
  PRIMARY: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
  ],
  SECONDARY: [
    "JSS 1",
    "JSS 2",
    "JSS 3",
    "SS 1",
    "SS 2",
    "SS 3",
  ],
  UNIVERSITY: [
    "100 Level",
    "200 Level",
    "300 Level",
    "400 Level",
    "500 Level",
  ],
  POLYTECHNIC: [
    "ND 1",
    "ND 2",
    "HND 1",
    "HND 2",
  ],
  COLLEGE: [
    "NCE 1",
    "NCE 2",
    "NCE 3",
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

// -------------------------------------------------------------
// Fallback Clean Mock Student Records per Tier for Instant Testing
// -------------------------------------------------------------

const DEFAULT_MOCK_JSS1_STUDENTS = [
  {
    id: "mock-jss1-001",
    firstName: "Chinedu",
    lastName: "Okonkwo",
    admissionNumber: "GW/2026/JSS1/001",
    currentClass: "JSS 1",
    status: "ENROLLED",
    tier: { name: "Secondary School" },
    initialScores: { ca1: "18", ca2: "17", exam: "52" },
  },
  {
    id: "mock-jss1-002",
    firstName: "Amina",
    lastName: "Bello",
    admissionNumber: "GW/2026/JSS1/002",
    currentClass: "JSS 1",
    status: "ENROLLED",
    tier: { name: "Secondary School" },
    initialScores: { ca1: "16", ca2: "15", exam: "45" },
  },
  {
    id: "mock-jss1-003",
    firstName: "Folake",
    lastName: "Adeyemi",
    admissionNumber: "GW/2026/JSS1/003",
    currentClass: "JSS 1",
    status: "ENROLLED",
    tier: { name: "Secondary School" },
    initialScores: { ca1: "14", ca2: "16", exam: "38" },
  },
  {
    id: "mock-jss1-004",
    firstName: "Emeka",
    lastName: "Nwosu",
    admissionNumber: "GW/2026/JSS1/004",
    currentClass: "JSS 1",
    status: "ENROLLED",
    tier: { name: "Secondary School" },
    initialScores: { ca1: "12", ca2: "11", exam: "31" },
  },
  {
    id: "mock-jss1-005",
    firstName: "Zainab",
    lastName: "Abubakar",
    admissionNumber: "GW/2026/JSS1/005",
    currentClass: "JSS 1",
    status: "ENROLLED",
    tier: { name: "Secondary School" },
    initialScores: { ca1: "9", ca2: "10", exam: "24" },
  },
];

const DEFAULT_MOCK_PRIMARY_STUDENTS = [
  {
    id: "mock-pri-001",
    firstName: "Kenechukwu",
    lastName: "Obi",
    admissionNumber: "GW/2026/PRI1/001",
    currentClass: "Primary 1",
    status: "ENROLLED",
    tier: { name: "Primary School" },
    initialScores: { assignment: "9", test: "18", project: "9", exam: "52" },
  },
  {
    id: "mock-pri-002",
    firstName: "Hauwa",
    lastName: "Mohammed",
    admissionNumber: "GW/2026/PRI1/002",
    currentClass: "Primary 1",
    status: "ENROLLED",
    tier: { name: "Primary School" },
    initialScores: { assignment: "8", test: "16", project: "8", exam: "46" },
  },
  {
    id: "mock-pri-003",
    firstName: "Babatunde",
    lastName: "Adeleke",
    admissionNumber: "GW/2026/PRI1/003",
    currentClass: "Primary 1",
    status: "ENROLLED",
    tier: { name: "Primary School" },
    initialScores: { assignment: "7", test: "14", project: "7", exam: "40" },
  },
  {
    id: "mock-pri-004",
    firstName: "Ngozi",
    lastName: "Eze",
    admissionNumber: "GW/2026/PRI1/004",
    currentClass: "Primary 1",
    status: "ENROLLED",
    tier: { name: "Primary School" },
    initialScores: { assignment: "6", test: "12", project: "6", exam: "34" },
  },
];

const DEFAULT_MOCK_NURSERY_STUDENTS = [
  {
    id: "mock-nur-001",
    firstName: "Somtochukwu",
    lastName: "Nnamdi",
    admissionNumber: "GW/2026/NUR1/001",
    currentClass: "Nursery 1",
    status: "ENROLLED",
    tier: { name: "Daycare / Nursery" },
    initialScores: { observation: "90", classwork: "85", affective: "95" },
  },
  {
    id: "mock-nur-002",
    firstName: "Aisha",
    lastName: "Ibrahim",
    admissionNumber: "GW/2026/NUR1/002",
    currentClass: "Nursery 1",
    status: "ENROLLED",
    tier: { name: "Daycare / Nursery" },
    initialScores: { observation: "85", classwork: "80", affective: "85" },
  },
  {
    id: "mock-nur-003",
    firstName: "David",
    lastName: "Ojo",
    admissionNumber: "GW/2026/NUR1/003",
    currentClass: "Nursery 1",
    status: "ENROLLED",
    tier: { name: "Daycare / Nursery" },
    initialScores: { observation: "75", classwork: "70", affective: "80" },
  },
  {
    id: "mock-nur-004",
    firstName: "Fatima",
    lastName: "Garba",
    admissionNumber: "GW/2026/NUR1/004",
    currentClass: "Nursery 1",
    status: "ENROLLED",
    tier: { name: "Daycare / Nursery" },
    initialScores: { observation: "65", classwork: "60", affective: "70" },
  },
];

const DEFAULT_MOCK_TERTIARY_STUDENTS = [
  {
    id: "mock-tert-001",
    firstName: "Chinonso",
    lastName: "Madu",
    admissionNumber: "GW/2026/UNI/001",
    currentClass: "100 Level",
    status: "ENROLLED",
    tier: { name: "University" },
    initialScores: { assignment: "9", test: "18", exam: "62" },
  },
  {
    id: "mock-tert-002",
    firstName: "Zainab",
    lastName: "Usman",
    admissionNumber: "GW/2026/UNI/002",
    currentClass: "100 Level",
    status: "ENROLLED",
    tier: { name: "University" },
    initialScores: { assignment: "8", test: "16", exam: "52" },
  },
  {
    id: "mock-tert-003",
    firstName: "Olumide",
    lastName: "Bakare",
    admissionNumber: "GW/2026/UNI/003",
    currentClass: "100 Level",
    status: "ENROLLED",
    tier: { name: "University" },
    initialScores: { assignment: "7", test: "14", exam: "44" },
  },
  {
    id: "mock-tert-004",
    firstName: "Blessing",
    lastName: "Umeh",
    admissionNumber: "GW/2026/UNI/004",
    currentClass: "100 Level",
    status: "ENROLLED",
    tier: { name: "University" },
    initialScores: { assignment: "6", test: "12", exam: "36" },
  },
];

// Helper to determine if a score row is completely empty
function isRowEmpty(scores?: Record<string, string>): boolean {
  if (!scores) return true;
  const values = Object.values(scores);
  if (values.length === 0) return true;
  return values.every((v) => !v || v.trim() === "");
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

  // 1. Resolve Active Academic Tier
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
    academicTiers[0]?.name ||
    "Secondary School";

  const normalizedTier = normalizeTierLevel(rawActiveTier);
  const activeTierCode = formatTierBadgeCode(rawActiveTier);
  const activeTierDisplay = normalizedTier;

  // Derive active tier category for dynamic column shifting
  const tierCategory: "NURSERY" | "PRIMARY" | "SECONDARY" | "TERTIARY" = useMemo(() => {
    if (normalizedTier === "Daycare / Nursery") return "NURSERY";
    if (normalizedTier === "Primary School") return "PRIMARY";
    if (normalizedTier === "Secondary School") return "SECONDARY";
    return "TERTIARY";
  }, [normalizedTier]);

  const isTertiaryTier = tierCategory === "TERTIARY";

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

  // 3. Selected Class State
  const paramClass = searchParams.get("class");
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (paramClass) {
      const matched = availableClasses.find((c) => matchesClass(c, paramClass));
      if (matched) return matched;
    }
    return availableClasses[0] || (tierCategory === "SECONDARY" ? "JSS 1" : "Primary 1");
  });

  useEffect(() => {
    if (paramClass) {
      const matched = availableClasses.find((c) => matchesClass(c, paramClass));
      if (matched) setSelectedClass(matched);
    }
  }, [paramClass, availableClasses]);

  // Reset selected class on tier switch
  const prevTierCodeRef = useRef(activeTierCode);
  useEffect(() => {
    if (prevTierCodeRef.current !== activeTierCode) {
      prevTierCodeRef.current = activeTierCode;
      const newClasses = TIER_CLASSES_MAP[activeTierCode] || TIER_CLASSES_MAP.SECONDARY;
      setSelectedClass(newClasses[0] || "JSS 1");
    }
  }, [activeTierCode]);

  // 4. Exams filtered to active tier
  const tierExams = useMemo(() => {
    const matched = exams.filter((e) => {
      const examTierName = e.course?.tier?.name;
      if (examTierName) {
        return formatTierBadgeCode(examTierName) === activeTierCode;
      }
      return true;
    });
    if (matched.length > 0) return matched;
    if (exams.length > 0) return exams;

    const fallbackCourse =
      tierCategory === "TERTIARY"
        ? "MTH 101 - General Mathematics"
        : tierCategory === "NURSERY"
        ? "Numeracy & Cognitive Skills"
        : "Mathematics";

    return [
      {
        id: "mock-exam-default",
        name: tierCategory === "TERTIARY" ? "Semester Assessment" : "Termly Assessment",
        semester: tierCategory === "TERTIARY" ? "1st Semester" : "First Term",
        course: {
          id: "mock-course-default",
          name: fallbackCourse,
          tier: { name: activeTierDisplay },
        },
      },
    ];
  }, [exams, activeTierCode, tierCategory, activeTierDisplay]);

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    return tierExams[0]?.id || exams[0]?.id || "mock-exam-default";
  });

  useEffect(() => {
    if (tierExams.length > 0 && !tierExams.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(tierExams[0].id);
    }
  }, [tierExams, selectedExamId]);

  const selectedExam = tierExams.find((e) => e.id === selectedExamId) || exams.find((e) => e.id === selectedExamId);
  const activeSubjectOrCourse = selectedExam?.course?.name || selectedExam?.name || "Mathematics";

  // Existing results quick lookup: map[studentId] = result
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
  const rawFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      const status = student.status || "ENROLLED";
      if (status !== "ENROLLED" && status !== "ACTIVE") return false;

      const studentTierName = student.tier?.name;
      if (studentTierName) {
        const studentTierCode = formatTierBadgeCode(studentTierName);
        if (studentTierCode !== activeTierCode) return false;
      } else if (student.currentClass) {
        if (!isClassInTier(student.currentClass, activeTierCode)) return false;
      }

      if (!matchesClass(student.currentClass, selectedClass)) return false;

      return true;
    });
  }, [students, activeTierCode, selectedClass]);

  const filteredStudents = useMemo(() => {
    if (rawFilteredStudents.length > 0) {
      return rawFilteredStudents;
    }
    // Clean mock student data rows per tier when database is empty for testing
    if (tierCategory === "SECONDARY" && (matchesClass(selectedClass, "JSS 1") || activeTierCode === "SECONDARY")) {
      return DEFAULT_MOCK_JSS1_STUDENTS;
    }
    if (tierCategory === "PRIMARY") {
      return DEFAULT_MOCK_PRIMARY_STUDENTS;
    }
    if (tierCategory === "NURSERY") {
      return DEFAULT_MOCK_NURSERY_STUDENTS;
    }
    if (tierCategory === "TERTIARY") {
      return DEFAULT_MOCK_TERTIARY_STUDENTS;
    }
    return rawFilteredStudents;
  }, [rawFilteredStudents, selectedClass, activeTierCode, tierCategory]);

  // 6. Assign Permanent, Stable Registration Numbers
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

  // Compute Initial State Synchronously
  const computeInitialState = useCallback(() => {
    const initScores: Record<string, Record<string, string>> = {};
    const initTotals: Record<string, number> = {};

    studentsWithRegNo.forEach((student) => {
      const res = examResults.find(
        (r) => r.examId === selectedExamId && r.studentId === student.id
      );
      const studentMockScores = (student as any).initialScores || {};

      let rowMap: Record<string, string> = {};

      if (tierCategory === "NURSERY") {
        rowMap = {
          observation: res?.ca1Score != null ? String(res.ca1Score) : studentMockScores.observation || "",
          classwork: res?.ca2Score != null ? String(res.ca2Score) : studentMockScores.classwork || "",
          affective: res?.examScore != null ? String(res.examScore) : studentMockScores.affective || "",
        };
      } else if (tierCategory === "PRIMARY") {
        rowMap = {
          assignment: studentMockScores.assignment || (res?.ca1Score != null ? String(Math.min(res.ca1Score, 10)) : ""),
          test: studentMockScores.test || (res?.ca2Score != null ? String(Math.min(res.ca2Score, 20)) : ""),
          project: studentMockScores.project || "",
          exam: res?.examScore != null ? String(res.examScore) : studentMockScores.exam || "",
        };
      } else if (tierCategory === "SECONDARY") {
        rowMap = {
          ca1: res?.ca1Score != null ? String(res.ca1Score) : studentMockScores.ca1 || "",
          ca2: res?.ca2Score != null ? String(res.ca2Score) : studentMockScores.ca2 || "",
          exam: res?.examScore != null ? String(res.examScore) : studentMockScores.exam || "",
        };
      } else {
        // Higher Ed
        rowMap = {
          assignment: studentMockScores.assignment || (res?.ca1Score != null ? String(Math.min(res.ca1Score, 10)) : ""),
          test: studentMockScores.test || (res?.ca2Score != null ? String(Math.min(res.ca2Score, 20)) : ""),
          exam: res?.examScore != null ? String(res.examScore) : studentMockScores.exam || "",
        };
      }

      initScores[student.regNo] = rowMap;

      if (!isRowEmpty(rowMap)) {
        const computed = calculateBonaVeeResult(activeTierDisplay, rowMap);
        initTotals[student.regNo] = computed.total;
      } else {
        initTotals[student.regNo] = -1; // Screen hyphen empty-row indicator
      }
    });

    return { initScores, initTotals };
  }, [studentsWithRegNo, examResults, selectedExamId, tierCategory, activeTierDisplay]);

  // 7. Input state bound to student.regNo
  const [scores, setScores] = useState<Record<string, Record<string, string>>>(() => computeInitialState().initScores);
  const [committedTotals, setCommittedTotals] = useState<Record<string, number>>(() => computeInitialState().initTotals);
  const [activeInputKey, setActiveInputKey] = useState<string | null>(null);

  useEffect(() => {
    const { initScores, initTotals } = computeInitialState();
    setScores(initScores);
    setCommittedTotals(initTotals);
  }, [computeInitialState]);

  const getStudentScores = (regNo: string): Record<string, string> => {
    return scores[regNo] || {};
  };

  // 8. Interactive Score Input Change Handler with boundary validation
  const handleScoreChange = (regNo: string, fieldKey: string, value: string, maxVal: number) => {
    let sanitized = value;
    if (sanitized !== "") {
      const num = parseFloat(sanitized);
      if (!isNaN(num)) {
        if (num > maxVal) sanitized = String(maxVal);
        else if (num < 0) sanitized = "0";
      }
    }

    setScores((prev) => {
      const current = prev[regNo] || {};
      return {
        ...prev,
        [regNo]: {
          ...current,
          [fieldKey]: sanitized,
        },
      };
    });
  };

  // 9. Interactive Auto-Calculation on Blur or Enter
  const handleBlurOrEnter = (regNo: string, student: any, result: any) => {
    setActiveInputKey(null);
    const rowScores = scores[regNo] || {};

    if (isRowEmpty(rowScores)) {
      setCommittedTotals((prev) => ({
        ...prev,
        [regNo]: -1,
      }));
      return;
    }

    const calcResult = calculateBonaVeeResult(activeTierDisplay, rowScores);
    setCommittedTotals((prev) => ({
      ...prev,
      [regNo]: calcResult.total,
    }));

    // Secure database update constraint
    if (selectedExam && !student.id.startsWith("mock-") && !selectedExamId.startsWith("mock-")) {
      const ca1Num = Number(rowScores.ca1 || rowScores.assignment || rowScores.observation) || undefined;
      const ca2Num = Number(rowScores.ca2 || rowScores.test || rowScores.classwork) || undefined;
      const examNum = Number(rowScores.exam || rowScores.affective) || undefined;

      startTransition(() => {
        upsertExamResult(
          schoolId,
          selectedExamId,
          student.id,
          calcResult.total,
          ca1Num,
          ca2Num,
          examNum,
          calcResult.grade,
          getGradeRemark(calcResult.grade)
        );
      });
    }
  };

  // 10. Dynamic Ranking Engine based on calculated total score
  const rankMap = useMemo(() => {
    const list = studentsWithRegNo.map((s) => {
      const total = committedTotals[s.regNo] ?? -1;
      return {
        regNo: s.regNo,
        totalScore: total,
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
    list.forEach((item, index) => {
      if (item.totalScore >= 0) {
        if (index > 0 && item.totalScore < list[index - 1].totalScore) {
          currentRank = index + 1;
        }
        ranks[item.regNo] = currentRank;
      } else {
        ranks[item.regNo] = 0; // Unranked
      }
    });

    return ranks;
  }, [studentsWithRegNo, committedTotals]);

  // Order students strictly descending by total score
  const orderedStudents = useMemo(() => {
    return [...studentsWithRegNo].sort((a, b) => {
      const scoreA = committedTotals[a.regNo] ?? -1;
      const scoreB = committedTotals[b.regNo] ?? -1;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return a.regNo.localeCompare(b.regNo);
    });
  }, [studentsWithRegNo, committedTotals]);

  // 11. Aggregate Summary Analytics for Footer
  const analytics = useMemo(() => {
    const evaluated = orderedStudents
      .map((s) => committedTotals[s.regNo])
      .filter((tot): tot is number => tot !== undefined && tot >= 0);

    const count = evaluated.length;
    if (count === 0) {
      return { count: 0, average: "—", highest: "—", lowest: "—" };
    }

    const sum = evaluated.reduce((acc, curr) => acc + curr, 0);
    const average = (sum / count).toFixed(1);
    const highest = Math.max(...evaluated);
    const lowest = Math.min(...evaluated);

    return {
      count,
      average: `${average}%`,
      highest: `${highest}%`,
      lowest: `${lowest}%`,
    };
  }, [orderedStudents, committedTotals]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Filter and Context Controls Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Grading Spreadsheet & Roster
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {activeTierDisplay}
            </span>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dynamic grading matrix customized for {activeTierDisplay} standards.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Class / Level Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isTertiaryTier ? "Level:" : "Class:"}
            </label>
            <select
              className="border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-3 text-sm font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment / Exam Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assessment:
            </label>
            <select
              className="border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-3 text-sm min-w-[200px] max-w-[320px] bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {tierExams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.semester}) - {e.course.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Roster Spreadsheet Table */}
      {orderedStudents.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="font-semibold text-base text-slate-700 dark:text-slate-200">
            No students found in {selectedClass}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            No enrolled students are currently assigned to {selectedClass} in {activeTierDisplay}.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              {/* 3. DYNAMIC COLUMN SHIFTING: HEADERS */}
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Student</th>
                  <th className="px-6 py-4 text-left">Reg No</th>
                  <th className="px-6 py-4 text-left">
                    {tierCategory === "TERTIARY" ? "Course" : "Subject"}
                  </th>

                  {/* Dynamic Middle Input Headers */}
                  {tierCategory === "NURSERY" && (
                    <>
                      <th className="px-4 py-4 text-center">Observation</th>
                      <th className="px-4 py-4 text-center">Classwork</th>
                      <th className="px-4 py-4 text-center">Affective</th>
                      <th className="px-4 py-4 text-center">Total</th>
                      <th className="px-4 py-4 text-center">Position</th>
                    </>
                  )}

                  {tierCategory === "PRIMARY" && (
                    <>
                      <th className="px-4 py-4 text-center">Assignment</th>
                      <th className="px-4 py-4 text-center">Test</th>
                      <th className="px-4 py-4 text-center">Project</th>
                      <th className="px-4 py-4 text-center">Exam</th>
                      <th className="px-4 py-4 text-center">Total</th>
                      <th className="px-4 py-4 text-center">Grade</th>
                      <th className="px-4 py-4 text-center">Position</th>
                    </>
                  )}

                  {tierCategory === "SECONDARY" && (
                    <>
                      <th className="px-4 py-4 text-center">CA1 (Max 20)</th>
                      <th className="px-4 py-4 text-center">CA2 (Max 20)</th>
                      <th className="px-4 py-4 text-center">Termly Exam (Max 60)</th>
                      <th className="px-4 py-4 text-center">Total (100)</th>
                      <th className="px-4 py-4 text-center">Grade</th>
                      <th className="px-4 py-4 text-center">Position</th>
                    </>
                  )}

                  {tierCategory === "TERTIARY" && (
                    <>
                      <th className="px-4 py-4 text-center">Assignment (10%)</th>
                      <th className="px-4 py-4 text-center">Test (20%)</th>
                      <th className="px-4 py-4 text-center">Exam (70%)</th>
                      <th className="px-4 py-4 text-center">Total (100)</th>
                      <th className="px-4 py-4 text-center">GP</th>
                      <th className="px-4 py-4 text-center">Grade</th>
                    </>
                  )}
                </tr>
              </thead>

              {/* 3. DYNAMIC COLUMN SHIFTING: BODY ROWS */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orderedStudents.map((student) => {
                  const result = currentExamResults.get(student.id);
                  const rowScores = getStudentScores(student.regNo);
                  const empty = isRowEmpty(rowScores);

                  let totalDisplay = "—";
                  let gradeDisplay = "—";
                  let gpDisplay = "—";

                  if (!empty) {
                    const calc = calculateBonaVeeResult(activeTierDisplay, rowScores);
                    totalDisplay = String(calc.total);
                    gradeDisplay = calc.grade;
                    gpDisplay = calc.gp.toFixed(2);
                  }

                  const rank = rankMap[student.regNo] || 0;
                  const rankDisplay = rank > 0 ? getOrdinalSuffix(rank) : "—";

                  return (
                    <tr
                      key={student.regNo}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Column 1: Student */}
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {student.lastName}, {student.firstName}
                      </td>

                      {/* Column 2: Reg No */}
                      <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500 dark:text-slate-300 select-none whitespace-nowrap">
                        {student.regNo}
                      </td>

                      {/* Column 3: Subject / Course */}
                      <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {activeSubjectOrCourse}
                      </td>

                      {/* Tier 1: Daycare / Nursery */}
                      {tierCategory === "NURSERY" && (
                        <>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rowScores.observation || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "observation", e.target.value, 100)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 100"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rowScores.classwork || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "classwork", e.target.value, 100)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 100"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rowScores.affective || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "affective", e.target.value, 100)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 100"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap font-bold text-slate-900 dark:text-white font-mono">
                            {totalDisplay}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {rankDisplay}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Tier 2: Primary School */}
                      {tierCategory === "PRIMARY" && (
                        <>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={rowScores.assignment || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "assignment", e.target.value, 10)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-18 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 10"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={rowScores.test || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "test", e.target.value, 20)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-18 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 20"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={rowScores.project || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "project", e.target.value, 10)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-18 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 10"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={rowScores.exam || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "exam", e.target.value, 60)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 60"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap font-bold text-slate-900 dark:text-white font-mono">
                            {totalDisplay}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {gradeDisplay === "—" ? (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded font-black text-xs font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {gradeDisplay}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {rankDisplay}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Tier 3: Secondary School */}
                      {tierCategory === "SECONDARY" && (
                        <>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={rowScores.ca1 || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "ca1", e.target.value, 20)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 20"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={rowScores.ca2 || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "ca2", e.target.value, 20)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 20"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={rowScores.exam || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "exam", e.target.value, 60)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 60"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap font-bold text-slate-900 dark:text-white font-mono">
                            {totalDisplay}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {gradeDisplay === "—" ? (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded font-black text-xs font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {gradeDisplay}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {rankDisplay}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Tier 4: Higher Education Tiers */}
                      {tierCategory === "TERTIARY" && (
                        <>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={rowScores.assignment || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "assignment", e.target.value, 10)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 10"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={rowScores.test || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "test", e.target.value, 20)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 20"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="70"
                              value={rowScores.exam || ""}
                              onChange={(e) => handleScoreChange(student.regNo, "exam", e.target.value, 70)}
                              onBlur={() => handleBlurOrEnter(student.regNo, student, result)}
                              onKeyDown={(e) => e.key === "Enter" && handleBlurOrEnter(student.regNo, student, result)}
                              className="w-20 mx-auto rounded-lg p-1.5 text-center text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
                              placeholder="0 - 70"
                            />
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap font-bold text-slate-900 dark:text-white font-mono">
                            {totalDisplay}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className="font-extrabold text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              {gpDisplay}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {gradeDisplay === "—" ? (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded font-black text-xs font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {gradeDisplay}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5. AGGREGATE SUMMARY FOOTER GENERATION */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 p-5 rounded-b-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Class Average Total Score */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Class Average Total Score
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {analytics.average}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({analytics.count} evaluated)
                  </span>
                </div>
              </div>

              {/* Card 2: Highest Score in Class */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Highest Score in Class
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {analytics.highest}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Top Performance
                  </span>
                </div>
              </div>

              {/* Card 3: Lowest Score in Class */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Lowest Score in Class
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                    {analytics.lowest}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Baseline Mark
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
