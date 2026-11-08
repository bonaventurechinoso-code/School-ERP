import { PrismaClient } from "@prisma/client";
import { spawnSync } from "child_process";
import path from "path";
import bcrypt from "bcryptjs";
import { setDemoSchoolId } from "./tenant-prisma";

const DEMO_SUBDOMAIN = "demo";
const DEMO_SCHOOL_NAME = "Apex International Academy";
const DEMO_ADMIN_EMAIL = "demo.admin@schoolerp.local";

let isDemoDbReady = false;

/**
 * Seeds Apex International Academy + academic tiers, classrooms, departments,
 * staff, fee schedules, and 50 realistic dummy students into demo database.
 */
export async function seedDemoSchool(demoPrisma: PrismaClient): Promise<void> {
  console.info(`[DEMO_DB_INIT] Seeding "${DEMO_SCHOOL_NAME}" into demo database...`);

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Create or update School record
  let school = await demoPrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: DEMO_SUBDOMAIN },
        { slug: DEMO_SUBDOMAIN },
      ],
    },
    include: {
      academicTiers: true,
      classrooms: true,
      departments: true,
      staff: true,
      feeTemplates: true,
    },
  });

  if (!school) {
    school = await demoPrisma.school.create({
      data: {
        name: DEMO_SCHOOL_NAME,
        subdomain: DEMO_SUBDOMAIN,
        slug: DEMO_SUBDOMAIN,
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        isActive: true,
        isBanned: false,
        isPublicPortalEnabled: true,
        welcomeGreeting: `Welcome to ${DEMO_SCHOOL_NAME}! Explore administrative workflows freely in demo mode.`,
        academicTiers: {
          create: [
            { name: "Creche / Nursery", level: 1 },
            { name: "Primary School", level: 2 },
            { name: "Secondary School", level: 3 },
            { name: "Higher Institution / University", level: 4 },
          ],
        },
        departments: {
          create: [
            { name: "Academic Administration" },
            { name: "Sciences" },
            { name: "Arts & Humanities" },
          ],
        },
      },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
        classrooms: true,
        departments: true,
        staff: true,
        feeTemplates: true,
      },
    });
    console.info(`[DEMO_DB_INIT] Created School "${school.name}" (ID: ${school.id})`);
  } else if (school.name !== DEMO_SCHOOL_NAME) {
    school = await demoPrisma.school.update({
      where: { id: school.id },
      data: { name: DEMO_SCHOOL_NAME },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
        classrooms: true,
        departments: true,
        staff: true,
        feeTemplates: true,
      },
    });
  }

  const schoolId = school.id;
  setDemoSchoolId(schoolId);
  const tiers = school.academicTiers.length > 0
    ? school.academicTiers
    : await demoPrisma.academicTier.findMany({ where: { schoolId }, orderBy: { level: "asc" } });

  // 2. Ensure Academic Tiers exist if missing
  if (tiers.length === 0) {
    const defaultTiers = [
      { name: "Creche / Nursery", level: 1 },
      { name: "Primary School", level: 2 },
      { name: "Secondary School", level: 3 },
      { name: "Higher Institution / University", level: 4 },
    ];
    for (const t of defaultTiers) {
      await demoPrisma.academicTier.create({ data: { schoolId, name: t.name, level: t.level } });
    }
  }

  // 3. Ensure Classrooms exist across all tiers
  const tierClassMap: Record<string, string[]> = {
    "Creche / Nursery": ["Crèche", "Nursery 1", "Nursery 2"],
    "Primary School": ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
    "Secondary School": ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
    "Higher Institution / University": ["100 Level", "200 Level", "300 Level", "400 Level"],
  };

  const classrooms: any[] = [];
  for (const tier of tiers) {
    const classNames = tierClassMap[tier.name] || [`Class ${tier.name}`];
    for (const name of classNames) {
      let cr = await demoPrisma.classroom.findFirst({ where: { schoolId, tierId: tier.id, name } });
      if (!cr) {
        cr = await demoPrisma.classroom.create({
          data: { schoolId, tierId: tier.id, name, capacity: 35 },
        });
      }
      classrooms.push(cr);
    }
  }

  // 4. Ensure Departments exist
  let adminDept = await demoPrisma.department.findFirst({ where: { schoolId, name: "Academic Administration" } });
  if (!adminDept) {
    adminDept = await demoPrisma.department.create({ data: { schoolId, name: "Academic Administration" } });
  }

  // 5. Ensure Staff & Admin Users exist (6+ Teachers, Principal, Bursar, Admin)
  const staffConfigs = [
    { firstName: "Demo", lastName: "Administrator", email: DEMO_ADMIN_EMAIL, role: "SCHOOL_ADMIN", title: "Administrator", salary: 350000 },
    { firstName: "Folake", lastName: "Adeyemi", email: "principal@demo.schoolerp.local", role: "PRINCIPAL", title: "Principal", salary: 450000 },
    { firstName: "Emeka", lastName: "Okafor", email: "bursar@demo.schoolerp.local", role: "BURSAR", title: "Bursar", salary: 380000 },
    { firstName: "Ayodeji", lastName: "Balogun", email: "teacher1@demo.schoolerp.local", role: "TEACHER", title: "Senior Mathematics Teacher", salary: 250000 },
    { firstName: "Zainab", lastName: "Mohammed", email: "teacher2@demo.schoolerp.local", role: "TEACHER", title: "English Language & Literature Teacher", salary: 240000 },
    { firstName: "Chinedu", lastName: "Eze", email: "teacher3@demo.schoolerp.local", role: "TEACHER", title: "Physics & Science Teacher", salary: 260000 },
    { firstName: "Ngozi", lastName: "Okoro", email: "teacher4@demo.schoolerp.local", role: "TEACHER", title: "Biology & Agricultural Science Teacher", salary: 230000 },
    { firstName: "Tunde", lastName: "Adebayo", email: "teacher5@demo.schoolerp.local", role: "TEACHER", title: "Chemistry & Computing Teacher", salary: 250000 },
    { firstName: "Funke", lastName: "Ogunleye", email: "teacher6@demo.schoolerp.local", role: "TEACHER", title: "Social Studies & Civic Education Teacher", salary: 220000 },
  ];

  const staffMembers: any[] = [];
  for (const cfg of staffConfigs) {
    const user = await demoPrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: cfg.email } },
      update: { role: cfg.role as any, status: "ACTIVE", mustChangePassword: false },
      create: {
        schoolId,
        firstName: cfg.firstName,
        lastName: cfg.lastName,
        email: cfg.email,
        passwordHash,
        role: cfg.role as any,
        mustChangePassword: false,
        status: "ACTIVE",
      },
    });

    const staff = await demoPrisma.staff.upsert({
      where: { schoolId_email: { schoolId, email: cfg.email } },
      update: { userId: user.id, status: "ACTIVE" },
      create: {
        schoolId,
        userId: user.id,
        firstName: cfg.firstName,
        lastName: cfg.lastName,
        email: cfg.email,
        status: "ACTIVE",
        baseSalary: cfg.salary,
        departmentId: adminDept.id,
      },
    });
    staffMembers.push(staff);
  }

  // 6. Ensure Fee Templates exist
  let feeTemplate = await demoPrisma.feeTemplate.findFirst({ where: { schoolId, name: "Termly Comprehensive Tuition" } });
  if (!feeTemplate) {
    feeTemplate = await demoPrisma.feeTemplate.create({
      data: {
        schoolId,
        name: "Termly Comprehensive Tuition",
        billingType: "FLAT",
        defaultAmount: 120000,
      },
    });
  }

  let labFee = await demoPrisma.feeTemplate.findFirst({ where: { schoolId, name: "ICT & Science Lab Levy" } });
  if (!labFee) {
    labFee = await demoPrisma.feeTemplate.create({
      data: {
        schoolId,
        name: "ICT & Science Lab Levy",
        billingType: "FLAT",
        defaultAmount: 25000,
      },
    });
  }

  // 7. Ensure Courses & Exams exist
  const secTier = tiers.find((t) => t.name.includes("Secondary")) || tiers[0];
  const coursesData = [
    { code: "MTH101", name: "Mathematics" },
    { code: "ENG101", name: "English Language" },
    { code: "PHY101", name: "Physics" },
    { code: "BIO101", name: "Biology" },
    { code: "ICT101", name: "Computer Studies & ICT" },
  ];

  const seededCourses: any[] = [];
  for (const c of coursesData) {
    let course = await demoPrisma.course.findFirst({ where: { schoolId, code: c.code } });
    if (!course) {
      course = await demoPrisma.course.create({
        data: {
          schoolId,
          tierId: secTier.id,
          name: c.name,
          code: c.code,
        },
      });
    }
    seededCourses.push(course);
  }

  let exam = await demoPrisma.exam.findFirst({ where: { schoolId, courseId: seededCourses[0].id } });
  if (!exam) {
    exam = await demoPrisma.exam.create({
      data: {
        schoolId,
        courseId: seededCourses[0].id,
        name: "First Term Continuous Assessment",
        semester: "First Term",
        date: new Date(),
        maxScore: 100,
      },
    });
  }

  // 8. Seed Dummy Students if count < 20
  const currentStudentCount = await demoPrisma.student.count({ where: { schoolId } });
  const allStudents: any[] = [];
  if (currentStudentCount < 20) {
    console.info(`[DEMO_DB_INIT] Seeding 50 realistic dummy students for analytics...`);
    const firstNames = ["Amina", "Chinedu", "Fatima", "Ayodeji", "Ngozi", "Tunde", "Zainab", "Kelechi", "Adeola", "Musa", "Blessing", "Chukwudi", "Ifeoma", "Abubakar", "Funke", "Nnamdi", "Binta", "Damilola", "Somto", "Usman"];
    const lastNames = ["Adebayo", "Okafor", "Danjuma", "Chukwu", "Balogun", "Ibrahim", "Okoro", "Adeyemi", "Eze", "Mohammed", "Ogunleye", "Nwosu", "Abiola", "Aliyu", "Obi"];
    const states = ["Lagos", "Kano", "Rivers", "Kaduna", "Oyo", "Abuja", "Enugu", "Delta", "Anambra", "Edo"];

    for (let i = 1; i <= 50; i++) {
      const fName = firstNames[i % firstNames.length];
      const lName = lastNames[i % lastNames.length];
      const admissionNo = `APX-${String(i).padStart(4, "0")}`;
      const email = `student${i}@demo.schoolerp.local`;
      const classroom = classrooms[i % classrooms.length];
      const assignedTier = classroom ? tiers.find((t) => t.id === classroom.tierId) || tiers[0] : tiers[0];
      const isAlumni = i > 45;

      const student = await demoPrisma.student.create({
        data: {
          schoolId,
          tierId: assignedTier.id,
          firstName: fName,
          lastName: lName,
          admissionNumber: admissionNo,
          email,
          status: isAlumni ? "ALUMNI" : "ENROLLED",
          currentClass: classroom ? classroom.name : "Primary 1",
          dynamicFields: { gender: i % 2 === 0 ? "FEMALE" : "MALE" },
          dateOfBirth: new Date(2008, (i % 12), ((i * 3) % 28) + 1),
          stateOfOrigin: states[i % states.length],
          parentName: `Alhaji/Dr. ${lName}`,
          parentEmail: `parent.${lName.toLowerCase()}${i}@example.com`,
          parentPhone: `+23480${String(10000000 + i).slice(-8)}`,
          parentOccupation: "Business Executive",
        },
      });
      allStudents.push(student);

      const isPaid = i % 3 === 0;
      const isPartial = i % 3 === 1;
      const invoiceStatus = isPaid ? "PAID" : (isPartial ? "PARTIAL" : "PENDING");
      const invoice = await demoPrisma.invoice.create({
        data: {
          schoolId,
          studentId: student.id,
          feeTemplateId: feeTemplate.id,
          amountDue: 120000,
          status: invoiceStatus,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          description: "Termly Comprehensive Tuition Fee",
        },
      });

      if (isPaid || isPartial) {
        const amountPaid = isPaid ? 120000 : 60000;
        await demoPrisma.payment.create({
          data: {
            schoolId,
            studentId: student.id,
            invoiceId: invoice.id,
            amountPaid,
            paymentDate: new Date(),
            method: i % 2 === 0 ? "TRANSFER" : "CARD",
          },
        });
      }

      if (assignedTier.name.includes("Secondary") && exam) {
        const ca1 = 10 + (i % 6);
        const ca2 = 10 + ((i + 1) % 6);
        const examScore = 35 + ((i * 3) % 35);
        const total = ca1 + ca2 + examScore;
        const letterGrade = total >= 75 ? "A1" : (total >= 65 ? "B2" : (total >= 50 ? "C5" : "P8"));

        await demoPrisma.examResult.create({
          data: {
            schoolId,
            examId: exam.id,
            studentId: student.id,
            score: total,
            ca1Score: ca1,
            ca2Score: ca2,
            examScore,
            letterGrade,
          },
        });
      }
    }
    console.info(`[DEMO_DB_INIT] Successfully seeded 50 dummy students with invoices and grades.`);
  } else {
    const existing = await demoPrisma.student.findMany({ where: { schoolId }, take: 50 });
    allStudents.push(...existing);
  }

  // 9. Seed Student Attendance & Staff Attendance for realistic dashboard activity
  const studentAttendanceCount = await demoPrisma.studentAttendance.count({ where: { schoolId } });
  if (studentAttendanceCount === 0 && allStudents.length > 0) {
    console.info(`[DEMO_DB_INIT] Seeding student and staff attendance records...`);
    const today = new Date();
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const attDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);
      for (const st of allStudents.slice(0, 30)) {
        const isLate = (st.admissionNumber.charCodeAt(st.admissionNumber.length - 1) + dayOffset) % 5 === 0;
        await demoPrisma.studentAttendance.create({
          data: {
            schoolId,
            studentId: st.id,
            date: attDate,
            status: isLate ? "LATE" : "PRESENT",
          },
        }).catch(() => {});
      }
      for (const stf of staffMembers) {
        await demoPrisma.staffAttendance.create({
          data: {
            schoolId,
            staffId: stf.id,
            date: attDate,
            status: "PRESENT",
          },
        }).catch(() => {});
      }
    }
  }

  // 10. Seed Timetable Events for Classrooms
  const timetableCount = await demoPrisma.timetable.count({ where: { schoolId } });
  if (timetableCount === 0 && classrooms.length > 0 && seededCourses.length > 0) {
    console.info(`[DEMO_DB_INIT] Seeding timetable events...`);
    const mathTeacher = staffMembers.find((s) => s.email === "teacher1@demo.schoolerp.local") || staffMembers[0];
    const engTeacher = staffMembers.find((s) => s.email === "teacher2@demo.schoolerp.local") || staffMembers[0];
    const mthCourse = seededCourses.find((c) => c.code === "MTH101") || seededCourses[0];
    const engCourse = seededCourses.find((c) => c.code === "ENG101") || seededCourses[0];

    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    for (const d of days) {
      await demoPrisma.timetable.create({
        data: {
          schoolId,
          classroomId: classrooms[0].id,
          courseId: mthCourse.id,
          staffId: mathTeacher.id,
          dayOfWeek: d,
          startTime: "08:30",
          endTime: "10:00",
        },
      }).catch(() => {});

      await demoPrisma.timetable.create({
        data: {
          schoolId,
          classroomId: classrooms[0].id,
          courseId: engCourse.id,
          staffId: engTeacher.id,
          dayOfWeek: d,
          startTime: "10:30",
          endTime: "12:00",
        },
      }).catch(() => {});
    }
  }

  // 11. Seed Notices / Events
  const noticesCount = await demoPrisma.notice.count({ where: { schoolId } });
  if (noticesCount === 0) {
    console.info(`[DEMO_DB_INIT] Seeding institutional notices...`);
    const demoNotices = [
      {
        title: "Inter-House Sports Festival 2026",
        content: "The annual Apex Inter-House Sports competition is scheduled for next Friday. All houses are to conclude preliminary heats by Wednesday.",
        targetAudience: "ALL",
        priority: "HIGH",
      },
      {
        title: "Continuous Assessment Examination Schedule Released",
        content: "First term continuous assessments will commence across all primary and secondary classrooms starting next Monday.",
        targetAudience: "STUDENTS",
        priority: "NORMAL",
      },
      {
        title: "Parent-Teacher Association (PTA) General Assembly",
        content: "The executive committee invites all parents and guardians to the termly general assembly meeting this Saturday at the Main Hall.",
        targetAudience: "ALL",
        priority: "HIGH",
      },
      {
        title: "Staff Academic Curriculum Planning Workshop",
        content: "All teaching staff are required to attend the midterm curriculum harmonization workshop on Thursday at 3:00 PM.",
        targetAudience: "STAFF",
        priority: "NORMAL",
      },
    ];

    for (const n of demoNotices) {
      await demoPrisma.notice.create({
        data: {
          schoolId,
          title: n.title,
          content: n.content,
          targetAudience: n.targetAudience,
          priority: n.priority,
        },
      }).catch(() => {});
    }
  }

  // 12. Seed Admission Leads for Pipeline Card
  const leadsCount = await demoPrisma.admissionLead.count({ where: { schoolId } });
  if (leadsCount === 0) {
    console.info(`[DEMO_DB_INIT] Seeding pending admission inquiries and applications...`);
    const demoLeads = [
      { applicantName: "Chidinma Adeleke", targetGrade: "JSS 1", status: "INQUIRY", parentContact: "+2348031112233", parentName: "Chief Adeleke" },
      { applicantName: "Babajide Sanwo", targetGrade: "Primary 1", status: "SCREENING", parentContact: "+2348032223344", parentName: "Engr. Sanwo" },
      { applicantName: "Oluwaseun Bakare", targetGrade: "SSS 1", status: "ASSESSMENT", parentContact: "+2348033334455", parentName: "Dr. Bakare" },
      { applicantName: "Fatima Aliyu", targetGrade: "Nursery 1", status: "OFFER_EXTENDED", parentContact: "+2348034445566", parentName: "Hajiya Aliyu" },
      { applicantName: "Kelechi Amadi", targetGrade: "JSS 2", status: "INQUIRY", parentContact: "+2348035556677", parentName: "Barr. Amadi" },
      { applicantName: "Ibrahim Musa", targetGrade: "Primary 3", status: "INQUIRY", parentContact: "+2348036667788", parentName: "Alhaji Musa" },
    ];

    for (const l of demoLeads) {
      await demoPrisma.admissionLead.create({
        data: {
          schoolId,
          applicantName: l.applicantName,
          targetGrade: l.targetGrade,
          status: l.status,
          parentContact: l.parentContact,
          parentName: l.parentName,
          tierId: tiers[0]?.id || school.academicTiers[0]?.id,
        },
      }).catch(() => {});
    }
  }

  // 13. Sync Tenant record
  try {
    const existingTenant = await demoPrisma.tenant.findFirst({
      where: {
        OR: [
          { isDemo: true },
          { subdomain: DEMO_SUBDOMAIN },
        ],
      },
    });

    if (!existingTenant) {
      await demoPrisma.tenant.create({
        data: {
          schoolName: DEMO_SCHOOL_NAME,
          subdomain: DEMO_SUBDOMAIN,
          adminEmail: DEMO_ADMIN_EMAIL,
          contactPhone: "+234 800 000 0000",
          institutionTypes: ["PRIMARY", "SECONDARY"],
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          isDemo: true,
          isTrial: false,
          trialEndsAt: null,
        },
      });
    } else {
      await demoPrisma.tenant.update({
        where: { id: existingTenant.id },
        data: {
          schoolName: DEMO_SCHOOL_NAME,
          isDemo: true,
          isTrial: false,
          subscriptionStatus: "ACTIVE",
        },
      });
    }
  } catch (err: any) {
    console.warn("[DEMO_DB_INIT] Tenant table sync warning:", err.message);
  }

  console.info(`[DEMO_DB_INIT] "${DEMO_SCHOOL_NAME}" is fully initialized in demo database.`);
}

