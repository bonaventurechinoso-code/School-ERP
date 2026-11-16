/**
 * Nursery Assessment Configuration & Rules
 * 
 * Rules:
 * - Default: Continuous Assessment / Observation (100% total, e.g. Observation 50 + CA 50)
 * - NO Exam 60 unless school turns it on in Admin Settings
 * - Single source of truth: scores live strictly in GradeRecord (ca1, ca2, exam, totalScore)
 * - Blank = null = Not Entered / —, excluded from Total/Average
 * - Age-appropriate grading scale for 3-5 year olds:
 *   75 - 100: Excellent (80 = Excellent)
 *   65 - 74: Very Good (73 = Very Good)
 *   50 - 64: Good
 *   40 - 49: Developing
 *   0 - 39: Needs Support
 */

export interface NurseryAssessmentConfig {
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

export const DEFAULT_NURSERY_CONFIG: NurseryAssessmentConfig = {
  hasExam: false,
  ca1Name: "Observation",
  ca1Max: 50,
  ca2Name: "Continuous Assessment",
  ca2Max: 50,
  examName: "Exam",
  examMax: 0,
  totalMax: 100,
};

export const EXAM_ENABLED_NURSERY_CONFIG: NurseryAssessmentConfig = {
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
 * Checks if a class name belongs to Nursery.
 * Distinguishes Nursery (Nursery 1, Nursery 2, KG 1, Kindergarten) from Creche/Daycare.
 */
export function isNurseryClass(className?: string | null): boolean {
  if (!className) return false;
  const norm = className.trim().toUpperCase();
  if (
    norm.includes("PRE-NURSERY") ||
    norm.includes("PRE NURSERY") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("DAYCARE") ||
    norm.includes("DAY CARE") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("TODDLER") ||
    norm.includes("BABY")
  ) {
    return false;
  }
  return (
    norm.includes("NURSERY") ||
    norm.includes("NUR") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("KG") ||
    norm.includes("RECEPTION") ||
    norm.includes("TRANSITION") ||
    norm.includes("PRE-K") ||
    norm.includes("PRE K") ||
    norm.includes("EARLY YEARS")
  );
}

/**
 * Resolves whether a tier name represents Nursery.
 */
export function isNurseryTier(tierName?: string | null, className?: string | null): boolean {
  if (isNurseryClass(className)) return true;
  if (!tierName) return false;
  const norm = tierName.trim().toUpperCase();
  if (
    norm.includes("PRE-NURSERY") ||
    norm.includes("DAYCARE")
  ) {
    return false;
  }
  return (
    norm.includes("NURSERY") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("EARLY YEARS")
  );
}

/**
 * Resolves the active Nursery assessment configuration for a school.
 */
export function resolveNurseryConfig(schoolOrConfig?: any): NurseryAssessmentConfig {
  const custom =
    schoolOrConfig?.tierDatabasesConfig?.nurseryAssessmentConfig ||
    schoolOrConfig?.nurseryAssessmentConfig ||
    schoolOrConfig;

  if (!custom || typeof custom !== "object") {
    return { ...DEFAULT_NURSERY_CONFIG };
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
 * Maps a Nursery percentage or total score to the age-appropriate letter grade & remark.
 * Age-appropriate scale for 3-5 year olds:
 * 75 - 100: Excellent (80 = Excellent)
 * 65 - 74: Very Good (73 = Very Good)
 * 50 - 64: Good
 * 40 - 49: Developing
 * 0 - 39: Needs Support
 */
export function mapNurseryScoreToGrade(score: number): { letter: string; gpa: number; remark: string } {
  const rounded = Math.round(score);
  if (rounded >= 75) {
    return { letter: "Excellent", gpa: 5.0, remark: "Excellent" };
  } else if (rounded >= 65) {
    return { letter: "Very Good", gpa: 4.0, remark: "Very Good" };
  } else if (rounded >= 50) {
    return { letter: "Good", gpa: 3.0, remark: "Good" };
  } else if (rounded >= 40) {
    return { letter: "Developing", gpa: 2.0, remark: "Developing" };
  } else {
    return { letter: "Needs Support", gpa: 1.0, remark: "Needs Support" };
  }
}
