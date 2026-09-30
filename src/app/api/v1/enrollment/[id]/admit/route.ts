import { NextRequest, NextResponse } from "next/server";
import { admitApplicant } from "@/modules/enrollment/enrollment.controller";

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const body = await request.json().catch(() => ({}));
    const { tenant_id, tenantId, verified_by, verifiedBy } = body;

    const { searchParams } = new URL(request.url);
    const effectiveTenantId = tenant_id || tenantId || searchParams.get("tenant_id") || searchParams.get("schoolId");

    if (!effectiveTenantId) {
      return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
    }

    const result = await admitApplicant({
      id,
      tenantId: effectiveTenantId,
      verifiedBy: verified_by || verifiedBy,
    });

    return NextResponse.json({
      success: true,
      message: "Applicant successfully admitted and enrolled in Students module",
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to admit applicant" }, { status: 500 });
  }
}
