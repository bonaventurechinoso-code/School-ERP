-- Safe additive migration for Tenant Subscription Payments and Notifications
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT DEFAULT 'ACTIVE';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;

CREATE TABLE IF NOT EXISTS "TenantSubscriptionPayment" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolSlug" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "nipSessionId" TEXT NOT NULL UNIQUE,
  "senderBank" TEXT NOT NULL,
  "receiptUrl" TEXT,
  "accountName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "verifiedAt" TIMESTAMP,
  "verifiedBy" TEXT,
  "subscriptionStart" TIMESTAMP,
  "subscriptionEnd" TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "TenantSubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TenantSubscriptionPayment_status_idx" ON "TenantSubscriptionPayment"("status");
CREATE INDEX IF NOT EXISTS "TenantSubscriptionPayment_tenantId_idx" ON "TenantSubscriptionPayment"("tenantId");

CREATE TABLE IF NOT EXISTS "TenantNotification" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "actionUrl" TEXT,
  CONSTRAINT "TenantNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TenantNotification_tenantId_idx" ON "TenantNotification"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantNotification_isRead_idx" ON "TenantNotification"("isRead");

