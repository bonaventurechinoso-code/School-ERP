import { PrismaClient } from "@prisma/client";
import cron, { type ScheduledTask } from "node-cron";
import { basePrisma } from "./tenant-prisma";
import {
  invalidateStudentNamespace,
  invalidateStaffNamespace,
  invalidateFinanceNamespace,
  invalidateNamespace,
} from "./cache-invalidation";

declare global {
  // eslint-disable-next-line no-var
  var __demoCleanupCronTask: ScheduledTask | undefined;
  // eslint-disable-next-line no-var
  var __demoCleanupIsRunning: boolean | undefined;
}

export interface DemoCleanupResult {
  success: boolean;
  message: string;
  purgedTables: string[];
  studentsSeeded: number;
  invoicesSeeded: number;
  targetDatabase: string;
  timestamp: string;
  error?: string;
}

const firstNames = [
  "Emeka", "Amina", "Oluwaseun", "Chioma", "Chinedu", 
  "Fatima", "Ayodeji", "Ngozi", "Tunde", "Zainab", 
  "Kelechi", "Adeola", "Musa", "Blessing", "Chukwudi", 
  "Ifeoma", "Abubakar", "Funke", "Nnamdi", "Binta",
  "Damilola", "Somto", "Usman", "Eunice", "Femi"
];

const lastNames = [
  "Adebayo", "Okafor", "Danjuma", "Chukwu", "Balogun", 
  "Ibrahim", "Okoro", "Adeyemi", "Eze", "Mohammed", 
  "Ogunleye", "Nwosu", "Abiola", "Aliyu", "Obi", 
  "Ojo", "Umar", "Akinyemi", "Nwachukwu", "Sanusi"
];

const occupations = [
  "Engineer", "Trader", "Civil Servant", "Teacher", 
  "Doctor", "Business Executive", "Banker", "Lawyer", 
  "Architect", "Accountant"
];

const states = ["Lagos", "Abuja", "Rivers", "Kano", "Oyo", "Enugu", "Delta", "Kaduna"];

const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Resolves the isolated PostgreSQL database connection string specifically mapped
 * to the Demo School instance. Never returns a connection string that would mutate
 * master platform records or other functional school tenants.
 */
async function resolveDemoDatabaseConnection(): Promise<{ demoDbUrl: string; demoSchool: any }> {
  const demoDbUrl = process.env.DEMO_DATABASE_URL;

  if (!demoDbUrl) {
    throw new Error(
      "[DEMO_CLEANUP] DEMO_DATABASE_URL is not configured. Aborting cleanup to ensure Production database is never touched."
    );
  }

  const { getDemoPrismaClient } = await import("./tenant-prisma");
  const demoPrisma = getDemoPrismaClient();

  const demoSchool = await demoPrisma.school.findFirst({
    where: { subdomain: "demo" },
    include: {
      academicTiers: { orderBy: { level: "asc" } },
      tierDatabases: true,
      departments: true,
    },
  });

  if (!demoSchool) {
    throw new Error("Demo School instance (subdomain: 'demo') was not found in demo registry.");
  }

  return { demoDbUrl, demoSchool };
}

/**
 * Primary cleanup and re-seeding handler.
 * 1. Connects a Prisma Client directly to the Demo database.
 * 2. Purges user-injected clutter (Students, Grades, Payments, Notifications, Inquiries)
 *    within a transaction strictly isolated to demoSchool.id.
 * 3. Preserves base structural layouts (School, Tiers, Classrooms, Departments).
 * 4. Re-initializes 50 fresh dummy students with realistic CA scores, staff, fee invoices,
 *    and events so analytical graphs render cleanly.
 * 5. Invalidates Redis cache keys for instant dashboard refresh.
 */
