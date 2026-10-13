-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SUBSCRIPTION', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED');
ALTER TABLE "School" ALTER COLUMN "subscriptionStatus" DROP DEFAULT;
ALTER TABLE "School" ALTER COLUMN "subscriptionStatus" TYPE "SubscriptionStatus_new" USING ("subscriptionStatus"::text::"SubscriptionStatus_new");
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "SubscriptionStatus_old";
ALTER TABLE "School" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_planId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_tenantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Invoice_paystackReference_key";

-- DropIndex
DROP INDEX IF EXISTS "Subscription_planId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Subscription_tenantId_status_idx";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "paystackReference";

-- AlterTable
ALTER TABLE IF EXISTS "PlatformEarnings" DROP COLUMN IF EXISTS "subaccountCode",
ALTER COLUMN "platformFee" SET DEFAULT 0,
ALTER COLUMN "source" SET DEFAULT 'manual';

-- AlterTable
ALTER TABLE "School" DROP COLUMN IF EXISTS "paystackSplitCode",
DROP COLUMN IF EXISTS "paystackSubaccountCode",
ADD COLUMN IF NOT EXISTS "slug" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
ALTER COLUMN "subscriptionPlan" DROP NOT NULL,
ALTER COLUMN "billingCycle" DROP NOT NULL,
ALTER COLUMN "subscriptionStatus" DROP NOT NULL,
ALTER COLUMN "subscriptionStatus" SET DEFAULT 'PENDING',
ALTER COLUMN "subscriptionStartedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "amountDue",
DROP COLUMN IF EXISTS "amountPaid",
DROP COLUMN IF EXISTS "endsAt",
DROP COLUMN IF EXISTS "paystackSubscriptionCode",
DROP COLUMN IF EXISTS "planId",
DROP COLUMN IF EXISTS "startsAt",
DROP COLUMN IF EXISTS "tenantId",
DROP COLUMN IF EXISTS "trialEndsAt",
ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'Trial',
ADD COLUMN IF NOT EXISTS "proofOfPaymentUrl" TEXT,
ADD COLUMN IF NOT EXISTS "schoolId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "verifiedByAdmin" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN IF EXISTS "status",
ADD COLUMN "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "paystackSettlementBank",
DROP COLUMN IF EXISTS "paystackSplitCode",
DROP COLUMN IF EXISTS "paystackSubaccountCode";

-- AlterTable
ALTER TABLE "WalletTransaction" DROP COLUMN IF EXISTS "paystackReference",
ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual_transfer',
ADD COLUMN IF NOT EXISTS "settlementStatus" TEXT DEFAULT 'settled';

-- DropTable
DROP TABLE IF EXISTS "bonavee_staff_metadata";

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolPayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "PaymentType" NOT NULL DEFAULT 'SUBSCRIPTION',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolPayment_schoolId_status_idx" ON "SchoolPayment"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_schoolId_status_idx" ON "Subscription"("schoolId", "status");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_schoolId_fkey') THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolPayment_schoolId_fkey') THEN
        ALTER TABLE "SchoolPayment" ADD CONSTRAINT "SchoolPayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
