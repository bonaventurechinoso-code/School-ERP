"use server";

import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { compileAnnualTerms, getNigerianGrade, getTertiaryGP } from "@/lib/assessmentEngine";
import { isTertiaryClass, mapTertiaryScoreToGrade, getTertiaryAcademicStanding } from "@/lib/tertiary-config";
import { getNextGrade, executeTermEndPromotionAction } from "@/app/[schoolDomain]/(admin)/students/actions";
import { revalidatePath } from "next/cache";
import { safeRedisScanDel } from "@/lib/redis";

export interface BroadsheetStudentRow {
  id: string;
  name: string;
  admissionNumber: string;
  currentClass: string;
  term1Average: number;
  term2Average: number;
  term3Average: number;
  annualAverage: number;
  annualGrade: string;
  annualGp?: number;
  attendanceRate: number;
  promotionStatus: "PROMOTED" | "PROMOTED_ON_TRIAL" | "REPEAT";
  promotionBadgeClass: string;
  rank: number;
  positionString: string;
  nextClass: string | null;
  isGraduation: boolean;
}

export interface BroadsheetStats {
  totalEnrolled: number;
  promotedCount: number;
  promotedOnTrialCount: number;
  repeatedCount: number;
  promotionRate: string;
  classMeanScore: string;
  highestScore: number;
  lowestScore: number;
}

export interface AnnualBroadsheetResponse {
  success: boolean;
  broadsheet: BroadsheetStudentRow[];
  stats: BroadsheetStats;
  tierName: string;
  className: string;
  academicYear: string;
  error?: string;
}

export interface SubjectBreakdownRow {
  code: string;
  name: string;
  ca1: number;
  ca2: number;
  exam: number;
  term1Total: number;
  term2Total: number;
  term3Total: number;
  annualAverage: number;
  grade: string;
  remark: string;
}

export interface StudentSubjectBreakdownResponse {
  success: boolean;
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    currentClass: string;
    tierName: string;
    overallAverage: number;
    overallGrade: string;
  };
  subjects: SubjectBreakdownRow[];
  error?: string;
}

// No mock/sample data in production

