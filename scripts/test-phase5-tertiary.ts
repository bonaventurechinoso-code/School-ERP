import { basePrisma } from "../src/lib/tenant-prisma";
import { getStudentReportCard, getClassResultSheet } from "../src/lib/report-card-service";
import { generateReportCardPdf, ReportCardPdfData } from "../src/lib/report-card-pdf";
import { isTertiaryClass, mapTertiaryScoreToGrade, calculateTertiaryGPA, getTertiaryAcademicStanding, getTertiaryClassification } from "../src/lib/tertiary-config";

async function runPhase5Tests() {
  console.log("=================================================================");
  console.log("       PHASE 5: TERTIARY / HIGHER INSTITUTION TEST SUITE         ");
  console.log("=================================================================");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, details ? details : "");
      failCount++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: CONFIG & HELPER INTEGRITY
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1] Tertiary Config & 4.0 Scale Standards");
  assert(isTertiaryClass("ND 1"), "isTertiaryClass recognizes ND 1");
  assert(isTertiaryClass("ND 2"), "isTertiaryClass recognizes ND 2");
  assert(isTertiaryClass("HND 1"), "isTertiaryClass recognizes HND 1");
  assert(isTertiaryClass("100 Level"), "isTertiaryClass recognizes 100 Level");
  assert(isTertiaryClass("200 Level"), "isTertiaryClass recognizes 200 Level");
  assert(!isTertiaryClass("JSS 1"), "isTertiaryClass rejects JSS 1");
  assert(!isTertiaryClass("Primary 1"), "isTertiaryClass rejects Primary 1");
  assert(!isTertiaryClass("Nursery 1"), "isTertiaryClass rejects Nursery 1");

  const gradeA = mapTertiaryScoreToGrade(76, "4.0");
  assert(gradeA.letter === "A" && gradeA.gp === 4.0 && gradeA.remark === "Distinction", "76% maps to A (4.0, Distinction) on 4.0 scale");

  const gradeB = mapTertiaryScoreToGrade(66, "4.0");
  assert(gradeB.letter === "B" && gradeB.gp === 3.0 && gradeB.remark === "Upper Credit", "66% maps to B (3.0, Upper Credit) on 4.0 scale");

  const gradeC = mapTertiaryScoreToGrade(55, "4.0");
  assert(gradeC.letter === "C" && gradeC.gp === 2.0 && gradeC.remark === "Lower Credit", "55% maps to C (2.0, Lower Credit) on 4.0 scale");

  const gradeD = mapTertiaryScoreToGrade(45, "4.0");
  assert(gradeD.letter === "D" && gradeD.gp === 1.0 && gradeD.remark === "Pass", "45% maps to D (1.0, Pass) on 4.0 scale");

  const gradeF = mapTertiaryScoreToGrade(35, "4.0");
  assert(gradeF.letter === "F" && gradeF.gp === 0.0 && gradeF.remark === "Fail", "35% maps to F (0.0, Fail) on 4.0 scale");

  assert(getTertiaryClassification(3.56, "4.0") === "Distinction", "3.56 GPA gives Distinction classification");
  assert(getTertiaryClassification(3.20, "4.0") === "Upper Credit", "3.20 GPA gives Upper Credit classification");
  assert(getTertiaryClassification(2.75, "4.0") === "Lower Credit", "2.75 GPA gives Lower Credit classification");
  assert(getTertiaryClassification(2.10, "4.0") === "Pass", "2.10 GPA gives Pass classification");
  assert(getTertiaryClassification(1.50, "4.0") === "Fail", "< 2.00 GPA gives Fail classification");

  assert(getTertiaryAcademicStanding(3.56, "4.0").includes("Good Academic Standing"), "3.56 GPA is in Good Academic Standing");
  assert(getTertiaryAcademicStanding(1.50, "4.0").includes("Academic Probation"), "< 2.00 GPA is on Academic Probation");

  // -------------------------------------------------------------------------
  // TEST 2: SCHOOL 1 (DEMO) - BABATUNDE ADEYEMI (ND 1)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 2] School 1 (Demo - Apex): Babatunde Adeyemi (ND 1)");
  const demoSchool = await basePrisma.school.findUnique({
    where: { subdomain: "demo" },
  });
  if (!demoSchool) throw new Error("Demo school not found");

  const demoStudent = await basePrisma.student.findFirst({
    where: { schoolId: demoSchool.id, admissionNumber: "APX/2026/ND1/001" },
  });
  assert(!!demoStudent, "Demo Student Babatunde Adeyemi exists in DB");

  // A. Lecturer Gradebook DB Records Check
  const demoDbGrades = await basePrisma.gradeRecord.findMany({
    where: {
      schoolId: demoSchool.id,
      studentId: demoStudent!.id,
      term: "1st Term",
      className: "ND 1",
    },
    orderBy: { subject: "asc" },
  });

  assert(demoDbGrades.length === 6, `Exactly 6 courses recorded in GradeRecord (found ${demoDbGrades.length})`);
  const ca2AllZero = demoDbGrades.every((g) => g.ca2 === 0);
  assert(ca2AllZero, "GradeRecord.ca2 is 0 / unused for all Tertiary courses");

  // Check COM 111
  const com111 = demoDbGrades.find((g) => g.subject.includes("COM 111"));
  assert(!!com111 && com111.ca1 === 24 && com111.exam === 52 && com111.totalScore === 76, "COM 111 score is 24 CA + 52 Exam = 76 Total");

  // Check COM 112
  const com112 = demoDbGrades.find((g) => g.subject.includes("COM 112"));
  assert(!!com112 && com112.ca1 === 32 && com112.exam === 44 && com112.totalScore === 76, "COM 112 score is 32 CA + 44 Exam = 76 Total");

  // B. Report Card Modal & Service Check
  const demoReport = await getStudentReportCard(
    demoSchool.id,
    demoStudent!.id,
    "1st Term",
    "2026/2027"
  );

  assert(!!demoReport && !!demoReport.reportCard, "Report card loaded for Babatunde Adeyemi");
  const rc = demoReport.reportCard;
  assert(rc.totalScore === 421, `Report card totalScore is 421 (actual: ${rc.totalScore})`);
  assert(rc.gpa === 3.56, `Report card Semester GPA is 3.56 (actual: ${rc.gpa})`);
  assert(rc.gradeLetter === "A", `Report card overall grade letter is A (actual: ${rc.gradeLetter})`);
  assert(demoReport.currentRecords.length === 6, `Report card has 6 currentRecords (actual: ${demoReport.currentRecords.length})`);

  // Verify Quality Points
  const totalQP = demoReport.currentRecords.reduce((sum: number, r: any) => sum + (r.qualityPoints || 0), 0);
  assert(totalQP === 57.0, `Total Quality Points equal 57.0 (actual: ${totalQP})`);

  // C. Broadsheet Check for ND 1
  const demoSheet = await getClassResultSheet(
    demoSchool.id,
    "ND 1",
    "1st Term",
    "2026/2027"
  );
  assert(demoSheet.students.length >= 1, `Broadsheet found students for ND 1 (found ${demoSheet.students.length})`);
  const sheetStudent = demoSheet.students.find((s) => s.id === demoStudent!.id);
  assert(!!sheetStudent, "Babatunde Adeyemi appears on ND 1 Broadsheet");
  if (sheetStudent) {
    const studentCom111 = sheetStudent.subjectScores["COM 111 - Introduction to Computing"];
    assert(!!studentCom111 && studentCom111.gradeLetter === "A", "COM 111 displays grade A on Broadsheet");
  }

  // D. PDF Generation Check
  const pdfDataDemo: ReportCardPdfData = {
    schoolName: demoSchool.name,
    studentName: `${demoStudent!.firstName} ${demoStudent!.lastName}`,
    admissionNumber: demoStudent!.admissionNumber || "APX/2026/ND1/001",
    className: "ND 1",
    term: "1st Term",
    academicYear: "2026/2027",
    tier: "TERTIARY",
    totalScore: rc.totalScore,
    averageScore: rc.averageScore,
    gradeLetter: rc.gradeLetter,
    gpa: rc.gpa,
    subjects: demoReport.currentRecords.map((r: any) => ({
      name: r.subject,
      code: r.code,
      creditUnits: r.creditUnits,
      ca1: r.ca1,
      ca2: r.ca2,
      exam: r.exam,
      total: r.totalScore,
      grade: r.gradeLetter,
      gp: r.gp,
      qualityPoints: r.qualityPoints,
      remarks: r.gradeLetter === "A" ? "Distinction" : "Upper Credit",
    })),
  };

  const pdfDocDemo = generateReportCardPdf(pdfDataDemo);
  assert(!!pdfDocDemo, "PDF document generates successfully for ND 1");

  // -------------------------------------------------------------------------
  // TEST 3: SCHOOL 2 (SANDBOX) - EMEKA OKAFOR (100 LEVEL)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 3] School 2 (Sandbox): Emeka Okafor (100 Level)");
  const sandboxSchool = await basePrisma.school.findUnique({
    where: { subdomain: "sandbox" },
  });
  if (!sandboxSchool) throw new Error("Sandbox school not found");

  const sandboxStudent = await basePrisma.student.findFirst({
    where: { schoolId: sandboxSchool.id, admissionNumber: "TSA/2026/100L/001" },
  });
  assert(!!sandboxStudent, "Sandbox Student Emeka Okafor exists in DB");

  // A. Lecturer Gradebook DB Records Check
  const sandboxDbGrades = await basePrisma.gradeRecord.findMany({
    where: {
      schoolId: sandboxSchool.id,
      studentId: sandboxStudent!.id,
      term: "1st Term",
      className: "100 Level",
    },
    orderBy: { subject: "asc" },
  });

  assert(sandboxDbGrades.length === 6, `Exactly 6 courses recorded in GradeRecord (found ${sandboxDbGrades.length})`);
  const sCa2AllZero = sandboxDbGrades.every((g) => g.ca2 === 0);
  assert(sCa2AllZero, "GradeRecord.ca2 is 0 / unused for 100 Level");

  // Check GST 111
  const gst111 = sandboxDbGrades.find((g) => g.subject.includes("GST 111"));
  assert(!!gst111 && gst111.ca1 === 22 && gst111.exam === 44 && gst111.totalScore === 66, "GST 111 score is 22 CA + 44 Exam = 66 Total");

  // Check PHY 101
  const phy101 = sandboxDbGrades.find((g) => g.subject.includes("PHY 101"));
  assert(!!phy101 && phy101.ca1 === 30 && phy101.exam === 42 && phy101.totalScore === 72, "PHY 101 score is 30 CA + 42 Exam = 72 Total");

  // B. Report Card Modal & Service Check
  const sandboxReport = await getStudentReportCard(
    sandboxSchool.id,
    sandboxStudent!.id,
    "1st Term",
    "2026/2027"
  );

  assert(!!sandboxReport && !!sandboxReport.reportCard, "Report card loaded for Emeka Okafor");
  const sRc = sandboxReport.reportCard;
  assert(sRc.totalScore === 416, `Report card totalScore is 416 (actual: ${sRc.totalScore})`);
  assert(sRc.gpa === 3.56, `Report card Semester GPA is 3.56 (actual: ${sRc.gpa})`);
  assert(sRc.gradeLetter === "B", `Report card overall grade letter is B (actual: ${sRc.gradeLetter})`);
  assert(sandboxReport.currentRecords.length === 6, `Report card has 6 currentRecords (actual: ${sandboxReport.currentRecords.length})`);

  // Verify Quality Points
  const sTotalQP = sandboxReport.currentRecords.reduce((sum: number, r: any) => sum + (r.qualityPoints || 0), 0);
  assert(sTotalQP === 57.0, `Total Quality Points equal 57.0 (actual: ${sTotalQP})`);

  // C. Broadsheet Check for 100 Level
  const sandboxSheet = await getClassResultSheet(
    sandboxSchool.id,
    "100 Level",
    "1st Term",
    "2026/2027"
  );
  assert(sandboxSheet.students.length >= 1, `Broadsheet found students for 100 Level (found ${sandboxSheet.students.length})`);
  const sSheetStudent = sandboxSheet.students.find((s) => s.id === sandboxStudent!.id);
  assert(!!sSheetStudent, "Emeka Okafor appears on 100 Level Broadsheet");
  if (sSheetStudent) {
    const studentGst111 = sSheetStudent.subjectScores["GST 111 - Use of English"];
    assert(!!studentGst111 && studentGst111.gradeLetter === "B", "GST 111 displays grade B on Broadsheet");
  }

  // D. PDF Generation Check
  const pdfDataSandbox: ReportCardPdfData = {
    schoolName: sandboxSchool.name,
    studentName: `${sandboxStudent!.firstName} ${sandboxStudent!.lastName}`,
    admissionNumber: sandboxStudent!.admissionNumber || "TSA/2026/100L/001",
    className: "100 Level",
    term: "1st Term",
    academicYear: "2026/2027",
    tier: "TERTIARY",
    totalScore: sRc.totalScore,
    averageScore: sRc.averageScore,
    gradeLetter: sRc.gradeLetter,
    gpa: sRc.gpa,
    subjects: sandboxReport.currentRecords.map((r: any) => ({
      name: r.subject,
      code: r.code,
      creditUnits: r.creditUnits,
      ca1: r.ca1,
      ca2: r.ca2,
      exam: r.exam,
      total: r.totalScore,
      grade: r.gradeLetter,
      gp: r.gp,
      qualityPoints: r.qualityPoints,
      remarks: r.gradeLetter === "A" ? "Distinction" : "Upper Credit",
    })),
  };

  const pdfDocSandbox = generateReportCardPdf(pdfDataSandbox);
  assert(!!pdfDocSandbox, "PDF document generates successfully for 100 Level");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log("=================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase5Tests()
  .catch((err) => {
    console.error("Test Suite Error:", err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
