require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function fixDatabase(connectionUrl, dbLabel) {
  console.log(`[PRE_DEPLOY_FIX] Checking runtime database state for ${dbLabel}...`);

  if (!connectionUrl) {
    console.log(`[PRE_DEPLOY_FIX] ${dbLabel} is not set. Skipping.`);
    return;
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: connectionUrl } },
  });

  try {
    // 1. Check if _prisma_migrations table exists
    const checkMigrationsTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = '_prisma_migrations' 
        AND table_schema = current_schema();
    `).catch(() => []);

    if (!checkMigrationsTable || checkMigrationsTable.length === 0) {
      console.log(`[PRE_DEPLOY_FIX] Table _prisma_migrations does not exist yet in ${dbLabel}. Passing to prisma migrate deploy.`);
      return;
    }

    // 2. Check for migration 20260923163000_remove_paystack_add_manual_payment
    const migRows = await prisma.$queryRawUnsafe(`
      SELECT id, migration_name, started_at, finished_at, rolled_back_at 
      FROM _prisma_migrations 
      WHERE migration_name = '20260923163000_remove_paystack_add_manual_payment';
    `).catch((err) => {
      console.error(`[PRE_DEPLOY_FIX] Failed to query _prisma_migrations in ${dbLabel}:`, err.message);
      return [];
    });

    if (migRows.length > 0) {
      const row = migRows[0];
      if (row.finished_at !== null) {
        console.log(`[PRE_DEPLOY_FIX] [${dbLabel}] Already finished at ${row.finished_at}, skipping resolve`);
      } else {
        console.log(`[PRE_DEPLOY_FIX] [${dbLabel}] Migration 20260923163000_remove_paystack_add_manual_payment started but unfinished. Resolving via CLI...`);
        try {
          execSync('npx prisma migrate resolve --applied "20260923163000_remove_paystack_add_manual_payment"', {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: connectionUrl },
          });
          console.log(`[PRE_DEPLOY_FIX] [${dbLabel}] Successfully resolved migration via prisma CLI.`);
        } catch (resolveErr) {
          console.error(`[PRE_DEPLOY_FIX] [${dbLabel}] prisma migrate resolve command failed:`, resolveErr.message);
        }
      }
    }

    // 3. Pre-migration check for admission_audit_trails table (prevent P3009 / Error 2)
    const checkAuditTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'admission_audit_trails';
    `).catch(() => []);

    if (checkAuditTable.length > 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "admission_audit_trails" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
      `).catch(() => {});

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
      `).catch(() => {});
    }

    console.log(`[PRE_DEPLOY_FIX] [${dbLabel}] Checks complete.`);
  } catch (err) {
    console.warn(`[PRE_DEPLOY_FIX] [${dbLabel}] Non-fatal check warning:`, err.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function runPreDeploy() {
  if (!process.env.DATABASE_URL) {
    console.error('[PRE_DEPLOY_FIX] DATABASE_URL missing, exiting 1');
    process.exit(1);
  }

  // 1. Fix and migrate primary DATABASE_URL
  await fixDatabase(process.env.DATABASE_URL, 'DATABASE_URL (Production)');
  try {
    console.log('[PRE_DEPLOY_FIX] Running prisma migrate deploy for DATABASE_URL...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    console.log('[PRE_DEPLOY_FIX] Successfully migrated DATABASE_URL.');
  } catch (err) {
    console.error('[PRE_DEPLOY_FIX] Failed migrating DATABASE_URL:', err.message);
    process.exit(1);
  }

  // 2. Fix and migrate DEMO_DATABASE_URL (if configured)
  if (process.env.DEMO_DATABASE_URL) {
    await fixDatabase(process.env.DEMO_DATABASE_URL, 'DEMO_DATABASE_URL (Demo Playground)');
    try {
      console.log('[PRE_DEPLOY_FIX] Running prisma migrate deploy for DEMO_DATABASE_URL...');
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DEMO_DATABASE_URL },
      });
      console.log('[PRE_DEPLOY_FIX] Successfully migrated DEMO_DATABASE_URL.');
    } catch (err) {
      console.error('[PRE_DEPLOY_FIX] Failed migrating DEMO_DATABASE_URL:', err.message);
      process.exit(1);
    }
  }

  console.log('[PRE_DEPLOY_FIX] All database migrations completed successfully. Exiting 0.');
  process.exit(0);
}

runPreDeploy();
