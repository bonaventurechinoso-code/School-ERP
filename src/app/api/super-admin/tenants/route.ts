import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status !== "ALL") {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { schoolName: { contains: search, mode: "insensitive" } },
        { subdomain: { contains: search, mode: "insensitive" } },
        { adminEmail: { contains: search, mode: "insensitive" } },
        { contactPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [tenants, totalCount] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          plan: true,
          wallets: {
            take: 1,
            select: {
              id: true,
              balance: true,
              currency: true,
            },
          },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    const formattedTenants = tenants.map((tenant) => {
      const primaryWallet = tenant.wallets[0];
      return {
        id: tenant.id,
        schoolName: tenant.schoolName,
        subdomain: tenant.subdomain,
        customDomain: tenant.customDomain,
        adminEmail: tenant.adminEmail,
        contactPhone: tenant.contactPhone,
        institutionTypes: tenant.institutionTypes,
        status: tenant.status,
        kycStatus: tenant.kycStatus,
        kycDocs: tenant.kycDocs,
        settlementBankName: tenant.settlementBankName,
        settlementAccountNumber: tenant.settlementAccountNumber,
        isImpersonationAllowed: tenant.isImpersonationAllowed,
        suspendedReason: tenant.suspendedReason,
        suspendedAt: tenant.suspendedAt,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        plan: tenant.plan
          ? {
              id: tenant.plan.id,
              name: tenant.plan.name,
              priceNgn: tenant.plan.priceNgn,
              billingCycle: tenant.plan.billingCycle,
              commissionPercent: tenant.plan.commissionPercent,
            }
          : null,
        wallet: primaryWallet
          ? {
              id: primaryWallet.id,
              balance: Number(primaryWallet.balance),
              currency: primaryWallet.currency,
            }
          : { balance: 0, currency: "NGN" },
        subscription: activeSub
          ? {
              id: activeSub.id,
              status: activeSub.status,
              startsAt: activeSub.startsAt,
              endsAt: activeSub.endsAt,
              trialEndsAt: activeSub.trialEndsAt,
              amountDue: Number(activeSub.amountDue),
              amountPaid: Number(activeSub.amountPaid),
              planName: activeSub.plan.name,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tenants: formattedTenants,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("[SuperAdmin:Tenants GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve tenants list" },
      { status: 500 }
    );
  }
}
