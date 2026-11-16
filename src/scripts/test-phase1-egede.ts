import { PrismaClient } from "@prisma/client";
import { calculateBonaVeeResult, getGradeRemark } from "@/lib/assessmentEngine";
import { getStudentReportCard, compileStudentReportCard } from "@/lib/report-card-service";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("PHASE 1 VERIFICATION: Single Source of Truth Engine Test (Egede)");
  console.log("==================================================================");

  const egede = await prisma.school.findFirst({
    where: { OR: [{ subdomain: "egede" }, { slug: "egede" }] },
  });

  if (!egede) {
    throw new Error("Egede Primary School not found!");
  }

  const joseph = await prisma.student.findFirst({
    where: {
      schoolId: egede.id,
      firstName: { equals: "Joseph", mode: "insensitive" },
      lastName: { equals: "Okonkwo", mode: "insensitive" },
    },
  });

  const chinedu = await prisma.student.findFirst({
    where: {
      schoolId: egede.id,
      firstName: { equals: "Chinedu", mode: "insensitive" },
      lastName: { equals: "TestTwo", mode: "insensitive" },
    },
  });

  if (!joseph || !chinedu) {
    throw new Error("Pupils Joseph Okonkwo or Chinedu TestTwo missing!");
  }

  console.log(`\n1. TEACHER GRADEBOOK (Source of Truth):`);
  const gradeRecords = await prisma.gradeRecord.findMany({
    where: {
      schoolId: egede.id,
      className: "Primary 2",
      term: { in: ["1st Term", "First Term"] },
    },
    orderBy: [{ subject: "asc" }, { totalScore: "desc" }],
  });

  console.log(`Found ${gradeRecords.length} GradeRecord rows in database:`);
  for (const gr of gradeRecords) {
    const studentName = gr.studentId === joseph.id ? "Joseph Okonkwo" : gr.studentId === chinedu.id ? "Chinedu TestTwo" : gr.studentId;
    console.log(`  - Pupil: ${studentName.padEnd(16)} | Subject: ${gr.subject.padEnd(18)} | 1st CA: ${gr.ca1} | 2nd CA: ${gr.ca2} | Exam: ${gr.exam} | Total: ${gr.totalScore}`);
  }

  console.log(`\n2. COMPILE REPORT CARD FOR JOSEPH OKONKWO:`);
  const compileResult = await compileStudentReportCard({
    schoolId: egede.id,
    studentId: joseph.id,
    term: "1st Term",
    academicYear: "2026/2027",
    className: "Primary 2",
    tierName: "Primary School",
  });

  console.log(`Report Card compiled successfully:`, {
    totalScore: compileResult.reportCard.totalScore,
    averageScore: compileResult.reportCard.averageScore,
    gradeLetter: compileResult.reportCard.gradeLetter,
    totalSubjects: compileResult.reportCard.totalSubjects,
    status: compileResult.reportCard.status,
  });

  console.log(`\n3. RETRIEVE REPORT CARD VIA SINGLE SOURCE OF TRUTH SERVICE:`);
  const fetched = await getStudentReportCard(
    egede.id,
    joseph.id,
    "1st Term",
    "2026/2027",
    "Primary School"
  );

  console.log("Subjects on Joseph's Report Sheet:");
  const snapshot = fetched.reportCard?.academicRecordSnapshot as any[];
  for (const s of snapshot || []) {
    console.log(`  - Subject: ${s.subject} | 1st CA: ${s.test1} | 2nd CA: ${s.test2} | Exam: ${s.finalExam} | Total: ${s.totalScore} | Grade: ${s.gradeLetter}`);
  }

  console.log("\n4. ASSERTION CHECKS:");
  const total = compileResult.reportCard.totalScore;
  const avg = compileResult.reportCard.averageScore;
  const gradeLetter = compileResult.reportCard.gradeLetter;
  const subjects = snapshot || [];

  const passedTotal = total === 73;
  const passedAvg = avg === 73;
  const passedGrade = gradeLetter === "Very Good" && subjects[0]?.gradeLetter === "Very Good";
  const passedSubjectCount = subjects.length === 1 && (subjects[0].subject === "English Studies" || subjects[0].subject === "English Language");
  const noFake521 = total !== 521;

  console.log(`  [${passedTotal ? "PASS" : "FAIL"}] Total Score is exactly 73 (got: ${total})`);
  console.log(`  [${passedAvg ? "PASS" : "FAIL"}] Average Score is exactly 73% (got: ${avg}%)`);
  console.log(`  [${passedGrade ? "PASS" : "FAIL"}] Grade Letter is consistently "Very Good" (got overall: ${gradeLetter}, subject: ${subjects[0]?.gradeLetter})`);
  console.log(`  [${noFake521 ? "PASS" : "FAIL"}] Defect eliminated: Total is NOT 521`);
  console.log(`  [${passedSubjectCount ? "PASS" : "FAIL"}] Only English Language is present with entered scores (got ${subjects.length} subject(s))`);

  if (passedTotal && passedAvg && passedGrade && noFake521 && passedSubjectCount) {
    console.log("\n>>> ALL PHASE 1 CHECKS PASSED PERFECTLY! <<<");
  } else {
    console.error("\n>>> VERIFICATION FAILED! Check failures above. <<<");
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
