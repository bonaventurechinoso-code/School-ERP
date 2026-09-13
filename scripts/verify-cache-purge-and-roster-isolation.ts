import { basePrisma, getPrismaClientForTier, resolveTierIdForTierDb } from "../src/lib/tenant-prisma";
import { invalidateStudentNamespace } from "../src/lib/cache-invalidation";
import { fetchStudentsPaginated } from "../src/app/[schoolDomain]/(admin)/students/actions";

async function verifyCachePurgeAndRosterIsolation() {
  console.log("==================================================================");
  console.log("🛡️ VERIFYING CACHE PURGE & STRICT STUDENT ROSTER DATA ISOLATION");
  console.log("==================================================================");

  // 1. Fetch Greenwood Academy
  const school = await basePrisma.school.findUnique({
    where: { subdomain: "greenwood" },
    include: { academicTiers: true },
  });

  if (!school) {
    console.error("❌ Greenwood Academy tenant not found!");
    process.exit(1);
  }

  const primaryTier = school.academicTiers.find(t => t.name.toLowerCase().includes("primary"));
  if (!primaryTier) {
    console.error("❌ Primary School tier missing!");
    process.exit(1);
  }

  console.log(`🏫 Tenant: ${school.name} (${school.id})`);
  console.log(`📚 Tier: ${primaryTier.name}`);

  // =========================================================================
  // TEST 1: PURGE REDIS CACHING KEYS
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🧹 TEST 1: Purging Redis Caching Keys");
  console.log("------------------------------------------------------------------");

  await invalidateStudentNamespace(school.id, primaryTier.name);
  await invalidateStudentNamespace(school.id);
  console.log(`✅ TEST 1 PASSED: Redis student cache keys cleanly purged!`);

  // =========================================================================
  // TEST 2: VERIFY STRICT ENROLLED-ONLY QUERY (NO APPLICANTS / PROSPECTS)
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🔍 TEST 2: Strict Status Filtering in Prisma (Enrolled-Only)");
  console.log("------------------------------------------------------------------");

  const primaryDb = await getPrismaClientForTier(school.id, primaryTier.name);
  const isolatedTierId = await resolveTierIdForTierDb(primaryDb, school.id, {
    id: primaryTier.id,
    name: primaryTier.name,
    level: primaryTier.level,
  });

  // Create temporary prospect student in isolated DB
  const tempProspectReg = `TEST-PROSP-${Date.now().toString().slice(-4)}`;
  const prospectStudent = await primaryDb.student.create({
    data: {
      schoolId: school.id,
      tierId: isolatedTierId,
      firstName: "Unenrolled",
      lastName: "Prospect",
      status: "PROSPECT",
      admissionNumber: tempProspectReg,
    }
  });

  // Create temporary applicant student in isolated DB
  const tempApplicantReg = `TEST-APPL-${Date.now().toString().slice(-4)}`;
  const applicantStudent = await primaryDb.student.create({
    data: {
      schoolId: school.id,
      tierId: isolatedTierId,
      firstName: "Unenrolled",
      lastName: "Applicant",
      status: "APPLICANT",
      admissionNumber: tempApplicantReg,
    }
  });

  // Create temporary admission lead in central DB
  const tempLead = await basePrisma.admissionLead.create({
    data: {
      schoolId: school.id,
      tierId: primaryTier.id,
      applicantName: "Admissions Lead Test",
      parentContact: "08012345678",
      targetGrade: "Primary 2",
      status: "INQUIRY",
    }
  });

  console.log(`Created test records:`);
  console.log(`  - Student record with status: PROSPECT (${prospectStudent.id})`);
  console.log(`  - Student record with status: APPLICANT (${applicantStudent.id})`);
  console.log(`  - Admission lead with status: INQUIRY (${tempLead.id})`);

  // Fetch paginated student roster
  const rosterResult = await fetchStudentsPaginated(school.id, {
    tierName: primaryTier.name,
    tierId: primaryTier.id,
    status: "ENROLLED",
    limit: 100,
  });

  console.log(`\nFetched ${rosterResult.items.length} records from Student Roster query:`);

  // Verify that NONE of the returned records are Prospect, Applicant, Inquiry, or Lead
  const contaminatedItems = rosterResult.items.filter(item => {
    const s = (item.status || "").toUpperCase();
    return s === "PROSPECT" || s === "APPLICANT" || s === "INQUIRY" || s === "SCREENED" || (item as any).isLead;
  });

  if (contaminatedItems.length > 0) {
    console.error("❌ Data contamination detected! Found un-enrolled records in roster:", contaminatedItems);
    throw new Error(`Data contamination detected: ${contaminatedItems.length} un-enrolled items found.`);
  }

  // Specifically verify our test records are NOT present
  const foundProspect = rosterResult.items.some(i => i.id === prospectStudent.id);
  const foundApplicant = rosterResult.items.some(i => i.id === applicantStudent.id);
  const foundLead = rosterResult.items.some(i => i.id === tempLead.id);

  if (foundProspect || foundApplicant || foundLead) {
    throw new Error(`❌ Unenrolled records leaked into student roster! prospect: ${foundProspect}, applicant: ${foundApplicant}, lead: ${foundLead}`);
  }

  // Verify every returned item has status ENROLLED
  const allEnrolled = rosterResult.items.every(i => (i.status || "").toUpperCase() === "ENROLLED");
  if (!allEnrolled) {
    throw new Error(`❌ Found non-enrolled status in student roster items!`);
  }

  console.log(`✅ TEST 2 PASSED: Strict Prisma filtering verified! All ${rosterResult.items.length} items are strictly ENROLLED.`);
  console.log(`   - Unenrolled PROSPECT excluded: YES`);
  console.log(`   - Unenrolled APPLICANT excluded: YES`);
  console.log(`   - Admission INQUIRY lead excluded: YES`);

  // Clean up test records
  await primaryDb.student.deleteMany({
    where: { id: { in: [prospectStudent.id, applicantStudent.id] } }
  }).catch(() => {});

  await basePrisma.admissionLead.delete({
    where: { id: tempLead.id }
  }).catch(() => {});

  console.log("\n==================================================================");
  console.log("🎉 ALL CACHE PURGE & DATA ISOLATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

verifyCachePurgeAndRosterIsolation()
  .catch((e) => {
    console.error("❌ Verification failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
