import { PrismaClient } from "@prisma/client";
import { getStudentReportCard } from "../lib/report-card-service";
import { mapNurseryScoreToGrade } from "../lib/nursery-config";

const prisma = new PrismaClient();

async function verifyNurseryBreakdowns() {
  console.log("==================================================================");
  console.log("NURSERY CA BREAKDOWN PROOF: TEACHER GRADEBOOK vs REPORT CARD");
  console.log("==================================================================");

  const students = [
    { schoolDomain: "demo", name: "Chisom Obi", adm: "APEX/2026/NUR/001" },
    { schoolDomain: "demo", name: "Farouk Musa", adm: "APEX/2026/NUR/002" },
    { schoolDomain: "egede", name: "Chidera Okeke", adm: "EGED/2026/NUR/001" },
    { schoolDomain: "egede", name: "Kamsiyochukwu Egede", adm: "EGED/2026/NUR/002" },
  ];

  const term = "1st Term";
  const academicYear = "2026/2027";
  const tierName = "Nursery / Kindergarten";

  for (const s of students) {
    const school = await prisma.school.findFirst({
      where: { OR: [{ subdomain: s.schoolDomain }, { slug: s.schoolDomain }] },
    });
    if (!school) continue;

    const student = await prisma.student.findFirst({
      where: { schoolId: school.id, admissionNumber: s.adm },
    });
    if (!student) continue;

    // 1. Teacher Gradebook (Source of Truth - GradeRecord)
    const gradeRecords = await prisma.gradeRecord.findMany({
      where: {
        schoolId: school.id,
        studentId: student.id,
        term: term,
      },
    });

    // 2. Report Card view (snapshot in ReportCard record)
    const reportData = await getStudentReportCard(
      school.id,
      student.id,
      term,
      academicYear,
      tierName
    );
    const snap = (reportData.reportCard?.academicRecordSnapshot as any[]) || [];

    console.log(`\nPUPIL: ${s.name} (${s.adm}) - ${school.name}`);
    console.log(`Class: ${student.currentClass || "Nursery 1"} | Term: ${term} | Session: ${academicYear}`);
    console.log(`-`.repeat(80));

    for (const gr of gradeRecords) {
      const subjectName = gr.subject || "Unknown";
      const teacherObs = gr.ca1 ?? 0;
      const teacherCA = gr.ca2 ?? 0;
      const teacherExam = gr.exam ?? 0;
      const teacherTotal = gr.totalScore ?? (teacherObs + teacherCA + teacherExam);
      const teacherGrade = mapNurseryScoreToGrade(teacherTotal).letter;

      const rep = snap.find((x: any) => x.subject === subjectName);

      console.log(`Teacher Gradebook : Subject: ${subjectName.padEnd(28)} | Obs: ${String(teacherObs).padStart(2)} | CA: ${String(teacherCA).padStart(2)} | Exam: ${String(teacherExam).padStart(2)} | Total: ${String(teacherTotal).padStart(2)} | Grade: ${teacherGrade}`);
      if (rep) {
        console.log(`Report Card Sheet : Subject: ${rep.subject.padEnd(28)} | Obs: ${String(rep.ca1).padStart(2)} | CA: ${String(rep.ca2).padStart(2)} | Exam: ${String(rep.exam).padStart(2)} | Total: ${String(rep.total).padStart(2)} | Grade: ${rep.grade}`);
        const match =
          teacherObs === rep.ca1 &&
          teacherCA === rep.ca2 &&
          teacherExam === rep.exam &&
          teacherTotal === rep.total &&
          teacherGrade === rep.grade &&
          subjectName === rep.subject;
        console.log(`VERIFICATION      : ${match ? ">>> EXACT 1:1 MATCH (Observation, CA, Exam, Total, Grade) - 100% IDENTICAL <<<" : ">>> MISMATCH DETECTED! <<<"}`);
      } else {
        console.log(`Report Card Sheet : [SUBJECT NOT FOUND IN REPORT CARD]`);
      }
      console.log(`-`.repeat(80));
    }
    console.log(`Report Card Summary: Total=${reportData.reportCard?.totalScore} | Average=${reportData.reportCard?.averageScore} | Overall Grade=${reportData.reportCard?.gradeLetter}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

verifyNurseryBreakdowns().catch((e) => {
  console.error(e);
  process.exit(1);
});
