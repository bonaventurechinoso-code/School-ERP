import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationById,
  verifyDocument,
} from "@/modules/enrollment/enrollment.controller";

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id") || searchParams.get("schoolId");

    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id parameter is required" }, { status: 400 });
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
    const body = await request.json();
    const { tenant_id, tenantId, doc_type, docType, verified, verified_by, verifiedBy } = body;

    const effectiveTenantId = tenant_id || tenantId;
    const effectiveDocType = doc_type || docType;

    if (!effectiveTenantId || !effectiveDocType) {
      return NextResponse.json({ error: "tenant_id and doc_type are required" }, { status: 400 });
    }

    const updated = await verifyDocument({
      id,
      tenantId: effectiveTenantId,
      docType: effectiveDocType,
      verified: verified !== undefined ? verified : true,
      verifiedBy: verified_by || verifiedBy,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to verify document" }, { status: 500 });
  }
}
