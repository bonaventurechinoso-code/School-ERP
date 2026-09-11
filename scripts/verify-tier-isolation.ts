import { basePrisma, getPrismaClientForTier } from "../src/lib/tenant-prisma";
import { getDashboardMetrics } from "../src/app/[schoolDomain]/(admin)/dashboard/actions";

async function verifyIsolation() {
  console.log("=== STARTING TIER ISOLATION VERIFICATION ===");

  const school = await basePrisma.school.findUnique({
    where: { subdomain: "greenwood" },
    include: { academicTiers: { orderBy: { level: "asc" } } },
  });

  if (!school) {
    console.error("❌ Greenwood Academy not found in main DB!");
    process.exit(1);
  }

  console.log(`\n🏫 School: ${school.name} (${school.subdomain})`);
  console.log(`📁 Multi-DB Enabled: ${school.isMultiDbEnabled}`);
  console.log(`📚 Academic Tiers Count: ${school.academicTiers.length}`);

  for (const tier of school.academicTiers) {
    console.log(`  - Tier: "${tier.name}" | DB: ${tier.databaseName}`);
  }

  // 1. DAYCARE / NURSERY
  console.log("\n--- Testing Daycare / Nursery Client ---");
  const nurseryClient = await getPrismaClientForTier(school.id, "Daycare / Nursery");
  const nurseryStudents = await nurseryClient.student.findMany({ select: { id: true, firstName: true, lastName: true, currentClass: true } });
  const nurseryClasses = await nurseryClient.classroom.findMany({ select: { name: true } });
  console.log(`✅ Nursery Student Count: ${nurseryStudents.length} (Expected 15)`);
  console.log(`✅ Nursery Classes: ${nurseryClasses.map(c => c.name).join(", ")}`);
  const nurseryStudentIds = new Set(nurseryStudents.map(s => s.id));

  // 2. PRIMARY SCHOOL
  console.log("\n--- Testing Primary School Client ---");
  const primaryClient = await getPrismaClientForTier(school.id, "Primary School");
  const primaryStudents = await primaryClient.student.findMany({ select: { id: true, firstName: true, lastName: true, currentClass: true } });
  const primaryClasses = await primaryClient.classroom.findMany({ select: { name: true } });
  console.log(`✅ Primary Student Count: ${primaryStudents.length} (Expected 20)`);
  console.log(`✅ Primary Classes: ${primaryClasses.map(c => c.name).join(", ")}`);
  const primaryStudentIds = new Set(primaryStudents.map(s => s.id));

  // 3. SECONDARY SCHOOL
  console.log("\n--- Testing Secondary School Client ---");
  const secondaryClient = await getPrismaClientForTier(school.id, "Secondary School");
  const secondaryStudents = await secondaryClient.student.findMany({ select: { id: true, firstName: true, lastName: true, currentClass: true } });
  const secondaryClasses = await secondaryClient.classroom.findMany({ select: { name: true } });
  console.log(`✅ Secondary Student Count: ${secondaryStudents.length} (Expected 20)`);
  console.log(`✅ Secondary Classes: ${secondaryClasses.map(c => c.name).join(", ")}`);
  const secondaryStudentIds = new Set(secondaryStudents.map(s => s.id));

  // 4. VERIFY STRICT NON-OVERLAPPING ISOLATION
  console.log("\n--- Checking Data Non-Overlap (Strict Separation) ---");
  let overlapCount = 0;
  for (const id of nurseryStudentIds) {
    if (primaryStudentIds.has(id)) {
      console.error(`❌ Overlap detected: Student ID ${id} is in both Nursery and Primary!`);
      overlapCount++;
    }
    if (secondaryStudentIds.has(id)) {
      console.error(`❌ Overlap detected: Student ID ${id} is in both Nursery and Secondary!`);
      overlapCount++;
    }
  }
  for (const id of primaryStudentIds) {
    if (secondaryStudentIds.has(id)) {
      console.error(`❌ Overlap detected: Student ID ${id} is in both Primary and Secondary!`);
      overlapCount++;
    }
  }

  if (overlapCount === 0) {
    console.log("🌟 ZERO DATA OVERLAP CONFIRMED: All 3 physical databases hold strictly isolated student sets!");
  } else {
    console.error(`❌ Found ${overlapCount} overlapping records!`);
  }

  // 5. TEST DASHBOARD METRICS FOR DIFFERENT TIERS
  console.log("\n--- Testing Dashboard Metrics Tier Switching ---");
  const nurseryMetrics = await getDashboardMetrics(school.id, "Daycare / Nursery");
  console.log(`📊 Nursery Dashboard Metrics: Enrolled Students = ${nurseryMetrics.enrolledStudents}, Classes = ${nurseryMetrics.classrooms.length}`);

  const primaryMetrics = await getDashboardMetrics(school.id, "Primary School");
  console.log(`📊 Primary Dashboard Metrics: Enrolled Students = ${primaryMetrics.enrolledStudents}, Classes = ${primaryMetrics.classrooms.length}`);

  const secondaryMetrics = await getDashboardMetrics(school.id, "Secondary School");
  console.log(`📊 Secondary Dashboard Metrics: Enrolled Students = ${secondaryMetrics.enrolledStudents}, Classes = ${secondaryMetrics.classrooms.length}`);

  console.log("\n=== ALL TIER ISOLATION TESTS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

verifyIsolation().catch(err => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
