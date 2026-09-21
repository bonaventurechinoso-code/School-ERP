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

    // ── Resolve tenant in the SaaS layer ─────────────────────────────────
    const tenant = await basePrisma.tenant.findFirst({
      where: { subdomain: cleanDomain },
      include: {
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant record not found for this school domain." },
        { status: 404 }
      );
    }

    // ── Mark tenant as PENDING_VERIFICATION ───────────────────────────────
    await basePrisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: "PENDING_VERIFICATION",
      },
    });

    // ── Mark active subscription as pending ───────────────────────────────
    const activeSub = tenant.subscriptions[0];
    if (activeSub) {
      await basePrisma.subscription.update({
        where: { id: activeSub.id },
        data: { status: "pending_verification" },
      });
    }

    // ── Sync School record — keep portal live during review ───────────────
    await basePrisma.school.updateMany({
      where: { subdomain: cleanDomain },
      data: { subscriptionStatus: "ACTIVE" },
    });

    // ── Log an Audit Trail entry for the proof submission ─────────────────
    await basePrisma.auditLog
      .create({
        data: {
          actorId: tenant.id,
          action: "submit_subscription_proof",
          tenantId: tenant.id,
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
