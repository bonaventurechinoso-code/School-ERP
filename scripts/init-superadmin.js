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
  } catch (error) {
    console.warn('[INIT_SUPERADMIN] Non-fatal initialization notice:', error.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

initSuperAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
