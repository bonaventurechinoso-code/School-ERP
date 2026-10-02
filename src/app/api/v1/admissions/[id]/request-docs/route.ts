import { NextRequest, NextResponse } from "next/server";
import { requestApplicantDocsAction } from "@/app/[schoolDomain]/(admin)/admissions/actions";

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const { id } = await paramsPromise;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await requestApplicantDocsAction({
      admissionId: id,
      applicationNo: body.applicationNo,
      schoolId: body.schoolId,
      schoolDomain: body.schoolDomain,
      recipientEmail: body.recipientEmail,
      customMessage: body.customMessage,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API_REQUEST_DOCS_POST] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
