import { PrismaClient } from "@prisma/client";
import { DEFAULT_NURSERY_CONFIG } from "../lib/nursery-config";

const prisma = new PrismaClient();

async function setupSchoolNursery(subdomain: string, pupil1Data: any, pupil2Data: any) {
  console.log(`\n-------------------------------------------------------------`);
  console.log(`Setting up Nursery for School: ${subdomain}`);
  console.log(`-------------------------------------------------------------`);

  const school = await prisma.school.findFirst({
    where: { OR: [{ subdomain }, { slug: subdomain }] },
    include: { academicTiers: true },
  });

  if (!school) {
    throw new Error(`School with subdomain '${subdomain}' not found!`);
  }

  console.log(`Found school: ${school.name} (${school.id})`);

  // 1. Ensure Nursery Tier and Classroom exist
  let nurseryTier = school.academicTiers.find(
    (t) => t.name.toLowerCase().includes("nursery") || t.name.toLowerCase().includes("kindergarten")
  );

  if (!nurseryTier) {
    nurseryTier = await prisma.academicTier.create({
      data: {
        schoolId: school.id,
        name: "Nursery / Kindergarten",
        level: 1,
      },
    });
    console.log(`Created AcademicTier: ${nurseryTier.name}`);
  }

  let nurseryClassroom = await prisma.classroom.findFirst({
    where: { schoolId: school.id, name: { equals: "Nursery 1", mode: "insensitive" } },
  });

  if (!nurseryClassroom) {
    nurseryClassroom = await prisma.classroom.create({
      data: {
        schoolId: school.id,
        name: "Nursery 1",
        capacity: 25,
        tierId: nurseryTier.id,
      },
    });
    console.log(`Created Classroom: Nursery 1`);
  }

  // 2. Configure Nursery Assessment Formula in Admin Settings
  // Default: Observation (50) + Continuous Assessment (50) = 100 max, NO Exam (examMax: 0, hasExam: false)
  const existingTierConfig = (school.tierDatabasesConfig as any) || {};
  const nurseryFormula = {
    hasExam: false,
    ca1Name: "Observation",
    ca1Max: 50,
    ca2Name: "Continuous Assessment",
    ca2Max: 50,
    examName: "Exam",
    examMax: 0,
    totalMax: 100,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      tierDatabasesConfig: {
        ...existingTierConfig,
        nurseryAssessmentConfig: nurseryFormula,
      },
    },
  });
  console.log("Configured Admin Nursery Formula:", nurseryFormula);

  // 3. Setup Pupil 1
  let p1 = await prisma.student.findFirst({
    where: { schoolId: school.id, admissionNumber: pupil1Data.admissionNumber },
  });

  if (!p1) {
    p1 = await prisma.student.create({
      data: {
        schoolId: school.id,
        tierId: nurseryTier.id,
        firstName: pupil1Data.firstName,
        lastName: pupil1Data.lastName,
        admissionNumber: pupil1Data.admissionNumber,
        currentClass: "Nursery 1",
        status: "ENROLLED",
        dateOfBirth: new Date("2022-04-12"),
      },
    });
    console.log(`Created Pupil 1: ${p1.firstName} ${p1.lastName} (${p1.admissionNumber})`);
  } else {
    p1 = await prisma.student.update({
      where: { id: p1.id },
      data: { currentClass: "Nursery 1", tierId: nurseryTier.id, status: "ENROLLED" },
    });
    console.log(`Updated Pupil 1: ${p1.firstName} ${p1.lastName} (${p1.admissionNumber})`);
  }

  // 4. Setup Pupil 2
  let p2 = await prisma.student.findFirst({
    where: { schoolId: school.id, admissionNumber: pupil2Data.admissionNumber },
  });

  if (!p2) {
    p2 = await prisma.student.create({
      data: {
        schoolId: school.id,
        tierId: nurseryTier.id,
        firstName: pupil2Data.firstName,
        lastName: pupil2Data.lastName,
        admissionNumber: pupil2Data.admissionNumber,
        currentClass: "Nursery 1",
        status: "ENROLLED",
        dateOfBirth: new Date("2022-08-19"),
      },
    });
    console.log(`Created Pupil 2: ${p2.firstName} ${p2.lastName} (${p2.admissionNumber})`);
  } else {
    p2 = await prisma.student.update({
      where: { id: p2.id },
      data: { currentClass: "Nursery 1", tierId: nurseryTier.id, status: "ENROLLED" },
    });
    console.log(`Updated Pupil 2: ${p2.firstName} ${p2.lastName} (${p2.admissionNumber})`);
  }

  // 5. Setup Parent Linkage for Pupil 1 (for parent view isolation testing)
  let parent1 = await prisma.parent.findFirst({
    where: { schoolId: school.id, email: pupil1Data.parentEmail },
  });
  if (!parent1) {
    parent1 = await prisma.parent.create({
      data: {
        schoolId: school.id,
        name: pupil1Data.parentName,
        email: pupil1Data.parentEmail,
        phone: "+2348011223344",
        relationship: "MOTHER",
        passwordHash: "$2a$12$e8p2u.w789j284u2934u2.1283719283719283719283719283719",
      },
    });
  }
  await prisma.studentParent.upsert({
    where: {
      studentId_parentId: {
        studentId: p1.id,
        parentId: parent1.id,
      },
    },
    update: {},
    create: {
      studentId: p1.id,
      parentId: parent1.id,
      schoolId: school.id,
    },
  });

  // 6. Clean previous Nursery 1 grade records to ensure Single Source of Truth
  await prisma.gradeRecord.deleteMany({
    where: {
      schoolId: school.id,
      className: "Nursery 1",
    },
  });

  // 7. Seed Single Source of Truth in GradeRecord
  // Subject 1: "Early Mathematical Concepts"
  // Pupil 1: Observation = 38, CA = 35, Exam = 0 -> Total = 73 (Nursery: Very Good)
  // Pupil 2: Observation = 42, CA = 38, Exam = 0 -> Total = 80 (Nursery: Excellent)
  //
  // Unentered Subject: "Literacy & Phonics Skills" (Zero GradeRecord rows -> excluded from Total & Average)
  const term = "1st Term";
  const mathSubject = "Early Mathematical Concepts";

  // Pupil 1 GradeRecord: 38 + 35 = 73
  await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: p1.id,
      term,
      className: "Nursery 1",
      subject: mathSubject,
      ca1: 38,
      ca2: 35,
      exam: 0,
      totalScore: 73,
    },
  });

  // Pupil 2 GradeRecord: 42 + 38 = 80
  await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: p2.id,
      term,
      className: "Nursery 1",
      subject: mathSubject,
      ca1: 42,
      ca2: 38,
      exam: 0,
      totalScore: 80,
    },
  });

  console.log(`Seeded Teacher GradeRecord rows:`);
  console.log(`  - ${p1.firstName} ${p1.lastName}: ${mathSubject} | Obs: 38 | CA: 35 | Exam: 0 | Total: 73 (Very Good)`);
  console.log(`  - ${p2.firstName} ${p2.lastName}:  ${mathSubject} | Obs: 42 | CA: 38 | Exam: 0 | Total: 80 (Excellent)`);
  console.log(`  - Literacy & Phonics Skills: NOT ENTERED (Excluded from Total & Average)`);
}

