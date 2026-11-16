import { PrismaClient } from "@prisma/client";
import { resolveCrecheConfig } from "@/lib/creche-config";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("SETUP EGEDE CRECHE: Ensure Egede has Creche for Multi-School Test");
  console.log("==================================================================");

  const egede = await prisma.school.findFirst({
    where: { subdomain: "egede" },
    include: { academicTiers: true },
  });

  if (!egede) {
    throw new Error("Egede Primary School not found!");
  }

  // 1. Ensure Creche Classroom exists in Egede
  let crecheClass = await prisma.classroom.findFirst({
    where: { schoolId: egede.id, name: "Creche" },
  });

  if (!crecheClass) {
    crecheClass = await prisma.classroom.create({
      data: {
        schoolId: egede.id,
        name: "Creche",
        capacity: 20,
      },
    });
    console.log("Created Classroom 'Creche' in Egede");
  }

  const defaultTier = egede.academicTiers[0]?.id;

  // 2. Ensure 2 Creche pupils in Egede
  let somto = await prisma.student.findFirst({
    where: { schoolId: egede.id, admissionNumber: "EGED/2026/CRE/001" },
  });
  if (!somto) {
    somto = await prisma.student.create({
      data: {
        schoolId: egede.id,
        tierId: defaultTier,
        firstName: "Somtochukwu",
        lastName: "EgedeCreche1",
        admissionNumber: "EGED/2026/CRE/001",
        currentClass: "Creche",
        status: "ENROLLED",
      },
    });
    console.log("Created Creche Pupil: Somtochukwu EgedeCreche1");
  }

  let ngozi = await prisma.student.findFirst({
    where: { schoolId: egede.id, admissionNumber: "EGED/2026/CRE/002" },
  });
  if (!ngozi) {
    ngozi = await prisma.student.create({
      data: {
        schoolId: egede.id,
        tierId: defaultTier,
        firstName: "Ngozi",
        lastName: "EgedeCreche2",
        admissionNumber: "EGED/2026/CRE/002",
        currentClass: "Creche",
        status: "ENROLLED",
      },
    });
    console.log("Created Creche Pupil: Ngozi EgedeCreche2");
  }

  // 3. Clear existing Creche grades in Egede
  const term = "1st Term";
  const academicYear = "2026/2027";
  await prisma.gradeRecord.deleteMany({
    where: { schoolId: egede.id, className: "Creche", term },
  });

  // 4. Seed Teacher GradeRecord
  // Somtochukwu: Sensory & Motor Exploration -> Observation: 38, CA: 35 => Total 73 (Very Good)
  // Ngozi:       Sensory & Motor Exploration -> Observation: 42, CA: 38 => Total 80 (Distinction)
  // Social Habits: NOT ENTERED
  await prisma.gradeRecord.create({
    data: {
      schoolId: egede.id,
      studentId: somto.id,
      subject: "Sensory & Motor Exploration",
      className: "Creche",
      term,
      ca1: 38,
      ca2: 35,
      exam: 0,
      totalScore: 73,
    },
  });

  await prisma.gradeRecord.create({
    data: {
      schoolId: egede.id,
      studentId: ngozi.id,
      subject: "Sensory & Motor Exploration",
      className: "Creche",
      term,
      ca1: 42,
      ca2: 38,
      exam: 0,
      totalScore: 80,
    },
  });

  console.log("Seeded Egede Creche GradeRecords:");
  console.log("  - Somtochukwu: Observation 38 + CA 35 = 73 (Very Good)");
  console.log("  - Ngozi: Observation 42 + CA 38 = 80 (Distinction)");
  console.log("  - Social Habits: NOT ENTERED");
  console.log(">>> EGEDE CRECHE SETUP COMPLETE <<<");
}

main().catch(console.error).finally(() => prisma.$disconnect());
