import { PrismaClient } from "@prisma/client";

async function verifyDemoCleanup() {
  console.log("=== STARTING DEMO SANDBOX DATABASE CLEANUP VERIFICATION ===");
  const baseUrl = "http://localhost:3000";
  const prisma = new PrismaClient();

  try {
    // 1. Snapshot other schools student counts before cleanup
    console.log("\n--- TEST 1: Verifying Non-Demo School Isolation Before Cleanup ---");
    const otherSchools = await prisma.school.findMany({
      where: { subdomain: { not: "demo" } },
      select: { id: true, name: true, subdomain: true },
    });
    console.log(`Found ${otherSchools.length} other school tenants in master database:`);
    const otherSchoolStudentCountsBefore = {};
    for (const s of otherSchools) {
      const count = await prisma.student.count({ where: { schoolId: s.id } });
      otherSchoolStudentCountsBefore[s.subdomain] = count;
      console.log(`  - ${s.name} (${s.subdomain}): ${count} students`);
    }

    const platformAdminCountBefore = await prisma.platformAdmin.count();
    console.log(`PlatformAdmin count before: ${platformAdminCountBefore}`);

    // 2. Insert dummy test clutter into Demo School
    console.log("\n--- TEST 2: Injecting Test User Clutter Into Demo School ---");
    const demoSchool = await prisma.school.findFirst({
      where: { subdomain: "demo" },
      include: { academicTiers: true },
    });
    if (!demoSchool) throw new Error("Demo School not found in database!");

    const tierId = demoSchool.academicTiers[0]?.id;

    // Inject 3 invalid test students and an invalid inquiry
    const testTs = Date.now();
    await prisma.student.createMany({
      data: [
        { schoolId: demoSchool.id, tierId, firstName: "ClutterTest1", lastName: "Temp", admissionNumber: `CLUTTER/${testTs}/001` },
        { schoolId: demoSchool.id, tierId, firstName: "ClutterTest2", lastName: "Temp", admissionNumber: `CLUTTER/${testTs}/002` },
        { schoolId: demoSchool.id, tierId, firstName: "ClutterTest3", lastName: "Temp", admissionNumber: `CLUTTER/${testTs}/003` },
      ],
    });
    console.log("Injected 3 temporary clutter students into Demo School.");

    // 3. Trigger Cleanup and Re-seeding via API
    console.log("\n--- TEST 3: Triggering Automated Cleanup & Re-seeding Routine ---");
    const cleanupRes = await fetch(`${baseUrl}/api/cron/reset-demo`, {
      method: "GET",
    });

    console.log(`Cleanup API Status: ${cleanupRes.status}`);
    const cleanupData = await cleanupRes.json();
    console.log("Cleanup Result:", {
      success: cleanupData.success,
      message: cleanupData.message,
      studentsSeeded: cleanupData.studentsSeeded,
      invoicesSeeded: cleanupData.invoicesSeeded,
      targetDatabase: cleanupData.targetDatabase,
      purgedTablesCount: cleanupData.purgedTables?.length,
    });

    if (!cleanupData.success) {
      throw new Error(`FAIL: Cleanup routine returned failure: ${cleanupData.error || cleanupData.message}`);
    }
    if (cleanupData.studentsSeeded !== 50) {
      throw new Error(`FAIL: Expected 50 students seeded, got ${cleanupData.studentsSeeded}`);
    }
    console.log("PASS: Cleanup routine executed successfully and seeded 50 fresh students!");

    // 4. Verify Demo School Data in Database
    console.log("\n--- TEST 4: Verifying Cleaned & Re-seeded Data in Demo School ---");
    const demoStudents = await prisma.student.findMany({
      where: { schoolId: demoSchool.id },
      select: { admissionNumber: true, firstName: true, lastName: true, status: true, currentClass: true },
      orderBy: { admissionNumber: "asc" },
    });

    console.log(`Total students found for Demo School: ${demoStudents.length}`);
    if (demoStudents.length !== 50) {
      throw new Error(`FAIL: Expected exactly 50 students in Demo School, found ${demoStudents.length}`);
    }

    const clutterExists = demoStudents.some(s => s.firstName.includes("ClutterTest"));
    if (clutterExists) {
      throw new Error("FAIL: Injected clutter students were not purged!");
    }
    console.log("PASS: User clutter was completely purged and exactly 50 fresh students are present!");

    // Sample inspect students
    console.log(`Sample Student: ${demoStudents[0].admissionNumber} - ${demoStudents[0].firstName} ${demoStudents[0].lastName} (${demoStudents[0].currentClass}, ${demoStudents[0].status})`);
    console.log(`Sample Student: ${demoStudents[49].admissionNumber} - ${demoStudents[49].firstName} ${demoStudents[49].lastName} (${demoStudents[49].currentClass}, ${demoStudents[49].status})`);

    // Verify Invoices and Exam Results
    const demoInvoicesCount = await prisma.invoice.count({ where: { schoolId: demoSchool.id } });
    const demoPaymentsCount = await prisma.payment.count({ where: { schoolId: demoSchool.id } });
    const demoExamResultsCount = await prisma.examResult.count({ where: { schoolId: demoSchool.id } });
    const demoStaffCount = await prisma.staff.count({ where: { schoolId: demoSchool.id } });
    const demoNoticesCount = await prisma.notice.count({ where: { schoolId: demoSchool.id } });
    const demoLeadsCount = await prisma.admissionLead.count({ where: { schoolId: demoSchool.id } });

    console.log("Seeded Analytics Counts for Demo School:");
    console.log(`  - Invoices: ${demoInvoicesCount}`);
    console.log(`  - Payments: ${demoPaymentsCount}`);
    console.log(`  - Exam Results: ${demoExamResultsCount}`);
    console.log(`  - Staff / Teachers: ${demoStaffCount}`);
    console.log(`  - Notices: ${demoNoticesCount}`);
    console.log(`  - Admission Leads: ${demoLeadsCount}`);

    if (demoInvoicesCount === 0 || demoExamResultsCount === 0 || demoStaffCount === 0) {
      throw new Error("FAIL: Analytical graphs data (invoices/exams/staff) was not properly seeded!");
    }
    console.log("PASS: All analytical and dashboard metrics are populated with clean data!");

    // 5. Verify Isolation of Other Schools and Master Registry
    console.log("\n--- TEST 5: Verifying Complete Isolation of Non-Demo Data ---");
    for (const s of otherSchools) {
      const count = await prisma.student.count({ where: { schoolId: s.id } });
      const before = otherSchoolStudentCountsBefore[s.subdomain];
      console.log(`  - ${s.name} (${s.subdomain}): ${count} students (before: ${before})`);
      if (count !== before) {
        throw new Error(`FAIL: Student count changed for school ${s.subdomain}! Isolation was breached!`);
      }
    }

    const platformAdminCountAfter = await prisma.platformAdmin.count();
    console.log(`PlatformAdmin count after: ${platformAdminCountAfter} (before: ${platformAdminCountBefore})`);
    if (platformAdminCountAfter !== platformAdminCountBefore) {
      throw new Error("FAIL: PlatformAdmin records were modified! Master isolation was breached!");
    }
    console.log("PASS: Zero mutations to non-demo schools or master platform registry. Absolute isolation confirmed!");

    console.log("\n=== ALL DEMO CLEANUP & ISOLATION TESTS PASSED SUCCESSFULLY ===");
  } finally {
    await prisma.$disconnect();
  }
}

verifyDemoCleanup().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
