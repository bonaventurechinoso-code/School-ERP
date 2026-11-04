import { NextRequest, NextResponse } from "next/server";
import { deduplicatePaymentReceipts } from "@/lib/payment-receipt-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { masterReceiptId, duplicateReceiptIds, reconciliationNotes, verifiedBy } = body;

    if (!masterReceiptId) {
      return NextResponse.json(
        { success: false, error: "masterReceiptId is required for deduplication" },
        { status: 400 }
      );
    }

    if (!Array.isArray(duplicateReceiptIds) || duplicateReceiptIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one duplicateReceiptId must be provided to merge" },
        { status: 400 }
      );
    }

    const agentName =
      verifiedBy ||
      req.headers.get("x-user-name") ||
      req.headers.get("x-user-role") ||
      "Bursar Desk";

    const verifiedByUserId =
      body.verifiedByUserId ||
      req.headers.get("x-user-id") ||
      agentName;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "bursar-desk";

    const result = await deduplicatePaymentReceipts({
      masterReceiptId,
      duplicateReceiptIds,
      verifiedBy: agentName,
      verifiedByUserId,
      reconciliationNotes,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      masterReceipt: result.masterReceipt,
      mergedCount: result.mergedCount,
    });
  } catch (error: any) {
    console.error("[PAYMENT_RECEIPT_DEDUPLICATE_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process receipt deduplication" },
      { status: 500 }
    );
  }
}

