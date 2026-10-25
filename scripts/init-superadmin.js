require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function initSuperAdmin() {
  if (!process.env.DATABASE_URL) {
    console.log('[INIT_SUPERADMIN] No DATABASE_URL detected in environment, skipping initialization.');
    return;
  }

  const prisma = new PrismaClient();
  const targetEmail = 'bonaventure.chinoso@gmail.com';
  const targetPassword = 'Password1234';

  try {
    const platAdmin = await prisma.platformAdmin.findUnique({ where: { email: targetEmail } });
    const supAdmin = await prisma.superAdmin.findUnique({ where: { email: targetEmail } });

    let paMatches = false;
    if (platAdmin && platAdmin.password) {
      paMatches = await bcrypt.compare(targetPassword, platAdmin.password).catch(() => false);
    }

    let saMatches = false;
    if (supAdmin && supAdmin.passwordHash) {
      saMatches = await bcrypt.compare(targetPassword, supAdmin.passwordHash).catch(() => false);
    }

    if (!platAdmin || !supAdmin || !paMatches || !saMatches) {
      const hash = await bcrypt.hash(targetPassword, 12);

      await prisma.platformAdmin.upsert({
        where: { email: targetEmail },
        update: { password: hash, updatedAt: new Date() },
        create: {
          email: targetEmail,
          password: hash,
          twoFactorEnabled: false,
        },
      });

      await prisma.superAdmin.upsert({
        where: { email: targetEmail },
        update: { passwordHash: hash, updatedAt: new Date() },
        create: {
          email: targetEmail,
          passwordHash: hash,
        },
      });

      console.log('[INIT_SUPERADMIN] Super Admin account synchronized with 12-round bcrypt hash.');
    } else {
      console.log('[INIT_SUPERADMIN] Super Admin account verified and up-to-date.');
    }

    console.log('[INIT_SUPERADMIN] Ensuring payment_receipts table exists...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "payment_receipts" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenant_id" TEXT NOT NULL,
        "school_id" TEXT,
        "module_type" TEXT NOT NULL,
        "payer_type" TEXT NOT NULL,
        "payer_id" TEXT,
        "payer_name" TEXT NOT NULL,
        "reference_no" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "payment_method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
        "txn_ref" TEXT,
        "bank_name" TEXT,
        "file_url" TEXT NOT NULL,
        "file_key" TEXT,
        "file_name" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "verified_by" TEXT,
        "verified_at" TIMESTAMP(3),
        "rejection_reason" TEXT,
        "linked_invoice_id" TEXT,
        "term" TEXT,
        "session" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => console.warn('[INIT_PAYMENT_RECEIPTS] Table creation notice:', err.message));

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "payment_receipts_tenant_id_status_idx" ON "payment_receipts"("tenant_id", "status");
      CREATE INDEX IF NOT EXISTS "payment_receipts_module_type_status_idx" ON "payment_receipts"("module_type", "status");
      CREATE INDEX IF NOT EXISTS "payment_receipts_reference_no_idx" ON "payment_receipts"("reference_no");
    `).catch(() => {});

    console.log('[INIT_SUPERADMIN] Ensuring payment_settings table exists...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "payment_settings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenant_id" TEXT NOT NULL,
        "school_id" TEXT,
        "module_type" TEXT NOT NULL,
        "is_enabled" BOOLEAN NOT NULL DEFAULT false,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "title" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT 'NGN',
        "custom_writeup" TEXT,
        "account_name" TEXT,
        "account_number" TEXT,
        "bank_name" TEXT,
        "class_id" TEXT,
        "term" TEXT,
        "session" TEXT,
        "updated_by" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => console.warn('[INIT_PAYMENT_SETTINGS] Table creation notice:', err.message));

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "payment_settings_tenant_id_module_type_class_id_term_key" ON "payment_settings"("tenant_id", "module_type", "class_id", "term");
      CREATE INDEX IF NOT EXISTS "payment_settings_tenant_id_is_enabled_idx" ON "payment_settings"("tenant_id", "is_enabled");
    `).catch(() => {});
  } catch (error) {
    console.warn('[INIT_SUPERADMIN] Non-fatal initialization notice:', error.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

initSuperAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
