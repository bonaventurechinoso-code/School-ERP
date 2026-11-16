import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const subjects = await prisma.gradeRecord.findMany({
    where: {
      OR: [
        { subject: { contains: "Numeracy", mode: "insensitive" } },
        { subject: { contains: "Literacy", mode: "insensitive" } },
        { subject: { contains: "Rhymes", mode: "insensitive" } },
        { subject: { contains: "SEN", mode: "insensitive" } },
      ],
    },
  });
  console.log(`Matching GradeRecords across entire DB: ${subjects.length}`);
  for (const s of subjects) {
    console.log(`  - School: ${s.schoolId}, Student: ${s.studentId}, Class: ${s.className}, Subject: ${s.subject}, Scores: ${s.ca1}/${s.ca2}/${s.exam}`);
  }

  // Check all students with admissionNumber containing 002
  const students002 = await prisma.student.findMany({
    where: {
      admissionNumber: { contains: "002" },
    },
    include: { school: true },
  });
  console.log(`\nStudents with 002 in admissionNumber: ${students002.length}`);
  for (const st of students002) {
    console.log(`  - ${st.firstName} ${st.lastName} (${st.admissionNumber}), School: ${st.school?.name} (${st.school?.subdomain}), Class: ${st.currentClass}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