export async function executeDemoCleanup(): Promise<DemoCleanupResult> {
  if (globalThis.__demoCleanupIsRunning) {
    console.warn("[DEMO_CLEANUP] Cleanup is already currently running. Skipping duplicate trigger.");
    return {
      success: false,
      message: "Cleanup is already in progress.",
      purgedTables: [],
      studentsSeeded: 0,
      invoicesSeeded: 0,
      targetDatabase: "busy",
      timestamp: new Date().toISOString(),
    };
  }

  globalThis.__demoCleanupIsRunning = true;

  const startTime = Date.now();
  let demoPrisma: PrismaClient | null = null;
  let maskedUrl = "unknown";

  try {
    const { demoDbUrl, demoSchool } = await resolveDemoDatabaseConnection();
    maskedUrl = demoDbUrl.replace(/:[^:@]+@/, ":****@");
    console.info(`[DEMO_CLEANUP] Starting isolated cleanup targeting: ${maskedUrl} (School ID: ${demoSchool.id})`);

    demoPrisma = new PrismaClient({
      datasources: { db: { url: demoDbUrl } },
    });

    const schoolId = demoSchool.id;
    const purgedTables: string[] = [];

    // STEP 1: TRANSACTIONAL DATA PURGE OF USER-INJECTED CLUTTER
    // Strict order: child records before parent records
    await demoPrisma.$transaction(async (tx) => {
      // 1. Clear Assessment & Exam Clutter
      await tx.examResult.deleteMany({ where: { schoolId } });
      purgedTables.push("ExamResult");

      await tx.gradeRecord.deleteMany({ where: { schoolId } });
      purgedTables.push("GradeRecord");

      await tx.reportCard.deleteMany({ where: { schoolId } });
      purgedTables.push("ReportCard");

      await tx.academicRecord.deleteMany({ where: { schoolId } });
      purgedTables.push("AcademicRecord");

      // 2. Clear Attendance
      await tx.studentAttendance.deleteMany({ where: { schoolId } });
      purgedTables.push("StudentAttendance");

      await tx.staffAttendance.deleteMany({ where: { schoolId } });
      purgedTables.push("StaffAttendance");

      // 3. Clear Financial Transactions, Payments, and Invoices
      await tx.payment.deleteMany({ where: { schoolId } });
      purgedTables.push("Payment");

      await tx.invoice.deleteMany({ where: { schoolId } });
      purgedTables.push("Invoice");

      await tx.transaction.deleteMany({ where: { schoolId } });
      purgedTables.push("Transaction");

      await tx.payrollRecord.deleteMany({ where: { schoolId } });
      purgedTables.push("PayrollRecord");

      // 4. Clear CRM & Communications Clutter
      await tx.admissionLead.deleteMany({ where: { schoolId } });
      purgedTables.push("AdmissionLead");

      await tx.notice.deleteMany({ where: { schoolId } });
      purgedTables.push("Notice");

      await tx.messageLog.deleteMany({ where: { schoolId } });
      purgedTables.push("MessageLog");

      // 5. Clear User-Injected Students
      await tx.student.deleteMany({ where: { schoolId } });
      purgedTables.push("Student");

      // 6. Clear Non-Admin Staff Clutter (Preserves or resets default admin)
      await tx.staff.deleteMany({ where: { schoolId, user: { role: { not: "SCHOOL_ADMIN" } } } });
      purgedTables.push("Staff");
    });

    console.info(`[DEMO_CLEANUP] Successfully purged ${purgedTables.length} clutter tables.`);

    // STEP 2: ENSURE STRUCTURAL LOOKUP DATA (TIERS, DEPARTMENTS, CLASSROOMS)
    let tiers = await demoPrisma.academicTier.findMany({
      where: { schoolId },
      orderBy: { level: "asc" },
    });

    if (tiers.length === 0) {
      const defaultTiers = [
        { name: "Creche / Nursery", level: 1 },
        { name: "Primary School", level: 2 },
        { name: "Secondary School", level: 3 },
        { name: "Higher Institution / University", level: 4 },
      ];
      for (const t of defaultTiers) {
        await demoPrisma.academicTier.create({
          data: { schoolId, name: t.name, level: t.level },
        });
      }
      tiers = await demoPrisma.academicTier.findMany({
        where: { schoolId },
        orderBy: { level: "asc" },
      });
    }

    // Ensure Department exists
    let adminDept = await demoPrisma.department.findFirst({
      where: { schoolId },
    });
    if (!adminDept) {
      adminDept = await demoPrisma.department.create({
        data: { schoolId, name: "Academic Administration" },
      });
    }

    // Ensure Classrooms exist across all tiers
    const tierClassMap: Record<string, string[]> = {
      "Creche / Nursery": ["Crèche", "Nursery 1", "Nursery 2"],
      "Primary School": ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
      "Secondary School": ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
      "Higher Institution / University": ["100 Level", "200 Level", "300 Level", "400 Level"],
    };

    const classroomRecords: Record<string, any[]> = {};

    for (const tier of tiers) {
      const classNames = tierClassMap[tier.name] || [`Class ${tier.name}`];
      classroomRecords[tier.id] = [];

      for (const className of classNames) {
        let classroom = await demoPrisma.classroom.findFirst({
          where: { schoolId, tierId: tier.id, name: className },
        });
        if (!classroom) {
          classroom = await demoPrisma.classroom.create({
            data: { schoolId, tierId: tier.id, name: className, capacity: 35 },
          });
        }
        classroomRecords[tier.id].push(classroom);
      }
    }

    // Ensure baseline Courses and Exams exist for Secondary School
    const secondaryTier = tiers.find((t) => t.name.includes("Secondary")) || tiers[0];
    let course = await demoPrisma.course.findFirst({
      where: { schoolId, tierId: secondaryTier.id, code: "MTH101" },
    });
    if (!course) {
      course = await demoPrisma.course.create({
        data: {
          schoolId,
          tierId: secondaryTier.id,
          name: "Mathematics",
          code: "MTH101",
        },
      });
    }

    let exam = await demoPrisma.exam.findFirst({
      where: { schoolId, courseId: course.id, name: "First Term Continuous Assessment" },
    });
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

    // Ensure Fee Template exists
    let feeTemplate = await demoPrisma.feeTemplate.findFirst({
      where: { schoolId },
    });
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

    // STEP 3: SEED 50 FRESH DUMMY STUDENTS ACROSS TIERS WITH ANALYTICS
    // Distribution: Creche: 10, Primary: 15, Secondary: 15, Higher Ed: 10 (Total: 50)
    const tierDistribution = [
      { tierIndex: 0, count: 10 },
      { tierIndex: 1, count: 15 },
      { tierIndex: 2, count: 15 },
      { tierIndex: 3, count: 10 },
    ];

    let studentIndex = 1;
    let seededStudentsCount = 0;
    let seededInvoicesCount = 0;

    for (const dist of tierDistribution) {
      const tier = tiers[dist.tierIndex] || tiers[0];
      const availableClasses = classroomRecords[tier.id] || [];

      for (let i = 0; i < dist.count; i++) {
        const firstName = getRandom(firstNames);
        const lastName = getRandom(lastNames);
        const seq = String(studentIndex).padStart(3, "0");
        const admissionNumber = `DEM/2026/${seq}`;
        const assignedClass = availableClasses.length > 0 ? getRandom(availableClasses).name : "General Class";
        const isAlumni = studentIndex > 45; // 5 alumni students for status distribution metrics

        const student = await demoPrisma.student.create({
          data: {
            schoolId,
            tierId: tier.id,
            firstName,
            lastName,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${studentIndex}@demo.schoolerp.local`,
            status: isAlumni ? "ALUMNI" : "ENROLLED",
            admissionNumber,
            currentClass: assignedClass,
            dynamicFields: { gender: studentIndex % 2 === 0 ? "FEMALE" : "MALE" },
            dateOfBirth: new Date(Date.now() - getInt(6, 18) * 365 * 24 * 60 * 60 * 1000),
            stateOfOrigin: getRandom(states),
            parentName: `Alhaji/Dr. ${lastName}`,
            parentEmail: `parent.${lastName.toLowerCase()}${studentIndex}@example.com`,
            parentPhone: `+234${getInt(7000000000, 9099999999)}`,
            parentOccupation: getRandom(occupations),
          },
        });

        seededStudentsCount++;

        // Generate ExamResult with CA breakdown for Secondary Tier to power grade distribution graphs
        if (tier.id === secondaryTier.id && exam) {
          const ca1 = getInt(10, 15);
          const ca2 = getInt(10, 15);
          const examScore = getInt(35, 68);
          const totalScore = ca1 + ca2 + examScore;

          let letterGrade = "F9";
          if (totalScore >= 75) letterGrade = "A1";
          else if (totalScore >= 70) letterGrade = "B2";
          else if (totalScore >= 65) letterGrade = "B3";
          else if (totalScore >= 60) letterGrade = "C4";
          else if (totalScore >= 55) letterGrade = "C5";
          else if (totalScore >= 50) letterGrade = "C6";
          else if (totalScore >= 45) letterGrade = "D7";

          await demoPrisma.examResult.create({
            data: {
              schoolId,
              examId: exam.id,
              studentId: student.id,
              score: totalScore,
              ca1Score: ca1,
              ca2Score: ca2,
              examScore: examScore,
              letterGrade,
            },
          });
        }

        // Generate Invoices and Payments for Financial Analytics
        if (!isAlumni && feeTemplate) {
          const isPaid = studentIndex % 3 === 0;
          const isPartial = studentIndex % 3 === 1;
          const invoiceAmount = feeTemplate.defaultAmount;
          const invoiceStatus = isPaid ? "PAID" : isPartial ? "PARTIAL" : "PENDING";

          const invoice = await demoPrisma.invoice.create({
            data: {
              schoolId,
              studentId: student.id,
              feeTemplateId: feeTemplate.id,
              amountDue: invoiceAmount,
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              status: invoiceStatus,
              description: "Termly Standard Tuition Fee",
            },
          });

          seededInvoicesCount++;

          if (isPaid || isPartial) {
            const amountPaid = isPaid ? invoiceAmount : invoiceAmount / 2;
            await demoPrisma.payment.create({
              data: {
                schoolId,
                studentId: student.id,
                invoiceId: invoice.id,
                amountPaid,
                paymentDate: new Date(),
                method: studentIndex % 2 === 0 ? "TRANSFER" : "CARD",
              },
            });
          }
        }

        studentIndex++;
      }
    }

    // STEP 4: SEED BASELINE STAFF & FACULTY
    const facultyData = [
      { firstName: "Demo", lastName: "Admin", email: "demo.admin@schoolerp.local", role: "ADMIN" },
      { firstName: "Ngozi", lastName: "Eze", email: "ngozi.eze@demo.schoolerp.local", role: "TEACHER" },
      { firstName: "Ayodeji", lastName: "Balogun", email: "ayodeji.b@demo.schoolerp.local", role: "TEACHER" },
      { firstName: "Musa", lastName: "Ibrahim", email: "musa.ibrahim@demo.schoolerp.local", role: "TEACHER" },
      { firstName: "Funke", lastName: "Ojo", email: "bursar.demo@schoolerp.local", role: "BURSAR" },
    ];

    for (const f of facultyData) {
      const existingStaff = await demoPrisma.staff.findFirst({
        where: { schoolId, email: f.email },
      });
      if (!existingStaff) {
        let user = await demoPrisma.user.findFirst({
          where: { schoolId, email: f.email },
        });
        if (!user) {
          user = await demoPrisma.user.create({
            data: {
              schoolId,
              email: f.email,
              role: (f.role === "ADMIN" ? "SCHOOL_ADMIN" : f.role) as any,
              passwordHash: "",
              mustChangePassword: false,
            },
          });
        }
        await demoPrisma.staff.create({
          data: {
            schoolId,
            userId: user.id,
            departmentId: adminDept?.id,
            firstName: f.firstName,
            lastName: f.lastName,
            email: f.email,
            status: "ACTIVE",
            baseSalary: 150000,
          },
        });
      }
    }

    // STEP 5: SEED NOTICES & ANNOUNCEMENTS FOR EVENTS STATUS CARD
    const noticesData = [
      {
        title: "Parent-Teacher Association (PTA) General Meeting",
        content: "The termly PTA conference will convene this Friday at 10:00 AM in the Central Auditorium.",
        priority: "HIGH",
        targetAudience: "ALL",
      },
      {
        title: "Mid-Term Academic Progress Assessments",
        content: "Assessment tests for primary and secondary classes commence next Monday. All continuous assessment portals are open.",
        priority: "NORMAL",
        targetAudience: "STAFF",
      },
    ];

    for (const n of noticesData) {
      await demoPrisma.notice.create({
        data: {
          schoolId,
          title: n.title,
          content: n.content,
          priority: n.priority,
          targetAudience: n.targetAudience,
        },
      });
    }

    // STEP 6: SEED ADMISSION CRM LEADS FOR APPLICANT PIPELINE CARD
    const pipelineData = [
      { name: "Chisom Danjuma", grade: "Primary 1", status: "INQUIRY" },
      { name: "Bilal Mohammed", grade: "JSS 1", status: "APPLIED" },
      { name: "Kamsi Okoro", grade: "Crèche", status: "INTERVIEW" },
      { name: "Tariq Adebayo", grade: "SSS 1", status: "APPROVED" },
    ];

    for (const lead of pipelineData) {
      await demoPrisma.admissionLead.create({
        data: {
          schoolId,
          tierId: secondaryTier.id,
          applicantName: lead.name,
          targetGrade: lead.grade,
          status: lead.status,
          parentContact: "+2348012345678",
          parentEmail: "applicant.parent@example.com",
        },
      });
    }

    // STEP 7: INVALIDATE REDIS CACHE
    try {
      await Promise.all([
        invalidateStudentNamespace(schoolId),
        invalidateStaffNamespace(schoolId),
        invalidateFinanceNamespace(schoolId),
        invalidateNamespace(`cache:tenant:${schoolId}:*`),
      ]);
      console.info(`[DEMO_CLEANUP] Successfully purged Redis cache keys for Demo School (${schoolId}).`);
    } catch (cacheErr: any) {
      console.warn("[DEMO_CLEANUP] Non-blocking Redis cache invalidation warning:", cacheErr?.message || cacheErr);
    }

    const duration = Date.now() - startTime;
    console.info(`[DEMO_CLEANUP] Cleanup & re-seed complete in ${duration}ms. Seeded ${seededStudentsCount} students, ${seededInvoicesCount} invoices.`);

    return {
      success: true,
      message: `Demo database purged and successfully re-seeded with ${seededStudentsCount} fresh students and analytical metrics.`,
      purgedTables,
      studentsSeeded: seededStudentsCount,
      invoicesSeeded: seededInvoicesCount,
      targetDatabase: maskedUrl,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("[DEMO_CLEANUP_CRITICAL_ERROR]:", error);
    return {
      success: false,
      message: "Failed to execute demo database cleanup routine.",
      purgedTables: [],
      studentsSeeded: 0,
      invoicesSeeded: 0,
      targetDatabase: maskedUrl,
      timestamp: new Date().toISOString(),
      error: error?.message || String(error),
    };
  } finally {
    globalThis.__demoCleanupIsRunning = false;
    if (demoPrisma) {
      await demoPrisma.$disconnect().catch(() => {});
    }
  }
}

/**
 * Initializes the background recurring cron task (every 3 hours).
 * Protects against duplicate timers during hot-module replacement in development.
 */
export function startDemoCleanupCron(): void {
  if (globalThis.__demoCleanupCronTask) {
    console.info("[DEMO_CLEANUP_CRON] Background scheduler task is already running.");
    return;
  }

  const CRON_EXPRESSION = "0 */3 * * *";

  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(`[DEMO_CLEANUP_CRON] Invalid cron expression: ${CRON_EXPRESSION}`);
    return;
  }

  console.info(`[DEMO_CLEANUP_CRON] Initializing Demo Cleanup scheduler (schedule: '${CRON_EXPRESSION}')...`);

  globalThis.__demoCleanupCronTask = cron.schedule(CRON_EXPRESSION, async () => {
    console.info(`[DEMO_CLEANUP_CRON] Executing scheduled 3-hour demo cleanup at ${new Date().toISOString()}...`);
    try {
      const result = await executeDemoCleanup();
      console.info("[DEMO_CLEANUP_CRON] Scheduled execution finished:", result.message);
    } catch (cronErr: any) {
      console.error("[DEMO_CLEANUP_CRON_SCHEDULED_FAILURE]:", cronErr?.message || cronErr);
    }
  });
}
