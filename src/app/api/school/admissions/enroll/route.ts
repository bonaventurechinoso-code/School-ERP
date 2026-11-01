import { NextRequest, NextResponse } from "next/server";
import { enrollApplicantAction } from "@/app/[schoolDomain]/(admin)/admissions/actions";

/**
 * Backward compatibility API route wrapper for student enrollment.
 * Core atomic execution resides in enrollApplicantAction server action.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      applicationId,
      schoolId,
      tierId,
      departmentId,
      classArm,
      termFeeAmount,
    } = body;

    if (!applicationId || !schoolId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: applicationId and schoolId are required." },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

    const result = await enrollApplicantAction({
      applicationId,
      schoolId,
      tenantId: schoolId,
      tierId,
      departmentId,
      classArm,
      termFeeAmount: termFeeAmount ? Number(termFeeAmount) : 0,
      actorId: "API_DISPATCHER",
      ipAddress,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[api/school/admissions/enroll error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal enrollment error." },
      { status: 500 }
    );
  }
}
