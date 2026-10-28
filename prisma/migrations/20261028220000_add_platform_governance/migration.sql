-- CreateEnum (Safe Idempotent Additive)
DO $$ BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING_VERIFICATION', 'GRACE_PERIOD', 'PENDING_PURGE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InstitutionTier" AS ENUM ('CRECHE', 'NURSERY', 'PRIMARY', 'SECONDARY', 'POLYTECHNIC', 'COLLEGE_OF_ED', 'UNIVERSITY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable "Tenant" (Safe Additive Columns Only)
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "tier" "InstitutionTier" NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN IF NOT EXISTS "statusReason" TEXT,
  ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxStorageBytes" BIGINT NOT NULL DEFAULT 53687091200,
  ADD COLUMN IF NOT EXISTS "maxStudents" INTEGER NOT NULL DEFAULT 500;

-- CreateTable "TenantCampus"
CREATE TABLE IF NOT EXISTS "TenantCampus" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "state" TEXT,
  CONSTRAINT "TenantCampus_pkey" PRIMARY KEY ("id")
);

-- CreateTable "PlatformAuditTrail"
CREATE TABLE IF NOT EXISTS "PlatformAuditTrail" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "actorId" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable "GlobalFeatureFlag"
CREATE TABLE IF NOT EXISTS "GlobalFeatureFlag" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GlobalFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable "TenantFeatureFlag"
CREATE TABLE IF NOT EXISTS "TenantFeatureFlag" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "flagKey" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "TenantCampus_tenantId_idx" ON "TenantCampus"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformAuditTrail_action_tenantId_idx" ON "PlatformAuditTrail"("action", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "GlobalFeatureFlag_key_key" ON "GlobalFeatureFlag"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeatureFlag_tenantId_flagKey_key" ON "TenantFeatureFlag"("tenantId", "flagKey");
CREATE INDEX IF NOT EXISTS "TenantFeatureFlag_tenantId_idx" ON "TenantFeatureFlag"("tenantId");

-- AddForeignKeys (Idempotent)
DO $$ BEGIN
  ALTER TABLE "TenantCampus"
    ADD CONSTRAINT "TenantCampus_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformAuditTrail"
    ADD CONSTRAINT "PlatformAuditTrail_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TenantFeatureFlag"
    ADD CONSTRAINT "TenantFeatureFlag_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

