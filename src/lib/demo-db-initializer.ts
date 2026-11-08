import { PrismaClient } from "@prisma/client";
import { spawnSync } from "child_process";
import path from "path";
import bcrypt from "bcryptjs";

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

  // 5. Ensure Staff & Admin Users exist
  const staffConfigs = [
    { firstName: "Demo", lastName: "Administrator", email: DEMO_ADMIN_EMAIL, role: "SCHOOL_ADMIN", title: "Administrator", salary: 350000 },
    { firstName: "Folake", lastName: "Adeyemi", email: "principal@demo.schoolerp.local", role: "PRINCIPAL", title: "Principal", salary: 450000 },
    { firstName: "Emeka", lastName: "Okafor", email: "bursar@demo.schoolerp.local", role: "BURSAR", title: "Bursar", salary: 380000 },
    { firstName: "Ayodeji", lastName: "Balogun", email: "teacher1@demo.schoolerp.local", role: "TEACHER", title: "Senior Teacher", salary: 250000 },
  ];

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

    await demoPrisma.staff.upsert({
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

  // 7. Ensure Course & Exam exist
  const secTier = tiers.find((t) => t.name.includes("Secondary")) || tiers[0];
  let course = await demoPrisma.course.findFirst({ where: { schoolId, code: "MTH101" } });
  if (!course) {
    course = await demoPrisma.course.create({
      data: {
        schoolId,
        tierId: secTier.id,
        name: "Mathematics",
        code: "MTH101",
      },
    });
  }

  let exam = await demoPrisma.exam.findFirst({ where: { schoolId, courseId: course.id } });
  if (!exam) {
    exam = await demoPrisma.exam.create({
      data: {
        schoolId,
        courseId: course.id,
        name: "First Term Continuous Assessment",
        semester: "First Term",
        date: new Date(),
        maxScore: 100,
      },
    });
  }

  // 8. Seed Dummy Students if count < 20
  const currentStudentCount = await demoPrisma.student.count({ where: { schoolId } });
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
  }

  // 9. Sync Tenant record
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
