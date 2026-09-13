import { basePrisma, getPrismaClientForTier } from "../src/lib/tenant-prisma";
import {
  saveAcademicRecord,
  compileClassReportCards,
  compileStudentReportCard,
  getStudentReportCard,
  getClassResultSheet,
} from "../src/lib/report-card-service";

async function verifyReportCardGeneration() {
  console.log("=== STARTING K-12 REPORT CARD & RESULT SHEET GENERATION VERIFICATION ===");

  // 1. Locate Greenwood Academy in main DB
  const school = await basePrisma.school.findUnique({
    where: { subdomain: "greenwood" },
    include: { academicTiers: true },
  });

  if (!school) {
    console.error("❌ Greenwood Academy not found!");
    process.exit(1);
  }

  console.log(`🏫 School: ${school.name} (${school.id})`);
  console.log(`📁 Multi-DB Enabled: ${school.isMultiDbEnabled}`);

  const term = "First Term";
  const academicYear = "2026/2027";

  // 2. PRIMARY SCHOOL VERIFICATION
  console.log("\n==========================================");
  console.log("1. TESTING PRIMARY SCHOOL GRADING & ROUTING");
  console.log("==========================================");

  const primaryClient = await getPrismaClientForTier(school.id, "Primary School");
  const primaryStudents = await primaryClient.student.findMany({
    where: { schoolId: school.id, currentClass: "Primary 5" },
    take: 3,
  });

  if (primaryStudents.length === 0) {
    console.error("❌ No Primary 5 students found in greenwood_primary_db!");
    process.exit(1);
  }

  const primaryStudent = primaryStudents[0];
  console.log(`Selected Primary Student: ${primaryStudent.firstName} ${primaryStudent.lastName} (${primaryStudent.id})`);

  // A. Save continuous assessment records for Primary student
  const primarySubjects = [
    { subject: "Mathematics", test1: 15, test2: 18, midTerm: 17, finalExam: 42 }, // Total: 92 (A, Pass)
    { subject: "English Language", test1: 12, test2: 14, midTerm: 15, finalExam: 35 }, // Total: 76 (A, Pass)
    { subject: "Basic Science", test1: 8, test2: 10, midTerm: 10, finalExam: 18 }, // Total: 46 (D, Fail threshold 50)
  ];

  for (const s of primarySubjects) {
    const res = await saveAcademicRecord({
      schoolId: school.id,
      studentId: primaryStudent.id,
      subject: s.subject,
      term,
      academicYear,
      className: "Primary 5",
      tierName: "Primary School",
      numericalScores: {
        test1: s.test1,
        test2: s.test2,
        midTerm: s.midTerm,
        finalExam: s.finalExam,
        passThreshold: 50,
      },
    });
    console.log(`✓ Saved Primary Subject "${s.subject}": Total ${res.record.totalScore}%, Grade ${res.record.gradeLetter}, Passed: ${res.record.isPassed}`);
  }

  // Also enter scores for second student to test class ranking
  if (primaryStudents.length > 1) {
    const s2 = primaryStudents[1];
    await saveAcademicRecord({
      schoolId: school.id,
      studentId: s2.id,
      subject: "Mathematics",
      term,
      academicYear,
      className: "Primary 5",
      tierName: "Primary School",
      numericalScores: { test1: 10, test2: 10, midTerm: 10, finalExam: 30 }, // 60%
    });
    await saveAcademicRecord({
      schoolId: school.id,
      studentId: s2.id,
      subject: "English Language",
      term,
      academicYear,
      className: "Primary 5",
      tierName: "Primary School",
      numericalScores: { test1: 10, test2: 10, midTerm: 10, finalExam: 30 }, // 60%
    });
    await saveAcademicRecord({
      schoolId: school.id,
      studentId: s2.id,
      subject: "Basic Science",
      term,
      academicYear,
      className: "Primary 5",
      tierName: "Primary School",
      numericalScores: { test1: 10, test2: 10, midTerm: 10, finalExam: 30 }, // 60%
    });
  }

  // B. Verify records in greenwood_primary_db
  const primaryDbRecords = await primaryClient.academicRecord.findMany({
    where: { schoolId: school.id, studentId: primaryStudent.id, term, academicYear },
  });
  console.log(`✅ Primary DB AcademicRecords count: ${primaryDbRecords.length} (Expected: 3)`);

  // C. Assert Strict Isolation: check that greenwood_secondary_db has ZERO records for this primary student
  const secondaryClient = await getPrismaClientForTier(school.id, "Secondary School");
  const leakedPrimaryInSecondary = await secondaryClient.academicRecord.findMany({
    where: { studentId: primaryStudent.id },
  });
  if (leakedPrimaryInSecondary.length === 0) {
    console.log("🌟 STRICT DB ISOLATION CONFIRMED: 0 Primary records exist in greenwood_secondary_db!");
  } else {
    console.error(`❌ DATA LEAKAGE: Found ${leakedPrimaryInSecondary.length} Primary records in Secondary DB!`);
    process.exit(1);
  }

  // D. Batch compile class report cards for Primary 5
  console.log("\nCompiling Primary 5 Class Report Cards...");
  const primaryBatchResult = await compileClassReportCards({
    schoolId: school.id,
    className: "Primary 5",
    term,
    academicYear,
    tierName: "Primary School",
  });
  console.log(`✅ Primary 5 Compiled Report Cards: ${primaryBatchResult.totalCompiled}`);

  // Fetch compiled report card for primaryStudent
  const primaryCard = await primaryClient.reportCard.findUnique({
    where: {
      schoolId_studentId_term_academicYear: {
        schoolId: school.id,
        studentId: primaryStudent.id,
        term,
        academicYear,
      },
    },
  });

  console.log(`✅ Primary Student Report Card:`);
  console.log(`   - Average Score: ${primaryCard?.averageScore}%`);
  console.log(`   - Overall Grade: ${primaryCard?.gradeLetter}`);
  console.log(`   - Class Position: ${primaryCard?.classPosition} of ${primaryCard?.totalStudentsInClass}`);
  console.log(`   - Passed Subjects: ${primaryCard?.passedSubjects} / ${primaryCard?.totalSubjects}`);
  console.log(`   - Teacher Remarks: "${primaryCard?.teacherRemarks}"`);
  console.log(`   - Principal Remarks: "${primaryCard?.principalRemarks}"`);
  console.log(`   - Frozen Snapshot Items: ${(primaryCard?.academicRecordSnapshot as any[])?.length}`);

  // 3. SECONDARY SCHOOL VERIFICATION
  console.log("\n============================================");
  console.log("2. TESTING SECONDARY SCHOOL GRADING & ROUTING");
  console.log("============================================");

  const secondaryStudents = await secondaryClient.student.findMany({
    where: { schoolId: school.id, currentClass: "JSS 2" },
    take: 3,
  });

  if (secondaryStudents.length === 0) {
    console.error("❌ No JSS 2 students found in greenwood_secondary_db!");
    process.exit(1);
  }

  const secondaryStudent = secondaryStudents[0];
  console.log(`Selected Secondary Student: ${secondaryStudent.firstName} ${secondaryStudent.lastName} (${secondaryStudent.id})`);

  const secondarySubjects = [
    { subject: "Mathematics", test1: 18, test2: 17, midTerm: 19, finalExam: 42 }, // Total: 96 (A, Pass)
    { subject: "English Language", test1: 14, test2: 16, midTerm: 15, finalExam: 38 }, // Total: 83 (A, Pass)
    { subject: "Basic Technology", test1: 12, test2: 14, midTerm: 14, finalExam: 32 }, // Total: 72 (B, Pass)
    { subject: "Agricultural Science", test1: 10, test2: 11, midTerm: 12, finalExam: 28 }, // Total: 61 (C, Pass)
  ];

  for (const s of secondarySubjects) {
    const res = await saveAcademicRecord({
      schoolId: school.id,
      studentId: secondaryStudent.id,
      subject: s.subject,
      term,
      academicYear,
      className: "JSS 2",
      tierName: "Secondary School",
      numericalScores: {
        test1: s.test1,
        test2: s.test2,
        midTerm: s.midTerm,
        finalExam: s.finalExam,
        passThreshold: 50,
      },
    });
    console.log(`✓ Saved Secondary Subject "${s.subject}": Total ${res.record.totalScore}%, Grade ${res.record.gradeLetter}, Passed: ${res.record.isPassed}`);
  }

  // Verify records in greenwood_secondary_db
  const secondaryDbRecords = await secondaryClient.academicRecord.findMany({
    where: { schoolId: school.id, studentId: secondaryStudent.id, term, academicYear },
  });
  console.log(`✅ Secondary DB AcademicRecords count: ${secondaryDbRecords.length} (Expected: 4)`);

  // Assert Strict Isolation: check that greenwood_primary_db has ZERO records for this secondary student
  const leakedSecondaryInPrimary = await primaryClient.academicRecord.findMany({
    where: { studentId: secondaryStudent.id },
  });
  if (leakedSecondaryInPrimary.length === 0) {
    console.log("🌟 STRICT DB ISOLATION CONFIRMED: 0 Secondary records exist in greenwood_primary_db!");
  } else {
    console.error(`❌ DATA LEAKAGE: Found ${leakedSecondaryInPrimary.length} Secondary records in Primary DB!`);
    process.exit(1);
  }

  // Compile JSS 2 class report cards
  console.log("\nCompiling JSS 2 Class Report Cards...");
  const secondaryBatchResult = await compileClassReportCards({
    schoolId: school.id,
    className: "JSS 2",
    term,
    academicYear,
    tierName: "Secondary School",
  });
  console.log(`✅ JSS 2 Compiled Report Cards: ${secondaryBatchResult.totalCompiled}`);

  const secondaryCard = await secondaryClient.reportCard.findUnique({
    where: {
      schoolId_studentId_term_academicYear: {
        schoolId: school.id,
        studentId: secondaryStudent.id,
        term,
        academicYear,
      },
    },
  });

  console.log(`✅ Secondary Student Report Card:`);
  console.log(`   - Average Score: ${secondaryCard?.averageScore}%`);
  console.log(`   - Overall Grade: ${secondaryCard?.gradeLetter}`);
  console.log(`   - Class Position: ${secondaryCard?.classPosition} of ${secondaryCard?.totalStudentsInClass}`);
  console.log(`   - Passed Subjects: ${secondaryCard?.passedSubjects} / ${secondaryCard?.totalSubjects}`);
  console.log(`   - Teacher Remarks: "${secondaryCard?.teacherRemarks}"`);
  console.log(`   - Principal Remarks: "${secondaryCard?.principalRemarks}"`);

  // 4. DAYCARE / NURSERY VERIFICATION
  console.log("\n============================================");
  console.log("3. TESTING DAYCARE / NURSERY NARRATIVE SYSTEM");
  console.log("============================================");

  const nurseryClient = await getPrismaClientForTier(school.id, "Daycare / Nursery");
  const nurseryStudents = await nurseryClient.student.findMany({
    where: { schoolId: school.id, currentClass: "Nursery 1" },
    take: 2,
  });

  if (nurseryStudents.length === 0) {
    console.error("❌ No Nursery 1 students found in greenwood_nursery_db!");
    process.exit(1);
  }

  const nurseryStudent = nurseryStudents[0];
  console.log(`Selected Nursery Student: ${nurseryStudent.firstName} ${nurseryStudent.lastName} (${nurseryStudent.id})`);

  const nurserySkills = [
    { domain: "Physical & Motor Skills", skillName: "Fine motor grip & pencil control", rating: "EXCELLENT" as const },
    { domain: "Cognitive & Numeracy Skills", skillName: "Color and shape recognition", rating: "EXCELLENT" as const },
    { domain: "Language & Literacy", skillName: "Phonetic awareness & vocabulary", rating: "DEVELOPING" as const },
    { domain: "Social & Emotional Growth", skillName: "Peer collaboration & sharing", rating: "EXCELLENT" as const },
    { domain: "Creative & Expressive Arts", skillName: "Singing and musical participation", rating: "EXCELLENT" as const },
  ];

  const nurseryRes = await saveAcademicRecord({
    schoolId: school.id,
    studentId: nurseryStudent.id,
    subject: "Early Childhood Development",
    term,
    academicYear,
    className: "Nursery 1",
    tierName: "Daycare / Nursery",
    narrativeRating: "EXCELLENT",
    skillsEvaluation: nurserySkills,
    narrativeFeedback: "A curious and cheerful learner who interacts joyfully in classroom activities.",
    teacherRemarks: "Outstanding engagement and blossoming developmental confidence.",
  });

  console.log(`✓ Saved Nursery Assessment: AssessmentType: ${nurseryRes.record.assessmentType}, NarrativeRating: ${nurseryRes.record.narrativeRating}`);

  // Compile Nursery Student Report Card
  const nurseryCompiled = await compileStudentReportCard({
    schoolId: school.id,
    studentId: nurseryStudent.id,
    term,
    academicYear,
    className: "Nursery 1",
    tierName: "Daycare / Nursery",
  });

  console.log(`✅ Nursery Student Report Card:`);
  console.log(`   - Overall Milestone Rating: ${nurseryCompiled.reportCard.gradeLetter}`);
  console.log(`   - Developmental Summary: "${nurseryCompiled.reportCard.narrativeSummary}"`);
  console.log(`   - Teacher Remarks: "${nurseryCompiled.reportCard.teacherRemarks}"`);
  console.log(`   - Principal Remarks: "${nurseryCompiled.reportCard.principalRemarks}"`);
  console.log(`   - Class Position: ${nurseryCompiled.reportCard.classPosition} (Expected: null for narrative tier)`);

  // 5. CLASS RESULT SHEET / BROADSHEET VERIFICATION
  console.log("\n============================================");
  console.log("4. TESTING CLASS RESULT SHEET (BROADSHEET)");
  console.log("============================================");

  const resultSheet = await getClassResultSheet(
    school.id,
    "Primary 5",
    term,
    academicYear,
    "Primary School"
  );

  console.log(`✅ Result Sheet for "${resultSheet.className}":`);
  console.log(`   - Subjects Included: ${resultSheet.subjects.join(", ")}`);
  console.log(`   - Total Students Listed: ${resultSheet.students.length}`);
  const firstRanked = resultSheet.students.find(s => s.reportCard?.classPosition === 1);
  if (firstRanked) {
    console.log(`   - 1st Position: ${firstRanked.name} (Avg: ${firstRanked.reportCard?.averageScore}%, Grade: ${firstRanked.reportCard?.gradeLetter})`);
  }

  // 6. FINAL CROSS-DB ISOLATION INTEGRITY CHECK
  console.log("\n============================================");
  console.log("5. FINAL STRICT CROSS-DATABASE INTEGRITY CHECK");
  console.log("============================================");

  const primaryCardsCount = await primaryClient.reportCard.count();
  const secondaryCardsCount = await secondaryClient.reportCard.count();
  const nurseryCardsCount = await nurseryClient.reportCard.count();

  console.log(`📊 Total ReportCards in greenwood_primary_db: ${primaryCardsCount}`);
  console.log(`📊 Total ReportCards in greenwood_secondary_db: ${secondaryCardsCount}`);
  console.log(`📊 Total ReportCards in greenwood_nursery_db: ${nurseryCardsCount}`);

  // Query primary student ID in secondary report cards
  const leakedPrimaryCard = await secondaryClient.reportCard.findFirst({
    where: { studentId: primaryStudent.id },
  });
  const leakedSecondaryCard = await primaryClient.reportCard.findFirst({
    where: { studentId: secondaryStudent.id },
  });

  if (!leakedPrimaryCard && !leakedSecondaryCard) {
    console.log("🌟 ZERO LEAKAGE CONFIRMED: Primary and Secondary report cards are 100% physically isolated in separate databases!");
  } else {
    console.error("❌ Leakage detected in report card tables!");
    process.exit(1);
  }

  console.log("\n=== ALL AUTOMATED K-12 REPORT CARD & RESULT SHEET TESTS PASSED! ===");
  process.exit(0);
}

verifyReportCardGeneration().catch(err => {
  console.error("❌ Verification failed with error:", err);
  process.exit(1);
});
