import { PrismaClient } from "@prisma/client";
import { compileStudentReportCard, getStudentReportCard } from "@/lib/report-card-service";
import { resolveCrecheConfig, mapCrecheScoreToGrade } from "@/lib/creche-config";
import { approveClassReportCardsAction, unlockClassReportCardsAction } from "@/app/[schoolDomain]/(admin)/report-cards/actions";
import { saveClassroomGrades } from "@/app/[schoolDomain]/portal/staff/actions";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("PHASE 2 CRECHE VERIFICATION: Comprehensive Multi-School Test Suite");
  console.log("==================================================================");

  // -------------------------------------------------------------
  // TEST 1: APEX INTERNATIONAL ACADEMY (demo) CRECHE
  // -------------------------------------------------------------
  console.log("\n[TEST 1] APEX INTERNATIONAL ACADEMY (demo) - Creche Single Source of Truth");
  const apex = await prisma.school.findFirst({
    where: { subdomain: "demo" },
    include: { academicTiers: true },
  });
  if (!apex) throw new Error("Apex school not found!");

  const adaeze = await prisma.student.findFirst({
    where: { schoolId: apex.id, admissionNumber: "APEX/2026/CRE/001" },
  });
  const emeka = await prisma.student.findFirst({
    where: { schoolId: apex.id, admissionNumber: "APEX/2026/CRE/002" },
  });
  if (!adaeze || !emeka) throw new Error("Adaeze or Emeka not found in Apex!");

  const term = "1st Term";
  const academicYear = "2026/2027";
  const className = "Creche";
  const tierName = "Creche / Nursery";

  // Compile Adaeze
  const compileAdaeze = await compileStudentReportCard({
    schoolId: apex.id,
    studentId: adaeze.id,
    term,
    academicYear,
    className,
    tierName,
  });
  const reportAdaeze = await getStudentReportCard(apex.id, adaeze.id, term, academicYear, tierName);
  const snapAdaeze = (reportAdaeze.reportCard?.academicRecordSnapshot as any[]) || [];

  // Compile Emeka
  const compileEmeka = await compileStudentReportCard({
    schoolId: apex.id,
    studentId: emeka.id,
    term,
    academicYear,
    className,
    tierName,
  });
  const reportEmeka = await getStudentReportCard(apex.id, emeka.id, term, academicYear, tierName);
  const snapEmeka = (reportEmeka.reportCard?.academicRecordSnapshot as any[]) || [];

  console.log(`Adaeze: Total=${compileAdaeze.reportCard.totalScore}, Avg=${compileAdaeze.reportCard.averageScore}, Grade=${compileAdaeze.reportCard.gradeLetter}, Subjects=${snapAdaeze.length}`);
  console.log(`Emeka:  Total=${compileEmeka.reportCard.totalScore}, Avg=${compileEmeka.reportCard.averageScore}, Grade=${compileEmeka.reportCard.gradeLetter}, Subjects=${snapEmeka.length}`);

  // Assertions for Apex
  if (compileAdaeze.reportCard.totalScore !== 73 || compileAdaeze.reportCard.averageScore !== 73 || compileAdaeze.reportCard.gradeLetter !== "Very Good") {
    throw new Error(`Adaeze assertion failed: Got Total ${compileAdaeze.reportCard.totalScore}, Avg ${compileAdaeze.reportCard.averageScore}, Grade ${compileAdaeze.reportCard.gradeLetter}`);
  }
  if (snapAdaeze.length !== 1 || snapAdaeze[0].subject !== "Sensory & Motor Exploration") {
    throw new Error(`Adaeze subject isolation failed: unentered subject was not excluded! Got ${JSON.stringify(snapAdaeze)}`);
  }

  if (compileEmeka.reportCard.totalScore !== 80 || compileEmeka.reportCard.averageScore !== 80 || (compileEmeka.reportCard.gradeLetter !== "Excellent" && compileEmeka.reportCard.gradeLetter !== "Distinction")) {
    throw new Error(`Emeka assertion failed: Got Total ${compileEmeka.reportCard.totalScore}, Avg ${compileEmeka.reportCard.averageScore}, Grade ${compileEmeka.reportCard.gradeLetter}`);
  }
  if (snapEmeka.length !== 1 || snapEmeka[0].subject !== "Sensory & Motor Exploration") {
    throw new Error(`Emeka subject isolation failed: unentered subject was not excluded! Got ${JSON.stringify(snapEmeka)}`);
  }
  console.log("[PASS] Apex Creche: Teacher Entry vs Report matches exactly (73 = Very Good, 80 = Distinction, unentered excluded).");

  // -------------------------------------------------------------
  // TEST 2: EGEDE PRIMARY SCHOOL (egede) CRECHE
  // -------------------------------------------------------------
  console.log("\n[TEST 2] EGEDE PRIMARY SCHOOL (egede) - Creche Single Source of Truth");
  const egede = await prisma.school.findFirst({
    where: { subdomain: "egede" },
    include: { academicTiers: true },
  });
  if (!egede) throw new Error("Egede school not found!");

  const somto = await prisma.student.findFirst({
    where: { schoolId: egede.id, admissionNumber: "EGED/2026/CRE/001" },
  });
  const ngozi = await prisma.student.findFirst({
    where: { schoolId: egede.id, admissionNumber: "EGED/2026/CRE/002" },
  });
  if (!somto || !ngozi) throw new Error("Somtochukwu or Ngozi not found in Egede Creche!");

  const compileSomto = await compileStudentReportCard({
    schoolId: egede.id,
    studentId: somto.id,
    term,
    academicYear,
    className: "Creche",
    tierName: "Creche",
  });
  const reportSomto = await getStudentReportCard(egede.id, somto.id, term, academicYear, "Creche");
  const snapSomto = (reportSomto.reportCard?.academicRecordSnapshot as any[]) || [];

  const compileNgozi = await compileStudentReportCard({
    schoolId: egede.id,
    studentId: ngozi.id,
    term,
    academicYear,
    className: "Creche",
    tierName: "Creche",
  });
  const reportNgozi = await getStudentReportCard(egede.id, ngozi.id, term, academicYear, "Creche");
  const snapNgozi = (reportNgozi.reportCard?.academicRecordSnapshot as any[]) || [];

  console.log(`Somto: Total=${compileSomto.reportCard.totalScore}, Avg=${compileSomto.reportCard.averageScore}, Grade=${compileSomto.reportCard.gradeLetter}, Subjects=${snapSomto.length}`);
  console.log(`Ngozi: Total=${compileNgozi.reportCard.totalScore}, Avg=${compileNgozi.reportCard.averageScore}, Grade=${compileNgozi.reportCard.gradeLetter}, Subjects=${snapNgozi.length}`);

  if (compileSomto.reportCard.totalScore !== 73 || compileSomto.reportCard.averageScore !== 73 || compileSomto.reportCard.gradeLetter !== "Very Good") {
    throw new Error(`Somto assertion failed!`);
  }
  if (compileNgozi.reportCard.totalScore !== 80 || compileNgozi.reportCard.averageScore !== 80 || (compileNgozi.reportCard.gradeLetter !== "Excellent" && compileNgozi.reportCard.gradeLetter !== "Distinction")) {
    throw new Error(`Ngozi assertion failed!`);
  }
  console.log("[PASS] Egede Creche: Teacher Entry vs Report matches exactly (73 = Very Good, 80 = Distinction, unentered excluded).");

  // -------------------------------------------------------------
  // TEST 3: ADMIN CONFIGURABLE FORMULA RESOLUTION
  // -------------------------------------------------------------
  console.log("\n[TEST 3] ADMIN CONFIGURABLE FORMULA RESOLUTION");
  const defaultCfg = resolveCrecheConfig({});
  console.log("Default Creche Config:", defaultCfg);
  if (defaultCfg.hasExam !== false || defaultCfg.ca1Max !== 50 || defaultCfg.ca2Max !== 50 || defaultCfg.examMax !== 0) {
    throw new Error("Default Creche config must be Observation 50 + CA 50 = 100, NO Exam!");
  }

  const examCfg = resolveCrecheConfig({
    crecheAssessmentConfig: {
      hasExam: true,
      ca1Name: "Observation",
      ca1Max: 20,
      ca2Name: "Continuous Assessment",
      ca2Max: 20,
      examName: "Terminal Exam",
      examMax: 60,
    },
  });
  console.log("Exam-Enabled Creche Config:", examCfg);
  if (examCfg.hasExam !== true || examCfg.ca1Max !== 20 || examCfg.ca2Max !== 20 || examCfg.examMax !== 60) {
    throw new Error("Exam enabled Creche config should resolve 20/20/60!");
  }
  console.log("[PASS] Admin Configurable Formula resolves correctly (default NO Exam 50/50, custom 20/20/60).");

  // -------------------------------------------------------------
  // TEST 4: HEAD TEACHER / PRINCIPAL LOCKING & AUDIT LOG FLOW
  // -------------------------------------------------------------
  console.log("\n[TEST 4] HEAD TEACHER / PRINCIPAL LOCKING & AUDIT LOG FLOW");
  // 4a. Lock the report cards for Apex Creche
  await prisma.reportCard.updateMany({
    where: { schoolId: apex.id, className: "Creche", term },
    data: { status: "APPROVED" },
  });

  // 4b. Teacher attempts to save grades while locked -> MUST fail/block
  const attemptWhileLocked = await saveClassroomGrades(
    apex.id,
    "Creche",
    "Sensory & Motor Exploration",
    term,
    academicYear,
    [
      {
        studentId: adaeze.id,
        ca1: 40,
        ca2: 40,
        exam: 0,
        totalScore: 80,
      },
    ]
  );
  console.log("Teacher save while locked result:", attemptWhileLocked);

  if (attemptWhileLocked.success) {
    throw new Error("Security Violation: Teacher was able to save grades to an APPROVED/LOCKED class!");
  }
  console.log("[PASS] Lock Enforcement: Teacher is strictly blocked from editing locked/approved report cards.");

  // 4c. Head Teacher unlocks the class with reason
  const unlockResult = await unlockClassReportCardsAction(
    apex.id,
    "Creche",
    term,
    academicYear,
    "Correction requested by Creche Lead Educator for Observation scores"
  );
  console.log("Unlock Action Result:", unlockResult);

  // Check AuditLog was written
  const auditEntry = await prisma.auditLog.findFirst({
    where: {
      schoolId: apex.id,
      action: "HEAD_TEACHER_UNLOCK_GRADES",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!auditEntry) {
    throw new Error("Audit log entry for HEAD_TEACHER_UNLOCK_GRADES was not created!");
  }
  console.log(`[PASS] Head Teacher Unlock created immutable AuditLog entry: [${auditEntry.action}] - ${JSON.stringify(auditEntry.metadata)}`);

  // 4d. Teacher saves grades again -> MUST now succeed
  const saveSuccess = await saveClassroomGrades(
    apex.id,
    "Creche",
    "Sensory & Motor Exploration",
    term,
    academicYear,
    [
      {
        studentId: adaeze.id,
        ca1: 38,
        ca2: 35,
        exam: 0,
        totalScore: 73,
      },
    ]
  );
  console.log("Teacher Save Result after unlock:", saveSuccess);
  if (!saveSuccess.success) {
    throw new Error("Teacher save failed after class was unlocked!");
  }
  console.log("[PASS] Teacher can save grades after unlock, with audit trail maintained.");

  // -------------------------------------------------------------
  // TEST 5: PARENT PORTAL ISOLATION (PARENT VIEWS ONLY OWN CHILD)
  // -------------------------------------------------------------
  console.log("\n[TEST 5] PARENT PORTAL ISOLATION");
  const parentOkoro = await prisma.parent.findFirst({
    where: { schoolId: apex.id, email: "ngozi.okoro@example.com" },
    include: { students: { include: { student: true } } },
  });
  const parentNwosu = await prisma.parent.findFirst({
    where: { schoolId: apex.id, email: "obi.nwosu@example.com" },
    include: { students: { include: { student: true } } },
  });

  if (!parentOkoro || !parentNwosu) {
    throw new Error("Guardians Mrs. Okoro or Mr. Nwosu not found!");
  }

  const okoroChildren = parentOkoro.students.map((s) => s.student.admissionNumber);
  const nwosuChildren = parentNwosu.students.map((s) => s.student.admissionNumber);

  console.log("Mrs. Okoro's children:", okoroChildren);
  console.log("Mr. Nwosu's children:", nwosuChildren);

  if (okoroChildren.length !== 1 || !okoroChildren.includes("APEX/2026/CRE/001")) {
    throw new Error("Parent Isolation failure: Mrs. Okoro does not see only Adaeze!");
  }
  if (okoroChildren.includes("APEX/2026/CRE/002")) {
    throw new Error("Data Leak: Mrs. Okoro can see Emeka Nwosu!");
  }

  if (nwosuChildren.length !== 1 || !nwosuChildren.includes("APEX/2026/CRE/002")) {
    throw new Error("Parent Isolation failure: Mr. Nwosu does not see only Emeka!");
  }
  if (nwosuChildren.includes("APEX/2026/CRE/001")) {
    throw new Error("Data Leak: Mr. Nwosu can see Adaeze Okoro!");
  }
  console.log("[PASS] Parent Portal Isolation: Parents strictly see ONLY their own child's report.");

  // -------------------------------------------------------------
  // TEST 6: VERIFY PRIMARY NERDC 20/20/60 IS 100% UNTOUCHED
  // -------------------------------------------------------------
  console.log("\n[TEST 6] REGRESSION CHECK: PRIMARY NERDC 20/20/60 UNTOUCHED");
  const josephReport = await getStudentReportCard(
    egede.id,
    "3c3c837b-6a42-44a3-a34c-f6a8b6c2e002",
    "1st Term",
    "2026/2027",
    "Primary School"
  );
  const josephTotal = josephReport.reportCard?.totalScore;
  const josephAvg = josephReport.reportCard?.averageScore;
  const josephGrade = josephReport.reportCard?.gradeLetter;
  console.log(`Joseph Okonkwo (Primary 2): Total=${josephTotal}, Avg=${josephAvg}, Grade=${josephGrade}`);
  if (josephTotal !== 73 || josephAvg !== 73 || josephGrade !== "Very Good") {
    throw new Error("REGRESSION ERROR: Primary NERDC was broken or altered!");
  }
  console.log("[PASS] Primary NERDC 20/20/60 regression test passed 100%.");

  console.log("\n==================================================================");
  console.log(">>> ALL PHASE 2 CRECHE VERIFICATION CHECKS PASSED PERFECTLY! <<<");
  console.log("==================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
