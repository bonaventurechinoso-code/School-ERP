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

    // If formFeeStatus is provided (e.g. formFeeStatus === "PAID")
    if (body.formFeeStatus === "PAID" || body.form_fee_status === "PAID") {
      let rawCreds: any = registerRecord?.credentialsJson || {};
      let isArrayCreds = Array.isArray(rawCreds);
      let credsObj = isArrayCreds ? { documents: rawCreds } : { ...(rawCreds || {}) };

      credsObj.formFeePaid = true;
      const existingLogs = Array.isArray(credsObj.statusLogs) ? credsObj.statusLogs : [];
      const newLog = {
        fromStatus: registerRecord?.status || "VERIFIED",
        toStatus: registerRecord?.status || "VERIFIED",
        action: "FORM_FEE_PAID",
        changedById: userRole || "Admissions Officer",
        reason: "Application fee marked as PAID via manual bank transfer",
        createdAt: new Date().toISOString(),
      };
      credsObj.statusLogs = [...existingLogs, newLog];

      const updated = await basePrisma.admissionRegister.update({
        where: { id: targetId },
        data: {
          credentialsJson: credsObj,
          updatedAt: new Date(),
        },
      });

      // Also sync log to linked AdmissionLead if present
      try {
        const lead = await basePrisma.admissionLead.findFirst({
          where: {
            OR: [
              { id: targetId },
              ...(registerRecord?.email ? [{ studentEmail: registerRecord.email }, { parentEmail: registerRecord.email }] : []),
              ...(registerRecord?.parentPhone ? [{ parentPhone: registerRecord.parentPhone }, { parentContact: registerRecord.parentPhone }] : []),
            ],
          },
        });
        if (lead) {
          const leadLogs = Array.isArray(lead.logs) ? (lead.logs as any[]) : [];
          leadLogs.push({
            timestamp: new Date().toISOString(),
            action: "FORM_FEE_PAID",
            note: "Application fee marked as PAID via manual mobile transfer.",
            operator: userRole || "Admissions Officer",
          });
          await basePrisma.admissionLead.update({
            where: { id: lead.id },
            data: { logs: leadLogs as any },
          });
        }
      } catch (leadLogErr) {
        console.warn("[PATCH_ADMISSION_FORM_FEE_LEAD_LOG_WARN]:", leadLogErr);
      }

      return NextResponse.json({ success: true, data: updated, message: "Application fee marked as PAID" });
    }

    return NextResponse.json({ error: "No valid update operation provided" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update applicant" }, { status: 500 });
  }
}
