-- Enterprise Persistence Migration for Payment Proofs
ALTER TABLE "TenantSubscriptionPayment" ADD COLUMN IF NOT EXISTS "receiptData" TEXT;
ALTER TABLE "TenantSubscriptionPayment" ADD COLUMN IF NOT EXISTS "receiptMimeType" TEXT;
ALTER TABLE "TenantSubscriptionPayment" ADD COLUMN IF NOT EXISTS "receiptSize" INTEGER;
ALTER TABLE "TenantSubscriptionPayment" ADD COLUMN IF NOT EXISTS "receiptPublicId" TEXT;
ALTER TABLE "TenantSubscriptionPayment" ADD COLUMN IF NOT EXISTS "receiptChecksum" TEXT;
ALTER TABLE "TenantSubscriptionPayment" ADD COLUMN IF NOT EXISTS "uploadedAt" TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "TenantSubscriptionPayment_submittedAt_idx" ON "TenantSubscriptionPayment"("submittedAt");

-- Annotate existing rows where ephemeral disk file was lost before persistence fix
UPDATE "TenantSubscriptionPayment"
SET "notes" = COALESCE("notes" || ' | ', '') || 'File expired before persistence fix - needs re-upload'
WHERE ("receiptUrl" LIKE '%/uploads/%' OR "receiptUrl" LIKE '%proof_%')
  AND "receiptData" IS NULL
  AND ("notes" IS NULL OR "notes" NOT LIKE '%File expired before persistence fix%');

