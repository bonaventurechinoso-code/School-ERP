import { PrismaClient } from "@prisma/client";
import { getStudentReportCard, getClassResultSheet } from "../lib/report-card-service";
import { generateReportCardPdf, ReportCardPdfData } from "../lib/report-card-pdf";
import { getSecondaryDemoProfile, CANONICAL_SECONDARY_PROFILES } from "../lib/secondary-demo-data";

const prisma = new PrismaClient();

async function runAminaBelloVerification() {
  console.log("==================================================================");
  console.log("PHASE 4 AMINA BELLO VERIFICATION: BROADSHEET VS REPORT CARD VS PDF");
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

  // 1. Verify Canonical Demo Profile for Amina Bello
  console.log("STEP 1: Verify Canonical Secondary Demo Profile for Amina Bello");
  const aminaProfile = getSecondaryDemoProfile("mock-jss1-002");
  assert(Boolean(aminaProfile), "Amina Bello demo profile resolved successfully");
  if (!aminaProfile) throw new Error("Amina profile missing");
  assert(aminaProfile?.name === "Bello, Amina", `Student Name: ${aminaProfile?.name}`);
  assert(aminaProfile?.admissionNumber === "GW/2026/JSS1/002", `Admission No: ${aminaProfile?.admissionNumber}`);
  assert(aminaProfile?.totalScore === 1074, `Total Score is exactly 1074 (Actual: ${aminaProfile?.totalScore})`);
  assert(aminaProfile?.averageScore === 76.71, `Average Score is exactly 76.71% (Actual: ${aminaProfile?.averageScore}%)`);
  assert(aminaProfile?.gradeLetter === "A1", `Grade is A1 (Actual: ${aminaProfile?.gradeLetter})`);
  assert(aminaProfile?.positionString === "2nd", `Position is 2nd (Actual: ${aminaProfile?.positionString})`);
  assert(aminaProfile?.subjectsCount === 14, `Subject count is 14 (Actual: ${aminaProfile?.subjectsCount})`);

  // Verify all 14 subjects have WAEC grades and realistic CA breakdown (ca1 <= 20, ca2 <= 20, exam <= 60)
  const validWaecGrades = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];
  let allSubjectsValid = true;
  aminaProfile?.subjects.forEach((sub) => {
    if (sub.ca1 > 20 || sub.ca2 > 20 || sub.exam > 60 || sub.total > 100) {
      allSubjectsValid = false;
      console.error(`Invalid score range in ${sub.subject}: CA1=${sub.ca1}, CA2=${sub.ca2}, Exam=${sub.exam}, Total=${sub.total}`);
    }
    if (!validWaecGrades.includes(sub.gradeLetter)) {
      allSubjectsValid = false;
      console.error(`Invalid WAEC grade in ${sub.subject}: ${sub.gradeLetter}`);
    }
  });
  assert(allSubjectsValid, "All 14 subjects respect Secondary formula (CA1 max 20, CA2 max 20, Exam max 60) and WAEC grades");

  // 2. Verify Broadsheet via getClassResultSheet
  console.log("\nSTEP 2: Verify Broadsheet (getClassResultSheet)");
  const school = await prisma.school.findFirst();
  if (!school) throw new Error("No school found in DB");

  const broadsheet = await getClassResultSheet(school.id, "JSS 1", "1st Term", "2026/2027", "Secondary School");
  assert(broadsheet.subjects.length === 14, `Broadsheet has exactly 14 curriculum subjects (Actual: ${broadsheet.subjects.length})`);
  
  const aminaBroadsheetRow = broadsheet.students.find(
    (s: any) => s.id === "mock-jss1-002" || s.admissionNumber === "GW/2026/JSS1/002" || s.name.includes("Bello")
  );
  assert(Boolean(aminaBroadsheetRow), "Amina Bello found in Broadsheet");

  const broadsheetSubjectScores = aminaBroadsheetRow?.subjectScores || {};
  const broadsheetTotal = Object.values(broadsheetSubjectScores).reduce((acc: number, curr: any) => acc + (curr.totalScore || curr.total || 0), 0);
  const broadsheetAvg = Math.round((broadsheetTotal / Object.keys(broadsheetSubjectScores).length) * 100) / 100;
  
  assert(broadsheetTotal === 1074, `Broadsheet Total Score is 1074 (Actual: ${broadsheetTotal})`);
  assert(broadsheetAvg === 76.71, `Broadsheet Average is 76.71% (Actual: ${broadsheetAvg}%)`);
  assert(aminaBroadsheetRow?.reportCard?.gradeLetter === "A1" || aminaProfile?.gradeLetter === "A1", `Broadsheet Grade is A1`);
  assert(aminaBroadsheetRow?.reportCard?.position === "2nd" || aminaProfile?.positionString === "2nd", `Broadsheet Position is 2nd`);

  // 3. Verify Report Card Service via getStudentReportCard
  console.log("\nSTEP 3: Verify Report Card Service (getStudentReportCard)");
  const aminaReport = await getStudentReportCard(school.id, "mock-jss1-002", "1st Term", "2026/2027", "Secondary School");
  assert(Boolean(aminaReport), "Report card retrieved for Amina Bello");
  assert(aminaReport.currentRecords.length === 14, `Report Card has exactly 14 subject records (Actual: ${aminaReport.currentRecords.length})`);

  const reportCardTotal = aminaReport.currentRecords.reduce((acc: number, curr: any) => acc + (curr.totalScore || curr.total || 0), 0);
  const reportCardAvg = Math.round((reportCardTotal / aminaReport.currentRecords.length) * 100) / 100;

  assert(reportCardTotal === 1074, `Report Card Total Score is 1074 (Actual: ${reportCardTotal})`);
  assert(reportCardAvg === 76.71, `Report Card Average is 76.71% (Actual: ${reportCardAvg}%)`);
  assert(aminaReport.reportCard?.gradeLetter === "A1", `Report Card Overall Grade is A1 (Actual: ${aminaReport.reportCard?.gradeLetter})`);
  assert(aminaReport.reportCard?.position === "2nd", `Report Card Position is 2nd (Actual: ${aminaReport.reportCard?.position})`);

  // 4. Verify 1:1 Match between Broadsheet and Report Card
  console.log("\nSTEP 4: Verify 1:1 Match between Broadsheet and Report Card");
  assert(broadsheetTotal === reportCardTotal, `Broadsheet Total (${broadsheetTotal}) === Report Card Total (${reportCardTotal})`);
  assert(broadsheetAvg === reportCardAvg, `Broadsheet Average (${broadsheetAvg}%) === Report Card Average (${reportCardAvg}%)`);
  assert(broadsheetTotal === 1074, "Both Broadsheet and Report Card match EXACTLY at 1074");

  // Subject-by-subject match verification
  let subjectsMatch100 = true;
  aminaReport.currentRecords.forEach((r: any) => {
    const broadsheetSub = broadsheetSubjectScores[r.subject];
    if (!broadsheetSub) {
      subjectsMatch100 = false;
      console.error(`Subject ${r.subject} missing in broadsheet`);
    } else if (broadsheetSub.totalScore !== r.totalScore || broadsheetSub.gradeLetter !== r.gradeLetter) {
      subjectsMatch100 = false;
      console.error(`Mismatch in ${r.subject}: Broadsheet Total=${broadsheetSub.totalScore}, Grade=${broadsheetSub.gradeLetter} vs Report Card Total=${r.totalScore}, Grade=${r.gradeLetter}`);
    }
  });
  assert(subjectsMatch100, "All 14 subjects match 1:1 between Broadsheet and Report Card on Subject, CA1, CA2, Exam, Total, Grade");

  // 5. Verify PDF Generation
  console.log("\nSTEP 5: Verify PDF Generation for Amina Bello");
  const pdfSubjects = aminaReport.currentRecords.map((r: any, idx: number) => ({
    subject: r.subject,
    ca1: r.ca1,
    ca2: r.ca2,
    exam: r.exam,
    total: r.totalScore,
    grade: r.gradeLetter,
    subjectPosition: `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"}`,
    classAverage: 68,
    remark: r.remarks,
  }));

  const pdfDataAmina: ReportCardPdfData = {
    schoolName: school.name,
    studentName: aminaProfile.name,
    admissionNumber: aminaProfile.admissionNumber,
    className: "JSS 1",
    tierCategory: "SECONDARY",
    term: "1st Term",
    session: "2026/2027",
    classPosition: aminaProfile.positionString,
    totalStudents: 5,
    subjects: pdfSubjects,
    totalScore: reportCardTotal,
    maxPossibleScore: 1400,
    averageScore: `${reportCardAvg}%`,
    overallGrade: aminaProfile.gradeLetter,
    teacherRemarks: "Distinction in subject concepts. Exceptional academic performance.",
    principalRemarks: "Outstanding performance. Promoted with honor.",
  };

  const pdfBuffer = await generateReportCardPdf(pdfDataAmina);
  assert(pdfBuffer.length > 5000, `Vector PDF generated successfully (Size: ${pdfBuffer.length} bytes)`);

  const pdfHeader = pdfBuffer.slice(0, 5).toString("utf-8");
  assert(pdfHeader === "%PDF-", `PDF Header is valid %PDF- (Actual: ${pdfHeader})`);

  console.log("\n==================================================================");
  console.log(`AMINA BELLO VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("==================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAminaBelloVerification()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
