import { PrismaClient } from "@prisma/client";
import { recordWalkInApplication } from "@/app/[schoolDomain]/(admin)/admissions/walk-in/actions";
import { POST as publicSubmitHandler } from "@/app/api/v1/admissions/public-submit/route";

const prisma = new PrismaClient();

async function runDuplicatePreventionTest() {
  console.log("\n=======================================================");
  console.log("🧪 RUNNING ADMISSIONS PORTAL VS WALK-IN DEDUPLICATION TEST");
  console.log("=======================================================\n");

  const school = await prisma.school.findFirst({
    where: { subdomain: "egede" },
    include: { academicTiers: true },
  });

  if (!school) {
    throw new Error("Target tenant 'egede' not found!");
  }

  const testPupilFirstName = "Chinedu";
  const testPupilLastName = "Eze-" + Date.now();
  const testPupilFullName = `${testPupilFirstName} ${testPupilLastName}`;
  const testClass = "Primary 2";
  const testDob = "2018-04-15";
  const testEmail = `chinedu.${Date.now()}@example.com`;
  const testPhone = "+2348039876543";

  console.log(`[SETUP] Test Pupil: ${testPupilFullName}, Class: ${testClass}, DOB: ${testDob}`);

  // -------------------------------------------------------------------
  // TEST CASE 1: Portal submission
  // -------------------------------------------------------------------
  console.log("\n--- STEP 1: Applicant Submits via Public Portal ---");
  const portalReq: any = {
    json: async () => ({
      schoolDomain: "egede",
      applicantName: testPupilFullName,
      targetGrade: testClass,
      targetClass: testClass,
      dateOfBirth: testDob,
      studentEmail: testEmail,
      studentPhone: testPhone,
      parentName: `Mr. ${testPupilLastName}`,
      parentContact: testPhone,
      parentEmail: testEmail,
      password: "Password123!",
      academicTier: "Primary School",
    }),
    headers: new Headers({
      "content-type": "application/json",
      "x-tenant-id": school.id,
    }),
  };

  const portalRes = await publicSubmitHandler(portalReq);
  const portalData = await portalRes.json();

  if (!portalRes.ok || !portalData.success) {
    throw new Error(`Portal submission failed: ${JSON.stringify(portalData)}`);
  }

  const portalAppNo = portalData.applicationNo;
  console.log(`✅ [PORTAL SUBMIT SUCCESS]: Application No: ${portalAppNo}`);

  // Verify DB count
  const appsAfterPortal = await prisma.admissionsApplication.findMany({
    where: {
      schoolId: school.id,
      lastName: testPupilLastName,
    },
  });
  console.log(`[DB CHECK 1] Applications count for pupil: ${appsAfterPortal.length} (Expected: 1)`);
  if (appsAfterPortal.length !== 1) {
    throw new Error(`Expected 1 application after portal submission, found ${appsAfterPortal.length}`);
  }

  // -------------------------------------------------------------------
  // TEST CASE 2: Administrator registers identical pupil via Walk-In
  // -------------------------------------------------------------------
  console.log("\n--- STEP 2: Administrator Registers Same Pupil via Walk-In Intake Desk ---");
  const walkInRes = await recordWalkInApplication({
    schoolId: school.id,
    registrarName: "Admissions Desk Officer",
    academicSessionId: appsAfterPortal[0].academicSessionId,
    programId: testClass,
    firstName: testPupilFirstName,
    lastName: testPupilLastName,
    email: testEmail,
    phoneNumber: testPhone,
    dateOfBirth: testDob,
    gender: "MALE",
    parentName: `Mr. ${testPupilLastName}`,
    parentPhone: testPhone,
    physicalDocsSighted: {
      birthCertificate: true,
      passportPhotograph: true,
      academicResults: true,
      lgaIndigeneCert: false,
    },
    payment: {
      method: "POS_COUNTER",
      amount: 5000,
      posTerminalReference: `POS-${Date.now()}`,
    },
  });

  if (!walkInRes.success) {
    throw new Error(`Walk-in registration failed: ${walkInRes.error}`);
  }

  console.log(`✅ [WALK-IN SUCCESS]: Result:`, {
    applicationId: walkInRes.application?.id,
    applicationNumber: walkInRes.application?.applicationNumber,
    isUpsert: (walkInRes as any).isUpsert,
  });

  // Verify DB count: MUST NOT BE 2! Must be exactly 1!
  const appsAfterWalkIn = await prisma.admissionsApplication.findMany({
    where: {
      schoolId: school.id,
      lastName: testPupilLastName,
    },
    include: {
      feeTransactions: true,
      documents: true,
      auditTrails: true,
    },
  });

  console.log(`\n[DB CHECK 2] Applications count for pupil: ${appsAfterWalkIn.length} (Expected: 1, No duplicates!)`);
  if (appsAfterWalkIn.length !== 1) {
    throw new Error(`🚨 DUPLICATE DETECTED! Expected 1 application record, found ${appsAfterWalkIn.length}`);
  }

  const singleApp = appsAfterWalkIn[0];
  console.log(`✅ [VERIFIED]: Single unified application preserved:`);
  console.log(`   - ID: ${singleApp.id}`);
  console.log(`   - Canonical Application No: ${singleApp.applicationNumber}`);
  console.log(`   - Status: ${singleApp.status} (Expected: SUBMITTED)`);
  console.log(`   - Fee Transactions Count: ${singleApp.feeTransactions.length} (Expected: >= 1 settled)`);
  console.log(`   - Sighted Documents Count: ${singleApp.documents.length} (Expected: >= 3)`);
  console.log(`   - Audit Trails Count: ${singleApp.auditTrails.length}`);

  if (singleApp.feeTransactions.length === 0) {
    throw new Error("Expected fee transaction to be merged into single application record!");
  }

  // -------------------------------------------------------------------
  // TEST CASE 3: Portal resubmission with same pupil details
  // -------------------------------------------------------------------
  console.log("\n--- STEP 3: Portal Resubmission (Parent returns to portal) ---");
  const portalRes2 = await publicSubmitHandler(portalReq);
  const portalData2 = await portalRes2.json();

  const appsAfterPortal2 = await prisma.admissionsApplication.findMany({
    where: {
      schoolId: school.id,
      lastName: testPupilLastName,
    },
  });

  console.log(`[DB CHECK 3] Applications count after return submit: ${appsAfterPortal2.length} (Expected: 1)`);
  if (appsAfterPortal2.length !== 1) {
    throw new Error(`🚨 DUPLICATE SPAWNED on portal return! Found ${appsAfterPortal2.length}`);
  }

  // -------------------------------------------------------------------
  // TEST CASE 4: Walk-in first, portal submission second
  // -------------------------------------------------------------------
  console.log("\n--- STEP 4: Inverse Flow - Walk-In First, Portal Submission Second ---");
  const pupil2FirstName = "Adaeze";
  const pupil2LastName = "Nnaji-" + Date.now();
  const pupil2FullName = `${pupil2FirstName} ${pupil2LastName}`;
  const pupil2Class = "Primary 4";
  const pupil2Dob = "2016-09-20";
  const pupil2Email = `adaeze.${Date.now()}@example.com`;
  const pupil2Phone = "+2348055667788";

  // Admin registers Adaeze at desk
  const walkIn2 = await recordWalkInApplication({
    schoolId: school.id,
    registrarName: "Desk Registrar",
    academicSessionId: "2026/2027",
    programId: pupil2Class,
    firstName: pupil2FirstName,
    lastName: pupil2LastName,
    email: pupil2Email,
    phoneNumber: pupil2Phone,
    dateOfBirth: pupil2Dob,
    gender: "FEMALE",
    parentName: `Mrs. ${pupil2LastName}`,
    parentPhone: pupil2Phone,
    physicalDocsSighted: {
      birthCertificate: true,
      passportPhotograph: true,
      academicResults: true,
      lgaIndigeneCert: true,
    },
    payment: {
      method: "POS_COUNTER",
      amount: 5000,
      posTerminalReference: `POS-${Date.now()}`,
    },
  });

  if (!walkIn2.success) {
    throw new Error(`Inverse flow: Walk-in intake failed: ${walkIn2.error}`);
  }

  const walkIn2AppNo = walkIn2.applicationNumber;
  console.log(`✅ [WALK-IN 2 CREATED]: App No: ${walkIn2AppNo}`);

  // Later, Parent also submits on portal
  const portalReq2: any = {
    json: async () => ({
      schoolDomain: "egede",
      applicantName: pupil2FullName,
      targetGrade: pupil2Class,
      targetClass: pupil2Class,
      dateOfBirth: pupil2Dob,
      studentEmail: pupil2Email,
      studentPhone: pupil2Phone,
      parentName: `Mrs. ${pupil2LastName}`,
      parentContact: pupil2Phone,
      parentEmail: pupil2Email,
      password: "Password123!",
      academicTier: "Primary School",
    }),
    headers: new Headers({
      "content-type": "application/json",
      "x-tenant-id": school.id,
    }),
  };

  const portalResInverse = await publicSubmitHandler(portalReq2);
  const portalDataInverse = await portalResInverse.json();

  if (!portalResInverse.ok || !portalDataInverse.success) {
    throw new Error(`Inverse flow: Portal submit failed: ${JSON.stringify(portalDataInverse)}`);
  }

  const appsAfterInverse = await prisma.admissionsApplication.findMany({
    where: {
      schoolId: school.id,
      lastName: pupil2LastName,
    },
  });

  console.log(`[DB CHECK 4] Applications count for inverse flow pupil: ${appsAfterInverse.length} (Expected: 1)`);
  if (appsAfterInverse.length !== 1) {
    throw new Error(`🚨 DUPLICATE DETECTED IN INVERSE FLOW! Found ${appsAfterInverse.length}`);
  }
  console.log(`✅ [VERIFIED]: Inverse flow correctly merged into single application ${appsAfterInverse[0].applicationNumber}`);

  console.log(`\n=======================================================`);
  console.log("🎉 ALL DUPLICATE PREVENTION TESTS PASSED WITH 100% SUCCESS!");
  console.log("=======================================================\n");

  await prisma.$disconnect();
}

runDuplicatePreventionTest().catch(async (e) => {
  console.error("Test failed with error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
