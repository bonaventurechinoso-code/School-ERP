/**
 * Tertiary / Higher Institution Assessment Configuration & Rules
 * 
 * Rules:
 * - Default: 4.0 grading scale (A=4.0, B=3.0, C=2.0, D=1.0, F=0.0)
 *   Classification:
 *     Distinction: 3.50 - 4.00
 *     Upper Credit: 3.00 - 3.49
 *     Lower Credit: 2.50 - 2.99
 *     Pass: 2.00 - 2.49
 *     Fail: < 2.00
 * - Optional 5.0 scale when enabled by institution
 * - Assessment: Per-course weights stored in GradeRecord:
 *     ca1 = TOTAL Continuous Assessment score (0 - 30 OR 0 - 40 depending on course)
 *     ca2 = NOT USED / NULL (Do NOT split CA)
 *     exam = Exam score (0 - 70 OR 0 - 60 depending on course)
 *     Total = ca1 + exam = 100
 * - Terminology:
 *     Semester GPA, Cumulative CGPA, Academic Standing, Course Units, Quality Points
 *     (NO "Promoted to Next Class", NO "Repeat", NO "Position 1st/2nd/3rd")
 * - Single source of truth: Real GradeRecord rows in database.
 */

export interface TertiaryCourseMetadata {
  code: string;
  name: string;
  creditUnits: number;
  caWeight: number; // 30 or 40
  examWeight: number; // 70 or 60
  department?: string;
}

export type TertiaryGradingScale = "4.0" | "5.0";

export interface TertiaryGradeResult {
  letter: "A" | "B" | "C" | "D" | "E" | "F";
  gp: number;
  remark: string;
  badgeColor: string;
  isPass: boolean;
}

export const TERTIARY_CLASSES = [
  "ND 1",
  "ND 2",
  "HND 1",
  "HND 2",
  "Diploma 1",
  "Diploma 2",
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500 Level",
  "Postgraduate",
  "NCE 1",
  "NCE 2",
  "NCE 3",
];

/**
 * Standard registry of polytechnic and university courses with authentic weights & credit units.
 */
export const TERTIARY_COURSE_REGISTRY: Record<string, TertiaryCourseMetadata> = {
  // Polytechnic ND 1 Courses (Mix of 30/70 and 40/60; Mix of 2 and 3 Credit Units)
  "COM 111": { code: "COM 111", name: "Introduction to Computing", creditUnits: 3, caWeight: 30, examWeight: 70, department: "Computer Science" },
  "COM 112": { code: "COM 112", name: "Digital Electronics", creditUnits: 3, caWeight: 40, examWeight: 60, department: "Computer Science" },
  "COM 113": { code: "COM 113", name: "Introduction to Programming", creditUnits: 3, caWeight: 40, examWeight: 60, department: "Computer Science" },
  "GNS 101": { code: "GNS 101", name: "Use of English I", creditUnits: 2, caWeight: 30, examWeight: 70, department: "General Studies" },
  "GNS 111": { code: "GNS 111", name: "Citizenship Education I", creditUnits: 2, caWeight: 30, examWeight: 70, department: "General Studies" },
  "MTH 111": { code: "MTH 111", name: "Logic and Linear Algebra", creditUnits: 3, caWeight: 30, examWeight: 70, department: "Mathematics" },

  // University 100 Level Courses (Mix of 30/70 and 40/60; Mix of 2 and 3 Credit Units)
  "GST 111": { code: "GST 111", name: "Use of English & Library Skills", creditUnits: 2, caWeight: 30, examWeight: 70, department: "General Studies" },
  "MTH 101": { code: "MTH 101", name: "Elementary Mathematics I", creditUnits: 3, caWeight: 30, examWeight: 70, department: "Mathematics" },
  "PHY 101": { code: "PHY 101", name: "General Physics I (Mechanics)", creditUnits: 3, caWeight: 40, examWeight: 60, department: "Physics" },
  "CHM 101": { code: "CHM 101", name: "General Chemistry I", creditUnits: 3, caWeight: 40, examWeight: 60, department: "Chemistry" },
  "COS 101": { code: "COS 101", name: "Introduction to Computer Science", creditUnits: 3, caWeight: 30, examWeight: 70, department: "Computer Science" },
  "GST 113": { code: "GST 113", name: "Nigerian Peoples & Culture", creditUnits: 2, caWeight: 30, examWeight: 70, department: "General Studies" },
};

/**
 * Checks if a class name or tier belongs to Tertiary / Higher Education.
 */
export function isTertiaryClass(className?: string | null): boolean {
  if (!className) return false;
  const norm = className.trim().toUpperCase();
  return (
    /\bND\s*[1-2]\b/i.test(norm) ||
    /\bHND\s*[1-2]\b/i.test(norm) ||
    norm.includes("DIPLOMA") ||
    norm.includes("LEVEL") ||
    norm.includes("100 L") ||
    norm.includes("200 L") ||
    norm.includes("300 L") ||
    norm.includes("400 L") ||
    norm.includes("500 L") ||
    norm.includes("POSTGRADUATE") ||
    norm.includes("UNDERGRADUATE") ||
    norm.includes("UNIVERSITY") ||
    norm.includes("POLYTECHNIC") ||
    norm.includes("COLLEGE OF EDUCATION") ||
    norm.includes("TERTIARY") ||
    norm.includes("HIGHER ED") ||
    norm.includes("HIGHER INSTITUTION") ||
    /\bNCE\s*[1-3]\b/i.test(norm)
  );
}

/**
 * Resolves course metadata (code, name, credit units, ca weight, exam weight).
 */
