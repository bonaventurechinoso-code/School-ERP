import { basePrisma } from "../src/lib/tenant-prisma";
import { getStudentReportCard, getClassResultSheet } from "../src/lib/report-card-service";
import { mapScoreToGradeLetter } from "../src/lib/grading-engine";
import { mapNurseryScoreToGrade, isNurseryClass } from "../src/lib/nursery-config";
import { mapCrecheScoreToGrade, isCrecheClass } from "../src/lib/creche-config";
import { mapTertiaryScoreToGrade, isTertiaryClass, getTertiaryClassification } from "../src/lib/tertiary-config";

async function runRegressionSuite() {
  console.log("=================================================================");
  console.log("       ALL-TIER REGRESSION SUITE (PHASES 1, 2, 3, 4, 5)          ");
  console.log("=================================================================");

  let pass = 0;
  let fail = 0;

  function assert(cond: boolean, desc: string, detail?: any) {
    if (cond) {
      console.log(`  ✅ [PASS] ${desc}`);
      pass++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`, detail || "");
      fail++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. PRIMARY TIER (Phase 1)
  // -------------------------------------------------------------------------
  console.log("\n--- Tier 1: Primary (20/20/60, Distinction - Fail) ---");
  const p75 = mapScoreToGradeLetter(75, "PRIMARY");
  assert(p75.letter === "Distinction", "75% is Distinction for Primary");
  const p65 = mapScoreToGradeLetter(65, "PRIMARY");
  assert(p65.letter === "Very Good", "65% is Very Good for Primary");
  const p50 = mapScoreToGradeLetter(50, "PRIMARY");
  assert(p50.letter === "Credit", "50% is Credit for Primary");
  const p40 = mapScoreToGradeLetter(40, "PRIMARY");
  assert(p40.letter === "Pass", "40% is Pass for Primary");
  const p30 = mapScoreToGradeLetter(30, "PRIMARY");
  assert(p30.letter === "Fail", "30% is Fail for Primary");
  assert(p30.letter !== "F9", "F9 is IMPOSSIBLE for Primary");

  // -------------------------------------------------------------------------
  // 2. CRECHE TIER (Phase 2)
  // -------------------------------------------------------------------------
  console.log("\n--- Tier 2: Creche (50/50, Excellent - Needs Support) ---");
  assert(isCrecheClass("Creche"), "Creche is recognized as Creche");
  const c80 = mapCrecheScoreToGrade(80);
  assert(c80.letter === "Excellent", "80% is Excellent for Creche");
  const c30 = mapCrecheScoreToGrade(30);
  assert(c30.letter === "Needs Support", "30% is Needs Support for Creche");
  assert(c30.letter !== "F9" && c30.letter !== "Fail", "F9 and Fail are IMPOSSIBLE for Creche");

  // -------------------------------------------------------------------------
  // 3. NURSERY TIER (Phase 3)
  // -------------------------------------------------------------------------
  console.log("\n--- Tier 3: Nursery (Observation 50 + CA 50, Excellent - Needs Support) ---");
  assert(isNurseryClass("Nursery 1") && isNurseryClass("Nursery 2"), "Nursery 1 and 2 recognized as Nursery");
  const n0 = mapNurseryScoreToGrade(0);
  assert(n0.letter === "Needs Support", "0 score in Nursery gives Needs Support, NOT F9");
  assert(n0.letter !== "F9" && n0.letter !== "Fail", "F9 and Fail are IMPOSSIBLE for Nursery");
  const n75 = mapNurseryScoreToGrade(75);
  assert(n75.letter === "Excellent", "75% is Excellent for Nursery");

  // -------------------------------------------------------------------------
  // 4. SECONDARY TIER (Phase 4: Amina Bello 1074)
  // -------------------------------------------------------------------------
  console.log("\n--- Tier 4: Secondary WAEC (A1-F9, Amina Bello 1074) ---");
  const s75 = mapScoreToGradeLetter(75, "SECONDARY");
  assert(s75.letter === "A1", "75% is A1 for Secondary");
  const s70 = mapScoreToGradeLetter(70, "SECONDARY");
  assert(s70.letter === "B2", "70% is B2 for Secondary");
  const s50 = mapScoreToGradeLetter(50, "SECONDARY");
  assert(s50.letter === "C6", "50% is C6 for Secondary");
  const s30 = mapScoreToGradeLetter(30, "SECONDARY");
  assert(s30.letter === "F9", "30% is F9 for Secondary");

  // Verify Amina Bello on Demo JSS 1
  const demoSchool = await basePrisma.school.findUnique({ where: { subdomain: "demo" } });
  if (demoSchool) {
    const aminaReport = await getStudentReportCard(
      demoSchool.id,
      "mock-jss1-002",
      "1st Term",
      "2026/2027"
    );
    assert(!!aminaReport?.reportCard, "Amina Bello Report Card loaded");
    if (aminaReport?.reportCard) {
      const rc = aminaReport.reportCard;
      assert(rc.totalScore === 1074, `Amina Bello Total is 1074 (actual: ${rc.totalScore})`);
      assert(rc.averageScore === 76.71, `Amina Bello Average is 76.71% (actual: ${rc.averageScore})`);
      assert(rc.gradeLetter === "A1", `Amina Bello Grade is A1 (actual: ${rc.gradeLetter})`);
      assert(rc.position === "2nd", `Amina Bello Position is 2nd (actual: ${rc.position})`);
      assert(aminaReport.currentRecords.length === 14, `Amina Bello has 14 subjects (actual: ${aminaReport.currentRecords.length})`);
    }

    const jss1Sheet = await getClassResultSheet(demoSchool.id, "JSS 1", "1st Term", "2026/2027");
    const aminaSheet = jss1Sheet.students.find((s) => s.id === "mock-jss1-002" || s.name.toLowerCase().includes("bello") || s.admissionNumber?.includes("002"));
    assert(!!aminaSheet, "Bello appears on JSS 1 Broadsheet");
    if (aminaSheet) {
      assert(aminaSheet.reportCard?.totalScore === 1074 || Object.keys(aminaSheet.subjectScores).length > 0, "Bello has valid scores on Broadsheet");
    }
  }

  // -------------------------------------------------------------------------
  // 5. TERTIARY TIER (Phase 5: Babatunde Adeyemi & Emeka Okafor)
  // -------------------------------------------------------------------------
  console.log("\n--- Tier 5: Tertiary (4.0 Scale GPA & Courses) ---");
  assert(isTertiaryClass("ND 1") && isTertiaryClass("100 Level"), "ND 1 and 100 Level recognized as Tertiary");
  const t75 = mapTertiaryScoreToGrade(75, "4.0");
  assert(t75.letter === "A" && t75.gp === 4.0, "75% is A (4.0) for Tertiary");
  assert(t75.letter !== "A1" && t75.letter !== "Distinction", "A1 and Distinction are IMPOSSIBLE for Tertiary gradeLetter");

  if (demoSchool) {
    const babatunde = await basePrisma.student.findFirst({
      where: { schoolId: demoSchool.id, admissionNumber: "APX/2026/ND1/001" },
    });
    if (babatunde) {
      const bReport = await getStudentReportCard(demoSchool.id, babatunde.id, "1st Term", "2026/2027");
      assert(bReport.reportCard?.totalScore === 421, `Babatunde Total is 421 (actual: ${bReport.reportCard?.totalScore})`);
      assert(bReport.reportCard?.gpa === 3.56, `Babatunde GPA is 3.56 (actual: ${bReport.reportCard?.gpa})`);
      assert(bReport.currentRecords.length === 6, `Babatunde has 6 courses (actual: ${bReport.currentRecords.length})`);
    }
  }

  const sandboxSchool = await basePrisma.school.findUnique({ where: { subdomain: "sandbox" } });
  if (sandboxSchool) {
    const emeka = await basePrisma.student.findFirst({
      where: { schoolId: sandboxSchool.id, admissionNumber: "TSA/2026/100L/001" },
    });
    if (emeka) {
      const eReport = await getStudentReportCard(sandboxSchool.id, emeka.id, "1st Term", "2026/2027");
      assert(eReport.reportCard?.totalScore === 416, `Emeka Total is 416 (actual: ${eReport.reportCard?.totalScore})`);
      assert(eReport.reportCard?.gpa === 3.56, `Emeka GPA is 3.56 (actual: ${eReport.reportCard?.gpa})`);
      assert(eReport.currentRecords.length === 6, `Emeka has 6 courses (actual: ${eReport.currentRecords.length})`);
    }
  }

  console.log("\n=================================================================");
  console.log(`TOTAL REGRESSION TESTS: ${pass + fail} | PASSED: ${pass} | FAILED: ${fail}`);
  console.log("=================================================================");

  if (fail > 0) process.exit(1);
}

runRegressionSuite()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