async function main() {
  console.log("==================================================================");
  console.log("PHASE 3 SETUP: Nursery / Foundation Stage Single Source of Truth");
  console.log("==================================================================");

  // Setup School 1: Apex International Academy ('demo')
  await setupSchoolNursery(
    "demo",
    {
      firstName: "Chisom",
      lastName: "Obi",
      admissionNumber: "APEX/2026/NUR/001",
      parentEmail: "ngozi.obi@example.com",
      parentName: "Mrs. Ngozi Obi",
    },
    {
      firstName: "Farouk",
      lastName: "Musa",
      admissionNumber: "APEX/2026/NUR/002",
    }
  );

  // Setup School 2: Egede Primary School ('egede')
  await setupSchoolNursery(
    "egede",
    {
      firstName: "Chidera",
      lastName: "Okeke",
      admissionNumber: "EGED/2026/NUR/001",
      parentEmail: "chukwuma.okeke@example.com",
      parentName: "Mr. Chukwuma Okeke",
    },
    {
      firstName: "Kamsiyochukwu",
      lastName: "Egede",
      admissionNumber: "EGED/2026/NUR/002",
    }
  );

  console.log("\n>>> PHASE 3 SETUP COMPLETED SUCCESSFULLY! <<<");
}

main()
  .catch((e) => {
    console.error("Setup error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
