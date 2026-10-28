import { NextRequest, NextResponse } from "next/server";
import {
  PaymentSettingsController,
  assertNoRestrictedGateway,
  resolvePaymentCaller,
  resolveTenantIdentity,
} from "@/lib/payment-settings-controller";
import { isAdminExecutive, isFinanceRole } from "@/lib/permissions";
import {
  getTenantPaymentSettings,
  getModulePaymentSetting,
  upsertPaymentSetting,
  ModuleType,
} from "@/lib/payment-receipt-service";

export const dynamic = "force-dynamic";

function extractRequestedTenantId(req: NextRequest, body?: any): string | null {
  const { searchParams } = new URL(req.url);
  return (
    body?.tenant_id ||
    body?.tenantId ||
    body?.schoolId ||
    searchParams.get("tenant_id") ||
    searchParams.get("tenantId") ||
    searchParams.get("schoolId") ||
    req.headers.get("x-tenant-id") ||
    req.headers.get("tenant-id") ||
    req.headers.get("x-school-id") ||
    null
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawTenantId = extractRequestedTenantId(req);

    // Check caller if authenticated to enforce cross-tenant isolation for admin fields
    let caller: Awaited<ReturnType<typeof resolvePaymentCaller>> | null = null;
    try {
      caller = await resolvePaymentCaller(req);
    } catch {}

    const effectiveLookupTenant =
      rawTenantId || caller?.schoolId || "default";

    const tenantIdentity = await resolveTenantIdentity(effectiveLookupTenant);

    // Enforce multi-tenant RLS guard: If an authenticated standard user belongs to another tenant,
    // they cannot inspect another tenant's admin configuration or bank setup when querying as admin.
    let canViewAdminMetadata = false;
    if (caller) {
      if (caller.isSuperAdmin) {
        canViewAdminMetadata = true;
      } else if (
        caller.schoolId &&
        caller.schoolId === tenantIdentity.schoolId &&
        (isAdminExecutive(caller.role, caller.staffRole) ||
          isFinanceRole(caller.role, caller.staffRole))
      ) {
        canViewAdminMetadata = true;
      } else if (
        caller.schoolId &&
        rawTenantId &&
        caller.schoolId !== tenantIdentity.schoolId &&
        caller.schoolId !== rawTenantId
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Forbidden: Cross-tenant isolation violation. You cannot access another institution's payment configuration.",
          },
          { status: 403 }
        );
      }
    }

    const moduleType = searchParams.get("moduleType") as ModuleType | null;
    const classId = searchParams.get("classId");
    const term = searchParams.get("term");

    const [tenantSettings, moduleSettings] = await Promise.all([
      PaymentSettingsController.getTenantSettings(tenantIdentity.tenantId, {
        includeAdminMetadata: canViewAdminMetadata,
      }),
      moduleType
        ? getModulePaymentSetting(tenantIdentity.tenantId, moduleType, classId, term)
        : getTenantPaymentSettings(tenantIdentity.tenantId),
    ]);

    return NextResponse.json({
      success: true,
      tenant_id: tenantSettings.tenant_id,
      settings: tenantSettings,
      module_settings: Array.isArray(moduleSettings) ? moduleSettings : undefined,
      setting: !Array.isArray(moduleSettings) ? moduleSettings : undefined,
    });
  } catch (error: any) {
    console.error("[TENANT_PAYMENT_SETTINGS_GET_ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch tenant payment settings",
      },
      { status: 500 }
    );
  }
}

