import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      schoolDomain,
      schoolId,
      studentId,
      invoiceId,
      amount,
      paidAt,
      payerBankName,
      payerAccountName,
      sessionId,
      proofImageUrl,
    } = body;

    const targetSchoolIdentifier = (schoolDomain || schoolId || "").trim();

    if (!targetSchoolIdentifier || !studentId || !amount || !sessionId || !proofImageUrl || !payerBankName) {
      return NextResponse.json(
        {
          error:
            "Missing mandatory payment proof details. Amount, Bank, Session ID, and Proof Image are required.",
        },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be a positive number." },
        { status: 400 }
      );
    }

    // Resolve School / Tenant
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: targetSchoolIdentifier.toLowerCase() },
          { id: targetSchoolIdentifier },
        ],
      },
    });

    if (!school) {
      return NextResponse.json(
        { error: `Institution '${targetSchoolIdentifier}' not found.` },
        { status: 404 }
      );
    }

    // Resolve Student
    const student = await basePrisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: school.id,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student record was not found for this institution." },
        { status: 404 }
      );
    }

    // Check duplicate session ID within this school
    const trimmedSessionId = sessionId.trim();
    const existingProof = await basePrisma.paymentProof.findFirst({
      where: {
        schoolId: school.id,
        sessionId: trimmedSessionId,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existingProof) {
      return NextResponse.json(
        {
          error: `A payment proof with Session/Reference ID '${trimmedSessionId}' has already been submitted and is currently ${existingProof.status.toLowerCase()}. Please contact the bursary if you have questions.`,
        },
        { status: 409 }
      );
    }

    // Atomic transaction: Create PaymentProof + update Student.feeStatus
    const result = await basePrisma.$transaction(async (tx) => {
      const proof = await tx.paymentProof.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          invoiceId: invoiceId || null,
          studentName: `${student.firstName} ${student.lastName}`.trim(),
          admissionNumber: student.admissionNumber || "PENDING",
          amount: numericAmount,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          payerBankName: payerBankName.trim(),
          payerAccountName: payerAccountName ? payerAccountName.trim() : null,
          sessionId: trimmedSessionId,
          proofImageUrl: proofImageUrl.trim(),
          status: "PENDING",
        },
      });

      await tx.student.update({
        where: { id: student.id },
        data: { feeStatus: "PENDING_VERIFICATION" },
      });

      return proof;
    });

    return NextResponse.json({
      success: true,
      proofId: result.id,
      message: "Payment proof submitted successfully. Awaiting bursar verification.",
    });
  } catch (error: any) {
    console.error("[SUBMIT_PAYMENT_PROOF_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit payment proof." },
      { status: 500 }
    );
  }
}
