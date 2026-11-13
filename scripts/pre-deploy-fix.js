require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function preDeployFix() {
  console.log('[PRE_DEPLOY_FIX] Checking runtime database state...');

  // Runtime check: If DATABASE_URL is not set, fail loudly with exit(1)
  if (!process.env.DATABASE_URL) {
    console.error('[PRE_DEPLOY_FIX] DATABASE_URL missing, cannot fix DB, exiting 1');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // 1. Check if _prisma_migrations table exists
    const checkMigrationsTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = '_prisma_migrations' 
        AND table_schema = current_schema();
    `).catch(() => []);

    if (!checkMigrationsTable || checkMigrationsTable.length === 0) {
      console.log('[PRE_DEPLOY_FIX] Table _prisma_migrations does not exist yet. Passing to prisma migrate deploy.');
      process.exit(0);
    }

    // 2. Check for migration 20260923163000_remove_paystack_add_manual_payment
    const migRows = await prisma.$queryRawUnsafe(`
      SELECT id, migration_name, started_at, finished_at, rolled_back_at 
      FROM _prisma_migrations 
      WHERE migration_name = '20260923163000_remove_paystack_add_manual_payment';
    `).catch((err) => {
      console.error('[PRE_DEPLOY_FIX] Failed to query _prisma_migrations:', err);
      process.exit(1);
    });

    if (migRows.length > 0) {
      const row = migRows[0];
      // Idempotency check: If finished_at IS NOT NULL, SKIP! Do not resolve twice.
      if (row.finished_at !== null) {
        console.log(`[PRE_DEPLOY_FIX] Already finished at ${row.finished_at}, skipping resolve`);
      } else {
        console.log('[PRE_DEPLOY_FIX] Migration 20260923163000_remove_paystack_add_manual_payment started but unfinished (finished_at IS NULL). Running prisma migrate resolve via child_process...');
        try {
          execSync('npx prisma migrate resolve --applied "20260923163000_remove_paystack_add_manual_payment"', {
            stdio: 'inherit',
          });
          console.log('[PRE_DEPLOY_FIX] Successfully resolved migration via prisma CLI.');
        } catch (resolveErr) {
          console.error('[PRE_DEPLOY_FIX] prisma migrate resolve command failed:', resolveErr);
          process.exit(1);
        }
      }
    } else {
      console.log('[PRE_DEPLOY_FIX] Migration 20260923163000_remove_paystack_add_manual_payment not found in _prisma_migrations table.');
    }

    // 3. Pre-migration check for admission_audit_trails table (prevent P3009 / Error 2)
    const checkAuditTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'admission_audit_trails';
    `).catch((err) => {
      console.error('[PRE_DEPLOY_FIX] Failed checking admission_audit_trails table:', err);
      process.exit(1);
    });

    if (checkAuditTable.length > 0) {
      // Ensure nullable tenantId column exists and backfill if any nulls exist
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
      `);

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

      // Verification: COUNT(*) of NULL tenantId must be 0
      const nullCheck = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count FROM "admission_audit_trails" WHERE "tenantId" IS NULL;
      `);
      const nullCount = nullCheck[0]?.count ?? 0;
      if (nullCount !== 0) {
        console.error(`[PRE_DEPLOY_FIX] Verification failed: ${nullCount} rows in admission_audit_trails still have NULL tenantId, exiting 1`);
        process.exit(1);
      }
      console.log('[PRE_DEPLOY_FIX] admission_audit_trails tenantId backfilled and verified (0 NULLs).');
    }

    console.log('[PRE_DEPLOY_FIX] Pre-deploy fix complete. Exiting 0.');
  } catch (err) {
    console.error('[PRE_DEPLOY_FIX] Fatal error during preDeployFix:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

preDeployFix();
