-- CreateEnum SchoolTier (Safe Idempotent)
DO $$ BEGIN
  CREATE TYPE "SchoolTier" AS ENUM ('CRECHE', 'PRIMARY', 'SECONDARY', 'TERTIARY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum TertiaryType (Safe Idempotent)
DO $$ BEGIN
  CREATE TYPE "TertiaryType" AS ENUM ('UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_ED', 'INNOVATION_ENTERPRISE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum AdmissionTierType (Safe Idempotent)
DO $$ BEGIN
  CREATE TYPE "AdmissionTierType" AS ENUM ('NURSERY', 'PRIMARY', 'SECONDARY', 'TERTIARY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable "School" (Safe Additive Columns)
DO $$ BEGIN
  ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tier" "SchoolTier" NOT NULL DEFAULT 'TERTIARY';
EXCEPTION
  WHEN others THEN
    BEGIN
      ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'TERTIARY';
    EXCEPTION
      WHEN others THEN null;
    END;
END $$;

DO $$ BEGIN
  ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tertiaryType" "TertiaryType" DEFAULT 'UNIVERSITY';
EXCEPTION
  WHEN others THEN
    BEGIN
      ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tertiaryType" TEXT DEFAULT 'UNIVERSITY';
    EXCEPTION
      WHEN others THEN null;
    END;
END $$;

-- AlterTable "Tenant" (Safe Additive Column)
DO $$ BEGIN
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tier" "SchoolTier" NOT NULL DEFAULT 'TERTIARY';
EXCEPTION
  WHEN others THEN
    BEGIN
      ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'TERTIARY';
    EXCEPTION
      WHEN others THEN null;
    END;
END $$;

-- AlterTable "AdmissionRegister" (Safe Additive Column)
DO $$ BEGIN
  ALTER TABLE "AdmissionRegister" ADD COLUMN IF NOT EXISTS "tier" "SchoolTier";
EXCEPTION
  WHEN others THEN
    BEGIN
      ALTER TABLE "AdmissionRegister" ADD COLUMN IF NOT EXISTS "tier" TEXT;
    EXCEPTION
      WHEN others THEN null;
    END;
END $$;

-- AlterTable "ApplicationFormTemplate" (Safe Additive Column)
DO $$ BEGIN
  ALTER TABLE "ApplicationFormTemplate" ADD COLUMN IF NOT EXISTS "tier" "SchoolTier" NOT NULL DEFAULT 'TERTIARY';
EXCEPTION
  WHEN others THEN
    BEGIN
      ALTER TABLE "ApplicationFormTemplate" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'TERTIARY';
    EXCEPTION
      WHEN others THEN null;
    END;
END $$;
