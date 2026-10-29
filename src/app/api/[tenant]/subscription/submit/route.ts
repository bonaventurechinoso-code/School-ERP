import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage, validateMagicBytes } from "@/lib/storage";
import crypto from "crypto";

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

    let reference = "";
    let amount = 0;
    let bankName = "";
    let payerName = "";
    let receiptUrl: string | null = null;
    let receiptData: string | null = null;
    let receiptMimeType: string | null = null;
    let receiptSize: number | null = null;
    let receiptPublicId: string | null = null;
    let receiptChecksum: string | null = null;
    let notes: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await (req as NextRequest).formData();
      reference = String(formData.get("reference") || formData.get("nipSessionId") || "").trim();
      amount = Number(formData.get("amount"));
      bankName = String(formData.get("bankName") || formData.get("senderBank") || "").trim();
      payerName = String(formData.get("payerName") || formData.get("accountName") || "").trim();
      notes = String(formData.get("note") || formData.get("notes") || "").trim() || null;

      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "File exceeds 5MB size limit." }, { status: 400 });
        }
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        if (!validateMagicBytes(buffer, file.type)) {
          return NextResponse.json({ error: "Invalid receipt file contents." }, { status: 400 });
        }

        const cleanFileName = `proof_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.${file.name.split(".").pop() || "jpg"}`;
        const uploadResult = await getStorage().upload(buffer, cleanFileName, file.type);
        receiptUrl = uploadResult.url;
        receiptData = uploadResult.data || null;
        receiptMimeType = uploadResult.mimeType;
        receiptSize = uploadResult.size;
        receiptPublicId = uploadResult.publicId || null;
        receiptChecksum = uploadResult.checksum;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      reference = String(body.reference || body.nipSessionId || "").trim();
      amount = Number(body.amount);
      bankName = String(body.bankName || body.senderBank || "").trim();
      payerName = String(body.payerName || body.accountName || "").trim();
      receiptUrl = String(body.fileUrl || body.receiptUrl || "").trim() || null;
      receiptData = String(body.receiptData || "").trim() || null;
      receiptMimeType = String(body.receiptMimeType || body.mimeType || "").trim() || null;
      receiptSize = body.receiptSize ? Number(body.receiptSize) : null;
      receiptPublicId = String(body.receiptPublicId || body.publicId || "").trim() || null;
      receiptChecksum = String(body.receiptChecksum || body.checksum || "").trim() || null;
      notes = String(body.note || body.notes || "").trim() || null;
    }

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

    // Rate Limit: Max 3 uploads per schoolSlug per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSubmissions = await prisma.tenantSubscriptionPayment.count({
      where: {
        schoolSlug,
        submittedAt: { gte: oneHourAgo },
      },
    });

    if (recentSubmissions >= 3) {
      return NextResponse.json(
        {
          error: "Too many upload attempts. You may submit at most 3 payment proofs per hour.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

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

    // Create TenantSubscriptionPayment with permanent enterprise fields
    const payment = await prisma.tenantSubscriptionPayment.create({
      data: {
        tenantId,
        schoolSlug,
        schoolName,
        amount,
        nipSessionId: reference,
        senderBank: bankName || "Bank Transfer",
        receiptUrl,
        receiptData,
        receiptMimeType,
        receiptSize,
        receiptPublicId,
        receiptChecksum,
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
      receiptUrl,
    });
  } catch (error: any) {
    console.error("[Subscription Submit Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit subscription payment proof." },
      { status: 500 }
    );
  }
}
