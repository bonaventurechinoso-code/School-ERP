import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { getTenantClient, basePrisma } from "@/lib/tenant-prisma";
import { cacheAside, buildCacheKey } from "@/lib/cache";
import { getTierForClass } from "@/lib/school-tier-classes";
import { getSecondaryDemoProfile } from "@/lib/secondary-demo-data";
import { getAcademicPeriodVariants } from "@/lib/tertiary-config";

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
      ttlSeconds: 600, // 10 minutes sliding TTL
      fetchFn: async () => {
        const tenantDb = getTenantClient(tenantId);

        // Normalize class variants (e.g., SS 1 vs SSS 1, JSS 1 vs JSS1)
        const classVariants = className ? [className] : [];
        if (className) {
          if (className.startsWith("SS ")) {
            classVariants.push(className.replace("SS ", "SSS "));
          } else if (className.startsWith("SSS ")) {
            classVariants.push(className.replace("SSS ", "SS "));
          }
          if (className.includes(" ")) {
            classVariants.push(className.replace(/\s+/g, ""));
          }
        }

        // Fetch enrolled students matching className (or all if not specified)
        let students = await tenantDb.student.findMany({
          where: {
            schoolId: tenantId,
            status: { in: ["ENROLLED", "ACTIVE"] },
            ...(classVariants.length > 0 ? { currentClass: { in: classVariants } } : {})
          },
          include: { tier: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });

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

        // Fetch existing grade records
        const studentIds = students.map(s => s.id);
        const whereClause: any = {
          schoolId: tenantId,
          term: { in: termVariants },
          ...(classVariants.length > 0 ? { className: { in: classVariants } } : {}),
        };
        if (subject && subject.trim() !== "ALL") {
          whereClause.subject = subject.trim();
        }

        const gradeRecords = await tenantDb.gradeRecord.findMany({
          where: whereClause,
        }).catch(() => []);

        // Also fetch AcademicRecord
        const academicRecords = await tenantDb.academicRecord.findMany({
          where: {
            schoolId: tenantId,
            term: { in: termVariants },
            ...(classVariants.length > 0 ? { className: { in: classVariants } } : {}),
          },
        }).catch(() => []);

        // Also fetch ReportCard records for dynamic teacher & principal remarks
        const reportCards = await tenantDb.reportCard.findMany({
          where: {
            schoolId: tenantId,
            term: { in: termVariants },
            ...(classVariants.length > 0 ? { className: { in: classVariants } } : {}),
          },
        }).catch(() => []);

        // Group grades by studentId (deduplicating identical subjects across period aliases)
        const studentGradesMap = new Map<string, any[]>();
        gradeRecords.forEach((gr) => {
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

        academicRecords.forEach((ar) => {
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

        return students.map(student => {
          let sGrades = studentGradesMap.get(student.id) || [];
          if (sGrades.length === 0 && isDemo) {
            const demoProfile = getSecondaryDemoProfile(student.id) || getSecondaryDemoProfile(student.admissionNumber) || getSecondaryDemoProfile(`${student.firstName} ${student.lastName}`);
            if (demoProfile && (className.toUpperCase().includes("JSS") || (student.currentClass && student.currentClass.toUpperCase().includes("JSS")) || student.tier?.name?.toLowerCase().includes("secondary"))) {
              sGrades = demoProfile.subjects;
            }
          }
          const hasScores = sGrades.length > 0;

          let ca1 = "";
          let ca2 = "";
          let exam = "";
          let totalScore = 0;
          let averageScore = 0;

          if (subject && subject.trim() !== "ALL") {
            const matchSub = sGrades.find(g => g.subject?.toLowerCase() === subject.toLowerCase());
            if (matchSub) {
              ca1 = String(matchSub.ca1);
              ca2 = String(matchSub.ca2);
              exam = String(matchSub.exam);
              totalScore = matchSub.total;
            }
          } else if (hasScores) {
            totalScore = sGrades.reduce((acc, curr) => acc + curr.total, 0);
            averageScore = Math.round((totalScore / sGrades.length) * 100) / 100;
            if (sGrades.length === 1) {
              // Copy CA1, CA2, Exam exactly from the single GradeRecord (no recalculation or 0.2/0.6 weighting)
              ca1 = String(sGrades[0].ca1);
              ca2 = String(sGrades[0].ca2);
              exam = String(sGrades[0].exam);
            } else {
              // Multi-subject: exact average of actual CA1, CA2, Exam entered by teacher
              ca1 = String(Math.round(sGrades.reduce((acc, c) => acc + c.ca1, 0) / sGrades.length));
              ca2 = String(Math.round(sGrades.reduce((acc, c) => acc + c.ca2, 0) / sGrades.length));
              exam = String(Math.round(sGrades.reduce((acc, c) => acc + c.exam, 0) / sGrades.length));
            }
          }

          const resolvedClass = student.currentClass || className || "Primary 1";
          const resolvedTierName = student.tier?.name && student.tier.name !== "Standard"
            ? student.tier.name
            : getTierForClass(resolvedClass).name;

          const rc = reportCards.find((r: any) => r.studentId === student.id);
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
            total: hasScores ? averageScore : 0,
            overallTotal: totalScore,
            overallAverage: averageScore,
            subjectsCount: sGrades.length,
            subjects: sGrades,
            teacherRemarks: dynamicTeacherRemark,
            principalRemarks: rc?.principalRemarks || "",
            isCompiled: hasScores,
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
