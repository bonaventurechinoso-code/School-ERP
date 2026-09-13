/**
 * Core Grading Engine for K-12 Multi-Tier School ERP
 * 
 * Supports:
 * - Daycare / Nursery: Qualitative, developmental skill-based narrative grading indicators
 *   (e.g., Excellent, Developing, Needs Improvement)
 * - Primary & Secondary: Numerical continuous assessment metrics (0-100) mapped to classic
 *   letter grades (A, B, C, etc.) with automatic pass/fail tracking thresholds
 * - Class positioning and ranking algorithms
 * - Automated administrative remark generation (Class Teacher & Principal)
 */

export type GradingTier = "NURSERY" | "PRIMARY" | "SECONDARY";

export type NarrativeMilestone = "EXCELLENT" | "DEVELOPING" | "NEEDS_IMPROVEMENT";

export interface SkillEvaluationItem {
  domain: string;
  skillName: string;
  rating: NarrativeMilestone;
  comment?: string;
}

export interface NumericalAssessmentInput {
  test1?: number | null; // e.g. Continuous Assessment 1 (Max 15 - 20)
  test2?: number | null; // e.g. Continuous Assessment 2 (Max 15 - 20)
  midTerm?: number | null; // e.g. Mid-Term Exam (Max 10 - 20)
  finalExam?: number | null; // e.g. Terminal Exam (Max 50 - 60)
  passThreshold?: number; // Default 50%
}

export interface NumericalGradeResult {
  totalScore: number;
  gradeLetter: string;
  gpaPoints: number;
  isPassed: boolean;
  remarks: string;
}

export interface NarrativeGradeResult {
  overallRating: NarrativeMilestone;
  developmentalSummary: string;
  skillsEvaluation: SkillEvaluationItem[];
  teacherRemarks: string;
  principalRemarks: string;
}

export interface StudentClassRanking {
  studentId: string;
  totalScore: number;
  averageScore: number;
  classPosition: number;
  positionSuffix: string;
  totalStudentsInClass: number;
}

/**
 * Resolves the grading tier from tier name, classroom name, or explicit tier context.
 */
export function resolveGradingTier(tierName?: string, className?: string): GradingTier {
  const combined = `${tierName || ""} ${className || ""}`.toUpperCase();

  if (
    combined.includes("DAYCARE") ||
    combined.includes("NURSERY") ||
    combined.includes("CRÈCHE") ||
    combined.includes("CRECHE") ||
    combined.includes("KINDERGARTEN") ||
    combined.includes("PLAYGROUP") ||
    combined.includes("EARLY CARE")
  ) {
    return "NURSERY";
  }

  if (
    combined.includes("SECONDARY") ||
    combined.includes("HIGH SCHOOL") ||
    combined.includes("JSS") ||
    combined.includes("SSS") ||
    combined.includes("GRADE 7") ||
    combined.includes("GRADE 8") ||
    combined.includes("GRADE 9") ||
    combined.includes("GRADE 10") ||
    combined.includes("GRADE 11") ||
    combined.includes("GRADE 12")
  ) {
    return "SECONDARY";
  }

  // Default to PRIMARY for Elementary, Basic, Primary, etc.
  return "PRIMARY";
}

/**
 * Standard Nigerian / British K-12 letter grade mapping for Primary and Secondary
 */
export function mapScoreToGradeLetter(score: number): { letter: string; gpa: number; remark: string } {
  if (score >= 75) {
    return { letter: "A", gpa: 5.0, remark: "Distinction / Excellent" };
  } else if (score >= 65) {
    return { letter: "B", gpa: 4.0, remark: "Very Good" };
  } else if (score >= 50) {
    return { letter: "C", gpa: 3.0, remark: "Credit / Satisfactory" };
  } else if (score >= 40) {
    return { letter: "D", gpa: 2.0, remark: "Pass" };
  } else {
    return { letter: "F", gpa: 0.0, remark: "Fail" };
  }
}

/**
 * Calculates continuous assessment total, letter grade, GPA points, and pass/fail indicator.
 */
export function calculateNumericalGrade(
  scores: NumericalAssessmentInput,
  customPassThreshold: number = 50
): NumericalGradeResult {
  const t1 = Math.max(0, Number(scores.test1) || 0);
  const t2 = Math.max(0, Number(scores.test2) || 0);
  const mid = Math.max(0, Number(scores.midTerm) || 0);
  const exam = Math.max(0, Number(scores.finalExam) || 0);

  const rawTotal = t1 + t2 + mid + exam;
  const totalScore = Math.min(100, Math.round(rawTotal * 100) / 100);

  const threshold = scores.passThreshold ?? customPassThreshold;
  const isPassed = totalScore >= threshold;

  const { letter, gpa, remark } = mapScoreToGradeLetter(totalScore);

  return {
    totalScore,
    gradeLetter: letter,
    gpaPoints: gpa,
    isPassed,
    remarks: remark,
  };
}

/**
 * Default early childhood developmental domains for Daycare / Nursery
 */
export const NURSERY_DEVELOPMENTAL_DOMAINS = [
  {
    domain: "Physical & Motor Skills",
    skills: ["Fine motor grip & pencil control", "Gross motor coordination & balance", "Hand-eye dexterity in play"],
  },
  {
    domain: "Cognitive & Numeracy Skills",
    skills: ["Color and shape recognition", "Counting and number readiness", "Problem-solving and curiosity"],
  },
  {
    domain: "Language & Literacy",
    skills: ["Phonetic awareness & vocabulary", "Speaking clarity & self-expression", "Attentive listening to stories"],
  },
  {
    domain: "Social & Emotional Growth",
    skills: ["Peer collaboration & sharing", "Following routines & independence", "Emotional regulation & manners"],
  },
  {
    domain: "Creative & Expressive Arts",
    skills: ["Singing and musical participation", "Art, painting & sensory exploration"],
  },
];

