import { PrismaClient } from "@prisma/client";
import { compileClassReportCards } from "../lib/report-card-service";

const prisma = new PrismaClient();

async function setupSchoolSecondary(
  subdomain: string,
  className: string,
  student1Data: any,
  student2Data: any,
  subject: string,
  student1Scores: { ca1: number; ca2: number; exam: number },
  student2Scores: { ca1: number; ca2: number; exam: number }
) {
  console.log(`\n-------------------------------------------------------------`);
  console.log(`Setting up Secondary for School: ${subdomain} (${className})`);
  console.log(`-------------------------------------------------------------`);

  const school = await prisma.school.findFirst({
    where: { OR: [{ subdomain }, { slug: subdomain }] },
    include: { academicTiers: true },
  });

  if (!school) {
    throw new Error(`School with subdomain '${subdomain}' not found!`);
  }

  console.log(`Found school: ${school.name} (${school.id})`);

  // 1. Ensure Secondary Tier exists
  let secondaryTier = school.academicTiers.find(
    (t) =>
      t.name.toLowerCase().includes("secondary") ||
      t.name.toLowerCase().includes("high school") ||
      t.name.toLowerCase().includes("college")
  );

  if (!secondaryTier) {
    secondaryTier = await prisma.academicTier.create({
      data: {
        schoolId: school.id,
        name: "Secondary School",
        level: 3,
      },
    });
    console.log(`Created AcademicTier: ${secondaryTier.name}`);
  }

  // Ensure Classroom exists
  let classroom = await prisma.classroom.findFirst({
    where: { schoolId: school.id, name: { equals: className, mode: "insensitive" } },
  });

  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: {
        schoolId: school.id,
        name: className,
        capacity: 35,
        tierId: secondaryTier.id,
      },
    });
    console.log(`Created Classroom: ${className}`);
  }

  // 2. Ensure Course exists
  let course = await prisma.course.findFirst({
    where: {
      schoolId: school.id,
      name: { equals: subject, mode: "insensitive" },
    },
  });

  if (!course) {
    course = await prisma.course.create({
      data: {
        schoolId: school.id,
        name: subject,
        code: subject.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "") + "101",
      },
    });
    console.log(`Created Course: ${course.name}`);
  }

  // 3. Upsert Student 1
  let s1 = await prisma.student.findFirst({
    where: {
      schoolId: school.id,
      admissionNumber: student1Data.admissionNumber,
    },
  });

  if (!s1) {
    s1 = await prisma.student.create({
      data: {
        schoolId: school.id,
        firstName: student1Data.firstName,
        lastName: student1Data.lastName,
        admissionNumber: student1Data.admissionNumber,
        currentClass: className,
        tierId: secondaryTier.id,
        status: "ACTIVE",
      },
    });
    console.log(`Created Student 1: ${s1.firstName} ${s1.lastName}`);
  } else {
    s1 = await prisma.student.update({
      where: { id: s1.id },
      data: { currentClass: className, tierId: secondaryTier.id },
    });
    console.log(`Updated Student 1: ${s1.firstName} ${s1.lastName}`);
  }

  // Upsert Student 2
  let s2 = await prisma.student.findFirst({
    where: {
      schoolId: school.id,
      admissionNumber: student2Data.admissionNumber,
    },
  });

  if (!s2) {
    s2 = await prisma.student.create({
      data: {
        schoolId: school.id,
        firstName: student2Data.firstName,
        lastName: student2Data.lastName,
        admissionNumber: student2Data.admissionNumber,
        currentClass: className,
        tierId: secondaryTier.id,
        status: "ACTIVE",
      },
    });
    console.log(`Created Student 2: ${s2.firstName} ${s2.lastName}`);
  } else {
    s2 = await prisma.student.update({
      where: { id: s2.id },
      data: { currentClass: className, tierId: secondaryTier.id },
    });
    console.log(`Updated Student 2: ${s2.firstName} ${s2.lastName}`);
  }

  // 4. Seed Teacher GradeRecord
  const term = "First Term";
  const academicYear = "2026/2027";

  const total1 = student1Scores.ca1 + student1Scores.ca2 + student1Scores.exam;
  const total2 = student2Scores.ca1 + student2Scores.ca2 + student2Scores.exam;

  await prisma.gradeRecord.upsert({
    where: {
      schoolId_studentId_term_className_subject: {
        schoolId: school.id,
        studentId: s1.id,
        term,
        className,
        subject,
      },
    },
    update: {
      ca1: student1Scores.ca1,
      ca2: student1Scores.ca2,
      exam: student1Scores.exam,
      totalScore: total1,
      updatedAt: new Date(),
    },
    create: {
      schoolId: school.id,
      studentId: s1.id,
      term,
      className,
      subject,
      ca1: student1Scores.ca1,
      ca2: student1Scores.ca2,
      exam: student1Scores.exam,
      totalScore: total1,
    },
  });

  await prisma.gradeRecord.upsert({
    where: {
      schoolId_studentId_term_className_subject: {
        schoolId: school.id,
        studentId: s2.id,
        term,
        className,
        subject,
      },
    },
    update: {
      ca1: student2Scores.ca1,
      ca2: student2Scores.ca2,
      exam: student2Scores.exam,
      totalScore: total2,
      updatedAt: new Date(),
    },
    create: {
      schoolId: school.id,
      studentId: s2.id,
      term,
      className,
      subject,
      ca1: student2Scores.ca1,
      ca2: student2Scores.ca2,
      exam: student2Scores.exam,
      totalScore: total2,
    },
  });

  console.log(`Seeded Teacher GradeRecords for ${subject}:`);
  console.log(`  - ${s1.firstName} ${s1.lastName}: CA1: ${student1Scores.ca1} | CA2: ${student1Scores.ca2} | Exam: ${student1Scores.exam} | Total: ${total1}`);
  console.log(`  - ${s2.firstName} ${s2.lastName}: CA1: ${student2Scores.ca1} | CA2: ${student2Scores.ca2} | Exam: ${student2Scores.exam} | Total: ${total2}`);

  // 5. Compile Class Report Cards
  await compileClassReportCards({
    schoolId: school.id,
    className,
    term,
    academicYear,
  });

  console.log(`Compiled class report cards for ${className} (${term})`);
  return { school, s1, s2, className, subject };
}

