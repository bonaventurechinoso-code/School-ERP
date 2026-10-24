import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationById,
  updateApplicantStatus,
  verifyDocument,
  rejectApplicant,
} from "@/modules/enrollment/enrollment.controller";
import { basePrisma } from "@/lib/tenant-prisma";

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const { searchParams } = new URL(request.url);
    const headerTenantId =
      request.headers.get("x-tenant-id") ||
      request.headers.get("tenant-id");
    const tenantId = searchParams.get("tenant_id") || searchParams.get("schoolId") || headerTenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id or x-tenant-id header is required" }, { status: 400 });
    }

    const applicant = await getApplicationById({ id, tenantId });
    if (!applicant) {
      return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: applicant });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch applicant" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const body = await request.json().catch(() => ({}));
    const headerTenantId =
      request.headers.get("x-tenant-id") ||
      request.headers.get("tenant-id");
    const tenantId = body.tenantId || body.tenant_id || body.schoolId || headerTenantId;

    // Check if record exists and retrieve tenant if not provided
    let registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [{ id }, { applicationNo: id }],
      },
    });

    const effectiveTenantId = registerRecord?.tenantId || tenantId;

    if (!effectiveTenantId) {
      return NextResponse.json({ error: "tenant_id or x-tenant-id header is required" }, { status: 400 });
    }

    const targetId = registerRecord ? registerRecord.id : id;

    const { searchParams } = new URL(request.url);
    const targetStatus = body.status || searchParams.get("status");
    const userRole = request.headers.get("x-user-role") || request.headers.get("role") || body.userRole || body.role;
    const staffRole = request.headers.get("x-staff-role") || body.staffRole;

    const { checkRouteAuthorization } = await import("@/lib/admissions.service");
    const auth = checkRouteAuthorization({ role: userRole, staffRole }, { resource: "admissions", action: "mutate" });
    if (!auth.canMutate) {
      return NextResponse.json(
        { error: "403 Forbidden: " + (auth.reason || "Mutation restricted to authorized staff.") },
        { status: 403 }
      );
    }

    // If status is provided, update status
    if (targetStatus) {
      const updated = await updateApplicantStatus({
        id: targetId,
        tenantId: effectiveTenantId,
        status: targetStatus,
        verifiedBy: body.verifiedBy || body.verified_by,
        userRole,
        staffRole,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // If doc_type is provided, verify document
    if (body.doc_type || body.docType) {
      const updated = await verifyDocument({
        id: targetId,
        tenantId: effectiveTenantId,
        docType: body.doc_type || body.docType,
        verified: body.verified !== undefined ? body.verified : true,
        verifiedBy: body.verifiedBy || body.verified_by,
        userRole,
        staffRole,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ error: "No valid update operation provided" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update applicant" }, { status: 500 });
  }
}
