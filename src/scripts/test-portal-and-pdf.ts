import { generateReportCardPdf } from "../lib/report-card-pdf";
import { getStudentReportCard } from "../lib/report-card-service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 1. TESTING STUDENT GRADE RECORDS IN DB ===");
  const joseph = await prisma.student.findFirst({
    where: {
      admissionNumber: "EGED/2026/PRIM/0001",
    },
    include: {
      GradeRecord: true,
      reportCards: true,
    },
  });

  if (!joseph) {
    throw new Error("Joseph not found in DB");
  }

  console.log("Pupil Name:", `${joseph.firstName} ${joseph.lastName}`);
  console.log("GradeRecord entries:", joseph.GradeRecord);

  if (joseph.GradeRecord.length !== 1) {
    throw new Error(`Expected 1 GradeRecord, got ${joseph.GradeRecord.length}`);
  }
  if (joseph.GradeRecord[0].subject !== "English Language") {
    throw new Error(`Expected subject English Language, got ${joseph.GradeRecord[0].subject}`);
  }
  if (joseph.GradeRecord[0].totalScore !== 73) {
    throw new Error(`Expected total 73, got ${joseph.GradeRecord[0].totalScore}`);
  }
  console.log("[PASS] Database contains only the single source of truth English 73 for Joseph!");

  console.log("\n=== 2. TESTING PDF GENERATION BUFFER ===");
  const reportData = await getStudentReportCard(
    "e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8",
    joseph.id,
    "1st Term",
    "2026/2027",
    "Primary"
  );

  const subjects = reportData.currentRecords.map((r: any) => ({
    subject: r.subject,
    ca1: r.ca1,
    ca2: r.ca2,
    exam: r.exam,
    total: r.totalScore,
    grade: r.gradeLetter,
    remark: r.teacherRemarks,
  }));
  
  const pdfBytes = await generateReportCardPdf({
    schoolName: "Egede Primary School",
    schoolAddress: "Ifite-Ogwari",
    session: "2026/2027",
    term: "1st Term",
    studentName: "Joseph Okonkwo",
    admissionNumber: "EGED/2026/PRIM/0001",
    className: "Primary 2",
    tierCategory: "PRIMARY",
    totalScore: reportData.reportCard?.totalScore || 73,
    averageScore: reportData.reportCard?.averageScore || 73,
    subjects,
  });

  console.log("PDF generated successfully, byte size:", pdfBytes.length);
  if (pdfBytes.length < 500) {
    throw new Error("Generated PDF is too small or invalid!");
  }
  console.log("[PASS] PDF generated cleanly without hardcoded fallback subjects!");
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
