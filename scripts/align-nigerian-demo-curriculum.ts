import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  console.log("=== ALIGNING NIGERIAN DEMO INSTITUTION CURRICULA & EXAMS ===");

  // 1. DEMO UNIVERSITY
  const uni = await basePrisma.school.findFirst({
    where: { subdomain: "demo-university" },
    include: { academicTiers: true },
  });

  if (uni) {
    console.log("\n[1/4] Aligning Demo University (Higher Education)...");
    const uniTier = uni.academicTiers[0];

    // Align existing exam semester to 1st Semester
    await basePrisma.exam.updateMany({
      where: { schoolId: uni.id },
      data: {
        semester: "1st Semester 2026/2027",
        name: "First Semester Examination 2026/2027",
      },
    });

    // Authentic Nigerian University Courses (NUC Standard)
    const uniCourses = [
      { code: "GST 111", name: "GST 111 - Communication in English (2 Units)" },
      { code: "COS 101", name: "COS 101 - Introduction to Computer Science (3 Units)" },
      { code: "MTH 101", name: "MTH 101 - Elementary Mathematics I (3 Units)" },
      { code: "PHY 101", name: "PHY 101 - General Physics I (3 Units)" },
      { code: "CHM 101", name: "CHM 101 - General Chemistry I (3 Units)" },
      { code: "GST 112", name: "GST 112 - Philosophy, Logic & Human Existence (2 Units)" },
    ];

    for (const c of uniCourses) {
      const existing = await basePrisma.course.findFirst({
        where: { schoolId: uni.id, code: c.code },
      });
      if (existing) {
        await basePrisma.course.update({
          where: { id: existing.id },
          data: { name: c.name },
        });
      } else {
        await basePrisma.course.create({
          data: {
            schoolId: uni.id,
            code: c.code,
            name: c.name,
            tierId: uniTier?.id,
          },
        });
      }
    }

    // Ensure University levels
    const uniLevels = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"];
    for (const lvl of uniLevels) {
      const ex = await basePrisma.classroom.findFirst({
        where: { schoolId: uni.id, name: lvl },
      });
      if (!ex) {
        await basePrisma.classroom.create({
          data: { schoolId: uni.id, name: lvl, tierId: uniTier?.id, capacity: 50 },
        });
      }
    }
    console.log("-> Demo University curriculum and exams aligned to Nigerian NUC Semester standards.");
  }

  // 2. DEMO SECONDARY & APEX DEMO
  const secondarySchools = await basePrisma.school.findMany({
    where: { subdomain: { in: ["demo-secondary", "demo"] } },
    include: { academicTiers: true },
  });

  for (const sec of secondarySchools) {
    console.log(`\n[2/4] Aligning Secondary School: ${sec.name} (${sec.subdomain})...`);
    const secTier = sec.academicTiers[0];

    // Update exams
    await basePrisma.exam.updateMany({
      where: { schoolId: sec.id },
      data: {
        semester: "1st Term 2026/2027",
        name: "First Term Examination & Continuous Assessment",
      },
    });

    // Delete cross-tier or anomalous courses
    await basePrisma.course.deleteMany({
      where: {
        schoolId: sec.id,
        name: { in: ["Sensory & Motor Exploration", "Introduction to Computing", "Digital Electronics", "Introduction to Programming", "Use of English I", "Citizenship Education I", "Logic and Linear Algebra"] },
      },
    });

    // Standard WAEC / NECO Secondary Subjects
    const secSubjects = [
      { code: "ENG", name: "English Language" },
      { code: "MTH", name: "General Mathematics" },
      { code: "BIO", name: "Biology" },
      { code: "CHM", name: "Chemistry" },
      { code: "PHY", name: "Physics" },
      { code: "CIV", name: "Civic Education" },
      { code: "ECO", name: "Economics" },
      { code: "BSC", name: "Basic Science" },
      { code: "BTE", name: "Basic Technology" },
    ];

    for (const s of secSubjects) {
      const existing = await basePrisma.course.findFirst({
        where: { schoolId: sec.id, code: s.code },
      });
      if (existing) {
        await basePrisma.course.update({
          where: { id: existing.id },
          data: { name: s.name },
        });
      } else {
        await basePrisma.course.create({
          data: {
            schoolId: sec.id,
            code: s.code,
            name: s.name,
            tierId: secTier?.id,
          },
        });
      }
    }

    // Ensure JSS & SSS classes
    const secClasses = ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"];
    for (const cls of secClasses) {
      const ex = await basePrisma.classroom.findFirst({
        where: { schoolId: sec.id, name: cls },
      });
      if (!ex) {
        await basePrisma.classroom.create({
          data: { schoolId: sec.id, name: cls, tierId: secTier?.id, capacity: 40 },
        });
      }
    }
    console.log(`-> ${sec.name} aligned to Nigerian Secondary School (WAEC/NECO) standards.`);
  }

  // 3. DEMO PRIMARY & EGEDE PRIMARY
  const primarySchools = await basePrisma.school.findMany({
    where: { subdomain: { in: ["demo-primary", "egede"] } },
    include: { academicTiers: true },
  });

  for (const pri of primarySchools) {
    console.log(`\n[3/4] Aligning Primary School: ${pri.name} (${pri.subdomain})...`);
    const priTier = pri.academicTiers.find(t => t.name.toLowerCase().includes("primary")) || pri.academicTiers[0];

    await basePrisma.exam.updateMany({
      where: { schoolId: pri.id },
      data: {
        semester: "1st Term 2026/2027",
        name: "First Term Continuous Assessment & Unified Exam",
      },
    });

    const priSubjects = [
      { code: "ENG_PRI", name: "English Studies" },
      { code: "MTH_PRI", name: "Mathematics" },
      { code: "BST_PRI", name: "Basic Science & Technology" },
      { code: "SOC_PRI", name: "Social Studies" },
      { code: "CIV_PRI", name: "Civic Education" },
      { code: "CCA_PRI", name: "Cultural & Creative Arts (CCA)" },
      { code: "AGR_PRI", name: "Agricultural Science" },
      { code: "ICT_PRI", name: "Computer Studies / ICT" },
    ];

    for (const s of priSubjects) {
      const existing = await basePrisma.course.findFirst({
        where: { schoolId: pri.id, code: s.code },
      });
      if (existing) {
        await basePrisma.course.update({
          where: { id: existing.id },
          data: { name: s.name },
        });
      } else {
        await basePrisma.course.create({
          data: {
            schoolId: pri.id,
            code: s.code,
            name: s.name,
            tierId: priTier?.id,
          },
        });
      }
    }

    const priClasses = ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"];
    for (const cls of priClasses) {
      const ex = await basePrisma.classroom.findFirst({
        where: { schoolId: pri.id, name: cls },
      });
      if (!ex) {
        await basePrisma.classroom.create({
          data: { schoolId: pri.id, name: cls, tierId: priTier?.id, capacity: 35 },
        });
      }
    }
    console.log(`-> ${pri.name} aligned to Nigerian 6-Year Basic Primary Education standards.`);
  }

  // 4. DEMO CRECHE & NURSERY
  const crecheSchools = await basePrisma.school.findMany({
    where: { subdomain: { in: ["demo-creche", "demo-nursery"] } },
    include: { academicTiers: true },
  });

  for (const cr of crecheSchools) {
    console.log(`\n[4/4] Aligning Creche / Nursery: ${cr.name} (${cr.subdomain})...`);
    const crTier = cr.academicTiers[0];

    await basePrisma.exam.updateMany({
      where: { schoolId: cr.id },
      data: {
        semester: "1st Term 2026/2027",
        name: "Developmental Milestone Review (1st Term 2026/2027)",
      },
    });

    const crModules = [
      { code: "PHO_EY", name: "Literacy & Phonics Foundation" },
      { code: "NUM_EY", name: "Numeracy & Cognitive Development" },
      { code: "SEN_EY", name: "Sensory Play & Creative Expression" },
      { code: "SOC_EY", name: "Social Habits & Life Skills" },
      { code: "PHY_EY", name: "Physical & Motor Development" },
      { code: "RHY_EY", name: "Rhymes, Music & Rhythm" },
    ];

    for (const m of crModules) {
      const existing = await basePrisma.course.findFirst({
        where: { schoolId: cr.id, code: m.code },
      });
      if (existing) {
        await basePrisma.course.update({
          where: { id: existing.id },
          data: { name: m.name },
        });
      } else {
        await basePrisma.course.create({
          data: {
            schoolId: cr.id,
            code: m.code,
            name: m.name,
            tierId: crTier?.id,
          },
        });
      }
    }

    const crPods = ["Creche", "Nursery 1", "Nursery 2", "Nursery 3", "Kindergarten"];
    for (const pod of crPods) {
      const ex = await basePrisma.classroom.findFirst({
        where: { schoolId: cr.id, name: pod },
      });
      if (!ex) {
        await basePrisma.classroom.create({
          data: { schoolId: cr.id, name: pod, tierId: crTier?.id, capacity: 20 },
        });
      }
    }
    console.log(`-> ${cr.name} aligned to Nigerian Early Childhood Care and Development (ECCE) standards.`);
  }

  console.log("\n=== ALL DEMO INSTITUTIONS SUCCESSFULLY ALIGNED ===");
}

main().catch(console.error).finally(() => basePrisma.$disconnect());
