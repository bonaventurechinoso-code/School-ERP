import { NextRequest, NextResponse } from "next/server";
import { getPaymentReceipts } from "@/lib/payment-receipt-service";

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
      headerTenantId ||
      undefined;

    const schoolId = searchParams.get("schoolId") || undefined;
    const moduleType = searchParams.get("moduleType") || undefined;
    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await getPaymentReceipts({
      tenantId,
      schoolId,
      moduleType,
      status,
      startDate,
      endDate,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[PAYMENT_RECEIPT_LIST_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch payment receipts" },
      { status: 500 }
    );
  }
}
