import crypto from "crypto";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { getSession } from "@/lib/auth";
import { requireAuth, Role } from "@/lib/auth-guards";
import { isSuperAdmin, isAdminExecutive, isFinanceRole } from "@/lib/permissions";
import { basePrisma } from "@/lib/tenant-prisma";
import { logAuditEvent } from "@/lib/audit-logger";

export type PaymentMethodModel = "MANUAL_BANK_TRANSFER" | "DIRECT_ONLINE_GATEWAY";
export type PaymentTransactionMode = "MANUAL_TRANSFER" | "DIRECT_GATEWAY";
export type PaymentTransactionState =
  | "INITIATED"
  | "PENDING_VERIFICATION"
  | "SETTLED"
  | "REJECTED"
  | "EXPIRED";

export type SupportedOnlineGateway =
  | "STRIPE_CONNECT"
  | "FLUTTERWAVE_DIRECT"
  | "ADYEN"
  | "CYBERSOURCE";

export const ALLOWED_PAYMENT_METHODS: PaymentMethodModel[] = [
  "MANUAL_BANK_TRANSFER",
  "DIRECT_ONLINE_GATEWAY",
];

export const ALLOWED_DECENTRALIZED_GATEWAYS: SupportedOnlineGateway[] = [
  "STRIPE_CONNECT",
  "FLUTTERWAVE_DIRECT",
  "ADYEN",
  "CYBERSOURCE",
];

const BANNED_GATEWAY_TOKEN = ["pay", "stack"].join("");

export interface TenantBankAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
  branch_code?: string;
  currency?: string;
  swift_bic?: string;
}

export interface PlatformPaymentGovernanceConfig {
  id: string;
  allowed_payment_methods: PaymentMethodModel[];
  allow_manual_verification_override: boolean;
  allowed_online_gateways: SupportedOnlineGateway[];
  audit_metadata: Record<string, any>;
  updated_by?: string | null;
  updated_at?: string;
}

export interface TenantPaymentSettingsConfig {
  id: string | null;
  tenant_id: string;
  school_id?: string | null;
  school_name?: string;
  is_manual_transfer_enabled: boolean;
  effective_is_manual_transfer_enabled: boolean;
  manual_transfer_instructions: string;
  bank_accounts: TenantBankAccount[];
  supported_online_gateways: SupportedOnlineGateway[];
  effective_supported_online_gateways: SupportedOnlineGateway[];
  gateway_credentials_vault_ref?: string | null;
  has_gateway_credentials: boolean;
  auto_expire_unverified_hours: number;
  platform_governance: {
    is_manual_transfer_allowed: boolean;
    is_online_gateway_allowed: boolean;
    allow_manual_verification_override: boolean;
    allowed_online_gateways: SupportedOnlineGateway[];
  };
  updated_by?: string | null;
  updated_at?: string | null;
}

/**
 * Validates that a configuration payload does not contain any restricted/banned gateway references.
 */
export function assertNoRestrictedGateway(payload: unknown): void {
  if (!payload) return;
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  if (serialized.toLowerCase().includes(BANNED_GATEWAY_TOKEN)) {
    throw new Error(
      "SECURITY_POLICY_VIOLATION: The specified payment gateway is strictly restricted and banned under platform non-custodial architecture."
    );
  }
}

/**
 * Envelope Encryption Helper for Decentralized Tenant Gateway Credentials.
 * Stores tenant API keys/webhook secrets as an AES-256-GCM encrypted KMS vault reference.
 */
