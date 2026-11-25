import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { getTenantClient, basePrisma } from "@/lib/tenant-prisma";
import { cacheAside, buildCacheKey } from "@/lib/cache";
import { getTierForClass } from "@/lib/school-tier-classes";
import { getSecondaryDemoProfile } from "@/lib/secondary-demo-data";
import { getAcademicPeriodVariants } from "@/lib/tertiary-config";
import { isClassMatch } from "@/lib/class-matching";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const isDev = process.env.NODE_ENV === "development";

    const url = new URL(req.url);
    const term = url.searchParams.get("term") || "1st Term";
    const className = url.searchParams.get("className") || "";
    const subject = url.searchParams.get("subject") || "";
    const paramSchoolId = url.searchParams.get("schoolId") || url.searchParams.get("tenantId");
    const isFresh = url.searchParams.get("fresh") === "true";

    let tenantId = "";
    if (sessionToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(sessionToken, secret);
        tenantId = (payload.tenantId as string) || (payload.schoolId as string) || "";
      } catch (tokenErr) {
        console.warn("Session token verification error:", tokenErr);
      }
    }

    if (!tenantId && paramSchoolId) {
      tenantId = paramSchoolId;
    }

    // Resolve tenantId if it is a subdomain / slug rather than a database UUID
    // Hoisted outside block so isDemo check inside fetchFn closure can access it
    let resolvedSchool: { id: string; subdomain: string | null } | null = null;
    if (tenantId) {
      resolvedSchool = await basePrisma.school.findFirst({
        where: {
          OR: [
            { id: tenantId },
            { subdomain: tenantId },
            ...(paramSchoolId ? [{ id: paramSchoolId }, { subdomain: paramSchoolId }] : []),
          ],
        },
      });
      if (resolvedSchool) {
        tenantId = resolvedSchool.id;
      }
    }

    if (!sessionToken && !isDev && !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context missing" }, { status: 400 });
    }

    const cacheKey = buildCacheKey({
      tenantId,
      table: "grades",
      action: "roster",
      filters: { term, className, subject: subject || "ALL" },
    });

    const roster = await cacheAside({
      key: cacheKey,
      ttlSeconds: 60,
      bypassCache: isFresh,
      fetchFn: async () => {
        const tenantDb = getTenantClient(tenantId);

        // Fetch enrolled students matching className with isClassMatch & basePrisma fallback
        let allStudents = await tenantDb.student.findMany({
          where: {
            schoolId: tenantId,
          },
          include: { tier: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }).catch(() => []);

        if (allStudents.length === 0 && tenantDb !== basePrisma) {
          allStudents = await basePrisma.student.findMany({
            where: {
              schoolId: tenantId,
            },
            include: { tier: true },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          }).catch(() => []);
        }

        let students = className
          ? allStudents.filter((s: any) => isClassMatch(s.currentClass, className))
          : allStudents;

        const activeEnrolled = students.filter((s: any) =>
          !s.status || ["ENROLLED", "Enrolled", "enrolled", "ACTIVE", "Active", "active"].includes(s.status)
        );
        if (activeEnrolled.length > 0) {
          students = activeEnrolled;
        }

        // Support 1st Semester / 1st Term variants across tiers
        const termVariants = getAcademicPeriodVariants(term);

        const isDemo = (resolvedSchool?.subdomain || "").toLowerCase() === "demo";

        // Fallback mock students ONLY for public DEMO tenant. Newly registered institutions have strictly zero generated pupils.
        if (students.length === 0 && isDemo) {
          const normClass = className.toUpperCase();
          if (normClass.includes("JSS") || normClass.includes("SS")) {
            students = [
              { id: "mock-jss1-001", firstName: "Chinedu", lastName: "Okonkwo", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "JSS1"}/001`, currentClass: className || "JSS 1", status: "ENROLLED" } as any,
              { id: "mock-jss1-002", firstName: "Amina", lastName: "Bello", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "JSS1"}/002`, currentClass: className || "JSS 1", status: "ENROLLED" } as any,
              { id: "mock-jss1-003", firstName: "Folake", lastName: "Adeyemi", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "JSS1"}/003`, currentClass: className || "JSS 1", status: "ENROLLED" } as any,
              { id: "mock-jss1-004", firstName: "Emeka", lastName: "Nwosu", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "JSS1"}/004`, currentClass: className || "JSS 1", status: "ENROLLED" } as any,
              { id: "mock-jss1-005", firstName: "Zainab", lastName: "Abubakar", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "JSS1"}/005`, currentClass: className || "JSS 1", status: "ENROLLED" } as any,
            ];
          } else if (normClass.includes("NURSERY") || normClass.includes("CRECHE")) {
            students = [
              { id: "mock-nur-001", firstName: "Somtochukwu", lastName: "Nnamdi", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "NUR1"}/001`, currentClass: className || "Nursery 1", status: "ENROLLED" } as any,
              { id: "mock-nur-002", firstName: "Aisha", lastName: "Ibrahim", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "NUR1"}/002`, currentClass: className || "Nursery 1", status: "ENROLLED" } as any,
              { id: "mock-nur-003", firstName: "David", lastName: "Ojo", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "NUR1"}/003`, currentClass: className || "Nursery 1", status: "ENROLLED" } as any,
            ];
          } else if (
            normClass.includes("LEVEL") ||
            normClass.includes("ND") ||
            normClass.includes("HND") ||
            normClass.includes("DIPLOMA") ||
            normClass.includes("UNIVERSITY") ||
            normClass.includes("POLYTECHNIC") ||
            normClass.includes("COLLEGE OF EDUCATION")
          ) {
            // Tertiary: Real DB records only, no fake mock pupils
            students = [];
          } else {
            students = [
              { id: "mock-pri-001", firstName: "Kenechukwu", lastName: "Obi", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "PRI1"}/001`, currentClass: className || "Primary 1", status: "ENROLLED" } as any,
              { id: "mock-pri-002", firstName: "Hauwa", lastName: "Mohammed", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "PRI1"}/002`, currentClass: className || "Primary 1", status: "ENROLLED" } as any,
              { id: "mock-pri-003", firstName: "Babatunde", lastName: "Adeleke", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "PRI1"}/003`, currentClass: className || "Primary 1", status: "ENROLLED" } as any,
              { id: "mock-pri-004", firstName: "Ngozi", lastName: "Eze", admissionNumber: `GW/2026/${className.replace(/\s+/g, "") || "PRI1"}/004`, currentClass: className || "Primary 1", status: "ENROLLED" } as any,
            ];
          }
        }

        // Fetch existing grade records specifically for matched students
        const studentIds = students.map((s: any) => s.id);

        let gradeRecords = studentIds.length > 0 ? await tenantDb.gradeRecord.findMany({
          where: {
            schoolId: tenantId,
            term: { in: termVariants },
            studentId: { in: studentIds },
            ...(subject && subject.trim() !== "ALL" ? { subject: subject.trim() } : {}),
          },
        }).catch(() => []) : [];

        if (gradeRecords.length === 0 && studentIds.length > 0 && tenantDb !== basePrisma) {
          gradeRecords = await basePrisma.gradeRecord.findMany({
            where: {
              schoolId: tenantId,
              term: { in: termVariants },
              studentId: { in: studentIds },
              ...(subject && subject.trim() !== "ALL" ? { subject: subject.trim() } : {}),
            },
          }).catch(() => []);
        }

        // Also fetch AcademicRecord
        let academicRecords = studentIds.length > 0 ? await tenantDb.academicRecord.findMany({
          where: {
            schoolId: tenantId,
            term: { in: termVariants },
            studentId: { in: studentIds },
          },
        }).catch(() => []) : [];

        if (academicRecords.length === 0 && studentIds.length > 0 && tenantDb !== basePrisma) {
          academicRecords = await basePrisma.academicRecord.findMany({
            where: {
              schoolId: tenantId,
              term: { in: termVariants },
              studentId: { in: studentIds },
            },
          }).catch(() => []);
        }

        // Also fetch ReportCard records for compiled snapshots, ranks, and remarks
        let reportCards = studentIds.length > 0 ? await tenantDb.reportCard.findMany({
          where: {
            schoolId: tenantId,
            term: { in: termVariants },
            studentId: { in: studentIds },
          },
        }).catch(() => []) : [];

        if (reportCards.length === 0 && studentIds.length > 0 && tenantDb !== basePrisma) {
          reportCards = await basePrisma.reportCard.findMany({
            where: {
              schoolId: tenantId,
              term: { in: termVariants },
              studentId: { in: studentIds },
            },
          }).catch(() => []);
        }

        // Group grades by studentId (deduplicating identical subjects across period aliases)
        const studentGradesMap = new Map<string, any[]>();
        gradeRecords.forEach((gr: any) => {
          const list = studentGradesMap.get(gr.studentId) || [];
          const existingIdx = list.findIndex((item) => item.subject === gr.subject);
          const entry = {
            subject: gr.subject,
            ca1: Number(gr.ca1) || 0,
            ca2: Number(gr.ca2) || 0,
            exam: Number(gr.exam) || 0,
            total: Number(gr.totalScore) || (Number(gr.ca1) || 0) + (Number(gr.ca2) || 0) + (Number(gr.exam) || 0),
            grade: (gr as any).grade || undefined,
            remarks: (gr as any).remarks || "",
          };
          if (existingIdx >= 0) {
            if (gr.term && gr.term.toLowerCase().includes("semester")) {
              list[existingIdx] = entry;
            }
          } else {
            list.push(entry);
          }
          studentGradesMap.set(gr.studentId, list);
        });

        academicRecords.forEach((ar: any) => {
          const list = studentGradesMap.get(ar.studentId) || [];
          // Avoid duplicate subject
          if (!list.some((item) => item.subject?.toLowerCase() === ar.subject?.toLowerCase())) {
            list.push({
              subject: ar.subject,
              ca1: Number(ar.test1) || 0,
              ca2: Number(ar.test2) || 0,
              exam: Number(ar.finalExam) || 0,
              total: Number(ar.totalScore) || (Number(ar.test1) || 0) + (Number(ar.test2) || 0) + (Number(ar.finalExam) || 0),
              remarks: ar.teacherRemarks || "",
            });
            studentGradesMap.set(ar.studentId, list);
          }
        });

        return students.map((student: any) => {
          const rc = reportCards.find((r: any) => r.studentId === student.id);
          let sGrades = studentGradesMap.get(student.id) || [];

          // If no direct grade records, but reportCard has academicRecordSnapshot, hydrate sGrades from snapshot!
          if (sGrades.length === 0 && rc?.academicRecordSnapshot) {
            try {
              const snapshot = typeof rc.academicRecordSnapshot === "string"
                ? JSON.parse(rc.academicRecordSnapshot)
                : rc.academicRecordSnapshot;
              if (Array.isArray(snapshot) && snapshot.length > 0) {
                sGrades = snapshot.map((item: any) => ({
                  subject: item.subject,
                  ca1: Number(item.ca1 ?? item.test1) || 0,
                  ca2: Number(item.ca2 ?? item.test2) || 0,
                  exam: Number(item.exam ?? item.finalExam) || 0,
                  total: Number(item.totalScore ?? item.total) || 0,
                  grade: item.gradeLetter ?? item.grade,
                  remarks: item.teacherRemarks || "",
                }));
              }
            } catch (snapErr) {
              console.warn("Failed to parse academicRecordSnapshot:", snapErr);
            }
          }

          if (sGrades.length === 0 && isDemo) {
            const demoProfile = getSecondaryDemoProfile(student.id) || getSecondaryDemoProfile(student.admissionNumber) || getSecondaryDemoProfile(`${student.firstName} ${student.lastName}`);
            if (demoProfile && (className.toUpperCase().includes("JSS") || (student.currentClass && student.currentClass.toUpperCase().includes("JSS")) || student.tier?.name?.toLowerCase().includes("secondary"))) {
              sGrades = demoProfile.subjects;
            }
          }

          const hasScores = sGrades.length > 0;
          const isCompiled = Boolean(rc || hasScores);

          let ca1 = "";
          let ca2 = "";
          let exam = "";
          let totalScore = rc?.totalScore !== undefined && rc?.totalScore !== null ? Number(rc.totalScore) : 0;
          let averageScore = rc?.averageScore !== undefined && rc?.averageScore !== null ? Number(rc.averageScore) : 0;

          if (subject && subject.trim() !== "ALL") {
            const matchSub = sGrades.find((g: any) => g.subject?.toLowerCase() === subject.toLowerCase());
            if (matchSub) {
              ca1 = String(matchSub.ca1);
              ca2 = String(matchSub.ca2);
              exam = String(matchSub.exam);
              totalScore = matchSub.total;
              averageScore = matchSub.total;
            }
          } else if (hasScores) {
            if (totalScore === 0) {
              totalScore = sGrades.reduce((acc: number, curr: any) => acc + curr.total, 0);
            }
            if (averageScore === 0) {
              averageScore = Math.round((totalScore / sGrades.length) * 100) / 100;
            }
            if (sGrades.length === 1) {
              // Copy CA1, CA2, Exam exactly from the single GradeRecord
              ca1 = String(sGrades[0].ca1);
              ca2 = String(sGrades[0].ca2);
              exam = String(sGrades[0].exam);
            } else {
              // Multi-subject: exact average of actual CA1, CA2, Exam entered by teacher
              ca1 = String(Math.round(sGrades.reduce((acc: number, c: any) => acc + c.ca1, 0) / sGrades.length));
              ca2 = String(Math.round(sGrades.reduce((acc: number, c: any) => acc + c.ca2, 0) / sGrades.length));
              exam = String(Math.round(sGrades.reduce((acc: number, c: any) => acc + c.exam, 0) / sGrades.length));
            }
          }

          const resolvedClass = student.currentClass || className || "Primary 1";
          const resolvedTierName = student.tier?.name && student.tier.name !== "Standard"
            ? student.tier.name
            : getTierForClass(resolvedClass).name;

          const dynamicTeacherRemark = rc?.teacherRemarks ||
            sGrades.map((g: any) => g.remarks).find((rem: any) => rem && typeof rem === "string" && rem.trim().length > 0) ||
            "";

          return {
            id: student.id,
            admissionNumber: student.admissionNumber || `GW/2026/${(student.currentClass || "CLASS").replace(/\s+/g, "")}/${student.id.slice(0, 3)}`,
            name: [student.lastName, student.firstName].filter(Boolean).join(", ") || String(student.admissionNumber || "Student"),
            currentClass: resolvedClass,
            tier: resolvedTierName,
            ca1,
            ca2,
            exam,
            total: (hasScores || rc) ? averageScore : 0,
            overallTotal: totalScore,
            overallAverage: averageScore,
            overallGrade: rc?.gradeLetter || undefined,
            rank: rc?.classPosition ? (parseInt(String(rc.classPosition)) || 0) : 0,
            classPosition: rc?.classPosition ? String(rc.classPosition) : undefined,
            totalStudents: rc?.totalStudentsInClass || students.length,
            subjectsCount: sGrades.length || rc?.totalSubjects || 0,
            subjects: sGrades,
            teacherRemarks: dynamicTeacherRemark,
            principalRemarks: rc?.principalRemarks || "",
            isCompiled,
          };
        });
      },
    });

    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    console.error("Error fetching report cards roster:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