async function handleSaveTenantSettings(req: NextRequest) {
  try {
    const body = await req.json();
    assertNoRestrictedGateway(body);

    const caller = await resolvePaymentCaller(req);
    const requestedTenant = extractRequestedTenantId(req, body) || caller.schoolId;

    if (!requestedTenant) {
      return NextResponse.json(
        { success: false, error: "tenant_id is required" },
        { status: 400 }
      );
    }

    const tenantIdentity = await resolveTenantIdentity(requestedTenant);

    // RBAC Check: Only SUPER_ADMIN, TENANT_ADMIN (Executive Admin), or FINANCE_OFFICER (Bursar)
    const isAuthorizedRole =
      caller.isSuperAdmin ||
      isAdminExecutive(caller.role, caller.staffRole) ||
      isFinanceRole(caller.role, caller.staffRole);

    if (!isAuthorizedRole) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Forbidden: Only Tenant Administrators or Finance Officers can configure institutional payment settings.",
        },
        { status: 403 }
      );
    }

    // Multi-Tenant Isolation Guard: Tenant Admin / Finance Officer can ONLY update their own tenant
    if (
      !caller.isSuperAdmin &&
      caller.schoolId &&
      caller.schoolId !== tenantIdentity.schoolId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Forbidden: Multi-tenant isolation guard prevented modifying another institution's payment configuration.",
        },
        { status: 403 }
      );
    }

    // If updating a specific fee module setting alongside or individually
    let updatedModuleSetting = null;
    if (body.moduleType) {
      updatedModuleSetting = await upsertPaymentSetting({
        tenantId: tenantIdentity.tenantId,
        schoolId: tenantIdentity.schoolId,
        moduleType: body.moduleType as ModuleType,
        isEnabled: Boolean(body.isEnabled),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        title: body.title || String(body.moduleType).replace(/_/g, " "),
        amount: Number(body.amount) || 0,
        currency: body.currency || "NGN",
        customWriteup: body.customWriteup || null,
        accountName: body.accountName || null,
        accountNumber: body.accountNumber || null,
        bankName: body.bankName || null,
        classId: body.classId || null,
        term: body.term || null,
        session: body.session || null,
        updatedBy: caller.email || caller.userId,
      });
    }

    // Update Tenant-wide payment settings (bank_accounts, manual_transfer_instructions, gateways, vault ref)
    const hasTenantArchitectureFields =
      body.is_manual_transfer_enabled !== undefined ||
      body.manual_transfer_instructions !== undefined ||
      body.bank_accounts !== undefined ||
      body.supported_online_gateways !== undefined ||
      body.gateway_credentials !== undefined ||
      body.gateway_credentials_vault_ref !== undefined ||
      body.auto_expire_unverified_hours !== undefined;

    let updatedTenantSettings = null;
    if (hasTenantArchitectureFields || !body.moduleType) {
      updatedTenantSettings = await PaymentSettingsController.updateTenantSettings(
        tenantIdentity.tenantId,
        {
          is_manual_transfer_enabled: body.is_manual_transfer_enabled,
          manual_transfer_instructions: body.manual_transfer_instructions,
          bank_accounts: body.bank_accounts,
          supported_online_gateways: body.supported_online_gateways,
          gateway_credentials: body.gateway_credentials,
          gateway_credentials_vault_ref: body.gateway_credentials_vault_ref,
          auto_expire_unverified_hours: body.auto_expire_unverified_hours,
        },
        caller.userId,
        caller.ip
      );
    } else {
      updatedTenantSettings = await PaymentSettingsController.getTenantSettings(
        tenantIdentity.tenantId,
        { includeAdminMetadata: true }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tenant payment configuration updated successfully.",
      settings: updatedTenantSettings,
      module_setting: updatedModuleSetting,
    });
  } catch (error: any) {
    console.error("[TENANT_PAYMENT_SETTINGS_PUT_ERROR]:", error);
    const msg = error?.message || "Failed to update tenant payment settings";
    const status = msg.includes("Unauthorized")
      ? 401
      : msg.includes("Forbidden") || msg.includes("GOVERNANCE_RESTRICTION")
      ? 403
      : msg.includes("SECURITY_POLICY_VIOLATION") ||
        msg.includes("Unsupported") ||
        msg.includes("Bad Request")
      ? 400
      : 500;

    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

export async function PUT(req: NextRequest) {
  return handleSaveTenantSettings(req);
}

export async function POST(req: NextRequest) {
  return handleSaveTenantSettings(req);
}

