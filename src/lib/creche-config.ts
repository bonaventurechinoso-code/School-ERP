/**
 * Creche / Early Childhood Assessment Configuration & Rules
 * 
 * Rules:
 * - Default: Continuous Assessment / Observation (100% total, e.g. Observation 50 + CA 50)
 * - NO Exam 60 unless school turns it on in Admin Settings
 * - Single source of truth: scores live strictly in GradeRecord (ca1, ca2, exam, totalScore)
 * - Blank = null = Not Entered / —, excluded from Total/Average
 * - Unified grading scale: 75+ Distinction, 65-74 Very Good (73 = Very Good), 50-64 Credit, 40-49 Pass, <40 Fail
 */

export interface CrecheAssessmentConfig {
  [key: string]: any;
  hasExam: boolean; // default: false (NO Exam 60 unless school turns it on)
  ca1Name: string; // default: "Observation"
  ca1Max: number; // default: 50 (or 20 when hasExam is true)
  ca2Name: string; // default: "Continuous Assessment"
  ca2Max: number; // default: 50 (or 20 when hasExam is true)
  examName: string; // default: "Exam"
  examMax: number; // default: 0 (or 60 when hasExam is true)
  totalMax: number; // default: 100
}

export const DEFAULT_CRECHE_CONFIG: CrecheAssessmentConfig = {
  hasExam: false,
  ca1Name: "Observation",
  ca1Max: 50,
  ca2Name: "Continuous Assessment",
  ca2Max: 50,
  examName: "Exam",
  examMax: 0,
  totalMax: 100,
};

export const EXAM_ENABLED_CRECHE_CONFIG: CrecheAssessmentConfig = {
  hasExam: true,
  ca1Name: "Observation",
  ca1Max: 20,
  ca2Name: "Continuous Assessment",
  ca2Max: 20,
  examName: "Terminal Exam",
  examMax: 60,
  totalMax: 100,
};

/**
 * Checks if a class name belongs to Creche / Early Childhood.
 */
export function isCrecheClass(className?: string | null): boolean {
  if (!className) return false;
  const norm = className.trim().toUpperCase();
  return (
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("DAYCARE") ||
    norm.includes("DAY CARE") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("PLAY GROUP") ||
    norm.includes("PRE-NURSERY") ||
    norm.includes("PRE NURSERY") ||
    norm.includes("TODDLER") ||
    norm.includes("BABY")
  );
}

/**
 * Resolves whether a tier name represents Creche / Early Childhood.
 */
export function isCrecheTier(tierName?: string | null, className?: string | null): boolean {
  if (isCrecheClass(className)) return true;
  if (!tierName) return false;
  const norm = tierName.trim().toUpperCase();
  // Creche tier specifically (distinct from Nursery if separated, or combined Creche / Nursery)
  return (
    norm === "CRECHE" ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("DAYCARE")
  );
}

/**
 * Resolves the active Creche assessment configuration for a school.
 */
export function resolveCrecheConfig(schoolOrConfig?: any): CrecheAssessmentConfig {
  const custom =
    schoolOrConfig?.tierDatabasesConfig?.crecheAssessmentConfig ||
    schoolOrConfig?.crecheAssessmentConfig ||
    schoolOrConfig;

  if (!custom || typeof custom !== "object") {
    return { ...DEFAULT_CRECHE_CONFIG };
  }

  const hasExam = Boolean(custom.hasExam);
  return {
    hasExam,
    ca1Name: typeof custom.ca1Name === "string" && custom.ca1Name.trim() ? custom.ca1Name.trim() : "Observation",
    ca1Max: typeof custom.ca1Max === "number" && custom.ca1Max > 0 ? custom.ca1Max : (hasExam ? 20 : 50),
    ca2Name: typeof custom.ca2Name === "string" && custom.ca2Name.trim() ? custom.ca2Name.trim() : "Continuous Assessment",
    ca2Max: typeof custom.ca2Max === "number" && custom.ca2Max > 0 ? custom.ca2Max : (hasExam ? 20 : 50),
    examName: typeof custom.examName === "string" && custom.examName.trim() ? custom.examName.trim() : "Exam",
    examMax: hasExam ? (typeof custom.examMax === "number" && custom.examMax > 0 ? custom.examMax : 60) : 0,
    totalMax: 100,
  };
}

/**
 * Maps a Creche percentage or total score to the unified letter grade & remark.
 * Unified scale:
 * 75 - 100: Distinction
 * 65 - 74: Very Good (73 = Very Good)
 * 50 - 64: Credit
 * 40 - 49: Pass
 * 0 - 39: Fail
 */
export function mapCrecheScoreToGrade(score: number): { letter: string; gpa: number; remark: string } {
  const rounded = Math.round(score);
  if (rounded >= 75) {
    return { letter: "Distinction", gpa: 5.0, remark: "Distinction" };
  } else if (rounded >= 65) {
    return { letter: "Very Good", gpa: 4.0, remark: "Very Good" };
  } else if (rounded >= 50) {
    return { letter: "Credit", gpa: 3.0, remark: "Credit" };
  } else if (rounded >= 40) {
    return { letter: "Pass", gpa: 2.0, remark: "Pass" };
  } else {
    return { letter: "Fail", gpa: 0.0, remark: "Fail" };
  }
}
