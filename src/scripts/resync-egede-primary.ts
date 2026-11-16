import { PrismaClient } from "@prisma/client";
import { compileStudentReportCard, getStudentReportCard } from "../lib/report-card-service";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("RESYNC & VERIFY EGEDE PRIMARY: CHINEDU & JOSEPH");
  console.log("==================================================================");

  const school = await prisma.school.findFirst({
    where: { subdomain: "egede" },
    include: { academicTiers: true },
  });
  if (!school) throw new Error("Egede Primary School not found!");

  // Find Chinedu and Joseph
  const chinedu = await prisma.student.findFirst({
    where: {
      schoolId: school.id,
      firstName: { equals: "Chinedu", mode: "insensitive" },
    },
  });

  const joseph = await prisma.student.findFirst({
    where: {
      schoolId: school.id,
      firstName: { equals: "Joseph", mode: "insensitive" },
    },
  });

  if (!chinedu || !joseph) {
    throw new Error(`Students not found: Chinedu=${Boolean(chinedu)}, Joseph=${Boolean(joseph)}`);
  }

  console.log(`Found Chinedu: ${chinedu.firstName} ${chinedu.lastName} [${chinedu.id}] (${chinedu.currentClass})`);
  console.log(`Found Joseph:  ${joseph.firstName} ${joseph.lastName}   [${joseph.id}] (${joseph.currentClass})`);

  // Ensure currentClass matches Primary 2
  const className = "Primary 2";
  const term = "1st Term";
  const academicYear = "2026/2027";
  const tierName = "Primary School";

  await prisma.student.updateMany({
    where: { id: { in: [chinedu.id, joseph.id] } },
    data: { currentClass: className },
  });

  // Verify / Ensure GradeRecords:
  // Chinedu: ca1: 10, ca2: 20, exam: 50, total: 80, grade: Distinction
  // Joseph:  ca1: 15, ca2: 18, exam: 40, total: 73, grade: Very Good
  // Clean old/duplicate grade records in Primary 2 or Primary 4
  await prisma.gradeRecord.deleteMany({
    where: {
      schoolId: school.id,
      studentId: { in: [chinedu.id, joseph.id] },
    },
  });

  const chineduGr = await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: chinedu.id,
      className,
      term,
      subject: "English Studies",
      ca1: 10,
      ca2: 20,
      exam: 50,
      totalScore: 80,
    },
  });

  const josephGr = await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: joseph.id,
      className,
      term,
      subject: "English Studies",
      ca1: 15,
      ca2: 18,
      exam: 40,
      totalScore: 73,
    },
  });

  console.log("\n[GradeRecord - Single Source of Truth]");
  console.log(`Chinedu GradeRecord: Subject: ${chineduGr.subject} | CA1: ${chineduGr.ca1} | CA2: ${chineduGr.ca2} | Exam: ${chineduGr.exam} | Total: ${chineduGr.totalScore}`);
  console.log(`Joseph  GradeRecord: Subject: ${josephGr.subject}  | CA1: ${josephGr.ca1} | CA2: ${josephGr.ca2} | Exam: ${josephGr.exam} | Total: ${josephGr.totalScore}`);

  // Step c: Delete stale ReportCard snapshots
  const deletedReports = await prisma.reportCard.deleteMany({
    where: {
      schoolId: school.id,
      studentId: { in: [chinedu.id, joseph.id] },
    },
  });
  console.log(`\nDeleted ${deletedReports.count} stale ReportCard snapshot(s).`);

  // Re-compile fresh from live GradeRecord
  const compiledChinedu = await compileStudentReportCard({
    schoolId: school.id,
    studentId: chinedu.id,
    className,
    term,
    academicYear,
    tierName,
  });

  const compiledJoseph = await compileStudentReportCard({
    schoolId: school.id,
    studentId: joseph.id,
    className,
    term,
    academicYear,
    tierName,
  });

  // Retrieve compiled report cards
  const reportChinedu = await getStudentReportCard(school.id, chinedu.id, term, academicYear, tierName);
  const reportJoseph = await getStudentReportCard(school.id, joseph.id, term, academicYear, tierName);

  const snapChinedu = (reportChinedu.reportCard?.academicRecordSnapshot as any[]) || [];
  const snapJoseph = (reportJoseph.reportCard?.academicRecordSnapshot as any[]) || [];

  console.log("\n==================================================================");
  console.log("LIVE GRADEBOOK VS LIVE REPORT CARD SIDE-BY-SIDE");
  console.log("==================================================================");

  console.log("\n--- CHINEDU TESTTWO ---");
  console.log("Teacher Gradebook (Source of Truth):");
  console.log(`  Subject: ${chineduGr.subject} | 1st CA: ${chineduGr.ca1} | 2nd CA: ${chineduGr.ca2} | Exam: ${chineduGr.exam} | Total: ${chineduGr.totalScore}`);
  console.log("Compiled Report Card Snapshot:");
  for (const s of snapChinedu) {
    console.log(`  Subject: ${s.subject} | 1st CA: ${s.ca1} | 2nd CA: ${s.ca2} | Exam: ${s.exam} | Total: ${s.total} | Grade: ${s.grade}`);
  }
  console.log(`  Report Card Header Summary: Total=${reportChinedu.reportCard?.totalScore}, Average=${reportChinedu.reportCard?.averageScore}, Overall Grade=${reportChinedu.reportCard?.gradeLetter}`);

  console.log("\n--- JOSEPH OKONKWO ---");
  console.log("Teacher Gradebook (Source of Truth):");
  console.log(`  Subject: ${josephGr.subject} | 1st CA: ${josephGr.ca1} | 2nd CA: ${josephGr.ca2} | Exam: ${josephGr.exam} | Total: ${josephGr.totalScore}`);
  console.log("Compiled Report Card Snapshot:");
  for (const s of snapJoseph) {
    console.log(`  Subject: ${s.subject} | 1st CA: ${s.ca1} | 2nd CA: ${s.ca2} | Exam: ${s.exam} | Total: ${s.total} | Grade: ${s.grade}`);
  }
  console.log(`  Report Card Header Summary: Total=${reportJoseph.reportCard?.totalScore}, Average=${reportJoseph.reportCard?.averageScore}, Overall Grade=${reportJoseph.reportCard?.gradeLetter}`);

  // Assert exact match:
  if (
    snapChinedu[0].subject !== "English Studies" ||
    snapChinedu[0].ca1 !== 10 ||
    snapChinedu[0].ca2 !== 20 ||
    snapChinedu[0].exam !== 50 ||
    snapChinedu[0].total !== 80 ||
    snapChinedu[0].grade !== "Distinction"
  ) {
    throw new Error(`Chinedu does not match exactly! Got: ${JSON.stringify(snapChinedu[0])}`);
  }

  if (
    snapJoseph[0].subject !== "English Studies" ||
    snapJoseph[0].ca1 !== 15 ||
    snapJoseph[0].ca2 !== 18 ||
    snapJoseph[0].exam !== 40 ||
    snapJoseph[0].total !== 73 ||
    snapJoseph[0].grade !== "Very Good"
  ) {
    throw new Error(`Joseph does not match exactly! Got: ${JSON.stringify(snapJoseph[0])}`);
  }

  console.log("\n>>> LIVE GRADEBOOK VS LIVE REPORT CARD MATCHES 100% EXACTLY! <<<");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
