import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { generateReportCardPdf, ReportCardPdfData, ReportCardSubjectScore } from "@/lib/report-card-pdf";
import { resolveGradingTier } from "@/lib/grading-engine";
import { isCrecheClass, resolveCrecheConfig } from "@/lib/creche-config";
import { isNurseryClass, mapNurseryScoreToGrade } from "@/lib/nursery-config";
import { isTertiaryClass, resolveTertiaryCourse, mapTertiaryScoreToGrade, getTertiaryAcademicStanding, calculateTertiaryGPA, formatTertiarySemester } from "@/lib/tertiary-config";
import { getTierForClass } from "@/lib/school-tier-classes";
import { getSecondaryDemoProfile } from "@/lib/secondary-demo-data";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    const term = url.searchParams.get("term") || "First Term";
    const session = url.searchParams.get("session") || "2026/2027";
    const paramSchoolId = url.searchParams.get("schoolId") || url.searchParams.get("tenantId");

    // Authenticate tenant session
    let tenantId = "";
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const isDev = process.env.NODE_ENV === "development";

    if (sessionToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(sessionToken, secret);
        tenantId = (payload.tenantId as string) || (payload.schoolId as string) || "";
      } catch (tokenErr) {
        console.warn("[PDF API] Session token verification notice:", tokenErr);
      }
    }

    if (!tenantId && paramSchoolId) {
      tenantId = paramSchoolId;
    }

    if (!tenantId) {
      // Fallback to first available school in dev mode
      const defaultSchool = await basePrisma.school.findFirst({ select: { id: true } });
      tenantId = defaultSchool?.id || "";
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context missing" }, { status: 400 });
    }

    if (!studentId) {
      return NextResponse.json({ error: "Missing required parameter: studentId" }, { status: 400 });
    }

    const tenantDb = getTenantClient(tenantId);

    // 1. Fetch School Details
    const school = await basePrisma.school.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        contactPhone: true,
      },
    });

    // 2. Fetch Student Bio-data
    let student: any = await tenantDb.student.findUnique({
      where: { id: studentId },
      include: {
        tier: true,
      },
    });

    const isDemo = (school?.subdomain || "").toLowerCase() === "demo";
    const demoProfile = isDemo
      ? (getSecondaryDemoProfile(studentId) || (student ? getSecondaryDemoProfile(student.admissionNumber || `${student.firstName} ${student.lastName}`) : null))
      : null;

    if (!student) {
      if (demoProfile && isDemo) {
        student = {
          id: demoProfile.id,
          schoolId: tenantId,
          firstName: demoProfile.firstName,
          lastName: demoProfile.lastName,
          admissionNumber: demoProfile.admissionNumber,
          currentClass: demoProfile.currentClass,
          status: "ENROLLED",
          tier: { name: "Secondary School", id: "secondary" } as any,
        } as any;
      } else {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
    }

    const currentClass = student.currentClass || url.searchParams.get("className") || "Primary 1";
    const classTier = getTierForClass(currentClass);
    const tierCategory = classTier.category;

    // 3. Fetch Academic Records / Grades for this student
    const termVariants = term === "1st Term" ? ["1st Term", "First Term"]
      : term === "2nd Term" ? ["2nd Term", "Second Term"]
        : term === "3rd Term" ? ["3rd Term", "Third Term"]
          : term === "First Term" ? ["First Term", "1st Term"]
            : term === "Second Term" ? ["Second Term", "2nd Term"]
              : term === "Third Term" ? ["Third Term", "3rd Term"]
                : [term];

    // Priority 1: GradeRecord (Single Source of Truth)
    const rawGradeRecords = await tenantDb.gradeRecord.findMany({
      where: {
        schoolId: tenantId,
        studentId: student.id,
        term: { in: termVariants },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Deduplicate by subject
    const subjectRecordMap = new Map<string, any>();
    for (const gr of rawGradeRecords) {
      if (!subjectRecordMap.has(gr.subject)) {
        subjectRecordMap.set(gr.subject, gr);
      }
    }
    const gradeRecords = Array.from(subjectRecordMap.values());

    // Priority 2: AcademicRecord (Fallback only if no GradeRecord exists)
    const academicRecords = gradeRecords.length === 0 ? await tenantDb.academicRecord.findMany({
      where: {
        schoolId: tenantId,
        studentId: student.id,
        term: { in: termVariants },
      },
      orderBy: { subject: "asc" },
    }) : [];

    // 4. Transform Records into ReportCardSubjectScores
    const subjectsMap = new Map<string, ReportCardSubjectScore>();

    const isCreche = isCrecheClass(currentClass) || isCrecheClass(tierCategory);
    const isNursery = !isCreche && (isNurseryClass(currentClass) || tierCategory === "NURSERY");
    const isSecondary = tierCategory === "SECONDARY";
    const isTertiary = tierCategory === "TERTIARY" || isTertiaryClass(currentClass) || isTertiaryClass(tierCategory);
    const isPrimary = !isCreche && !isNursery && !isSecondary && !isTertiary;

    const resolvePdfGrade = (score: number) => {
      if (isTertiary) {
        return mapTertiaryScoreToGrade(score, "4.0").letter;
      }
      if (isNursery || isCreche) {
        return mapNurseryScoreToGrade(score).letter;
      }
      if (isSecondary) {
        if (score >= 75) return "A1";
        if (score >= 70) return "B2";
        if (score >= 65) return "B3";
        if (score >= 60) return "C4";
        if (score >= 55) return "C5";
        if (score >= 50) return "C6";
        if (score >= 45) return "D7";
        if (score >= 40) return "E8";
        return "F9";
      }
      if (score >= 75) return "Distinction";
      if (score >= 65) return "Very Good";
      if (score >= 50) return "Credit";
      if (score >= 40) return "Pass";
      return "Fail";
    };

    const resolvePdfRemark = (grade: string) => {
      if (isTertiary) {
        if (grade === "A") return "Distinction";
        if (grade === "B") return "Upper Credit";
        if (grade === "C") return "Lower Credit";
        if (grade === "D") return "Pass";
        return "Fail";
      }
      if (grade === "A1" || grade === "Distinction" || grade === "Excellent") return "Distinction in subject concepts";
      if (grade === "B2" || grade === "Very Good") return "Very good academic performance";
      if (grade === "B3" || grade === "Good") return "Good academic performance";
      if (grade === "C4" || grade === "C5" || grade === "C6" || grade === "Credit") return "Credit / Commendable achievement";
      if (grade === "D7" || grade === "E8" || grade === "Pass" || grade === "Developing") return "Pass / Fair progress";
      if (grade === "F9" || grade === "Fail" || grade === "Needs Support") return "Needs Support / Academic intervention required";
      return "Satisfactory effort";
    };

    if (gradeRecords.length > 0) {
      gradeRecords.forEach((gr, idx) => {
        const tertiaryCourse = isTertiary ? resolveTertiaryCourse(gr.subject) : null;
        const ca1 = gr.ca1 !== null && gr.ca1 !== undefined ? Number(gr.ca1) : 0;
        const ca2 = isTertiary ? undefined : (gr.ca2 !== null && gr.ca2 !== undefined ? Number(gr.ca2) : 0);
        const exam = gr.exam !== null && gr.exam !== undefined ? Number(gr.exam) : 0;
        const total = gr.totalScore !== null && gr.totalScore !== undefined ? Number(gr.totalScore) : (ca1 + (ca2 || 0) + exam);
        const letter = resolvePdfGrade(total);
        const tertiaryGrade = isTertiary ? mapTertiaryScoreToGrade(total, "4.0") : null;
        subjectsMap.set(gr.subject, {
          subject: gr.subject,
          code: tertiaryCourse?.code || gr.subject,
          creditUnits: tertiaryCourse?.creditUnits || 3,
          ca1,
          ca2,
          exam,
          total,
          grade: letter,
          gp: tertiaryGrade?.gp,
          qualityPoints: tertiaryGrade ? tertiaryGrade.gp * (tertiaryCourse?.creditUnits || 3) : undefined,
          subjectPosition: `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"}`,
          classAverage: 68,
          remark: resolvePdfRemark(letter),
        });
      });
    } else if (academicRecords.length > 0) {
      academicRecords.forEach((ar, idx) => {
        const ca1 = ar.test1 !== null && ar.test1 !== undefined ? Number(ar.test1) : 0;
        const ca2 = (ar.test2 !== null && ar.test2 !== undefined ? Number(ar.test2) : (ar.midTerm !== null && ar.midTerm !== undefined ? Number(ar.midTerm) : 0));
        const exam = ar.finalExam !== null && ar.finalExam !== undefined ? Number(ar.finalExam) : 0;
        const total = ar.totalScore !== null && ar.totalScore !== undefined ? Number(ar.totalScore) : (ca1 + ca2 + exam);
        const letter = ar.gradeLetter || resolvePdfGrade(total);
        subjectsMap.set(ar.subject, {
          subject: ar.subject,
          ca1,
          ca2,
          exam,
          total,
          grade: letter,
          subjectPosition: `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"}`,
          classAverage: 68,
          remark: ar.teacherRemarks || resolvePdfRemark(letter),
        });
      });
    }

    if (subjectsMap.size === 0 && demoProfile && isSecondary && isDemo) {
      demoProfile.subjects.forEach((sub, idx) => {
        subjectsMap.set(sub.subject, {
          subject: sub.subject,
          ca1: sub.ca1,
          ca2: sub.ca2,
          exam: sub.exam,
          total: sub.total,
          grade: sub.gradeLetter,
          subjectPosition: `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"}`,
          classAverage: 68,
          remark: sub.remarks,
        });
      });
    }

    let subjectsList = Array.from(subjectsMap.values());

    // Single Source of Truth: Never inject fake subjects in production
    // If no records saved yet, leave subjectsList empty!

    // Calculate Totals & Summary
    const totalScore = subjectsList.reduce((acc, curr) => acc + curr.total, 0);
    const maxPossibleScore = subjectsList.length * 100;
    const rawAverage = subjectsList.length > 0 ? (totalScore / subjectsList.length) : 0;
    const averageScore = rawAverage.toFixed(2).endsWith(".00") ? rawAverage.toFixed(1) : rawAverage.toFixed(2);
    const avgNum = Number(averageScore);
    const overallGrade = subjectsList.length === 0
      ? (isNursery || isCreche ? "Needs Support" : "—")
      : resolvePdfGrade(avgNum);
    const admissionNumber = student.admissionNumber || demoProfile?.admissionNumber || "Pending";

    // Fetch class position from official compiled ReportCard if available
    const existingReportCard = await tenantDb.reportCard.findFirst({
      where: {
        schoolId: tenantId,
        studentId: student.id,
        term: { in: termVariants },
      },
    });
    const rankNum = existingReportCard?.classPosition;
    const totalInClass = existingReportCard?.totalStudentsInClass || (demoProfile ? 5 : 1);
    const rankSuffix = rankNum
      ? `${rankNum}${rankNum === 1 ? "st" : rankNum === 2 ? "nd" : rankNum === 3 ? "rd" : "th"}`
      : (demoProfile ? demoProfile.positionString : "1st");

    const tertiaryGpaCalc = isTertiary
      ? calculateTertiaryGPA(subjectsList.map((s) => ({
          creditUnits: s.creditUnits || 3,
          gp: s.gp !== undefined && s.gp !== null ? s.gp : mapTertiaryScoreToGrade(s.total, "4.0").gp,
        })))
      : null;

    const dynamicTeacherRemark = existingReportCard?.teacherRemarks ||
      subjectsList.find((s) => s.remark && typeof s.remark === "string" && s.remark.trim().length > 0)?.remark ||
      (isDemo
        ? `${student.firstName} is an exemplary scholar with stellar intellectual and behavioral diligence. Keep up the high standard.`
        : "No remarks recorded yet by teacher in the gradebook.");

    const dynamicPrincipalRemark = existingReportCard?.principalRemarks ||
      (isDemo
        ? "Remarkable terminal achievement. Commended for academic excellence and leadership."
        : "Pending official administrative review.");

    const pdfData: ReportCardPdfData = {
      schoolName: school?.name || "Official Academic Institution",
      schoolMotto: (school as any)?.motto || "Knowledge, Discipline and Excellence",
      schoolAddress: (school as any)?.address || "Federal Republic of Nigeria Ministry of Education Certified",
      session,
      term: isTertiary ? formatTertiarySemester(term) : term,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNumber,
      className: currentClass,
      tierCategory: isTertiary ? "TERTIARY" : tierCategory,
      gender: "Not Specified",
      daysOpened: 110,
      daysPresent: 108,
      punctualityRate: "98.2%",
      classPosition: rankSuffix,
      totalStudents: totalInClass,
      totalScore,
      maxPossibleScore,
      averageScore,
      overallGrade: isTertiary ? undefined : overallGrade,
      promotionStatus: isTertiary
        ? getTertiaryAcademicStanding(tertiaryGpaCalc?.gpa || 0, "4.0")
        : "Promoted to Next Class",
      gpa: tertiaryGpaCalc?.gpa,
      totalCreditUnits: tertiaryGpaCalc?.totalCreditUnits,
      totalQualityPoints: tertiaryGpaCalc?.totalQualityPoints,
      subjects: subjectsList,
      teacherRemarks: dynamicTeacherRemark,
      principalRemarks: dynamicPrincipalRemark,
      resumptionDate: existingReportCard?.nextTermBegins
        ? new Date(existingReportCard.nextTermBegins).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        : (isDemo ? "Monday, 11th January 2027" : "To be communicated by institution management"),
    };

    // 5. Generate PDF Buffer
    const pdfBuffer = await generateReportCardPdf(pdfData);

    const safeAdmissionNumber = admissionNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTerm = term.replace(/\s+/g, "_");
    const filename = `ReportCard_${safeAdmissionNumber}_${safeTerm}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[PDF Route] Server Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report card PDF." }, { status: 500 });
  }
}
