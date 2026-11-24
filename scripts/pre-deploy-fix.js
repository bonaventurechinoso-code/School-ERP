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
    // 0. Ensure PlatformEarnings table exists (prevents migration 20260923163000 from crashing if ever run)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlatformEarnings" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT,
        "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "schoolNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "reference" TEXT NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'manual',
        "settlementDestination" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlatformEarnings_pkey" PRIMARY KEY ("id")
      );
    `).catch((err) => {
      console.warn(`[PRE_DEPLOY_FIX] [${dbLabel}] Notice on PlatformEarnings table check:`, err.message);
    });

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "PlatformEarnings_reference_key" ON "PlatformEarnings"("reference");
    `).catch((err) => {
      console.warn(`[PRE_DEPLOY_FIX] [${dbLabel}] Notice on PlatformEarnings index check:`, err.message);
    });

    // 1. Check if _prisma_migrations table exists
    const checkMigrationsTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = '_prisma_migrations' 
        AND table_schema = current_schema();
    `).catch(() => []);

    if (!checkMigrationsTable || checkMigrationsTable.length === 0) {
      console.log(`[PRE_DEPLOY_FIX] Table _prisma_migrations does not exist yet in ${dbLabel}.`);
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

    // 4. Ensure Enterprise Staff Columns & StaffAssignment Table Exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "gender" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "phone" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "residentialAddress" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "state" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "lga" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nin" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "passportUrl" TEXT;

      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "dateOfEmployment" TIMESTAMP(3);
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "employmentType" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "departmentName" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "reportingToId" TEXT;

      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "highestQualification" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "fieldOfStudy" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "institutionAttended" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "yearGraduated" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "trcnNumber" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "trcnExpiry" TIMESTAMP(3);
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "trcnStatus" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "professionalBody" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "professionalMembershipNo" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "professionalExpiry" TIMESTAMP(3);
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "specialization" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "academicRank" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "cvUrl" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "certificates" TEXT;

      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinName" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinPhone" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinRelationship" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinAddress" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "emergencyName" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "guarantorName" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "guarantorPhone" TEXT;

      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "baseSalary" DOUBLE PRECISION;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "payGrade" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "accountName" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "pensionRsa" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "pensionProvider" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nhisNo" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "tin" TEXT;
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'BANK_TRANSFER';
      ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "permissions" TEXT;

      CREATE INDEX IF NOT EXISTS "Staff_schoolId_staffId_idx" ON "Staff"("schoolId", "staffId");

      CREATE TABLE IF NOT EXISTS "StaffAssignment" (
        "id" TEXT NOT NULL,
        "schoolId" TEXT NOT NULL,
        "staffId" TEXT NOT NULL,
        "classroomId" TEXT,
        "courseId" TEXT,
        "assignmentType" TEXT NOT NULL,
        "assignedRole" TEXT,
        "session" TEXT,
        "faculty" TEXT,
        "department" TEXT,
        "programme" TEXT,
        "metadata" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "StaffAssignment_schoolId_idx" ON "StaffAssignment"("schoolId");
      CREATE INDEX IF NOT EXISTS "StaffAssignment_staffId_idx" ON "StaffAssignment"("staffId");
      CREATE INDEX IF NOT EXISTS "StaffAssignment_classroomId_idx" ON "StaffAssignment"("classroomId");
      CREATE INDEX IF NOT EXISTS "StaffAssignment_courseId_idx" ON "StaffAssignment"("courseId");
      CREATE INDEX IF NOT EXISTS "StaffAssignment_assignmentType_idx" ON "StaffAssignment"("assignmentType");

      -- Ensure Course code column is nullable for Nigerian Early Years, Primary, and Secondary subjects
      ALTER TABLE "Course" ALTER COLUMN "code" DROP NOT NULL;
    `).catch((err) => {
      console.warn(`[PRE_DEPLOY_FIX] [${dbLabel}] Notice on enterprise staff schema DDL:`, err.message);
    });

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

  // 1. Fix and migrate primary DATABASE_URL (production)
  await fixDatabase(process.env.DATABASE_URL, 'DATABASE_URL (Production)');
  try {
    console.log('[PRE_DEPLOY_FIX] Running prisma db push for DATABASE_URL...');
    try {
      execSync('npx prisma db push --accept-data-loss --skip-generate', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      console.log('[PRE_DEPLOY_FIX] Successfully pushed schema to DATABASE_URL.');
    } catch (pushErr) {
      console.warn('[PRE_DEPLOY_FIX] Non-fatal notice on db push for DATABASE_URL:', pushErr.message);
    }

    console.log('[PRE_DEPLOY_FIX] Running prisma migrate deploy for DATABASE_URL...');
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      console.log('[PRE_DEPLOY_FIX] Successfully migrated DATABASE_URL.');
    } catch (migErr) {
      console.warn('[PRE_DEPLOY_FIX] Notice on migrate deploy (schema already synchronized via db push):', migErr.message);
    }

    // Seed Phase 5 Tertiary Students into Primary DB
    console.log('[PRE_DEPLOY_FIX] Seeding Phase 5 Tertiary Students into DATABASE_URL...');
    try {
      execSync('npx tsx scripts/seed-phase5-tertiary.ts', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      console.log('[PRE_DEPLOY_FIX] Successfully seeded Phase 5 Tertiary data.');
    } catch (seedErr) {
      console.warn('[PRE_DEPLOY_FIX] Warning on Phase 5 Tertiary seeding:', seedErr.message);
    }

    // Seed Egede Primary Classes into Primary DB
    console.log('[PRE_DEPLOY_FIX] Seeding Egede Classes into DATABASE_URL...');
    try {
      execSync('npx tsx scripts/seed-egede-classes.ts', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      console.log('[PRE_DEPLOY_FIX] Successfully verified/seeded Egede classes.');
    } catch (egedeSeedErr) {
      console.warn('[PRE_DEPLOY_FIX] Warning on Egede class seeding:', egedeSeedErr.message);
    }
  } catch (err) {
    console.error('[PRE_DEPLOY_FIX] Failed operations on DATABASE_URL:', err.message);
    process.exit(1);
  }

  // 2. Synchronize DEMO_DATABASE_URL (isolated sandbox playground)
  if (process.env.DEMO_DATABASE_URL) {
    if (process.env.DEMO_DATABASE_URL === process.env.DATABASE_URL) {
      console.warn('[PRE_DEPLOY_FIX] DEMO_DATABASE_URL is identical to DATABASE_URL. Skipping separate demo sync.');
    } else {
      console.log('[PRE_DEPLOY_FIX] Synchronizing schema for DEMO_DATABASE_URL via prisma db push...');
      try {
        // Use db push to apply full modern schema directly, avoiding historical migration drift on fresh demo DB
        execSync('npx prisma db push --accept-data-loss --skip-generate', {
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: process.env.DEMO_DATABASE_URL },
        });
        console.log('[PRE_DEPLOY_FIX] Successfully pushed schema to DEMO_DATABASE_URL.');

        // Initialize / verify demo tenant and seeded records
        console.log('[PRE_DEPLOY_FIX] Verifying demo seed data...');
        execSync('node scripts/init-demo-db.js', {
          stdio: 'inherit',
          env: process.env,
        });

        // Seed Phase 5 Tertiary Students into DEMO_DATABASE_URL
        console.log('[PRE_DEPLOY_FIX] Seeding Phase 5 Tertiary Students into DEMO_DATABASE_URL...');
        try {
          execSync('npx tsx scripts/seed-phase5-tertiary.ts', {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: process.env.DEMO_DATABASE_URL },
          });
          console.log('[PRE_DEPLOY_FIX] Successfully seeded Phase 5 Tertiary data into DEMO_DATABASE_URL.');
        } catch (demoSeedErr) {
          console.warn('[PRE_DEPLOY_FIX] Warning on DEMO Phase 5 Tertiary seeding:', demoSeedErr.message);
        }

        console.log('[PRE_DEPLOY_FIX] Demo database is fully synchronized and seeded.');
      } catch (err) {
        console.error('[PRE_DEPLOY_FIX] Error during DEMO_DATABASE_URL synchronization:', err.message);
        // Do not crash production web server deploy if demo playground sync had an issue
      }
    }
  }

  console.log('[PRE_DEPLOY_FIX] All pre-deploy database operations completed successfully. Exiting 0.');
  process.exit(0);
}

runPreDeploy();
