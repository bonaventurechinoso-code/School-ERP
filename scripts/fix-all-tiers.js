require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function fixAllTiers() {
  const p = new PrismaClient();
  try {
    console.log('[FIX_ALL_TIERS] Starting database tier validation...');
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
