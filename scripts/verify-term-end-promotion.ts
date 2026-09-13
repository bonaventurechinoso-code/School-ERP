import { basePrisma, getPrismaClientForTier, resolveTierIdForTierDb } from "../src/lib/tenant-prisma";
import { executeTermEndPromotionAction } from "../src/app/[schoolDomain]/(admin)/students/actions";

async function verifyTermEndPromotion() {
  console.log("==================================================================");
  console.log("🎓 VERIFYING AUTOMATED PROMOTION & TERM-END PROCESSING SCRIPT");
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

  const primaryTier = school.academicTiers.find((t) => t.name.toLowerCase().includes("primary"));
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

  const uniqueSuffix = Date.now().toString().slice(-4);

  // Create test students in isolated tier DB and central DB
  console.log("\n--- 1. Setting Up Test Cohort for Term-End Progression ---");
  
  // Student 1: Primary 4 (Eligible for promotion -> Primary 5)
  const studentAData = {
    schoolId: school.id,
    tierId: isolatedTierId,
    firstName: "Amaka",
    lastName: `Promo4_${uniqueSuffix}`,
    admissionNumber: `P4-${uniqueSuffix}`,
    currentClass: "Primary 4",
    status: "ENROLLED",
  };
  const studentA = await primaryDb.student.create({ data: studentAData });
  await basePrisma.student.upsert({
    where: { id: studentA.id },
    update: studentAData,
    create: { ...studentAData, id: studentA.id, tierId: primaryTier.id },
  });

  // Student 2: Primary 5 (Flagged to REPEAT -> Stays Primary 5)
  const studentBData = {
    schoolId: school.id,
    tierId: isolatedTierId,
    firstName: "Emeka",
    lastName: `Repeat5_${uniqueSuffix}`,
    admissionNumber: `P5R-${uniqueSuffix}`,
    currentClass: "Primary 5",
    status: "ENROLLED",
  };
  const studentB = await primaryDb.student.create({ data: studentBData });
  await basePrisma.student.upsert({
    where: { id: studentB.id },
    update: studentBData,
    create: { ...studentBData, id: studentB.id, tierId: primaryTier.id },
  });

  // Student 3: Primary 5 (Eligible for promotion -> Primary 6)
  const studentCData = {
    schoolId: school.id,
    tierId: isolatedTierId,
    firstName: "Ngozi",
    lastName: `Promo5_${uniqueSuffix}`,
    admissionNumber: `P5P-${uniqueSuffix}`,
    currentClass: "Primary 5",
    status: "ENROLLED",
  };
  const studentC = await primaryDb.student.create({ data: studentCData });
  await basePrisma.student.upsert({
    where: { id: studentC.id },
    update: studentCData,
    create: { ...studentCData, id: studentC.id, tierId: primaryTier.id },
  });

  // Student 4: Primary 6 (Terminal Grade -> Graduates to ALUMNI & Clears Class Slot)
  const studentDData = {
    schoolId: school.id,
    tierId: isolatedTierId,
    firstName: "Ifeanyi",
    lastName: `Grad6_${uniqueSuffix}`,
    admissionNumber: `P6G-${uniqueSuffix}`,
    currentClass: "Primary 6",
    status: "ENROLLED",
  };
  const studentD = await primaryDb.student.create({ data: studentDData });
  await basePrisma.student.upsert({
    where: { id: studentD.id },
    update: studentDData,
    create: { ...studentDData, id: studentD.id, tierId: primaryTier.id },
  });

  console.log(`✅ Test cohort created:`);
  console.log(`   - Student A (${studentA.id}): Primary 4 -> Expect: Primary 5`);
  console.log(`   - Student B (${studentB.id}): Primary 5 -> Flagged as Repeater -> Expect: Primary 5`);
  console.log(`   - Student C (${studentC.id}): Primary 5 -> Expect: Primary 6`);
  console.log(`   - Student D (${studentD.id}): Primary 6 -> Terminal Grade -> Expect: ALUMNI & cleared class slot`);

  try {
    // 2. Execute Term-End Promotion Action with Student B in repeatingStudentIds
    console.log("\n--- 2. Executing Term-End Promotion Batch Transaction ---");
    const promotionResult = await executeTermEndPromotionAction(school.id, {
      tierName: "Primary School",
      repeatingStudentIds: [studentB.id],
    });

    console.log("Promotion Action Result:", JSON.stringify(promotionResult, null, 2));

    if (!promotionResult.success) {
      throw new Error(`❌ Promotion transaction failed: ${promotionResult.error}`);
    }

    // 3. Verify Database Updates in Isolated Database
    console.log("\n--- 3. Verifying Student States in Isolated Tier Database ---");
    
    // Check Student A
    const updatedA = await primaryDb.student.findUnique({ where: { id: studentA.id } });
    console.log(`Student A Class: "${updatedA?.currentClass}", Status: "${updatedA?.status}"`);
    if (updatedA?.currentClass !== "Primary 5" || updatedA?.status !== "ENROLLED") {
      throw new Error(`❌ Student A was not correctly promoted to Primary 5! Got: ${updatedA?.currentClass}`);
    }
    console.log("✅ Student A correctly promoted: Primary 4 ➔ Primary 5");

    // Check Student B (Repeater)
    const updatedB = await primaryDb.student.findUnique({ where: { id: studentB.id } });
    console.log(`Student B (Repeater) Class: "${updatedB?.currentClass}", Status: "${updatedB?.status}"`);
    if (updatedB?.currentClass !== "Primary 5" || updatedB?.status !== "ENROLLED") {
      throw new Error(`❌ Student B repeater exception failed! Class changed to: ${updatedB?.currentClass}`);
    }
    console.log("✅ Student B successfully exempted as repeater: Remained Primary 5");

    // Check Student C
    const updatedC = await primaryDb.student.findUnique({ where: { id: studentC.id } });
    console.log(`Student C Class: "${updatedC?.currentClass}", Status: "${updatedC?.status}"`);
    if (updatedC?.currentClass !== "Primary 6" || updatedC?.status !== "ENROLLED") {
      throw new Error(`❌ Student C was not correctly promoted to Primary 6! Got: ${updatedC?.currentClass}`);
    }
    console.log("✅ Student C correctly promoted: Primary 5 ➔ Primary 6");

    // Check Student D (Graduate)
    const updatedD = await primaryDb.student.findUnique({ where: { id: studentD.id } });
    console.log(`Student D Status: "${updatedD?.status}", Class: "${updatedD?.currentClass}", alumniAt: ${updatedD?.alumniAt}`);
    if (updatedD?.status !== "ALUMNI") {
      throw new Error(`❌ Student D did not graduate to ALUMNI! Status is: ${updatedD?.status}`);
    }
    if (updatedD?.currentClass !== null && updatedD?.currentClass !== "") {
      throw new Error(`❌ Student D active class slot was not cleared! Got: ${updatedD?.currentClass}`);
    }
    if (!updatedD?.alumniAt) {
      throw new Error(`❌ Student D alumniAt timestamp was not recorded!`);
    }
    console.log("✅ Student D successfully graduated: Status='ALUMNI', active class slot cleared (null), alumniAt set!");

    // 4. Verify Central DB Mirrors
    console.log("\n--- 4. Verifying Central Database Mirror Consistency ---");
    const centralA = await basePrisma.student.findUnique({ where: { id: studentA.id } });
    const centralB = await basePrisma.student.findUnique({ where: { id: studentB.id } });
    const centralC = await basePrisma.student.findUnique({ where: { id: studentC.id } });
    const centralD = await basePrisma.student.findUnique({ where: { id: studentD.id } });

    if (centralA?.currentClass !== "Primary 5" || centralA?.status !== "ENROLLED") {
      throw new Error("❌ Central mirror for Student A mismatch!");
    }
    if (centralB?.currentClass !== "Primary 5" || centralB?.status !== "ENROLLED") {
      throw new Error("❌ Central mirror for Student B mismatch!");
    }
    if (centralC?.currentClass !== "Primary 6" || centralC?.status !== "ENROLLED") {
      throw new Error("❌ Central mirror for Student C mismatch!");
    }
    if (centralD?.status !== "ALUMNI" || (centralD?.currentClass !== null && centralD?.currentClass !== "")) {
      throw new Error("❌ Central mirror for Student D mismatch!");
    }
    console.log("✅ All central database mirrors are strictly synchronized!");

    console.log("\n==================================================================");
    console.log("🎉 ALL AUTOMATED PROMOTION & TERM-END PROCESSING TESTS PASSED!");
    console.log("==================================================================");
  } finally {
    // Clean up test records
    console.log("\n🧹 Cleaning up test student records...");
    await primaryDb.student.deleteMany({
      where: { id: { in: [studentA.id, studentB.id, studentC.id, studentD.id] } },
    }).catch(() => {});
    await basePrisma.student.deleteMany({
      where: { id: { in: [studentA.id, studentB.id, studentC.id, studentD.id] } },
    }).catch(() => {});
    console.log("✅ Cleanup complete.");
  }
}

verifyTermEndPromotion()
  .catch((err) => {
    console.error("FATAL ERROR IN VERIFICATION:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
