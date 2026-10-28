import { NextRequest, NextResponse } from "next/server";
import {
  getTenantPaymentSettings,
  getModulePaymentSetting,
  upsertPaymentSetting,
  ModuleType,
} from "@/lib/payment-receipt-service";
import {
  PaymentSettingsController,
  assertNoRestrictedGateway,
} from "@/lib/payment-settings-controller";

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

    const tenantGovernance =
      tenantId !== "super-admin"
        ? await PaymentSettingsController.getTenantSettings(tenantId).catch(() => null)
        : null;

    // Single module setting query
    if (moduleType) {
      const setting = await getModulePaymentSetting(tenantId, moduleType, classId, term);
      const primaryBank = tenantGovernance?.bank_accounts?.[0];
      return NextResponse.json({
        success: true,
        setting: {
          ...setting,
          bankName: setting.bankName || primaryBank?.bank_name || null,
          accountNumber: setting.accountNumber || primaryBank?.account_number || null,
          accountName: setting.accountName || primaryBank?.account_name || null,
          customWriteup:
            setting.customWriteup || tenantGovernance?.manual_transfer_instructions || null,
          isManualTransferEnabled:
            tenantGovernance?.effective_is_manual_transfer_enabled ?? true,
          bankAccounts: tenantGovernance?.bank_accounts || [],
        },
        tenant_payment_settings: tenantGovernance,
      });
    }

    // All module settings for tenant
    const settings = await getTenantPaymentSettings(tenantId);
    return NextResponse.json({
      success: true,
      tenantId,
      settings,
      tenant_payment_settings: tenantGovernance,
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
    assertNoRestrictedGateway(body);

    const headerTenantId =
      req.headers.get("x-tenant-id") ||
      req.headers.get("tenant-id") ||
      req.headers.get("x-school-id");

    const tenantId = body.tenantId || body.tenant_id || headerTenantId;

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
