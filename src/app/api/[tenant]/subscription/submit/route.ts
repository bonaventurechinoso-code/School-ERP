import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest | Request,
  { params }: { params: Promise<{ tenant: string }> | { tenant: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const rawDomain = (resolvedParams.tenant || "").trim().toLowerCase();

    if (!rawDomain) {
      return NextResponse.json({ error: "Tenant domain parameter is required." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reference = String(body.reference || body.nipSessionId || "").trim();
    const amount = Number(body.amount);
    const bankName = String(body.bankName || body.senderBank || "").trim();
    const payerName = String(body.payerName || body.accountName || "").trim();
    const receiptUrl = String(body.fileUrl || body.receiptUrl || "").trim() || null;
    const notes = String(body.note || body.notes || "").trim() || null;

    if (!reference) {
      return NextResponse.json({ error: "Payment Reference / NIP Session ID is required." }, { status: 400 });
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "A valid positive payment amount is required." }, { status: 400 });
    }

    // Resolve Tenant and School
    let tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: { equals: rawDomain, mode: "insensitive" } },
          { slug: { equals: rawDomain, mode: "insensitive" } },
          { id: rawDomain },
        ],
      },
    });

    let school = await prisma.school.findFirst({
      where: {
        OR: [
          { subdomain: { equals: rawDomain, mode: "insensitive" } },
          { slug: { equals: rawDomain, mode: "insensitive" } },
          { id: rawDomain },
        ],
      },
    });

    if (!tenant && !school) {
      return NextResponse.json({ error: "Institution tenant not found." }, { status: 404 });
    }

    // Ensure we have a tenant ID (fallback to school ID or create matching tenant if missing)
    let tenantId = tenant?.id;
    if (!tenantId && school) {
      tenant = await prisma.tenant.findUnique({ where: { subdomain: school.subdomain } });
      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: {
            id: school.id,
            schoolName: school.name,
            subdomain: school.subdomain,
            slug: school.slug || school.subdomain,
            adminEmail: `admin@${school.subdomain}.edu.ng`,
            contactPhone: school.contactPhone || "08000000000",
            institutionTypes: ["PRIMARY", "SECONDARY"],
            status: "ACTIVE",
            subscriptionStatus: "ACTIVE",
          },
        });
      }
      tenantId = tenant.id;
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Unable to resolve tenant ID." }, { status: 404 });
    }

    const schoolSlug = tenant?.slug || school?.slug || school?.subdomain || rawDomain;
    const schoolName = tenant?.schoolName || school?.name || rawDomain;

    // Check duplicate NIP Session ID / Reference
    const existingPayment = await prisma.tenantSubscriptionPayment.findFirst({
      where: { nipSessionId: reference },
    });

    if (existingPayment) {
      return NextResponse.json(
        {
          error: "A payment proof with this NIP Session ID or reference has already been submitted.",
          code: "DUPLICATE_SESSION_ID",
        },
        { status: 409 }
      );
    }

    // Create TenantSubscriptionPayment
    const payment = await prisma.tenantSubscriptionPayment.create({
      data: {
        tenantId,
        schoolSlug,
        schoolName,
        amount,
        nipSessionId: reference,
        senderBank: bankName || "Bank Transfer",
        receiptUrl,
        accountName: payerName || null,
        status: "PENDING",
        notes,
      },
    });

    // Also mirror to legacy subscriptionPayment table for backwards compatibility
    try {
      await prisma.subscriptionPayment.create({
        data: {
          id: payment.id,
          tenantId,
          amount,
          receiptUrl: receiptUrl || "",
          status: "PENDING_VERIFICATION",
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Subscription payment proof submitted successfully. Pending Super Admin verification.",
      paymentId: payment.id,
    });
  } catch (error: any) {
    console.error("[Subscription Submit Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit subscription payment proof." },
      { status: 500 }
    );
  }
}

