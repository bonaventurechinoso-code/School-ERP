require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function fixAllTiers() {
  const p = new PrismaClient();
  try {
    console.log('[FIX_ALL_TIERS] Starting database tier schema validation...');

    // 0. Ensure enums and columns exist in database before running Prisma model queries
    const ddlStatements = [
      `DO $$ BEGIN
        CREATE TYPE "SchoolTier" AS ENUM ('CRECHE', 'PRIMARY', 'SECONDARY', 'TERTIARY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "TertiaryType" AS ENUM ('UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_ED', 'INNOVATION_ENTERPRISE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "AdmissionTierType" AS ENUM ('NURSERY', 'PRIMARY', 'SECONDARY', 'TERTIARY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tier" "SchoolTier" NOT NULL DEFAULT 'TERTIARY';
      EXCEPTION
        WHEN others THEN
          BEGIN
            ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'TERTIARY';
          EXCEPTION
            WHEN others THEN null;
          END;
      END $$;`,

      `DO $$ BEGIN
        ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tertiaryType" "TertiaryType" DEFAULT 'UNIVERSITY';
      EXCEPTION
        WHEN others THEN
          BEGIN
            ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "tertiaryType" TEXT DEFAULT 'UNIVERSITY';
          EXCEPTION
            WHEN others THEN null;
          END;
      END $$;`,

      `DO $$ BEGIN
        ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tier" "SchoolTier" NOT NULL DEFAULT 'TERTIARY';
      EXCEPTION
        WHEN others THEN
          BEGIN
            ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'TERTIARY';
          EXCEPTION
            WHEN others THEN null;
          END;
      END $$;`
    ];

    for (const stmt of ddlStatements) {
      try {
        await p.$executeRawUnsafe(stmt);
      } catch (ddlErr) {
        console.warn('[FIX_ALL_TIERS] DDL statement notice:', ddlErr.message);
      }
    }

    console.log('[FIX_ALL_TIERS] Querying schools for tier validation...');
    const all = await p.school.findMany();
    const valid = ['CRECHE', 'PRIMARY', 'SECONDARY', 'TERTIARY'];
    for (const s of all) {
      const name = (s.name || '').toLowerCase();
      const domain = (s.subdomain || s.slug || '').toLowerCase();
      let newTier = s.tier;

      if (!s.tier || !valid.includes(s.tier)) {
        if (name.includes('creche') || name.includes('daycare') || name.includes('crèche')) {
          newTier = 'CRECHE';
        } else if (
          name.includes('primary') ||
          name.includes('basic') ||
          name.includes('nursery') ||
          name.includes('egede') ||
          name.includes('bite') ||
          domain.includes('primary') ||
          domain.includes('egede')
        ) {
          newTier = 'PRIMARY';
        } else if (name.includes('secondary') || domain.includes('secondary')) {
          newTier = 'SECONDARY';
        } else {
          newTier = 'TERTIARY';
        }

        await p.school.update({
          where: { id: s.id },
          data: { tier: newTier },
        });
        console.log(`[FIX_ALL_TIERS] FIXED ${s.name} (${s.subdomain}) -> ${newTier}`);
      }
    }

    // Also sanitize tenant table if applicable
    try {
      const tenants = await p.tenant.findMany();
      for (const t of tenants) {
        if (!t.tier || !valid.includes(t.tier)) {
          await p.tenant.update({ where: { id: t.id }, data: { tier: 'TERTIARY' } });
          console.log(`[FIX_ALL_TIERS] FIXED tenant: ${t.id} -> TERTIARY`);
        }
      }
    } catch (_) {}

    console.log('[FIX_ALL_TIERS] DONE fixing all tenants');
  } catch (err) {
    console.warn('[FIX_ALL_TIERS] Non-fatal error during tier sync:', err.message);
  } finally {
    await p.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  fixAllTiers().then(() => process.exit(0)).catch((err) => {
    console.error('[FIX_ALL_TIERS] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { fixAllTiers };
