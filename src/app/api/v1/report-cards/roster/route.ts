import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { getTenantClient } from "@/lib/tenant-prisma";
import { cacheAside, buildCacheKey } from "@/lib/cache";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    const isDev = process.env.NODE_ENV === "development";

    const url = new URL(req.url);
    const term = url.searchParams.get("term");
    const className = url.searchParams.get("className");
    const subject = url.searchParams.get("subject");
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

    if (!sessionToken && !isDev && !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context missing" }, { status: 400 });
    }

    if (!term || !className || !subject) {
      return NextResponse.json({ error: "Missing required query parameters: term, className, subject" }, { status: 400 });
    }

    const cacheKey = buildCacheKey({
      tenantId,
      table: "grades",
      action: "roster",
      filters: { term, className, subject },
    });

    const roster = await cacheAside({
      key: cacheKey,
      ttlSeconds: 1800, // 30 minutes safe sliding TTL
      fetchFn: async () => {
        const tenantDb = getTenantClient(tenantId);

        // Normalize class variants (e.g., SS 1 vs SSS 1, JSS 1 vs JSS1)
        const classVariants = [className];
        if (className.startsWith("SS ")) {
          classVariants.push(className.replace("SS ", "SSS "));
        } else if (className.startsWith("SSS ")) {
          classVariants.push(className.replace("SSS ", "SS "));
        }
        if (className.includes(" ")) {
          classVariants.push(className.replace(/\s+/g, ""));
        }

        // Fetch enrolled students matching className
        const students = await tenantDb.student.findMany({
          where: {
            schoolId: tenantId,
            status: { in: ["ENROLLED", "ACTIVE"] },
            ...(className ? { currentClass: { in: classVariants } } : {})
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });

        // Support both 1st Term / First Term formatting variants
        const termVariants = term === "1st Term" ? ["1st Term", "First Term"]
          : term === "2nd Term" ? ["2nd Term", "Second Term"]
          : term === "3rd Term" ? ["3rd Term", "Third Term"]
          : term === "First Term" ? ["First Term", "1st Term"]
          : term === "Second Term" ? ["Second Term", "2nd Term"]
          : term === "Third Term" ? ["Third Term", "3rd Term"]
          : [term];

        // Fetch existing grade records for this tenant, term, class, subject
        const gradeRecords = await tenantDb.gradeRecord.findMany({
          where: {
            schoolId: tenantId,
            term: { in: termVariants },
            className: { in: classVariants },
            subject,
          },
        });

        const gradeMap = new Map(gradeRecords.map(g => [g.studentId, g]));

        // Check ExamResult if some or all students have no GradeRecord
        const studentIds = students.map(s => s.id);
        const examResults = await tenantDb.examResult.findMany({
          where: {
            schoolId: tenantId,
            studentId: { in: studentIds },
          },
          orderBy: { createdAt: "desc" },
        });
        const examResultMap = new Map(examResults.map(e => [e.studentId, e]));

        return students.map(student => {
          const existing = gradeMap.get(student.id);
          const examRes = examResultMap.get(student.id);

          const ca1 = existing?.ca1 != null
            ? String(existing.ca1)
            : examRes?.ca1Score != null
            ? String(examRes.ca1Score)
            : "";

          const ca2 = existing?.ca2 != null
            ? String(existing.ca2)
            : examRes?.ca2Score != null
            ? String(examRes.ca2Score)
            : "";

          const exam = existing?.exam != null
            ? String(existing.exam)
            : examRes?.examScore != null
            ? String(examRes.examScore)
            : "";

          return {
            id: student.id,
            admissionNumber: student.admissionNumber || "",
            name: `${student.lastName}, ${student.firstName}`,
            ca1,
            ca2,
            exam,
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
