import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentReceipt } from "@/lib/payment-receipt-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { receiptId, action, rejectionReason, verifiedBy } = body;

    if (!receiptId) {
      return NextResponse.json(
        { success: false, error: "receiptId is required" },
        { status: 400 }
      );
    }

    if (!["VERIFY", "REJECT", "FLAG"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be VERIFY, REJECT, or FLAG" },
        { status: 400 }
      );
    }

    // Determine verification agent
    const agentName =
      verifiedBy ||
      req.headers.get("x-user-name") ||
      req.headers.get("x-user-role") ||
      "Bursar Desk";
    const verifiedByUserId =
      body.verifiedByUserId ||
      body.verified_by_user_id ||
      req.headers.get("x-user-id") ||
      agentName;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "finance-desk";

    const updated = await verifyPaymentReceipt({
      receiptId,
      action,
      rejectionReason,
      verifiedBy: agentName,
      verifiedByUserId,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: `Receipt successfully marked as ${updated.status}`,
      receipt: updated,
    });
  } catch (error: any) {
    console.error("[PAYMENT_RECEIPT_VERIFY_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process receipt verification" },
      { status: 500 }
    );
  }
}
