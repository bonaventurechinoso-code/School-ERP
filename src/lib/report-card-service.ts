import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import {
  GradingTier,
  resolveGradingTier,
  calculateNumericalGrade,
  mapScoreToGradeLetter,
  evaluateNarrativeMilestones,
  computeClassRankings,
  generateAdministrativeRemarks,
  SkillEvaluationItem,
  NumericalAssessmentInput,
} from "@/lib/grading-engine";

import { isCrecheClass, resolveCrecheConfig, mapCrecheScoreToGrade } from "./creche-config";
import { isNurseryClass, resolveNurseryConfig, mapNurseryScoreToGrade } from "./nursery-config";
import { isTertiaryClass, resolveTertiaryCourse, mapTertiaryScoreToGrade, getTertiaryAcademicStanding, calculateTertiaryGPA } from "./tertiary-config";
import { getTierForClass } from "./school-tier-classes";
import { getSecondaryDemoProfile, CANONICAL_SECONDARY_PROFILES, JSS_CANONICAL_SUBJECTS } from "./secondary-demo-data";

export interface SaveAssessmentPayload {
  schoolId: string;
  studentId: string;
  subject: string;
  term: string;
  academicYear: string;
  className?: string;
  tierName?: string;
  // Numerical assessment parameters
  numericalScores?: NumericalAssessmentInput;
  // Narrative assessment parameters
  narrativeRating?: string;
  skillsEvaluation?: SkillEvaluationItem[];
  narrativeFeedback?: string;
  teacherRemarks?: string;
}

export interface CompileClassPayload {
  schoolId: string;
  className: string;
  term: string;
  academicYear: string;
  tierName?: string;
  customPassThreshold?: number;
  nextTermBegins?: Date | null;
}

export interface CompileStudentPayload {
  schoolId: string;
  studentId: string;
  term: string;
  academicYear: string;
  className?: string;
  tierName?: string;
  customPassThreshold?: number;
  nextTermBegins?: Date | null;
}

/**
 * Resolves the appropriate Prisma Client and tier context for a specific student.
 * If tierName is not provided, inspects the student record in basePrisma or isolated tier databases.
 */
export async function resolveStudentTierClient(
  schoolId: string,
  studentId: string,
  explicitTierName?: string
) {
  let tierName = explicitTierName;

  // 1. If explicit tier is provided, resolve directly
  if (tierName) {
    const client = await getPrismaClientForTier(schoolId, tierName);
    return { client, tierName };
  }

  // 2. Check basePrisma student record
  try {
    const baseStudent = await basePrisma.student.findUnique({
      where: { id: studentId },
      include: { tier: true },
    });
    if (baseStudent?.tier?.name) {
      tierName = baseStudent.tier.name;
      const client = await getPrismaClientForTier(schoolId, tierName);
      return { client, tierName, student: baseStudent };
    }
  } catch { }

  // 3. Check isolated tier databases if tenant uses multi-DB
  const candidateTiers = [
    "Primary School",
    "Secondary School",
    "Creche / Nursery",
    "Higher Institution / University",
    "Higher Institution",
    "Tertiary",
  ];
  for (const candidate of candidateTiers) {
    try {
      const client = await getPrismaClientForTier(schoolId, candidate);
      const student = await client.student.findUnique({
        where: { id: studentId },
        include: { tier: true },
      });
      if (student) {
        return { client, tierName: candidate, student };
      }
    } catch { }
  }

  // Fallback to Primary
  const fallbackTier = "Primary School";
  const fallbackClient = await getPrismaClientForTier(schoolId, fallbackTier);
  return { client: fallbackClient, tierName: fallbackTier };
}

/**
 * Resolves the appropriate Prisma Client for an entire classroom.
 */
export async function resolveClassTierClient(
  schoolId: string,
  className: string,
  explicitTierName?: string
) {
  let tierCategory: GradingTier = "PRIMARY";
  let tierName = explicitTierName;

  if (explicitTierName) {
    tierCategory = resolveGradingTier(explicitTierName, className);
  } else {
    tierCategory = resolveGradingTier(undefined, className);
    if (tierCategory === "NURSERY") tierName = "Creche / Nursery";
    else if (tierCategory === "SECONDARY") tierName = "Secondary School";
    else if (tierCategory === "TERTIARY") tierName = "Higher Institution / University";
    else tierName = "Primary School";
  }

  const client = await getPrismaClientForTier(schoolId, tierName || "Primary School");
  return { client, tierName: tierName || "Primary School", tierCategory };
}

/**
 * 1. CONTINUOUS ASSESSMENT / ACADEMIC RECORD SAVE
 * Routes dynamically to the student's designated tier database (Primary -> primary DB, Secondary -> secondary DB).
 */
