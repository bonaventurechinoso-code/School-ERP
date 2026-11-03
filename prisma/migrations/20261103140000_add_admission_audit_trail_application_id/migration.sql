-- AlterTable "admission_audit_trails" (Safe Additive Columns for AdmissionsApplication linkage)
DO $$ BEGIN
  ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "school_id" TEXT NOT NULL DEFAULT '';
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "applicationId" TEXT;
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "admission_audit_trails" ALTER COLUMN "register_id" DROP NOT NULL;
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "admission_audit_trails" ALTER COLUMN "actor_id" DROP NOT NULL;
EXCEPTION
  WHEN others THEN null;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_audit_trails_tenant_id_school_id_applicationId_idx" ON "admission_audit_trails"("tenant_id", "school_id", "applicationId");
CREATE INDEX IF NOT EXISTS "admission_audit_trails_applicationId_created_at_idx" ON "admission_audit_trails"("applicationId", "created_at");

-- AddForeignKey (Safe)
DO $$ BEGIN
  ALTER TABLE "admission_audit_trails" ADD CONSTRAINT "admission_audit_trails_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionsApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;
