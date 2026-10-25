import { NextRequest, NextResponse } from "next/server";
import {
  getTenantPaymentSettings,
  getModulePaymentSetting,
  upsertPaymentSetting,
  ModuleType,
} from "@/lib/payment-receipt-service";

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
      "super-admin";

    const moduleType = searchParams.get("moduleType") as ModuleType | null;
    const classId = searchParams.get("classId");
    const term = searchParams.get("term");

    // Single module setting query
    if (moduleType) {
      const setting = await getModulePaymentSetting(tenantId, moduleType, classId, term);
      return NextResponse.json({
        success: true,
        setting,
      });
    }

    // All module settings for tenant
    const settings = await getTenantPaymentSettings(tenantId);
    return NextResponse.json({
      success: true,
      tenantId,
      settings,
    });
  } catch (error: any) {
    console.error("[PAYMENT_SETTINGS_GET_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch payment settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const headerTenantId =
      req.headers.get("x-tenant-id") ||
      req.headers.get("tenant-id") ||
      req.headers.get("x-school-id");

    const tenantId = body.tenantId || headerTenantId;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    if (!body.moduleType) {
      return NextResponse.json(
        { success: false, error: "moduleType is required" },
        { status: 400 }
      );
    }

    const updated = await upsertPaymentSetting({
      tenantId,
      schoolId: body.schoolId || tenantId,
      moduleType: body.moduleType as ModuleType,
      isEnabled: Boolean(body.isEnabled),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      title: body.title || body.moduleType.replace(/_/g, " "),
      amount: Number(body.amount) || 0,
      currency: body.currency || "NGN",
      customWriteup: body.customWriteup || null,
      accountName: body.accountName || null,
      accountNumber: body.accountNumber || null,
      bankName: body.bankName || null,
      classId: body.classId || null,
      term: body.term || null,
      session: body.session || null,
      updatedBy: body.updatedBy || "Institution Admin",
    });

    return NextResponse.json({
      success: true,
      message: "Payment setting saved successfully",
      setting: updated,
    });
  } catch (error: any) {
    console.error("[PAYMENT_SETTINGS_POST_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update payment setting" },
      { status: 500 }
    );
  }
}
