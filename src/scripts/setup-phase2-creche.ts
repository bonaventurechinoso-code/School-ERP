import { PrismaClient } from "@prisma/client";
import { resolveCrecheConfig, DEFAULT_CRECHE_CONFIG } from "../lib/creche-config";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("PHASE 2 SETUP: Creche / Early Childhood Single Source of Truth");
  console.log("==================================================================");

  // 1. Locate school (Apex International Academy 'demo' or Egede)
  let school = await prisma.school.findFirst({
    where: { OR: [{ subdomain: "demo" }, { slug: "demo" }] },
    include: { academicTiers: true },
  });

  if (!school) {
    school = await prisma.school.findFirst({
      where: { OR: [{ subdomain: "egede" }, { slug: "egede" }] },
      include: { academicTiers: true },
    });
  }

  if (!school) {
    throw new Error("Target school not found in database.");
  }

  console.log(`Target School: ${school.name} (${school.subdomain}) [ID: ${school.id}]`);

  // 2. Ensure Creche Tier and Classroom exist
  let crecheTier = school.academicTiers.find(
    (t) => t.name.toLowerCase().includes("creche") || t.name.toLowerCase().includes("nursery")
  );

  if (!crecheTier) {
    crecheTier = await prisma.academicTier.create({
      data: {
        schoolId: school.id,
        name: "Creche / Nursery",
        level: 1,
      },
    });
    console.log("Created AcademicTier: Creche / Nursery");
  }

  let crecheClassroom = await prisma.classroom.findFirst({
    where: { schoolId: school.id, name: { equals: "Creche", mode: "insensitive" } },
  });

  if (!crecheClassroom) {
    crecheClassroom = await prisma.classroom.create({
      data: {
        schoolId: school.id,
        name: "Creche",
        capacity: 25,
        tierId: crecheTier.id,
      },
    });
    console.log("Created Classroom: Creche");
  }

  // 3. Configure Creche Assessment Formula in School Settings
  // Default: Observation 50 + Continuous Assessment 50 = 100 max, NO Exam 60 (examMax: 0, hasExam: false)
  const existingConfig = (school.tierDatabasesConfig as any) || {};
  const crecheFormula = {
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
        ...existingConfig,
        crecheAssessmentConfig: crecheFormula,
      },
    },
  });
  console.log("Configured Admin Creche Formula in tierDatabasesConfig:", crecheFormula);

  // 4. Set up 2 Creche Children:
  // Child 1: Adaeze Okoro
  let adaeze = await prisma.student.findFirst({
    where: {
      schoolId: school.id,
      firstName: { equals: "Adaeze", mode: "insensitive" },
      lastName: { equals: "Okoro", mode: "insensitive" },
    },
  });

  if (!adaeze) {
    adaeze = await prisma.student.create({
      data: {
        schoolId: school.id,
        tierId: crecheTier.id,
        firstName: "Adaeze",
        lastName: "Okoro",
        admissionNumber: "APEX/2026/CRE/001",
        currentClass: "Creche",
        status: "ENROLLED",
        dateOfBirth: new Date("2024-03-10"),
      },
    });
    console.log("Created Creche Student: Adaeze Okoro (APEX/2026/CRE/001)");
  } else {
    adaeze = await prisma.student.update({
      where: { id: adaeze.id },
      data: { currentClass: "Creche", status: "ENROLLED" },
    });
    console.log("Updated Creche Student: Adaeze Okoro (APEX/2026/CRE/001)");
  }

  // Child 2: Emeka Nwosu
  let emeka = await prisma.student.findFirst({
    where: {
      schoolId: school.id,
      firstName: { equals: "Emeka", mode: "insensitive" },
      lastName: { equals: "Nwosu", mode: "insensitive" },
    },
  });

  if (!emeka) {
    emeka = await prisma.student.create({
      data: {
        schoolId: school.id,
        tierId: crecheTier.id,
        firstName: "Emeka",
        lastName: "Nwosu",
        admissionNumber: "APEX/2026/CRE/002",
        currentClass: "Creche",
        status: "ENROLLED",
        dateOfBirth: new Date("2024-06-22"),
      },
    });
    console.log("Created Creche Student: Emeka Nwosu (APEX/2026/CRE/002)");
  } else {
    emeka = await prisma.student.update({
      where: { id: emeka.id },
      data: { currentClass: "Creche", status: "ENROLLED" },
    });
    console.log("Updated Creche Student: Emeka Nwosu (APEX/2026/CRE/002)");
  }

  // 5. Link Parents (Parent Portal isolated view verification)
  // Mrs. Ngozi Okoro -> Adaeze Okoro
  let parentOkoro = await prisma.parent.findFirst({
    where: { schoolId: school.id, email: "ngozi.okoro@example.com" },
  });
  if (!parentOkoro) {
    parentOkoro = await prisma.parent.create({
      data: {
        schoolId: school.id,
        name: "Mrs. Ngozi Okoro",
        email: "ngozi.okoro@example.com",
        phone: "+2348031112233",
        relationship: "MOTHER",
        passwordHash: "$2a$12$e8p2u.w789j284u2934u2.1283719283719283719283719283719",
      },
    });
  }
  await prisma.studentParent.upsert({
    where: {
      studentId_parentId: {
        studentId: adaeze.id,
        parentId: parentOkoro.id,
      },
    },
    update: {},
    create: {
      studentId: adaeze.id,
      parentId: parentOkoro.id,
      schoolId: school.id,
    },
  });

  // Mr. Obi Nwosu -> Emeka Nwosu
  let parentNwosu = await prisma.parent.findFirst({
    where: { schoolId: school.id, email: "obi.nwosu@example.com" },
  });
  if (!parentNwosu) {
    parentNwosu = await prisma.parent.create({
      data: {
        schoolId: school.id,
        name: "Mr. Obi Nwosu",
        email: "obi.nwosu@example.com",
        phone: "+2348034445566",
        relationship: "FATHER",
        passwordHash: "$2a$12$e8p2u.w789j284u2934u2.1283719283719283719283719283719",
      },
    });
  }
  await prisma.studentParent.upsert({
    where: {
      studentId_parentId: {
        studentId: emeka.id,
        parentId: parentNwosu.id,
      },
    },
    update: {},
    create: {
      studentId: emeka.id,
      parentId: parentNwosu.id,
      schoolId: school.id,
    },
  });

  console.log("Configured Guardians: Mrs. Ngozi Okoro (Adaeze) and Mr. Obi Nwosu (Emeka)");

  // 6. Clean previous grade records for Creche to ensure fresh Single Source of Truth
  await prisma.gradeRecord.deleteMany({
    where: {
      schoolId: school.id,
      className: "Creche",
    },
  });

  // 7. Seed Single Source of Truth in GradeRecord (Creche Formula: Observation + Continuous Assessment, NO Exam)
  // Adaeze Okoro:
  // - Sensory & Motor Exploration: Observation = 38, CA = 35, Exam = 0 -> Total = 73 (Very Good)
  // Emeka Nwosu:
  // - Sensory & Motor Exploration: Observation = 42, CA = 38, Exam = 0 -> Total = 80 (Distinction)
  //
  // Unentered Subject: "Language & Communication Readiness"
  // - Adaeze has NO score entered for Language (excluded, shows as '-' / Not Entered)
  // - Emeka has NO score entered for Language (excluded, shows as '-' / Not Entered)

  const term = "1st Term";
  const subject1 = "Sensory & Motor Exploration";

  // Adaeze GradeRecord: 38 + 35 = 73
  await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: adaeze.id,
      term,
      className: "Creche",
      subject: subject1,
      ca1: 38,
      ca2: 35,
      exam: 0,
      totalScore: 73,
    },
  });

  // Emeka GradeRecord: 42 + 38 = 80
  await prisma.gradeRecord.create({
    data: {
      schoolId: school.id,
      studentId: emeka.id,
      term,
      className: "Creche",
      subject: subject1,
      ca1: 42,
      ca2: 38,
      exam: 0,
      totalScore: 80,
    },
  });

  console.log("Seeded Teacher GradeRecord rows (Single Source of Truth):");
  console.log(`  - Adaeze Okoro: ${subject1} | Observation: 38 | CA: 35 | Exam: 0 | Total: 73 (Very Good)`);
  console.log(`  - Emeka Nwosu:  ${subject1} | Observation: 42 | CA: 38 | Exam: 0 | Total: 80 (Distinction)`);
  console.log("  - Language & Communication Readiness: NOT ENTERED (Excluded from Total & Average)");

  console.log("\n>>> PHASE 2 SETUP COMPLETED SUCCESSFULLY! <<<");
}

main()
  .catch((e) => {
    console.error("Setup error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
