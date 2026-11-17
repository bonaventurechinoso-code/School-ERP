import { basePrisma, getPrismaClientForTier } from "../src/lib/tenant-prisma";
import { compileStudentReportCard, compileClassReportCards } from "../src/lib/report-card-service";

async function seedPhase5Tertiary() {
  console.log("=== SEEDING PHASE 5: TERTIARY / HIGHER INSTITUTION TIERS ===");

  // =========================================================================
  // 1. SCHOOL 1: APEX INTERNATIONAL ACADEMY (subdomain: "demo") - ND 1
  // =========================================================================
  console.log("\n--- 1. Seeding Demo School (Apex International Academy - ND 1) ---");
  const demoSchool = await basePrisma.school.findUnique({
    where: { subdomain: "demo" },
    include: { academicTiers: true },
  });

  if (!demoSchool) {
    throw new Error("Demo school not found in database!");
  }

  let demoTertiaryTier = demoSchool.academicTiers.find(
    (t) => t.name.toLowerCase().includes("higher") || t.name.toLowerCase().includes("tertiary") || t.level === 4
  );

  if (!demoTertiaryTier) {
    demoTertiaryTier = await basePrisma.academicTier.create({
      data: {
        schoolId: demoSchool.id,
        name: "Higher Institution / University",
        level: 4,
      },
    });
  }

  console.log(`Demo Tertiary Tier: ${demoTertiaryTier.name} (${demoTertiaryTier.id})`);

  // Ensure classroom ND 1
  await basePrisma.classroom.upsert({
    where: { id: `room-demo-nd1` },
    update: {
      name: "ND 1",
      capacity: 50,
      tierId: demoTertiaryTier.id,
    },
    create: {
      id: `room-demo-nd1`,
      schoolId: demoSchool.id,
      name: "ND 1",
      capacity: 50,
      tierId: demoTertiaryTier.id,
    },
  });

  // Seed / Upsert ND 1 Courses
  const nd1Courses = [
    { code: "COM 111", name: "Introduction to Computing", cu: 3, caW: 30, examW: 70 },
    { code: "COM 112", name: "Digital Electronics", cu: 3, caW: 40, examW: 60 },
    { code: "COM 113", name: "Introduction to Programming", cu: 3, caW: 40, examW: 60 },
    { code: "GNS 101", name: "Use of English I", cu: 2, caW: 30, examW: 70 },
    { code: "GNS 111", name: "Citizenship Education I", cu: 2, caW: 30, examW: 70 },
    { code: "MTH 111", name: "Logic and Linear Algebra", cu: 3, caW: 30, examW: 70 },
  ];

  for (const c of nd1Courses) {
    await basePrisma.course.upsert({
      where: { schoolId_code: { schoolId: demoSchool.id, code: c.code } },
      update: { name: c.name, tierId: demoTertiaryTier.id },
      create: { schoolId: demoSchool.id, code: c.code, name: c.name, tierId: demoTertiaryTier.id },
    });
  }

  // Create or Upsert Student: Babatunde Adeyemi (APX/2026/ND1/001)
  let demoStudent = await basePrisma.student.findFirst({
    where: {
      schoolId: demoSchool.id,
      admissionNumber: "APX/2026/ND1/001",
    },
  });

  if (!demoStudent) {
    demoStudent = await basePrisma.student.create({
      data: {
        schoolId: demoSchool.id,
        admissionNumber: "APX/2026/ND1/001",
        firstName: "Babatunde",
        lastName: "Adeyemi",
        currentClass: "ND 1",
        tierId: demoTertiaryTier.id,
        status: "ENROLLED",
      },
    });
  } else {
    demoStudent = await basePrisma.student.update({
      where: { id: demoStudent.id },
      data: {
        firstName: "Babatunde",
        lastName: "Adeyemi",
        currentClass: "ND 1",
        tierId: demoTertiaryTier.id,
        status: "ENROLLED",
      },
    });
  }

  console.log(`Demo Student 1: ${demoStudent.firstName} ${demoStudent.lastName} (${demoStudent.admissionNumber})`);

  // Real GradeRecord scores for Babatunde Adeyemi
  // Mix of 30/70 and 40/60, mix of 2 and 3 credit units
  const demoGrades = [
    { subject: "COM 111 - Introduction to Computing", ca1: 24, exam: 52 }, // 76 -> A (4.0 * 3 = 12.0)
    { subject: "COM 112 - Digital Electronics", ca1: 32, exam: 44 },       // 76 -> A (4.0 * 3 = 12.0)
    { subject: "COM 113 - Introduction to Programming", ca1: 28, exam: 38 }, // 66 -> B (3.0 * 3 = 9.0)
    { subject: "GNS 101 - Use of English I", ca1: 22, exam: 46 },           // 68 -> B (3.0 * 2 = 6.0)
    { subject: "GNS 111 - Citizenship Education I", ca1: 21, exam: 41 },    // 62 -> B (3.0 * 2 = 6.0)
    { subject: "MTH 111 - Logic and Linear Algebra", ca1: 25, exam: 48 },   // 73 -> A (4.0 * 3 = 12.0)
  ];

  // Idempotency: Clean up any legacy "1st Term" / "First Term" rows for tertiary
  await basePrisma.gradeRecord.deleteMany({
    where: {
      studentId: demoStudent.id,
      term: { in: ["1st Term", "First Term"] },
    },
  });
  await basePrisma.reportCard.deleteMany({
    where: {
      studentId: demoStudent.id,
      term: { in: ["1st Term", "First Term"] },
    },
  });

  for (const g of demoGrades) {
    const totalScore = g.ca1 + g.exam;
    await basePrisma.gradeRecord.upsert({
      where: {
        schoolId_studentId_term_className_subject: {
          schoolId: demoSchool.id,
          studentId: demoStudent.id,
          term: "1st Semester",
          className: "ND 1",
          subject: g.subject,
        },
      },
      update: {
        ca1: g.ca1,
        ca2: 0,
        exam: g.exam,
        totalScore,
      },
      create: {
        schoolId: demoSchool.id,
        studentId: demoStudent.id,
        term: "1st Semester",
        className: "ND 1",
        subject: g.subject,
        ca1: g.ca1,
        ca2: 0,
        exam: g.exam,
        totalScore,
      },
    });
  }

  // Compile Report Card for Demo Student
  await compileStudentReportCard({
    schoolId: demoSchool.id,
    studentId: demoStudent.id,
    term: "1st Semester",
    academicYear: "2026/2027",
  });

  console.log("✅ Demo School ND 1 seeded & compiled successfully!");

  // =========================================================================
  // 2. SCHOOL 2: TRIAL SANDBOX ACADEMY (subdomain: "sandbox") - 100 Level
  // =========================================================================
  console.log("\n--- 2. Seeding Sandbox School (Trial Sandbox Academy - 100 Level) ---");
  const sandboxSchool = await basePrisma.school.findUnique({
    where: { subdomain: "sandbox" },
    include: { academicTiers: true },
  });

  if (!sandboxSchool) {
    throw new Error("Sandbox school not found in database!");
  }

  let sandboxTertiaryTier = sandboxSchool.academicTiers.find(
    (t) => t.name.toLowerCase().includes("higher") || t.name.toLowerCase().includes("tertiary") || t.level === 4
  );

  if (!sandboxTertiaryTier) {
    sandboxTertiaryTier = await basePrisma.academicTier.create({
      data: {
        schoolId: sandboxSchool.id,
        name: "Higher Institution / University",
        level: 4,
      },
    });
  }

  console.log(`Sandbox Tertiary Tier: ${sandboxTertiaryTier.name} (${sandboxTertiaryTier.id})`);

  // Ensure classroom 100 Level
  await basePrisma.classroom.upsert({
    where: { id: `room-sandbox-100l` },
    update: {
      name: "100 Level",
      capacity: 100,
      tierId: sandboxTertiaryTier.id,
    },
    create: {
      id: `room-sandbox-100l`,
      schoolId: sandboxSchool.id,
      name: "100 Level",
      capacity: 100,
      tierId: sandboxTertiaryTier.id,
    },
  });

  // Seed / Upsert 100 Level Courses
  const l100Courses = [
    { code: "GST 111", name: "Use of English", cu: 2, caW: 30, examW: 70 },
    { code: "MTH 101", name: "Elementary Mathematics I", cu: 3, caW: 30, examW: 70 },
    { code: "PHY 101", name: "General Physics I", cu: 3, caW: 40, examW: 60 },
    { code: "CHM 101", name: "General Chemistry I", cu: 3, caW: 40, examW: 60 },
    { code: "COS 101", name: "Introduction to Computer Science", cu: 3, caW: 30, examW: 70 },
    { code: "GST 113", name: "Nigerian Peoples and Culture", cu: 2, caW: 30, examW: 70 },
  ];

  for (const c of l100Courses) {
    await basePrisma.course.upsert({
      where: { schoolId_code: { schoolId: sandboxSchool.id, code: c.code } },
      update: { name: c.name, tierId: sandboxTertiaryTier.id },
      create: { schoolId: sandboxSchool.id, code: c.code, name: c.name, tierId: sandboxTertiaryTier.id },
    });
  }

  // Create or Upsert Student: Emeka Okafor (TSA/2026/100L/001)
  let sandboxStudent = await basePrisma.student.findFirst({
    where: {
      schoolId: sandboxSchool.id,
      admissionNumber: "TSA/2026/100L/001",
    },
  });

  if (!sandboxStudent) {
    sandboxStudent = await basePrisma.student.create({
      data: {
        schoolId: sandboxSchool.id,
        admissionNumber: "TSA/2026/100L/001",
        firstName: "Emeka",
        lastName: "Okafor",
        currentClass: "100 Level",
        tierId: sandboxTertiaryTier.id,
        status: "ENROLLED",
      },
    });
  } else {
    sandboxStudent = await basePrisma.student.update({
      where: { id: sandboxStudent.id },
      data: {
        firstName: "Emeka",
        lastName: "Okafor",
        currentClass: "100 Level",
        tierId: sandboxTertiaryTier.id,
        status: "ENROLLED",
      },
    });
  }

  console.log(`Sandbox Student 1: ${sandboxStudent.firstName} ${sandboxStudent.lastName} (${sandboxStudent.admissionNumber})`);

  // Real GradeRecord scores for Emeka Okafor
  const sandboxGrades = [
    { subject: "GST 111 - Use of English", ca1: 22, exam: 44 },                  // 66 -> B (3.0 * 2 = 6.0)
    { subject: "MTH 101 - Elementary Mathematics I", ca1: 24, exam: 50 },        // 74 -> A (4.0 * 3 = 12.0)
    { subject: "PHY 101 - General Physics I", ca1: 30, exam: 42 },               // 72 -> A (4.0 * 3 = 12.0)
    { subject: "CHM 101 - General Chemistry I", ca1: 26, exam: 36 },             // 62 -> B (3.0 * 3 = 9.0)
    { subject: "COS 101 - Introduction to Computer Science", ca1: 25, exam: 53 },// 78 -> A (4.0 * 3 = 12.0)
    { subject: "GST 113 - Nigerian Peoples and Culture", ca1: 21, exam: 43 },    // 64 -> B (3.0 * 2 = 6.0)
  ];

  // Idempotency: Clean up any legacy "1st Term" / "First Term" rows for sandbox tertiary
  await basePrisma.gradeRecord.deleteMany({
    where: {
      studentId: sandboxStudent.id,
      term: { in: ["1st Term", "First Term"] },
    },
  });
  await basePrisma.reportCard.deleteMany({
    where: {
      studentId: sandboxStudent.id,
      term: { in: ["1st Term", "First Term"] },
    },
  });

  for (const g of sandboxGrades) {
    const totalScore = g.ca1 + g.exam;
    await basePrisma.gradeRecord.upsert({
      where: {
        schoolId_studentId_term_className_subject: {
          schoolId: sandboxSchool.id,
          studentId: sandboxStudent.id,
          term: "1st Semester",
          className: "100 Level",
          subject: g.subject,
        },
      },
      update: {
        ca1: g.ca1,
        ca2: 0,
        exam: g.exam,
        totalScore,
      },
      create: {
        schoolId: sandboxSchool.id,
        studentId: sandboxStudent.id,
        term: "1st Semester",
        className: "100 Level",
        subject: g.subject,
        ca1: g.ca1,
        ca2: 0,
        exam: g.exam,
        totalScore,
      },
    });
  }

  // Compile Report Card for Sandbox Student
  await compileStudentReportCard({
    schoolId: sandboxSchool.id,
    studentId: sandboxStudent.id,
    term: "1st Semester",
    academicYear: "2026/2027",
  });

  console.log("✅ Sandbox School 100 Level seeded & compiled successfully!");
}

seedPhase5Tertiary()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
