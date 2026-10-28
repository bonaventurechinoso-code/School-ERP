import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";
import SuperAdminPaymentsClient, {
  SubscriptionSettingItem,
} from "./SuperAdminPaymentsClient";

export const dynamic = "force-dynamic";

async function getGovernance() {
  try {
    const row = await basePrisma.platformPaymentGovernance.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (row) {
      return {
        ...row,
        allowedOnlineGateways: Array.isArray((row.auditMetadata as any)?.allowed_online_gateways)
          ? (row.auditMetadata as any).allowed_online_gateways
          : ["STRIPE_CONNECT", "FLUTTERWAVE_DIRECT", "ADYEN", "CYBERSOURCE"],
      };
    }
    return {
      id: "global-platform-governance",
      allowedPaymentMethods: ["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"],
      allowManualVerificationOverride: true,
      allowedOnlineGateways: ["STRIPE_CONNECT", "FLUTTERWAVE_DIRECT", "ADYEN", "CYBERSOURCE"],
      auditMetadata: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (e?.code === "P2021" || e?.code === "P2022" || msg.includes("does not exist")) {
      console.error("PROD TABLE MISSING: platform_payment_governance - run migration");
      return {
        id: "fallback",
        allowedPaymentMethods: ["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"],
        allowManualVerificationOverride: true,
        allowedOnlineGateways: ["STRIPE_CONNECT", "FLUTTERWAVE_DIRECT", "ADYEN", "CYBERSOURCE"],
        auditMetadata: {},
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    throw e;
  }
}

async function getTenantSettingsProbe() {
  try {
    return await basePrisma.tenantPaymentSettings.findFirst();
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (e?.code === "P2021" || e?.code === "P2022" || msg.includes("does not exist")) {
      console.error("PROD TABLE MISSING: tenant_payment_settings - run migration");
      return { id: "fallback" };
    }
    throw e;
  }
}

export const metadata = {
  title: "Platform Subscription Management | Super Admin",
  description: "Configure SaaS subscription plans. Schools manage their own fees independently.",
};

// Default platform SaaS subscription plan definitions
const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionSettingItem[] = [
  {
    moduleType: "PLATFORM_SUBSCRIPTION_MONTHLY",
    title: "Monthly SaaS Subscription Plan",
    amount: 15000,
    currency: "NGN",
    isEnabled: true,
    isActive: true,
    category: "SUBSCRIPTION",
    isPlatformFee: true,
    isPlatformOnly: true,
    description: "Monthly multi-tenant SaaS cloud license, maintenance, and automated server infrastructure.",
    customWriteup: "Monthly subscription fee for access to SchoolERP platform. Due on the 1st of every month.",
    bankName: "Wema Bank",
    accountNumber: "0123456789",
    accountName: "SchoolERP Platform Central",
  },
  {
    moduleType: "PLATFORM_SUBSCRIPTION_TERMLY",
    title: "Termly SaaS Subscription Plan",
    amount: 40000,
    currency: "NGN",
    isEnabled: true,
    isActive: true,
    category: "SUBSCRIPTION",
    isPlatformFee: true,
    isPlatformOnly: true,
    description: "Termly institution software license covering academic term portal operations (3 terms per academic session).",
    customWriteup: "Termly platform subscription fee. Grants complete portal access for 1 academic term.",
    bankName: "Wema Bank",
    accountNumber: "0123456789",
    accountName: "SchoolERP Platform Central",
  },
  {
    moduleType: "PLATFORM_SUBSCRIPTION",
    title: "Annual Enterprise Subscription Plan",
    amount: 100000,
    currency: "NGN",
    isEnabled: true,
    isActive: true,
    category: "SUBSCRIPTION",
    isPlatformFee: true,
    isPlatformOnly: true,
    description: "Full academic session software license, unlimited database tier storage, broadsheet engine, and VIP support.",
    customWriteup: "Annual platform enterprise license. Unlocks complete institutional access for 365 days.",
    bankName: "Wema Bank",
    accountNumber: "0123456789",
    accountName: "SchoolERP Platform Central",
  },
];

export default async function SuperAdminPaymentsPage() {
  let isSuperAdmin = false;
  let session = null;

  try {
    session = await getServerSession(authOptions);
    const user = (session?.user as any) || (await getSession().catch(() => null));
    if (user && !session) {
      session = { user } as any;
    }
    const rawRole = (user?.role || user?.userRole || "").toUpperCase();
    isSuperAdmin = rawRole === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);
  } catch (authErr) {
    console.error("[SuperAdminPaymentsPage] Error fetching server session:", authErr);
  }

  if (!session || !isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 p-8 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto font-black text-2xl border border-rose-200 dark:border-rose-800">
            403
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Access Denied (403 Forbidden)
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Platform Subscription Management is strictly restricted to Central Platform Super-Administrators. Tenant accounts and school administrators cannot access or modify platform subscription parameters.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Defensively query subscription settings without crashing if model or records differ
  let existingSettings: any[] = [];
  try {
    if (typeof (basePrisma as any)?.paymentSetting?.findMany === "function") {
      existingSettings = await (basePrisma as any).paymentSetting.findMany({
        where: {
          moduleType: {
            in: [
              "PLATFORM_SUBSCRIPTION",
              "PLATFORM_SUBSCRIPTION_MONTHLY",
              "PLATFORM_SUBSCRIPTION_TERMLY",
              "PLATFORM_SUBSCRIPTION_ANNUAL",
              "SUBSCRIPTION",
            ],
          },
        },
      });
    }
  } catch (queryErr) {
    console.error("[SuperAdminPaymentsPage] Warning querying subscription settings from database:", queryErr);
  }

  // Count pending platform subscription receipts for verification badge
  let pendingReceiptsCount = 0;
  try {
    pendingReceiptsCount = await basePrisma.paymentReceipt.count({
      where: {
        moduleType: { contains: "SUBSCRIPTION" },
        status: "PENDING",
      },
    });
  } catch (countErr) {
    console.error("[SuperAdminPaymentsPage] Error counting pending receipts:", countErr);
  }

  const dbMap = new Map<string, any>();
  for (const s of existingSettings) {
    if (s?.moduleType) {
      dbMap.set(s.moduleType, s);
    }
  }

  // Merge database records with default SaaS subscription definitions
  const initialPlans: SubscriptionSettingItem[] = DEFAULT_SUBSCRIPTION_PLANS.map((plan) => {
    const dbRecord = dbMap.get(plan.moduleType);
    if (dbRecord) {
      const parsedAmount = Number(dbRecord.amount?.toString() || 0);
      return {
        id: dbRecord.id,
        moduleType: dbRecord.moduleType,
        title: dbRecord.title || plan.title,
        amount: parsedAmount > 0 ? parsedAmount : plan.amount,
        currency: dbRecord.currency || plan.currency,
        isEnabled: dbRecord.isEnabled !== undefined ? Boolean(dbRecord.isEnabled) : plan.isEnabled,
        isActive: dbRecord.isActive !== undefined ? Boolean(dbRecord.isActive) : plan.isActive,
        category: "SUBSCRIPTION",
        isPlatformFee: true,
        isPlatformOnly: true,
        description: plan.description,
        customWriteup: dbRecord.customWriteup ?? plan.customWriteup,
        accountName: dbRecord.accountName ?? plan.accountName,
        accountNumber: dbRecord.accountNumber ?? plan.accountNumber,
        bankName: dbRecord.bankName ?? plan.bankName,
      };
    }
    return plan;
  });

  const [governanceRecord, tenantProbe] = await Promise.all([
    getGovernance().catch((err) => {
      console.error("[SuperAdminPaymentsPage] Fallback governance:", err);
      return {
        id: "fallback",
        allowedPaymentMethods: ["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"],
        allowManualVerificationOverride: true,
        allowedOnlineGateways: ["STRIPE_CONNECT", "FLUTTERWAVE_DIRECT", "ADYEN", "CYBERSOURCE"],
        auditMetadata: {},
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),
    getTenantSettingsProbe().catch(() => ({ id: "fallback" })),
  ]);

  const isFallback =
    governanceRecord?.id === "fallback" || (tenantProbe as any)?.id === "fallback";

  const serializedGovernance = {
    id: governanceRecord.id,
    allowed_payment_methods: Array.isArray((governanceRecord as any).allowedPaymentMethods)
      ? (governanceRecord as any).allowedPaymentMethods
      : ["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"],
    allow_manual_verification_override: Boolean(
      (governanceRecord as any).allowManualVerificationOverride ?? true
    ),
    allowed_online_gateways: Array.isArray((governanceRecord as any).allowedOnlineGateways)
      ? (governanceRecord as any).allowedOnlineGateways
      : ["STRIPE_CONNECT", "FLUTTERWAVE_DIRECT", "ADYEN", "CYBERSOURCE"],
    audit_metadata:
      (governanceRecord as any).auditMetadata &&
      typeof (governanceRecord as any).auditMetadata === "object"
        ? (governanceRecord as any).auditMetadata
        : {},
    updated_by: (governanceRecord as any).updatedBy || null,
    updated_at:
      (governanceRecord as any).updatedAt instanceof Date
        ? (governanceRecord as any).updatedAt.toISOString()
        : String((governanceRecord as any).updatedAt || new Date().toISOString()),
    is_fallback: isFallback,
  };

  return (
    <div className="py-4 max-w-7xl mx-auto space-y-6">
      <SuperAdminPaymentsClient
        initialPlans={initialPlans}
        pendingReceiptsCount={pendingReceiptsCount}
        initialGovernance={serializedGovernance}
        isFallback={isFallback}
      />
    </div>
  );
}
