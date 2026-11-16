import { JSS_SUBJECTS } from "./curriculum-data";

export interface SecondaryDemoStudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  admissionNumber: string;
  currentClass: string;
  status: string;
  rank: number;
  positionString: string;
  totalScore: number;
  averageScore: number;
  averagePercentageString: string;
  gradeLetter: string;
  subjectsCount: number;
  subjects: Array<{
    id: string;
    subject: string;
    ca1: number;
    ca2: number;
    exam: number;
    total: number;
    totalScore: number;
    test1: number;
    test2: number;
    finalExam: number;
    gradeLetter: string;
    grade: string;
    remarks: string;
    teacherRemarks: string;
    isPassed: boolean;
    assessmentType: "NUMERICAL";
  }>;
}

// 14 standard Junior Secondary curriculum subjects
export const JSS_CANONICAL_SUBJECTS = [...JSS_SUBJECTS];

// 20 / 20 / 60 Component Split matching Secondary Formula
function splitSecondaryScore(total: number, maxC1 = 20, maxC2 = 20, maxEx = 60) {
  const maxTotal = maxC1 + maxC2 + maxEx;
  const ratio = total / maxTotal;
  let c1 = Math.round(maxC1 * ratio);
  let c2 = Math.round(maxC2 * ratio);
  let ex = total - (c1 + c2);
  if (ex > maxEx) {
    const diff = ex - maxEx;
    ex = maxEx;
    c1 = Math.min(maxC1, c1 + Math.ceil(diff / 2));
    c2 = total - (c1 + ex);
  }
  return { ca1: c1, ca2: c2, exam: ex };
}

// WAEC 9-point scale resolution
function resolveWaecGrade(score: number): { letter: string; remarks: string } {
  if (score >= 75) return { letter: "A1", remarks: "Distinction in subject concepts" };
  if (score >= 70) return { letter: "B2", remarks: "Very good academic performance" };
  if (score >= 65) return { letter: "B3", remarks: "Good academic performance" };
  if (score >= 60) return { letter: "C4", remarks: "Credit / Commendable achievement" };
  if (score >= 55) return { letter: "C5", remarks: "Credit / Commendable achievement" };
  if (score >= 50) return { letter: "C6", remarks: "Credit / Commendable achievement" };
  if (score >= 45) return { letter: "D7", remarks: "Pass / Fair progress" };
  if (score >= 40) return { letter: "E8", remarks: "Pass / Fair progress" };
  return { letter: "F9", remarks: "Needs Support / Academic intervention required" };
}

// Canonical raw score totals per student for JSS 1 across 14 subjects:
// Profile 0: Okonkwo Chinedu (1st) -> Sum: 1147 | Avg: 81.93% | Grade: A1
// Profile 1: Bello Amina (2nd)     -> Sum: 1074 | Avg: 76.71% | Grade: A1
// Profile 2: Adeyemi Folake (3rd)  -> Sum: 848  | Avg: 60.57% | Grade: C4
// Profile 3: Nwosu Emeka (4th)     -> Sum: 703  | Avg: 50.21% | Grade: C6
// Profile 4: Abubakar Zainab (5th) -> Sum: 570  | Avg: 40.71% | Grade: E8
const DEMO_SCORE_PROFILES: Record<number, number[]> = {
  0: [81, 92, 88, 85, 78, 84, 89, 82, 91, 86, 76, 80, 68, 77],
  1: [85, 74, 78, 71, 82, 79, 73, 77, 75, 83, 72, 74, 70, 81],
  2: [67, 62, 59, 56, 65, 64, 58, 66, 61, 68, 63, 60, 55, 64],
  3: [54, 46, 48, 45, 53, 52, 47, 51, 49, 56, 50, 55, 45, 52],
  4: [44, 34, 38, 36, 45, 43, 41, 42, 37, 48, 40, 46, 32, 44],
};

