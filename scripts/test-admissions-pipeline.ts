import { PrismaClient } from "@prisma/client";
import * as jose from "jose";

const prisma = new PrismaClient();

async function runEndToEndAdmissionsTest() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING LIVE ADMISSIONS PIPELINE END-TO-END TEST");
  console.log("=======================================================\n");

  // Step 0: Identify test tenant (Egede Primary School)
  const school = await prisma.school.findFirst({
    where: { subdomain: "egede" },
    include: { academicTiers: true },
  });

  if (!school) {
    throw new Error("Target tenant 'egede' not found in database!");
  }

  console.log(`[PASS 0] Tenant identified: ${school.name} (ID: ${school.id}, Subdomain: ${school.subdomain})`);

  // Step 1: Simulate public application submission
  console.log("\n--- STAGE 1: Public Bio-Data Inquiry & Application Submission ---");
  const testEmail = `test.applicant.${Date.now()}@example.com`;
  const applicantName = "Emeka Okafor Test";
  const parentContact = "+2348011223344";
  const targetGrade = "Primary 3";

  // Import public-submit POST handler directly
  const { POST: publicSubmitHandler } = await import(
    "@/app/api/v1/admissions/public-submit/route"
  );

  const submitPayload = {
    schoolDomain: "egede",
    applicantName,
    studentEmail: testEmail,
    studentPhone: parentContact,
    parentName: "Chief Okafor",
    parentContact,
    parentEmail: testEmail,
    targetGrade,
    targetClass: targetGrade,
    academicTier: "Primary School",
    password: "Password123!",
  };

  const fakeSubmitRequest: any = {
    json: async () => submitPayload,
    headers: new Headers({
      "content-type": "application/json",
      "x-tenant-id": school.id,
    }),
  };

  const submitRes = await publicSubmitHandler(fakeSubmitRequest);
  const submitData = await submitRes.json();

  if (!submitRes.ok || !submitData.success) {
    throw new Error(`Public submission failed: ${JSON.stringify(submitData)}`);
  }

  const appNo = submitData.applicationNo;
  const leadId = submitData.lead?.id;
  const uploadToken = submitData.uploadToken;
  const sessionToken = submitData.sessionToken;

  console.log(`✅ [STAGE 1 SUCCESS]:`);
  console.log(`   - Application No: ${appNo}`);
  console.log(`   - Lead ID: ${leadId}`);
  console.log(`   - Upload Token: ${uploadToken}`);
  console.log(`   - Session Token Generated: ${Boolean(sessionToken)}`);

  // Verify DB state for Stage 1
  const leadInDb = await prisma.admissionLead.findUnique({ where: { id: leadId } });
  if (!leadInDb) throw new Error("AdmissionLead not found in DB!");

  const registerInDb = await prisma.admissionRegister.findFirst({
    where: { tenantId: school.id, applicationNo: appNo },
  });
  if (!registerInDb) throw new Error("AdmissionRegister not found in DB!");

  const appInDb = await prisma.admissionsApplication.findFirst({
    where: { schoolId: school.id, applicationNumber: appNo },
  });
  if (!appInDb) throw new Error("AdmissionsApplication NOT FOUND in DB! Pipeline disconnect!");

  console.log(`✅ [DB VERIFIED]: AdmissionsApplication successfully created with status: ${appInDb.status}`);

  // Step 2: Simulate uploading application fee receipt
  console.log("\n--- STAGE 2: Applicant Uploads Fee Receipt ---");
  const { POST: uploadHandler } = await import(
    "@/app/api/v1/admissions/upload/[applicantId]/route"
  );

  // Create fake FormData for fee receipt upload
  const fakePdfBuffer = Buffer.from("%PDF-1.4 test receipt buffer for admissions", "utf-8");
  const receiptFile = new File([fakePdfBuffer], "fee_receipt.pdf", { type: "application/pdf" });

  const receiptFormData = new FormData();
  receiptFormData.append("token", uploadToken);
  receiptFormData.append("applicantId", leadId);
  receiptFormData.append("applicationFeeReceipt", receiptFile);
  receiptFormData.append("receipt", receiptFile);
  receiptFormData.append("depositorName", "Chief Okafor");
  receiptFormData.append("transferReference", `TRX-${Date.now().toString().slice(-6)}`);

  const uploadReceiptRequest: any = {
    formData: async () => receiptFormData,
    headers: new Headers({
      "x-applicant-token": uploadToken,
      "x-upload-token": uploadToken,
      "x-tenant-id": school.id,
      "authorization": `Bearer ${sessionToken}`,
    }),
    cookies: {
      get: (name: string) => (name === "session" || name === "accessToken" ? { value: sessionToken } : undefined),
    },
    nextUrl: new URL(`http://localhost:3000/api/v1/admissions/upload/${leadId}?token=${uploadToken}`),
  };

  const uploadReceiptRes = await uploadHandler(uploadReceiptRequest, {
    params: Promise.resolve({ applicantId: leadId }),
  });
  const uploadReceiptData = await uploadReceiptRes.json();

  if (!uploadReceiptRes.ok || !uploadReceiptData.success) {
    throw new Error(`Receipt upload failed: ${JSON.stringify(uploadReceiptData)}`);
  }

  console.log(`✅ [STAGE 2 SUCCESS]: Fee receipt uploaded successfully.`);
  console.log(`   - Receipt URL: ${uploadReceiptData.receiptUrl}`);
  console.log(`   - Fee Status: ${uploadReceiptData.status}`);

  // Verify fee transaction in DB
  const feeTx = await prisma.admissionsFeeTransaction.findFirst({
    where: { applicationId: appInDb.id },
  });
  if (!feeTx) throw new Error("AdmissionsFeeTransaction not created on AdmissionsApplication!");
  console.log(`✅ [DB VERIFIED]: AdmissionsFeeTransaction created with status: ${feeTx.paymentStatus}`);

  // Step 3: Simulate uploading secondary documents (without logout)
  console.log("\n--- STAGE 3: Applicant Uploads Passport Photo & Birth Certificate ---");
  const passportBuffer = Buffer.from("fake-jpg-content", "utf-8");
  const passportFile = new File([passportBuffer], "passport.jpg", { type: "image/jpeg" });

  const birthCertBuffer = Buffer.from("fake-pdf-birth-cert", "utf-8");
  const birthCertFile = new File([birthCertBuffer], "birth_certificate.pdf", { type: "application/pdf" });

  const docsFormData = new FormData();
  docsFormData.append("token", uploadToken);
  docsFormData.append("applicantId", leadId);
  docsFormData.append("passportPhoto", passportFile);
  docsFormData.append("birthCertificate", birthCertFile);

  const uploadDocsRequest: any = {
    formData: async () => docsFormData,
    headers: new Headers({
      "x-applicant-token": uploadToken,
      "x-upload-token": uploadToken,
      "x-tenant-id": school.id,
      "authorization": `Bearer ${sessionToken}`,
    }),
    cookies: {
      get: (name: string) => (name === "session" || name === "accessToken" ? { value: sessionToken } : undefined),
    },
    nextUrl: new URL(`http://localhost:3000/api/v1/admissions/upload/${leadId}?token=${uploadToken}`),
  };

  const uploadDocsRes = await uploadHandler(uploadDocsRequest, {
    params: Promise.resolve({ applicantId: leadId }),
  });
  const uploadDocsData = await uploadDocsRes.json();

  if (!uploadDocsRes.ok || !uploadDocsData.success) {
    throw new Error(`Secondary docs upload failed: ${JSON.stringify(uploadDocsData)}`);
  }

  console.log(`✅ [STAGE 3 SUCCESS]: Secondary documents uploaded without any forced logout!`);

  // Verify documents in DB
  const uploadedDocs = await prisma.admissionsDocument.findMany({
    where: { applicationId: appInDb.id },
  });
  console.log(`✅ [DB VERIFIED]: AdmissionsDocuments count on application: ${uploadedDocs.length}`);
  if (uploadedDocs.length < 2) throw new Error("Expected at least 2 AdmissionsDocuments!");

  const updatedAppInDb = await prisma.admissionsApplication.findUnique({
    where: { id: appInDb.id },
  });
  console.log(`✅ [DB VERIFIED]: AdmissionsApplication status updated to: ${updatedAppInDb?.status}`);

  // Step 4: Admin Admissions Workspace Lifecycle Processing
  console.log("\n--- STAGE 4: Admin Workspace Review, Approval & Enrollment ---");

  // 4a. Admin reconciles/approves application fee
  console.log("   [4a] Admin approves fee transaction...");
  const { approveAdmissionsFeeTransaction, updateApplicationStageAction, enrollAdmissionsApplicationAction } = await import(
    "@/app/[schoolDomain]/(admin)/admissions/actions"
  );

  const feeApproveResult = await approveAdmissionsFeeTransaction({
    transactionId: feeTx.id,
    schoolId: school.id,
    notes: "Verified bank transfer slip against corporate bank statement",
    actorId: "test-admin",
  });
  if (!feeApproveResult.success) {
    throw new Error(`Fee approval failed: ${feeApproveResult.error}`);
  }
  console.log("   ✅ Fee approved successfully!");

  // 4b. Admin advances stage to OFFER_EXTENDED
  console.log("   [4b] Admin issues provisional offer (Stage -> OFFER_EXTENDED)...");
  const stageResult = await updateApplicationStageAction({
    applicationId: appInDb.id,
    newStage: "OFFER_EXTENDED",
    schoolId: school.id,
    schoolDomain: "egede",
    notes: "Candidate meets all entrance requirements",
    actorId: "test-admin",
  });
  if (!stageResult.success) {
    throw new Error(`Stage advance failed: ${stageResult.error}`);
  }
  console.log("   ✅ Application stage advanced to OFFER_EXTENDED!");

  // 4c. Admin enrolls candidate into school (ENROLLED)
  console.log("   [4c] Admin matriculates / enrolls candidate into school...");
  const enrollResult = await enrollAdmissionsApplicationAction({
    applicationId: appInDb.id,
    schoolId: school.id,
    schoolDomain: "egede",
    actorId: "test-admin",
  });
  if (!enrollResult.success) {
    throw new Error(`Enrollment failed: ${enrollResult.error}`);
  }
  console.log("   ✅ Candidate matriculated successfully!");
  console.log(`      - Admission No: ${enrollResult.admissionNumber}`);
  console.log(`      - Student ID: ${enrollResult.student?.id}`);

  // Step 5: Final verification of Student record
  const student = await prisma.student.findFirst({
    where: {
      schoolId: school.id,
      OR: [
        { email: testEmail },
        { admissionNumber: enrollResult.admissionNumber },
      ],
    },
  });

  if (!student) {
    throw new Error("Final student record not found in Student table!");
  }

  const finalApp = await prisma.admissionsApplication.findUnique({
    where: { id: appInDb.id },
  });

  console.log("\n=======================================================");
  console.log("🎉 ALL ADMISSIONS PIPELINE STAGES PASSED WITH 100% SUCCESS!");
  console.log(`   - Candidate Name: ${student.firstName} ${student.lastName}`);
  console.log(`   - Enrolled Class: ${student.currentClass}`);
  console.log(`   - Final Application Status: ${finalApp?.status}`);
  console.log(`   - Final Student Status: ${student.status}`);
  console.log("=======================================================\n");
}

runEndToEndAdmissionsTest()
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
