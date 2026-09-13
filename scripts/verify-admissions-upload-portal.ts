import { basePrisma, getPrismaClientForTier } from "../src/lib/tenant-prisma";
import { sendInquiryAcknowledgmentEmail } from "../src/lib/email-service";
import { POST, GET } from "../src/app/api/v1/admissions/upload/[applicantId]/route";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

async function runUploadPortalVerification() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING ADMISSIONS SECURE FILE UPLOAD & CREDENTIAL PORTAL VERIFICATION");
  console.log("================================================================================\n");

  try {
    // 1. Setup / Resolve Tenant
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: "udoka" },
          { name: { contains: "Udoka", mode: "insensitive" } },
        ],
      },
      include: { academicTiers: true },
    });

    if (!school) {
      throw new Error("❌ Test school tenant not found. Please ensure seed data exists.");
    }

    const tier = school.academicTiers[0] || await basePrisma.academicTier.findFirst({ where: { schoolId: school.id } });
    if (!tier) {
      throw new Error("❌ Academic tier not found for school.");
    }

    console.log(`[SETUP] School Tenant: "${school.name}" (${school.subdomain})`);
    console.log(`[SETUP] Academic Tier: "${tier.name}" (${tier.id})`);

    // 2. Create a fresh test applicant lead
    const testLead = await basePrisma.admissionLead.create({
      data: {
        schoolId: school.id,
        tierId: tier.id,
        applicantName: "Somtochukwu Obi",
        parentName: "Chief Dan Obi",
        parentEmail: "dan.obi@example.com",
        parentContact: "+234 802 333 4444",
        targetGrade: "Primary 4",
        status: "INQUIRY",
      },
    });

    console.log(`[SETUP] Created test applicant lead: "${testLead.applicantName}" (ID: ${testLead.id})`);

    // -------------------------------------------------------------------------
    // TEST 1: EMAIL TEMPLATE CTA LINK & TOKEN INTEGRATION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: EMAIL TEMPLATE TOKEN & UPLOAD CTA INTEGRATION ---");
    const emailResult = await sendInquiryAcknowledgmentEmail({
      lead: testLead,
      school,
      schoolId: school.id,
    });

    if (!emailResult || !emailResult.emailHtml) {
      throw new Error("❌ sendInquiryAcknowledgmentEmail returned null.");
    }

    // Check for "Upload Required Credentials" button
    if (!emailResult.emailHtml.includes("Upload Required Credentials")) {
      throw new Error("❌ Email template is missing 'Upload Required Credentials' CTA button.");
    }
    console.log("✅ Passed: 'Upload Required Credentials' high-visibility CTA button verified in email.");

    // Check for secure token URL structure
    const expectedUrlPrefix = `admissions/upload/${testLead.id}?token=`;
    if (!emailResult.emailHtml.includes(expectedUrlPrefix)) {
      throw new Error(`❌ Email template does not contain expected secure upload URL prefix: "${expectedUrlPrefix}"`);
    }
    console.log("✅ Passed: Cryptographic upload token link dynamically embedded into email.");

    // Re-fetch lead to verify uploadToken was persisted to database
    const refreshedLead = await basePrisma.admissionLead.findUnique({
      where: { id: testLead.id },
    });
    const token = (refreshedLead as any).uploadToken;
    if (!token) {
      throw new Error("❌ uploadToken was not saved to database on AdmissionLead.");
    }
    console.log(`✅ Passed: Unique secure token persisted to DB: ${token}`);

    // -------------------------------------------------------------------------
    // TEST 2: GET ENDPOINT VALIDATION (TOKEN AUTHORIZATION)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: GET PORTAL DATA & TOKEN SECURITY CHECK ---");
    // Invalid token request
    const invalidGetReq = new NextRequest(`http://localhost:3000/api/v1/admissions/upload/${testLead.id}?token=invalid-token`);
    const invalidGetRes = await GET(invalidGetReq, { params: Promise.resolve({ applicantId: testLead.id }) });
    if (invalidGetRes.status !== 403) {
      throw new Error(`❌ Expected status 403 for invalid token, got ${invalidGetRes.status}`);
    }
    console.log("✅ Passed: Invalid token correctly rejected with 403 Forbidden.");

    // Valid token request
    const validGetReq = new NextRequest(`http://localhost:3000/api/v1/admissions/upload/${testLead.id}?token=${token}`);
    const validGetRes = await GET(validGetReq, { params: Promise.resolve({ applicantId: testLead.id }) });
    if (validGetRes.status !== 200) {
      throw new Error(`❌ Expected status 200 for valid token, got ${validGetRes.status}`);
    }
    const validGetData = await validGetRes.json();
    if (!validGetData.success || validGetData.applicant?.applicantName !== "Somtochukwu Obi") {
      throw new Error("❌ GET response did not return correct applicant data.");
    }
    console.log("✅ Passed: Valid token authorized successfully and returned applicant context.");

    // -------------------------------------------------------------------------
    // TEST 3: MULTIPART FILE UPLOAD (4 DOCUMENTS)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: MULTIPART FILE UPLOAD & BACKEND STORAGE ---");
    const formData = new FormData();
    formData.append("token", token);

    // Mock Passport Photo (Image file)
    const passportBlob = new Blob([Buffer.from("fake-passport-image-binary-data")], { type: "image/jpeg" });
    formData.append("passportPhoto", passportBlob, "somto-passport.jpg");

    // Mock Academic Results (PDF file)
    const resultsBlob = new Blob([Buffer.from("%PDF-1.4 simulated previous term report card")], { type: "application/pdf" });
    formData.append("academicResults", resultsBlob, "termly-report-cards.pdf");

    // Mock Birth Certificate (PDF file)
    const birthBlob = new Blob([Buffer.from("%PDF-1.4 simulated official birth certificate")], { type: "application/pdf" });
    formData.append("birthCertificate", birthBlob, "birth-certificate.pdf");

    // Mock Medical Records (PDF file)
    const medicalBlob = new Blob([Buffer.from("%PDF-1.4 simulated immunization card and allergies")], { type: "application/pdf" });
    formData.append("medicalRecords", medicalBlob, "immunization-history.pdf");

    const uploadReq = new NextRequest(`http://localhost:3000/api/v1/admissions/upload/${testLead.id}`, {
      method: "POST",
      body: formData,
    });

    const uploadRes = await POST(uploadReq, { params: Promise.resolve({ applicantId: testLead.id }) });
    if (uploadRes.status !== 200) {
      const errJson = await uploadRes.json();
      throw new Error(`❌ POST upload failed with status ${uploadRes.status}: ${JSON.stringify(errJson)}`);
    }

    const uploadData = await uploadRes.json();
    console.log(`✅ Passed: Upload endpoint returned 200 OK (${uploadData.uploadedCount} files processed).`);

    // Verify files on disk
    const targetDir = path.join(process.cwd(), "public", "uploads", "admissions", school.id, testLead.id);
    if (!fs.existsSync(targetDir)) {
      throw new Error(`❌ Target upload directory does not exist: ${targetDir}`);
    }

    const savedFiles = fs.readdirSync(targetDir);
    console.log(`[STORAGE] Files saved to disk in ${targetDir}:`, savedFiles);

    if (savedFiles.length < 4) {
      throw new Error(`❌ Expected 4 files on disk, found ${savedFiles.length}`);
    }
    console.log("✅ Passed: All 4 credential files verified safely in local storage repository.");

    // -------------------------------------------------------------------------
    // TEST 4: DATABASE & ISOLATED TIER PARITY CHECK
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: DATABASE FIELDS & TIER SYNCHRONIZATION ---");
    const updatedLead = await basePrisma.admissionLead.findUnique({
      where: { id: testLead.id },
    });
    const updatedAny = updatedLead as any;

    if (!updatedAny.passportPhotoUrl || !updatedAny.academicResultsUrl || !updatedAny.birthCertificateUrl || !updatedAny.medicalRecordsUrl) {
      throw new Error("❌ One or more document URL fields on AdmissionLead are null.");
    }
    console.log(`✅ Passed: passportPhotoUrl verified: ${updatedAny.passportPhotoUrl}`);
    console.log(`✅ Passed: academicResultsUrl verified: ${updatedAny.academicResultsUrl}`);
    console.log(`✅ Passed: birthCertificateUrl verified: ${updatedAny.birthCertificateUrl}`);
    console.log(`✅ Passed: medicalRecordsUrl verified: ${updatedAny.medicalRecordsUrl}`);

    if (!updatedAny.documents || Object.keys(updatedAny.documents).length < 4) {
      throw new Error("❌ documents JSON metadata missing or incomplete.");
    }
    console.log("✅ Passed: documents JSON metadata contains full audit details for all credentials.");

    // -------------------------------------------------------------------------
    // TEST 5: FILE SIZE LIMIT ENFORCEMENT (5MB)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: 5MB FILE SIZE LIMIT VALIDATION ---");
    const oversizedFormData = new FormData();
    oversizedFormData.append("token", token);
    // Create an oversized blob > 5MB (5.5 MB)
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    const oversizedBlob = new Blob([largeBuffer], { type: "application/pdf" });
    oversizedFormData.append("academicResults", oversizedBlob, "huge-results.pdf");

    const oversizedReq = new NextRequest(`http://localhost:3000/api/v1/admissions/upload/${testLead.id}`, {
      method: "POST",
      body: oversizedFormData,
    });

    const oversizedRes = await POST(oversizedReq, { params: Promise.resolve({ applicantId: testLead.id }) });
    if (oversizedRes.status !== 400) {
      throw new Error(`❌ Expected status 400 for oversized file, got ${oversizedRes.status}`);
    }
    const oversizedJson = await oversizedRes.json();
    console.log(`✅ Passed: Oversized file rejected properly with message: "${oversizedJson.error}"`);

    console.log("\n================================================================================");
    console.log("🎉 ALL ADMISSIONS FILE UPLOAD & CREDENTIAL PORTAL TESTS PASSED!");
    console.log("================================================================================\n");
  } catch (error: any) {
    console.error("\n❌ VERIFICATION TEST FAILED:", error);
    process.exit(1);
  } finally {
    await basePrisma.$disconnect();
  }
}

runUploadPortalVerification();