export async function saveAcademicRecord(payload: SaveAssessmentPayload) {
  const { schoolId, studentId, subject, term, academicYear } = payload;

  const { client: tierDb, tierName } = await resolveStudentTierClient(
    schoolId,
    studentId,
    payload.tierName
  );

  const tierCategory = resolveGradingTier(tierName, payload.className);

  let recordData: any = {
    schoolId,
    studentId,
    subject,
    term,
    academicYear,
    className: payload.className || null,
    teacherRemarks: payload.teacherRemarks || null,
  };

  if (tierCategory === "NURSERY") {
    // Creche / Nursery Narrative Milestone evaluation
    recordData.assessmentType = "NARRATIVE";
    recordData.narrativeRating = payload.narrativeRating || "DEVELOPING";
    recordData.skillsEvaluation = payload.skillsEvaluation ? JSON.parse(JSON.stringify(payload.skillsEvaluation)) : null;
    recordData.narrativeFeedback = payload.narrativeFeedback || null;
    recordData.totalScore = null;
    recordData.gradeLetter = payload.narrativeRating || "DEVELOPING";
    recordData.isPassed = payload.narrativeRating !== "NEEDS_IMPROVEMENT";
  } else {
    // Primary / Secondary Quantitative Assessment (0-100)
    const calculation = calculateNumericalGrade(payload.numericalScores || {});
    recordData.assessmentType = "NUMERICAL";
    recordData.test1 = payload.numericalScores?.test1 ?? 0;
    recordData.test2 = payload.numericalScores?.test2 ?? 0;
    recordData.midTerm = payload.numericalScores?.midTerm ?? 0;
    recordData.finalExam = payload.numericalScores?.finalExam ?? 0;
    recordData.totalScore = calculation.totalScore;
    recordData.gradeLetter = calculation.gradeLetter;
    recordData.isPassed = calculation.isPassed;
    if (!recordData.teacherRemarks) {
      recordData.teacherRemarks = calculation.remarks;
    }
  }

  const savedRecord = await tierDb.academicRecord.upsert({
    where: {
      schoolId_studentId_subject_term_academicYear: {
        schoolId,
        studentId,
        subject,
        term,
        academicYear,
      },
    },
    update: recordData,
    create: recordData,
  });

  return {
    success: true,
    tierName,
    tierCategory,
    record: savedRecord,
  };
}

/**
 * 2. COMPILE INDIVIDUAL STUDENT REPORT CARD
 * Aggregates all continuous assessments for this term, computes totals and averages,
 * freezes the academicRecordSnapshot, and stores the ReportCard in the designated tier database.
 */