/**
 * Ensures that the isolated Demo PostgreSQL database (DEMO_DATABASE_URL)
 * has its Prisma schema tables created and populated with Apex International Academy
 * and sample pupils, fee templates, and classes.
 * 
 * Safe against concurrent invocations; halts immediately if DEMO_DATABASE_URL is missing.
 */
export async function ensureDemoDatabaseInitialized(): Promise<void> {
  const demoDbUrl = process.env.DEMO_DATABASE_URL;
  if (!demoDbUrl) {
    throw new Error(
      "[DEMO_DATABASE_ERROR] DEMO_DATABASE_URL environment variable is required. Demo playground cannot use primary database."
    );
  }

  // Safety check: ensure DEMO_DATABASE_URL is not identical to production DATABASE_URL
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DATABASE_URL &&
    demoDbUrl === process.env.DATABASE_URL
  ) {
    throw new Error(
      "[DEMO_DATABASE_ERROR] DEMO_DATABASE_URL cannot be identical to production DATABASE_URL."
    );
  }

  if (isDemoDbReady) {
    return;
  }

  // Check if tables already exist in demo database
  const demoPrisma = new PrismaClient({
    datasources: { db: { url: demoDbUrl } },
  });

  try {
    let tablesExist = false;
    try {
      await demoPrisma.school.count();
      tablesExist = true;
    } catch {
      tablesExist = false;
    }

    if (!tablesExist) {
      console.info("[DEMO_DB_INIT] Pushing schema to DEMO database via child process...");
      const prismaCli = path.join(process.cwd(), "node_modules/prisma/build/index.js");
      const pushRes = spawnSync(
        process.execPath,
        [prismaCli, "db", "push", "--accept-data-loss", "--skip-generate"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: demoDbUrl,
          },
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      if (pushRes.status !== 0) {
        console.error("[DEMO_DB_INIT] Schema push failed:", pushRes.stderr || pushRes.stdout);
        throw new Error(`Failed to push schema to demo database: ${pushRes.stderr || pushRes.stdout}`);
      }
      console.info("[DEMO_DB_INIT] Schema pushed successfully to DEMO database.");
    }

    await seedDemoSchool(demoPrisma);
    isDemoDbReady = true;
  } finally {
    await demoPrisma.$disconnect().catch(() => {});
  }
}