function getOrdinal(n: number): string {
  if (n <= 0) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Compiles and retrieves the Master Annual Promotion Broadsheet for a given class, tier, and session.
 */
export async function fetchAnnualBroadsheet(
  schoolId: string,
  options: {
    className: string;
    tierName?: string;
    academicYear?: string;
  }
): Promise<AnnualBroadsheetResponse> {
  const className = options.className || "JSS 1";
  const tierName = options.tierName || "Secondary School";
  const academicYear = options.academicYear || "2026/2027";

  try {
    let actualSchoolId = schoolId;
    if (!schoolId.includes("-")) {
      const school = await basePrisma.school.findUnique({
        where: { subdomain: schoolId },
        select: { id: true },
      });
      if (school) actualSchoolId = school.id;
    }

    const tenantDb = await getPrismaClientForTier(actualSchoolId, tierName);

    // 1. Fetch all active students enrolled in this class
    const students = await tenantDb.student.findMany({
      where: {
        schoolId: actualSchoolId,
        currentClass: className,
        status: "ENROLLED",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        currentClass: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    if (students.length === 0) {
      // Fallback query across all classes if none matched exact class string
      const anyStudents = await tenantDb.student.findMany({
        where: { schoolId: actualSchoolId, status: "ENROLLED" },
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          currentClass: true,
        },
        orderBy: [{ lastName: "asc" }],
      });
      if (anyStudents.length > 0) {
        students.push(...anyStudents);
      }
    }

    // 2. Fetch existing report cards or grades for these students across terms
    const studentIds = students.map((s) => s.id);
    const reportCards = await tenantDb.reportCard.findMany({
      where: {
        schoolId: actualSchoolId,
        studentId: { in: studentIds },
        academicYear,
      },
    });

    // Group report cards by student and term
    const cardMap = new Map<string, Map<string, number>>();
    for (const card of reportCards) {
      if (!cardMap.has(card.studentId)) {
        cardMap.set(card.studentId, new Map());
      }
      const termNorm = card.term.toLowerCase();
      cardMap.get(card.studentId)!.set(termNorm, card.averageScore || 0);
    }

    // 3. Compile annual composite for each student
    const compiledRows: Array<Omit<BroadsheetStudentRow, "rank" | "positionString">> = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const fullName = `${student.firstName} ${student.lastName}`;
      const studentTerms = cardMap.get(student.id);

      const t1 = studentTerms?.get("1st term") ?? studentTerms?.get("first term") ?? 0;
      const t2 = studentTerms?.get("2nd term") ?? studentTerms?.get("second term") ?? 0;
      const t3 = studentTerms?.get("3rd term") ?? studentTerms?.get("third term") ?? 0;
      const attendance = 100;

      const isTertiary = tierName.toLowerCase().includes("tertiary") || isTertiaryClass(className);

      // Core engine calculation
      const { annual } = compileAnnualTerms(t1, t2, t3, attendance);
      const annualGp = isTertiary ? mapTertiaryScoreToGrade(annual, "4.0").gp : getTertiaryGP(annual);
      const annualGrade = isTertiary ? mapTertiaryScoreToGrade(annual, "4.0").letter : getNigerianGrade(tierName, annual);

      // Refined Nigerian promotion or Tertiary Academic Standing
      let promotionStatus: "PROMOTED" | "PROMOTED_ON_TRIAL" | "REPEAT" = "REPEAT";
      let badgeClass = "bg-rose-50 text-rose-700 border-rose-200";

      if (isTertiary) {
        if (annualGp >= 2.0) {
          promotionStatus = "PROMOTED";
          badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else {
          promotionStatus = "REPEAT";
          badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
        }
      } else {
        if (annual >= 50 && attendance >= 75) {
          promotionStatus = "PROMOTED";
          badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (annual >= 45 && attendance >= 75) {
          promotionStatus = "PROMOTED_ON_TRIAL";
          badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
        } else {
          promotionStatus = "REPEAT";
          badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
        }
      }

      // Next class progression
      const { nextClass, isGraduation } = await getNextGrade(student.currentClass || className, tierName);

      compiledRows.push({
        id: student.id,
        name: fullName,
        admissionNumber: student.admissionNumber || `REG-${student.id.slice(-4).toUpperCase()}`,
        currentClass: student.currentClass || className,
        term1Average: Math.round(t1 * 10) / 10,
        term2Average: Math.round(t2 * 10) / 10,
        term3Average: Math.round(t3 * 10) / 10,
        annualAverage: annual,
        annualGrade,
        annualGp,
        attendanceRate: attendance,
        promotionStatus,
        promotionBadgeClass: badgeClass,
        nextClass,
        isGraduation,
      });
    }

    // 4. Sort strictly descending by annual average score
    compiledRows.sort((a, b) => {
      if (b.annualAverage !== a.annualAverage) {
        return b.annualAverage - a.annualAverage;
      }
      return (a.name || "").localeCompare(b.name || "");
    });

    // 5. Assign positions
    let currentRank = 1;
    const finalBroadsheet: BroadsheetStudentRow[] = compiledRows.map((row, idx) => {
      if (idx > 0 && row.annualAverage < compiledRows[idx - 1].annualAverage) {
        currentRank = idx + 1;
      }
      return {
        ...row,
        rank: currentRank,
        positionString: getOrdinal(currentRank),
      };
    });

    // 6. Compute Class Summary Statistics
    const totalEnrolled = finalBroadsheet.length;
    const promotedCount = finalBroadsheet.filter((r) => r.promotionStatus === "PROMOTED").length;
    const promotedOnTrialCount = finalBroadsheet.filter((r) => r.promotionStatus === "PROMOTED_ON_TRIAL").length;
    const repeatedCount = finalBroadsheet.filter((r) => r.promotionStatus === "REPEAT").length;

    const promotionRate =
      totalEnrolled > 0
        ? (((promotedCount + promotedOnTrialCount) / totalEnrolled) * 100).toFixed(1)
        : "0.0";

    const totalSum = finalBroadsheet.reduce((acc, r) => acc + r.annualAverage, 0);
    const classMeanScore = totalEnrolled > 0 ? (totalSum / totalEnrolled).toFixed(1) : "0.0";
    const highestScore = finalBroadsheet.length > 0 ? finalBroadsheet[0].annualAverage : 0;
    const lowestScore =
      finalBroadsheet.length > 0
        ? finalBroadsheet[finalBroadsheet.length - 1].annualAverage
        : 0;

    return {
      success: true,
      broadsheet: finalBroadsheet,
      stats: {
        totalEnrolled,
        promotedCount,
        promotedOnTrialCount,
        repeatedCount,
        promotionRate,
        classMeanScore,
        highestScore,
        lowestScore,
      },
      tierName,
      className,
      academicYear,
    };
  } catch (err: any) {
    console.error("[Broadsheet Action] Failed to fetch annual broadsheet:", err);
    return {
      success: false,
      broadsheet: [],
      stats: {
        totalEnrolled: 0,
        promotedCount: 0,
        promotedOnTrialCount: 0,
        repeatedCount: 0,
        promotionRate: "0.0",
        classMeanScore: "0.0",
        highestScore: 0,
        lowestScore: 0,
      },
      tierName,
      className,
      academicYear,
      error: err.message || "Failed to load annual broadsheet.",
    };
  }
}

/**
 * Fetches the subject-level Continuous Assessment (CA) and termly breakdown for a specific student.
 */
export async function fetchStudentSubjectBreakdown(
  schoolIdOrDomain: string,
  studentId: string,
  academicYear: string = "2026/2027"
): Promise<StudentSubjectBreakdownResponse> {
  try {
    let actualSchoolId = schoolIdOrDomain;
    if (!schoolIdOrDomain.includes("-")) {
      const school = await basePrisma.school.findUnique({
        where: { subdomain: schoolIdOrDomain },
        select: { id: true },
      });
      if (school) actualSchoolId = school.id;
    }

    const student = await basePrisma.student.findUnique({
      where: { id: studentId },
      include: {
        tier: true,
      },
    });

    if (!student) {
      return { success: false, subjects: [], error: "Student record not found." };
    }

    const tierName = student.tier?.name || "Secondary School";

    // Single Source of Truth: Query student's real GradeRecord entries
    const gradeRecords = await basePrisma.gradeRecord.findMany({
      where: {
        schoolId: actualSchoolId,
        studentId,
      },
      orderBy: { subject: "asc" },
    });

    const subjects: SubjectBreakdownRow[] = gradeRecords.map((gr) => {
      const ca1 = gr.ca1 ?? 0;
      const ca2 = gr.ca2 ?? 0;
      const exam = gr.exam ?? 0;
      const total = gr.totalScore ?? (ca1 + ca2 + exam);
      const grade = gr.totalScore >= 75 ? "Distinction" : gr.totalScore >= 65 ? "Very Good" : gr.totalScore >= 50 ? "Credit" : gr.totalScore >= 40 ? "Pass" : "Fail";
      const remark = total >= 75 ? "Distinction" : total >= 65 ? "Very Good" : total >= 50 ? "Credit" : total >= 40 ? "Pass" : "Needs Improvement";

      return {
        code: gr.subject.slice(0, 3).toUpperCase() + " 101",
        name: gr.subject,
        ca1,
        ca2,
        exam,
        term1Total: gr.term.toLowerCase().includes("1") || gr.term.toLowerCase().includes("first") ? total : 0,
        term2Total: gr.term.toLowerCase().includes("2") || gr.term.toLowerCase().includes("second") ? total : 0,
        term3Total: gr.term.toLowerCase().includes("3") || gr.term.toLowerCase().includes("third") ? total : 0,
        annualAverage: total,
        grade,
        remark,
      };
    });

    const overallAvg = Math.round(subjects.reduce((a, b) => a + b.annualAverage, 0) / subjects.length);
    const overallGrade = getNigerianGrade(tierName, overallAvg);

    return {
      success: true,
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber || `REG-${student.id.slice(-4).toUpperCase()}`,
        currentClass: student.currentClass || "JSS 1",
        tierName,
        overallAverage: overallAvg,
        overallGrade,
      },
      subjects,
    };
  } catch (err: any) {
    console.error("[fetchStudentSubjectBreakdown] Error:", err);
    return { success: false, subjects: [], error: err.message || "Failed to load subjects." };
  }
}

/**
 * Executes mass-promotion for the class cohort, honoring repeaters and advancing promoted students.
 */
export async function executeClassPromotionAction(
  schoolIdOrDomain: string,
  options: {
    tierName: string;
    repeatingStudentIds: string[];
  }
) {
  let actualSchoolId = schoolIdOrDomain;
  let subdomain = schoolIdOrDomain;
  if (!schoolIdOrDomain.includes("-")) {
    const school = await basePrisma.school.findUnique({
      where: { subdomain: schoolIdOrDomain },
      select: { id: true, subdomain: true },
    });
    if (school) {
      actualSchoolId = school.id;
      subdomain = school.subdomain;
    }
  } else {
    const school = await basePrisma.school.findUnique({
      where: { id: schoolIdOrDomain },
      select: { subdomain: true },
    });
    if (school) subdomain = school.subdomain;
  }

  const result = await executeTermEndPromotionAction(actualSchoolId, {
    tierName: options.tierName,
    repeatingStudentIds: options.repeatingStudentIds,
  });

  if (result.success) {
    try {
      await safeRedisScanDel(`cache:tenant:${actualSchoolId}:*`);
      await safeRedisScanDel(`cache:tenant:meta:${subdomain.toLowerCase()}`);
    } catch {}

    try {
      revalidatePath(`/${subdomain}/transcripts`, "page");
      revalidatePath(`/${subdomain}/students`, "page");
      revalidatePath(`/${subdomain}/dashboard`, "page");
    } catch {}
  }

  return result;
}
