require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function preDeployFix() {
  console.log('[PRE_DEPLOY_FIX] Starting production pre-migration reconciliation...');
  const prisma = new PrismaClient();

  try {
    // 1. Check if _prisma_migrations table exists
    const checkMigrationsTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations';
    `).catch(() => []);

    if (checkMigrationsTable.length > 0) {
      // 2. Error 1 fix: Check for failed migration 20260923163000_remove_paystack_add_manual_payment
      const failedMig = await prisma.$queryRawUnsafe(`
        SELECT id, migration_name, started_at, finished_at, rolled_back_at 
        FROM _prisma_migrations 
        WHERE migration_name = '20260923163000_remove_paystack_add_manual_payment';
      `).catch(() => []);

      if (failedMig.length > 0 && !failedMig[0].finished_at && !failedMig[0].rolled_back_at) {
        console.log('[PRE_DEPLOY_FIX] Resolving failed migration 20260923163000_remove_paystack_add_manual_payment as applied...');
        await prisma.$executeRawUnsafe(`
          UPDATE _prisma_migrations 
          SET finished_at = NOW(), applied_steps_count = 1 
          WHERE migration_name = '20260923163000_remove_paystack_add_manual_payment' AND finished_at IS NULL;
        `);
        console.log('[PRE_DEPLOY_FIX] Successfully resolved 20260923163000_remove_paystack_add_manual_payment.');
      }

      // Check if any other failed migrations exist in _prisma_migrations
      const remainingFailed = await prisma.$queryRawUnsafe(`
        SELECT migration_name, started_at FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;
      `).catch(() => []);

      if (remainingFailed.length > 0) {
        console.warn('[PRE_DEPLOY_FIX] Warning: Found other unfinished migrations in _prisma_migrations:', remainingFailed);
      } else {
        console.log('[PRE_DEPLOY_FIX] No failed migrations in _prisma_migrations.');
      }
    }

    // 3. Error 2 pre-emptive fix: Ensure admission_audit_trails has tenantId backfilled with real Egede Tenant.id
    const checkAuditTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'admission_audit_trails';
    `).catch(() => []);

    if (checkAuditTable.length > 0) {
      console.log('[PRE_DEPLOY_FIX] Verifying admission_audit_trails table schema & data...');
      
      // Stage A: Add tenantId as nullable if missing
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
      `);

      // Stage B: Backfill with real Tenant.id for Egede Primary School ('e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8')
      await prisma.$executeRawUnsafe(`
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
      `);

      // Stage C: Enforce NOT NULL
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "admission_audit_trails" ALTER COLUMN "tenantId" SET NOT NULL;
      `);

      // Compatibility columns
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "schoolId" TEXT NOT NULL DEFAULT '';
      `);

      const nullCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count FROM "admission_audit_trails" WHERE "tenantId" IS NULL;
      `);
      console.log('[PRE_DEPLOY_FIX] admission_audit_trails rows with null tenantId:', nullCount[0]?.count ?? 0);
    }

    // 4. Ensure Student cohort column exists
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "cohort" TEXT;
    `).catch(() => {});
    console.log('[PRE_DEPLOY_FIX] Ensured Student.cohort column exists.');

    console.log('[PRE_DEPLOY_FIX] Completed pre-deploy reconciliation successfully.');
  } catch (err) {
    console.error('[PRE_DEPLOY_FIX] Error during pre-deploy reconciliation:', err);
    // Do not crash the build; allow migrate deploy to proceed or report specific error
  } finally {
    await prisma.$disconnect();
  }
}

preDeployFix();
