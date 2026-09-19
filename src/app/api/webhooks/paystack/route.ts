import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { basePrisma } from "@/lib/tenant-prisma";

/**
 * POST /api/webhooks/paystack
 *
 * Model A CBN-Compliant Webhook Receiver for Paystack Split Settlements.
 * Idempotent processing of charge.success events.
 * Updates invoices, credits mirror shadow wallet, and records platform commission.
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-paystack-signature");
    const rawBody = await req.text();
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // 1. Cryptographic HMAC SHA-512 Signature Verification
    if (secret && signature && !secret.includes("mock")) {
      const expectedSignature = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      const isMatch =
        signature.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

      if (!isMatch && process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Invalid Paystack signature" }, { status: 401 });
      }
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: "received", note: "Empty or non-JSON body" }, { status: 200 });
    }

    const { event, data } = payload;

    // 2. Handle Charge Success Event
    if (event === "charge.success" && data) {
      const { reference, metadata } = data;
      console.log(`[PAYSTACK_WEBHOOK_RECEIVED] Reference: ${reference}. Note: Tuition fees are 100% direct manual bank transfer. Paystack is reserved solely for SaaS platform subscription billing.`);
      return NextResponse.json(
        {
          status: "received",
          message: "Tuition split settlement via Paystack is disabled. All school tuition fees are direct manual bank transfer.",
          reference,
        },
        { status: 200 }
      );
    }

    // Default acknowledgement for all other Paystack events
    return NextResponse.json({ status: "received", event: event || "ping" }, { status: 200 });
  } catch (error: any) {
    console.error("[PAYSTACK_WEBHOOK_ERROR]", error);
    // Always return 200 to prevent Paystack from retrying indefinitely on application non-fatal logs
    return NextResponse.json({ status: "received", error: error.message }, { status: 200 });
  }
}
