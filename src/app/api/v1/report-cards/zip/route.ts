import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import JSZip from "jszip";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { generateReportCardPdf, ReportCardPdfData, ReportCardSubjectScore } from "@/lib/report-card-pdf";
import { resolveGradingTier } from "@/lib/grading-engine";
import { getTierForClass } from "@/lib/school-tier-classes";
import { isCrecheClass } from "@/lib/creche-config";
import { isNurseryClass, mapNurseryScoreToGrade } from "@/lib/nursery-config";
import { getSecondaryDemoProfile } from "@/lib/secondary-demo-data";
import { getAcademicPeriodVariants } from "@/lib/tertiary-config";
import { isClassMatch } from "@/lib/class-matching";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const className = url.searchParams.get("className") || "Primary 1";
    const term = url.searchParams.get("term") || "First Term";
    const session = url.searchParams.get("session") || "2026/2027";
    const paramSchoolId = url.searchParams.get("schoolId") || url.searchParams.get("tenantId");

    // Authenticate tenant session
    let tenantId = "";
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (sessionToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(sessionToken, secret);
        tenantId = (payload.tenantId as string) || (payload.schoolId as string) || "";
      } catch (tokenErr) {
        console.warn("[ZIP API] Session token verification notice:", tokenErr);
      }
    }

    if (!tenantId && paramSchoolId) {
      tenantId = paramSchoolId;
    }

    // Resolve tenantId if it is a subdomain / slug rather than a database UUID
    let resolvedSchool: { id: string; name: string; subdomain: string | null; contactPhone: string | null } | null = null;
    if (tenantId) {
      resolvedSchool = await basePrisma.school.findFirst({
        where: {
          OR: [
            { id: tenantId },
            { subdomain: tenantId },
            ...(paramSchoolId ? [{ id: paramSchoolId }, { subdomain: paramSchoolId }] : []),
          ],
        },
        select: {
          id: true,
          name: true,
          subdomain: true,
          contactPhone: true,
        },
      });
      if (resolvedSchool) {
        tenantId = resolvedSchool.id;
      }
    }

    if (!tenantId) {
      const defaultSchool = await basePrisma.school.findFirst({
        select: { id: true, name: true, subdomain: true, contactPhone: true },
      });
      if (defaultSchool) {
        tenantId = defaultSchool.id;
        resolvedSchool = defaultSchool;
      }
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context missing" }, { status: 400 });
    }

    const tenantDb = getTenantClient(tenantId);

    // 1. Fetch School Details
    const school = resolvedSchool || await basePrisma.school.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        contactPhone: true,
      },
    });

    // 2. Resolve Class Students with isClassMatch & basePrisma fallback
    let allStudents = await tenantDb.student.findMany({
      where: {
        schoolId: tenantId,
      },
      include: {
        tier: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }).catch(() => []);

    if (allStudents.length === 0 && tenantDb !== basePrisma) {
      allStudents = await basePrisma.student.findMany({
        where: {
          schoolId: tenantId,
        },
        include: {
          tier: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }).catch(() => []);
    }

    let students = className
      ? allStudents.filter((s: any) => isClassMatch(s.currentClass, className))
      : allStudents;

    const activeStudents = students.filter((s: any) =>
      !s.status || ["ENROLLED", "Enrolled", "enrolled", "ACTIVE", "Active", "active"].includes(s.status)
    );
    if (activeStudents.length > 0) {
      students = activeStudents;
    }

    if (students.length === 0) {
      return NextResponse.json({ error: `No students found enrolled in "${className}".` }, { status: 404 });
    }

    const classTier = getTierForClass(className);
    const tierCategory = classTier.category;

    const isCreche = isCrecheClass(className);
    const isNursery = !isCreche && (isNurseryClass(className) || tierCategory === "NURSERY");
    const isSecondary = tierCategory === "SECONDARY";
    const isPrimary = !isCreche && !isNursery && !isSecondary;

    const resolveZipGrade = (score: number) => {
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

    const resolveZipRemark = (grade: string) => {
      if (grade === "A1" || grade === "Distinction" || grade === "Excellent") return "Distinction in subject concepts";
      if (grade === "B2" || grade === "Very Good") return "Very good academic performance";
      if (grade === "B3" || grade === "Good") return "Good academic performance";
      if (grade === "C4" || grade === "C5" || grade === "C6" || grade === "Credit") return "Credit / Commendable achievement";
      if (grade === "D7" || grade === "E8" || grade === "Pass" || grade === "Developing") return "Pass / Fair progress";
      if (grade === "F9" || grade === "Fail" || grade === "Needs Support") return "Needs Support / Academic intervention required";
      return "Satisfactory effort";
    };

    // 3. Prepare ZIP Archive
    const zip = new JSZip();
    const folderName = `ReportCards_${className.replace(/[^a-zA-Z0-9_-]/g, "_")}_${term.replace(/\s+/g, "_")}`;
    const zipFolder = zip.folder(folderName) || zip;

    // Fetch grades for all students in this class
    const studentIds = students.map((s) => s.id);
    const termVariants = getAcademicPeriodVariants(term);

    let allGradeRecords = studentIds.length > 0 ? await tenantDb.gradeRecord.findMany({
      where: {
        schoolId: tenantId,
        studentId: { in: studentIds },
        term: { in: termVariants },
      },
    }).catch(() => []) : [];

    if (allGradeRecords.length === 0 && studentIds.length > 0 && tenantDb !== basePrisma) {
      allGradeRecords = await basePrisma.gradeRecord.findMany({
        where: {
          schoolId: tenantId,
          studentId: { in: studentIds },
          term: { in: termVariants },
        },
      }).catch(() => []);
    }

    // Also fetch AcademicRecord
    let allAcademicRecords = studentIds.length > 0 ? await tenantDb.academicRecord.findMany({
      where: {
        schoolId: tenantId,
        studentId: { in: studentIds },
        term: { in: termVariants },
      },
    }).catch(() => []) : [];

    if (allAcademicRecords.length === 0 && studentIds.length > 0 && tenantDb !== basePrisma) {
      allAcademicRecords = await basePrisma.academicRecord.findMany({
        where: {
          schoolId: tenantId,
          studentId: { in: studentIds },
          term: { in: termVariants },
        },
      }).catch(() => []);
    }

    let allReportCards = studentIds.length > 0 ? await tenantDb.reportCard.findMany({
      where: {
        schoolId: tenantId,
        studentId: { in: studentIds },
        term: { in: termVariants },
      },
    }).catch(() => []) : [];

    if (allReportCards.length === 0 && studentIds.length > 0 && tenantDb !== basePrisma) {
      allReportCards = await basePrisma.reportCard.findMany({
        where: {
          schoolId: tenantId,
          studentId: { in: studentIds },
          term: { in: termVariants },
        },
      }).catch(() => []);
    }

    const gradesByStudent = new Map<string, any[]>();
    allGradeRecords.forEach((gr: any) => {
      if (!gradesByStudent.has(gr.studentId)) {
        gradesByStudent.set(gr.studentId, []);
      }
      gradesByStudent.get(gr.studentId)!.push(gr);
    });

    allAcademicRecords.forEach((ar: any) => {
      const list = gradesByStudent.get(ar.studentId) || [];
      if (!list.some((item) => (item.subject || "").toLowerCase() === (ar.subject || "").toLowerCase())) {
        list.push({
          subject: ar.subject,
          ca1: Number(ar.test1) || 0,
          ca2: Number(ar.test2) || 0,
          exam: Number(ar.finalExam) || 0,
          totalScore: Number(ar.totalScore) || (Number(ar.test1) || 0) + (Number(ar.test2) || 0) + (Number(ar.finalExam) || 0),
          remarks: ar.teacherRemarks || "",
        });
        gradesByStudent.set(ar.studentId, list);
      }
    });

    const reportCardsByStudent = new Map<string, any>();
    allReportCards.forEach((rc: any) => {
      reportCardsByStudent.set(rc.studentId, rc);
    });

    // 4. Concurrently generate PDF report cards for each student
    const pdfPromises = students.map(async (student: any, index: number) => {
      const existingReportCard = reportCardsByStudent.get(student.id);
      const studentGrades = gradesByStudent.get(student.id) || [];
      let subjectsList: ReportCardSubjectScore[] = studentGrades.map((gr: any) => {
        const ca1 = gr.ca1 !== null && gr.ca1 !== undefined ? Number(gr.ca1) : 0;
        const ca2 = gr.ca2 !== null && gr.ca2 !== undefined ? Number(gr.ca2) : 0;
        const exam = gr.exam !== null && gr.exam !== undefined ? Number(gr.exam) : 0;
        const total = gr.totalScore !== null && gr.totalScore !== undefined ? Number(gr.totalScore) : (ca1 + ca2 + exam);
        const letter = resolveZipGrade(total);
        return {
          subject: gr.subject,
          ca1,
          ca2,
          exam,
          total,
          grade: letter,
          classAverage: 68,
          remark: resolveZipRemark(letter),
        };
      });

      // Hydrate from compiled snapshot if no direct grade records
      if (subjectsList.length === 0 && existingReportCard?.academicRecordSnapshot) {
        try {
          const snapshot = typeof existingReportCard.academicRecordSnapshot === "string"
            ? JSON.parse(existingReportCard.academicRecordSnapshot)
            : existingReportCard.academicRecordSnapshot;
          if (Array.isArray(snapshot) && snapshot.length > 0) {
            subjectsList = snapshot.map((item: any, sIdx: number) => {
              const ca1 = Number(item.ca1 ?? item.test1) || 0;
              const ca2 = Number(item.ca2 ?? item.test2) || 0;
              const exam = Number(item.exam ?? item.finalExam) || 0;
              const total = Number(item.totalScore ?? item.total) || (ca1 + ca2 + exam);
              const letter = item.gradeLetter ?? item.grade ?? resolveZipGrade(total);
              return {
                subject: item.subject,
                ca1,
                ca2,
                exam,
                total,
                grade: letter,
                classAverage: 68,
                remark: item.teacherRemarks || resolveZipRemark(letter),
              };
            });
          }
        } catch (snapErr) {
          console.warn("Failed to parse existingReportCard academicRecordSnapshot:", snapErr);
        }
      }

      // Deduplicate subjects by name
      const seenSubs = new Set<string>();
      subjectsList = subjectsList.filter((s) => {
        const norm = (s.subject || "").trim().toLowerCase();
        if (!norm || seenSubs.has(norm)) return false;
        seenSubs.add(norm);
        return true;
      });

      const isDemo = (school?.subdomain || "").toLowerCase() === "demo";

      if (subjectsList.length === 0 && isSecondary && isDemo) {
        const demoProfile = getSecondaryDemoProfile(student.id) || getSecondaryDemoProfile(student.admissionNumber) || getSecondaryDemoProfile(`${student.firstName} ${student.lastName}`);
        if (demoProfile) {
          subjectsList = demoProfile.subjects.map((sub, sIdx) => ({
            subject: sub.subject,
            ca1: sub.ca1,
            ca2: sub.ca2,
            exam: sub.exam,
            total: sub.total,
            grade: sub.gradeLetter,
            classAverage: 68,
            remark: sub.remarks,
          }));
        }
      }

      // Single Source of Truth: Never inject fake subjects in production
      const totalScore = existingReportCard?.totalScore !== undefined && existingReportCard?.totalScore !== null
        ? Number(existingReportCard.totalScore)
        : subjectsList.reduce((acc, curr) => acc + curr.total, 0);
      const maxPossibleScore = subjectsList.length > 0 ? subjectsList.length * 100 : 100;
      const rawAvg = existingReportCard?.averageScore !== undefined && existingReportCard?.averageScore !== null
        ? Number(existingReportCard.averageScore)
        : (subjectsList.length > 0 ? (totalScore / subjectsList.length) : 0);
      const averageScore = rawAvg.toFixed(2).endsWith(".00") ? rawAvg.toFixed(1) : rawAvg.toFixed(2);
      const avgNum = Number(averageScore);
      const overallGrade = existingReportCard?.gradeLetter || (subjectsList.length === 0
        ? (isNursery || isCreche ? "Needs Support" : "—")
        : resolveZipGrade(avgNum));

      const demoProfile = isSecondary && isDemo ? (getSecondaryDemoProfile(student.id) || getSecondaryDemoProfile(student.admissionNumber)) : null;
      const isEarlyYears = tierCategory === "NURSERY" || isCrecheClass(className) || isNurseryClass(className);
      const rankStr = isEarlyYears
        ? "N/A"
        : existingReportCard?.classPosition
        ? `${existingReportCard.classPosition}${String(existingReportCard.classPosition).endsWith("1") && !String(existingReportCard.classPosition).endsWith("11") ? "st" : String(existingReportCard.classPosition).endsWith("2") && !String(existingReportCard.classPosition).endsWith("12") ? "nd" : String(existingReportCard.classPosition).endsWith("3") && !String(existingReportCard.classPosition).endsWith("13") ? "rd" : "th"}`
        : (demoProfile ? demoProfile.positionString : `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"}`);
      const admissionNumber = student.admissionNumber || demoProfile?.admissionNumber || "Pending";

      const dynamicTeacherRemark = existingReportCard?.teacherRemarks ||
        subjectsList.find((s) => s.remark && typeof s.remark === "string" && s.remark.trim().length > 0)?.remark ||
        (isDemo ? `${student.firstName} shows diligent scholarship and good teamwork. Keep progressing.` : "No remarks recorded yet by teacher in the gradebook.");

      const dynamicPrincipalRemark = existingReportCard?.principalRemarks ||
        (isDemo ? "Satisfactory terminal achievement. Encouraged to maintain consistency." : "Pending official administrative review.");

      const pdfData: ReportCardPdfData = {
        schoolName: school?.name || "Official Academic Institution",
        schoolMotto: (school as any)?.motto || "Knowledge, Discipline and Excellence",
        schoolAddress: (school as any)?.address || "Federal Republic of Nigeria Ministry of Education Certified",
        session,
        term,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNumber,
        className,
        tierCategory,
        gender: "Not Specified",
        daysOpened: 110,
        daysPresent: 108,
        punctualityRate: "98.2%",
        classPosition: rankStr,
        totalStudents: students.length,
        totalScore,
        maxPossibleScore,
        averageScore,
        overallGrade,
        promotionStatus: "Promoted to Next Class",
        subjects: subjectsList,
        teacherRemarks: dynamicTeacherRemark,
        principalRemarks: dynamicPrincipalRemark,
        resumptionDate: existingReportCard?.nextTermBegins
          ? new Date(existingReportCard.nextTermBegins).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : (isDemo ? "Monday, 11th January 2027" : "To be communicated by institution management"),
      };

      const pdfBuffer = await generateReportCardPdf(pdfData);

      const cleanIndex = String(index + 1).padStart(2, "0");
      const cleanLastName = student.lastName.replace(/[^a-zA-Z0-9]/g, "");
      const cleanFirstName = student.firstName.replace(/[^a-zA-Z0-9]/g, "");
      const cleanAdmission = admissionNumber.replace(/[^a-zA-Z0-9]/g, "_");
      const pdfFilename = `${cleanIndex}_${cleanLastName}_${cleanFirstName}_${cleanAdmission}.pdf`;

      zipFolder.file(pdfFilename, pdfBuffer);
    });

    await Promise.all(pdfPromises);

    // 5. Generate ZIP Buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const safeClassName = className.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTerm = term.replace(/\s+/g, "_");
    const zipFilename = `ReportCards_${safeClassName}_${safeTerm}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[ZIP Route] Server Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate class report cards ZIP." }, { status: 500 });
  }
}
