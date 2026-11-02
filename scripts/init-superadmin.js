require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { fixAllTiers } = require('./fix-all-tiers');

async function initSuperAdmin() {
  if (!process.env.DATABASE_URL) {
    console.log('[INIT_SUPERADMIN] No DATABASE_URL detected in environment, skipping initialization.');
    return;
  }

  try {
    await fixAllTiers();
  } catch (err) {
    console.warn('[INIT_SUPERADMIN] fixAllTiers notice:', err.message);
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

    // Ensure Egede Admin is seeded/healed with Password123#
    try {
      let egedeSchool = await prisma.school.findFirst({
        where: {
          OR: [
            { subdomain: { equals: 'egede', mode: 'insensitive' } },
            { slug: { equals: 'egede', mode: 'insensitive' } },
            { name: { contains: 'egede', mode: 'insensitive' } },
          ],
        },
      });

      if (!egedeSchool) {
        egedeSchool = await prisma.school.create({
          data: {
            name: 'Egede Primary School',
            subdomain: 'egede',
            slug: 'egede',
            tier: 'PRIMARY',
            status: 'ACTIVE',
            isActive: true,
          },
        });
        console.log('[INIT_SUPERADMIN] Created Egede Primary School:', egedeSchool.id);
      } else {
        await prisma.school.update({
          where: { id: egedeSchool.id },
          data: { tier: 'PRIMARY', status: 'ACTIVE', isActive: true, deletedAt: null },
        });
      }

      const egedeHash = await bcrypt.hash('Password123#', 10);
      const existingEgedeUser = await prisma.user.findFirst({
        where: { email: { equals: 'chinonsomabia8@gmail.com', mode: 'insensitive' } },
      });

      if (existingEgedeUser) {
        await prisma.user.update({
          where: { id: existingEgedeUser.id },
          data: {
            email: 'chinonsomabia8@gmail.com',
            schoolId: egedeSchool.id,
            passwordHash: egedeHash,
            status: 'ACTIVE',
            role: 'SCHOOL_ADMIN',
            mustChangePassword: false,
          },
        });
        console.log('[INIT_SUPERADMIN] Egede Admin (chinonsomabia8@gmail.com) verified and synchronized.');
      } else {
        await prisma.user.create({
          data: {
            email: 'chinonsomabia8@gmail.com',
            firstName: 'Egede',
            lastName: 'Admin',
            passwordHash: egedeHash,
            role: 'SCHOOL_ADMIN',
            schoolId: egedeSchool.id,
            status: 'ACTIVE',
            mustChangePassword: false,
          },
        });
        console.log('[INIT_SUPERADMIN] Egede Admin (chinonsomabia8@gmail.com) created and initialized.');
      }
    } catch (egedeErr) {
      console.warn('[INIT_SUPERADMIN] Egede sync notice:', egedeErr.message);
    }

    // Ensure Demo School and Headmaster are seeded/healed with Password123
    try {
      let demoSchool = await prisma.school.findFirst({
        where: {
          OR: [
            { subdomain: { equals: 'demo', mode: 'insensitive' } },
            { slug: { equals: 'demo', mode: 'insensitive' } },
          ],
        },
      });

      if (!demoSchool) {
        demoSchool = await prisma.school.create({
          data: {
            name: 'Demo School',
            subdomain: 'demo',
            slug: 'demo',
            tier: 'TERTIARY',
            status: 'ACTIVE',
            isActive: true,
          },
        });
        console.log('[INIT_SUPERADMIN] Created Demo School:', demoSchool.id);
      } else {
        await prisma.school.update({
          where: { id: demoSchool.id },
          data: { status: 'ACTIVE', isActive: true, deletedAt: null },
        });
      }

      const demoHash = await bcrypt.hash('Password123', 10);
      const existingDemoUser = await prisma.user.findFirst({
        where: {
          email: { equals: 'headmaster@demo.edu.ng', mode: 'insensitive' },
        },
      });

      if (existingDemoUser) {
        await prisma.user.update({
          where: { id: existingDemoUser.id },
          data: {
            schoolId: demoSchool.id,
            passwordHash: demoHash,
            status: 'ACTIVE',
            role: 'PRINCIPAL',
            mustChangePassword: false,
          },
        });
        console.log('[INIT_SUPERADMIN] Demo Headmaster (headmaster@demo.edu.ng) synchronized.');
      } else {
        await prisma.user.create({
          data: {
            email: 'headmaster@demo.edu.ng',
            firstName: 'Demo',
            lastName: 'Headmaster',
            passwordHash: demoHash,
            role: 'PRINCIPAL',
            schoolId: demoSchool.id,
            status: 'ACTIVE',
            mustChangePassword: false,
          },
        });
        console.log('[INIT_SUPERADMIN] Demo Headmaster (headmaster@demo.edu.ng) created.');
      }
    } catch (demoErr) {
      console.warn('[INIT_SUPERADMIN] Demo sync notice:', demoErr.message);
    }

    // Ensure Sandbox / Trial-Sandbox School and Principal are seeded/healed with Password123
    try {
      let sandboxSchool = await prisma.school.findFirst({
        where: {
          OR: [
            { subdomain: { equals: 'sandbox', mode: 'insensitive' } },
            { slug: { equals: 'sandbox', mode: 'insensitive' } },
            { subdomain: { equals: 'trial-sandbox', mode: 'insensitive' } },
            { slug: { equals: 'trial-sandbox', mode: 'insensitive' } },
            { name: { contains: 'sandbox', mode: 'insensitive' } },
          ],
        },
      });

      if (!sandboxSchool) {
        sandboxSchool = await prisma.school.create({
          data: {
            name: 'Trial Sandbox Academy',
            subdomain: 'sandbox',
            slug: 'sandbox',
            tier: 'TERTIARY',
            status: 'ACTIVE',
            isActive: true,
          },
        });
        console.log('[INIT_SUPERADMIN] Created Sandbox School:', sandboxSchool.id);
      } else {
        await prisma.school.update({
          where: { id: sandboxSchool.id },
          data: { status: 'ACTIVE', isActive: true, deletedAt: null },
        });
      }

      const sandboxHash = await bcrypt.hash('Password123', 10);
      const existingSandboxUser = await prisma.user.findFirst({
        where: { email: { equals: 'principal@sandbox.edu.ng', mode: 'insensitive' } },
      });

      if (existingSandboxUser) {
        await prisma.user.update({
          where: { id: existingSandboxUser.id },
          data: {
            email: 'principal@sandbox.edu.ng',
            schoolId: sandboxSchool.id,
            passwordHash: sandboxHash,
            status: 'ACTIVE',
            role: 'PRINCIPAL',
            mustChangePassword: false,
          },
        });
        console.log('[INIT_SUPERADMIN] Sandbox Principal (principal@sandbox.edu.ng) synchronized.');
      } else {
        await prisma.user.create({
          data: {
            email: 'principal@sandbox.edu.ng',
            firstName: 'Sandbox',
            lastName: 'Principal',
            passwordHash: sandboxHash,
            role: 'PRINCIPAL',
            schoolId: sandboxSchool.id,
            status: 'ACTIVE',
            mustChangePassword: false,
          },
        });
        console.log('[INIT_SUPERADMIN] Sandbox Principal (principal@sandbox.edu.ng) created.');
      }
    } catch (sandboxErr) {
      console.warn('[INIT_SUPERADMIN] Sandbox sync notice:', sandboxErr.message);
    }

    // Auto-heal any user records that have blank passwordHash
    try {
      const brokenUsers = await prisma.user.findMany({
        where: {
          passwordHash: '',
        },
      });
      if (brokenUsers.length > 0) {
        const defaultHash = await bcrypt.hash('Password123#', 10);
        for (const u of brokenUsers) {
          await prisma.user.update({
            where: { id: u.id },
            data: { passwordHash: defaultHash, status: 'ACTIVE' },
          });
          console.log(`[INIT_SUPERADMIN] Auto-healed blank passwordHash for user: ${u.email}`);
        }
      }
    } catch (healErr) {
      console.warn('[INIT_SUPERADMIN] Auto-heal notice:', healErr.message);
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

    console.log('[INIT_SUPERADMIN] Ensuring platform_payment_governance & tenant_payment_settings tables exist...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "platform_payment_governance" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "allowed_payment_methods" JSONB NOT NULL DEFAULT '["MANUAL_BANK_TRANSFER", "DIRECT_ONLINE_GATEWAY"]',
        "allow_manual_verification_override" BOOLEAN NOT NULL DEFAULT true,
        "audit_metadata" JSONB,
        "updated_by" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "tenant_payment_settings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenant_id" TEXT NOT NULL UNIQUE,
        "school_id" TEXT,
        "is_manual_transfer_enabled" BOOLEAN NOT NULL DEFAULT true,
        "manual_transfer_instructions" TEXT,
        "bank_accounts" JSONB NOT NULL DEFAULT '[]',
        "supported_online_gateways" JSONB NOT NULL DEFAULT '[]',
        "gateway_credentials_vault_ref" TEXT,
        "auto_expire_unverified_hours" INTEGER NOT NULL DEFAULT 72,
        "updated_by" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    const alterStatements = [
      `ALTER TABLE "tenant_payment_settings" ADD COLUMN IF NOT EXISTS "updated_by" TEXT`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "payment_mode" TEXT NOT NULL DEFAULT 'MANUAL_TRANSFER'`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'SETTLED'`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "proof_of_payment_url" TEXT`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "depositor_name" TEXT`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "transfer_reference" TEXT`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3)`,
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT`,
      `ALTER TABLE "PaymentProof" ADD COLUMN IF NOT EXISTS "payment_mode" TEXT NOT NULL DEFAULT 'MANUAL_TRANSFER'`,
      `ALTER TABLE "PaymentProof" ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'`,
      `ALTER TABLE "PaymentProof" ADD COLUMN IF NOT EXISTS "proof_of_payment_url" TEXT`,
      `ALTER TABLE "PaymentProof" ADD COLUMN IF NOT EXISTS "depositor_name" TEXT`,
      `ALTER TABLE "PaymentProof" ADD COLUMN IF NOT EXISTS "transfer_reference" TEXT`,
      `ALTER TABLE "PaymentProof" ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT`,
      `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "payment_mode" TEXT NOT NULL DEFAULT 'MANUAL_TRANSFER'`,
      `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'`,
      `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "proof_of_payment_url" TEXT`,
      `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "depositor_name" TEXT`,
      `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "transfer_reference" TEXT`,
      `ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT`,
    ];
    for (const stmt of alterStatements) {
      await prisma.$executeRawUnsafe(stmt).catch(() => {});
    }
  } catch (error) {
    console.warn('[INIT_SUPERADMIN] Non-fatal initialization notice:', error.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

initSuperAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
