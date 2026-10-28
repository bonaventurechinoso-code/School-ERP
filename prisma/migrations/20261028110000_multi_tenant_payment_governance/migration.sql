-- CreateTable: platform_payment_governance (Super Admin Settings)
CREATE TABLE IF NOT EXISTS "platform_payment_governance" (
    "id" TEXT NOT NULL,
    "allowed_payment_methods" JSONB NOT NULL DEFAULT '["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"]',
    "allow_manual_verification_override" BOOLEAN NOT NULL DEFAULT true,
    "audit_metadata" JSONB DEFAULT '{}',
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_payment_governance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_payment_settings (Tenant Admin Configuration)
CREATE TABLE IF NOT EXISTS "tenant_payment_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "school_id" TEXT,
    "is_manual_transfer_enabled" BOOLEAN NOT NULL DEFAULT true,
    "manual_transfer_instructions" TEXT,
    "bank_accounts" JSONB NOT NULL DEFAULT '[]',
    "supported_online_gateways" JSONB NOT NULL DEFAULT '[]',
    "gateway_credentials_vault_ref" TEXT,
    "auto_expire_unverified_hours" INTEGER NOT NULL DEFAULT 72,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_payment_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tenant_payment_settings"
ADD COLUMN IF NOT EXISTS "updated_by" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_payment_settings_tenant_id_key" ON "tenant_payment_settings"("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_payment_settings_tenant_id_idx" ON "tenant_payment_settings"("tenant_id");

-- AlterTable: Extend Payment with verification & transaction state metadata
ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "payment_mode" TEXT NOT NULL DEFAULT 'MANUAL_TRANSFER',
ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'SETTLED',
ADD COLUMN IF NOT EXISTS "proof_of_payment_url" TEXT,
ADD COLUMN IF NOT EXISTS "depositor_name" TEXT,
ADD COLUMN IF NOT EXISTS "transfer_reference" TEXT,
ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT,
ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_schoolId_transfer_reference_idx" ON "Payment"("schoolId", "transfer_reference");

-- AlterTable: Extend PaymentProof with verification & transaction state metadata
ALTER TABLE "PaymentProof"
ADD COLUMN IF NOT EXISTS "payment_mode" TEXT NOT NULL DEFAULT 'MANUAL_TRANSFER',
ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
ADD COLUMN IF NOT EXISTS "proof_of_payment_url" TEXT,
ADD COLUMN IF NOT EXISTS "depositor_name" TEXT,
ADD COLUMN IF NOT EXISTS "transfer_reference" TEXT,
ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "PaymentProof_schoolId_transfer_reference_idx" ON "PaymentProof"("schoolId", "transfer_reference");

-- AlterTable: Extend payment_receipts with verification & transaction state metadata
ALTER TABLE "payment_receipts"
ADD COLUMN IF NOT EXISTS "payment_mode" TEXT NOT NULL DEFAULT 'MANUAL_TRANSFER',
ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
ADD COLUMN IF NOT EXISTS "proof_of_payment_url" TEXT,
ADD COLUMN IF NOT EXISTS "depositor_name" TEXT,
ADD COLUMN IF NOT EXISTS "transfer_reference" TEXT,
ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "payment_receipts_tenant_id_state_idx" ON "payment_receipts"("tenant_id", "state");
CREATE INDEX IF NOT EXISTS "payment_receipts_tenant_id_transfer_reference_idx" ON "payment_receipts"("tenant_id", "transfer_reference");

