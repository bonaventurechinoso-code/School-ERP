"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { saveBroadsheetScore, seedDemoGradingScores, clearDemoGradingScores } from "./actions";
import { getSubjectsForClassAndTier } from "./ExamsList";
import { useTenant } from "@/lib/tenant-context";
import { formatTierBadgeCode, resolveSchoolPrefix } from "@/lib/tenant-tier-utils";
import { normalizeTierLevel } from "@/lib/assessmentEngine";
import {
  Download,
  Printer,
  Edit3,
  Search,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Award,
  Layers,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  getTierForClass,
  getClassesForSchool,
  EducationalTierCategory,
} from "@/lib/school-tier-classes";

type GradingRosterProps = {
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

// Canonical classes mapped to each Nigerian Educational Tier
const TIER_CLASSES_MAP: Record<string, string[]> = {
  NURSERY: [
    "Creche",
    "Creche / Nursery",
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

// Authentic Nigerian Standard Curriculum Subjects by Tier (Used only as fallback when unseeded in DB)
const STANDARD_TIER_SUBJECTS: Record<string, string[]> = {
  NURSERY: [
    "Literacy & Phonics",
    "Numeracy & Logic",
    "Sensory & Creative Arts",
    "Social Habits & Civics",
    "Health & Physical Dev",
    "Rhymes & Rhythm",
  ],
  PRIMARY: [
    "English Studies",
    "Mathematics",
    "Basic Science & Tech",
    "Social Studies",
    "Civic Education",
    "Cultural & Creative Arts",
    "Agricultural Science",
    "Computer Studies / ICT",
    "Christian Religious Studies",
    "Physical & Health Education",
  ],
  JSS: [
    "English Language",
    "Mathematics",
    "Basic Science",
    "Basic Technology",
    "Social Studies",
    "Civic Education",
    "Agricultural Science",
    "Business Studies",
    "Computer Studies",
    "Christian Religious Studies",
    "Home Economics",
    "Physical & Health Educ",
    "French Language",
  ],
  SSS: [
    "English Language",
    "General Mathematics",
    "Economics",
    "Civic Education",
    "Biology",
    "Physics",
    "Chemistry",
    "Government",
    "Literature-in-English",
    "Financial Accounting",
    "Further Mathematics",
  ],
  TERTIARY: [
    "GST 101 - Use of English",
    "GST 102 - Philosophy & Logic",
    "MTH 101 - Elementary Mathematics",
    "PHY 101 - General Physics",
    "CHM 101 - General Chemistry",
    "BIO 101 - General Biology",
    "COS 101 - Intro to Computing",
  ],
};

function isNurseryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("NURSERY") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("PRE-SCHOOL") ||
    norm.includes("PRE SCHOOL") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("RECEPTION")
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

  const sCompact = s.replace(/\s+/g, "");
  const tCompact = t.replace(/\s+/g, "");
  if (sCompact === tCompact) return true;

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

function getTermVariants(term: string): string[] {
  const t = (term || "").trim().toLowerCase();
  if (t.includes("1") || t.includes("first")) {
    return ["1st Term", "First Term", "Term 1", "first term", "1st term", "1st Semester"];
  }
  if (t.includes("2") || t.includes("second")) {
    return ["2nd Term", "Second Term", "Term 2", "second term", "2nd term", "2nd Semester"];
  }
  if (t.includes("3") || t.includes("third")) {
    return ["3rd Term", "Third Term", "Term 3", "third term", "3rd term"];
  }
  return [term];
}

// Tier-Specific Nigerian Grading Functions
function resolveTierGrade(tierCategory: string, score: number): { letter: string; remark: string; badgeColor: string } {
  if (tierCategory === "NURSERY") {
    if (score >= 75) return { letter: "EE", remark: "Exceeding Expectations", badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" };
    if (score >= 60) return { letter: "ME", remark: "Meeting Expectations", badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300" };
    if (score >= 40) return { letter: "DV", remark: "Developing", badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300" };
    return { letter: "EM", remark: "Emerging", badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300" };
  }

  if (tierCategory === "PRIMARY") {
    if (score >= 75) return { letter: "Distinction", remark: "Distinction", badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" };
    if (score >= 65) return { letter: "Very Good", remark: "Very Good", badgeColor: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300" };
    if (score >= 50) return { letter: "Credit", remark: "Credit", badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300" };
    if (score >= 40) return { letter: "Pass", remark: "Pass", badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300" };
    return { letter: "Fail", remark: "Fail", badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300" };
  }

  if (tierCategory === "TERTIARY") {
    if (score >= 70) return { letter: "A", remark: "First Class", badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" };
    if (score >= 60) return { letter: "B", remark: "Second Class Upper", badgeColor: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300" };
    if (score >= 50) return { letter: "C", remark: "Second Class Lower", badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300" };
    if (score >= 45) return { letter: "D", remark: "Third Class", badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300" };
    if (score >= 40) return { letter: "E", remark: "Pass", badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300" };
    return { letter: "F", remark: "Fail", badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300" };
  }

  // Default: Secondary School WAEC 9-point scale
  if (score >= 75) return { letter: "A1", remark: "Distinction", badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" };
  if (score >= 70) return { letter: "B2", remark: "Very Good", badgeColor: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300" };
  if (score >= 65) return { letter: "B3", remark: "Good", badgeColor: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300" };
  if (score >= 60) return { letter: "C4", remark: "Credit", badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300" };
  if (score >= 55) return { letter: "C5", remark: "Credit", badgeColor: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300 border-blue-300" };
  if (score >= 50) return { letter: "C6", remark: "Credit", badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300" };
  if (score >= 45) return { letter: "D7", remark: "Pass", badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300" };
  if (score >= 40) return { letter: "E8", remark: "Pass", badgeColor: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300" };
  return { letter: "F9", remark: "Fail", badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300" };
}

// Fallback Mock Students per Tier for testing when database is unseeded
const DEFAULT_MOCK_JSS1_STUDENTS = [
  { id: "mock-jss1-001", firstName: "Chinedu", lastName: "Okonkwo", admissionNumber: "GW/2026/JSS1/001", currentClass: "JSS 1", status: "ENROLLED" },
  { id: "mock-jss1-002", firstName: "Amina", lastName: "Bello", admissionNumber: "GW/2026/JSS1/002", currentClass: "JSS 1", status: "ENROLLED" },
  { id: "mock-jss1-003", firstName: "Folake", lastName: "Adeyemi", admissionNumber: "GW/2026/JSS1/003", currentClass: "JSS 1", status: "ENROLLED" },
  { id: "mock-jss1-004", firstName: "Emeka", lastName: "Nwosu", admissionNumber: "GW/2026/JSS1/004", currentClass: "JSS 1", status: "ENROLLED" },
  { id: "mock-jss1-005", firstName: "Zainab", lastName: "Abubakar", admissionNumber: "GW/2026/JSS1/005", currentClass: "JSS 1", status: "ENROLLED" },
];

const DEFAULT_MOCK_PRIMARY_STUDENTS = [
  { id: "mock-pri-001", firstName: "Kenechukwu", lastName: "Obi", admissionNumber: "GW/2026/PRI1/001", currentClass: "Primary 1", status: "ENROLLED" },
  { id: "mock-pri-002", firstName: "Hauwa", lastName: "Mohammed", admissionNumber: "GW/2026/PRI1/002", currentClass: "Primary 1", status: "ENROLLED" },
  { id: "mock-pri-003", firstName: "Babatunde", lastName: "Adeleke", admissionNumber: "GW/2026/PRI1/003", currentClass: "Primary 1", status: "ENROLLED" },
  { id: "mock-pri-004", firstName: "Ngozi", lastName: "Eze", admissionNumber: "GW/2026/PRI1/004", currentClass: "Primary 1", status: "ENROLLED" },
];

const DEFAULT_MOCK_NURSERY_STUDENTS = [
  { id: "mock-nur-001", firstName: "Somtochukwu", lastName: "Nnamdi", admissionNumber: "GW/2026/NUR1/001", currentClass: "Nursery 1", status: "ENROLLED" },
  { id: "mock-nur-002", firstName: "Aisha", lastName: "Ibrahim", admissionNumber: "GW/2026/NUR1/002", currentClass: "Nursery 1", status: "ENROLLED" },
  { id: "mock-nur-003", firstName: "David", lastName: "Ojo", admissionNumber: "GW/2026/NUR1/003", currentClass: "Nursery 1", status: "ENROLLED" },
  { id: "mock-nur-004", firstName: "Fatima", lastName: "Garba", admissionNumber: "GW/2026/NUR1/004", currentClass: "Nursery 1", status: "ENROLLED" },
];

interface ScoreModalState {
  isOpen: boolean;
  student: any;
  subject: string;
  ca1: number;
  ca2: number;
  exam: number;
  remarks: string;
}

export default function GradingRoster({
  schoolId,
  schoolDomain,
  schoolName,
  schoolTier,
  exams,
  students,
  examResults,
  gradeRecords = [],
  academicRecords = [],
  courses = [],
  classrooms = [],
  academicTiers = [],
  activeTierName: initialActiveTierName = "",
}: GradingRosterProps) {
  const router = useRouter();
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const effectiveDomain = schoolDomain || (tenant as any)?.subdomain || "";
  const isDemo = effectiveDomain.toLowerCase().trim() === "demo";
  const schoolDisplayName = schoolName || (tenant as any)?.name || effectiveDomain || "School";
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);

  // 1. Resolve Registered School Tiers & Scoped Classes (Single Source of Truth)
  const schoolClassesResult = useMemo(() => {
    return getClassesForSchool(
      {
        schoolId,
        name: schoolDisplayName,
        subdomain: effectiveDomain,
        tier: schoolTier,
        academicTiers,
      },
      {
        students,
        classrooms,
      }
    );
  }, [schoolId, schoolDisplayName, effectiveDomain, schoolTier, academicTiers, students, classrooms]);

  const { groups: classGroups, allClasses: availableClasses, defaultClass: schoolDefaultClass, tierInfo } = schoolClassesResult;

  // 2. Selected Class, Term & Academic Session
  const paramClass = searchParams.get("class");
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (paramClass) {
      const matched = availableClasses.find((c) => matchesClass(c, paramClass));
      if (matched) return matched;
    }
    return schoolDefaultClass || availableClasses[0] || "Primary 1";
  });

  // Ensure selectedClass remains valid when availableClasses updates
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.some((c) => matchesClass(c, selectedClass))) {
      setSelectedClass(schoolDefaultClass || availableClasses[0]);
    }
  }, [availableClasses, schoolDefaultClass, selectedClass]);

  // 3. Dynamic Tier resolution for the SELECTED class (Requirement E: Tier badge follows selected class)
  const selectedClassTier = useMemo(() => {
    return getTierForClass(selectedClass);
  }, [selectedClass]);

  const activeTierDisplay = selectedClassTier.name;
  const activeTierCode = selectedClassTier.badgeCode;
  const tierCategory: EducationalTierCategory = selectedClassTier.category;
  const isTertiaryTier = tierCategory === "TERTIARY";

  const [selectedTerm, setSelectedTerm] = useState<string>("1st Term");
  const [academicSession, setAcademicSession] = useState<string>("2026/2027");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 4. Resolve ALL Subjects for the Class and Tier (Assigned curriculum subjects for Class + Tier)
  const classSubjects = useMemo(() => {
    // A. Start with all assigned curriculum subjects for the selected class & tier (guarantees all subjects display even with no scores)
    const standardSubjects = getSubjectsForClassAndTier(selectedClass, tierCategory);
    const subjectsSet = new Set<string>(standardSubjects);

    // B. Include any recorded subjects specifically for this class & term in GradeRecord
    const termVars = getTermVariants(selectedTerm);
    gradeRecords.forEach((gr) => {
      if (matchesClass(gr.className, selectedClass) && termVars.includes(gr.term)) {
        if (gr.subject && gr.subject.trim()) subjectsSet.add(gr.subject.trim());
      }
    });

    // C. Include any recorded subjects specifically for this class & term in AcademicRecord
    academicRecords.forEach((ar) => {
      if (matchesClass(ar.className, selectedClass) && termVars.includes(ar.term)) {
        if (ar.subject && ar.subject.trim()) subjectsSet.add(ar.subject.trim());
      }
    });

    return Array.from(subjectsSet);
  }, [selectedClass, tierCategory, selectedTerm, gradeRecords, academicRecords]);

  // 5. Filter Students in this Class
  const rawFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      const status = student.status || "ENROLLED";
      if (status !== "ENROLLED" && status !== "ACTIVE") return false;

      // Filter by the selected class
      if (!matchesClass(student.currentClass, selectedClass)) return false;

      return true;
    });
  }, [students, selectedClass]);

  const cohortStudents = useMemo(() => {
    if (rawFilteredStudents.length > 0) {
      return rawFilteredStudents;
    }
    // Clean mock student data rows ONLY for public DEMO tenant
    if (isDemo) {
      if (tierCategory === "SECONDARY" && (matchesClass(selectedClass, "JSS 1") || activeTierCode === "SECONDARY")) {
        return DEFAULT_MOCK_JSS1_STUDENTS;
      }
      if (tierCategory === "PRIMARY") {
        return DEFAULT_MOCK_PRIMARY_STUDENTS;
      }
      if (tierCategory === "NURSERY") {
        return DEFAULT_MOCK_NURSERY_STUDENTS;
      }
    }
    return rawFilteredStudents;
  }, [rawFilteredStudents, selectedClass, activeTierCode, tierCategory, isDemo]);

  // Assign Permanent Registration Numbers
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

    const stableList = [...cohortStudents].sort((a, b) => {
      if (a.admissionNumber && b.admissionNumber) {
        return a.admissionNumber.localeCompare(b.admissionNumber);
      }
      return (a.lastName || "").localeCompare(b.lastName || "");
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
  }, [cohortStudents, selectedClass, tenant?.subdomain]);

  // 6. Fast Score Lookup Engine (Combines GradeRecord, AcademicRecord, ExamResult)
  const [localScoresOverride, setLocalScoresOverride] = useState<Record<string, { ca1: number; ca2: number; exam: number; total: number; remarks: string }>>({});

  const termVariants = useMemo(() => getTermVariants(selectedTerm), [selectedTerm]);

  const getStudentSubjectScore = useCallback((studentId: string, subject: string) => {
    const localKey = `${studentId}__${subject.toLowerCase()}`;
    if (localScoresOverride[localKey]) {
      return localScoresOverride[localKey];
    }

    // A. Check GradeRecord
    const gr = gradeRecords.find(
      (r) =>
        r.studentId === studentId &&
        r.subject?.toLowerCase() === subject.toLowerCase() &&
        termVariants.includes(r.term) &&
        matchesClass(r.className, selectedClass)
    );
    if (gr) {
      const ca1 = Number(gr.ca1) || 0;
      const ca2 = Number(gr.ca2) || 0;
      const exam = Number(gr.exam) || 0;
      const total = Number(gr.totalScore) || ca1 + ca2 + exam;
      return { ca1, ca2, exam, total, remarks: "" };
    }

    // B. Check AcademicRecord
    const ar = academicRecords.find(
      (r) =>
        r.studentId === studentId &&
        r.subject?.toLowerCase() === subject.toLowerCase() &&
        termVariants.includes(r.term)
    );
    if (ar) {
      const ca1 = Number(ar.test1) || 0;
      const ca2 = Number(ar.test2) || 0;
      const exam = Number(ar.finalExam) || 0;
      const total = Number(ar.totalScore) || ca1 + ca2 + exam;
      return { ca1, ca2, exam, total, remarks: ar.teacherRemarks || "" };
    }

    // C. Check ExamResult via Exam
    const examMatch = exams.find(
      (e) =>
        e.course?.name?.toLowerCase() === subject.toLowerCase() &&
        termVariants.includes(e.semester)
    );
    if (examMatch) {
      const er = examResults.find(
        (r) => r.examId === examMatch.id && r.studentId === studentId
      );
      if (er) {
        const ca1 = Number(er.ca1Score) || 0;
        const ca2 = Number(er.ca2Score) || 0;
        const exam = Number(er.examScore) || 0;
        const total = Number(er.score) || ca1 + ca2 + exam;
        return { ca1, ca2, exam, total, remarks: er.remarks || "" };
      }
    }

    // Check mock student initial values
    const mockStudent = cohortStudents.find((s) => s.id === studentId);
    if (mockStudent && (mockStudent as any).initialScores && subject.toLowerCase().includes("math")) {
      const init = (mockStudent as any).initialScores;
      const ca1 = Number(init.ca1 || init.assignment || init.observation) || 0;
      const ca2 = Number(init.ca2 || init.test || init.classwork) || 0;
      const exam = Number(init.exam || init.affective) || 0;
      return { ca1, ca2, exam, total: ca1 + ca2 + exam, remarks: "" };
    }

    return null;
  }, [localScoresOverride, gradeRecords, termVariants, selectedClass, academicRecords, exams, examResults, cohortStudents]);

  // 7. Master Broadsheet Computation: One row per student, ALL subjects across
  const broadsheetData = useMemo(() => {
    const rows = studentsWithRegNo.map((student) => {
      let studentTotal = 0;
      let evaluatedCount = 0;
      const subjectScores: Record<string, { ca1: number; ca2: number; exam: number; total: number; remarks: string } | null> = {};

      classSubjects.forEach((sub) => {
        const score = getStudentSubjectScore(student.id, sub);
        subjectScores[sub] = score;
        if (score && score.total > 0) {
          studentTotal += score.total;
          evaluatedCount += 1;
        }
      });

      // Broadsheet Average: (Total Marks / (Subjects Count * 100)) * 100
      const average = classSubjects.length > 0 ? (studentTotal / classSubjects.length) : 0;
      const tierGrade = resolveTierGrade(tierCategory, average);

      return {
        student,
        subjectScores,
        studentTotal,
        evaluatedCount,
        average,
        grade: tierGrade.letter,
        remark: tierGrade.remark,
        badgeColor: tierGrade.badgeColor,
      };
    });

    // Rank students by total score / average descending across ALL subjects
    const sorted = [...rows].sort((a, b) => b.studentTotal - a.studentTotal);
    const rankMap = new Map<string, string>();
    let currentRank = 1;
    sorted.forEach((item, index) => {
      if (item.evaluatedCount > 0) {
        if (index > 0 && item.studentTotal < sorted[index - 1].studentTotal) {
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
  }, [studentsWithRegNo, classSubjects, tierCategory, getStudentSubjectScore]);

  // Filtered by Search query
  const filteredBroadsheet = useMemo(() => {
    if (!searchQuery.trim()) return broadsheetData;
    const q = searchQuery.toLowerCase();
    return broadsheetData.filter(
      (row) =>
        `${row.student.lastName} ${row.student.firstName}`.toLowerCase().includes(q) ||
        row.student.regNo.toLowerCase().includes(q)
    );
  }, [broadsheetData, searchQuery]);

  // Aggregate Analytics for Footer
  const analytics = useMemo(() => {
    const evaluatedRows = broadsheetData.filter((r) => r.evaluatedCount > 0);
    const count = evaluatedRows.length;
    if (count === 0) {
      return { count: 0, average: "—", highest: "—", lowest: "—" };
    }

    const sumAvg = evaluatedRows.reduce((acc, curr) => acc + curr.average, 0);
    const average = (sumAvg / count).toFixed(2);
    const highest = Math.max(...evaluatedRows.map((r) => r.average)).toFixed(2);
    const lowest = Math.min(...evaluatedRows.map((r) => r.average)).toFixed(2);

    return {
      count,
      average: `${average}%`,
      highest: `${highest}%`,
      lowest: `${lowest}%`,
    };
  }, [broadsheetData]);

  // Demo Tenant Actions: Seed and Clear realistic scores
  const handleSeedDemoScores = async () => {
    if (!isDemo || isSeedingDemo) return;
    setIsSeedingDemo(true);
    try {
      const res = await seedDemoGradingScores(schoolId, effectiveDomain);
      if (res.success) {
        if (res.records && Array.isArray(res.records)) {
          const newOverrides: Record<string, { ca1: number; ca2: number; exam: number; total: number; remarks: string }> = {};
          res.records.forEach((rec: any) => {
            const tot = rec.totalScore ?? rec.total ?? (rec.ca1 + rec.ca2 + rec.exam);
            const data = {
              ca1: rec.ca1,
              ca2: rec.ca2,
              exam: rec.exam,
              total: tot,
              remarks: rec.remarks || "",
            };
            newOverrides[`${rec.studentId}__${rec.subject.toLowerCase()}`] = data;
            if (rec.mockStudentId) {
              newOverrides[`${rec.mockStudentId}__${rec.subject.toLowerCase()}`] = data;
            }
          });
          setLocalScoresOverride((prev) => ({ ...prev, ...newOverrides }));
        }
        setToastMessage(`Successfully seeded ${res.count || 70} demo grading scores!`);
        setTimeout(() => setToastMessage(null), 4000);
        router.refresh();
      } else {
        alert(res.error || "Failed to seed demo scores");
      }
    } catch (err: any) {
      console.error("Error seeding demo scores:", err);
      alert(err.message || "Failed to seed demo scores");
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleClearDemoScores = async () => {
    if (!isDemo || isClearingDemo) return;
    if (!confirm("Are you sure you want to clear all seeded demo scores for JSS 1 1st Term? This will reset broadsheet values to empty dashes.")) {
      return;
    }
    setIsClearingDemo(true);
    try {
      const res = await clearDemoGradingScores(schoolId, effectiveDomain);
      if (res.success) {
        setLocalScoresOverride({});
        setToastMessage("Seeded demo scores cleared. Broadsheet reset.");
        setTimeout(() => setToastMessage(null), 4000);
        router.refresh();
      } else {
        alert(res.error || "Failed to clear demo scores");
      }
    } catch (err: any) {
      console.error("Error clearing demo scores:", err);
      alert(err.message || "Failed to clear demo scores");
    } finally {
      setIsClearingDemo(false);
    }
  };

  // 8. Score Edit Modal State & Actions
  const [modalState, setModalState] = useState<ScoreModalState>({
    isOpen: false,
    student: null,
    subject: "",
    ca1: 0,
    ca2: 0,
    exam: 0,
    remarks: "",
  });

  const handleOpenScoreModal = (student: any, subject: string) => {
    const currentScore = getStudentSubjectScore(student.id, subject);
    setModalState({
      isOpen: true,
      student,
      subject,
      ca1: currentScore?.ca1 || 0,
      ca2: currentScore?.ca2 || 0,
      exam: currentScore?.exam || 0,
      remarks: currentScore?.remarks || "",
    });
  };

  const handleSaveModalScore = () => {
    if (!modalState.student || !modalState.subject) return;

    const ca1 = Math.min(20, Math.max(0, Number(modalState.ca1) || 0));
    const ca2 = Math.min(20, Math.max(0, Number(modalState.ca2) || 0));
    const exam = Math.min(60, Math.max(0, Number(modalState.exam) || 0));
    const total = ca1 + ca2 + exam;

    const localKey = `${modalState.student.id}__${modalState.subject.toLowerCase()}`;
    setLocalScoresOverride((prev) => ({
      ...prev,
      [localKey]: { ca1, ca2, exam, total, remarks: modalState.remarks },
    }));

    setModalState((prev) => ({ ...prev, isOpen: false }));
    setToastMessage(`Saved marks for ${modalState.student.firstName} in ${modalState.subject}`);
    setTimeout(() => setToastMessage(null), 3500);

    // Persist via Server Action
    startTransition(async () => {
      await saveBroadsheetScore(schoolId, {
        studentId: modalState.student.id,
        className: selectedClass,
        subject: modalState.subject,
        term: selectedTerm,
        academicYear: academicSession,
        ca1,
        ca2,
        exam,
        totalScore: total,
        remarks: modalState.remarks,
      });
    });
  };

  // 9. Export Broadsheet to CSV
  const handleExportCSV = () => {
    const headers = ["Position", "Student Name", "Admission No", ...classSubjects, "Total Marks", "Average (%)", "Grade", "Remarks"];
    const rows = broadsheetData.map((row) => {
      const subjectCols = classSubjects.map((sub) => {
        const sc = row.subjectScores[sub];
        return sc ? sc.total : "0";
      });
      return [
        `"${row.position}"`,
        `"${row.student.lastName}, ${row.student.firstName}"`,
        `"${row.student.regNo}"`,
        ...subjectCols,
        `"${row.studentTotal}"`,
        `"${row.average.toFixed(2)}%"`,
        `"${row.grade}"`,
        `"${row.remark}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Master_Broadsheet_${selectedClass}_${selectedTerm.replace(/\s+/g, "_")}.csv`);
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

      {/* Broadsheet Control Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Grading Broadsheet & Roster
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${selectedClassTier.badgeColor}`}>
                  {selectedClassTier.badgeLabel}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Master terminal broadsheet displaying all assigned subjects across, class averages, grades, and positions.
              </p>
              {/* Admin Verification Label for School Tiers */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>School: <strong className="text-slate-700 dark:text-slate-200">{schoolDisplayName}</strong></span>
                <span>•</span>
                <span>Registered Tiers: <strong className="text-indigo-600 dark:text-indigo-400">{tierInfo.tierSummaryLabel}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Selector (Grouped by Tier if multi-tier) */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Class:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {classGroups.length > 1 ? (
                classGroups.map((group) => (
                  <optgroup key={group.tierCategory} label={group.label}>
                    {group.classes.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Term Selector */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Term:
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="1st Term">1st Term</option>
              <option value="2nd Term">2nd Term</option>
              <option value="3rd Term">3rd Term</option>
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

          {/* Actions: Export & Print & Demo Seeder */}
          <div className="flex flex-wrap items-center gap-2 pt-4">
            {isDemo && (
              <>
                <button
                  type="button"
                  disabled={isSeedingDemo || isClearingDemo}
                  onClick={handleSeedDemoScores}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  title="Seed 70 Realistic Nigerian Grading Scores (Demo Tenant Only)"
                >
                  {isSeedingDemo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isSeedingDemo ? "Seeding Scores..." : "Seed Demo Scores"}</span>
                </button>

                <button
                  type="button"
                  disabled={isSeedingDemo || isClearingDemo}
                  onClick={handleClearDemoScores}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Clear Seeded Scores and Reset Broadsheet (Demo Tenant Only)"
                >
                  {isClearingDemo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isClearingDemo ? "Clearing..." : "Clear Demo Scores"}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Download Master Broadsheet CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Print Broadsheet Landscape"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Broadsheet</span>
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
            placeholder={`Filter ${selectedClass} students...`}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Subjects: <strong className="text-slate-900 dark:text-white">{classSubjects.length}</strong></span>
          <span>•</span>
          <span>Students: <strong className="text-slate-900 dark:text-white">{broadsheetData.length}</strong></span>
        </div>
      </div>

      {/* Broadsheet Table */}
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

                  {/* ALL Subjects Columns */}
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
                        (100 max)
                      </span>
                    </th>
                  ))}

                  {/* Summary Columns across ALL subjects */}
                  <th className="px-3 py-3 text-center bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-l border-r border-indigo-200 dark:border-indigo-900 w-20">
                    Total
                  </th>
                  <th className="px-3 py-3 text-center bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-r border-indigo-200 dark:border-indigo-900 w-20">
                    Average
                  </th>
                  <th className="px-3 py-3 text-center bg-slate-100 dark:bg-slate-800/90 border-r border-slate-200 dark:border-slate-800 w-20">
                    {tierCategory === "NURSERY" ? "Rating" : tierCategory === "PRIMARY" ? "Grade" : "WAEC"}
                  </th>
                  <th className="px-4 py-3 text-left min-w-[120px]">
                    Remark
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

                    {/* Subject Score Cells */}
                    {classSubjects.map((sub) => {
                      const sc = row.subjectScores[sub];
                      return (
                        <td
                          key={sub}
                          onClick={() => handleOpenScoreModal(row.student, sub)}
                          className="px-3 py-3 text-center border-r border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 group transition-colors"
                          title={`Click to edit ${sub} marks for ${row.student.firstName}`}
                        >
                          {sc ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                sc.total >= 70
                                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : sc.total >= 60
                                  ? "text-teal-700 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300"
                                  : sc.total >= 50
                                  ? "text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300"
                                  : sc.total >= 40
                                  ? "text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300"
                              }`}
                            >
                              {sc.total}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-xs group-hover:text-indigo-500">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total Across ALL Subjects */}
                    <td className="px-3 py-3 text-center font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/20 border-l border-r border-indigo-100 dark:border-indigo-950">
                      {row.evaluatedCount > 0 ? row.studentTotal : "—"}
                    </td>

                    {/* Average Across ALL Subjects */}
                    <td className="px-3 py-3 text-center font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/20 border-r border-indigo-100 dark:border-indigo-950">
                      {row.evaluatedCount > 0 ? `${row.average.toFixed(2)}%` : "—"}
                    </td>

                    {/* Tier Grade */}
                    <td className="px-3 py-3 text-center border-r border-slate-100 dark:border-slate-800">
                      {row.evaluatedCount > 0 ? (
                        <span className={`inline-block px-2 py-0.5 rounded font-black text-xs font-mono border ${row.badgeColor}`}>
                          {row.grade}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Remark */}
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {row.evaluatedCount > 0 ? row.remark : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AGGREGATE SUMMARY FOOTER GENERATION (Across ALL Subjects) */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 p-3.5 sm:p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Class Average (ALL Subjects) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Class Average
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

              {/* Card 2: Highest Average */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Highest Average
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                    {analytics.highest}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    Class Leader
                  </span>
                </div>
              </div>

              {/* Card 3: Lowest Average */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Lowest Average
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono shrink-0">
                    {analytics.lowest}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    Baseline
                  </span>
                </div>
              </div>

              {/* Card 4: Total Subjects Across */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                  Subjects in Broadsheet
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono shrink-0">
                    {classSubjects.length}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    Curriculum
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Score Modal (CA1, CA2, Exam) */}
      {modalState.isOpen && modalState.student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Enter / Edit Subject Mark
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {modalState.student.lastName}, {modalState.student.firstName} ({modalState.student.regNo})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">Subject:</span>
                <span className="font-black text-slate-900 dark:text-white">{modalState.subject}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    1st CA (20):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={modalState.ca1 || ""}
                    onChange={(e) => setModalState((prev) => ({ ...prev, ca1: Math.min(20, Math.max(0, Number(e.target.value) || 0)) }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    2nd CA (20):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={modalState.ca2 || ""}
                    onChange={(e) => setModalState((prev) => ({ ...prev, ca2: Math.min(20, Math.max(0, Number(e.target.value) || 0)) }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Exam (60):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={modalState.exam || ""}
                    onChange={(e) => setModalState((prev) => ({ ...prev, exam: Math.min(60, Math.max(0, Number(e.target.value) || 0)) }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Total Score Preview */}
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-900 dark:text-indigo-200">Total Score (100):</span>
                <span className="font-mono font-black text-base text-indigo-700 dark:text-indigo-300">
                  {(Number(modalState.ca1) || 0) + (Number(modalState.ca2) || 0) + (Number(modalState.exam) || 0)} / 100
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                  Teacher Remarks (Optional):
                </label>
                <input
                  type="text"
                  value={modalState.remarks}
                  onChange={(e) => setModalState((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="e.g. Excellent conceptual grasp"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveModalScore}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Persisting..." : "Save Score"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
