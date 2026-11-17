import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const students = await basePrisma.student.findMany({
    where: {
      OR: [
        { admissionNumber: { contains: "ND1" } },
        { admissionNumber: { contains: "100L" } },
        { firstName: { in: ["Babatunde", "Emeka"] } },
      ],
    },
    include: {
      school: true,
      GradeRecord: true,
      reportCards: true,
    },
  });

  console.log(`Found ${students.length} matching students:`);
  for (const s of students) {
    console.log(`- ${s.firstName} ${s.lastName} (${s.admissionNumber})`);
    console.log(`  School: ${s.school?.subdomain} (${s.schoolId})`);
    console.log(`  currentClass: "${s.currentClass}"`);
    console.log(`  status: ${s.status}`);
    console.log(`  GradeRecord: ${s.GradeRecord.length}`);
    console.log(`  reportCards: ${JSON.stringify(s.reportCards.map((r) => ({ term: r.term, session: r.academicSession, total: r.totalScore, gradeLetter: r.gradeLetter })))}`);
  }
}

main().finally(() => basePrisma.$disconnect());
