import fs from "fs";
import path from "path";
import { generateReportCardPdf } from "../lib/report-card-pdf";
import { getStudentReportCard } from "../lib/report-card-service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apex = await prisma.school.findFirst({
    where: { subdomain: "demo" },
  });

  const adaeze = await prisma.student.findFirst({
    where: {
      schoolId: apex?.id,
      admissionNumber: "APEX/2026/CRE/001",
    },
  });

  if (!apex || !adaeze) {
    throw new Error("Missing school or student");
  }

  const reportData = await getStudentReportCard(
    apex.id,
    adaeze.id,
    "1st Term",
    "2026/2027",
    "Creche / Nursery"
  );

  console.log("Creche Report Card for PDF:", {
    totalScore: reportData.reportCard?.totalScore,
    averageScore: reportData.reportCard?.averageScore,
    gradeLetter: reportData.reportCard?.gradeLetter,
    subjectCount: reportData.currentRecords.length,
  });

  const pdfBytes = await generateReportCardPdf({
    schoolName: apex.name,
    schoolMotto: "Excellence in Early Years Foundation",
    schoolAddress: "Plot 12 Victoria Island, Lagos State, Nigeria",
    session: "2026/2027",
    term: "1st Term",
    studentName: `${adaeze.firstName} ${adaeze.lastName}`,
    admissionNumber: adaeze.admissionNumber || "APEX/2026/CRE/001",
    className: "Creche",
    tierCategory: "NURSERY",
    classPosition: "2nd",
    totalStudents: 2,
    totalScore: reportData.reportCard?.totalScore || 73,
    averageScore: reportData.reportCard?.averageScore || 73,
    overallGrade: reportData.reportCard?.gradeLetter || "Very Good",
    subjects: reportData.currentRecords.map((r: any) => ({
      subject: r.subject,
      ca1: r.ca1,
      ca2: r.ca2,
      exam: r.exam || 0,
      total: r.totalScore,
      grade: r.gradeLetter || "Very Good",
      remark: "Very Good Progress",
      classAverage: 76.5,
      subjectPosition: "2nd",
    })),
  });

  const outDir = path.join(process.cwd(), "sample_reports");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, "adaeze_okoro_creche_report.pdf");
  fs.writeFileSync(outPath, Buffer.from(pdfBytes));
  console.log(`Successfully generated and wrote Creche PDF: ${outPath} (${pdfBytes.length} bytes)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
