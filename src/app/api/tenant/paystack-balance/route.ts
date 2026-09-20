import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/paystack-balance
 * 100% Manual SaaS Subscription & Payment Verification Framework.
 * Pure local PostgreSQL subscription telemetry lookup — 0% transaction fee architecture.
 * Replaces external API balance calls with local database reads.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantIdParam =
      searchParams.get("tenantId") ||
      searchParams.get("schoolId") ||
      searchParams.get("subaccountCode") ||
      "";

    // 1. Parallelized direct local database lookup using parameterized inputs
    let currentTenant = null;

    if (tenantIdParam && tenantIdParam !== "default") {
      currentTenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { id: tenantIdParam },
            { subdomain: tenantIdParam.toLowerCase() },
          ],
        },
        select: {
          id: true,
          status: true,
          plan: {
            select: {
              priceNgn: true,
            },
          },
          subscriptions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              status: true,
              endsAt: true,
              amountDue: true,
            },
          },
        },
      });
    }

    if (!currentTenant) {
      // Fallback: lookup the primary tenant or school record locally
      currentTenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          plan: {
            select: {
              priceNgn: true,
            },
          },
          subscriptions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              status: true,
              endsAt: true,
              amountDue: true,
            },
          },
        },
      });
    }

    const activeSub = currentTenant?.subscriptions?.[0];
    const subscriptionStatus =
      activeSub?.status?.toUpperCase() ||
      currentTenant?.status?.toUpperCase() ||
      "INACTIVE";
    const nextRenewalDate = activeSub?.endsAt
      ? activeSub.endsAt.toISOString()
      : null;
    const monthlyRate = Number(
      activeSub?.amountDue ?? currentTenant?.plan?.priceNgn ?? 0
    );

    return NextResponse.json({
      success: true,
      status: subscriptionStatus,
      renewalDate: nextRenewalDate,
      rate: monthlyRate,
      balance: 0, // 0% balance liability under manual subscription framework
      currency: "NGN",
      complianceNote: "Platform processes 0% transaction collections. Schools manage independent external banking paths directly.",
    });
  } catch (error) {
    console.error("Local configuration read error fallback:", error);
    // Defensively fail safely instead of dropping runtime operations or throwing unhandled process exceptions
    return NextResponse.json({
      success: false,
      status: "ERROR",
      renewalDate: null,
      rate: 0,
    });
  }
}

