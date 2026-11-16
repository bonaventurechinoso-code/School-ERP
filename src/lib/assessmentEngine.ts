/**
 * Unified Localized Nigerian Assessment & Grading Engine
 * 
 * Supports:
 * - Creche / Nursery: Observation (40%), Classwork (40%), Affective Domain (20%)
 * - Primary School: Assignment (10), Test (20), Project (10), Exam (60)
 * - Secondary School: CA1 (20), CA2 (20), Termly Exam (60) -> WAEC/NECO (A1-F9)
 * - Higher Education (University, Polytechnic, College of Education):
 *   Assignment (10%), Test (20%), Semester Exam (70%) -> NUC/NBTE 5.00 GP & Letter (A-F)
 */

import { isCrecheClass } from "./creche-config";
import { isNurseryClass, mapNurseryScoreToGrade } from "./nursery-config";
import { isTertiaryClass, mapTertiaryScoreToGrade } from "./tertiary-config";

export type InstitutionalTier =
  | "Creche / Nursery"
  | "Primary School"
  | "Secondary School"
  | "College of Education"
  | "Polytechnic"
  | "University";

export const ACTIVE_INSTITUTIONAL_TIERS: InstitutionalTier[] = [
  "Creche / Nursery",
  "Primary School",
  "Secondary School",
  "College of Education",
  "Polytechnic",
  "University",
];

export interface WeightComponent {
  key: string;
  label: string;
  weight: number;
  max: number;
  placeholder?: string;
}

export const TIER_DEFAULT_WEIGHTS: Record<InstitutionalTier, WeightComponent[]> = {
  "Creche / Nursery": [
    { key: "observation", label: "Observation", weight: 40, max: 100, placeholder: "0 - 100" },
    { key: "classwork", label: "Classwork", weight: 40, max: 100, placeholder: "0 - 100" },
    { key: "affective", label: "Affective", weight: 20, max: 100, placeholder: "0 - 100" },
  ],
  "Primary School": [
    { key: "ca1", label: "1st CA (Max 20)", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "ca2", label: "2nd CA (Max 20)", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "exam", label: "Exam (Max 60)", weight: 60, max: 60, placeholder: "0 - 60" },
  ],
  "Secondary School": [
    { key: "ca1", label: "CA1 (Max 20)", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "ca2", label: "CA2 (Max 20)", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "exam", label: "Termly Exam (Max 60)", weight: 60, max: 60, placeholder: "0 - 60" },
  ],
  "College of Education": [
    { key: "assignment", label: "Assignment (10%)", weight: 10, max: 10, placeholder: "0 - 10" },
    { key: "test", label: "Test (20%)", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "exam", label: "Exam (70%)", weight: 70, max: 70, placeholder: "0 - 70" },
  ],
  "Polytechnic": [
    { key: "assignment", label: "Assignment (10%)", weight: 10, max: 10, placeholder: "0 - 10" },
    { key: "test", label: "Test (20%)", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "exam", label: "Exam (70%)", weight: 70, max: 70, placeholder: "0 - 70" },
  ],
  "University": [
    { key: "assignment", label: "Assignment (10%)", weight: 10, max: 10, placeholder: "0 - 10" },
    { key: "test", label: "Test (20%)", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "exam", label: "Exam (70%)", weight: 70, max: 70, placeholder: "0 - 70" },
  ],
};

export function normalizeTierLevel(level: string): InstitutionalTier {
  const norm = (level || "").toUpperCase();
  if (
    norm.includes("CRECHE") ||
    norm.includes("NURSERY") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("KINDERGARTEN")
  ) {
    return "Creche / Nursery";
  }
  if (
    norm.includes("PRIMARY") ||
    norm.includes("BASIC") ||
    norm.includes("ELEMENTARY")
  ) {
    return "Primary School";
  }
  if (
    norm.includes("SECONDARY") ||
    norm.includes("HIGH") ||
    norm.includes("JSS") ||
    norm.includes("SSS") ||
    norm.includes("SS ") ||
    norm === "SS" ||
    /\bSS\s*[1-3]\b/i.test(norm) ||
    /\bJS\s*[1-3]\b/i.test(norm) ||
    norm.includes("GRADE 7") ||
    norm.includes("GRADE 8") ||
    norm.includes("GRADE 9") ||
    norm.includes("GRADE 10") ||
    norm.includes("GRADE 11") ||
    norm.includes("GRADE 12")
  ) {
    return "Secondary School";
  }
  if (
    norm.includes("COLLEGE OF EDUCATION") ||
    norm.includes("COE") ||
    norm.includes("NCE")
  ) {
    return "College of Education";
  }
  if (
    norm.includes("POLYTECHNIC") ||
    norm.includes("POLY") ||
    /\b(ND|HND)\b/.test(norm)
  ) {
    return "Polytechnic";
  }
  if (
    norm.includes("UNIVERSITY") ||
    norm.includes("UNI") ||
    norm.includes("UNDERGRADUATE") ||
    norm.includes("POSTGRADUATE") ||
    norm.includes("DEGREE")
  ) {
    return "University";
  }
  return "Secondary School";
}

