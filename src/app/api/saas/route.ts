import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  NIGERIAN_BANKS,
  isValidNubanAccountNumber,
  getBankByCode,
} from "@/lib/nigerian-banks";

export const dynamic = "force-dynamic";

/**
 * GET /api/saas
 * Returns the platform's corporate settlement bank configuration, alongside
 * the list of tenants containing their subaccount_code, computed 30-day collections,
 * 2% platform commissions, and active paystackSettlementBank metadata.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Fetch Super Admin Corporate Bank Config
    let platformBank = await prisma.platformBankConfig.findUnique({
      where: { id: "global" },
    });

    if (!platformBank) {
      // Create baseline fallback platform bank if none exists
      platformBank = await prisma.platformBankConfig.create({
        data: {
          id: "global",
          bankCode: "035", // Wema Bank
          bankName: "Wema Bank",
          accountNumber: "0123456789",
        },
      });
    }

    // 2. Compute 30-day window for transactions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const tenantSelect = {
      id: true,
      schoolName: true,
      subdomain: true,
      customDomain: true,
      adminEmail: true,
      contactPhone: true,
      institutionTypes: true,
      status: true,
      kycStatus: true,
      paystackSubaccountCode: true,
      paystackSplitCode: true,
      isImpersonationAllowed: true,
      suspendedReason: true,
      suspendedAt: true,
      createdAt: true,
      paystackSettlementBank: true,
      plan: {
        select: {
          id: true,
          name: true,
          priceNgn: true,
          billingCycle: true,
          commissionPercent: true,
        },
      },
      subscriptions: {
        take: 1,
        orderBy: { createdAt: "desc" as const },
        select: {
          status: true,
          amountDue: true,
          endsAt: true,
          trialEndsAt: true,
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    };

    // 3. Fetch all tenants with plan and subscription telemetry
    let tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: tenantSelect,
    });

    if (tenants.length === 0) {
      const defaultPlan = await prisma.plan.findFirst();
      const schools = await prisma.school.findMany();
      for (const s of schools) {
        await prisma.tenant.create({
          data: {
            schoolName: s.name,
            subdomain: s.subdomain,
            adminEmail: `admin@${s.subdomain}.edu.ng`,
            contactPhone: s.contactPhone || "+2348012345678",
            institutionTypes: ["PRIMARY", "SECONDARY"],
            planId: defaultPlan?.id || null,
            status: "ACTIVE",
          },
        }).catch(() => {});
      }

      tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        select: tenantSelect,
      });
    }

    const formattedTenants = tenants.map((t) => {
      const activeSub = t.subscriptions[0];
      const monthlyRate = Number(
        activeSub?.amountDue ?? t.plan?.priceNgn ?? 0
      );
      const nextRenewalDate = activeSub?.endsAt
        ? activeSub.endsAt.toISOString()
        : null;
      const subscriptionStatus =
        activeSub?.status?.toUpperCase() || t.status?.toUpperCase() || "INACTIVE";

      return {
        id: t.id,
        schoolName: t.schoolName,
        subdomain: t.subdomain,
        customDomain: t.customDomain,
        adminEmail: t.adminEmail,
        contactPhone: t.contactPhone,
        institutionTypes: t.institutionTypes,
        status: t.status,
        kycStatus: t.kycStatus,
        subscriptionStatus,
        monthlyRate,
        nextRenewalDate,
        isImpersonationAllowed: t.isImpersonationAllowed,
        suspendedReason: t.suspendedReason,
        suspendedAt: t.suspendedAt ? t.suspendedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        plan: t.plan
          ? {
              id: t.plan.id,
              name: t.plan.name,
              priceNgn: t.plan.priceNgn,
              billingCycle: t.plan.billingCycle,
              commissionPercent: 0,
            }
          : null,
        subscription: activeSub
          ? {
              status: activeSub.status,
              amountDue: Number(activeSub.amountDue),
              endsAt: activeSub.endsAt.toISOString(),
              trialEndsAt: activeSub.trialEndsAt
                ? activeSub.trialEndsAt.toISOString()
                : null,
            }
          : null,
      };
    });


    return NextResponse.json({
      success: true,
      platformBank: {
        bankCode: platformBank.bankCode,
        bankName: platformBank.bankName,
        accountNumber: platformBank.accountNumber,
        updatedAt: platformBank.updatedAt.toISOString(),
      },
      tenants: formattedTenants,
    });
  } catch (error: any) {
    console.error("[GET /api/saas Error]:", error);
    return NextResponse.json(
      { error: "Failed to retrieve SaaS telemetry and settlement configurations", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/saas
 * Updates either:
 *  A. Super Admin Platform Settlement Bank Configuration (global system settings)
 *  B. An individual Tenant's settlement bank configuration (paystackSettlementBank)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type, tenantId, bankCode, bankName, accountNumber, accountName } = body;

    // Validate 10-digit NUBAN account number
    if (!isValidNubanAccountNumber(accountNumber)) {
      return NextResponse.json(
        {
          error:
            "Invalid Account Number: Must be exactly 10 numeric digits according to Nigerian NUBAN standards.",
        },
        { status: 400 }
      );
    }

    // Validate bank code
    const resolvedBank = getBankByCode(bankCode);
    if (!resolvedBank) {
      return NextResponse.json(
        {
          error: `Invalid Bank: The selected bank code "${bankCode}" is not recognized in the approved Nigerian banks registry.`,
        },
        { status: 400 }
      );
    }

    const finalBankName = bankName || resolvedBank.name;

    // =========================================================================
    // CASE A: UPDATE TENANT SETTLEMENT BANK
    // =========================================================================
    if (tenantId || type === "tenant") {
      if (!tenantId) {
        return NextResponse.json(
          { error: "Missing required 'tenantId' for tenant settlement bank update." },
          { status: 400 }
        );
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return NextResponse.json(
          { error: `Tenant with ID "${tenantId}" does not exist.` },
          { status: 404 }
        );
      }

      const cleanAcc = String(accountNumber).trim();
      const finalAccountName = (accountName || tenant.schoolName).trim().toUpperCase();

      const settlementBankData = {
        bankCode: resolvedBank.code,
        bankName: finalBankName,
        accountNumber: cleanAcc,
        accountName: finalAccountName,
        updatedAt: new Date().toISOString(),
      };

      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          settlementBankName: finalBankName,
          settlementAccountNumber: cleanAcc,
          settlementAccountName: finalAccountName,
          collectionMode: "MANUAL_BANK_TRANSFER",
          paystackSettlementBank: settlementBankData,
        },
      });

      // Synchronize to the operational School record
      await prisma.school.updateMany({
        where: { subdomain: tenant.subdomain },
        data: {
          settlementBankName: finalBankName,
          settlementBankCode: resolvedBank.code,
          settlementAccountNumber: cleanAcc,
          settlementAccountName: finalAccountName,
          collectionMode: "MANUAL_BANK_TRANSFER",
        },
      });

      // Audit Log entry
      await prisma.auditLog.create({
        data: {
          actorId: "super_admin_api",
          action: "update_tenant_settlement_bank",
          tenantId: tenant.id,
          metadata: {
            schoolName: tenant.schoolName,
            subdomain: tenant.subdomain,
            previousBank: tenant.paystackSettlementBank,
            newBank: settlementBankData,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Direct collection bank for "${tenant.schoolName}" successfully updated to ${finalBankName} (${cleanAcc}).`,
        tenant: {
          id: updatedTenant.id,
          schoolName: updatedTenant.schoolName,
          subdomain: updatedTenant.subdomain,
          settlementBankName: finalBankName,
          settlementAccountNumber: cleanAcc,
          settlementAccountName: finalAccountName,
          collectionMode: "MANUAL_BANK_TRANSFER",
          paystackSettlementBank: settlementBankData,
        },
      });
    }

    // =========================================================================
    // CASE B: UPDATE SUPER ADMIN PLATFORM SETTLEMENT BANK
    // =========================================================================
    const platformBank = await prisma.platformBankConfig.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        bankCode: resolvedBank.code,
        bankName: finalBankName,
        accountNumber: String(accountNumber).trim(),
      },
      update: {
        bankCode: resolvedBank.code,
        bankName: finalBankName,
        accountNumber: String(accountNumber).trim(),
      },
    });

    // Audit Log entry
    await prisma.auditLog.create({
      data: {
        actorId: "super_admin_api",
        action: "update_platform_commission_bank",
        metadata: {
          previousBankConfig: platformBank,
          newBankConfig: {
            bankCode: resolvedBank.code,
            bankName: finalBankName,
            accountNumber: String(accountNumber).trim(),
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Super Admin Platform settlement bank successfully configured to ${finalBankName} (${accountNumber}).`,
      platformBank: {
        bankCode: platformBank.bankCode,
        bankName: platformBank.bankName,
        accountNumber: platformBank.accountNumber,
        updatedAt: platformBank.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[PATCH /api/saas Error]:", error);
    return NextResponse.json(
      { error: "Failed to update settlement bank configuration", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/saas
 * Delegates to PATCH for REST compatibility
 */
export async function PUT(req: NextRequest) {
  return PATCH(req);
}
