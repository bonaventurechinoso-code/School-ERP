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
    { key: "assignment", label: "Assignment", weight: 10, max: 10, placeholder: "0 - 10" },
    { key: "test", label: "Test", weight: 20, max: 20, placeholder: "0 - 20" },
    { key: "project", label: "Project", weight: 10, max: 10, placeholder: "0 - 10" },
    { key: "exam", label: "Exam", weight: 60, max: 60, placeholder: "0 - 60" },
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
    norm === "SS"
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
export function getNigerianGrade(level: string, finalTotal: number): string {
  if (finalTotal < 0) return "—";

  const resolved = normalizeTierLevel(level);
  const isTertiary =
    resolved === "University" ||
    resolved === "Polytechnic" ||
    resolved === "College of Education" ||
    level === "University" ||
    level === "Polytechnic" ||
    level === "College of Education";

  if (isTertiary) {
    if (finalTotal >= 70) return "A";
    if (finalTotal >= 60) return "B";
    if (finalTotal >= 50) return "C";
    if (finalTotal >= 45) return "D";
    if (finalTotal >= 40) return "E";
    return "F";
  }

  // WAEC / NECO Authentic Scale for Nigerian Primary and Secondary Schools
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

/**
 * Supporting lookup logic for Tertiary Grade Points (0.00 - 5.00 NUC / NBTE scale)
 */
export function getTertiaryGP(finalTotal: number): number {
  if (finalTotal < 0) return 0.0;
  if (finalTotal >= 70) return 5.0;
  if (finalTotal >= 60) return 4.0;
  if (finalTotal >= 50) return 3.0;
  if (finalTotal >= 45) return 2.0;
  if (finalTotal >= 40) return 1.0;
  return 0.0;
}

/**
 * Generates descriptive remarks based on calculated letter grade
 */
export function getGradeRemark(grade: string): string {
  if (!grade || grade === "—") return "—";
  if (grade === "A1" || grade === "A") return "Excellent";
  if (grade === "B2" || grade === "B3" || grade === "B") return "Very Good";
  if (grade === "C4" || grade === "C5" || grade === "C6" || grade === "C") return "Credit";
  if (grade === "D7" || grade === "E8" || grade === "D" || grade === "E") return "Pass";
  if (grade === "F9" || grade === "F") return "Fail";
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
  if (level === "Creche / Nursery" || resolvedLevel === "Creche / Nursery") {
    total = s.observation * 0.4 + s.classwork * 0.4 + s.affective * 0.2;
  } else if (level === "Primary School" || resolvedLevel === "Primary School") {
    total = s.assignment + s.test + s.project + s.exam; // CA1(20) + CA2(20) + Exam(60) map split
  } else if (level === "Secondary School" || resolvedLevel === "Secondary School") {
    total = s.ca1 + s.ca2 + s.exam; // CA1(20) + CA2(20) + Exam(60) = 100
  } else if (
    level === "University" ||
    level === "Polytechnic" ||
    level === "College of Education" ||
    resolvedLevel === "University" ||
    resolvedLevel === "Polytechnic" ||
    resolvedLevel === "College of Education"
  ) {
    total = s.assignment + s.test + s.exam; // Assignment(10) + Test(20) + Exam(70) = 100
  }

  const finalTotal = Math.round(total);
  return {
    total: finalTotal,
    grade: getNigerianGrade(level, finalTotal),
    gp: getTertiaryGP(finalTotal),
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
