-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "planTier" TEXT,
ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tenant_isDemo_idx" ON "Tenant"("isDemo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tenant_isTrial_idx" ON "Tenant"("isTrial");
