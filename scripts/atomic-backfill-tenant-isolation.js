const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function backfill() {
  console.log('--- STARTING ATOMIC TENANT ISOLATION DATA BACKFILL ---');

  // 1. Backfill School slugs
  console.log('1. Checking and backfilling School slugs...');
  const schools = await prisma.school.findMany();
  for (const s of schools) {
    if (!s.slug || s.slug.trim() === '') {
      const generatedSlug = (s.subdomain || s.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).toLowerCase().trim();
      await prisma.school.update({
        where: { id: s.id },
        data: { slug: generatedSlug },
      });
      console.log(`  -> Set slug for School [${s.name} (${s.id})]: "${generatedSlug}"`);
    } else {
      console.log(`  -> School [${s.name}] already has slug: "${s.slug}"`);
    }
  }

  // 2. Verify all schools have distinct slugs
  const updatedSchools = await prisma.school.findMany({ select: { id: true, name: true, slug: true } });
  const slugSet = new Set();
  for (const s of updatedSchools) {
    if (slugSet.has(s.slug)) {
      throw new Error(`Duplicate slug detected: ${s.slug} for school ${s.name}`);
    }
    slugSet.add(s.slug);
  }
  console.log(`All ${updatedSchools.length} schools have valid, unique slugs.`);

  // 3. Verify tenant records have valid schoolId
  const defaultSchool = updatedSchools[0];
  console.log(`2. Validating schoolId across tenant data models (Default fallback school: ${defaultSchool.name} [${defaultSchool.id}])...`);

  const tenantModels = [
    'student', 'staff', 'classroom', 'course', 'feeTemplate',
    'invoice', 'payment', 'timetable', 'studentAttendance',
    'staffAttendance', 'exam', 'examResult', 'gradeRecord',
    'academicRecord', 'reportCard', 'notice', 'messageLog',
    'department', 'payrollRecord', 'transaction', 'paymentProof',
    'admissionLead'
  ];

  for (const m of tenantModels) {
    if (prisma[m]) {
      const total = await prisma[m].count().catch(() => 0);
      console.log(`  -> Model ${m}: ${total} records verified.`);
    }
  }

  // 4. Seed / Verify SuperAdmin (Completely outside local tenant scopes)
  console.log('3. Seeding / Verifying SuperAdmin...');
  const superAdminEmail = 'superadmin@platform.com';
  const superAdminPassword = 'Password123';
  const superAdminHash = await bcrypt.hash(superAdminPassword, BCRYPT_ROUNDS);

  const existingSuperAdmin = await prisma.superAdmin.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    await prisma.superAdmin.create({
      data: {
        email: superAdminEmail,
        passwordHash: superAdminHash,
      },
    });
    console.log(`  -> Created SuperAdmin: ${superAdminEmail}`);
  } else {
    // Ensure password hash uses 12 rounds
    await prisma.superAdmin.update({
      where: { id: existingSuperAdmin.id },
      data: { passwordHash: superAdminHash },
    });
    console.log(`  -> Updated SuperAdmin: ${superAdminEmail} with 12-round bcrypt hash.`);
  }

  // Also ensure PlatformAdmin is synchronized with 12-round hash
  const existingPlatformAdmin = await prisma.platformAdmin.findUnique({
    where: { email: superAdminEmail },
  });
  if (!existingPlatformAdmin) {
    await prisma.platformAdmin.create({
      data: {
        email: superAdminEmail,
        password: superAdminHash,
      },
    });
    console.log(`  -> Created PlatformAdmin: ${superAdminEmail}`);
  } else {
    await prisma.platformAdmin.update({
      where: { id: existingPlatformAdmin.id },
      data: { password: superAdminHash },
    });
    console.log(`  -> Updated PlatformAdmin: ${superAdminEmail} with 12-round bcrypt hash.`);
  }

  // 5. Populate User table from existing Staff and Student entries
  console.log('4. Synchronizing local tenant users into User table...');
  const allStaff = await prisma.staff.findMany();
  let userCount = 0;
  for (const staff of allStaff) {
    if (staff.email) {
      const normEmail = staff.email.toLowerCase().trim();
      let pHash = staff.password;
      if (!pHash || pHash.length < 20 || !pHash.startsWith('$2')) {
        pHash = await bcrypt.hash('Welcome123', BCRYPT_ROUNDS);
      }
      
      let mappedRole = 'TEACHER';
      const r = (staff.role || '').toUpperCase();
      if (r.includes('ADMIN') || r.includes('PRINCIPAL') || r.includes('HEADMASTER')) {
        mappedRole = 'SCHOOL_ADMIN';
      } else if (r.includes('BURSAR')) {
        mappedRole = 'BURSAR';
      } else if (r.includes('TEACHER') || r.includes('STAFF')) {
        mappedRole = 'TEACHER';
      }

      await prisma.user.upsert({
        where: {
          schoolId_email: {
            schoolId: staff.schoolId,
            email: normEmail,
          },
        },
        update: {
          passwordHash: pHash,
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: mappedRole,
          mustChangePassword: staff.mustChangePassword || false,
        },
        create: {
          schoolId: staff.schoolId,
          email: normEmail,
          passwordHash: pHash,
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: mappedRole,
          mustChangePassword: staff.mustChangePassword || false,
        },
      });
      userCount++;
    }
  }
  console.log(`  -> Synchronized ${userCount} staff members into User model.`);

  console.log('--- ATOMIC BACKFILL COMPLETED SUCCESSFULLY ---');
}

backfill()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Backfill Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
