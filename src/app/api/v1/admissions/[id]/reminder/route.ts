import { NextRequest, NextResponse } from "next/server";
import { sendMissingDocsReminderAction } from "@/app/[schoolDomain]/(admin)/admissions/actions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const { id } = await paramsPromise;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await sendMissingDocsReminderAction({
      schoolId: body.schoolId,
      schoolDomain: body.schoolDomain,
      applicantId: id,
      applicationNo: body.applicationNo || body.applicationNumber,
      applicantName: body.applicantName,
      recipientEmail: body.recipientEmail || body.email,
      recipientPhone: body.recipientPhone || body.phone,
      missingDocuments: body.missingDocuments || ["Statutory Credentials"],
      customMessage: body.customMessage,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, emailSent: false }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[REMINDER_API_ID_ERROR]:", err);
    return NextResponse.json({ error: err?.message || "Internal server error", emailSent: false }, { status: 500, headers: corsHeaders });
  }
}

