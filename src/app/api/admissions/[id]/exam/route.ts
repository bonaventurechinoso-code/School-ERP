import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const body = await request.json().catch(() => ({}));
    const {
      score,
      subjectScores,
      rating,
      recommendation,
      observations,
      applicantId = id,
      applicationNo,
    } = body;

    // 1. Locate AdmissionRegister record
    let register = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [
          { id: applicantId },
          { id },
          ...(applicationNo ? [{ applicationNo }] : []),
        ],
      },
    }).catch(() => null);

    if (register) {
      const existingCreds = Array.isArray(register.credentialsJson)
        ? [...register.credentialsJson]
        : [];

      const evalIndex = existingCreds.findIndex(
        (c: any) => c.type === "SCREENING_EVALUATION" || c.key === "screening_evaluation"
      );

      const evaluationData = {
        type: "SCREENING_EVALUATION",
        key: "screening_evaluation",
        score: score ?? null,
        subjectScores: subjectScores || {},
        rating: rating ?? null,
        recommendation: recommendation || "ADMIT",
        observations: observations || "",
        evaluatedAt: new Date().toISOString(),
      };

      if (evalIndex >= 0) {
        existingCreds[evalIndex] = { ...(existingCreds[evalIndex] as any), ...evaluationData };
      } else {
        existingCreds.push(evaluationData);
      }

      register = await basePrisma.admissionRegister.update({
        where: { id: register.id },
        data: {
          credentialsJson: existingCreds as any,
          updatedAt: new Date(),
        },
      });
    }

    // 2. Locate AdmissionLead and update logs
    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          { id: applicantId },
          { id },
        ],
      },
    }).catch(() => null);

    if (!lead && register) {
      lead = await basePrisma.admissionLead.findFirst({
        where: {
          schoolId: register.tenantId,
          OR: [
            { studentEmail: register.email || undefined },
            { parentPhone: register.parentPhone || undefined },
            { applicantName: `${register.firstName} ${register.lastName}`.trim() },
          ],
        },
      }).catch(() => null);
    }

    if (lead) {
      const logs = Array.isArray(lead.logs) ? [...(lead.logs as any[])] : [];
      logs.push({
        timestamp: new Date().toISOString(),
        action: "SCREENING_EVALUATED",
        examScore: score ?? null,
        subjectScores: subjectScores || {},
        interviewRating: rating ?? null,
        recommendation: recommendation || "ADMIT",
        notes: observations || "",
      });

      await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: { logs },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Evaluation saved successfully",
      data: {
        score,
        subjectScores,
        rating,
        recommendation,
        observations,
        registerId: register?.id,
        leadId: lead?.id,
      },
    });
  } catch (error: any) {
    console.error("[API /api/admissions/[id]/exam] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save exam evaluation" },
      { status: 500 }
    );
  }
}
