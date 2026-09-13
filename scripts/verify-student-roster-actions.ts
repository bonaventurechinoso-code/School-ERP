import { basePrisma, getPrismaClientForTier, resolveTierIdForTierDb } from "../src/lib/tenant-prisma";
import { 
  fetchStudentMetrics, 
  toggleStudentSuspension, 
  graduateTierCohort 
} from "../src/app/[schoolDomain]/(admin)/students/actions";

async function verifyStudentRosterActions() {
  console.log("==================================================================");
  console.log("🎓 VERIFYING STUDENT ROSTER ACTIONS & METRICS SYNC");
  console.log("==================================================================");

  // 1. Fetch Greenwood Academy
  const school = await basePrisma.school.findUnique({
    where: { subdomain: "greenwood" },
    include: { academicTiers: true },
  });

  if (!school) {
    console.error("❌ Greenwood Academy tenant not found in central database!");
    process.exit(1);
  }

  const primaryTier = school.academicTiers.find(t => t.name.toLowerCase().includes("primary"));
  if (!primaryTier) {
    console.error("❌ Primary School tier missing!");
    process.exit(1);
  }

  console.log(`🏫 Tenant: ${school.name} (${school.subdomain})`);
  console.log(`📚 Target Tier: ${primaryTier.name} (ID: ${primaryTier.id})`);

  const primaryDb = await getPrismaClientForTier(school.id, "Primary School");
  const isolatedTierId = await resolveTierIdForTierDb(primaryDb, school.id, {
    id: primaryTier.id,
    name: primaryTier.name,
    level: primaryTier.level,
  });

  // =========================================================================
  // TEST 1: FETCH DYNAMIC STUDENT METRICS
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("📊 TEST 1: Dynamic Student Metrics Count Query");
  console.log("------------------------------------------------------------------");

  const initialMetrics = await fetchStudentMetrics(school.id, "Primary School", isolatedTierId);
  console.log("Initial Dynamic Metrics from Isolated Tier Database:");
  console.log(`   - Total Enrolled:    ${initialMetrics.totalEnrolled}`);
  console.log(`   - Suspended:         ${initialMetrics.suspendedStudents}`);
  console.log(`   - Alumni:            ${initialMetrics.alumniCount}`);

  if (typeof initialMetrics.totalEnrolled !== "number" || typeof initialMetrics.suspendedStudents !== "number") {
    throw new Error("❌ fetchStudentMetrics returned invalid shape!");
  }
  console.log("✅ TEST 1 PASSED: Dynamic metrics successfully fetched from isolated tier DB!");

  // =========================================================================
  // TEST 2: SUSPENSION TOGGLE MECHANICS
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🔒 TEST 2: Student Suspension & Portal Credential Toggle");
  console.log("------------------------------------------------------------------");

  const testStudentReg = `TEST-SUSP-${Date.now().toString().slice(-4)}`;
  const testStudent = await primaryDb.student.create({
    data: {
      schoolId: school.id,
      tierId: isolatedTierId,
      firstName: "Chinedu",
      lastName: "TestStudent",
      currentClass: "Class 4",
      status: "ENROLLED",
      admissionNumber: testStudentReg,
      parentEmail: `parent.${testStudentReg.toLowerCase()}@test.com`,
    }
  });

  console.log(`Created temporary test student: ${testStudent.firstName} ${testStudent.lastName} (${testStudent.admissionNumber}) [Status: ${testStudent.status}]`);

  // Toggle to SUSPENDED
  const suspendResult = await toggleStudentSuspension(school.id, testStudent.id, "Primary School");
  if (!suspendResult.success || suspendResult.newStatus !== "SUSPENDED") {
    throw new Error(`❌ Failed to suspend student: ${suspendResult.error}`);
  }

  const suspendedInDb = await primaryDb.student.findUnique({ where: { id: testStudent.id } });
  const suspendedFields = suspendedInDb?.dynamicFields as Record<string, any> | null;
  console.log(`Student status after suspend: ${suspendedInDb?.status}`);
  console.log(`dynamicFields.portalAccessDisabled: ${suspendedFields?.portalAccessDisabled}`);

  if (suspendedInDb?.status !== "SUSPENDED" || suspendedFields?.portalAccessDisabled !== true) {
    throw new Error("❌ Student suspension did not persist properly in DB or portal access flag missing!");
  }

  // Check metrics reflect suspended increment
  const postSuspendMetrics = await fetchStudentMetrics(school.id, "Primary School", primaryTier.id);
  console.log(`Metrics after suspension: Suspended count = ${postSuspendMetrics.suspendedStudents}`);
  if (postSuspendMetrics.suspendedStudents !== initialMetrics.suspendedStudents + 1) {
    throw new Error("❌ Metric overview card count for suspended students did not increment!");
  }

  // Toggle back to ENROLLED (Reinstate)
  const reinstateResult = await toggleStudentSuspension(school.id, testStudent.id, "Primary School");
  if (!reinstateResult.success || reinstateResult.newStatus !== "ENROLLED") {
    throw new Error(`❌ Failed to reinstate student: ${reinstateResult.error}`);
  }

  const reinstatedInDb = await primaryDb.student.findUnique({ where: { id: testStudent.id } });
  const reinstatedFields = reinstatedInDb?.dynamicFields as Record<string, any> | null;
  console.log(`Student status after reinstate: ${reinstatedInDb?.status}`);
  console.log(`dynamicFields.portalAccessDisabled: ${reinstatedFields?.portalAccessDisabled}`);

  if (reinstatedInDb?.status !== "ENROLLED" || reinstatedFields?.portalAccessDisabled !== false) {
    throw new Error("❌ Reinstating student did not clear portal access lock!");
  }
  console.log("✅ TEST 2 PASSED: Suspension toggle and portal credential locking fully functional!");

  // Clean up test student 1
  await primaryDb.student.delete({ where: { id: testStudent.id } }).catch(() => {});

  // =========================================================================
  // TEST 3: GRADUATE CLASS ACTION (BATCH COHORT MIGRATION)
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🎓 TEST 3: Cohort Graduation Transaction Script (Primary 6 -> Alumni)");
  console.log("------------------------------------------------------------------");

  const cohortReg1 = `GRAD-1-${Date.now().toString().slice(-4)}`;
  const cohortReg2 = `GRAD-2-${Date.now().toString().slice(-4)}`;

  const grad1 = await primaryDb.student.create({
    data: {
      schoolId: school.id,
      tierId: isolatedTierId,
      firstName: "Emeka",
      lastName: "Senior",
      currentClass: "Class 6",
      status: "ENROLLED",
      admissionNumber: cohortReg1,
    }
  });

  const grad2 = await primaryDb.student.create({
    data: {
      schoolId: school.id,
      tierId: isolatedTierId,
      firstName: "Amina",
      lastName: "Senior",
      currentClass: "Primary 6",
      status: "ENROLLED",
      admissionNumber: cohortReg2,
    }
  });

  console.log(`Created 2 graduating students in Class 6 / Primary 6:`);
  console.log(`   - ${grad1.firstName} ${grad1.lastName} (${grad1.currentClass}) [${grad1.status}]`);
  console.log(`   - ${grad2.firstName} ${grad2.lastName} (${grad2.currentClass}) [${grad2.status}]`);

  // Execute Cohort Graduation
  const gradResult = await graduateTierCohort(school.id, "Primary School", "Class 6");
  console.log("Graduation Result:", gradResult);

  if (!gradResult.success) {
    throw new Error(`❌ Graduation transaction failed: ${gradResult.error}`);
  }
  if (gradResult.count < 2) {
    throw new Error(`❌ Expected at least 2 graduated students, got: ${gradResult.count}`);
  }

  const grad1After = await primaryDb.student.findUnique({ where: { id: grad1.id } });
  const grad2After = await primaryDb.student.findUnique({ where: { id: grad2.id } });

  console.log(`After graduation batch:`);
  console.log(`   - ${grad1After?.firstName}: Status = ${grad1After?.status}`);
  console.log(`   - ${grad2After?.firstName}: Status = ${grad2After?.status}`);

  if (grad1After?.status !== "ALUMNI" || grad2After?.status !== "ALUMNI") {
    throw new Error("❌ Cohort students were not updated to 'ALUMNI' status!");
  }

  // Verify dynamic metrics for ALUMNI updated
  const postGradMetrics = await fetchStudentMetrics(school.id, "Primary School", primaryTier.id);
  console.log(`Post-graduation Alumni metric count: ${postGradMetrics.alumniCount}`);
  if (postGradMetrics.alumniCount < initialMetrics.alumniCount + 2) {
    throw new Error("❌ Alumni metric count did not reflect newly graduated students!");
  }

  console.log("✅ TEST 3 PASSED: Cohort graduation batch transaction successfully transitioned Class 6 students to ALUMNI!");

  // Clean up
  await primaryDb.student.deleteMany({
    where: { id: { in: [grad1.id, grad2.id] } }
  }).catch(() => {});

  console.log("\n==================================================================");
  console.log("🎉 ALL STUDENT ROSTER ACTION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

verifyStudentRosterActions()
  .catch((e) => {
    console.error("❌ Verification failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