export function resolveTertiaryCourse(subjectOrCode: string): TertiaryCourseMetadata {
  const clean = (subjectOrCode || "").trim();
  const upper = clean.toUpperCase();

  // 1. Direct match by code
  for (const [code, meta] of Object.entries(TERTIARY_COURSE_REGISTRY)) {
    if (upper === code || upper.startsWith(code) || upper.includes(code)) {
      return meta;
    }
  }

  // 2. Direct match by name
  for (const meta of Object.values(TERTIARY_COURSE_REGISTRY)) {
    if (upper.includes(meta.name.toUpperCase())) {
      return meta;
    }
  }

  // 3. Extract code from string like "MTH 101 - Elementary Math" or "MTH101"
  const codeMatch = clean.match(/^([A-Z]{3}\s*\d{3})/i);
  const code = codeMatch ? codeMatch[1].toUpperCase() : clean.slice(0, 7).toUpperCase();

  // Practical/Lab courses default to 40/60, theory to 30/70
  const isPractical = upper.includes("PRACTICAL") || upper.includes("LAB") || upper.includes("WORKSHOP") || upper.includes("PROGRAMMING");
  const caWeight = isPractical ? 40 : 30;
  const examWeight = 100 - caWeight;

  return {
    code,
    name: clean,
    creditUnits: upper.includes("GNS") || upper.includes("GST") ? 2 : 3,
    caWeight,
    examWeight,
  };
}

/**
 * Standard Tertiary Grade Mapper:
 * DEFAULT: 4.0 scale (A=4.0, B=3.0, C=2.0, D=1.0, F=0.0)
 * Optional: 5.0 scale (A=5.0, B=4.0, C=3.0, D=2.0, E=1.0, F=0.0)
 */
export function mapTertiaryScoreToGrade(
  score: number,
  scale: TertiaryGradingScale = "4.0"
): TertiaryGradeResult {
  const s = Math.round(score * 100) / 100;

  if (scale === "5.0") {
    if (s >= 70) {
      return { letter: "A", gp: 5.0, remark: "Distinction", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300", isPass: true };
    }
    if (s >= 60) {
      return { letter: "B", gp: 4.0, remark: "Very Good", badgeColor: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300", isPass: true };
    }
    if (s >= 50) {
      return { letter: "C", gp: 3.0, remark: "Good", badgeColor: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300", isPass: true };
    }
    if (s >= 45) {
      return { letter: "D", gp: 2.0, remark: "Pass", badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300", isPass: true };
    }
    if (s >= 40) {
      return { letter: "E", gp: 1.0, remark: "Pass", badgeColor: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300", isPass: true };
    }
    return { letter: "F", gp: 0.0, remark: "Fail", badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300", isPass: false };
  }

  // DEFAULT: 4.0 SCALE
  if (s >= 70) {
    return { letter: "A", gp: 4.0, remark: "Distinction", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300", isPass: true };
  }
  if (s >= 60) {
    return { letter: "B", gp: 3.0, remark: "Upper Credit", badgeColor: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300", isPass: true };
  }
  if (s >= 50) {
    return { letter: "C", gp: 2.0, remark: "Lower Credit", badgeColor: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300", isPass: true };
  }
  if (s >= 40) {
    return { letter: "D", gp: 1.0, remark: "Pass", badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300", isPass: true };
  }
  return { letter: "F", gp: 0.0, remark: "Fail", badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300", isPass: false };
}

/**
 * Returns Tertiary Degree Classification (Distinction, Upper Credit, Lower Credit, Pass, Fail).
 */
export function getTertiaryClassification(
  gpa: number,
  scale: TertiaryGradingScale = "4.0"
): string {
  if (scale === "5.0") {
    if (gpa >= 4.50) return "First Class";
    if (gpa >= 3.50) return "Second Class Upper";
    if (gpa >= 2.40) return "Second Class Lower";
    if (gpa >= 1.50) return "Third Class";
    if (gpa >= 1.00) return "Pass";
    return "Fail";
  }

  // DEFAULT: 4.0 Scale
  if (gpa >= 3.50) return "Distinction";
  if (gpa >= 3.00) return "Upper Credit";
  if (gpa >= 2.50) return "Lower Credit";
  if (gpa >= 2.00) return "Pass";
  return "Fail";
}

/**
 * Returns Tertiary Academic Standing / Status.
 */
export function getTertiaryAcademicStanding(
  gpa: number,
  scale: TertiaryGradingScale = "4.0"
): string {
  const classification = getTertiaryClassification(gpa, scale);
  if (scale === "5.0") {
    if (gpa >= 1.50) return `${classification} (Good Academic Standing)`;
    if (gpa >= 1.00) return `${classification} (Academic Warning)`;
    return `${classification} (Academic Probation)`;
  }

  // DEFAULT: 4.0 Scale
  if (gpa >= 2.00) return `${classification} (Good Academic Standing)`;
  return `${classification} (Academic Probation)`;
}

/**
 * Calculates Semester GPA from courses with Credit Units and Grade Points.
 */
export function calculateTertiaryGPA(courses: Array<{ creditUnits?: number; gp?: number; gpa?: number }>): {
  totalCreditUnits: number;
  totalQualityPoints: number;
  gpa: number;
} {
  let totalCreditUnits = 0;
  let totalQualityPoints = 0;

  for (const c of courses) {
    const units = Math.max(1, Number(c.creditUnits) || 3);
    const points = typeof c.gp === "number" ? c.gp : (typeof c.gpa === "number" ? c.gpa : 0.0);
    totalCreditUnits += units;
    totalQualityPoints += units * points;
  }

  const gpa = totalCreditUnits > 0 ? Math.round((totalQualityPoints / totalCreditUnits) * 100) / 100 : 0.0;
  return {
    totalCreditUnits,
    totalQualityPoints: Math.round(totalQualityPoints * 100) / 100,
    gpa,
  };
}
