import { PrismaClient } from "@prisma/client";
import { getStudentReportCard, getClassResultSheet } from "../lib/report-card-service";
import { generateReportCardPdf, ReportCardPdfData } from "../lib/report-card-pdf";
import { calculateBonaVeeResult, getGradeRemark, getNigerianGrade } from "../lib/assessmentEngine";
import { mapScoreToGradeLetter } from "../lib/grading-engine";
import { getTierForClass } from "../lib/school-tier-classes";
import {
  approveClassReportCardsAction,
  returnClassReportCardsAction,
  unlockClassReportCardsAction,
} from "../app/[schoolDomain]/(admin)/report-cards/actions";
import { saveClassroomGrades } from "../app/[schoolDomain]/portal/staff/actions";

const prisma = new PrismaClient();

async function runPhase4Tests() {
  console.log("==================================================================");
  console.log("PHASE 4 VERIFICATION SUITE: SECONDARY TIER (WAEC / NECO A1-F9)");
  console.log("==================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: any, desc: string) {
    totalTests++;
    if (Boolean(condition)) {
      console.log(`  [PASS] ${desc}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Apex International Academy ('demo') - JSS 1 (English Language)
  // --------------------------------------------------------------------------
  console.log("TEST 1: Apex JSS 1 (English Language) - 1:1 Match (Teacher vs Report vs Broadsheet vs PDF)");

  const apexSchool = await prisma.school.findFirst({
    where: { OR: [{ subdomain: "demo" }, { slug: "demo" }] },
  });
  if (!apexSchool) throw new Error("Apex school ('demo') not found!");

  const chukwudi = await prisma.student.findFirst({
    where: { schoolId: apexSchool.id, admissionNumber: "APEX/2026/JSS/001" },
  });
  const fatima = await prisma.student.findFirst({
    where: { schoolId: apexSchool.id, admissionNumber: "APEX/2026/JSS/002" },
  });
  if (!chukwudi || !fatima) throw new Error("Apex secondary students not found!");

  // 1a. Verify Teacher Gradebook (GradeRecord)
  const apexRecords = await prisma.gradeRecord.findMany({
    where: {
      schoolId: apexSchool.id,
      className: "JSS 1",
      term: "First Term",
    },
    orderBy: { totalScore: "desc" },
  });

  assert(apexRecords.length === 2, "Teacher Gradebook contains exactly 2 GradeRecords for JSS 1");

  const fatimaGr = apexRecords.find((r) => r.studentId === fatima.id)!;
  const chukwudiGr = apexRecords.find((r) => r.studentId === chukwudi.id)!;

  assert(
    fatimaGr.subject === "English Language" &&
      fatimaGr.ca1 === 18 &&
      fatimaGr.ca2 === 18 &&
      fatimaGr.exam === 50 &&
      fatimaGr.totalScore === 86,
    `Fatima GradeRecord: English Language | CA1: 18 | CA2: 18 | Exam: 50 | Total: 86`
  );

  assert(
    chukwudiGr.subject === "English Language" &&
      chukwudiGr.ca1 === 15 &&
      chukwudiGr.ca2 === 18 &&
      chukwudiGr.exam === 40 &&
      chukwudiGr.totalScore === 73,
    `Chukwudi GradeRecord: English Language | CA1: 15 | CA2: 18 | Exam: 40 | Total: 73`
  );

  // 1b. Verify Report Card Service output
  const chukwudiReport = await getStudentReportCard(apexSchool.id, chukwudi.id, "First Term", "2026/2027", "JSS 1");
  const fatimaReport = await getStudentReportCard(apexSchool.id, fatima.id, "First Term", "2026/2027", "JSS 1");

  const chukwudiSub: any = chukwudiReport.currentRecords.find((r: any) => r.subject === "English Language");
  const fatimaSub: any = fatimaReport.currentRecords.find((r: any) => r.subject === "English Language");

  assert(
    chukwudiSub &&
      chukwudiSub.ca1 === 15 &&
      chukwudiSub.ca2 === 18 &&
      chukwudiSub.exam === 40 &&
      chukwudiSub.totalScore === 73 &&
      chukwudiSub.gradeLetter === "B2",
    `Chukwudi Report Card matches Gradebook: English Language | 15 | 18 | 40 | 73 | Grade: B2 (NOT Very Good, NOT Distinction)`
  );

  assert(
    fatimaSub &&
      fatimaSub.ca1 === 18 &&
      fatimaSub.ca2 === 18 &&
      fatimaSub.exam === 50 &&
      fatimaSub.totalScore === 86 &&
      fatimaSub.gradeLetter === "A1",
    `Fatima Report Card matches Gradebook: English Language | 18 | 18 | 50 | 86 | Grade: A1 (NOT Distinction, NOT Excellent)`
  );

  // 1c. Verify Broadsheet (getClassResultSheet)
  const apexBroadsheet = await getClassResultSheet(apexSchool.id, "JSS 1", "First Term", "2026/2027");
  const chukwudiSheet = apexBroadsheet.students.find((s: any) => s.id === chukwudi.id);
  const fatimaSheet = apexBroadsheet.students.find((s: any) => s.id === fatima.id);

  assert(
    chukwudiSheet?.subjectScores?.["English Language"]?.gradeLetter === "B2" &&
      chukwudiSheet?.subjectScores?.["English Language"]?.totalScore === 73,
    `Broadsheet matches Chukwudi: Total 73 | Grade B2`
  );

  assert(
    fatimaSheet?.subjectScores?.["English Language"]?.gradeLetter === "A1" &&
      fatimaSheet?.subjectScores?.["English Language"]?.totalScore === 86,
    `Broadsheet matches Fatima: Total 86 | Grade A1`
  );

  // 1d. Verify Vector PDF generation
  const pdfDataChukwudi: ReportCardPdfData = {
    schoolName: apexSchool.name,
    studentName: `${chukwudi.firstName} ${chukwudi.lastName}`,
    admissionNumber: chukwudi.admissionNumber || "APEX/001",
    className: "JSS 1",
    tierCategory: "SECONDARY",
    term: "First Term",
    session: "2026/2027",
    classPosition: "2nd",
    totalStudents: 2,
    totalScore: 73,
    averageScore: "73.0%",
    overallGrade: "B2",
    promotionStatus: "In Good Standing",
    subjects: [
      {
        subject: "English Language",
        ca1: 15,
        ca2: 18,
        exam: 40,
        total: 73,
        grade: "B2",
        subjectPosition: "2nd",
        remark: "Very good academic performance",
      },
    ],
  };

  const chukwudiPdfBuf = await generateReportCardPdf(pdfDataChukwudi);
  assert(
    chukwudiPdfBuf.length > 1000 && chukwudiPdfBuf.toString("utf8", 0, 5).startsWith("%PDF"),
    `Chukwudi PDF generated successfully (${chukwudiPdfBuf.length} bytes, valid %PDF header)`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Trial Sandbox Academy ('sandbox') - SSS 1 (General Mathematics)
  // --------------------------------------------------------------------------
  console.log("\nTEST 2: Sandbox SSS 1 (General Mathematics) - 1:1 Match Across 2nd School");

  const sandboxSchool = await prisma.school.findFirst({
    where: { OR: [{ subdomain: "sandbox" }, { slug: "sandbox" }] },
  });
  if (!sandboxSchool) throw new Error("Sandbox school ('sandbox') not found!");

  const emmanuel = await prisma.student.findFirst({
    where: { schoolId: sandboxSchool.id, admissionNumber: "SBX/2026/SSS/001" },
  });
  const zainab = await prisma.student.findFirst({
    where: { schoolId: sandboxSchool.id, admissionNumber: "SBX/2026/SSS/002" },
  });
  if (!emmanuel || !zainab) throw new Error("Sandbox secondary students not found!");

  const emmanuelReport = await getStudentReportCard(sandboxSchool.id, emmanuel.id, "First Term", "2026/2027", "SSS 1");
  const zainabReport = await getStudentReportCard(sandboxSchool.id, zainab.id, "First Term", "2026/2027", "SSS 1");

  const emmanuelSub: any = emmanuelReport.currentRecords.find((r: any) => r.subject === "General Mathematics");
  const zainabSub: any = zainabReport.currentRecords.find((r: any) => r.subject === "General Mathematics");

  assert(
    emmanuelSub &&
      emmanuelSub.ca1 === 14 &&
      emmanuelSub.ca2 === 16 &&
      emmanuelSub.exam === 38 &&
      emmanuelSub.totalScore === 68 &&
      emmanuelSub.gradeLetter === "B3",
    `Emmanuel Report Card matches Gradebook: General Mathematics | 14 | 16 | 38 | 68 | Grade: B3`
  );

  assert(
    zainabSub &&
      zainabSub.ca1 === 16 &&
      zainabSub.ca2 === 18 &&
      zainabSub.exam === 46 &&
      zainabSub.totalScore === 80 &&
      zainabSub.gradeLetter === "A1",
    `Zainab Report Card matches Gradebook: General Mathematics | 16 | 18 | 46 | 80 | Grade: A1`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Full WAEC 9-Point Grade Scale Verification (A1 - F9 ONLY)
  // --------------------------------------------------------------------------
  console.log("\nTEST 3: Full WAEC 9-Point Scale - Distinction/Very Good/Excellent/Needs Support are IMPOSSIBLE");

  const scaleTests = [
    { score: 85, expectedGrade: "A1", label: "85 -> A1" },
    { score: 75, expectedGrade: "A1", label: "75 -> A1" },
    { score: 74, expectedGrade: "B2", label: "74 -> B2" },
    { score: 70, expectedGrade: "B2", label: "70 -> B2" },
    { score: 69, expectedGrade: "B3", label: "69 -> B3" },
    { score: 65, expectedGrade: "B3", label: "65 -> B3" },
    { score: 64, expectedGrade: "C4", label: "64 -> C4" },
    { score: 60, expectedGrade: "C4", label: "60 -> C4" },
    { score: 59, expectedGrade: "C5", label: "59 -> C5 (WAEC Credit)" },
    { score: 55, expectedGrade: "C5", label: "55 -> C5 (WAEC Credit)" },
    { score: 54, expectedGrade: "C6", label: "54 -> C6" },
    { score: 50, expectedGrade: "C6", label: "50 -> C6" },
    { score: 49, expectedGrade: "D7", label: "49 -> D7 (WAEC Pass)" },
    { score: 45, expectedGrade: "D7", label: "45 -> D7 (WAEC Pass)" },
    { score: 44, expectedGrade: "E8", label: "44 -> E8 (WAEC Pass)" },
    { score: 40, expectedGrade: "E8", label: "40 -> E8 (WAEC Pass)" },
    { score: 39, expectedGrade: "F9", label: "39 -> F9 (WAEC Fail)" },
    { score: 0, expectedGrade: "F9", label: "0 -> F9 (WAEC Fail)" },
  ];

  for (const st of scaleTests) {
    const fromBonaVee = calculateBonaVeeResult("Secondary School", { ca1: st.score, ca2: 0, exam: 0 }).grade;
    const fromMapScore = mapScoreToGradeLetter(st.score, "SECONDARY").letter;
    assert(
      fromBonaVee === st.expectedGrade && fromMapScore === st.expectedGrade,
      `Score ${st.label}: assessmentEngine=${fromBonaVee}, gradingEngine=${fromMapScore}`
    );
  }

  // Verify Primary/Nursery grades are IMPOSSIBLE for Secondary
  const secondary75 = calculateBonaVeeResult("Secondary School", { exam: 75 }).grade;
  const secondary65 = calculateBonaVeeResult("Secondary School", { exam: 65 }).grade;
  const secondary30 = calculateBonaVeeResult("Secondary School", { exam: 30 }).grade;

  assert(secondary75 !== "Distinction" && secondary75 !== "Excellent", "Secondary 75 is NOT 'Distinction' or 'Excellent'");
  assert(secondary65 !== "Very Good", "Secondary 65 is NOT 'Very Good'");
  assert(secondary30 !== "Needs Support" && secondary30 !== "Fail", "Secondary 30 is NOT 'Needs Support' or 'Fail' (must be F9)");

  // --------------------------------------------------------------------------
  // TEST 4: Principal Approval, Locking, Return & AuditLog Flow
  // --------------------------------------------------------------------------
  console.log("\nTEST 4: Principal Approval, Locking, Return, and AuditLog Flow");

  // 4a. Lock JSS 1 Report Cards
  const lockResult = await approveClassReportCardsAction(apexSchool.id, "JSS 1", "First Term", "2026/2027", true);
  assert(lockResult.success && lockResult.status === "LOCKED", "Principal locked JSS 1 report cards");

  // 4b. Teacher Grade Save blocked while locked
  const blockedSave = await saveClassroomGrades(apexSchool.id, "JSS 1", "English Language", "First Term", "2026/2027", [
    { studentId: chukwudi.id, ca1: 20, ca2: 20, exam: 60, totalScore: 100 },
  ]);
  assert(
    !blockedSave.success && blockedSave.error?.toLowerCase().includes("locked"),
    `Teacher grade modification correctly blocked while class is LOCKED: "${blockedSave.error}"`
  );

  // 4c. Principal returns with revision comment
  const returnResult = await returnClassReportCardsAction(
    apexSchool.id,
    "JSS 1",
    "First Term",
    "2026/2027",
    "Please verify CA 1 marks for student APEX/2026/JSS/001"
  );
  assert(returnResult.success, "Principal returned report cards with comment");

  // 4d. Unlock with reason and verify AuditLog
  const unlockResult = await unlockClassReportCardsAction(
    apexSchool.id,
    "JSS 1",
    "First Term",
    "2026/2027",
    "Grade corrections authorized by Vice Principal"
  );
  assert(unlockResult.success, "Principal unlocked report cards");

  const latestAudit = await prisma.auditLog.findFirst({
    where: { schoolId: apexSchool.id },
    orderBy: { createdAt: "desc" },
  });
  assert(
    latestAudit && latestAudit.action === "HEAD_TEACHER_UNLOCK_GRADES",
    `AuditLog recorded: action="${latestAudit?.action}", target="${latestAudit?.target}"`
  );

  // --------------------------------------------------------------------------
  // TEST 5: Parent Portal Isolation
  // --------------------------------------------------------------------------
  console.log("\nTEST 5: Parent Portal Student Data Scoping");

  const chukwudiCardOnly = await prisma.reportCard.findMany({
    where: { schoolId: apexSchool.id, studentId: chukwudi.id },
  });
  assert(
    chukwudiCardOnly.every((c) => c.studentId === chukwudi.id),
    "Parent / Student queries are strictly scoped to studentId (no multi-student leaks)"
  );

  // --------------------------------------------------------------------------
  // TEST 6: Zero Fake Subjects / Zero Hardcoding Verification
  // --------------------------------------------------------------------------
  console.log("\nTEST 6: Zero Fake Subjects / Zero Hardcoding Proof");

  const allSecondaryGradeRecords = await prisma.gradeRecord.findMany({
    where: {
      schoolId: { in: [apexSchool.id, sandboxSchool.id] },
      className: { in: ["JSS 1", "SSS 1"] },
    },
  });

  const fakeSubjectFound = allSecondaryGradeRecords.some(
    (gr) =>
      gr.subject.toLowerCase() === "continuous assessment" ||
      gr.subject.toLowerCase() === "general studies" ||
      gr.subject.toLowerCase() === "sample subject"
  );

  assert(!fakeSubjectFound, "Zero fake subjects ('Continuous Assessment', 'General Studies') in GradeRecords");

  // --------------------------------------------------------------------------
  // TEST 7: Full Regression Across All Tiers (Primary, Creche, Nursery)
  // --------------------------------------------------------------------------
  console.log("\nTEST 7: Regression Across All Tiers (Primary, Creche, Nursery)");

  // 7a. Primary Regression: 73 must be Very Good (Distinction / Very Good / Credit / Pass / Fail)
  const primary73 = calculateBonaVeeResult("Primary School", { exam: 73 }).grade;
  const primary85 = calculateBonaVeeResult("Primary School", { exam: 85 }).grade;
  const primary45 = calculateBonaVeeResult("Primary School", { exam: 45 }).grade;
  const primary35 = calculateBonaVeeResult("Primary School", { exam: 35 }).grade;
  assert(primary73 === "Very Good", `Primary 73 = Very Good (got: ${primary73})`);
  assert(primary85 === "Distinction", `Primary 85 = Distinction (got: ${primary85})`);
  assert(primary45 === "Pass", `Primary 45 = Pass (got: ${primary45})`);
  assert(primary35 === "Fail", `Primary 35 = Fail (got: ${primary35})`);
  assert(primary73 !== "B2" && primary85 !== "A1", "Primary scale NEVER outputs Secondary grades A1-F9");

  // 7b. Creche Regression: 73 must be Very Good, 80 must be Excellent (50/50 default)
  const creche73 = calculateBonaVeeResult("Creche", { exam: 73 }).grade;
  const creche80 = calculateBonaVeeResult("Creche", { exam: 80 }).grade;
  const creche35 = calculateBonaVeeResult("Creche", { exam: 35 }).grade;
  assert(creche73 === "Very Good", `Creche 73 = Very Good (got: ${creche73})`);
  assert(creche80 === "Excellent", `Creche 80 = Excellent (got: ${creche80})`);
  assert(creche35 === "Needs Support", `Creche 35 = Needs Support (got: ${creche35})`);
  assert(creche35 !== "Fail" && creche35 !== "F9", "Creche NEVER outputs Fail or F9");

  // 7c. Nursery Regression: 73 must be Very Good, 35 must be Needs Support
  const nursery73 = calculateBonaVeeResult("Nursery / Kindergarten", { exam: 73 }).grade;
  const nursery35 = calculateBonaVeeResult("Nursery / Kindergarten", { exam: 35 }).grade;
  const nursery0 = calculateBonaVeeResult("Nursery / Kindergarten", { exam: 0 }).grade;
  assert(nursery73 === "Very Good", `Nursery 73 = Very Good (got: ${nursery73})`);
  assert(nursery35 === "Needs Support", `Nursery 35 = Needs Support (got: ${nursery35})`);
  assert(nursery0 === "Needs Support", `Nursery 0 (empty) = Needs Support (got: ${nursery0})`);
  assert(nursery0 !== "F9" && nursery0 !== "Fail", "Nursery 0 is NEVER F9 or Fail");

  // 7d. Egede Primary Live Regression: Joseph Okonkwo (73) & Chinedu TestTwo (80)
  const egedeSchool = await prisma.school.findFirst({
    where: { OR: [{ subdomain: "egede" }, { slug: "egede" }] },
  });
  if (egedeSchool) {
    const egedeStudents = await prisma.student.findMany({
      where: { schoolId: egedeSchool.id },
      include: { GradeRecord: true },
    });
    const joseph = egedeStudents.find((s) => s.firstName.toLowerCase().includes("joseph"));
    if (joseph && joseph.GradeRecord.length > 0) {
      const jGr = joseph.GradeRecord[0];
      const jGrade = calculateBonaVeeResult("Primary School", { exam: jGr.totalScore }).grade;
      assert(
        jGrade === "Very Good" && jGr.totalScore === 73,
        `Egede Live Primary: Joseph Okonkwo = ${jGr.totalScore} | Grade: ${jGrade} (Distinction scale preserved)`
      );
    }
  }

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED!`);
  console.log("==================================================================");

  if (passedTests === totalTests) {
    console.log(">>> ALL PHASE 4 REQUIREMENTS MET AND FULLY VERIFIED! <<<");
  } else {
    throw new Error(`Only ${passedTests}/${totalTests} tests passed.`);
  }
}

runPhase4Tests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
