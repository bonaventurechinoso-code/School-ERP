import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { basePrisma } from "@/lib/tenant-prisma";

export async function POST(req: Request) {
  try {
    // 1. Session Verification
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    let payload: jose.JWTPayload;
    
    try {
      const verified = await jose.jwtVerify(sessionToken, secret);
      payload = verified.payload;
    } catch (err) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // RBAC: Only ADMIN and TEACHER can save grades
    const role = payload.role as string;
    if (role !== "ADMIN" && role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden: You do not have permission to save grades." }, { status: 403 });
    }

    const tenantId = payload.tenantId as string;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context missing." }, { status: 400 });
    }

    // 2. Payload Extraction & Validation
    const body = await req.json();
    const { studentId, term, className, subject, ca1, ca2, exam } = body;

    if (!studentId || !term || !className || !subject) {
      return NextResponse.json({ error: "Missing required fields (studentId, term, className, subject)" }, { status: 400 });
    }

    const numCa1 = Number(ca1) || 0;
    const numCa2 = Number(ca2) || 0;
    const numExam = Number(exam) || 0;

    // Strict validation rule
    if (numCa1 < 0 || numCa1 > 20) {
      return NextResponse.json({ error: "Bad Request: CA1 score must be between 0 and 20." }, { status: 400 });
    }
    if (numCa2 < 0 || numCa2 > 20) {
      return NextResponse.json({ error: "Bad Request: CA2 score must be between 0 and 20." }, { status: 400 });
    }
    if (numExam < 0 || numExam > 60) {
      return NextResponse.json({ error: "Bad Request: Terminal Exam score must be between 0 and 60." }, { status: 400 });
    }

    // 3. Calculation & DB Commit
    const totalScore = numCa1 + numCa2 + numExam;

    // Verify student belongs to tenant
    const student = await basePrisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student || student.schoolId !== tenantId) {
      return NextResponse.json({ error: "Student not found in this tenant." }, { status: 404 });
    }

    await basePrisma.gradeRecord.upsert({
      where: {
        schoolId_studentId_term_className_subject: {
          schoolId: tenantId,
          studentId: studentId,
          term: term,
          className: className,
          subject: subject
        }
      },
      update: {
        ca1: numCa1,
        ca2: numCa2,
        exam: numExam,
        totalScore: totalScore
      },
      create: {
        schoolId: tenantId,
        studentId: studentId,
        term: term,
        className: className,
        subject: subject,
        ca1: numCa1,
        ca2: numCa2,
        exam: numExam,
        totalScore: totalScore
      }
    });

    // Dynamic Multi-Database Routing: Save to AcademicRecord in dedicated tier DB
    try {
      const { saveAcademicRecord } = await import("@/lib/report-card-service");
      await saveAcademicRecord({
        schoolId: tenantId,
        studentId,
        subject,
        term,
        academicYear: body.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        className,
        numericalScores: {
          test1: numCa1,
          test2: numCa2,
          finalExam: numExam,
        },
      });
    } catch (saveErr) {
      console.warn("[API save] Error syncing to AcademicRecord in tier DB:", saveErr);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Saved Successfully", 
      totalScore 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Save Grade Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
