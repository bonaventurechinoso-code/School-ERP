import { NextRequest, NextResponse } from "next/server";
import { rejectApplicant } from "@/modules/enrollment/enrollment.controller";

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const body = await request.json().catch(() => ({}));
    const { tenant_id, tenantId } = body;

    const { searchParams } = new URL(request.url);
    const effectiveTenantId = tenant_id || tenantId || searchParams.get("tenant_id") || searchParams.get("schoolId");

    if (!effectiveTenantId) {
      return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
    }

    const updated = await rejectApplicant({
      id,
      tenantId: effectiveTenantId,
    });

    return NextResponse.json({
      success: true,
      message: "Applicant rejected",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reject applicant" }, { status: 500 });
  }
}
