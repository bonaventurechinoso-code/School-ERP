const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let rawDbUrl = process.env.DATABASE_URL || '';
// Strip channel_binding if present as Prisma Rust query engine does not support channel_binding
const dbUrl = rawDbUrl.replace(/&channel_binding=[^&]+/g, '').replace(/\?channel_binding=[^&]+&?/g, '?');
const hostMatch = dbUrl.match(/@([^/:]+)/);
const targetHost = hostMatch ? hostMatch[1] : 'unknown';
console.log(`[SEED_DEMO_TENANTS] Target database host: ${targetHost}`);

const prisma = new PrismaClient({
  datasources: {
    db: { url: dbUrl }
  }
});

const DEMO_TENANTS = [
  {
    tierKey: 'CRECHE',
    name: 'Demo Creche',
    subdomain: 'demo-creche',
    slug: 'demo-creche',
    tier: 'CRECHE',
    academicTierName: 'Creche',
    academicTierLevel: 1,
    adminEmail: 'demo-creche@demo.com',
    passwordRaw: 'Demo@123',
    classes: ['Creche 1', 'Creche 2'],
    teachers: [
      { firstName: 'Mrs. Grace', lastName: 'Adebayo', email: 'grace.adebayo@demo-creche.com', staffId: 'CR/STF/001' },
      { firstName: 'Ms. Blessing', lastName: 'Okafor', email: 'blessing.okafor@demo-creche.com', staffId: 'CR/STF/002' },
    ],
    subjects: [
      { name: 'Sensory & Motor Play', code: 'SMP-01' },
      { name: 'Early Phonics & Sound', code: 'EPS-01' },
      { name: 'Nursery Rhymes & Music', code: 'NRM-01' },
    ],
    students: [
      { firstName: 'Tobi', lastName: 'Adebayo', currentClass: 'Creche 1', admissionNumber: 'CR/2026/001', email: 'tobi.a@demo-creche.com' },
      { firstName: 'Chisom', lastName: 'Okeke', currentClass: 'Creche 1', admissionNumber: 'CR/2026/002', email: 'chisom.o@demo-creche.com' },
      { firstName: 'Zainab', lastName: 'Umar', currentClass: 'Creche 1', admissionNumber: 'CR/2026/003', email: 'zainab.u@demo-creche.com' },
      { firstName: 'David', lastName: 'Eze', currentClass: 'Creche 2', admissionNumber: 'CR/2026/004', email: 'david.e@demo-creche.com' },
      { firstName: 'Amina', lastName: 'Bello', currentClass: 'Creche 2', admissionNumber: 'CR/2026/005', email: 'amina.b@demo-creche.com' },
      { firstName: 'Emeka', lastName: 'Nnamdi', currentClass: 'Creche 2', admissionNumber: 'CR/2026/006', email: 'emeka.n@demo-creche.com' },
    ],
    feeTemplate: { name: 'Creche Term Tuition', defaultAmount: 45000 },
    examName: 'Developmental Milestone Review',
  },
  {
    tierKey: 'NURSERY',
    name: 'Demo Nursery',
    subdomain: 'demo-nursery',
    slug: 'demo-nursery',
    tier: 'CRECHE', // SchoolTier enum
    academicTierName: 'Nursery',
    academicTierLevel: 1,
    adminEmail: 'demo-nursery@demo.com',
    passwordRaw: 'Demo@123',
    classes: ['Nursery 1', 'Nursery 2', 'KG'],
    teachers: [
      { firstName: 'Mrs. Funke', lastName: 'Akindele', email: 'funke.akindele@demo-nursery.com', staffId: 'NUR/STF/001' },
      { firstName: 'Mr. Chinedu', lastName: 'Obi', email: 'chinedu.obi@demo-nursery.com', staffId: 'NUR/STF/002' },
      { firstName: 'Ms. Halima', lastName: 'Yusuf', email: 'halima.yusuf@demo-nursery.com', staffId: 'NUR/STF/003' },
    ],
    subjects: [
      { name: 'Numeracy & Shapes', code: 'NUM-01' },
      { name: 'Literacy & Phonics', code: 'LIT-01' },
      { name: 'Creative Arts & Coloring', code: 'ART-01' },
      { name: 'Basic Science & Nature', code: 'SCI-01' },
    ],
    students: [
      { firstName: 'Daniel', lastName: 'Okafor', currentClass: 'Nursery 1', admissionNumber: 'NR/2026/001', email: 'daniel.o@demo-nursery.com' },
      { firstName: 'Fatima', lastName: 'Aliyu', currentClass: 'Nursery 1', admissionNumber: 'NR/2026/002', email: 'fatima.a@demo-nursery.com' },
      { firstName: 'Favour', lastName: 'Danjuma', currentClass: 'Nursery 2', admissionNumber: 'NR/2026/003', email: 'favour.d@demo-nursery.com' },
      { firstName: 'Kenechukwu', lastName: 'Eze', currentClass: 'Nursery 2', admissionNumber: 'NR/2026/004', email: 'kene.e@demo-nursery.com' },
      { firstName: 'Maryam', lastName: 'Sanusi', currentClass: 'KG', admissionNumber: 'NR/2026/005', email: 'maryam.s@demo-nursery.com' },
      { firstName: 'Samuel', lastName: 'Ojo', currentClass: 'KG', admissionNumber: 'NR/2026/006', email: 'samuel.o@demo-nursery.com' },
    ],
    feeTemplate: { name: 'Nursery Term Tuition', defaultAmount: 55000 },
    examName: 'Midterm Progress Assessment',
  },
  {
    tierKey: 'PRIMARY',
    name: 'Demo Primary',
    subdomain: 'demo-primary',
    slug: 'demo-primary',
    tier: 'PRIMARY',
    academicTierName: 'Primary School',
    academicTierLevel: 2,
    adminEmail: 'demo-primary@demo.com',
    passwordRaw: 'Demo@123',
    classes: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
    teachers: [
      { firstName: 'Mr. Tunde', lastName: 'Bakare', email: 'tunde.bakare@demo-primary.com', staffId: 'PRM/STF/001' },
      { firstName: 'Mrs. Ngozi', lastName: 'Chukwu', email: 'ngozi.chukwu@demo-primary.com', staffId: 'PRM/STF/002' },
      { firstName: 'Mr. Usman', lastName: 'Danjuma', email: 'usman.danjuma@demo-primary.com', staffId: 'PRM/STF/003' },
    ],
    subjects: [
      { name: 'Mathematics', code: 'PRM-MTH' },
      { name: 'English Studies', code: 'PRM-ENG' },
      { name: 'Basic Science & Tech', code: 'PRM-BST' },
      { name: 'Social Studies', code: 'PRM-SOS' },
    ],
    students: [
      { firstName: 'Kelechi', lastName: 'Okonkwo', currentClass: 'Primary 1', admissionNumber: 'PR/2026/001', email: 'kelechi.o@demo-primary.com' },
      { firstName: 'Aisha', lastName: 'Mohammed', currentClass: 'Primary 2', admissionNumber: 'PR/2026/002', email: 'aisha.m@demo-primary.com' },
      { firstName: 'Emmanuel', lastName: 'Adeyemi', currentClass: 'Primary 3', admissionNumber: 'PR/2026/003', email: 'emmanuel.a@demo-primary.com' },
      { firstName: 'Blessing', lastName: 'Nwosu', currentClass: 'Primary 4', admissionNumber: 'PR/2026/004', email: 'blessing.n@demo-primary.com' },
      { firstName: 'Chukwudi', lastName: 'Ibrahim', currentClass: 'Primary 5', admissionNumber: 'PR/2026/005', email: 'chukwudi.i@demo-primary.com' },
      { firstName: 'Folake', lastName: 'Balogun', currentClass: 'Primary 6', admissionNumber: 'PR/2026/006', email: 'folake.b@demo-primary.com' },
    ],
    feeTemplate: { name: 'Primary Composite Tuition', defaultAmount: 70000 },
    examName: 'First Term Unified Examination',
  },
  {
    tierKey: 'SECONDARY',
    name: 'Demo Secondary',
    subdomain: 'demo-secondary',
    slug: 'demo-secondary',
    tier: 'SECONDARY',
    academicTierName: 'Secondary School',
    academicTierLevel: 3,
    adminEmail: 'demo-secondary@demo.com',
    passwordRaw: 'Demo@123',
    classes: ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'],
    teachers: [
      { firstName: 'Mr. Kelechi', lastName: 'Nwosu', email: 'kelechi.nwosu@demo-secondary.com', staffId: 'SEC/STF/001' },
      { firstName: 'Dr. Sarah', lastName: 'Aliyu', email: 'sarah.aliyu@demo-secondary.com', staffId: 'SEC/STF/002' },
      { firstName: 'Mrs. Folake', lastName: 'Adeyemi', email: 'folake.adeyemi@demo-secondary.com', staffId: 'SEC/STF/003' },
      { firstName: 'Mr. Ayodeji', lastName: 'Balogun', email: 'ayodeji.balogun@demo-secondary.com', staffId: 'SEC/STF/004' },
    ],
    subjects: [
      { name: 'General Mathematics', code: 'SEC-MTH' },
      { name: 'English Language', code: 'SEC-ENG' },
      { name: 'Physics', code: 'SEC-PHY' },
      { name: 'Chemistry', code: 'SEC-CHM' },
      { name: 'Biology', code: 'SEC-BIO' },
    ],
    students: [
      { firstName: 'Somtochukwu', lastName: 'Eze', currentClass: 'JSS 1', admissionNumber: 'SEC/2026/001', email: 'somto.e@demo-secondary.com' },
      { firstName: 'Zainab', lastName: 'Abubakar', currentClass: 'JSS 2', admissionNumber: 'SEC/2026/002', email: 'zainab.a@demo-secondary.com' },
      { firstName: 'Victor', lastName: 'Okafor', currentClass: 'JSS 3', admissionNumber: 'SEC/2026/003', email: 'victor.o@demo-secondary.com' },
      { firstName: 'Ifeoma', lastName: 'Danjuma', currentClass: 'SSS 1', admissionNumber: 'SEC/2026/004', email: 'ifeoma.d@demo-secondary.com' },
      { firstName: 'Oluwaseun', lastName: 'Adeola', currentClass: 'SSS 2', admissionNumber: 'SEC/2026/005', email: 'seun.a@demo-secondary.com' },
      { firstName: 'Chinedu', lastName: 'Obi', currentClass: 'SSS 3', admissionNumber: 'SEC/2026/006', email: 'chinedu.o@demo-secondary.com' },
    ],
    feeTemplate: { name: 'Senior/Junior Secondary Tuition', defaultAmount: 95000 },
    examName: 'First Term Examination & Continuous Assessment',
  },
  {
    tierKey: 'UNIVERSITY',
    name: 'Demo University',
    subdomain: 'demo-university',
    slug: 'demo-university',
    tier: 'TERTIARY',
    tertiaryType: 'UNIVERSITY',
    academicTierName: 'Higher Institution / University',
    academicTierLevel: 4,
    adminEmail: 'demo-university@demo.com',
    passwordRaw: 'Demo@123',
    departments: ['Computer Science', 'Business Admin'],
    classes: ['100 Level', '200 Level', '300 Level', '400 Level'],
    teachers: [
      { firstName: 'Prof. Babatunde', lastName: 'Fashola', email: 'babatunde.fashola@demo-university.edu.ng', staffId: 'UNI/LEC/001', department: 'Computer Science' },
      { firstName: 'Dr. Amina', lastName: 'Mohammed', email: 'amina.mohammed@demo-university.edu.ng', staffId: 'UNI/LEC/002', department: 'Computer Science' },
      { firstName: 'Dr. Ifeanyi', lastName: 'Okonjo', email: 'ifeanyi.okonjo@demo-university.edu.ng', staffId: 'UNI/LEC/003', department: 'Business Admin' },
      { firstName: 'Dr. Binta', lastName: 'Sanusi', email: 'binta.sanusi@demo-university.edu.ng', staffId: 'UNI/LEC/004', department: 'Business Admin' },
    ],
    subjects: [
      { name: 'Introduction to Computer Science', code: 'CSC101' },
      { name: 'Data Structures and Algorithms', code: 'CSC201' },
      { name: 'Introduction to Business Management', code: 'BUS101' },
      { name: 'Commercial & Corporate Law', code: 'BUS201' },
    ],
    students: [
      { firstName: 'Chukwuebuka', lastName: 'Okeke', currentClass: '100 Level', admissionNumber: 'UNI/2026/001', email: 'ebuka.o@demo-university.edu.ng' },
      { firstName: 'Hauwa', lastName: 'Aliyu', currentClass: '100 Level', admissionNumber: 'UNI/2026/002', email: 'hauwa.a@demo-university.edu.ng' },
      { firstName: 'Olumide', lastName: 'Bakare', currentClass: '200 Level', admissionNumber: 'UNI/2026/003', email: 'olumide.b@demo-university.edu.ng' },
      { firstName: 'Chidinma', lastName: 'Eze', currentClass: '200 Level', admissionNumber: 'UNI/2026/004', email: 'chidinma.e@demo-university.edu.ng' },
      { firstName: 'Nnamdi', lastName: 'Nwosu', currentClass: '300 Level', admissionNumber: 'UNI/2026/005', email: 'nnamdi.n@demo-university.edu.ng' },
      { firstName: 'Zainab', lastName: 'Bello', currentClass: '300 Level', admissionNumber: 'UNI/2026/006', email: 'zainab.b@demo-university.edu.ng' },
      { firstName: 'Tolani', lastName: 'Adeyemi', currentClass: '400 Level', admissionNumber: 'UNI/2026/007', email: 'tolani.a@demo-university.edu.ng' },
      { firstName: 'Franklin', lastName: 'Okafor', currentClass: '400 Level', admissionNumber: 'UNI/2026/008', email: 'franklin.o@demo-university.edu.ng' },
    ],
    feeTemplate: { name: 'Undergraduate Semester Tuition', defaultAmount: 160000 },
    examName: 'First Semester Examination 2026/2027',
  },
];

