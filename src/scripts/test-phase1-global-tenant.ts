import { PrismaClient } from "@prisma/client";
import { compileStudentReportCard, getStudentReportCard } from "@/lib/report-card-service";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("PROVE PHASE 1 IS GLOBAL: Tenant-Agnostic Engine Test (Non-Egede)");
  console.log("==================================================================");

  // 1. Target non-Egede School: Trial Sandbox Academy (sandbox)
  const school = await prisma.school.findFirst({
    where: { subdomain: "sandbox" },
    include: { academicTiers: true },
  });

  if (!school) {
    throw new Error("Target non-Egede school 'sandbox' not found in database!");
  }
  console.log(`Target School: ${school.name} (subdomain: ${school.subdomain}) [ID: ${school.id}]`);

  const primaryTier = school.academicTiers.find((t) =>
    t.name.toLowerCase().includes("primary")
  );
  if (!primaryTier) {
    throw new Error("Primary tier not found for sandbox school!");
  }

  // 2. Setup 2 Primary Students in Primary 3
  const className = "Primary 3";
  let classroom = await prisma.classroom.findFirst({
    where: { schoolId: school.id, name: className },
  });
  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: {
        schoolId: school.id,
        name: className,
        capacity: 30,
        tierId: primaryTier.id,
      },
    });
  }

  let student1 = await prisma.student.findFirst({
    where: { schoolId: school.id, admissionNumber: "SAND/2026/PRI/001" },
  });
  if (!student1) {
    student1 = await prisma.student.create({
      data: {
        schoolId: school.id,
        tierId: primaryTier.id,
        firstName: "Kelechi",
        lastName: "Eze",
        admissionNumber: "SAND/2026/PRI/001",
        currentClass: className,
        status: "ENROLLED",
      },
    });
  }

  let student2 = await prisma.student.findFirst({
    where: { schoolId: school.id, admissionNumber: "SAND/2026/PRI/002" },
  });
  if (!student2) {
    student2 = await prisma.student.create({
      data: {
        schoolId: school.id,
        tierId: primaryTier.id,
        firstName: "Amina",
        lastName: "Bello",
        admissionNumber: "SAND/2026/PRI/002",
        currentClass: className,
        status: "ENROLLED",
      },
    });
  }

  console.log(`Pupil 1: ${student1.firstName} ${student1.lastName} (${student1.admissionNumber})`);
  console.log(`Pupil 2: ${student2.firstName} ${student2.lastName} (${student2.admissionNumber})`);

  // 3. Clear existing GradeRecords for this class/term to ensure clean test
  const term = "1st Term";
  const academicYear = "2026/2027";

  await prisma.gradeRecord.deleteMany({
    where: {
      schoolId: school.id,
      className,
      term,
    },
  });

  // 4. Seed Teacher GradeRecord (Single Source of Truth)
  // Student 1 (Kelechi): English Studies -> CA1: 15, CA2: 18, Exam: 40 => Total 73 (Very Good)
  // Student 2 (Amina):   English Studies -> CA1: 18, CA2: 17, Exam: 45 => Total 80 (Distinction)
  // Mathematics is deliberately NOT entered (no rows)
  await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: student1.id,
      subject: "English Studies",
      className,
      term,
      ca1: 15,
      ca2: 18,
      exam: 40,
      totalScore: 73,
    },
  });

  await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: student2.id,
      subject: "English Studies",
      className,
      term,
      ca1: 18,
      ca2: 17,
      exam: 45,
      totalScore: 80,
    },
  });

  console.log("\nTeacher Gradebook rows seeded:");
  console.log("  - Kelechi Eze: English Studies | CA1: 15, CA2: 18, Exam: 40, Total: 73");
  console.log("  - Amina Bello: English Studies | CA1: 18, CA2: 17, Exam: 45, Total: 80");
  console.log("  - Mathematics: NOT ENTERED (blank, absent from database)");

  // 5. Compile and Test Pupil 1 (Kelechi Eze)
  console.log("\n--- COMPILING REPORT FOR KELECHI EZE ---");
  const compileResult1 = await compileStudentReportCard({
    schoolId: school.id,
    studentId: student1.id,
    term,
    academicYear,
    className,
    tierName: primaryTier.name,
  });

  const report1 = await getStudentReportCard(
    school.id,
    student1.id,
    term,
    academicYear,
    primaryTier.name
  );

  const snap1 = (report1.reportCard?.academicRecordSnapshot as any[]) || [];
  console.log(`Pupil 1 Snapshot Subjects (${snap1.length}):`);
  for (const s of snap1) {
    console.log(`  Subject: ${s.subject} | CA1: ${s.test1} | CA2: ${s.test2} | Exam: ${s.finalExam} | Total: ${s.totalScore} | Grade: ${s.gradeLetter}`);
  }
  console.log(`Compiled Summary: Total=${compileResult1.reportCard.totalScore}, Avg=${compileResult1.reportCard.averageScore}, Grade=${compileResult1.reportCard.gradeLetter}`);

  // 6. Compile and Test Pupil 2 (Amina Bello)
  console.log("\n--- COMPILING REPORT FOR AMINA BELLO ---");
  const compileResult2 = await compileStudentReportCard({
    schoolId: school.id,
    studentId: student2.id,
    term,
    academicYear,
    className,
    tierName: primaryTier.name,
  });

  const report2 = await getStudentReportCard(
    school.id,
    student2.id,
    term,
    academicYear,
    primaryTier.name
  );

  const snap2 = (report2.reportCard?.academicRecordSnapshot as any[]) || [];
  console.log(`Pupil 2 Snapshot Subjects (${snap2.length}):`);
  for (const s of snap2) {
    console.log(`  Subject: ${s.subject} | CA1: ${s.test1} | CA2: ${s.test2} | Exam: ${s.finalExam} | Total: ${s.totalScore} | Grade: ${s.gradeLetter}`);
  }
  console.log(`Compiled Summary: Total=${compileResult2.reportCard.totalScore}, Avg=${compileResult2.reportCard.averageScore}, Grade=${compileResult2.reportCard.gradeLetter}`);

  // 7. Rigorous Assertions
  console.log("\n==================== RIGOROUS ASSERTION SUITE ====================");
  const assertions = [
    {
      name: "Pupil 1 Total == 73 (matches Gradebook exactly)",
      passed: compileResult1.reportCard.totalScore === 73,
      actual: compileResult1.reportCard.totalScore,
      expected: 73,
    },
    {
      name: "Pupil 1 Average == 73.0 (excluded unentered subjects)",
      passed: compileResult1.reportCard.averageScore === 73,
      actual: compileResult1.reportCard.averageScore,
      expected: 73,
    },
    {
      name: "Pupil 1 Grade Letter == 'Very Good'",
      passed: compileResult1.reportCard.gradeLetter === "Very Good" && snap1[0]?.gradeLetter === "Very Good",
      actual: `${compileResult1.reportCard.gradeLetter} (subject: ${snap1[0]?.gradeLetter})`,
      expected: "Very Good",
    },
    {
      name: "Pupil 1 NO 521 Bug (total !== 521)",
      passed: compileResult1.reportCard.totalScore !== 521,
      actual: compileResult1.reportCard.totalScore,
      expected: "!= 521",
    },
    {
      name: "Pupil 1 NO Fake/Synthetic Subjects (subject count == 1, subject is English Studies)",
      passed: snap1.length === 1 && snap1[0]?.subject === "English Studies",
      actual: snap1.map(s => s.subject).join(", "),
      expected: "English Studies",
    },
    {
      name: "Pupil 2 Total == 80 (matches Gradebook exactly)",
      passed: compileResult2.reportCard.totalScore === 80,
      actual: compileResult2.reportCard.totalScore,
      expected: 80,
    },
    {
      name: "Pupil 2 Average == 80.0 (excluded unentered subjects)",
      passed: compileResult2.reportCard.averageScore === 80,
      actual: compileResult2.reportCard.averageScore,
      expected: 80,
    },
    {
      name: "Pupil 2 Grade Letter == 'Distinction'",
      passed: compileResult2.reportCard.gradeLetter === "Distinction" && snap2[0]?.gradeLetter === "Distinction",
      actual: `${compileResult2.reportCard.gradeLetter} (subject: ${snap2[0]?.gradeLetter})`,
      expected: "Distinction",
    },
    {
      name: "Pupil 2 NO Fake/Synthetic Subjects (subject count == 1, subject is English Studies)",
      passed: snap2.length === 1 && snap2[0]?.subject === "English Studies",
      actual: snap2.map(s => s.subject).join(", "),
      expected: "English Studies",
    },
  ];

  let allPassed = true;
  for (const a of assertions) {
    if (a.passed) {
      console.log(`[PASS] ${a.name}`);
    } else {
      allPassed = false;
      console.error(`[FAIL] ${a.name} -> Got ${a.actual}, expected ${a.expected}`);
    }
  }

  if (!allPassed) {
    throw new Error("One or more assertion checks failed on non-Egede tenant!");
  }

  console.log("\n>>> PHASE 1 GLOBAL PROOF CERTIFIED: Zero hardcoding, tenant-agnostic Single Source of Truth works identically across schools! <<<");
}

main().catch(console.error).finally(() => prisma.$disconnect());
