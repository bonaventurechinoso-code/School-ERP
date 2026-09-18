import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PLATFORM_SUBACCOUNT = process.env.PLATFORM_SUBACCOUNT_CODE;

export async function POST(req: NextRequest) {
  try {
    if (!PAYSTACK_SECRET || !PLATFORM_SUBACCOUNT) {
      return NextResponse.json({ error: "Server infrastructure environment configuration missing" }, { status: 500 });
    }

    const body = await req.json();
    const { 
      schoolName, 
      subdomain, 
      adminEmail, 
      contactPhone, 
      institutionTypes, 
      planId,
      settlementBank,  // Dynamic input from client
      accountNumber   // Dynamic input from client
    } = body;

    // 1. Uniqueness Guard Check
    const exists = await prisma.tenant.findUnique({ where: { subdomain: subdomain.toLowerCase() } });
    if (exists) return NextResponse.json({ error: "Subdomain already assigned" }, { status: 400 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "Requested subscription plan invalid" }, { status: 400 });

    // 2. Generate Tenant Paystack Subaccount
    const platformShare = plan.commissionPercent;
    const tenantShare = 100 - platformShare;

    const subaccountRes = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        business_name: schoolName,
        settlement_bank: settlementBank || "wema-bank",
        account_number: accountNumber || "0000000000",
        percentage_charge: platformShare,
      }),
    });
    const subaccountData = await subaccountRes.json();
    if (!subaccountData.status) throw new Error(`Paystack Subaccount Error: ${subaccountData.message}`);
    const subaccountCode = subaccountData.data.subaccount_code;

    // 3. Create Automated Transaction Split Code
    const splitRes = await fetch("https://api.paystack.co/split", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${schoolName} Ledger Split`,
        type: "percentage",
        currency: "NGN",
        subaccounts: [
          { subaccount: subaccountCode, share: tenantShare },
          { subaccount: PLATFORM_SUBACCOUNT, share: platformShare }
        ],
        bearer_type: "all",
      }),
    });
    const splitData = await splitRes.json();
    const splitCode = splitData.status ? splitData.data.split_code : null;

    // 4. Atomic PostgreSQL Transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          schoolName,
          subdomain: subdomain.toLowerCase(),
          adminEmail,
          contactPhone,
          institutionTypes,
          planId,
          status: "ACTIVE",
          paystackSubaccountCode: subaccountCode,
          paystackSplitCode: splitCode,
        },
      });

      await tx.wallet.create({
        data: { tenantId: tenant.id, balance: 0.00 },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId,
          status: "trialing",
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-Day Baseline Trial Window
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          amountDue: plan.priceNgn,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: "super_admin",
          action: "create_tenant",
          tenantId: tenant.id,
          metadata: { schoolName, subdomain: subdomain.toLowerCase(), planName: plan.name },
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
        },
      });

      return { tenant };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    console.error("SaaS Layer Provisioning Failure:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
