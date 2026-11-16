import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Verifying Egede Primary 2 Roster Data from DB...");
  const school = await prisma.school.findFirst({ where: { subdomain: "egede" } });
  if (!school) throw new Error("Egede not found");

  const students = await prisma.student.findMany({
    where: { schoolId: school.id, currentClass: "Primary 2" },
  });

  const gradeRecords = await prisma.gradeRecord.findMany({
    where: { schoolId: school.id, className: "Primary 2", term: "1st Term" },
  });

  console.log(`Students in Primary 2: ${students.length}`);
  console.log(`GradeRecords in Primary 2: ${gradeRecords.length}`);

  for (const s of students) {
    const sGrades = gradeRecords.filter((g) => g.studentId === s.id);
    console.log(`Student: ${s.firstName} ${s.lastName}`);
    for (const g of sGrades) {
      console.log(`  Subject: ${g.subject} | CA1: ${g.ca1} | CA2: ${g.ca2} | Exam: ${g.exam} | Total: ${g.totalScore}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
