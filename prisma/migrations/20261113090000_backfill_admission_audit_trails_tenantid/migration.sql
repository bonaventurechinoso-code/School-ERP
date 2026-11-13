-- Stage A: Add tenantId column as nullable if it does not already exist
ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- Stage B: Backfill existing rows using the real Tenant.id for Egede Primary School ('e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_audit_trails' AND column_name = 'tenant_id') THEN
    UPDATE "admission_audit_trails"
    SET "tenantId" = COALESCE("tenant_id", 'e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8')
    WHERE "tenantId" IS NULL;
  ELSE
    UPDATE "admission_audit_trails"
    SET "tenantId" = 'e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8'
    WHERE "tenantId" IS NULL;
  END IF;
END $$;

-- Stage C: Make tenantId required only after all rows are guaranteed non-null
ALTER TABLE "admission_audit_trails" ALTER COLUMN "tenantId" SET NOT NULL;

-- Ensure schoolId compatibility column exists on admission_audit_trails
ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "schoolId" TEXT NOT NULL DEFAULT '';

-- Ensure cohort column exists on Student table
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "cohort" TEXT;

