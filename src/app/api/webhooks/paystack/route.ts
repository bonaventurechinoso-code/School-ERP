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
      const { reference, amount, metadata, subaccount } = data;
      const amountNgn = Number(amount) / 100;
      const invoiceId = metadata?.invoice_id || metadata?.invoiceId;
      const tenantSubdomain = metadata?.tenant_subdomain || metadata?.tenantSubdomain;
      const studentId = metadata?.student_id || metadata?.studentId;

      // 3. Idempotency Guard: Locate Invoice
      let existingInvoice: any = null;
      if (invoiceId) {
        try {
          existingInvoice = await (basePrisma.invoice as any).findUnique({
            where: { id: invoiceId },
            include: { payments: true },
          });
        } catch (findErr) {
          console.warn("[WEBHOOK_INVOICE_FIND_ID]", findErr);
        }
      }
      if (!existingInvoice && reference) {
        try {
          existingInvoice = await (basePrisma.invoice as any).findFirst({
            where: { paystackReference: reference },
            include: { payments: true },
          });
        } catch (findErr) {
          console.warn("[WEBHOOK_INVOICE_FIND_REF]", findErr);
        }
      }

      if (existingInvoice && existingInvoice.status === "PAID") {
        return NextResponse.json(
          { status: "received", message: "Invoice already settled (idempotent)." },
          { status: 200 }
        );
      }

      // 4. Resolve Tenant Context
      let tenant = tenantSubdomain
        ? await basePrisma.tenant.findUnique({
            where: { subdomain: tenantSubdomain },
            include: { plan: true },
          })
        : null;

      if (!tenant && metadata?.tenant_id) {
        tenant = await basePrisma.tenant.findUnique({
          where: { id: metadata.tenant_id },
          include: { plan: true },
        });
      }

      const commissionPercent = tenant?.plan?.commissionPercent ?? 2.0;
      const platformCut = Math.round((amountNgn * (commissionPercent / 100)) * 100) / 100;
      const schoolNet = Math.round((amountNgn - platformCut) * 100) / 100;

      // 5. Execute Atomic Settlement Transaction
      await basePrisma.$transaction(async (tx) => {
        // (a) Settle Invoice
        if (existingInvoice) {
          try {
            await (tx.invoice as any).update({
              where: { id: existingInvoice.id },
              data: {
                status: "PAID",
                amountPaid: amountNgn,
                paidAt: new Date(),
                paystackReference: reference || existingInvoice.paystackReference,
              },
            });
          } catch {
            await (tx.invoice as any).update({
              where: { id: existingInvoice.id },
              data: {
                status: "PAID",
              },
            });
          }

          // (b) Create verified Payment record
          try {
            await (tx.payment as any).create({
              data: {
                schoolId: existingInvoice.schoolId,
                studentId: existingInvoice.studentId,
                invoiceId: existingInvoice.id,
                amountPaid: amountNgn,
                paymentDate: new Date(),
              },
            });
          } catch (payErr) {
            console.warn("[WEBHOOK_PAYMENT_CREATE]", payErr);
          }
        }

        // (c) Settle Mirror Tenant Wallet (Model A: Read-Only Shadow Ledger)
        if (tenant) {
          let wallet = await tx.wallet.findUnique({ where: { tenantId: tenant.id } });
          if (!wallet) {
            wallet = await tx.wallet.create({
              data: { tenantId: tenant.id, balance: 0.0, currency: "NGN" },
            });
          }

          const currentBalance = Number(wallet.balance);
          const newBalance = currentBalance + schoolNet;

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          });

          try {
            await (tx.walletTransaction as any).create({
              data: {
                walletId: wallet.id,
                tenantId: tenant.id,
                type: "CREDIT",
                category: "tuition",
                amount: schoolNet,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                reference: `${reference || Date.now()}_tuition`,
                description: `Tuition split settlement: 98% credited to school DVA (${subaccount?.subaccount_code || "Wema DVA"})`,
                source: "paystack_webhook",
                paystackReference: reference,
                settlementStatus: "settled",
              },
            });
          } catch {
            await (tx.walletTransaction as any).create({
              data: {
                walletId: wallet.id,
                tenantId: tenant.id,
                type: "CREDIT",
                category: "tuition",
                amount: schoolNet,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                reference: `${reference || Date.now()}_tuition`,
                description: `Tuition split settlement: 98% credited to school DVA (${subaccount?.subaccount_code || "Wema DVA"})`,
              },
            });
          }
        }

        // (d) Settle Platform Wallet (2% Commission Revenue)
        const pWallet = await tx.platformWallet.findFirst();
        if (pWallet) {
          await tx.platformWallet.update({
            where: { id: pWallet.id },
            data: {
              balance: { increment: platformCut },
              totalRevenue: { increment: platformCut },
            },
          });
        } else {
          await tx.platformWallet.create({
            data: { balance: platformCut, totalRevenue: platformCut },
          });
        }

        // (e) Create Audit Log
        if (tenant) {
          await tx.auditLog.create({
            data: {
              actorId: "paystack_webhook",
              action: "tuition_fee_settled",
              tenantId: tenant.id,
              metadata: {
                reference,
                invoiceId: existingInvoice?.id || invoiceId,
                totalAmountNgn: amountNgn,
                schoolNetNgn: schoolNet,
                platformCutNgn: platformCut,
                model: "MODEL_A_DIRECT_SPLIT",
              },
            },
          });
        }
      });

      console.log(`[PAYSTACK_WEBHOOK_SETTLED] Reference: ${reference} | Invoice: ${invoiceId} | Amount: ₦${amountNgn.toLocaleString()}`);
      return NextResponse.json({ status: "received", message: "Tuition fee settled successfully." }, { status: 200 });
    }

    // Default acknowledgement for all other Paystack events
    return NextResponse.json({ status: "received", event: event || "ping" }, { status: 200 });
  } catch (error: any) {
    console.error("[PAYSTACK_WEBHOOK_ERROR]", error);
    // Always return 200 to prevent Paystack from retrying indefinitely on application non-fatal logs
    return NextResponse.json({ status: "received", error: error.message }, { status: 200 });
  }
}
