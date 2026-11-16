import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const egedeSchoolId = "e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8";
  const students = await prisma.student.findMany({
    where: { schoolId: egedeSchoolId },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: true },
  });
  console.log(`Found ${students.length} students in Egede:`);
  console.log(JSON.stringify(students, null, 2));

  // Also check if any grade records exist for this school or any school
  const allGrades = await prisma.gradeRecord.findMany({
    where: { schoolId: egedeSchoolId },
  });
  console.log("Egede GradeRecords:", allGrades);

  const allAcademic = await prisma.academicRecord.findMany({
    where: { schoolId: egedeSchoolId },
  });
  console.log("Egede AcademicRecords:", allAcademic);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