const DEMO_STUDENT_METADATA = [
  { id: "mock-jss1-001", firstName: "Chinedu", lastName: "Okonkwo", admissionNumber: "GW/2026/JSS1/001", rank: 1, positionString: "1st" },
  { id: "mock-jss1-002", firstName: "Amina", lastName: "Bello", admissionNumber: "GW/2026/JSS1/002", rank: 2, positionString: "2nd" },
  { id: "mock-jss1-003", firstName: "Folake", lastName: "Adeyemi", admissionNumber: "GW/2026/JSS1/003", rank: 3, positionString: "3rd" },
  { id: "mock-jss1-004", firstName: "Emeka", lastName: "Nwosu", admissionNumber: "GW/2026/JSS1/004", rank: 4, positionString: "4th" },
  { id: "mock-jss1-005", firstName: "Zainab", lastName: "Abubakar", admissionNumber: "GW/2026/JSS1/005", rank: 5, positionString: "5th" },
];

function buildStudentProfile(meta: typeof DEMO_STUDENT_METADATA[0], profileIndex: number): SecondaryDemoStudentProfile {
  const totals = DEMO_SCORE_PROFILES[profileIndex] || DEMO_SCORE_PROFILES[1];
  const totalScore = totals.reduce((a, b) => a + b, 0);
  const averageScore = Math.round((totalScore / JSS_CANONICAL_SUBJECTS.length) * 100) / 100;
  const overallGrade = resolveWaecGrade(averageScore).letter;

  const subjects = JSS_CANONICAL_SUBJECTS.map((sub, idx) => {
    const total = totals[idx % totals.length];
    const { ca1, ca2, exam } = splitSecondaryScore(total);
    const { letter, remarks } = resolveWaecGrade(total);

    return {
      id: `demo-rec-${meta.id}-${idx}`,
      subject: sub,
      ca1,
      ca2,
      exam,
      total,
      totalScore: total,
      test1: ca1,
      test2: ca2,
      finalExam: exam,
      gradeLetter: letter,
      grade: letter,
      remarks,
      teacherRemarks: remarks,
      isPassed: total >= 40,
      assessmentType: "NUMERICAL" as const,
    };
  });

  return {
    id: meta.id,
    firstName: meta.firstName,
    lastName: meta.lastName,
    name: `${meta.lastName}, ${meta.firstName}`,
    admissionNumber: meta.admissionNumber,
    currentClass: "JSS 1",
    status: "ENROLLED",
    rank: meta.rank,
    positionString: meta.positionString,
    totalScore,
    averageScore,
    averagePercentageString: `${averageScore.toFixed(2)}%`,
    gradeLetter: overallGrade,
    subjectsCount: subjects.length,
    subjects,
  };
}

export const CANONICAL_SECONDARY_PROFILES: SecondaryDemoStudentProfile[] = DEMO_STUDENT_METADATA.map((meta, idx) =>
  buildStudentProfile(meta, idx)
);

/**
 * Resolves a secondary demo student profile by ID, admission number, or name.
 */
export function getSecondaryDemoProfile(identifier?: string | null): SecondaryDemoStudentProfile | null {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();

  for (const profile of CANONICAL_SECONDARY_PROFILES) {
    if (profile.id.toLowerCase() === clean) return profile;
    if (profile.admissionNumber.toLowerCase() === clean) return profile;
    if (profile.name.toLowerCase() === clean) return profile;
    if (`${profile.firstName} ${profile.lastName}`.toLowerCase() === clean) return profile;
    if (clean.includes(profile.firstName.toLowerCase()) && clean.includes(profile.lastName.toLowerCase())) {
      return profile;
    }
  }

  // Check specific alias matches:
  if (clean.includes("bello") && (clean.includes("amina") || clean.includes("002"))) {
    return CANONICAL_SECONDARY_PROFILES[1]; // Amina Bello
  }
  if (clean.includes("okonkwo") && (clean.includes("chinedu") || clean.includes("001"))) {
    return CANONICAL_SECONDARY_PROFILES[0]; // Chinedu Okonkwo
  }
  if (clean.includes("adeyemi") && (clean.includes("folake") || clean.includes("003"))) {
    return CANONICAL_SECONDARY_PROFILES[2]; // Folake Adeyemi
  }
  if (clean.includes("nwosu") && (clean.includes("emeka") || clean.includes("004"))) {
    return CANONICAL_SECONDARY_PROFILES[3]; // Emeka Nwosu
  }
  if (clean.includes("abubakar") && (clean.includes("zainab") || clean.includes("005"))) {
    return CANONICAL_SECONDARY_PROFILES[4]; // Zainab Abubakar
  }

  return null;
}