/**
 * Supporting lookup logic for Nigerian letter grade:
 * - Schools: WAEC / NECO scale (A1 - F9)
 * - Higher Education: A, B, C, D, E, F
 */
export function getNigerianGrade(level: string, finalTotal: number, scale: "4.0" | "5.0" = "4.0"): string {
  if (finalTotal < 0) return "—";

  const resolved = normalizeTierLevel(level);
  const isTertiary =
    resolved === "University" ||
    resolved === "Polytechnic" ||
    resolved === "College of Education" ||
    level === "University" ||
    level === "Polytechnic" ||
    level === "College of Education" ||
    level === "TERTIARY" ||
    isTertiaryClass(level);

  if (isTertiary) {
    return mapTertiaryScoreToGrade(finalTotal, scale).letter;
  }

  // Early Childhood (Creche & Nursery) Scale: Excellent (75+), Very Good (65-74), Good (50-64), Developing (40-49), Needs Support (<40)
  const norm = (level || "").toUpperCase();
  if (
    norm.includes("NURSERY") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("DAYCARE") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("KG") ||
    norm.includes("EARLY") ||
    isNurseryClass(level) ||
    isCrecheClass(level)
  ) {
    if (finalTotal >= 75) return "Excellent";
    if (finalTotal >= 65) return "Very Good";
    if (finalTotal >= 50) return "Good";
    if (finalTotal >= 40) return "Developing";
    return "Needs Support";
  }

  // Primary School Unified Scale: Distinction (75+), Very Good (65-74), Credit (50-64), Pass (40-49), Fail (<40)
  if (
    resolved === "Primary School" ||
    level === "Primary School" ||
    norm.includes("PRIMARY") ||
    norm.includes("BASIC") ||
    norm.includes("ELEMENTARY")
  ) {
    if (finalTotal >= 75) return "Distinction";
    if (finalTotal >= 65) return "Very Good";
    if (finalTotal >= 50) return "Credit";
    if (finalTotal >= 40) return "Pass";
    return "Fail";
  }

  // WAEC / NECO Scale ONLY for Secondary School classes (A1 - F9)
  if (
    resolved === "Secondary School" ||
    level === "Secondary School" ||
    norm.includes("SECONDARY") ||
    norm.includes("HIGH") ||
    norm.includes("JSS") ||
    norm.includes("SSS") ||
    /\bSS\s*[1-3]\b/i.test(norm) ||
    /\bJS\s*[1-3]\b/i.test(norm) ||
    norm.includes("GRADE 7") ||
    norm.includes("GRADE 8") ||
    norm.includes("GRADE 9") ||
    norm.includes("GRADE 10") ||
    norm.includes("GRADE 11") ||
    norm.includes("GRADE 12")
  ) {
    if (finalTotal >= 75) return "A1";
    if (finalTotal >= 70) return "B2";
    if (finalTotal >= 65) return "B3";
    if (finalTotal >= 60) return "C4";
    if (finalTotal >= 55) return "C5";
    if (finalTotal >= 50) return "C6";
    if (finalTotal >= 45) return "D7";
    if (finalTotal >= 40) return "E8";
    return "F9";
  }

  // Default fallback for general basic education (NEVER Secondary F9)
  if (finalTotal >= 75) return "Distinction";
  if (finalTotal >= 65) return "Very Good";
  if (finalTotal >= 50) return "Credit";
  if (finalTotal >= 40) return "Pass";
  return "Fail";
}

/**
 * Supporting lookup logic for Tertiary Grade Points (Default: 4.0 scale: A=4.0, B=3.0, C=2.0, D=1.0, F=0.0)
 */
export function getTertiaryGP(finalTotal: number, scale: "4.0" | "5.0" = "4.0"): number {
  if (finalTotal < 0) return 0.0;
  return mapTertiaryScoreToGrade(finalTotal, scale).gp;
}

/**
 * Generates descriptive remarks based on calculated letter grade
 */
