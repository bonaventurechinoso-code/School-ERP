import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { PaymentSettingsController } from "@/lib/payment-settings-controller";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: subdomain } = await params;
    const cleanSubdomain = subdomain.trim().toLowerCase();

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ subdomain: cleanSubdomain }, { id: subdomain }, { slug: cleanSubdomain }],
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        settlementBankName: true,
        settlementBankCode: true,
        settlementAccountNumber: true,
        settlementAccountName: true,
        paymentInstruction: true,
        collectionMode: true,
      },
    });

    if (!school) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    const effectiveSettings = await PaymentSettingsController.getTenantSettings(school.id);
    const primaryBank = effectiveSettings.bank_accounts[0] || {
      bank_name: school.settlementBankName || "",
      account_number: school.settlementAccountNumber || "",
      account_name: school.settlementAccountName || "",
      branch_code: school.settlementBankCode || "",
      currency: "NGN",
      swift_bic: "",
    };

    const isManualEnabled = effectiveSettings.effective_is_manual_transfer_enabled;

    return NextResponse.json({
      success: true,
      school: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        bankName: primaryBank.bank_name || school.settlementBankName,
        accountNumber: primaryBank.account_number || school.settlementAccountNumber,
        accountName: primaryBank.account_name || school.settlementAccountName,
        instruction:
          effectiveSettings.manual_transfer_instructions ||
          school.paymentInstruction ||
          "Use Student Admission No as transfer narration",
        isConfigured:
          isManualEnabled &&
          Boolean(
            (primaryBank.account_number && primaryBank.bank_name) ||
              (school.settlementAccountNumber && school.settlementBankName)
          ),
        isManualTransferEnabled: isManualEnabled,
        bankAccounts: effectiveSettings.bank_accounts,
        supportedOnlineGateways: effectiveSettings.effective_supported_online_gateways,
        platformGovernance: effectiveSettings.platform_governance,
      },
    });
  } catch (error: any) {
    console.error("[GET_TENANT_BANK_DETAILS_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to load collection account details", details: error?.message },
      { status: 500 }
    );
  }
}