async function seedDemoTenants() {
  console.log('[SEED_DEMO_TENANTS] Starting idempotent seeding of 5 Demo Tenants...');
  const defaultPasswordHash = await bcrypt.hash('Demo@123', 10);

  for (const tenantConfig of DEMO_TENANTS) {
    console.log(`\n--- Provisioning: ${tenantConfig.name} (${tenantConfig.subdomain}) ---`);

    // 1. Idempotently find or create School
    let school = await prisma.school.findFirst({
      where: {
        OR: [
          { subdomain: tenantConfig.subdomain },
          { slug: tenantConfig.slug },
        ],
      },
    });

    if (!school) {
      school = await prisma.school.create({
        data: {
          name: tenantConfig.name,
          subdomain: tenantConfig.subdomain,
          slug: tenantConfig.slug,
          tier: tenantConfig.tier,
          tertiaryType: tenantConfig.tertiaryType || null,
          status: 'ACTIVE',
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: 'ENTERPRISE',
          isActive: true,
          isPublicPortalEnabled: true,
          welcomeGreeting: `Welcome to ${tenantConfig.name} Demonstration Workspace!`,
        },
      });
      console.log(`Created School: ${school.name} (id: ${school.id})`);
    } else {
      school = await prisma.school.update({
        where: { id: school.id },
        data: {
          name: tenantConfig.name,
          tier: tenantConfig.tier,
          tertiaryType: tenantConfig.tertiaryType || null,
          status: 'ACTIVE',
          subscriptionStatus: 'ACTIVE',
          isActive: true,
        },
      });
      console.log(`Updated School: ${school.name} (id: ${school.id})`);
    }

    // 2. Synchronize matching Tenant entry (if Tenant model table exists)
    try {
      const existingTenant = await prisma.tenant.findFirst({
        where: { subdomain: tenantConfig.subdomain },
      });
      if (!existingTenant) {
        await prisma.tenant.create({
          data: {
            schoolName: tenantConfig.name,
            subdomain: tenantConfig.subdomain,
            slug: tenantConfig.slug,
            adminEmail: tenantConfig.adminEmail,
            contactPhone: '+234 800 000 0000',
            institutionTypes: [tenantConfig.tierKey],
            status: 'ACTIVE',
            subscriptionStatus: 'ACTIVE',
            isDemo: true,
            isTrial: false,
            isActive: true,
          },
        });
      } else {
        await prisma.tenant.update({
          where: { id: existingTenant.id },
          data: {
            schoolName: tenantConfig.name,
            adminEmail: tenantConfig.adminEmail,
            isDemo: true,
            status: 'ACTIVE',
            subscriptionStatus: 'ACTIVE',
            isActive: true,
          },
        });
      }
    } catch (tErr) {
      console.warn(`[WARN] Tenant table sync warning for ${tenantConfig.subdomain}:`, tErr.message);
    }

    // 3. Upsert Academic Tier
    let academicTier = await prisma.academicTier.findFirst({
      where: {
        schoolId: school.id,
        name: tenantConfig.academicTierName,
      },
    });

    if (!academicTier) {
      academicTier = await prisma.academicTier.create({
        data: {
          schoolId: school.id,
          name: tenantConfig.academicTierName,
          level: tenantConfig.academicTierLevel,
        },
      });
    }

    // 4. Upsert Departments (for University or Academic Administration)
    const deptMap = new Map();
    const deptsToCreate = tenantConfig.departments || ['Academic Administration'];
    for (const dName of deptsToCreate) {
      let dept = await prisma.department.findFirst({
        where: { schoolId: school.id, name: dName },
      });
      if (!dept) {
        dept = await prisma.department.create({
          data: {
            schoolId: school.id,
            name: dName,
            tierId: academicTier.id,
          },
        });
      }
      deptMap.set(dName, dept.id);
    }

    // 5. Upsert Admin User (demo-*@demo.com / Demo@123)
    let adminUser = await prisma.user.findFirst({
      where: {
        email: tenantConfig.adminEmail,
        OR: [
          { schoolId: school.id },
          { schoolId: null },
        ],
      },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          schoolId: school.id,
          email: tenantConfig.adminEmail,
          passwordHash: defaultPasswordHash,
          firstName: 'Demo',
          lastName: 'Administrator',
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
      console.log(`Created User: ${adminUser.email}`);
    } else {
      adminUser = await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          schoolId: school.id,
          passwordHash: defaultPasswordHash,
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
      console.log(`Updated User: ${adminUser.email}`);
    }

    // 6. Ensure matching Administrator Staff record exists
    let adminStaff = await prisma.staff.findFirst({
      where: { schoolId: school.id, email: tenantConfig.adminEmail },
    });
    if (!adminStaff) {
      adminStaff = await prisma.staff.create({
        data: {
          schoolId: school.id,
          userId: adminUser.id,
          firstName: 'Demo',
          lastName: 'Administrator',
          email: tenantConfig.adminEmail,
          staffId: `${tenantConfig.slug.substring(0, 3).toUpperCase()}/ADM/001`,
          departmentId: deptMap.values().next().value || null,
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
        },
      });
    } else if (!adminStaff.userId) {
      await prisma.staff.update({
        where: { id: adminStaff.id },
        data: { userId: adminUser.id, status: 'ACTIVE' },
      });
    }

    // 7. Upsert Classrooms
    const classroomMap = new Map();
    for (const cName of tenantConfig.classes) {
      let cr = await prisma.classroom.findFirst({
        where: { schoolId: school.id, name: cName },
      });
      if (!cr) {
        cr = await prisma.classroom.create({
          data: {
            schoolId: school.id,
            name: cName,
            capacity: 35,
            tierId: academicTier.id,
          },
        });
      }
      classroomMap.set(cName, cr.id);
    }
    console.log(`Provisioned ${classroomMap.size} classes`);

    // 8. Upsert Teachers / Lecturers
    const staffIds = [];
    for (const t of tenantConfig.teachers) {
      let teacherUser = await prisma.user.findFirst({
        where: { schoolId: school.id, email: t.email },
      });
      if (!teacherUser) {
        teacherUser = await prisma.user.create({
          data: {
            schoolId: school.id,
            email: t.email,
            passwordHash: defaultPasswordHash,
            firstName: t.firstName,
            lastName: t.lastName,
            role: 'TEACHER',
            status: 'ACTIVE',
            mustChangePassword: false,
          },
        });
      }

      let teacherStaff = await prisma.staff.findFirst({
        where: { schoolId: school.id, email: t.email },
      });
      const targetDeptId = t.department && deptMap.has(t.department)
        ? deptMap.get(t.department)
        : (deptMap.values().next().value || null);

      if (!teacherStaff) {
        teacherStaff = await prisma.staff.create({
          data: {
            schoolId: school.id,
            userId: teacherUser.id,
            firstName: t.firstName,
            lastName: t.lastName,
            email: t.email,
            staffId: t.staffId,
            departmentId: targetDeptId,
            employmentType: 'FULL_TIME',
            status: 'ACTIVE',
          },
        });
      }
      staffIds.push(teacherStaff.id);
    }
    console.log(`Provisioned ${staffIds.length} faculty/staff members`);

    // 9. Upsert Subjects / Courses
    const courseMap = new Map();
    for (const s of tenantConfig.subjects) {
      let course = await prisma.course.findFirst({
        where: { schoolId: school.id, code: s.code },
      });
      if (!course) {
        course = await prisma.course.create({
          data: {
            schoolId: school.id,
            name: s.name,
            code: s.code,
            tierId: academicTier.id,
          },
        });
      }
      courseMap.set(s.code, course.id);
    }
    console.log(`Provisioned ${courseMap.size} subjects/courses`);

    // 10. Upsert FeeTemplate
    let feeTemplate = await prisma.feeTemplate.findFirst({
      where: { schoolId: school.id, name: tenantConfig.feeTemplate.name },
    });
    if (!feeTemplate) {
      feeTemplate = await prisma.feeTemplate.create({
        data: {
          schoolId: school.id,
          name: tenantConfig.feeTemplate.name,
          defaultAmount: tenantConfig.feeTemplate.defaultAmount,
          billingType: 'FLAT',
        },
      });
    }

    // 11. Upsert Students
    const studentIds = [];
    for (const st of tenantConfig.students) {
      let student = await prisma.student.findFirst({
        where: { schoolId: school.id, admissionNumber: st.admissionNumber },
      });
      if (!student) {
        student = await prisma.student.create({
          data: {
            schoolId: school.id,
            tierId: academicTier.id,
            firstName: st.firstName,
            lastName: st.lastName,
            email: st.email,
            admissionNumber: st.admissionNumber,
            currentClass: st.currentClass,
            status: 'ENROLLED',
            feeStatus: 'UNPAID',
          },
        });
      } else {
        student = await prisma.student.update({
          where: { id: student.id },
          data: {
            currentClass: st.currentClass,
            status: 'ENROLLED',
          },
        });
      }
      studentIds.push(student.id);
    }
    console.log(`Provisioned ${studentIds.length} enrolled students`);

    // 12. Upsert Sample Invoice (for student #1)
    if (studentIds.length > 0) {
      const firstStudentId = studentIds[0];
      const existingInvoice = await prisma.invoice.findFirst({
        where: { schoolId: school.id, studentId: firstStudentId },
      });
      if (!existingInvoice) {
        await prisma.invoice.create({
          data: {
            schoolId: school.id,
            studentId: firstStudentId,
            feeTemplateId: feeTemplate.id,
            amountDue: tenantConfig.feeTemplate.defaultAmount,
            amountPaid: 0,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'PENDING',
            description: `${tenantConfig.feeTemplate.name} - 2026/2027 Academic Session`,
          },
        });
        console.log(`Created sample Invoice for student: ${firstStudentId}`);
      }
    }

    // 13. Upsert Sample Exam & ExamResult (for course #1 and student #1)
    const firstCourseId = courseMap.values().next().value;
    if (firstCourseId && studentIds.length > 0) {
      let exam = await prisma.exam.findFirst({
        where: { schoolId: school.id, name: tenantConfig.examName },
      });
      if (!exam) {
        exam = await prisma.exam.create({
          data: {
            schoolId: school.id,
            courseId: firstCourseId,
            name: tenantConfig.examName,
            semester: 'First Term 2026/2027',
            date: new Date(),
            maxScore: 100,
          },
        });
      }

      const existingResult = await prisma.examResult.findFirst({
        where: { schoolId: school.id, examId: exam.id, studentId: studentIds[0] },
      });
      if (!existingResult) {
        await prisma.examResult.create({
          data: {
            schoolId: school.id,
            examId: exam.id,
            studentId: studentIds[0],
            score: 88,
            ca1Score: 18,
            ca2Score: 18,
            examScore: 52,
            letterGrade: 'A',
          },
        });
        console.log(`Created sample ExamResult for student: ${studentIds[0]}`);
      }
    }

    // 14. Upsert Sample Attendance Record (for student #1)
    if (studentIds.length > 0) {
      const todayDate = new Date();
      todayDate.setUTCHours(0, 0, 0, 0);

      const existingAttendance = await prisma.studentAttendance.findFirst({
        where: { schoolId: school.id, studentId: studentIds[0], date: todayDate },
      });
      if (!existingAttendance) {
        await prisma.studentAttendance.create({
          data: {
            schoolId: school.id,
            studentId: studentIds[0],
            date: todayDate,
            status: 'PRESENT',
            notes: 'Punctual and actively participated.',
          },
        });
        console.log(`Created sample StudentAttendance record for student: ${studentIds[0]}`);
      }
    }
  }

  console.log('\n[SEED_DEMO_TENANTS] All 5 Demo Tenants successfully seeded!');
}

if (require.main === module) {
  seedDemoTenants()
    .catch((err) => {
      console.error('[SEED_DEMO_TENANTS_ERROR]:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedDemoTenants, DEMO_TENANTS };