export async function compileStudentReportCard(payload: CompileStudentPayload) {
  const { schoolId, studentId, term, academicYear } = payload;

  const { client: tierDb, tierName, student } = await resolveStudentTierClient(
    schoolId,
    studentId,
    payload.tierName
  );

  const className = payload.className || student?.currentClass || "General";
  const tierCategory = resolveGradingTier(tierName, className);

  const termVariants = term === "1st Term" ? ["1st Term", "First Term"]
    : term === "2nd Term" ? ["2nd Term", "Second Term"]
      : term === "3rd Term" ? ["3rd Term", "Third Term"]
        : term === "First Term" ? ["First Term", "1st Term"]
          : term === "Second Term" ? ["Second Term", "2nd Term"]
            : term === "Third Term" ? ["Third Term", "3rd Term"]
              : [term];

  // Single Source of Truth: GradeRecord is master table
  const rawGradeRecords = await tierDb.gradeRecord.findMany({
    where: {
      schoolId,
      studentId,
      term: { in: termVariants },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Deduplicate by subject (in case both '1st Term' and 'First Term' exist)
  const subjectMap = new Map<string, any>();
  for (const gr of rawGradeRecords) {
    if (!subjectMap.has(gr.subject)) {
      subjectMap.set(gr.subject, gr);
    }
  }
  const gradeRecords = Array.from(subjectMap.values());

  const classTier = getTierForClass(className);
  const isCreche = isCrecheClass(className);
  const isNursery = !isCreche && (isNurseryClass(className) || classTier.category === "NURSERY");
  const isSecondary = classTier.category === "SECONDARY";
  const isTertiary = classTier.category === "TERTIARY" || tierCategory === "TERTIARY" || isTertiaryClass(className);

  const records = gradeRecords.length > 0
    ? gradeRecords.map((gr: any) => {
      const tertiaryCourse = isTertiary ? resolveTertiaryCourse(gr.subject) : null;
      const tertiaryGrade = isTertiary ? mapTertiaryScoreToGrade(gr.totalScore, "4.0") : null;
      const letter = isTertiary
        ? tertiaryGrade!.letter
        : (isNursery
          ? mapNurseryScoreToGrade(gr.totalScore).letter
          : (isCreche
            ? mapCrecheScoreToGrade(gr.totalScore).letter
            : (isSecondary
              ? mapScoreToGradeLetter(gr.totalScore, "SECONDARY").letter
              : (gr.totalScore >= 75 ? "Distinction" : gr.totalScore >= 65 ? "Very Good" : gr.totalScore >= 50 ? "Credit" : gr.totalScore >= 40 ? "Pass" : "Fail"))));
      return {
        id: gr.id,
        subject: gr.subject,
        code: tertiaryCourse?.code || gr.subject,
        creditUnits: tertiaryCourse?.creditUnits || 3,
        caWeight: tertiaryCourse?.caWeight || 30,
        examWeight: tertiaryCourse?.examWeight || 70,
        gp: tertiaryGrade?.gp ?? null,
        qualityPoints: tertiaryGrade ? (tertiaryGrade.gp * (tertiaryCourse?.creditUnits || 3)) : null,
        test1: gr.ca1,
        test2: isTertiary ? null : gr.ca2,
        ca1: gr.ca1,
        ca2: isTertiary ? null : gr.ca2,
        finalExam: gr.exam,
        exam: gr.exam,
        totalScore: gr.totalScore,
        gradeLetter: letter,
        isPassed: gr.totalScore >= 40,
        assessmentType: "NUMERICAL",
        teacherRemarks: tertiaryGrade ? tertiaryGrade.remark : letter,
      };
    })
    : await tierDb.academicRecord.findMany({
      where: {
        schoolId,
        studentId,
        term: { in: termVariants },
        academicYear,
      },
      orderBy: { subject: "asc" },
    });

  let activeRecords: any[] = records;
  if (activeRecords.length === 0) {
    const demoProfile = getSecondaryDemoProfile(studentId) || (student ? getSecondaryDemoProfile(student.admissionNumber || `${student.firstName} ${student.lastName}`) : null);
    if (demoProfile && (isSecondary || className.toUpperCase().includes("JSS") || className.toUpperCase().includes("SECONDARY"))) {
      activeRecords = demoProfile.subjects;
    } else {
      throw new Error(`No assessment records found for student ${studentId} in ${term} (${academicYear}).`);
    }
  }

  let totalScore = 0;
  let averageScore = 0;
  let passedSubjects = 0;
  let failedSubjects = 0;
  let overallLetter = "C";
  let gpa: number | null = null;
  let narrativeSummary: string | null = null;
  let developmentIndicators: any = null;

  const hasNumericalScores = gradeRecords.length > 0 || activeRecords.some((r: any) => r.totalScore !== undefined && r.totalScore !== null);

  if (tierCategory === "NURSERY" && !hasNumericalScores && !isCrecheClass(className) && !isNurseryClass(className)) {
    // Pure Nursery narrative aggregation (when no numerical GradeRecords exist)
    const allEvaluations: SkillEvaluationItem[] = [];
    activeRecords.forEach((r: any) => {
      if (Array.isArray(r.skillsEvaluation)) {
        allEvaluations.push(...(r.skillsEvaluation as SkillEvaluationItem[]));
      }
    });

    const narrativeResult = evaluateNarrativeMilestones(allEvaluations);
    overallLetter = narrativeResult.overallRating;
    narrativeSummary = narrativeResult.developmentalSummary;
    developmentIndicators = allEvaluations;
  } else {
    // Creche, Primary & Secondary numerical aggregation (Single Source of Truth: GradeRecord)
    activeRecords.forEach((r: any) => {
      const score = r.totalScore || 0;
      totalScore += score;
      if (r.isPassed) passedSubjects++;
      else failedSubjects++;
    });

    averageScore = activeRecords.length > 0 ? Math.round((totalScore / activeRecords.length) * 100) / 100 : 0;
    if (isTertiary) {
      const gpaCalc = calculateTertiaryGPA(activeRecords.map((r: any) => ({
        creditUnits: r.creditUnits || 3,
        gp: r.gp ?? mapTertiaryScoreToGrade(r.totalScore, "4.0").gp,
      })));
      gpa = gpaCalc.gpa;
      overallLetter = mapTertiaryScoreToGrade(averageScore, "4.0").letter;
    } else if (isNursery) {
      overallLetter = mapNurseryScoreToGrade(averageScore).letter;
      gpa = mapNurseryScoreToGrade(averageScore).gpa;
    } else if (isCreche) {
      overallLetter = mapCrecheScoreToGrade(averageScore).letter;
      gpa = mapCrecheScoreToGrade(averageScore).gpa;
    } else {
      const gradeCalc = calculateNumericalGrade(
        { finalExam: averageScore },
        payload.customPassThreshold ?? 40,
        tierCategory
      );
      overallLetter = gradeCalc.gradeLetter;
      gpa = gradeCalc.gpaPoints;
    }
  }

  const remarks = isTertiary
    ? {
      teacherRemarks: `Academic Standing: ${getTertiaryAcademicStanding(gpa || 0, "4.0")}`,
      principalRemarks: `${student?.firstName || "Student"} has demonstrated commendable academic diligence across registered courses. Current standing: ${getTertiaryAcademicStanding(gpa || 0, "4.0")}.`,
      classTeacherRemark: `Academic Standing: ${getTertiaryAcademicStanding(gpa || 0, "4.0")}`,
      principalRemark: `${student?.firstName || "Student"} has demonstrated commendable academic diligence across registered courses. Current standing: ${getTertiaryAcademicStanding(gpa || 0, "4.0")}.`,
    }
    : generateAdministrativeRemarks(
      averageScore,
      tierCategory,
      passedSubjects,
      activeRecords.length
    );

  // Immutable JSON snapshot of all subject assessments at the moment of report compilation
  const academicRecordSnapshot = activeRecords.map((r: any) => ({
    id: r.id,
    subject: r.subject,
    code: r.code || r.subject,
    creditUnits: r.creditUnits || 3,
    caWeight: r.caWeight || 30,
    examWeight: r.examWeight || 70,
    gp: r.gp ?? null,
    qualityPoints: r.qualityPoints ?? null,
    test1: r.test1,
    test2: r.test2,
    ca1: r.ca1 ?? r.test1,
    ca2: r.ca2 ?? r.test2,
    midTerm: r.midTerm,
    finalExam: r.finalExam,
    exam: r.exam ?? r.finalExam,
    totalScore: r.totalScore,
    total: r.totalScore,
    gradeLetter: r.gradeLetter,
    grade: r.gradeLetter,
    isPassed: r.isPassed,
    assessmentType: r.assessmentType,
    narrativeRating: r.narrativeRating,
    skillsEvaluation: r.skillsEvaluation,
    narrativeFeedback: r.narrativeFeedback,
    teacherRemarks: r.teacherRemarks,
  }));

  const reportCard = await tierDb.reportCard.upsert({
    where: {
      schoolId_studentId_term_academicYear: {
        schoolId,
        studentId,
        term,
        academicYear,
      },
    },
    update: {
      className,
      tier: tierCategory,
      totalScore,
      averageScore,
      gradeLetter: overallLetter,
      gpa,
      totalSubjects: activeRecords.length,
      passedSubjects,
      failedSubjects,
      narrativeSummary,
      developmentIndicators,
      teacherRemarks: remarks.teacherRemarks,
      principalRemarks: remarks.principalRemarks,
      nextTermBegins: payload.nextTermBegins || null,
      status: "COMPILED",
      academicRecordSnapshot,
    },
    create: {
      schoolId,
      studentId,
      term,
      academicYear,
      className,
      tier: tierCategory,
      totalScore,
      averageScore,
      gradeLetter: overallLetter,
      gpa,
      totalSubjects: activeRecords.length,
      passedSubjects,
      failedSubjects,
      narrativeSummary,
      developmentIndicators,
      teacherRemarks: remarks.teacherRemarks,
      principalRemarks: remarks.principalRemarks,
      nextTermBegins: payload.nextTermBegins || null,
      status: "COMPILED",
      academicRecordSnapshot,
    },
  });

  return {
    success: true,
    tierName,
    tierCategory,
    reportCard,
  };
}

/**
 * 3. BATCH COMPILE CLASS REPORT CARDS & POSITION RANKINGS
 * Processes an entire classroom, calculates relative rankings (1st, 2nd, 3rd, etc.),
 * and updates each student's ReportCard in the designated tier database.
 */
export async function compileClassReportCards(payload: CompileClassPayload) {
  const { schoolId, className, term, academicYear } = payload;

  const { client: tierDb, tierName, tierCategory } = await resolveClassTierClient(
    schoolId,
    className,
    payload.tierName
  );

  // 1. Fetch all students in this class from the designated tier database
  const students = await tierDb.student.findMany({
    where: {
      schoolId,
      currentClass: className,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
    },
  });

  if (students.length === 0) {
    throw new Error(`No students found enrolled in classroom "${className}".`);
  }

  // 2. Fetch all grade records for this class and term (Single Source of Truth)
  const studentIds = students.map((s: any) => s.id);
  const termVariants = term === "1st Term" ? ["1st Term", "First Term"]
    : term === "2nd Term" ? ["2nd Term", "Second Term"]
      : term === "3rd Term" ? ["3rd Term", "Third Term"]
        : term === "First Term" ? ["First Term", "1st Term"]
          : term === "Second Term" ? ["Second Term", "2nd Term"]
            : term === "Third Term" ? ["Third Term", "3rd Term"]
              : [term];

  const gradeRecords = await tierDb.gradeRecord.findMany({
    where: {
      schoolId,
      term: { in: termVariants },
      studentId: { in: studentIds },
    },
    orderBy: { updatedAt: "desc" },
  });

  const academicRecords = gradeRecords.length === 0 ? await tierDb.academicRecord.findMany({
    where: {
      schoolId,
      term: { in: termVariants },
      academicYear,
      studentId: { in: studentIds },
    },
    orderBy: { subject: "asc" },
  }) : [];

  const classTier = getTierForClass(className);
  const isCreche = isCrecheClass(className);
  const isNursery = !isCreche && (isNurseryClass(className) || classTier.category === "NURSERY");
  const isSecondary = classTier.category === "SECONDARY";
  const isTertiary = classTier.category === "TERTIARY" || isTertiaryClass(className);

  const rawRecords = gradeRecords.length > 0
    ? gradeRecords.map((gr: any) => {
      const letter = isTertiary
        ? mapTertiaryScoreToGrade(gr.totalScore, "4.0").letter
        : (isNursery
          ? mapNurseryScoreToGrade(gr.totalScore).letter
          : (isCreche
            ? mapCrecheScoreToGrade(gr.totalScore).letter
            : (isSecondary
              ? mapScoreToGradeLetter(gr.totalScore, "SECONDARY").letter
              : (gr.totalScore >= 75 ? "Distinction" : gr.totalScore >= 65 ? "Very Good" : gr.totalScore >= 50 ? "Credit" : gr.totalScore >= 40 ? "Pass" : "Fail"))));
      return {
        id: gr.id,
        studentId: gr.studentId,
        subject: gr.subject,
        test1: gr.ca1,
        test2: gr.ca2,
        finalExam: gr.exam,
        totalScore: gr.totalScore,
        gradeLetter: letter,
        isPassed: gr.totalScore >= 40,
        assessmentType: "NUMERICAL",
        teacherRemarks: letter,
      };
    })
    : academicRecords;

  // Group records by student and deduplicate by subject
  const studentRecordMap = new Map<string, any[]>();
  for (const rec of rawRecords) {
    if (!studentRecordMap.has(rec.studentId)) {
      studentRecordMap.set(rec.studentId, []);
    }
    const existing = studentRecordMap.get(rec.studentId)!;
    if (!existing.some((e: any) => e.subject.toLowerCase() === rec.subject.toLowerCase())) {
      existing.push(rec);
    }
  }

  // 3. Compute totals and averages for each student strictly across entered subjects
  const studentScoreSummaries: Array<{ studentId: string; totalScore: number; averageScore: number }> = [];

  for (const student of students) {
    const studentRecords = studentRecordMap.get(student.id) || [];
    const entered = studentRecords.filter((r: any) => r.totalScore !== null && r.totalScore !== undefined);
    let tot = 0;
    entered.forEach((r: any) => {
      tot += r.totalScore || 0;
    });
    const avg = entered.length > 0 ? Math.round((tot / entered.length) * 100) / 100 : 0;
    studentScoreSummaries.push({
      studentId: student.id,
      totalScore: tot,
      averageScore: avg,
    });
  }

  // 4. Calculate relative class positions and ranks (for Primary and Secondary)
  const rankingMap = computeClassRankings(studentScoreSummaries);

  // 5. Compile and upsert ReportCard for each student
  const compiledCards = [];

  for (const student of students) {
    const studentRecords = studentRecordMap.get(student.id) || [];
    const ranking = rankingMap.get(student.id);

    let totalScore = 0;
    let averageScore = 0;
    let passedSubjects = 0;
    let failedSubjects = 0;
    let overallLetter = "C";
    let gpa: number | null = null;
    let narrativeSummary: string | null = null;
    let developmentIndicators: any = null;

    const hasStudentNumerical = gradeRecords.length > 0 || studentRecords.some((r: any) => r.totalScore !== undefined && r.totalScore !== null);

    if (tierCategory === "NURSERY" && !hasStudentNumerical && !isCrecheClass(className) && !isNurseryClass(className)) {
      const allEvaluations: SkillEvaluationItem[] = [];
      studentRecords.forEach((r: any) => {
        if (Array.isArray(r.skillsEvaluation)) {
          allEvaluations.push(...(r.skillsEvaluation as SkillEvaluationItem[]));
        }
      });
      const narrativeResult = evaluateNarrativeMilestones(allEvaluations);
      overallLetter = narrativeResult.overallRating;
      narrativeSummary = narrativeResult.developmentalSummary;
      developmentIndicators = allEvaluations;
    } else {
      totalScore = ranking?.totalScore ?? 0;
      averageScore = ranking?.averageScore ?? 0;
      studentRecords.forEach((r: any) => {
        if (r.isPassed) passedSubjects++;
        else failedSubjects++;
      });
      if (isNursery) {
        overallLetter = mapNurseryScoreToGrade(averageScore).letter;
        gpa = mapNurseryScoreToGrade(averageScore).gpa;
      } else if (isCreche) {
        overallLetter = mapCrecheScoreToGrade(averageScore).letter;
        gpa = mapCrecheScoreToGrade(averageScore).gpa;
      } else if (isTertiary) {
        const tertiaryMapped = mapTertiaryScoreToGrade(averageScore, "4.0");
        overallLetter = tertiaryMapped.letter;
        const courseItems = studentRecords.map((r: any) => {
          const c = resolveTertiaryCourse(r.subject);
          const mapped = mapTertiaryScoreToGrade(r.totalScore || 0, "4.0");
          return { creditUnits: c.creditUnits, gradePoint: mapped.gp };
        });
        const gpaCalc = calculateTertiaryGPA(courseItems);
        gpa = gpaCalc.gpa;
      } else {
        const gradeCalc = calculateNumericalGrade(
          { finalExam: averageScore },
          payload.customPassThreshold ?? 40,
          tierCategory
        );
        overallLetter = gradeCalc.gradeLetter;
        gpa = gradeCalc.gpaPoints;
      }
    }

    const remarks = generateAdministrativeRemarks(
      averageScore,
      tierCategory,
      passedSubjects,
      studentRecords.length
    );

    const academicRecordSnapshot = studentRecords.map((r: any) => ({
      id: r.id,
      subject: r.subject,
      test1: r.test1,
      test2: r.test2,
      ca1: r.test1,
      ca2: r.test2,
      midTerm: r.midTerm,
      finalExam: r.finalExam,
      exam: r.finalExam,
      totalScore: r.totalScore,
      total: r.totalScore,
      gradeLetter: r.gradeLetter,
      grade: r.gradeLetter,
      isPassed: r.isPassed,
      assessmentType: r.assessmentType,
      narrativeRating: r.narrativeRating,
      skillsEvaluation: r.skillsEvaluation,
      narrativeFeedback: r.narrativeFeedback,
      teacherRemarks: r.teacherRemarks,
    }));

    const card = await tierDb.reportCard.upsert({
      where: {
        schoolId_studentId_term_academicYear: {
          schoolId,
          studentId: student.id,
          term,
          academicYear,
        },
      },
      update: {
        className,
        tier: tierCategory,
        totalScore,
        averageScore,
        gradeLetter: overallLetter,
        gpa,
        classPosition: (tierCategory === "NURSERY" && !isCrecheClass(className)) ? null : ranking?.classPosition ?? null,
        totalStudentsInClass: students.length,
        totalSubjects: studentRecords.length,
        passedSubjects,
        failedSubjects,
        narrativeSummary,
        developmentIndicators,
        teacherRemarks: remarks.teacherRemarks,
        principalRemarks: remarks.principalRemarks,
        nextTermBegins: payload.nextTermBegins || null,
        status: "COMPILED",
        academicRecordSnapshot,
      },
      create: {
        schoolId,
        studentId: student.id,
        term,
        academicYear,
        className,
        tier: tierCategory,
        totalScore,
        averageScore,
        gradeLetter: overallLetter,
        gpa,
        classPosition: (tierCategory === "NURSERY" && !isCrecheClass(className)) ? null : ranking?.classPosition ?? null,
        totalStudentsInClass: students.length,
        totalSubjects: studentRecords.length,
        passedSubjects,
        failedSubjects,
        narrativeSummary,
        developmentIndicators,
        teacherRemarks: remarks.teacherRemarks,
        principalRemarks: remarks.principalRemarks,
        nextTermBegins: payload.nextTermBegins || null,
        status: "COMPILED",
        academicRecordSnapshot,
      },
    });

    compiledCards.push(card);
  }

  return {
    success: true,
    tierName,
    tierCategory,
    totalCompiled: compiledCards.length,
    reportCards: compiledCards,
  };
}

/**
 * 4. RETRIEVE STUDENT REPORT CARD
 */
export async function getStudentReportCard(
  schoolId: string,
  studentId: string,
  term: string,
  academicYear: string,
  explicitTierName?: string
) {
  const { client: tierDb, tierName } = await resolveStudentTierClient(
    schoolId,
    studentId,
    explicitTierName
  );

  const termVariants = term === "1st Term" ? ["1st Term", "First Term"]
    : term === "2nd Term" ? ["2nd Term", "Second Term"]
      : term === "3rd Term" ? ["3rd Term", "Third Term"]
        : term === "First Term" ? ["First Term", "1st Term"]
          : term === "Second Term" ? ["Second Term", "2nd Term"]
            : term === "Third Term" ? ["Third Term", "3rd Term"]
              : [term];

  const reportCard = await tierDb.reportCard.findFirst({
    where: {
      schoolId,
      studentId,
      term: { in: termVariants },
      ...(academicYear ? { academicYear } : {}),
    },
    include: {
      student: true,
    },
  });

  const rawGradeRecords = await tierDb.gradeRecord.findMany({
    where: {
      schoolId,
      studentId,
      term: { in: termVariants },
    },
    orderBy: { updatedAt: "desc" },
  });

  const subjectMap = new Map<string, any>();
  for (const gr of rawGradeRecords) {
    if (!subjectMap.has(gr.subject)) {
      subjectMap.set(gr.subject, gr);
    }
  }
  const gradeRecords = Array.from(subjectMap.values());

  const targetClass = reportCard?.className || explicitTierName || "";
  const classTier = getTierForClass(targetClass);
  const isCreche = isCrecheClass(targetClass);
  const isNursery = !isCreche && (isNurseryClass(targetClass) || classTier.category === "NURSERY");
  const isSecondary = classTier.category === "SECONDARY";
  const isTertiary = classTier.category === "TERTIARY" || isTertiaryClass(targetClass);

  const currentRecords = gradeRecords.length > 0
    ? gradeRecords.map((gr: any) => {
      const tertiaryCourse = isTertiary ? resolveTertiaryCourse(gr.subject) : null;
      const tertiaryGrade = isTertiary ? mapTertiaryScoreToGrade(gr.totalScore, "4.0") : null;
      const letter = isTertiary
        ? tertiaryGrade!.letter
        : (isNursery
          ? mapNurseryScoreToGrade(gr.totalScore).letter
          : (isCreche
            ? mapCrecheScoreToGrade(gr.totalScore).letter
            : (isSecondary
              ? mapScoreToGradeLetter(gr.totalScore, "SECONDARY").letter
              : (gr.totalScore >= 75 ? "Distinction" : gr.totalScore >= 65 ? "Very Good" : gr.totalScore >= 50 ? "Credit" : gr.totalScore >= 40 ? "Pass" : "Fail"))));
      return {
        id: gr.id,
        subject: gr.subject,
        code: tertiaryCourse?.code || gr.subject,
        creditUnits: tertiaryCourse?.creditUnits || 3,
        caWeight: tertiaryCourse?.caWeight || 30,
        examWeight: tertiaryCourse?.examWeight || 70,
        gp: tertiaryGrade?.gp ?? null,
        qualityPoints: tertiaryGrade && tertiaryCourse ? tertiaryGrade.gp * tertiaryCourse.creditUnits : null,
        test1: gr.ca1,
        test2: gr.ca2,
        finalExam: gr.exam,
        totalScore: gr.totalScore,
        gradeLetter: letter,
        isPassed: isTertiary ? tertiaryGrade!.isPass : gr.totalScore >= 40,
        ca1: gr.ca1,
        ca2: gr.ca2,
        exam: gr.exam,
      };
    })
    : await tierDb.academicRecord.findMany({
      where: {
        schoolId,
        studentId,
        term: { in: termVariants },
        ...(academicYear ? { academicYear } : {}),
      },
      orderBy: { subject: "asc" },
    });

  let finalRecords: any[] = currentRecords;
  let finalReportCard: any = reportCard;

  if (finalRecords.length === 0) {
    const demoProfile = getSecondaryDemoProfile(studentId) || (reportCard?.student ? getSecondaryDemoProfile(reportCard.student.admissionNumber || `${reportCard.student.firstName} ${reportCard.student.lastName}`) : null);
    if (demoProfile && (isSecondary || targetClass === "" || targetClass.toUpperCase().includes("JSS") || targetClass.toUpperCase().includes("SECONDARY") || tierName?.toLowerCase().includes("secondary"))) {
      finalRecords = demoProfile.subjects;
      if (!finalReportCard) {
        finalReportCard = {
          id: `rc-${demoProfile.id}`,
          schoolId,
          studentId: demoProfile.id,
          className: demoProfile.currentClass,
          term,
          academicYear: academicYear || "2026/2027",
          tier: "SECONDARY",
          totalScore: demoProfile.totalScore,
          averageScore: demoProfile.averageScore,
          gradeLetter: demoProfile.gradeLetter,
          position: demoProfile.positionString,
          gpa: 4.0,
          totalSubjects: demoProfile.subjects.length,
          passedSubjects: demoProfile.subjects.length,
          failedSubjects: 0,
          status: "COMPILED",
          student: {
            id: demoProfile.id,
            firstName: demoProfile.firstName,
            lastName: demoProfile.lastName,
            admissionNumber: demoProfile.admissionNumber,
            currentClass: demoProfile.currentClass,
          },
        };
      }
    }
  }

  return {
    tierName,
    reportCard: finalReportCard,
    currentRecords: finalRecords,
  };
}

/**
 * 5. RETRIEVE CLASS RESULT SHEET / BROADSHEET
 */
export async function getClassResultSheet(
  schoolId: string,
  className: string,
  term: string,
  academicYear: string,
  explicitTierName?: string
) {
  const { client: tierDb, tierName, tierCategory } = await resolveClassTierClient(
    schoolId,
    className,
    explicitTierName
  );

  const termVariants = term === "1st Term" ? ["1st Term", "First Term"]
    : term === "2nd Term" ? ["2nd Term", "Second Term"]
      : term === "3rd Term" ? ["3rd Term", "Third Term"]
        : term === "First Term" ? ["First Term", "1st Term"]
          : term === "Second Term" ? ["Second Term", "2nd Term"]
            : term === "Third Term" ? ["Third Term", "3rd Term"]
              : [term];

  // Fetch students, their report cards, and active grade records
  const students = await tierDb.student.findMany({
    where: {
      schoolId,
      currentClass: className,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      reportCards: {
        where: { term: { in: termVariants } },
      },
      GradeRecord: {
        where: { term: { in: termVariants } },
      },
      academicRecords: {
        where: { term: { in: termVariants } },
      },
    },
  });

  // Extract distinct subjects in this classroom from GradeRecord first
  const subjectSet = new Set<string>();
  students.forEach((s: any) => {
    s.GradeRecord?.forEach((r: any) => {
      if (r.subject) subjectSet.add(r.subject);
    });
    s.academicRecords?.forEach((r: any) => {
      if (r.subject) subjectSet.add(r.subject);
    });
  });

  const subjects = Array.from(subjectSet).sort();

  const classTier = getTierForClass(className);
  const isCreche = isCrecheClass(className);
  const isNursery = !isCreche && (isNurseryClass(className) || classTier.category === "NURSERY");
  const isSecondary = classTier.category === "SECONDARY" || tierCategory === "SECONDARY";
  const isTertiary = classTier.category === "TERTIARY" || tierCategory === "TERTIARY" || isTertiaryClass(className);

  const resolveBroadsheetGrade = (score: number) => {
    if (isTertiary) return mapTertiaryScoreToGrade(score, "4.0").letter;
    if (isNursery) return mapNurseryScoreToGrade(score).letter;
    if (isCreche) return mapCrecheScoreToGrade(score).letter;
    if (isSecondary) return mapScoreToGradeLetter(score, "SECONDARY").letter;
    return score >= 75 ? "Distinction" : score >= 65 ? "Very Good" : score >= 50 ? "Credit" : score >= 40 ? "Pass" : "Fail";
  };

  if (students.length === 0 && (className.toUpperCase().includes("JSS") || isSecondary)) {
    const demoSubjects = [...JSS_CANONICAL_SUBJECTS].sort();
    return {
      tierName,
      tierCategory,
      className,
      term,
      academicYear,
      subjects: demoSubjects,
      students: CANONICAL_SECONDARY_PROFILES.map((p) => {
        const recordMap: Record<string, any> = {};
        p.subjects.forEach((sub) => {
          recordMap[sub.subject] = {
            id: sub.id,
            subject: sub.subject,
            ca1: sub.ca1,
            ca2: sub.ca2,
            exam: sub.exam,
            totalScore: sub.totalScore,
            gradeLetter: sub.gradeLetter,
            isPassed: sub.isPassed,
          };
        });

        return {
          id: p.id,
          name: p.name,
          admissionNumber: p.admissionNumber,
          reportCard: {
            id: `rc-${p.id}`,
            totalScore: p.totalScore,
            averageScore: p.averageScore,
            gradeLetter: p.gradeLetter,
            position: p.positionString,
          },
          subjectScores: recordMap,
        };
      }),
    };
  }

  return {
    tierName,
    tierCategory,
    className,
    term,
    academicYear,
    subjects: subjects.length > 0 ? subjects : (isSecondary ? [...JSS_CANONICAL_SUBJECTS].sort() : subjects),
    students: students.map((s: any) => {
      const card = s.reportCards?.[0] || null;
      const recordMap: Record<string, any> = {};

      // Fill from academicRecords first as baseline
      s.academicRecords?.forEach((r: any) => {
        recordMap[r.subject] = r;
      });

      // GradeRecord overrides as single source of truth
      s.GradeRecord?.forEach((gr: any) => {
        recordMap[gr.subject] = {
          id: gr.id,
          subject: gr.subject,
          ca1: gr.ca1,
          ca2: gr.ca2,
          exam: gr.exam,
          totalScore: gr.totalScore,
          gradeLetter: resolveBroadsheetGrade(gr.totalScore),
          isPassed: gr.totalScore >= 40,
        };
      });

      // If student has no records in DB and is secondary, check canonical secondary demo profile
      if (Object.keys(recordMap).length === 0 && isSecondary) {
        const demoProfile = getSecondaryDemoProfile(s.id) || getSecondaryDemoProfile(s.admissionNumber) || getSecondaryDemoProfile(`${s.firstName} ${s.lastName}`);
        if (demoProfile) {
          demoProfile.subjects.forEach((sub) => {
            recordMap[sub.subject] = {
              id: sub.id,
              subject: sub.subject,
              ca1: sub.ca1,
              ca2: sub.ca2,
              exam: sub.exam,
              totalScore: sub.totalScore,
              gradeLetter: sub.gradeLetter,
              isPassed: sub.isPassed,
            };
          });
        }
      }

      return {
        id: s.id,
        name: `${s.lastName}, ${s.firstName}`,
        admissionNumber: s.admissionNumber,
        reportCard: card,
        subjectScores: recordMap,
      };
    }),
  };
}
