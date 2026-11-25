import { basePrisma, getTenantClient } from "../lib/tenant-prisma";
import { getSubjectsForClassAndTier } from "../lib/curriculum-data";
import { matchSubjectAlias } from "../lib/nigerian-curriculum";
import { isClassMatch } from "../lib/class-matching";

async function main() {
  console.log("=================================================================");
  console.log("PROVISIONING & VERIFYING: Capital City Primary School (Primary 2)");
  console.log("=================================================================");

  // 1. Ensure Capital City Primary School exists in the database
  let school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { name: { contains: "Capital City", mode: "insensitive" } },
        { subdomain: "capital-city" },
        { subdomain: "capitalcity" }
      ]
    },
    include: { academicTiers: true }
  });

  if (!school) {
    console.log("Provisioning Capital City Primary School...");
    school = await basePrisma.school.create({
      data: {
        name: "Capital City Primary School",
        subdomain: "capital-city",
        slug: "capital-city",
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        tier: "PRIMARY",
        isActive: true,
        academicTiers: {
          create: [
            { name: "Primary School", level: 1 }
          ]
        }
      },
      include: { academicTiers: true }
    });
    console.log("Created Capital City Primary School:", school.id);
  } else {
    console.log("Found existing Capital City Primary School:", school.id, school.name);
  }

  const primaryTier = school.academicTiers.find(t => t.name.includes("Primary")) || school.academicTiers[0];

  // 2. Ensure Primary 2 students exist
  const studentNames = [
    { firstName: "Chidera", lastName: "Obi", admissionNumber: "CCPS/2026/PRI2/001" },
    { firstName: "Zainab", lastName: "Bello", admissionNumber: "CCPS/2026/PRI2/002" },
    { firstName: "Emmanuel", lastName: "Adeyemi", admissionNumber: "CCPS/2026/PRI2/003" },
  ];

  const students: any[] = [];
  for (const s of studentNames) {
    let student = await basePrisma.student.findFirst({
      where: {
        schoolId: school.id,
        admissionNumber: s.admissionNumber
      }
    });
    if (!student) {
      student = await basePrisma.student.create({
        data: {
          schoolId: school.id,
          tierId: primaryTier?.id,
          firstName: s.firstName,
          lastName: s.lastName,
          admissionNumber: s.admissionNumber,
          currentClass: "Primary 2",
          status: "ENROLLED"
        }
      });
      console.log(`Created student: ${s.firstName} ${s.lastName}`);
    }
    students.push(student);
  }

  // 3. Teacher records scores in Primary 2 across various subjects (using real Nigerian aliases)
  // E.g., teacher entered "Maths", "Basic Science", "Civic Education", "CRK", "PHE", "Verbal Reasoning"
  const teacherGradeEntries = [
    { subject: "English Studies", ca1: 18, ca2: 17, exam: 52 },
    { subject: "Maths", ca1: 19, ca2: 18, exam: 55 },
    { subject: "Basic Science", ca1: 16, ca2: 17, exam: 48 },
    { subject: "Social Studies", ca1: 17, ca2: 18, exam: 50 },
    { subject: "Civic Education", ca1: 18, ca2: 19, exam: 54 },
    { subject: "CRK", ca1: 19, ca2: 19, exam: 56 },
    { subject: "PHE", ca1: 17, ca2: 16, exam: 45 },
    { subject: "Creative Arts", ca1: 18, ca2: 18, exam: 50 },
    { subject: "Computer Studies", ca1: 19, ca2: 17, exam: 51 },
    { subject: "Verbal Reasoning", ca1: 18, ca2: 19, exam: 52 },
    { subject: "Quantitative Reasoning", ca1: 19, ca2: 18, exam: 54 },
  ];

  console.log(`Recording grades for ${students.length} students across ${teacherGradeEntries.length} subjects...`);
  for (const student of students) {
    for (const g of teacherGradeEntries) {
      const total = g.ca1 + g.ca2 + g.exam;
      await basePrisma.gradeRecord.upsert({
        where: {
          schoolId_studentId_term_className_subject: {
            schoolId: school.id,
            studentId: student.id,
            term: "1st Term",
            className: "Primary 2",
            subject: g.subject
          }
        },
        update: {
          ca1: g.ca1,
          ca2: g.ca2,
          exam: g.exam,
          totalScore: total,
          updatedAt: new Date()
        },
        create: {
          schoolId: school.id,
          studentId: student.id,
          className: "Primary 2",
          term: "1st Term",
          subject: g.subject,
          ca1: g.ca1,
          ca2: g.ca2,
          exam: g.exam,
          totalScore: total
        }
      });
    }
  }

  // 4. Test Broadsheet Column Resolution & Score Matching
  console.log("\n=================== TESTING BROADSHEET EXTRACTION ===================");
  const gradeRecords = await basePrisma.gradeRecord.findMany({
    where: { schoolId: school.id }
  });

  console.log(`Total GradeRecords in DB: ${gradeRecords.length}`);

  // Test subject resolution
  const standardSubjects = getSubjectsForClassAndTier("Primary 2", "PRIMARY");
  console.log("Standard Primary Subjects:", standardSubjects);

  const subjectsList: string[] = [...standardSubjects];
  const classStudentIds = new Set(students.map(s => s.id));

  const addRecordedSubject = (subj?: string | null) => {
    if (!subj || !subj.trim()) return;
    const clean = subj.trim();
    const existingMatch = subjectsList.find((s) => matchSubjectAlias(s, clean));
    if (!existingMatch) {
      subjectsList.push(clean);
    }
  };

  gradeRecords.forEach((gr) => {
    const isForClass = isClassMatch(gr.className, "Primary 2") || classStudentIds.has(gr.studentId);
    if (isForClass) {
      addRecordedSubject(gr.subject);
    }
  });

  console.log("\nResolved Broadsheet Columns Count:", subjectsList.length);
  console.log("Resolved Broadsheet Columns:", subjectsList);

  // Test score lookup for each student across all columns
  let missingCount = 0;
  for (const student of students) {
    console.log(`\nChecking scores for ${student.firstName} ${student.lastName}:`);
    for (const col of subjectsList) {
      // Find matching grade record
      const matchedRecord = gradeRecords.find((r) =>
        r.studentId === student.id &&
        (r.subject.toLowerCase() === col.toLowerCase() || matchSubjectAlias(r.subject, col))
      );
      if (matchedRecord) {
        console.log(`  ✓ Column [${col}]: Total = ${matchedRecord.totalScore} (CA1=${matchedRecord.ca1}, CA2=${matchedRecord.ca2}, Exam=${matchedRecord.exam}) from Subject "${matchedRecord.subject}"`);
      } else {
        console.log(`  - Column [${col}]: No score entered (standard subject not graded)`);
      }
    }

    // Verify all teacher entries were found
    for (const entry of teacherGradeEntries) {
      const foundInColumns = subjectsList.some((col) =>
        col.toLowerCase() === entry.subject.toLowerCase() || matchSubjectAlias(col, entry.subject)
      );
      if (!foundInColumns) {
        console.error(`  ❌ OMITTED RECORD! Teacher entered "${entry.subject}", but no column matches it!`);
        missingCount++;
      }
    }
  }

  if (missingCount === 0) {
    console.log("\n🎉 SUCCESS: 100% of teacher recorded subjects and scores are mapped with ZERO omissions!");
  } else {
    console.error(`\n❌ FAILURE: ${missingCount} records were omitted!`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
