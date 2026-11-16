import { PrismaClient } from "@prisma/client";
import { compileStudentReportCard, getStudentReportCard } from "@/lib/report-card-service";
import { resolveNurseryConfig, mapNurseryScoreToGrade } from "@/lib/nursery-config";
import { approveClassReportCardsAction, unlockClassReportCardsAction } from "@/app/[schoolDomain]/(admin)/report-cards/actions";
import { saveClassroomGrades } from "@/app/[schoolDomain]/portal/staff/actions";
import { generateReportCardPdf } from "@/lib/report-card-pdf";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("PHASE 3 NURSERY VERIFICATION: Comprehensive Multi-School Suite");
  console.log("==================================================================");

  // -------------------------------------------------------------
  // TEST 1: APEX INTERNATIONAL ACADEMY (demo) NURSERY
  // -------------------------------------------------------------
  console.log("\n[TEST 1] APEX INTERNATIONAL ACADEMY (demo) - Nursery Single Source of Truth");
  const apex = await prisma.school.findFirst({
    where: { subdomain: "demo" },
    include: { academicTiers: true },
  });
  if (!apex) throw new Error("Apex school not found!");

  const chisom = await prisma.student.findFirst({
    where: { schoolId: apex.id, admissionNumber: "APEX/2026/NUR/001" },
  });
  const farouk = await prisma.student.findFirst({
    where: { schoolId: apex.id, admissionNumber: "APEX/2026/NUR/002" },
  });
  if (!chisom || !farouk) throw new Error("Chisom or Farouk not found in Apex!");

  const term = "1st Term";
  const academicYear = "2026/2027";
  const className = "Nursery 1";
  const tierName = "Nursery / Kindergarten";

  // Compile Chisom
  const compileChisom = await compileStudentReportCard({
    schoolId: apex.id,
    studentId: chisom.id,
    term,
    academicYear,
    className,
    tierName,
  });
  const reportChisom = await getStudentReportCard(apex.id, chisom.id, term, academicYear, tierName);
  const snapChisom = (reportChisom.reportCard?.academicRecordSnapshot as any[]) || [];

  // Compile Farouk
  const compileFarouk = await compileStudentReportCard({
    schoolId: apex.id,
    studentId: farouk.id,
    term,
    academicYear,
    className,
    tierName,
  });
  const reportFarouk = await getStudentReportCard(apex.id, farouk.id, term, academicYear, tierName);
  const snapFarouk = (reportFarouk.reportCard?.academicRecordSnapshot as any[]) || [];

  console.log(`Chisom: Total=${compileChisom.reportCard.totalScore}, Avg=${compileChisom.reportCard.averageScore}, Grade=${compileChisom.reportCard.gradeLetter}, Subjects=${snapChisom.length}`);
  console.log(`Farouk: Total=${compileFarouk.reportCard.totalScore}, Avg=${compileFarouk.reportCard.averageScore}, Grade=${compileFarouk.reportCard.gradeLetter}, Subjects=${snapFarouk.length}`);

  // Assertions for Apex Nursery
  if (compileChisom.reportCard.totalScore !== 73 || compileChisom.reportCard.averageScore !== 73 || compileChisom.reportCard.gradeLetter !== "Very Good") {
    throw new Error(`Chisom assertion failed: Got Total ${compileChisom.reportCard.totalScore}, Avg ${compileChisom.reportCard.averageScore}, Grade ${compileChisom.reportCard.gradeLetter}`);
  }
  if (snapChisom.length !== 1 || snapChisom[0].subject !== "Early Mathematical Concepts") {
    throw new Error(`Chisom subject isolation failed: unentered subject was not excluded! Got ${JSON.stringify(snapChisom)}`);
  }

  if (compileFarouk.reportCard.totalScore !== 80 || compileFarouk.reportCard.averageScore !== 80 || compileFarouk.reportCard.gradeLetter !== "Excellent") {
    throw new Error(`Farouk assertion failed: Got Total ${compileFarouk.reportCard.totalScore}, Avg ${compileFarouk.reportCard.averageScore}, Grade ${compileFarouk.reportCard.gradeLetter}`);
  }
  if (snapFarouk.length !== 1 || snapFarouk[0].subject !== "Early Mathematical Concepts") {
    throw new Error(`Farouk subject isolation failed: unentered subject was not excluded! Got ${JSON.stringify(snapFarouk)}`);
  }
  console.log("[PASS] Apex Nursery: Teacher Entry vs Report matches exactly (73 = Very Good, 80 = Excellent, unentered excluded).");

  // -------------------------------------------------------------
  // TEST 2: EGEDE PRIMARY SCHOOL (egede) NURSERY
  // -------------------------------------------------------------
  console.log("\n[TEST 2] EGEDE PRIMARY SCHOOL (egede) - Nursery Single Source of Truth");
  const egede = await prisma.school.findFirst({
    where: { subdomain: "egede" },
    include: { academicTiers: true },
  });
  if (!egede) throw new Error("Egede school not found!");

  const chidera = await prisma.student.findFirst({
    where: { schoolId: egede.id, admissionNumber: "EGED/2026/NUR/001" },
  });
  const kamsi = await prisma.student.findFirst({
    where: { schoolId: egede.id, admissionNumber: "EGED/2026/NUR/002" },
  });
  if (!chidera || !kamsi) throw new Error("Chidera or Kamsiyochukwu not found in Egede Nursery!");

  const compileChidera = await compileStudentReportCard({
    schoolId: egede.id,
    studentId: chidera.id,
    term,
    academicYear,
    className,
    tierName,
  });
  const reportChidera = await getStudentReportCard(egede.id, chidera.id, term, academicYear, tierName);
  const snapChidera = (reportChidera.reportCard?.academicRecordSnapshot as any[]) || [];

  const compileKamsi = await compileStudentReportCard({
    schoolId: egede.id,
    studentId: kamsi.id,
    term,
    academicYear,
    className,
    tierName,
  });
  const reportKamsi = await getStudentReportCard(egede.id, kamsi.id, term, academicYear, tierName);
  const snapKamsi = (reportKamsi.reportCard?.academicRecordSnapshot as any[]) || [];

  console.log(`Chidera: Total=${compileChidera.reportCard.totalScore}, Avg=${compileChidera.reportCard.averageScore}, Grade=${compileChidera.reportCard.gradeLetter}, Subjects=${snapChidera.length}`);
  console.log(`Kamsi:   Total=${compileKamsi.reportCard.totalScore}, Avg=${compileKamsi.reportCard.averageScore}, Grade=${compileKamsi.reportCard.gradeLetter}, Subjects=${snapKamsi.length}`);

  if (compileChidera.reportCard.totalScore !== 73 || compileChidera.reportCard.averageScore !== 73 || compileChidera.reportCard.gradeLetter !== "Very Good") {
    throw new Error(`Chidera assertion failed: Got Total ${compileChidera.reportCard.totalScore}, Avg ${compileChidera.reportCard.averageScore}, Grade ${compileChidera.reportCard.gradeLetter}`);
  }
  if (snapChidera.length !== 1 || snapChidera[0].subject !== "Early Mathematical Concepts") {
    throw new Error(`Chidera subject isolation failed: unentered subject was not excluded!`);
  }

  if (compileKamsi.reportCard.totalScore !== 80 || compileKamsi.reportCard.averageScore !== 80 || compileKamsi.reportCard.gradeLetter !== "Excellent") {
    throw new Error(`Kamsi assertion failed: Got Total ${compileKamsi.reportCard.totalScore}, Avg ${compileKamsi.reportCard.averageScore}, Grade ${compileKamsi.reportCard.gradeLetter}`);
  }
  if (snapKamsi.length !== 1 || snapKamsi[0].subject !== "Early Mathematical Concepts") {
    throw new Error(`Kamsi subject isolation failed: unentered subject was not excluded!`);
  }
  console.log("[PASS] Egede Nursery: Teacher Entry vs Report matches exactly (73 = Very Good, 80 = Excellent, unentered excluded).");

  // -------------------------------------------------------------
  // TEST 3: AGE-APPROPRIATE NURSERY GRADE SCALE UNIFICATION
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Age-Appropriate Nursery Grade Scale Unification");
  const testScores = [
    { score: 95, expected: "Excellent" },
    { score: 80, expected: "Excellent" },
    { score: 75, expected: "Excellent" },
    { score: 73, expected: "Very Good" },
    { score: 65, expected: "Very Good" },
    { score: 55, expected: "Good" },
    { score: 45, expected: "Developing" },
    { score: 35, expected: "Needs Support" },
  ];
  for (const t of testScores) {
    const res = mapNurseryScoreToGrade(t.score);
    if (res.letter !== t.expected) {
      throw new Error(`Nursery grade mapping failed for score ${t.score}: expected ${t.expected}, got ${res.letter}`);
    }
  }
  console.log("[PASS] Nursery grading scale strictly adheres to age-appropriate labels: Excellent, Very Good, Good, Developing, Needs Support.");

  // -------------------------------------------------------------
  // TEST 4: ADMIN CONFIGURABLE NURSERY FORMULA
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Admin Configurable Nursery Assessment Formula");
  const defaultCfg = resolveNurseryConfig(apex);
  if (defaultCfg.hasExam !== false || defaultCfg.ca1Max !== 50 || defaultCfg.ca2Max !== 50 || defaultCfg.examMax !== 0) {
    throw new Error(`Apex default Nursery formula unexpected: ${JSON.stringify(defaultCfg)}`);
  }
  console.log("Default Formula Verified: NO Exam, Observation 50 + CA 50 = 100.");

  // Test toggling exam on in tierDatabasesConfig
  const modifiedApex = await prisma.school.update({
    where: { id: apex.id },
    data: {
      tierDatabasesConfig: {
        ...((apex.tierDatabasesConfig as any) || {}),
        nurseryAssessmentConfig: {
          hasExam: true,
          ca1Name: "Observation",
          ca1Max: 20,
          ca2Name: "Continuous Assessment",
          ca2Max: 20,
          examName: "Exam",
          examMax: 60,
          totalMax: 100,
        },
      },
    },
  });
  const examCfg = resolveNurseryConfig(modifiedApex);
  if (!examCfg.hasExam || examCfg.examMax !== 60) {
    throw new Error(`Failed to toggle Nursery exam configuration!`);
  }
  console.log("Exam-enabled formula successfully verified (20/20/60).");

  // Revert back to NO Exam default for standard testing
  await prisma.school.update({
    where: { id: apex.id },
    data: {
      tierDatabasesConfig: {
        ...((apex.tierDatabasesConfig as any) || {}),
        nurseryAssessmentConfig: defaultCfg,
      },
    },
  });
  console.log("[PASS] Admin Configurable Formula works seamlessly and applies dynamically.");

  // -------------------------------------------------------------
  // TEST 5: HEAD TEACHER LOCKING & UNLOCK AUDITLOG FLOW
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Head Teacher Locking & Unlock AuditLog Flow");
  // 1. Lock class report cards
  const lockResult = await approveClassReportCardsAction(apex.id, className, term, academicYear, true);
  if (!lockResult.success) throw new Error("Failed to lock Nursery report cards: " + lockResult.error);
  console.log(`Locked ${lockResult.count} Nursery report cards.`);

  // 2. Verify Teacher cannot edit locked grades
  let teacherBlocked = false;
  try {
    const teacherResult = await saveClassroomGrades(
      apex.id,
      className,
      "Early Mathematical Concepts",
      term,
      academicYear,
      [
        {
          studentId: chisom.id,
          ca1: 40,
          ca2: 40,
          exam: 0,
          totalScore: 80,
        },
      ]
    );
    if (!teacherResult.success && teacherResult.error?.toLowerCase().includes("locked")) {
      teacherBlocked = true;
    }
  } catch (err: any) {
    if (err.message?.toLowerCase().includes("locked")) {
      teacherBlocked = true;
    }
  }

  if (!teacherBlocked) {
    throw new Error("Security violation: Teacher was able to save grades while Nursery report card is locked!");
  }
  console.log("Teacher grade editing blocked while locked: CONFIRMED.");

  // 3. Unlock with audit reason
  const unlockReason = "Head Teacher authorized review of Nursery learning milestones";
  const unlockResult = await unlockClassReportCardsAction(apex.id, className, term, academicYear, unlockReason);
  if (!unlockResult.success) throw new Error("Failed to unlock Nursery report cards: " + unlockResult.error);
  console.log(`Unlocked ${unlockResult.count} Nursery report cards.`);

  // 4. Verify AuditLog
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      schoolId: apex.id,
      action: "HEAD_TEACHER_UNLOCK_GRADES",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!auditLog || !JSON.stringify(auditLog.metadata).includes(unlockReason)) {
    throw new Error(`Audit log entry missing or does not contain unlock reason: ${JSON.stringify(auditLog)}`);
  }
  console.log("[PASS] Locking + AuditLog flow verified: Teacher blocked when locked, unlock logged to AuditLog.");

  // -------------------------------------------------------------
  // TEST 6: PARENT PORTAL ISOLATION
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Parent Portal Isolation Check");
  const parent1 = await prisma.parent.findFirst({
    where: { email: "ngozi.obi@example.com" },
    include: { students: { include: { student: true } } },
  });
  if (!parent1) throw new Error("Parent Ngozi Obi not found!");

  const allowedChildIds = parent1.students.map((sp) => sp.student.id);
  const canSeeChisom = allowedChildIds.includes(chisom.id);
  const canSeeFarouk = allowedChildIds.includes(farouk.id);

  console.log(`Parent: ${parent1.name}`);
  console.log(`Access to own child Chisom: ${canSeeChisom ? "ALLOWED" : "DENIED"}`);
  console.log(`Access to other child Farouk: ${canSeeFarouk ? "ALLOWED (VIOLATION)" : "DENIED (SECURE)"}`);

  if (!canSeeChisom || canSeeFarouk) {
    throw new Error("Parent portal isolation failure: parent must view only their child!");
  }
  console.log("[PASS] Parent portal isolation strictly enforced.");

  // -------------------------------------------------------------
  // TEST 7: PDF GENERATION FOR NURSERY
  // -------------------------------------------------------------
  console.log("\n[TEST 7] PDF Generation for Nursery");
  const nurseryPdfBuffer = await generateReportCardPdf({
    studentName: `${chisom.firstName} ${chisom.lastName}`,
    admissionNumber: chisom.admissionNumber || "APEX/2026/NUR/001",
    className: "Nursery 1",
    tierCategory: "NURSERY",
    term,
    session: academicYear,
    schoolName: apex.name,
    schoolAddress: "Apex International Campus",
    schoolContact: "+234800000000",
    classPosition: "1st",
    totalStudents: 2,
    totalScore: 73,
    averageScore: 73,
    overallGrade: "Very Good",
    subjects: [
      {
        subject: "Early Mathematical Concepts",
        ca1: 38,
        ca2: 35,
        exam: 0,
        total: 73,
        grade: "Very Good",
        subjectPosition: "1st",
        classAverage: 76.5,
        remark: "Very Good Progress",
      },
    ],
  });

  if (!nurseryPdfBuffer || nurseryPdfBuffer.length < 1000 || !nurseryPdfBuffer.toString("latin1").includes("%PDF")) {
    throw new Error(`PDF generation produced invalid buffer: length ${nurseryPdfBuffer?.length}`);
  }
  console.log(`[PASS] Nursery PDF successfully generated (${nurseryPdfBuffer.length} bytes) as valid PDF document.`);

  // -------------------------------------------------------------
  // TEST 8: REGRESSION TEST FOR PRIMARY (Phase 1) & CRECHE (Phase 2)
  // -------------------------------------------------------------
  console.log("\n[TEST 8] Regression Testing: Primary (Phase 1) and Creche (Phase 2)");
  // Primary: Joseph at Egede
  const joseph = await prisma.student.findFirst({
    where: { schoolId: egede.id, firstName: { equals: "Joseph", mode: "insensitive" } },
  });
  if (joseph) {
    const compileJoseph = await compileStudentReportCard({
      schoolId: egede.id,
      studentId: joseph.id,
      term,
      academicYear,
      className: joseph.currentClass || "Primary 2",
      tierName: "Primary School",
    });
    if (compileJoseph.reportCard.totalScore !== 73 || compileJoseph.reportCard.gradeLetter !== "Very Good") {
      throw new Error(`Primary regression failed: Joseph Total ${compileJoseph.reportCard.totalScore}, Grade ${compileJoseph.reportCard.gradeLetter}`);
    }
    console.log(`Primary Regression (Egede ${joseph.currentClass}, Joseph=73 Very Good): PASSED.`);
  }

  // Creche: Adaeze at Apex
  const adaeze = await prisma.student.findFirst({
    where: { schoolId: apex.id, admissionNumber: "APEX/2026/CRE/001" },
  });
  if (adaeze) {
    const compileAdaeze = await compileStudentReportCard({
      schoolId: apex.id,
      studentId: adaeze.id,
      term,
      academicYear,
      className: "Creche",
      tierName: "Creche / Nursery",
    });
    if (compileAdaeze.reportCard.totalScore !== 73 || compileAdaeze.reportCard.gradeLetter !== "Very Good") {
      throw new Error(`Creche regression failed: Adaeze Total ${compileAdaeze.reportCard.totalScore}, Grade ${compileAdaeze.reportCard.gradeLetter}`);
    }
    console.log("Creche Regression (Apex Creche, Adaeze=73 Very Good): PASSED.");
  }

  console.log("\n==================================================================");
  console.log(">>> ALL PHASE 3 NURSERY TESTS PASSED WITH 100% SUCCESS! <<<");
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("\nTEST FAILED WITH ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
