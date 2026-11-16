import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const egede = await prisma.school.findFirst({
    where: {
      OR: [{ subdomain: "egede" }, { slug: "egede" }],
    },
    include: { academicTiers: true },
  });

  if (!egede) {
    console.error("Egede school not found");
    return;
  }

  console.log(`Found Egede school: ${egede.name} (${egede.id})`);
  const primaryTier = egede.academicTiers.find((t) =>
    t.name.toLowerCase().includes("primary")
  );

  // Check or create Joseph Okonkwo
  let joseph = await prisma.student.findFirst({
    where: {
      schoolId: egede.id,
      firstName: { equals: "Joseph", mode: "insensitive" },
      lastName: { equals: "Okonkwo", mode: "insensitive" },
    },
  });

  if (!joseph) {
    joseph = await prisma.student.create({
      data: {
        schoolId: egede.id,
        tierId: primaryTier?.id || "",
        firstName: "Joseph",
        lastName: "Okonkwo",
        admissionNumber: "EGED/2026/PRIM/0001",
        currentClass: "Primary 2",
        status: "ENROLLED",
        dateOfBirth: new Date("2018-05-14"),
      },
    });
    console.log("Created student Joseph Okonkwo:", joseph.id);
  } else {
    console.log("Found student Joseph Okonkwo:", joseph.id);
  }

  // Check or create Chinedu TestTwo
  let chinedu = await prisma.student.findFirst({
    where: {
      schoolId: egede.id,
      firstName: { equals: "Chinedu", mode: "insensitive" },
      lastName: { equals: "TestTwo", mode: "insensitive" },
    },
  });

  if (!chinedu) {
    chinedu = await prisma.student.create({
      data: {
        schoolId: egede.id,
        tierId: primaryTier?.id || "",
        firstName: "Chinedu",
        lastName: "TestTwo",
        admissionNumber: "EGED/2026/PRIM/0002",
        currentClass: "Primary 2",
        status: "ENROLLED",
        dateOfBirth: new Date("2018-08-20"),
      },
    });
    console.log("Created student Chinedu TestTwo:", chinedu.id);
  } else {
    console.log("Found student Chinedu TestTwo:", chinedu.id);
  }

  // Create real GradeRecord for English:
  // Joseph: ca1: 15, ca2: 18, exam: 40, totalScore: 73
  // Chinedu: ca1: 10, ca2: 20, exam: 50, totalScore: 80
  const terms = ["1st Term"];

  // Clean up any old duplicate 'First Term' records to ensure clean single source of truth
  await prisma.gradeRecord.deleteMany({
    where: {
      schoolId: egede.id,
      term: "First Term",
    },
  });

  for (const term of terms) {
    await prisma.gradeRecord.upsert({
      where: {
        schoolId_studentId_term_className_subject: {
          schoolId: egede.id,
          studentId: joseph.id,
          term,
          className: "Primary 2",
          subject: "English Language",
        },
      },
      update: {
        ca1: 15,
        ca2: 18,
        exam: 40,
        totalScore: 73,
      },
      create: {
        schoolId: egede.id,
        studentId: joseph.id,
        className: "Primary 2",
        subject: "English Language",
        term,
        ca1: 15,
        ca2: 18,
        exam: 40,
        totalScore: 73,
      },
    });

    await prisma.gradeRecord.upsert({
      where: {
        schoolId_studentId_term_className_subject: {
          schoolId: egede.id,
          studentId: chinedu.id,
          term,
          className: "Primary 2",
          subject: "English Language",
        },
      },
      update: {
        ca1: 10,
        ca2: 20,
        exam: 50,
        totalScore: 80,
      },
      create: {
        schoolId: egede.id,
        studentId: chinedu.id,
        className: "Primary 2",
        subject: "English Language",
        term,
        ca1: 10,
        ca2: 20,
        exam: 50,
        totalScore: 80,
      },
    });
  }

  console.log("English Language real GradeRecord scores saved for Joseph and Chinedu.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
