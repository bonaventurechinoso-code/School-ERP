import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant/submit-subscription-proof
 * 100% Manual SaaS Subscription Framework.
 * Tenant submits offline bank transfer proof to trigger Super Admin review.
 *
 * Payload:
 * {
 *   schoolDomain: string,
 *   reference: string,       // NIP session ID or deposit reference
 *   amount: number,          // Amount transferred in NGN
 *   bankName: string,        // Sending bank name
 *   payerName?: string,      // Name on the originating account
 *   note?: string,           // Optional narration / note
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { schoolDomain, reference, amount, bankName, payerName, note } = body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!schoolDomain || typeof schoolDomain !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing required field: schoolDomain" },
        { status: 400 }
      );
    }

    if (!reference || typeof reference !== "string" || reference.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid NIP session ID or deposit reference." },
        { status: 400 }
      );
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid transfer amount." },
        { status: 400 }
      );
    }

    if (!bankName || typeof bankName !== "string" || bankName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Please specify your sending bank name." },
        { status: 400 }
      );
    }

    const cleanDomain = schoolDomain.trim().toLowerCase();

    // ── Resolve school & tenant in the SaaS layer ───────────────────────
    const school = await basePrisma.school.findFirst({
      where: { subdomain: cleanDomain },
      include: {
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School record not found for this domain." },
        { status: 404 }
      );
    }

    const tenant = await basePrisma.tenant.findFirst({
      where: { subdomain: cleanDomain },
    });

    // ── Mark tenant as PENDING_VERIFICATION if exists ─────────────────────
    if (tenant) {
      await basePrisma.tenant.update({
        where: { id: tenant.id },
        data: {
          status: "PENDING_VERIFICATION",
        },
      });
    }

    // ── Mark active subscription as PENDING or create one ─────────────────
    const activeSub = school.subscriptions[0];
    if (activeSub) {
      await basePrisma.subscription.update({
        where: { id: activeSub.id },
        data: {
          status: "PENDING",
          amount: Number(amount),
          paymentMethod: "MANUAL",
          verifiedByAdmin: false,
        },
      });
    } else {
      await basePrisma.subscription.create({
        data: {
          schoolId: school.id,
          status: "PENDING",
          amount: Number(amount),
          paymentMethod: "MANUAL",
          plan: school.subscriptionPlan || "BASIC",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          verifiedByAdmin: false,
        },
      });
    }

    // ── Record SchoolPayment manual proof entry ───────────────────────────
    await basePrisma.schoolPayment.create({
      data: {
        schoolId: school.id,
        amount: Number(amount),
        type: "SUBSCRIPTION",
        status: "PENDING_VERIFICATION",
      },
    });

    // ── Record PaymentReceipt for Super-Admin clearance ────────────────────
    await basePrisma.paymentReceipt.create({
      data: {
        tenantId: cleanDomain,
        schoolId: school.id,
        moduleType: "PLATFORM_SUBSCRIPTION",
        payerType: "SCHOOL",
        payerName: payerName?.trim() || school.name,
        referenceNo: reference.trim(),
        amount: Number(amount),
        bankName: bankName.trim(),
        fileUrl: body.fileUrl || "",
        status: "PENDING",
      },
    });

    // ── Sync School record — keep portal live during review ───────────────
    await basePrisma.school.update({
      where: { id: school.id },
      data: { subscriptionStatus: "ACTIVE" },
    });

    // ── Log an Audit Trail entry for the proof submission ─────────────────
    const actorId = tenant?.id || school.id;
    await basePrisma.auditLog
      .create({
        data: {
          actorId,
          action: "submit_subscription_proof",
          tenantId: actorId,
          metadata: {
            schoolDomain: cleanDomain,
            reference: reference.trim(),
            amount: Number(amount),
            bankName: bankName.trim(),
            payerName: payerName?.trim() || null,
            note: note?.trim() || null,
            submittedAt: new Date().toISOString(),
          },
        },
      })
      .catch((auditErr) => {
        console.warn("[SUBMIT_PROOF] Audit log non-fatal error:", auditErr);
      });

    return NextResponse.json({
      success: true,
      message:
        "Transfer proof submitted successfully. Our team will verify your payment within 24 hours and activate your subscription.",
      status: "PENDING_VERIFICATION",
    });
  } catch (error: any) {
    console.error("[POST /api/tenant/submit-subscription-proof Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit proof. Please try again." },
      { status: 500 }
    );
  }
}
