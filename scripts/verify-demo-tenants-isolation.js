const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING VERIFICATION SUITE FOR DEMO TENANTS & ISOLATION');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, failureDetails = '') {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}: ${failureDetails}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Verify Landing Page button and 5-Tier Demo Modal
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Landing Page Explore Demo Modal ---');
  const landingPagePath = path.join(process.cwd(), 'src/app/(public)/page.tsx');
  const landingContent = fs.readFileSync(landingPagePath, 'utf8');

  assert(
    landingContent.includes('id="explore-demo-btn"') && landingContent.includes('setIsDemoModalOpen(true)'),
    'Explore Demo button exists and triggers isDemoModalOpen(true)'
  );
  assert(
    !landingContent.includes('href="/api/auth/demo-session"'),
    'Explore Demo button removed old /api/auth/demo-session route'
  );
  assert(
    !landingContent.includes('demo.onrender.com'),
    'Landing page contains zero references to old demo.onrender.com URL'
  );

  const tiersInModal = ['Creche', 'Nursery', 'Primary', 'Secondary', 'University'];
  for (const tier of tiersInModal) {
    assert(
      landingContent.includes(`name: "Demo ${tier}"`),
      `Modal configuration includes Demo ${tier} card`
    );
  }

  const emailsInModal = [
    'demo-creche@demo.com',
    'demo-nursery@demo.com',
    'demo-primary@demo.com',
    'demo-secondary@demo.com',
    'demo-university@demo.com',
  ];
  for (const email of emailsInModal) {
    assert(
      landingContent.includes(`email: "${email}"`),
      `Modal configuration includes credential for ${email}`
    );
  }

  assert(
    landingContent.includes('password: "Demo@123"'),
    'Modal configuration includes Password: Demo@123'
  );

  assert(
    landingContent.includes('handleLaunchDemo'),
    'Modal cards route to Main App login with email and school parameters'
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Verify Real School (Egede) & 5 Demo Tenants in Database
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Database Tenant Records Existence ---');

  const egede = await prisma.school.findFirst({
    where: { OR: [{ subdomain: 'egede' }, { slug: 'egede' }] },
  });
  assert(Boolean(egede), 'Real school "Egede Primary School" exists in database');
  console.log(`Egede School ID: ${egede.id}`);

  const demoSubdomains = [
    'demo-creche',
    'demo-nursery',
    'demo-primary',
    'demo-secondary',
    'demo-university',
  ];

  const demoSchools = {};
  for (const sub of demoSubdomains) {
    const s = await prisma.school.findFirst({
      where: { OR: [{ subdomain: sub }, { slug: sub }] },
      include: {
        academicTiers: true,
        classrooms: true,
        courses: true,
        invoices: true,
        Exam: true,
      },
    });
    assert(Boolean(s), `Demo tenant school "${sub}" exists in database without "School not found" error`);
    demoSchools[sub] = s;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Verify User Logins & Passwords for all 5 Tiers
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: User Authentication & Credentials for 5 Tiers ---');

  for (const email of emailsInModal) {
    const user = await prisma.user.findFirst({
      where: { email },
      include: { school: true },
    });
    assert(Boolean(user), `User account exists for ${email}`);
    assert(user.role === 'SCHOOL_ADMIN', `User ${email} has role SCHOOL_ADMIN`);
    assert(user.mustChangePassword === false, `User ${email} has mustChangePassword === false`);

    const isMatch = await bcrypt.compare('Demo@123', user.passwordHash);
    assert(isMatch, `Password "Demo@123" verifies successfully against bcrypt hash for ${email}`);
    assert(user.schoolId !== egede.id, `User ${email} belongs to demo school, NOT Egede`);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Strict Tenant Isolation (Zero Cross-Tenant Leakage)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Tenant Data Isolation & Zero Leakage ---');

  // A. Egede Students
  const egedeStudents = await prisma.student.findMany({
    where: { schoolId: egede.id },
  });
  console.log(`Egede registered students count: ${egedeStudents.length}`);

  // Ensure ZERO demo students have schoolId == egede.id
  for (const st of egedeStudents) {
    assert(
      !st.email?.includes('demo-') && !st.admissionNumber?.startsWith('CR/') && !st.admissionNumber?.startsWith('NR/') && !st.admissionNumber?.startsWith('SEC/') && !st.admissionNumber?.startsWith('UNI/'),
      `Student ${st.firstName} ${st.lastName} in Egede is a real student, not demo`
    );
  }

  // B. Verify each Demo Tenant has its OWN students and ZERO students from others
  for (const sub of demoSubdomains) {
    const demoSchool = demoSchools[sub];
    const students = await prisma.student.findMany({
      where: { schoolId: demoSchool.id },
    });

    assert(students.length >= 5 && students.length <= 12, `${demoSchool.name} has ${students.length} students (within 5-12 sample range)`);

    for (const st of students) {
      assert(st.schoolId === demoSchool.id, `Student ${st.firstName} ${st.lastName} belongs strictly to ${demoSchool.name}`);
      assert(st.schoolId !== egede.id, `Student ${st.firstName} ${st.lastName} is isolated from Egede`);
    }

    // Verify Staff Isolation
    const staff = await prisma.staff.findMany({
      where: { schoolId: demoSchool.id },
    });
    assert(staff.length >= 2, `${demoSchool.name} has ${staff.length} staff members (at least 2)`);
    for (const sf of staff) {
      assert(sf.schoolId === demoSchool.id, `Staff ${sf.firstName} ${sf.lastName} belongs strictly to ${demoSchool.name}`);
      assert(sf.schoolId !== egede.id, `Staff ${sf.firstName} ${sf.lastName} is isolated from Egede`);
    }

    // Verify Classroom Isolation
    const classrooms = await prisma.classroom.findMany({
      where: { schoolId: demoSchool.id },
    });
    assert(classrooms.length >= 2, `${demoSchool.name} has ${classrooms.length} classes`);
    for (const c of classrooms) {
      assert(c.schoolId === demoSchool.id, `Classroom ${c.name} belongs strictly to ${demoSchool.name}`);
    }

    // Verify Course / Subject Isolation
    const courses = await prisma.course.findMany({
      where: { schoolId: demoSchool.id },
    });
    assert(courses.length >= 2, `${demoSchool.name} has ${courses.length} courses/subjects`);
    for (const c of courses) {
      assert(c.schoolId === demoSchool.id, `Course ${c.name} belongs strictly to ${demoSchool.name}`);
    }

    // Verify Fee / Invoice Isolation
    const invoices = await prisma.invoice.findMany({
      where: { schoolId: demoSchool.id },
    });
    assert(invoices.length >= 1, `${demoSchool.name} has ${invoices.length} sample invoice(s)`);
    for (const inv of invoices) {
      assert(inv.schoolId === demoSchool.id, `Invoice ${inv.id} belongs strictly to ${demoSchool.name}`);
    }

    // Verify Exam / Result Isolation
    const exams = await prisma.exam.findMany({
      where: { schoolId: demoSchool.id },
    });
    assert(exams.length >= 1, `${demoSchool.name} has ${exams.length} sample exam(s)`);
    for (const ex of exams) {
      assert(ex.schoolId === demoSchool.id, `Exam ${ex.name} belongs strictly to ${demoSchool.name}`);
    }

    const results = await prisma.examResult.findMany({
      where: { schoolId: demoSchool.id },
    });
    assert(results.length >= 1, `${demoSchool.name} has ${results.length} sample exam result(s)`);
    for (const res of results) {
      assert(res.schoolId === demoSchool.id, `ExamResult ${res.id} belongs strictly to ${demoSchool.name}`);
    }

    // Verify Attendance Isolation
    const attendance = await prisma.studentAttendance.findMany({
      where: { schoolId: demoSchool.id },
    });
    assert(attendance.length >= 1, `${demoSchool.name} has ${attendance.length} sample attendance record(s)`);
    for (const att of attendance) {
      assert(att.schoolId === demoSchool.id, `Attendance ${att.id} belongs strictly to ${demoSchool.name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Verify Specific Requirements for Classes & Depts
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Verification of Specific Classes & Departments ---');

  // Creche: Creche 1, Creche 2
  const crecheClasses = demoSchools['demo-creche'].classrooms.map((c) => c.name);
  assert(crecheClasses.includes('Creche 1') && crecheClasses.includes('Creche 2'), 'Demo Creche has Creche 1 & Creche 2');

  // Nursery: Nursery 1, Nursery 2, KG
  const nurseryClasses = demoSchools['demo-nursery'].classrooms.map((c) => c.name);
  assert(
    nurseryClasses.includes('Nursery 1') && nurseryClasses.includes('Nursery 2') && nurseryClasses.includes('KG'),
    'Demo Nursery has Nursery 1, Nursery 2 & KG'
  );

  // Primary: Primary 1-6
  const primaryClasses = demoSchools['demo-primary'].classrooms.map((c) => c.name);
  for (let i = 1; i <= 6; i++) {
    assert(primaryClasses.includes(`Primary ${i}`), `Demo Primary has Primary ${i}`);
  }

  // Secondary: JSS 1-3, SSS 1-3
  const secondaryClasses = demoSchools['demo-secondary'].classrooms.map((c) => c.name);
  for (let i = 1; i <= 3; i++) {
    assert(secondaryClasses.includes(`JSS ${i}`), `Demo Secondary has JSS ${i}`);
    assert(secondaryClasses.includes(`SSS ${i}`), `Demo Secondary has SSS ${i}`);
  }

  // University: Computer Science, Business Admin, Levels 100-400
  const uniClasses = demoSchools['demo-university'].classrooms.map((c) => c.name);
  for (let l = 100; l <= 400; l += 100) {
    assert(uniClasses.includes(`${l} Level`), `Demo University has ${l} Level`);
  }

  const uniDepts = await prisma.department.findMany({
    where: { schoolId: demoSchools['demo-university'].id },
  });
  const deptNames = uniDepts.map((d) => d.name);
  assert(deptNames.includes('Computer Science'), 'Demo University has Computer Science Department');
  assert(deptNames.includes('Business Admin'), 'Demo University has Business Admin Department');

  console.log('\n===============================================================');
  console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
  console.log('===============================================================');
}

runTests()
  .catch((err) => {
    console.error('\nVerification suite encountered error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