async function main() {
  console.log("==================================================================");
  console.log("PHASE 4 SETUP: Secondary WAEC Single Source of Truth");
  console.log("==================================================================");

  // Setup School 1: Apex International Academy ('demo') - JSS 1
  await setupSchoolSecondary(
    "demo",
    "JSS 1",
    {
      firstName: "Chukwudi",
      lastName: "Eze",
      admissionNumber: "APEX/2026/JSS/001",
    },
    {
      firstName: "Fatima",
      lastName: "Bello",
      admissionNumber: "APEX/2026/JSS/002",
    },
    "English Language",
    { ca1: 15, ca2: 18, exam: 40 }, // Total: 73 -> B2
    { ca1: 18, ca2: 18, exam: 50 }  // Total: 86 -> A1
  );

  // Setup School 2: Trial Sandbox Academy ('sandbox') - SSS 1
  await setupSchoolSecondary(
    "sandbox",
    "SSS 1",
    {
      firstName: "Emmanuel",
      lastName: "Adebayo",
      admissionNumber: "SBX/2026/SSS/001",
    },
    {
      firstName: "Zainab",
      lastName: "Aliyu",
      admissionNumber: "SBX/2026/SSS/002",
    },
    "General Mathematics",
    { ca1: 14, ca2: 16, exam: 38 }, // Total: 68 -> B3
    { ca1: 16, ca2: 18, exam: 46 }  // Total: 80 -> A1
  );

  console.log("\n>>> PHASE 4 SETUP COMPLETED SUCCESSFULLY! <<<");
}

main()
  .catch((e) => {
    console.error("Setup error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