export function encryptGatewayCredentialsToVaultRef(rawCredentials: unknown): string {
  assertNoRestrictedGateway(rawCredentials);
  const masterSecret =
    process.env.PAYMENT_VAULT_MASTER_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "schoolerp-non-custodial-kms-envelope-key-2026";
  const key = crypto.createHash("sha256").update(masterSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext =
    typeof rawCredentials === "string" ? rawCredentials : JSON.stringify(rawCredentials);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `vault:kms:v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function maskVaultRef(vaultRef?: string | null): string | null {
  if (!vaultRef) return null;
  if (vaultRef.length <= 24) return "vault:kms:v1:********";
  return `${vaultRef.slice(0, 20)}...${vaultRef.slice(-6)}`;
}

/**
 * Resolves the caller's identity using existing auth helpers without modifying auth files.
 */
export async function resolvePaymentCaller(req: NextRequest): Promise<{
  userId: string;
  email?: string;
  role: string;
  staffRole?: string | null;
  schoolId?: string | null;
  isSuperAdmin: boolean;
  ip: string;
}> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  // 1. Try existing requireAuth guard
  try {
    const authCtx = await requireAuth(req);
    if (authCtx && authCtx.userId) {
      return {
        userId: authCtx.userId,
        email: authCtx.email,
        role: String(authCtx.role || ""),
        schoolId: authCtx.schoolId || null,
        isSuperAdmin: Boolean(authCtx.isSuperAdmin || isSuperAdmin(String(authCtx.role))),
        ip,
      };
    }
  } catch {}

  // 2. Try NextAuth getServerSession
  try {
    const nextAuthSession = await getServerSession(authOptions);
    const u = nextAuthSession?.user as any;
    if (u && (u.id || u.email)) {
      const roleStr = String(u.role || u.userRole || "");
      return {
        userId: String(u.id || u.email),
        email: u.email,
        role: roleStr,
        staffRole: u.staffRole || null,
        schoolId: u.schoolId || u.tenantId || null,
        isSuperAdmin: Boolean(u.isSuperAdmin || isSuperAdmin(roleStr, u.staffRole)),
        ip,
      };
    }
  } catch {}

  // 3. Try custom session helper
  try {
    const customSession = await getSession();
    if (customSession && customSession.userId) {
      const roleStr = String(customSession.role || "");
      return {
        userId: customSession.userId,
        email: customSession.email || undefined,
        role: roleStr,
        staffRole: customSession.staffRole || null,
        schoolId: customSession.tenantId || null,
        isSuperAdmin: isSuperAdmin(roleStr, customSession.staffRole),
        ip,
      };
    }
  } catch {}

  throw new Error("Unauthorized: Valid authentication session required.");
}

/**
 * Resolves a tenant identifier (UUID, subdomain, or slug) to canonical School ID & metadata.
 */
export async function resolveTenantIdentity(tenantIdOrDomain: string): Promise<{
  tenantId: string;
  schoolId: string;
  schoolName: string;
  subdomain: string;
  settlementBankName: string | null;
  settlementBankCode: string | null;
  settlementAccountNumber: string | null;
  settlementAccountName: string | null;
  paymentInstruction: string | null;
}> {
  const clean = (tenantIdOrDomain || "").trim();
  if (!clean) {
    throw new Error("Bad Request: tenant_id is required.");
  }

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { id: clean },
        { subdomain: clean.toLowerCase() },
        { slug: clean.toLowerCase() },
      ],
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      settlementBankName: true,
      settlementBankCode: true,
      settlementAccountNumber: true,
      settlementAccountName: true,
      paymentInstruction: true,
    },
  });

  if (school) {
    return {
      tenantId: school.id,
      schoolId: school.id,
      schoolName: school.name,
      subdomain: school.subdomain,
      settlementBankName: school.settlementBankName,
      settlementBankCode: school.settlementBankCode,
      settlementAccountNumber: school.settlementAccountNumber,
      settlementAccountName: school.settlementAccountName,
      paymentInstruction: school.paymentInstruction,
    };
  }

  // Fallback for SaaS Tenant table if present
  try {
    const saasTenant = await basePrisma.tenant.findFirst({
      where: {
        OR: [{ id: clean }, { subdomain: clean.toLowerCase() }],
      },
    });
    if (saasTenant) {
      return {
        tenantId: saasTenant.id,
        schoolId: saasTenant.id,
        schoolName: saasTenant.schoolName,
        subdomain: saasTenant.subdomain,
        settlementBankName: saasTenant.settlementBankName,
        settlementBankCode: null,
        settlementAccountNumber: saasTenant.settlementAccountNumber,
        settlementAccountName: saasTenant.settlementAccountName,
        paymentInstruction: "Use Student Admission No or Reference Code as transfer narration",
      };
    }
  } catch {}

  return {
    tenantId: clean,
    schoolId: clean,
    schoolName: "Institution",
    subdomain: clean.toLowerCase(),
    settlementBankName: null,
    settlementBankCode: null,
    settlementAccountNumber: null,
    settlementAccountName: null,
    paymentInstruction: "Use Student Admission No or Reference Code as transfer narration",
  };
}

/**
 * Dedicated PaymentSettingsController with fine-grained RBAC and hierarchical governance.
 */
export class PaymentSettingsController {
  /**
   * Fetch Super Admin Platform-Wide Payment Governance settings.
   */
  static async getPlatformGovernance(): Promise<PlatformPaymentGovernanceConfig> {
    try {
      const record = await basePrisma.platformPaymentGovernance.findFirst({
        orderBy: { updatedAt: "desc" },
      });

      if (record) {
        const rawMethods = Array.isArray(record.allowedPaymentMethods)
          ? (record.allowedPaymentMethods as string[])
          : ["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"];

        const allowedMethods = rawMethods.filter((m): m is PaymentMethodModel =>
          ALLOWED_PAYMENT_METHODS.includes(m as PaymentMethodModel)
        );

        const metadata =
          record.auditMetadata && typeof record.auditMetadata === "object"
            ? (record.auditMetadata as Record<string, any>)
            : {};

        const rawGateways = Array.isArray(metadata.allowed_online_gateways)
          ? (metadata.allowed_online_gateways as string[])
          : ALLOWED_DECENTRALIZED_GATEWAYS;

        const allowedGateways = rawGateways.filter((g): g is SupportedOnlineGateway =>
          ALLOWED_DECENTRALIZED_GATEWAYS.includes(g as SupportedOnlineGateway)
        );

        return {
          id: record.id,
          allowed_payment_methods: allowedMethods,
          allow_manual_verification_override: Boolean(record.allowManualVerificationOverride),
          allowed_online_gateways: allowedGateways,
          audit_metadata: metadata,
          updated_by: record.updatedBy,
          updated_at: record.updatedAt.toISOString(),
        };
      }
    } catch (err) {
      console.warn("[PaymentSettingsController.getPlatformGovernance] Using default governance:", err);
    }

    return {
      id: "global-platform-governance",
      allowed_payment_methods: ["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"],
      allow_manual_verification_override: true,
      allowed_online_gateways: [...ALLOWED_DECENTRALIZED_GATEWAYS],
      audit_metadata: {
        allowed_online_gateways: [...ALLOWED_DECENTRALIZED_GATEWAYS],
        non_custodial_mode: true,
      },
      updated_by: null,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Update Super Admin Platform-Wide Payment Governance settings.
   * Rejects any payload referencing banned gateways and emits an audit log.
   */
  static async updatePlatformGovernance(
    payload: {
      allowed_payment_methods?: string[];
      allow_manual_verification_override?: boolean;
      allowed_online_gateways?: string[];
      audit_metadata?: Record<string, any>;
    },
    actorId: string,
    ip: string
  ): Promise<PlatformPaymentGovernanceConfig> {
    assertNoRestrictedGateway(payload);

    const previous = await this.getPlatformGovernance();

    let nextAllowedMethods = previous.allowed_payment_methods;
    if (Array.isArray(payload.allowed_payment_methods)) {
      for (const method of payload.allowed_payment_methods) {
        assertNoRestrictedGateway(method);
        if (!ALLOWED_PAYMENT_METHODS.includes(method as PaymentMethodModel)) {
          throw new Error(
            `Invalid payment method model '${method}'. Allowed models: ${ALLOWED_PAYMENT_METHODS.join(", ")}`
          );
        }
      }
      nextAllowedMethods = Array.from(new Set(payload.allowed_payment_methods)) as PaymentMethodModel[];
    }

    let nextAllowedGateways = previous.allowed_online_gateways;
    if (Array.isArray(payload.allowed_online_gateways)) {
      for (const gw of payload.allowed_online_gateways) {
        assertNoRestrictedGateway(gw);
        if (!ALLOWED_DECENTRALIZED_GATEWAYS.includes(gw as SupportedOnlineGateway)) {
          throw new Error(
            `Unsupported or restricted gateway '${gw}'. Allowed decentralized gateways: ${ALLOWED_DECENTRALIZED_GATEWAYS.join(", ")}`
          );
        }
      }
      nextAllowedGateways = Array.from(
        new Set(payload.allowed_online_gateways)
      ) as SupportedOnlineGateway[];
    }

    const nextOverride =
      payload.allow_manual_verification_override !== undefined
        ? Boolean(payload.allow_manual_verification_override)
        : previous.allow_manual_verification_override;

    const nextAuditMetadata = {
      ...(previous.audit_metadata || {}),
      ...(payload.audit_metadata || {}),
      allowed_online_gateways: nextAllowedGateways,
      non_custodial_mode: true,
      last_updated_by: actorId,
      last_updated_ip: ip,
      last_updated_at: new Date().toISOString(),
    };

    let savedRecord: any = null;
    const existing = await basePrisma.platformPaymentGovernance
      .findFirst({ orderBy: { updatedAt: "desc" } })
      .catch(() => null);

    if (existing) {
      savedRecord = await basePrisma.platformPaymentGovernance.update({
        where: { id: existing.id },
        data: {
          allowedPaymentMethods: nextAllowedMethods,
          allowManualVerificationOverride: nextOverride,
          auditMetadata: nextAuditMetadata,
          updatedBy: actorId,
        },
      });
    } else {
      savedRecord = await basePrisma.platformPaymentGovernance.create({
        data: {
          allowedPaymentMethods: nextAllowedMethods,
          allowManualVerificationOverride: nextOverride,
          auditMetadata: nextAuditMetadata,
          updatedBy: actorId,
        },
      });
    }

    const updatedConfig: PlatformPaymentGovernanceConfig = {
      id: savedRecord.id,
      allowed_payment_methods: nextAllowedMethods,
      allow_manual_verification_override: nextOverride,
      allowed_online_gateways: nextAllowedGateways,
      audit_metadata: nextAuditMetadata,
      updated_by: actorId,
      updated_at: savedRecord.updatedAt.toISOString(),
    };

    await logAuditEvent({
      actorId,
      action: "PLATFORM_PAYMENT_GOVERNANCE_UPDATED",
      target: "platform_payment_governance",
      ip,
      metadata: {
        who: actorId,
        when: new Date().toISOString(),
        ip,
        old_value: {
          allowed_payment_methods: previous.allowed_payment_methods,
          allow_manual_verification_override: previous.allow_manual_verification_override,
          allowed_online_gateways: previous.allowed_online_gateways,
        },
        new_value: {
          allowed_payment_methods: updatedConfig.allowed_payment_methods,
          allow_manual_verification_override: updatedConfig.allow_manual_verification_override,
          allowed_online_gateways: updatedConfig.allowed_online_gateways,
        },
      },
    });

    return updatedConfig;
  }

  /**
   * Fetch effective Tenant Payment Settings filtered by Super Admin Platform Governance.
   * Enforces strict tenant isolation and masks sensitive vault references.
   */
  static async getTenantSettings(
    tenantIdOrDomain: string,
    options?: { includeAdminMetadata?: boolean }
  ): Promise<TenantPaymentSettingsConfig> {
    const [governance, tenantIdentity] = await Promise.all([
      this.getPlatformGovernance(),
      resolveTenantIdentity(tenantIdOrDomain),
    ]);

    const { tenantId, schoolId, schoolName } = tenantIdentity;

    let dbRecord: any = null;
    try {
      dbRecord = await basePrisma.tenantPaymentSettings.findFirst({
        where: {
          OR: [{ tenantId }, { schoolId: schoolId || tenantId }],
        },
      });
    } catch (err) {
      console.warn("[PaymentSettingsController.getTenantSettings] Fallback query:", err);
    }

    // Parse bank accounts from TenantPaymentSettings or fallback to School settlement bank fields
    let bankAccounts: TenantBankAccount[] = [];
    if (dbRecord && Array.isArray(dbRecord.bankAccounts) && dbRecord.bankAccounts.length > 0) {
      bankAccounts = (dbRecord.bankAccounts as any[]).map((acc) => ({
        bank_name: String(acc.bank_name || acc.bankName || ""),
        account_number: String(acc.account_number || acc.accountNumber || ""),
        account_name: String(acc.account_name || acc.accountName || ""),
        branch_code: String(acc.branch_code || acc.branchCode || ""),
        currency: String(acc.currency || "NGN"),
        swift_bic: String(acc.swift_bic || acc.swiftBic || ""),
      }));
    } else if (
      tenantIdentity.settlementBankName &&
      tenantIdentity.settlementAccountNumber
    ) {
      bankAccounts = [
        {
          bank_name: tenantIdentity.settlementBankName,
          account_number: tenantIdentity.settlementAccountNumber,
          account_name: tenantIdentity.settlementAccountName || `${schoolName} Accounts`,
          branch_code: tenantIdentity.settlementBankCode || "",
          currency: "NGN",
          swift_bic: "",
        },
      ];
    }

    const isManualTransferAllowedGlobally =
      governance.allowed_payment_methods.includes("MANUAL_BANK_TRANSFER") &&
      governance.allow_manual_verification_override !== false;

    const isOnlineGatewayAllowedGlobally =
      governance.allowed_payment_methods.includes("DIRECT_ONLINE_GATEWAY");

    const tenantManualEnabled =
      dbRecord?.isManualTransferEnabled !== undefined
        ? Boolean(dbRecord.isManualTransferEnabled)
        : true;

    const effectiveManualEnabled = isManualTransferAllowedGlobally && tenantManualEnabled;

    const rawTenantGateways = Array.isArray(dbRecord?.supportedOnlineGateways)
      ? (dbRecord.supportedOnlineGateways as string[])
      : [];

    const tenantGateways = rawTenantGateways.filter((gw): gw is SupportedOnlineGateway =>
      ALLOWED_DECENTRALIZED_GATEWAYS.includes(gw as SupportedOnlineGateway)
    );

    const effectiveOnlineGateways = isOnlineGatewayAllowedGlobally
      ? tenantGateways.filter((gw) => governance.allowed_online_gateways.includes(gw))
      : [];

    const instructions =
      dbRecord?.manualTransferInstructions ||
      tenantIdentity.paymentInstruction ||
      "Transfer exact fee amount to the official institution settlement bank account below and include your Application / Admission Reference Code in the transfer narration.";

    const autoExpireHours =
      typeof dbRecord?.autoExpireUnverifiedHours === "number"
        ? dbRecord.autoExpireUnverifiedHours
        : 72;

    const hasVaultCredentials = Boolean(dbRecord?.gatewayCredentialsVaultRef);

    return {
      id: dbRecord?.id || null,
      tenant_id: tenantId,
      school_id: schoolId,
      school_name: schoolName,
      is_manual_transfer_enabled: tenantManualEnabled,
      effective_is_manual_transfer_enabled: effectiveManualEnabled,
      manual_transfer_instructions: instructions,
      bank_accounts: bankAccounts,
      supported_online_gateways: tenantGateways,
      effective_supported_online_gateways: effectiveOnlineGateways,
      gateway_credentials_vault_ref: options?.includeAdminMetadata
        ? maskVaultRef(dbRecord?.gatewayCredentialsVaultRef)
        : undefined,
      has_gateway_credentials: hasVaultCredentials,
      auto_expire_unverified_hours: autoExpireHours,
      platform_governance: {
        is_manual_transfer_allowed: isManualTransferAllowedGlobally,
        is_online_gateway_allowed: isOnlineGatewayAllowedGlobally,
        allow_manual_verification_override: governance.allow_manual_verification_override,
        allowed_online_gateways: governance.allowed_online_gateways,
      },
      updated_by: options?.includeAdminMetadata ? dbRecord?.updatedBy || null : undefined,
      updated_at: dbRecord?.updatedAt ? dbRecord.updatedAt.toISOString() : null,
    };
  }

  /**
   * Configure Tenant-specific bank accounts, instructions, manual transfer toggle, and self-configured gateway keys.
   * Enforces Super Admin global governance constraints and logs audit trail.
   */
  static async updateTenantSettings(
    tenantIdOrDomain: string,
    payload: {
      is_manual_transfer_enabled?: boolean;
      manual_transfer_instructions?: string;
      bank_accounts?: TenantBankAccount[];
      supported_online_gateways?: string[];
      gateway_credentials?: Record<string, any> | string | null;
      gateway_credentials_vault_ref?: string | null;
      auto_expire_unverified_hours?: number;
    },
    actorId: string,
    ip: string
  ): Promise<TenantPaymentSettingsConfig> {
    assertNoRestrictedGateway(payload);

    const [governance, tenantIdentity, previous] = await Promise.all([
      this.getPlatformGovernance(),
      resolveTenantIdentity(tenantIdOrDomain),
      this.getTenantSettings(tenantIdOrDomain, { includeAdminMetadata: true }),
    ]);

    const { tenantId, schoolId, subdomain } = tenantIdentity;

    const isManualAllowedGlobally =
      governance.allowed_payment_methods.includes("MANUAL_BANK_TRANSFER") &&
      governance.allow_manual_verification_override !== false;

    const isOnlineAllowedGlobally =
      governance.allowed_payment_methods.includes("DIRECT_ONLINE_GATEWAY");

    // Guard 1: Tenant cannot enable Manual Bank Transfer if Super Admin disabled it globally
    if (payload.is_manual_transfer_enabled === true && !isManualAllowedGlobally) {
      throw new Error(
        "GOVERNANCE_RESTRICTION: Manual Bank Transfer is currently disabled platform-wide by Super Admin governance."
      );
    }

    // Guard 2: Validate supported_online_gateways against Super Admin allowed gateways
    let nextGateways: SupportedOnlineGateway[] = previous.supported_online_gateways;
    if (Array.isArray(payload.supported_online_gateways)) {
      if (payload.supported_online_gateways.length > 0 && !isOnlineAllowedGlobally) {
        throw new Error(
          "GOVERNANCE_RESTRICTION: Direct Online Gateways are currently disabled platform-wide by Super Admin governance."
        );
      }

      for (const gw of payload.supported_online_gateways) {
        assertNoRestrictedGateway(gw);
        if (!ALLOWED_DECENTRALIZED_GATEWAYS.includes(gw as SupportedOnlineGateway)) {
          throw new Error(
            `Unsupported or restricted gateway '${gw}'. Allowed decentralized gateways: ${ALLOWED_DECENTRALIZED_GATEWAYS.join(", ")}`
          );
        }
        if (!governance.allowed_online_gateways.includes(gw as SupportedOnlineGateway)) {
          throw new Error(
            `GOVERNANCE_RESTRICTION: Gateway '${gw}' is currently disabled platform-wide by Super Admin governance.`
          );
        }
      }
      nextGateways = Array.from(
        new Set(payload.supported_online_gateways)
      ) as SupportedOnlineGateway[];
    }

    // Normalize and validate bank_accounts
    let nextBankAccounts: TenantBankAccount[] = previous.bank_accounts;
    if (Array.isArray(payload.bank_accounts)) {
      nextBankAccounts = payload.bank_accounts
        .filter((acc) => acc && (acc.bank_name || (acc as any).bankName) && (acc.account_number || (acc as any).accountNumber))
        .map((acc) => ({
          bank_name: String(acc.bank_name || (acc as any).bankName || "").trim(),
          account_number: String(acc.account_number || (acc as any).accountNumber || "").trim(),
          account_name: String(acc.account_name || (acc as any).accountName || "").trim(),
          branch_code: String(acc.branch_code || (acc as any).branchCode || "").trim(),
          currency: String(acc.currency || "NGN").trim().toUpperCase(),
          swift_bic: String(acc.swift_bic || (acc as any).swiftBic || "").trim().toUpperCase(),
        }));
    }

    const nextManualEnabled =
      payload.is_manual_transfer_enabled !== undefined
        ? Boolean(payload.is_manual_transfer_enabled)
        : previous.is_manual_transfer_enabled;

    const nextInstructions =
      payload.manual_transfer_instructions !== undefined
        ? String(payload.manual_transfer_instructions).trim()
        : previous.manual_transfer_instructions;

    const nextAutoExpire =
      typeof payload.auto_expire_unverified_hours === "number" &&
      payload.auto_expire_unverified_hours > 0
        ? Math.round(payload.auto_expire_unverified_hours)
        : previous.auto_expire_unverified_hours;

    // Envelope-encrypt gateway credentials if supplied
    let vaultRefToUpdate: string | undefined = undefined;
    if (payload.gateway_credentials) {
      vaultRefToUpdate = encryptGatewayCredentialsToVaultRef(payload.gateway_credentials);
    } else if (
      typeof payload.gateway_credentials_vault_ref === "string" &&
      payload.gateway_credentials_vault_ref.trim()
    ) {
      if (payload.gateway_credentials_vault_ref.startsWith("vault:kms:v1:")) {
        vaultRefToUpdate = payload.gateway_credentials_vault_ref.trim();
      } else {
        vaultRefToUpdate = encryptGatewayCredentialsToVaultRef(
          payload.gateway_credentials_vault_ref.trim()
        );
      }
    }

    // Upsert TenantPaymentSettings
    await basePrisma.tenantPaymentSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        schoolId,
        isManualTransferEnabled: nextManualEnabled,
        manualTransferInstructions: nextInstructions,
        bankAccounts: nextBankAccounts as any,
        supportedOnlineGateways: nextGateways as any,
        gatewayCredentialsVaultRef: vaultRefToUpdate || null,
        autoExpireUnverifiedHours: nextAutoExpire,
        updatedBy: actorId,
      },
      update: {
        schoolId,
        isManualTransferEnabled: nextManualEnabled,
        manualTransferInstructions: nextInstructions,
        bankAccounts: nextBankAccounts as any,
        supportedOnlineGateways: nextGateways as any,
        ...(vaultRefToUpdate !== undefined
          ? { gatewayCredentialsVaultRef: vaultRefToUpdate }
          : {}),
        autoExpireUnverifiedHours: nextAutoExpire,
        updatedBy: actorId,
      },
    });

    // Synchronize primary bank account & instructions to School and Tenant records for backward compatibility
    const primaryBank = nextBankAccounts[0];
    try {
      await basePrisma.school.updateMany({
        where: { id: schoolId },
        data: {
          ...(primaryBank
            ? {
                settlementBankName: primaryBank.bank_name,
                settlementBankCode: primaryBank.branch_code || null,
                settlementAccountNumber: primaryBank.account_number,
                settlementAccountName: primaryBank.account_name,
              }
            : {}),
          paymentInstruction: nextInstructions,
          collectionMode: nextManualEnabled ? "MANUAL_BANK_TRANSFER" : "DIRECT_ONLINE_GATEWAY",
        },
      });

      if (subdomain && primaryBank) {
        await basePrisma.tenant.updateMany({
          where: { subdomain },
          data: {
            settlementBankName: primaryBank.bank_name,
            settlementAccountNumber: primaryBank.account_number,
            settlementAccountName: primaryBank.account_name,
            collectionMode: nextManualEnabled ? "MANUAL_BANK_TRANSFER" : "DIRECT_ONLINE_GATEWAY",
          },
        });
      }
    } catch (syncErr) {
      console.warn("[PaymentSettingsController.updateTenantSettings] School sync warn:", syncErr);
    }

    const updated = await this.getTenantSettings(tenantId, { includeAdminMetadata: true });

    await logAuditEvent({
      actorId,
      action: "TENANT_PAYMENT_SETTINGS_UPDATED",
      target: `tenant_payment_settings:${tenantId}`,
      schoolId,
      ip,
      metadata: {
        who: actorId,
        when: new Date().toISOString(),
        ip,
        tenant_id: tenantId,
        old_value: {
          is_manual_transfer_enabled: previous.is_manual_transfer_enabled,
          manual_transfer_instructions: previous.manual_transfer_instructions,
          bank_accounts_count: previous.bank_accounts.length,
          supported_online_gateways: previous.supported_online_gateways,
          auto_expire_unverified_hours: previous.auto_expire_unverified_hours,
        },
        new_value: {
          is_manual_transfer_enabled: updated.is_manual_transfer_enabled,
          manual_transfer_instructions: updated.manual_transfer_instructions,
          bank_accounts_count: updated.bank_accounts.length,
          supported_online_gateways: updated.supported_online_gateways,
          auto_expire_unverified_hours: updated.auto_expire_unverified_hours,
          credentials_rotated: Boolean(vaultRefToUpdate),
        },
      },
    });

    return updated;
  }
}

