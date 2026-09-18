import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Paystack signature" }, { status: 401 });
    }

    const rawBody = await req.text();
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error("[PaystackSaaSWebhook] Server PAYSTACK_SECRET_KEY is missing");
      return NextResponse.json({ error: "Server infrastructure unconfigured" }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    const isMatch =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    // 1. CHARGE SUCCESS (Tuition Split Settlement or Direct SaaS Subscription Fee)
    if (event === "charge.success") {
      const { reference, amount, metadata, subaccount, split } = data;
      const totalAmountNgn = Number(amount) / 100; // Paystack sends amounts in kobo

      // Check if this charge was a SaaS Plan subscription payment
      if (metadata?.type === "saas_subscription" || metadata?.planId) {
        const tenantId = metadata?.tenantId;
        const tenant = tenantId
          ? await prisma.tenant.findUnique({
              where: { id: tenantId },
              include: { plan: true },
            })
          : null;

        if (tenant && tenant.plan) {
          const billingCycle = (tenant.plan.billingCycle || "termly").toLowerCase();
          const durationDays =
            billingCycle === "yearly" ? 365 : billingCycle === "monthly" ? 30 : 105;

          const now = new Date();
          const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

          await prisma.$transaction(async (tx) => {
            // Find or update subscription
            const activeSub = await tx.subscription.findFirst({
              where: { tenantId: tenant.id },
              orderBy: { createdAt: "desc" },
            });

            if (activeSub) {
              await tx.subscription.update({
                where: { id: activeSub.id },
                data: {
                  status: "active",
                  amountPaid: totalAmountNgn,
                  startsAt: now,
                  endsAt,
                  paystackSubscriptionCode: data.id ? String(data.id) : activeSub.paystackSubscriptionCode,
                },
              });
            } else {
              await tx.subscription.create({
                data: {
                  tenantId: tenant.id,
                  planId: tenant.plan!.id,
                  status: "active",
                  startsAt: now,
                  endsAt,
                  amountDue: tenant.plan!.priceNgn,
                  amountPaid: totalAmountNgn,
                },
              });
            }

            // Platform Revenue Update
            const pWallet = await tx.platformWallet.findFirst();
            if (pWallet) {
              await tx.platformWallet.update({
                where: { id: pWallet.id },
                data: {
                  balance: { increment: totalAmountNgn },
                  totalRevenue: { increment: totalAmountNgn },
                },
              });
            } else {
              await tx.platformWallet.create({
                data: { balance: totalAmountNgn, totalRevenue: totalAmountNgn },
              });
            }

            await tx.platformTransaction.create({
              data: {
                tenantId: tenant.id,
                type: "subscription",
                amount: totalAmountNgn,
                reference: `${reference}_sub`,
              },
            });

            await tx.auditLog.create({
              data: {
                actorId: "paystack_webhook",
                action: "subscription_renewed",
                tenantId: tenant.id,
                metadata: { reference, amountNgn: totalAmountNgn, endsAt },
              },
            });
          });

          return NextResponse.json({ success: true, message: "Subscription processed" }, { status: 200 });
        }
      }

      // Otherwise, process as a School Tuition Fee with Paystack Split Ledger
      const subaccountCode = subaccount?.subaccount_code || metadata?.subaccountCode;
      const splitCode = split?.split_code || metadata?.splitCode;
      const tenantId = metadata?.tenantId;

      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            ...(tenantId ? [{ id: tenantId }] : []),
            ...(subaccountCode ? [{ paystackSubaccountCode: subaccountCode }] : []),
            ...(splitCode ? [{ paystackSplitCode: splitCode }] : []),
          ],
        },
        include: { plan: true },
      });

      if (tenant) {
        const commissionPercent = tenant.plan?.commissionPercent || 2.0;
        const platformCut = Math.round((totalAmountNgn * commissionPercent) / 100 * 100) / 100;
        const tenantNet = totalAmountNgn - platformCut;

        await prisma.$transaction(async (tx) => {
          let wallet = await tx.wallet.findUnique({ where: { tenantId: tenant.id } });
          if (!wallet) {
            wallet = await tx.wallet.create({
              data: { tenantId: tenant.id, balance: 0.0, currency: "NGN" },
            });
          }

          const currentBalance = Number(wallet.balance);
          const newBalance = currentBalance + tenantNet;

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              tenantId: tenant.id,
              type: "CREDIT",
              category: "tuition",
              amount: tenantNet,
              balanceBefore: currentBalance,
              balanceAfter: newBalance,
              reference: `${reference}_tuition`,
              description: `Tuition split settlement: Net credit after ${commissionPercent}% fee`,
            },
          });

          // Platform Commission
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

          await tx.platformTransaction.create({
            data: {
              tenantId: tenant.id,
              type: "commission",
              amount: platformCut,
              reference: `${reference}_comm`,
            },
          });
        });

        return NextResponse.json({ success: true, message: "Tuition split settlement recorded" }, { status: 200 });
      }
    }

    // 2. SUBSCRIPTION RENEWAL OR CREATION
    if (event === "subscription.create" || event === "subscription.renew") {
      const { subscription_code, customer, next_payment_date } = data;
      const email = customer?.email;

      if (email) {
        const tenant = await prisma.tenant.findFirst({
          where: { adminEmail: email },
        });

        if (tenant) {
          await prisma.subscription.updateMany({
            where: { tenantId: tenant.id },
            data: {
              status: "active",
              paystackSubscriptionCode: subscription_code,
              endsAt: next_payment_date ? new Date(next_payment_date) : undefined,
            },
          });
          return NextResponse.json({ success: true, message: "Subscription status updated" }, { status: 200 });
        }
      }
    }

    // 3. INVOICE PAYMENT FAILED / SUBSCRIPTION DISABLED
    if (event === "invoice.payment_failed" || event === "subscription.disable") {
      const { customer, subscription_code } = data;
      const email = customer?.email;

      if (email) {
        const tenant = await prisma.tenant.findFirst({
          where: { adminEmail: email },
        });

        if (tenant) {
          await prisma.subscription.updateMany({
            where: { tenantId: tenant.id },
            data: { status: "past_due" },
          });

          await prisma.auditLog.create({
            data: {
              actorId: "paystack_webhook",
              action: "subscription_payment_failed",
              tenantId: tenant.id,
              metadata: { event, subscription_code },
            },
          });

          return NextResponse.json({ success: true, message: "Past due status logged" }, { status: 200 });
        }
      }
    }

    return NextResponse.json({ received: true, event }, { status: 200 });
  } catch (error: any) {
    console.error("[PaystackSaaSWebhook] Execution Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
