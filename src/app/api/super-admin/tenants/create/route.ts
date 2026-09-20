import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {

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

    // 2. Generate local internal identifiers (100% Local PostgreSQL Provisioning)
    const subaccountCode = `ACCT_${subdomain.toUpperCase()}_MANUAL`;
    const splitCode = `SPLIT_${subdomain.toUpperCase()}_MANUAL`;


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
