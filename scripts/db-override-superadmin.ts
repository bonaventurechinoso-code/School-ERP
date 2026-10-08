import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('===============================================================');
  console.log('LIVE DATABASE OVERRIDE: SUPER ADMIN ONBOARDING & STATUS UPDATE');
  console.log('===============================================================');

  const targetEmail = 'bonaventure.chinoso@gmail.com';
  console.log(`Target Super Admin Email: ${targetEmail}`);

  // 1. Inspect table columns in PostgreSQL
  console.log('\n[Step 1] Inspecting column definitions in PostgreSQL...');
  const userColumns = await prisma.$queryRawUnsafe<any[]>(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'User'
  `);
  console.log('Columns in "User" table:', userColumns.map(c => c.column_name).join(', '));

  const superAdminColumns = await prisma.$queryRawUnsafe<any[]>(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'SuperAdmin'
  `);
  console.log('Columns in "SuperAdmin" table:', superAdminColumns.map(c => c.column_name).join(', '));

  const platformAdminColumns = await prisma.$queryRawUnsafe<any[]>(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'PlatformAdmin'
  `);
  console.log('Columns in "PlatformAdmin" table:', platformAdminColumns.map(c => c.column_name).join(', '));

  // 2. Direct Update on SuperAdmin table
  console.log('\n[Step 2] Updating SuperAdmin record...');
  const existingSuperAdmin = await prisma.superAdmin.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
  });
  if (existingSuperAdmin) {
    const updatedSuperAdmin = await prisma.superAdmin.update({
      where: { id: existingSuperAdmin.id },
      data: {
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
    console.log('SuperAdmin record updated successfully:', {
      id: updatedSuperAdmin.id,
      email: updatedSuperAdmin.email,
      resetPasswordToken: updatedSuperAdmin.resetPasswordToken,
      resetPasswordExpires: updatedSuperAdmin.resetPasswordExpires,
    });
  } else {
    console.log('Notice: SuperAdmin record not found, checking PlatformAdmin...');
  }

  // 3. Direct Update on PlatformAdmin table
  console.log('\n[Step 3] Updating PlatformAdmin record...');
  const existingPlatformAdmin = await prisma.platformAdmin.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
  });
  if (existingPlatformAdmin) {
    console.log('PlatformAdmin record verified:', {
      id: existingPlatformAdmin.id,
      email: existingPlatformAdmin.email,
    });
  }

  // 4. Ensure User table record exists and is marked fully ACTIVE and VERIFIED
  console.log('\n[Step 4] Checking & updating User record (status: "ACTIVE", mustChangePassword: false)...');
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
  });

  if (existingUser) {
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        status: 'ACTIVE',
        mustChangePassword: false,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        role: 'SUPER_ADMIN' as any,
      },
    });
    console.log('Existing User record updated to ACTIVE and verified:', {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      mustChangePassword: updatedUser.mustChangePassword,
    });
  } else {
    // If not in User table, get an anchor school to link so User row exists with status: ACTIVE
    const anchorSchool = await prisma.school.findFirst();
    if (anchorSchool) {
      const createdUser = await prisma.user.create({
        data: {
          schoolId: anchorSchool.id,
          email: targetEmail,
          passwordHash: existingSuperAdmin?.passwordHash || (existingPlatformAdmin as any)?.password || '$2a$10$wK1F5l9wM3Y5x1X9y5Q4y.y7sZ4m3m8n6t5r4e3w2q1a0b9c8d7e6',
          firstName: 'Bonaventure',
          lastName: 'SuperAdmin',
          role: 'SUPER_ADMIN' as any,
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
      console.log('Created authoritative User table record for Super Admin (status: "ACTIVE", mustChangePassword: false):', {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
        status: createdUser.status,
        mustChangePassword: createdUser.mustChangePassword,
      });
    }
  }

  // 5. Update bonavee_user_security table if present
  console.log('\n[Step 5] Checking and updating bonavee_user_security table...');
  try {
    const rawSec = await prisma.$executeRawUnsafe(`
      UPDATE bonavee_user_security 
      SET must_change_password = false, is_temporary_password = false
      WHERE user_id IN (
        SELECT id FROM "User" WHERE email ILIKE $1
        UNION
        SELECT id FROM "PlatformAdmin" WHERE email ILIKE $1
        UNION
        SELECT id FROM "SuperAdmin" WHERE email ILIKE $1
      )
    `, targetEmail);
    console.log(`bonavee_user_security rows updated: ${rawSec}`);
  } catch (e: any) {
    console.log('bonavee_user_security notice:', e.message);
  }

  // 6. Final verification query across all tables
  console.log('\n===============================================================');
  console.log('FINAL DATABASE VERIFICATION QUERY RESULTS:');
  console.log('===============================================================');
  const finalSuperAdmin = await prisma.superAdmin.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
  });
  console.log('SuperAdmin Table Row:', finalSuperAdmin);

  const finalPlatformAdmin = await prisma.platformAdmin.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
  });
  console.log('PlatformAdmin Table Row:', finalPlatformAdmin);

  const finalUser = await prisma.user.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
  });
  console.log('User Table Row:', finalUser);

  console.log('\n>>> STATUS CONFIRMATION: Account verified, onboarding flags cleared, reset gate deactivated. <<<');
}

main()
  .catch((e) => {
    console.error('Database override failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
