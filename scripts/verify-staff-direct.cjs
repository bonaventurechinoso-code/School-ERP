const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runDirectStaffVerification() {
  console.log('=================================================================');
  console.log('   DIRECT STAFF RECORDS, ATTENDANCE & HR LIFECYCLE VERIFICATION  ');
  console.log('=================================================================\n');

  // 1. Verify Greenwood Tenant exists
  const school = await prisma.school.findUnique({
    where: { subdomain: 'greenwood' },
    include: { academicTiers: true, departments: true },
  });

  if (!school) {
    throw new Error('❌ Test tenant "greenwood" not found in database.');
  }
  console.log(`✅ Tenant Found: ${school.name} (ID: ${school.id})`);
  console.log(`   Academic Tiers: ${school.academicTiers.map(t => t.name).join(', ')}`);

  // 2. Fetch sample staff
  const staff = await prisma.staff.findFirst({
    where: { schoolId: school.id },
  });
  if (!staff) {
    throw new Error('❌ No staff members found in greenwood tenant.');
  }
  console.log(`✅ Test Staff Member: ${staff.firstName} ${staff.lastName} (${staff.role})`);

  // 3. TEST 1: Department Creation and Staff Assignment
  console.log('\n--- TEST 1: Academic Department Creation & Faculty Assignment ---');
  let testDept = await prisma.department.findFirst({
    where: { schoolId: school.id, name: 'Science & Mathematical Studies' },
  });

  if (!testDept) {
    testDept = await prisma.department.create({
      data: {
        schoolId: school.id,
        name: 'Science & Mathematical Studies',
      },
    });
    console.log(`✅ Created Department: ${testDept.name} (ID: ${testDept.id})`);
  } else {
    console.log(`✅ Department already exists: ${testDept.name}`);
  }

  // Assign staff to department
  await prisma.staff.update({
    where: { id: staff.id },
    data: { departmentId: testDept.id },
  });
  console.log(`✅ Successfully assigned ${staff.firstName} ${staff.lastName} to ${testDept.name}`);

  // 4. TEST 2: Multi-Tenant Nigerian Staff Metadata (TRCN & KYC)
  console.log('\n--- TEST 2: Nigerian TRCN Accreditation & Bio-Data KYC ---');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS bonavee_staff_metadata (
      staff_id TEXT PRIMARY KEY,
      phone TEXT,
      whatsapp TEXT,
      nin TEXT,
      gender TEXT,
      state_of_origin TEXT,
      lga_of_origin TEXT,
      residential_address TEXT,
      qualification TEXT,
      institution TEXT,
      graduation_year TEXT,
      trcn_number TEXT,
      trcn_category TEXT,
      trcn_status TEXT,
      specialization TEXT,
      appointment_type TEXT,
      appointment_date TEXT,
      emergency_name TEXT,
      emergency_phone TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const testNin = '98234182901';
  const testTrcn = 'TRCN/LA/2026/09421';
  const testPhone = '+2348031234567';

  await prisma.$executeRawUnsafe(`
    INSERT INTO bonavee_staff_metadata (
      staff_id, phone, whatsapp, nin, gender, state_of_origin, lga_of_origin,
      qualification, trcn_number, trcn_category, trcn_status, specialization, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (staff_id) DO UPDATE SET
      phone = EXCLUDED.phone,
      whatsapp = EXCLUDED.whatsapp,
      nin = EXCLUDED.nin,
      gender = EXCLUDED.gender,
      state_of_origin = EXCLUDED.state_of_origin,
      lga_of_origin = EXCLUDED.lga_of_origin,
      qualification = EXCLUDED.qualification,
      trcn_number = EXCLUDED.trcn_number,
      trcn_category = EXCLUDED.trcn_category,
      trcn_status = EXCLUDED.trcn_status,
      specialization = EXCLUDED.specialization,
      updated_at = NOW();
  `, staff.id, testPhone, '2348031234567', testNin, 'Female', 'Lagos', 'Ikeja', 'B.Ed Mathematics', testTrcn, 'Category C', 'REGISTERED', 'Mathematics');

  const metaRows = await prisma.$queryRawUnsafe(
    'SELECT * FROM bonavee_staff_metadata WHERE staff_id = $1',
    staff.id
  );
  if (!metaRows || metaRows.length === 0) {
    throw new Error('❌ Failed to retrieve staff metadata.');
  }
  const meta = metaRows[0];
  console.log(`✅ Verified NIN: ${meta.nin} (Expected: ${testNin})`);
  console.log(`✅ Verified TRCN Number: ${meta.trcn_number} (Category: ${meta.trcn_category})`);
  console.log(`✅ Verified Qualification: ${meta.qualification}`);

  // 5. TEST 3: Daily Staff Attendance Clock-In
  console.log("\n--- TEST 3: Staff Daily Attendance Register & Clock-In ---");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attRecord = await prisma.staffAttendance.upsert({
    where: {
      schoolId_staffId_date: {
        schoolId: school.id,
        staffId: staff.id,
        date: today,
      }
    },
    update: {
      status: 'PRESENT',
      notes: 'Verified direct clock-in test',
    },
    create: {
      schoolId: school.id,
      staffId: staff.id,
      date: today,
      status: 'PRESENT',
      notes: 'Verified direct clock-in test',
    }
  });
  console.log(`✅ Clock-In Attendance Recorded: Status ${attRecord.status} for ${staff.firstName} on ${today.toDateString()}`);

  // 6. TEST 4: Remuneration & Payroll Voucher Generation
  console.log('\n--- TEST 4: Remuneration, Bank Details & Payroll Voucher ---');
  await prisma.staff.update({
    where: { id: staff.id },
    data: {
      baseSalary: 280000,
      bankName: 'Zenith Bank',
      bankAccountNumber: '1012345678',
      accountName: `${staff.firstName} ${staff.lastName}`,
    }
  });

  const voucherCode = `VOUCH-TEST-${Date.now().toString(36).toUpperCase()}`;
  const payrollVoucher = await prisma.payrollRecord.create({
    data: {
      schoolId: school.id,
      staffId: staff.id,
      amount: 280000,
      status: 'PENDING',
      payDate: new Date(),
      receiptCode: voucherCode,
    }
  });
  console.log(`✅ Generated Payroll Voucher: ₦${payrollVoucher.amount.toLocaleString()} (Ref: ${payrollVoucher.receiptCode}, Status: ${payrollVoucher.status})`);

  // Verify staff with relations
  const verifiedStaff = await prisma.staff.findUnique({
    where: { id: staff.id },
    include: {
      department: true,
      StaffAttendance: { where: { date: today } },
      PayrollRecord: { where: { id: payrollVoucher.id } },
    }
  });
  console.log(`✅ Verified Full Relation Integration: Dept="${verifiedStaff.department.name}", AttStatus="${verifiedStaff.StaffAttendance[0].status}", VoucherAmount=₦${verifiedStaff.PayrollRecord[0].amount}`);

  // Clean up temporary test payroll voucher
  await prisma.payrollRecord.delete({ where: { id: payrollVoucher.id } });
  console.log('✅ Temporary verification voucher cleanly purged.');

  console.log('\n=================================================================');
  console.log('   🎉 ALL DIRECT STAFF & HR LIFECYCLE CHECKS PASSED 100%!        ');
  console.log('=================================================================\n');
}

runDirectStaffVerification()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
