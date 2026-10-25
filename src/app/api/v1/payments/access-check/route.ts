import { NextRequest, NextResponse } from "next/server";
import { checkFeeAccess, ModuleType } from "@/lib/payment-receipt-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const headerTenantId =
      req.headers.get("x-tenant-id") ||
      req.headers.get("tenant-id") ||
      req.headers.get("x-school-id");

    const tenantId =
      searchParams.get("tenantId") ||
      searchParams.get("tenant_id") ||
      headerTenantId;

    const moduleType = searchParams.get("moduleType") as ModuleType;
    const referenceNo = searchParams.get("referenceNo");
    const studentId = searchParams.get("studentId") || undefined;
    const classId = searchParams.get("classId") || undefined;
    const term = searchParams.get("term") || undefined;

    if (!tenantId || !moduleType || !referenceNo) {
      return NextResponse.json(
        {
          success: false,
          error: "tenantId, moduleType, and referenceNo are required parameters",
        },
        { status: 400 }
      );
    }

    const access = await checkFeeAccess({
      tenantId,
      moduleType,
      referenceNo,
      studentId,
      classId,
      term,
    });

    return NextResponse.json({
      success: true,
      ...access,
    });
  } catch (error: any) {
    console.error("[PAYMENT_ACCESS_CHECK_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to check fee access" },
      { status: 500 }
    );
  }
}
