const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function verifyCommunicationsDirect() {
  console.log("=================================================================");
  console.log("   DIRECT DATABASE VERIFICATION: COMMUNICATIONS & NOTICES        ");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    const school = await prisma.school.findFirst({
      where: { subdomain: "greenwood" },
      include: {
        academicTiers: true,
        staff: true,
        students: { take: 5 }
      }
    });

    if (!school) {
      console.error("❌ Greenwood Academy not found.");
      process.exit(1);
    }

    console.log(`🏫 School: ${school.name} (${school.subdomain})`);
    console.log(`📚 Academic Tiers: ${school.academicTiers.map(t => t.name).join(", ")}`);
    console.log(`👨‍🏫 Faculty count: ${school.staff.length}`);
    console.log(`🎓 Sample Students count: ${school.students.length}\n`);

    // --- TEST 1: Create Announcement Bulletin ---
    console.log("--- TEST 1: Notice Creation & Priority Tagging ---");
    const testNotice = await prisma.notice.create({
      data: {
        schoolId: school.id,
        title: "Test Resumption Advisory for 2026",
        content: "All students and staff must assemble in the school auditorium by 08:00 AM.",
        targetAudience: "ALL",
        priority: "HIGH"
      }
    });
    assert(testNotice.id !== undefined && testNotice.priority === "HIGH", "Notice created with ID: " + testNotice.id);

    // --- TEST 2: Notice Retrieval by Audience ---
    console.log("\n--- TEST 2: Query Notices by Target Audience ---");
    const foundNotice = await prisma.notice.findFirst({
      where: {
        schoolId: school.id,
        id: testNotice.id
      }
    });
    assert(foundNotice !== null && foundNotice.title === testNotice.title, "Notice successfully queried from database");

    // --- TEST 3: MessageLog Creation & Multi-Channel Tracking ---
    console.log("\n--- TEST 3: MessageLog Audit Record Creation ---");
    const testLog = await prisma.messageLog.create({
      data: {
        schoolId: school.id,
        recipientEmail: "parent.test@example.com",
        recipientType: "PARENT",
        messageType: "SMS",
        subject: "Urgent Fee Payment Reminder",
        body: "Your child's tuition balance is due before mid-term assessments."
      }
    });
    assert(testLog.id !== undefined && testLog.messageType === "SMS", "MessageLog recorded with ID: " + testLog.id);

    // --- TEST 4: Query MessageLogs by Channel & Recipient ---
    console.log("\n--- TEST 4: Query MessageLogs by Filters ---");
    const filteredLogs = await prisma.messageLog.findMany({
      where: {
        schoolId: school.id,
        messageType: "SMS",
        recipientType: "PARENT"
      }
    });
    assert(filteredLogs.length > 0, "Successfully queried filtered MessageLogs (count: " + filteredLogs.length + ")");

    // Clean up test records
    await prisma.notice.delete({ where: { id: testNotice.id } });
    await prisma.messageLog.delete({ where: { id: testLog.id } });
    console.log("\n   Cleaned up test notice and test message log");

    console.log("\n=================================================================");
    console.log(`  DIRECT COMMUNICATIONS VERIFICATION: ${passed} PASSED / ${failed} FAILED`);
    console.log("=================================================================\n");

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error("❌ Direct DB verification error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCommunicationsDirect();
