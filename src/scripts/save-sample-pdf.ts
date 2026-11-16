import fs from "fs";
import path from "path";
import { generateReportCardPdf } from "../lib/report-card-pdf";
import { getStudentReportCard } from "../lib/report-card-service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const egede = await prisma.school.findFirst({
    where: { subdomain: "egede" },
  });

  const joseph = await prisma.student.findFirst({
    where: {
      schoolId: egede?.id,
      admissionNumber: "EGED/2026/PRIM/0001",
    },
  });

  if (!egede || !joseph) {
    throw new Error("Missing school or student");
  }

  const reportData = await getStudentReportCard(
    egede.id,
    joseph.id,
    "1st Term",
    "2026/2027",
    "Primary School"
  );

  const pdfBytes = await generateReportCardPdf({
    schoolName: "Egede Primary School",
    schoolMotto: "Knowledge, Discipline and Excellence",
    schoolAddress: "Ifite-Ogwari, Ayamelum LGA, Anambra State, Nigeria",
    session: "2026/2027",
    term: "1st Term",
    studentName: "Joseph Okonkwo",
    admissionNumber: "EGED/2026/PRIM/0001",
    className: "Primary 2",
    tierCategory: "PRIMARY",
    classPosition: "2nd",
    totalStudents: 2,
    totalScore: reportData.reportCard?.totalScore || 73,
    averageScore: reportData.reportCard?.averageScore || 73,
    overallGrade: reportData.reportCard?.gradeLetter || "Very Good",
    subjects: reportData.currentRecords.map((r: any) => ({
      subject: r.subject,
      ca1: r.ca1,
      ca2: r.ca2,
      exam: r.exam,
      total: r.totalScore,
      grade: r.gradeLetter,
      remark: r.teacherRemarks,
      classAverage: 76,
      subjectPosition: "2nd",
    })),
  });

  const outPath = path.join(process.cwd(), "Joseph_Okonkwo_Official_ReportCard.pdf");
  fs.writeFileSync(outPath, pdfBytes);
  console.log("PDF saved to:", outPath);
}

main().finally(() => prisma.$disconnect());
