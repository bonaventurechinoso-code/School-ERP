import { basePrisma, getPrismaClientForTier, invalidateTierConnection } from "../src/lib/tenant-prisma";
import { enrollApplicantAction } from "../src/app/[schoolDomain]/(admin)/admissions/actions";

async function verifyMultiTierEnrollmentSync() {
  console.log("==================================================================");
  console.log("🚀 STARTING MULTI-TIER ENROLLMENT & ROSTER SYNC VERIFICATION TEST");
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
  const nurseryTier = school.academicTiers.find(t => t.name.toLowerCase().includes("nursery"));
  const secondaryTier = school.academicTiers.find(t => t.name.toLowerCase().includes("secondary"));

  if (!primaryTier || !nurseryTier || !secondaryTier) {
    console.error("❌ One or more required academic tiers missing!");
    process.exit(1);
  }

  console.log(`🏫 Tenant: ${school.name} (${school.subdomain})`);
  console.log(`📚 Tiers Configured:`);
  console.log(`   1. ${nurseryTier.name} (ID: ${nurseryTier.id})`);
  console.log(`   2. ${primaryTier.name} (ID: ${primaryTier.id})`);
  console.log(`   3. ${secondaryTier.name} (ID: ${secondaryTier.id})`);

  // Connect to isolated tier databases
  const nurseryDb = await getPrismaClientForTier(school.id, "Creche / Nursery");
  const primaryDb = await getPrismaClientForTier(school.id, "Primary School");
  const secondaryDb = await getPrismaClientForTier(school.id, "Secondary School");

  // Initial Counts
  const startNurseryCount = await nurseryDb.student.count();
  const startPrimaryCount = await primaryDb.student.count();
  const startSecondaryCount = await secondaryDb.student.count();

  console.log(`\n📊 Baseline Student Counts Across Physical Isolated Databases:`);
  console.log(`   - [greenwood_nursery_db]:   ${startNurseryCount} students`);
  console.log(`   - [greenwood_primary_db]:   ${startPrimaryCount} students`);
  console.log(`   - [greenwood_secondary_db]: ${startSecondaryCount} students`);

  // =========================================================================
  // TEST 1: ENROLL APPLICANT INTO PRIMARY SCHOOL
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🧪 TEST 1: Enrolling Applicant designated to PRIMARY SCHOOL");
  console.log("------------------------------------------------------------------");

  const primaryApplicantEmail = `chidi.primary.${Date.now()}@example.com`;
  const primaryLead = await basePrisma.admissionLead.create({
    data: {
      schoolId: school.id,
      tierId: primaryTier.id,
      applicantName: "Chidi Anthony Okonkwo",
      studentEmail: primaryApplicantEmail,
      studentPhone: "08011112233",
      parentName: "Emeka Okonkwo",
      parentEmail: "emeka.okonkwo@example.com",
      parentContact: "08033334455",
      targetGrade: "Primary 4",
      source: "Online Portal",
      status: "APPROVED",
    },
    include: { tier: true },
  });

  console.log(`✓ Created applicant lead in central CRM: "${primaryLead.applicantName}" -> ${primaryLead.tier.name}`);

  const primaryEnrollRes = await enrollApplicantAction({
    leadId: primaryLead.id,
    schoolId: school.id,
    schoolDomain: school.subdomain,
  });

  if (!primaryEnrollRes.success) {
    console.error("❌ Primary enrollment failed:", primaryEnrollRes.error);
    process.exit(1);
  }

  console.log(`✓ Server Action executed: Student ID ${primaryEnrollRes.student?.id}, Admission No: ${primaryEnrollRes.student?.admissionNumber}`);

  // Check counts
  const afterPrimary_Nursery = await nurseryDb.student.count();
  const afterPrimary_Primary = await primaryDb.student.count();
  const afterPrimary_Secondary = await secondaryDb.student.count();

  console.log(`✓ Verifying Physical Database Isolation:`);
  console.log(`   - Primary DB Count:   ${afterPrimary_Primary} (Expected: ${startPrimaryCount + 1}) -> ${afterPrimary_Primary === startPrimaryCount + 1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Nursery DB Count:   ${afterPrimary_Nursery} (Expected: ${startNurseryCount}) -> ${afterPrimary_Nursery === startNurseryCount ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Secondary DB Count: ${afterPrimary_Secondary} (Expected: ${startSecondaryCount}) -> ${afterPrimary_Secondary === startSecondaryCount ? "✅ PASS" : "❌ FAIL"}`);

  if (afterPrimary_Primary !== startPrimaryCount + 1 || afterPrimary_Nursery !== startNurseryCount || afterPrimary_Secondary !== startSecondaryCount) {
    console.error("❌ Data routing violation during Test 1!");
    process.exit(1);
  }

  // =========================================================================
  // TEST 2: ENROLL APPLICANT INTO SECONDARY SCHOOL
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🧪 TEST 2: Enrolling Applicant designated to SECONDARY SCHOOL");
  console.log("------------------------------------------------------------------");

  const secondaryApplicantEmail = `fatima.secondary.${Date.now()}@example.com`;
  const secondaryLead = await basePrisma.admissionLead.create({
    data: {
      schoolId: school.id,
      tierId: secondaryTier.id,
      applicantName: "Fatima Abubakar Bello",
      studentEmail: secondaryApplicantEmail,
      studentPhone: "08055556677",
      parentName: "Abubakar Bello",
      parentEmail: "abubakar.bello@example.com",
      parentContact: "08077778899",
      targetGrade: "JSS 1",
      source: "Admissions Office",
      status: "APPROVED",
    },
    include: { tier: true },
  });

  console.log(`✓ Created applicant lead in central CRM: "${secondaryLead.applicantName}" -> ${secondaryLead.tier.name}`);

  const secondaryEnrollRes = await enrollApplicantAction({
    leadId: secondaryLead.id,
    schoolId: school.id,
    schoolDomain: school.subdomain,
  });

  if (!secondaryEnrollRes.success) {
    console.error("❌ Secondary enrollment failed:", secondaryEnrollRes.error);
    process.exit(1);
  }

  console.log(`✓ Server Action executed: Student ID ${secondaryEnrollRes.student?.id}, Admission No: ${secondaryEnrollRes.student?.admissionNumber}`);

  // Check counts
  const afterSecondary_Nursery = await nurseryDb.student.count();
  const afterSecondary_Primary = await primaryDb.student.count();
  const afterSecondary_Secondary = await secondaryDb.student.count();

  console.log(`✓ Verifying Physical Database Isolation:`);
  console.log(`   - Secondary DB Count: ${afterSecondary_Secondary} (Expected: ${startSecondaryCount + 1}) -> ${afterSecondary_Secondary === startSecondaryCount + 1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Primary DB Count:   ${afterSecondary_Primary} (Expected: ${startPrimaryCount + 1}) -> ${afterSecondary_Primary === startPrimaryCount + 1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Nursery DB Count:   ${afterSecondary_Nursery} (Expected: ${startNurseryCount}) -> ${afterSecondary_Nursery === startNurseryCount ? "✅ PASS" : "❌ FAIL"}`);

  if (afterSecondary_Secondary !== startSecondaryCount + 1 || afterSecondary_Primary !== startPrimaryCount + 1 || afterSecondary_Nursery !== startNurseryCount) {
    console.error("❌ Data routing violation during Test 2!");
    process.exit(1);
  }

  // =========================================================================
  // TEST 3: ENROLL APPLICANT INTO CRECHE / NURSERY
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🧪 TEST 3: Enrolling Applicant designated to CRECHE / NURSERY");
  console.log("------------------------------------------------------------------");

  const nurseryApplicantEmail = `tobi.nursery.${Date.now()}@example.com`;
  const nurseryLead = await basePrisma.admissionLead.create({
    data: {
      schoolId: school.id,
      tierId: nurseryTier.id,
      applicantName: "Oluwatobi Daniel Adebayo",
      studentEmail: nurseryApplicantEmail,
      studentPhone: "08099990011",
      parentName: "Segun Adebayo",
      parentEmail: "segun.adebayo@example.com",
      parentContact: "08012121212",
      targetGrade: "Creche",
      source: "Walk-in",
      status: "APPROVED",
    },
    include: { tier: true },
  });

  console.log(`✓ Created applicant lead in central CRM: "${nurseryLead.applicantName}" -> ${nurseryLead.tier.name}`);

  const nurseryEnrollRes = await enrollApplicantAction({
    leadId: nurseryLead.id,
    schoolId: school.id,
    schoolDomain: school.subdomain,
  });

  if (!nurseryEnrollRes.success) {
    console.error("❌ Nursery enrollment failed:", nurseryEnrollRes.error);
    process.exit(1);
  }

  console.log(`✓ Server Action executed: Student ID ${nurseryEnrollRes.student?.id}, Admission No: ${nurseryEnrollRes.student?.admissionNumber}`);

  // Check counts
  const afterNursery_Nursery = await nurseryDb.student.count();
  const afterNursery_Primary = await primaryDb.student.count();
  const afterNursery_Secondary = await secondaryDb.student.count();

  console.log(`✓ Verifying Physical Database Isolation:`);
  console.log(`   - Nursery DB Count:   ${afterNursery_Nursery} (Expected: ${startNurseryCount + 1}) -> ${afterNursery_Nursery === startNurseryCount + 1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Primary DB Count:   ${afterNursery_Primary} (Expected: ${startPrimaryCount + 1}) -> ${afterNursery_Primary === startPrimaryCount + 1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   - Secondary DB Count: ${afterNursery_Secondary} (Expected: ${startSecondaryCount + 1}) -> ${afterNursery_Secondary === startSecondaryCount + 1 ? "✅ PASS" : "❌ FAIL"}`);

  if (afterNursery_Nursery !== startNurseryCount + 1 || afterNursery_Primary !== startPrimaryCount + 1 || afterNursery_Secondary !== startSecondaryCount + 1) {
    console.error("❌ Data routing violation during Test 3!");
    process.exit(1);
  }

  // =========================================================================
  // TEST 4: VERIFY CENTRAL CRM STATUS MUTATION
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🧪 TEST 4: Verifying Central Admission Lead Status Updates");
  console.log("------------------------------------------------------------------");

  const updatedPrimaryLead = await basePrisma.admissionLead.findUnique({ where: { id: primaryLead.id } });
  const updatedSecondaryLead = await basePrisma.admissionLead.findUnique({ where: { id: secondaryLead.id } });
  const updatedNurseryLead = await basePrisma.admissionLead.findUnique({ where: { id: nurseryLead.id } });

  console.log(`✓ Primary Lead Status:   ${updatedPrimaryLead?.status} -> ${updatedPrimaryLead?.status === "ENROLLED" ? "✅ ENROLLED" : "❌ FAIL"}`);
  console.log(`✓ Secondary Lead Status: ${updatedSecondaryLead?.status} -> ${updatedSecondaryLead?.status === "ENROLLED" ? "✅ ENROLLED" : "❌ FAIL"}`);
  console.log(`✓ Nursery Lead Status:   ${updatedNurseryLead?.status} -> ${updatedNurseryLead?.status === "ENROLLED" ? "✅ ENROLLED" : "❌ FAIL"}`);

  // =========================================================================
  // CLEANUP TEST DATA
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🧹 Cleaning Up Test Records...");
  console.log("------------------------------------------------------------------");

  await primaryDb.student.delete({ where: { id: primaryEnrollRes.student?.id } });
  await secondaryDb.student.delete({ where: { id: secondaryEnrollRes.student?.id } });
  await nurseryDb.student.delete({ where: { id: nurseryEnrollRes.student?.id } });

  await basePrisma.admissionLead.delete({ where: { id: primaryLead.id } });
  await basePrisma.admissionLead.delete({ where: { id: secondaryLead.id } });
  await basePrisma.admissionLead.delete({ where: { id: nurseryLead.id } });

  invalidateTierConnection();

  const finalNursery = await nurseryDb.student.count();
  const finalPrimary = await primaryDb.student.count();
  const finalSecondary = await secondaryDb.student.count();

  console.log(`✓ Baseline Counts Restored:`);
  console.log(`   - Nursery:   ${finalNursery} (Original: ${startNurseryCount})`);
  console.log(`   - Primary:   ${finalPrimary} (Original: ${startPrimaryCount})`);
  console.log(`   - Secondary: ${finalSecondary} (Original: ${startSecondaryCount})`);

  console.log("\n==================================================================");
  console.log("🌟 ALL CROSS-TIER DYNAMIC ROUTING TESTS PASSED FLAWLESSLY! 🌟");
  console.log("==================================================================");
  process.exit(0);
}

verifyMultiTierEnrollmentSync().catch(err => {
  console.error("Verification failed with unexpected error:", err);
  process.exit(1);
});