/**
 * Evaluates developmental skills for Daycare / Nursery and calculates summary feedback.
 */
export function evaluateNarrativeMilestones(evaluations: SkillEvaluationItem[]): NarrativeGradeResult {
  if (!evaluations || evaluations.length === 0) {
    return {
      overallRating: "DEVELOPING",
      developmentalSummary: "The learner is making steady progress across developmental domains.",
      skillsEvaluation: [],
      teacherRemarks: "A cheerful learner showing steady development and active participation.",
      principalRemarks: "Recommended for continued developmental nurturing and transition.",
    };
  }

  let excellentCount = 0;
  let developingCount = 0;
  let needsImprovementCount = 0;

  for (const item of evaluations) {
    if (item.rating === "EXCELLENT") excellentCount++;
    else if (item.rating === "NEEDS_IMPROVEMENT") needsImprovementCount++;
    else developingCount++;
  }

  let overallRating: NarrativeMilestone = "DEVELOPING";
  if (excellentCount >= evaluations.length * 0.6) {
    overallRating = "EXCELLENT";
  } else if (needsImprovementCount > evaluations.length * 0.4) {
    overallRating = "NEEDS_IMPROVEMENT";
  }

  let developmentalSummary = "";
  let teacherRemarks = "";
  let principalRemarks = "";

  switch (overallRating) {
    case "EXCELLENT":
      developmentalSummary = "Exceeding milestones with remarkable independence, high curiosity, and joyful social engagement.";
      teacherRemarks = "A brilliant and confident learner who demonstrates mastery in classroom tasks and cooperates warmly with peers.";
      principalRemarks = "Outstanding early developmental progress. A delight to have in our foundation school.";
      break;
    case "NEEDS_IMPROVEMENT":
      developmentalSummary = "Developing key skills with personalized attention; requires encouraging support in targeted milestone areas.";
      teacherRemarks = "Demonstrates good effort. Encouraging home practice with fine motor coordination and speech readiness is recommended.";
      principalRemarks = "Continued targeted guidance will foster steady confidence and skill growth.";
      break;
    case "DEVELOPING":
    default:
      developmentalSummary = "Making consistent developmental strides. Demonstrates emerging skills across cognitive and social milestones.";
      teacherRemarks = "Shows good enthusiasm and participates cheerfully in daily routines and collaborative play.";
      principalRemarks = "A steady and promising term's growth. We look forward to greater developmental milestones ahead.";
      break;
  }

  return {
    overallRating,
    developmentalSummary,
    skillsEvaluation: evaluations,
    teacherRemarks,
    principalRemarks,
  };
}

/**
 * Formats a ranking integer into ordinal position string: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th"
 */
export function formatOrdinalPosition(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Computes class rankings for an array of student summary scores.
 * Accurately handles ties (standard competition ranking: 1, 2, 2, 4).
 */
export function computeClassRankings(
  students: Array<{ studentId: string; totalScore: number; averageScore: number }>
): Map<string, StudentClassRanking> {
  const sorted = [...students].sort((a, b) => {
    if (b.averageScore !== a.averageScore) {
      return b.averageScore - a.averageScore;
    }
    return b.totalScore - a.totalScore;
  });

  const totalStudentsInClass = sorted.length;
  const rankingMap = new Map<string, StudentClassRanking>();

  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.averageScore < prev.averageScore || curr.totalScore < prev.totalScore) {
        currentRank = i + 1;
      }
    }

    rankingMap.set(sorted[i].studentId, {
      studentId: sorted[i].studentId,
      totalScore: sorted[i].totalScore,
      averageScore: sorted[i].averageScore,
      classPosition: currentRank,
      positionSuffix: formatOrdinalPosition(currentRank),
      totalStudentsInClass,
    });
  }

  return rankingMap;
}

/**
 * Generates automated remarks based on student average score and pass rate.
 */
export function generateAdministrativeRemarks(
  averageScore: number,
  tier: GradingTier,
  passedCount: number,
  totalCount: number
): { teacherRemarks: string; principalRemarks: string } {
  if (tier === "NURSERY") {
    return {
      teacherRemarks: "Shows active curiosity, joyful participation in group play, and steady developmental progression.",
      principalRemarks: "A wonderful term of early foundation growth. Well done!",
    };
  }

  let teacherRemarks = "";
  let principalRemarks = "";

  if (averageScore >= 80) {
    teacherRemarks = "An exemplary, outstanding academic performance. Consistently demonstrates intellectual rigor and diligence.";
    principalRemarks = "Passed with Distinction. Promoted with pride. Keep up this magnificent standard!";
  } else if (averageScore >= 70) {
    teacherRemarks = "A very commendable result. Demonstrates strong conceptual understanding and dedication.";
    principalRemarks = "Commendable performance. Strive for top-tier distinction next term.";
  } else if (averageScore >= 60) {
    teacherRemarks = "A good performance with clear potential for higher academic honors. More concentration recommended in key subjects.";
    principalRemarks = "Satisfactory achievement. With increased focus, greater excellence is well within reach.";
  } else if (averageScore >= 50) {
    teacherRemarks = `Fair effort. Passed ${passedCount} of ${totalCount} subjects. Requires disciplined revision and stronger homework consistency.`;
    principalRemarks = "Promoted. Must work closely with teachers next term to elevate weaker subject areas.";
  } else {
    teacherRemarks = `Below the expected standard. Struggled in several key courses (${totalCount - passedCount} failed). Urgent study routine overhaul needed.`;
    principalRemarks = "Academic intervention recommended. Parents are advised to schedule a conference with the administration.";
  }

  return { teacherRemarks, principalRemarks };
}
