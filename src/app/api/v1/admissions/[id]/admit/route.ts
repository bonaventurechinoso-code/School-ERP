import { NextRequest, NextResponse } from "next/server";
import { admitApplicant } from "@/modules/enrollment/enrollment.controller";
import { basePrisma } from "@/lib/tenant-prisma";

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const headerTenantId = request.headers.get("x-tenant-id") || request.headers.get("tenant-id");
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || body.schoolId || body.tenant_id || headerTenantId;

    // Find the record by id from AdmissionRegister or AdmissionLead
    let registerRecord = await basePrisma.admissionRegister.findUnique({
      where: { id },
    });

    if (!registerRecord) {
      // Check if it's an applicationNo or find first by lead id
      registerRecord = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [
            { id },
            { applicationNo: id },
          ],
        },
      });
    }

    const effectiveTenantId = registerRecord?.tenantId || tenantId;

    if (!effectiveTenantId) {
      return NextResponse.json({ error: "tenant_id or schoolId is required" }, { status: 400 });
    }

    const targetId = registerRecord ? registerRecord.id : id;

    const result = await admitApplicant({
      id: targetId,
      tenantId: effectiveTenantId,
      verifiedBy: body.verifiedBy || body.verified_by,
    });

    return NextResponse.json({
      success: true,
      message: "Applicant admitted and enrolled. Audit record retained.",
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to admit applicant" }, { status: 500 });
  }
}
