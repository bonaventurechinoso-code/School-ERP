import { NextRequest, NextResponse } from "next/server";
import {
  PaymentSettingsController,
  assertNoRestrictedGateway,
  resolvePaymentCaller,
  ALLOWED_PAYMENT_METHODS,
  ALLOWED_DECENTRALIZED_GATEWAYS,
} from "@/lib/payment-settings-controller";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const governance = await PaymentSettingsController.getPlatformGovernance();

    return NextResponse.json({
      success: true,
      governance,
      supported_models: ALLOWED_PAYMENT_METHODS,
      supported_decentralized_gateways: ALLOWED_DECENTRALIZED_GATEWAYS,
    });
  } catch (error: any) {
    console.error("[PLATFORM_PAYMENT_GOVERNANCE_GET_ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch platform payment governance",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await resolvePaymentCaller(req);
    if (!caller.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Forbidden: Only Super Administrators can modify platform-wide payment governance.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    assertNoRestrictedGateway(body);

    const updated = await PaymentSettingsController.updatePlatformGovernance(
      {
        allowed_payment_methods: body.allowed_payment_methods,
        allow_manual_verification_override: body.allow_manual_verification_override,
        allowed_online_gateways: body.allowed_online_gateways,
        audit_metadata: body.audit_metadata,
      },
      caller.userId,
      caller.ip
    );

    return NextResponse.json({
      success: true,
      message: "Platform payment governance updated successfully.",
      governance: updated,
    });
  } catch (error: any) {
    console.error("[PLATFORM_PAYMENT_GOVERNANCE_PATCH_ERROR]:", error);
    const msg = error?.message || "Failed to update platform payment governance";
    const status = msg.includes("Unauthorized")
      ? 401
      : msg.includes("Forbidden")
      ? 403
      : msg.includes("SECURITY_POLICY_VIOLATION") || msg.includes("Invalid") || msg.includes("Unsupported")
      ? 400
      : 500;

    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

