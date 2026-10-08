import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- Connecting to PostgreSQL via Prisma ---');
  const emails = ['bonaventure.chinoso@gmail.com', 'admin@bonaveeict.com.ng'];

  for (const email of emails) {
    console.log(`\n========================================`);
    console.log(`Processing Super Admin account: ${email}`);
    console.log(`========================================`);

    // 1. PlatformAdmin record inspection and update
    const platAdmin = await prisma.platformAdmin.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    console.log('[PlatformAdmin record]:', platAdmin ? { id: platAdmin.id, email: platAdmin.email } : 'Not found');

    // 2. SuperAdmin record inspection and update
    const supAdmin = await prisma.superAdmin.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    console.log('[SuperAdmin record]:', supAdmin ? { id: supAdmin.id, email: supAdmin.email } : 'Not found');

    if (supAdmin) {
      await prisma.superAdmin.update({
        where: { id: supAdmin.id },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
      console.log('-> SuperAdmin reset tokens cleared.');
    }

    // 3. User records inspection and update
    const users = await prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    console.log(`[User records count]: ${users.length}`);

    if (users.length > 0) {
      for (const u of users) {
        console.log(`User ID: ${u.id}, role: ${u.role}, status: ${u.status}, mustChangePassword: ${u.mustChangePassword}`);
      }

      const updateResult = await prisma.user.updateMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        data: {
          mustChangePassword: false,
          status: 'ACTIVE',
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
      console.log(`-> Force updated ${updateResult.count} User row(s): mustChangePassword=false, status=ACTIVE`);
    }

    // 4. Update bonavee_user_security table if exists
    try {
      const userSecResult = await prisma.$executeRawUnsafe(
        `UPDATE bonavee_user_security SET must_change_password = false, is_temporary_password = false WHERE school_id = 'global-saas' OR user_id IN (SELECT id FROM "User" WHERE email ILIKE $1)`,
        email
      );
      console.log(`-> Updated bonavee_user_security records: ${userSecResult}`);
    } catch (e: any) {
      console.log('-> bonavee_user_security update skipped/notice:', e.message);
    }
  }

  console.log('\n--- Super Admin Reset Status Verified and Cleared ---');
}

main()
  .catch((e) => {
    console.error('Fatal execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
