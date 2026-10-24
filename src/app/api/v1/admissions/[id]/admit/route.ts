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
    const userRole = request.headers.get("x-user-role") || request.headers.get("role") || body.userRole || body.role;
    const staffRole = request.headers.get("x-staff-role") || body.staffRole;

    const { checkRouteAuthorization } = await import("@/lib/admissions.service");
    const auth = checkRouteAuthorization({ role: userRole, staffRole }, { resource: "admissions", action: "mutate" });
    if (!auth.canMutate) {
      return NextResponse.json(
        { error: "403 Forbidden: " + (auth.reason || "Student matriculation is restricted to authorized staff.") },
        { status: 403 }
      );
    }

    const result = await admitApplicant({
      id: targetId,
      tenantId: effectiveTenantId,
      verifiedBy: body.verifiedBy || body.verified_by,
      userRole,
      staffRole,
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
