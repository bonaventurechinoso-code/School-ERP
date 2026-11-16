import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Searching for Joseph Okonkwo, Egede, and grade records...");

  const schools = await prisma.school.findMany({
    select: { id: true, name: true, slug: true, subdomain: true },
  });
  console.log("Schools:", JSON.stringify(schools, null, 2));

  const students = await prisma.student.findMany({
    where: {
      OR: [
        { firstName: { contains: "Joseph", mode: "insensitive" } },
        { lastName: { contains: "Okonkwo", mode: "insensitive" } },
        { firstName: { contains: "Chinedu", mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, currentClass: true, schoolId: true },
  });
  console.log("Found students:", JSON.stringify(students, null, 2));

  const allGradeRecords = await prisma.gradeRecord.findMany();
  console.log(`GradeRecords count: ${allGradeRecords.length}`);

  const allAcademicRecords = await prisma.academicRecord.findMany();
  console.log(`AcademicRecords count: ${allAcademicRecords.length}`);

  const allExamResults = await prisma.examResult.findMany({
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  });
  console.log(`ExamResults count: ${allExamResults.length}`);
  console.log("ExamResults sample:", JSON.stringify(allExamResults.slice(0, 5), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
