import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);
    
    const tenantId = payload.tenantId as string;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context missing" }, { status: 400 });
    }

    const url = new URL(req.url);
    const term = url.searchParams.get("term");
    const className = url.searchParams.get("className");
    const subject = url.searchParams.get("subject");

    if (!term || !className || !subject) {
      return NextResponse.json({ error: "Missing required query parameters: term, className, subject" }, { status: 400 });
    }

    const tenantDb = getTenantClient(tenantId);

    // Fetch enrolled students matching className or all enrolled students if className is broad
    const students = await tenantDb.student.findMany({
      where: {
        status: { in: ["ENROLLED", "ACTIVE"] },
        ...(className ? { currentClass: className } : {})
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // Fetch existing grade records for this tenant, term, class, subject
    const gradeRecords = await tenantDb.gradeRecord.findMany({
      where: {
        schoolId: tenantId,
        term,
        className,
        subject,
      },
    });

    const gradeMap = new Map(gradeRecords.map(g => [g.studentId, g]));

    const roster = students.map(student => {
      const existing = gradeMap.get(student.id);
      return {
        id: student.id,
        name: `${student.lastName}, ${student.firstName}`,
        ca1: existing ? String(existing.ca1) : "",
        ca2: existing ? String(existing.ca2) : "",
        exam: existing ? String(existing.exam) : "",
      };
    });

    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    console.error("Error fetching report cards roster:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