export function getGradeRemark(grade: string): string {
  if (!grade || grade === "—") return "—";
  if (grade === "Excellent") return "Excellent";
  if (grade === "Good") return "Good";
  if (grade === "Developing") return "Developing";
  if (grade === "Needs Support") return "Needs Support";
  if (grade === "Distinction" || grade === "A1" || grade === "A") return "Distinction";
  if (grade === "Very Good" || grade === "B2" || grade === "B") return "Very Good";
  if (grade === "Good" || grade === "B3") return "Good";
  if (grade === "Credit" || grade === "C4" || grade === "C5" || grade === "C6" || grade === "C") return "Credit";
  if (grade === "Pass" || grade === "D7" || grade === "E8" || grade === "D" || grade === "E") return "Pass";
  if (grade === "Fail" || grade === "F9" || grade === "F") return "Fail";
  return "Pass";
}

/**
 * 1. AUDIT & CORE ENGINE REFACTOR
 * Computes results based on exact mathematical weighting architecture for the active global tier
 */
export function calculateBonaVeeResult(level: string, scores: any) {
  let total = 0;
  const s = {
    observation: Number(scores?.observation) || 0,
    classwork: Number(scores?.classwork) || 0,
    affective: Number(scores?.affective) || 0,
    assignment: Number(scores?.assignment) || 0,
    test: Number(scores?.test) || 0,
    project: Number(scores?.project) || 0,
    exam: Number(scores?.exam) || 0,
    ca1: Number(scores?.ca1) || 0,
    ca2: Number(scores?.ca2) || 0,
  };

  const resolvedLevel = normalizeTierLevel(level);

  // 1. Compute Totals based on Tier Weights
  if (isNurseryClass(level) || (!isCrecheClass(level) && (level.toUpperCase().includes("NURSERY") || level.toUpperCase().includes("KINDERGARTEN")))) {
    // Nursery Single Source of Truth: scores come strictly from GradeRecord (ca1, ca2, exam)
    if (scores?.ca1 !== undefined || scores?.ca2 !== undefined || scores?.exam !== undefined) {
      total = (s.ca1 || 0) + (s.ca2 || 0) + (s.exam || 0);
    } else {
      total = s.observation * 0.4 + s.classwork * 0.4 + s.affective * 0.2;
    }
  } else if (isCrecheClass(level) || level.toUpperCase().includes("CRECHE") || level.toUpperCase().includes("CRÈCHE") || level.toUpperCase().includes("DAYCARE") || level.toUpperCase().includes("PLAYGROUP")) {
    // Creche Single Source of Truth: scores come from GradeRecord (ca1, ca2, exam)
    if (scores?.ca1 !== undefined || scores?.ca2 !== undefined || scores?.exam !== undefined) {
      total = (s.ca1 || 0) + (s.ca2 || 0) + (s.exam || 0);
    } else {
      total = s.observation * 0.4 + s.classwork * 0.4 + s.affective * 0.2;
    }
  } else if (level === "Creche / Nursery" || resolvedLevel === "Creche / Nursery") {
    if (scores?.ca1 !== undefined || scores?.ca2 !== undefined || scores?.exam !== undefined) {
      total = (s.ca1 || 0) + (s.ca2 || 0) + (s.exam || 0);
    } else {
      total = s.observation * 0.4 + s.classwork * 0.4 + s.affective * 0.2;
    }
  } else if (level === "Primary School" || resolvedLevel === "Primary School") {
    // NERDC 20/20/60 standard: 1st CA (20) + 2nd CA (20) + Exam (60) = 100
    total = s.ca1 + s.ca2 + s.exam;
  } else if (level === "Secondary School" || resolvedLevel === "Secondary School") {
    total = s.ca1 + s.ca2 + s.exam; // CA1(20) + CA2(20) + Exam(60) = 100
  } else if (
    level === "University" ||
    level === "Polytechnic" ||
    level === "College of Education" ||
    level === "TERTIARY" ||
    resolvedLevel === "University" ||
    resolvedLevel === "Polytechnic" ||
    resolvedLevel === "College of Education" ||
    isTertiaryClass(level)
  ) {
    // Tertiary: Single Source of Truth from GradeRecord (ca1 = Total CA, exam = Exam)
    if (scores?.ca1 !== undefined || scores?.exam !== undefined) {
      total = (s.ca1 || 0) + (s.exam || 0);
    } else {
      total = s.assignment + s.test + s.exam; // Assignment(10) + Test(20) + Exam(70) = 100
    }
  }

  const finalTotal = Math.round(total);
  return {
    total: finalTotal,
    grade: getNigerianGrade(level, finalTotal, "4.0"),
    gp: getTertiaryGP(finalTotal, "4.0"),
  };
}

/**
 * Annual Term Compilation & Promotion Logic
 */
export function compileAnnualTerms(t1: number, t2: number, t3: number, attendance: number) {
  const annual = (t1 + t2 + t3) / 3;
  const promotion = annual >= 50 && attendance >= 75 ? "Promoted" : "Repeat";
  return { annual: Math.round(annual), promotion };
}
