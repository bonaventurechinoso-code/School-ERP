import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAisha() {
  console.log("Searching for Aisha / Ibrahim in database...");
  const students = await prisma.student.findMany({
    where: {
      OR: [
        { firstName: { contains: "Aisha", mode: "insensitive" } },
        { lastName: { contains: "Ibrahim", mode: "insensitive" } },
        { admissionNumber: { contains: "002" } },
      ],
    },
    include: {
      school: true,
      tier: true,
    },
  });

  console.log(`Found ${students.length} matching students:`);
  for (const s of students) {
    console.log(`\nID: ${s.id}`);
    console.log(`Name: ${s.firstName} ${s.lastName} (${s.admissionNumber})`);
    console.log(`School: ${s.school?.name} (${s.school?.subdomain || s.school?.slug})`);
    console.log(`Class: currentClass="${s.currentClass}", status="${s.status}"`);
    console.log(`Tier: tierId=${s.tierId}, tierName="${s.tier?.name}"`);

    // Check GradeRecords for this student
    const grades = await prisma.gradeRecord.findMany({
      where: { studentId: s.id },
    });
    console.log(`GradeRecords found: ${grades.length}`);
    for (const g of grades) {
      console.log(`  GradeRecord: term="${g.term}", class="${g.className}", subject="${g.subject}", ca1=${g.ca1}, ca2=${g.ca2}, exam=${g.exam}, total=${g.totalScore}`);
    }

    // Check AcademicRecords
    const acRecs = await prisma.academicRecord.findMany({
      where: { studentId: s.id },
    });
    console.log(`AcademicRecords found: ${acRecs.length}`);
    for (const ar of acRecs) {
      console.log(`  AcademicRecord: term="${ar.term}", session="${ar.academicYear}", class="${ar.className}", subject="${ar.subject}", total=${ar.totalScore}`);
    }

    // Check ReportCard
    const reportCards = await prisma.reportCard.findMany({
      where: { studentId: s.id },
    });
    console.log(`ReportCards found: ${reportCards.length}`);
    for (const rc of reportCards) {
      console.log(`  ReportCard: term="${rc.term}", session="${rc.academicYear}", class="${rc.className}", total=${rc.totalScore}, avg=${rc.averageScore}, grade="${rc.gradeLetter}"`);
    }
  }

  // Also check all Nursery 2 students in Apex
  const apex = await prisma.school.findFirst({
    where: { OR: [{ subdomain: "demo" }, { slug: "demo" }] },
  });
  if (apex) {
    const nur2Students = await prisma.student.findMany({
      where: {
        schoolId: apex.id,
        currentClass: { contains: "Nursery 2", mode: "insensitive" },
      },
    });
    console.log(`\nTotal Nursery 2 students in Apex: ${nur2Students.length}`);
    for (const ns of nur2Students) {
      console.log(`  - ${ns.firstName} ${ns.lastName} (${ns.admissionNumber}) - class: ${ns.currentClass}`);
    }

    const nur1Students = await prisma.student.findMany({
      where: {
        schoolId: apex.id,
        currentClass: { contains: "Nursery 1", mode: "insensitive" },
      },
    });
    console.log(`\nTotal Nursery 1 students in Apex: ${nur1Students.length}`);
    for (const ns of nur1Students) {
      console.log(`  - ${ns.firstName} ${ns.lastName} (${ns.admissionNumber}) - class: ${ns.currentClass}`);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

checkAisha().catch((e) => {
  console.error(e);
  process.exit(1);
});
