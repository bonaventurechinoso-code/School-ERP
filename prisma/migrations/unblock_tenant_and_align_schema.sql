ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slug" TEXT;

ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN DEFAULT false;

-- Unblock Egede immediately per step 4
UPDATE "Tenant"
SET "isSuspended"=false,
    "isActive"=true,
    "status"='ACTIVE',
    "subscriptionStatus"='ACTIVE',
    "suspendedAt"=NULL,
    "suspendedReason"=NULL,
    "trialEndsAt"=NOW() + INTERVAL '365 days',
    "subscriptionExpiresAt"=NOW() + INTERVAL '365 days'
WHERE LOWER("subdomain")='egede' OR LOWER(COALESCE("slug", ''))='egede';

UPDATE "School"
SET "isSuspended"=false,
    "isActive"=true,
    "isBanned"=false,
    "status"='ACTIVE',
    "subscriptionStatus"='ACTIVE',
    "deletedAt"=NULL,
    "trialEndDate"=NOW() + INTERVAL '365 days',
    "subscriptionExpiresAt"=NOW() + INTERVAL '365 days'
WHERE LOWER("subdomain")='egede' OR LOWER("slug")='egede';

