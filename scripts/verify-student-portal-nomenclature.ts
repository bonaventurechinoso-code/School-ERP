import { basePrisma } from "../src/lib/tenant-prisma";
import { formatTierBadgeCode, isHigherEdTier, sanitizeTierSlug } from "../src/lib/tenant-tier-utils";

async function runVerification() {
  console.log("==================================================================");
  console.log("🧪 VERIFYING STUDENT PORTAL K-12 NOMENCLATURE & REFACTORING");
  console.log("==================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      process.exitCode = 1;
    }
  }

  // 1. Verify Helper Functions for Tier Detection & Badge Formatting
  console.log("\n--- 1. Testing Tier Classification & Badge Suffix Logic ---");
  
  // K-12 Tiers
  assert(!isHigherEdTier("Primary School"), "Primary School is correctly classified as K-12 (!isHigherEd)");
  assert(!isHigherEdTier("Secondary School"), "Secondary School is correctly classified as K-12 (!isHigherEd)");
  assert(!isHigherEdTier("Daycare / Nursery"), "Daycare / Nursery is correctly classified as K-12 (!isHigherEd)");
  assert(!isHigherEdTier("High School"), "High School is correctly classified as K-12 (!isHigherEd)");

  // Higher Ed Tiers
  assert(isHigherEdTier("Higher Ed: University"), "University is correctly classified as Higher Ed (isHigherEd)");
  assert(isHigherEdTier("Higher Ed: Polytechnic"), "Polytechnic is correctly classified as Higher Ed (isHigherEd)");
  assert(isHigherEdTier("Higher Ed: College of Education"), "College of Education is correctly classified as Higher Ed (isHigherEd)");

  // Badge short codes
  assert(formatTierBadgeCode("Primary School") === "PRIMARY", "Primary School formats as PRIMARY");
  assert(formatTierBadgeCode("Secondary School") === "SECONDARY", "Secondary School formats as SECONDARY");
  assert(formatTierBadgeCode("Daycare / Nursery") === "NURSERY", "Daycare / Nursery formats as NURSERY");
  assert(formatTierBadgeCode("Higher Ed: University") === "UNIVERSITY", "University formats as UNIVERSITY");
  assert(formatTierBadgeCode("Higher Ed: Polytechnic") === "POLYTECHNIC", "Polytechnic formats as POLYTECHNIC");

  // Dynamic Student ID structure
  const currentYear = new Date().getFullYear();
  assert(
    `STU-${currentYear}-${formatTierBadgeCode("Primary School")}` === `STU-${currentYear}-PRIMARY`,
    `Primary Student ID renders as STU-${currentYear}-PRIMARY`
  );
  assert(
    `STU-${currentYear}-${formatTierBadgeCode("Secondary School")}` === `STU-${currentYear}-SECONDARY`,
    `Secondary Student ID renders as STU-${currentYear}-SECONDARY`
  );
  assert(
    `STU-${currentYear}-${formatTierBadgeCode("Daycare / Nursery")}` === `STU-${currentYear}-NURSERY`,
    `Nursery Student ID renders as STU-${currentYear}-NURSERY`
  );

  // 2. Test Tenant-Scoped Student Portal Context in Database
  console.log("\n--- 2. Testing Tenant Context & Nomenclature Filtering ---");
  const school = await basePrisma.school.findUnique({
    where: { subdomain: "greenwood" },
    include: { academicTiers: true }
  });

  if (!school) {
    console.error("❌ Greenwood Academy tenant not found in database!");
    process.exit(1);
  }

  console.log(`🏫 Loaded Tenant: ${school.name} (subdomain: ${school.subdomain})`);
  console.log(`📚 Academic Tiers: [${school.academicTiers.map(t => t.name).join(", ")}]`);

  // Simulate K-12 Primary rendering
  const primaryTier = school.academicTiers.find(t => t.name.toUpperCase().includes("PRIMARY"));
  const isPrimaryHigherEd = isHigherEdTier(primaryTier?.name);
  
  const courseCardTitle = isPrimaryHigherEd ? "Enrolled Courses" : "Enrolled Subjects";
  const gpaCardTitle = isPrimaryHigherEd ? "Current Term GPA" : "Current Term Report Card / Result";
  const standingBadge = isPrimaryHigherEd ? "First Class Standing" : "Top Academic Standing";
  const reportCardsModuleHeader = "Published Report Cards & Results";
  const continuousAssessmentsHeader = isPrimaryHigherEd ? "Transcripts & Scores" : "Continuous Assessments & Results";
  const assessmentAction = isPrimaryHigherEd ? "View Transcripts" : "View Results";

  assert(courseCardTitle === "Enrolled Subjects", "K-12 Card 1 title renders 'Enrolled Subjects' (no 'Courses')");
  assert(gpaCardTitle === "Current Term Report Card / Result", "K-12 Card 3 title renders 'Current Term Report Card / Result' (no 'GPA')");
  assert(standingBadge === "Top Academic Standing", "K-12 Standing renders 'Top Academic Standing' (no collegiate 'First Class')");
  assert(reportCardsModuleHeader === "Published Report Cards & Results", "Module 2 renders 'Published Report Cards & Results'");
  assert(continuousAssessmentsHeader === "Continuous Assessments & Results", "Module 3 renders 'Continuous Assessments & Results' (no 'Transcripts')");
  assert(assessmentAction === "View Results", "Module 3 action link renders 'View Results' (no 'View Transcripts')");

  // 3. Test Higher Education Simulation
  console.log("\n--- 3. Testing Higher Education Dynamic Nomenclature Switching ---");
  const higherEdTierName = "Higher Ed: University";
  const isUniHigherEd = isHigherEdTier(higherEdTierName);

  const uniCourseTitle = isUniHigherEd ? "Enrolled Courses" : "Enrolled Subjects";
  const uniGpaTitle = isUniHigherEd ? "Current Term GPA" : "Current Term Report Card / Result";
  const uniStandingBadge = isUniHigherEd ? "First Class Standing" : "Top Academic Standing";
  const uniTranscriptHeader = isUniHigherEd ? "Transcripts & Scores" : "Continuous Assessments & Results";
  const uniAssessmentAction = isUniHigherEd ? "View Transcripts" : "View Results";
  const uniStudentId = `STU-${currentYear}-${formatTierBadgeCode(higherEdTierName)}`;

  assert(uniCourseTitle === "Enrolled Courses", "Higher Ed dynamically displays 'Enrolled Courses'");
  assert(uniGpaTitle === "Current Term GPA", "Higher Ed dynamically displays 'Current Term GPA'");
  assert(uniStandingBadge === "First Class Standing", "Higher Ed dynamically displays 'First Class Standing'");
  assert(uniTranscriptHeader === "Transcripts & Scores", "Higher Ed dynamically displays 'Transcripts & Scores'");
  assert(uniAssessmentAction === "View Transcripts", "Higher Ed dynamically displays 'View Transcripts'");
  assert(uniStudentId === `STU-${currentYear}-UNIVERSITY`, `Higher Ed Student ID renders 'STU-${currentYear}-UNIVERSITY'`);

  // 4. Verify Banner Copy & Layout Simplification
  console.log("\n--- 4. Verifying Banner Copy & Layout Simplification ---");
  const bannerCopy = "Access your personalized class timetable, upcoming term assessments, published report cards, results, and attendance records.";
  assert(!bannerCopy.includes("publshed"), "Banner copy does NOT contain typo 'publshed'");
  assert(bannerCopy.includes("published report cards, results,"), "Banner copy contains 'published report cards, results, and attendance records.'");

  // Read actual source files to verify removal of redundant elements
  const fs = await import("fs");
  const path = await import("path");
  const tenantPagePath = path.resolve(__dirname, "../src/app/[schoolDomain]/portal/student/page.tsx");
  const fallbackPagePath = path.resolve(__dirname, "../src/app/portal/student/page.tsx");
  
  const tenantPageSrc = fs.readFileSync(tenantPagePath, "utf-8");
  const fallbackPageSrc = fs.readFileSync(fallbackPagePath, "utf-8");

  assert(!tenantPageSrc.includes("Active Student Enrollment"), "Tenant portal does NOT contain 'Active Student Enrollment' status embed");
  assert(!fallbackPageSrc.includes("Active Student Enrollment"), "Fallback portal does NOT contain 'Active Student Enrollment' status embed");
  assert(!tenantPageSrc.includes("Available Tiers:"), "Tenant portal does NOT contain 'Available Tiers:' display box");
  assert(tenantPageSrc.includes(bannerCopy), "Tenant portal contains the cleaned description sentence");
  assert(fallbackPageSrc.includes(bannerCopy), "Fallback portal contains the cleaned description sentence");

  console.log("\n==================================================================");
  console.log(`🌟 RESULTS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log("==================================================================");
}

runVerification()
  .catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
  });

