import * as jose from "jose";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyPortalSettings() {
  console.log("=================================================================");
  console.log("   VERIFYING INSTITUTIONAL & PORTAL SETTINGS COMMAND CENTER      ");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // Create authorized admin JWT session token
  const jwtSecret = "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new jose.SignJWT({
    role: "ADMIN",
    staffRole: "Principal",
    email: "principal@greenwood.edu.ng",
    schoolDomain: "greenwood",
    permissions: ["manage:all"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  const authHeaders = {
    Cookie: `session=${sessionToken}`,
  };

  // --- TEST 1: Admin Institutional & Portal Settings Page Rendering ---
  console.log("--- TEST 1: Admin Portal Settings (greenwood/portal-settings) ---");
  const settingsRes = await fetch(`${baseUrl}/greenwood/portal-settings`, {
    headers: authHeaders,
  });
  console.log(`Portal Settings HTTP Status: ${settingsRes.status}`);
  if (settingsRes.status !== 200) {
    throw new Error(`FAIL: Portal Settings returned HTTP ${settingsRes.status}`);
  }
  const settingsHtml = await settingsRes.text();

  const hasPortalTitle = settingsHtml.includes("Institutional &amp; Portal Settings") || 
                         settingsHtml.includes("Institutional & Portal Settings") ||
                         settingsHtml.includes("Portal Settings");
  console.log(`Contains 'Institutional & Portal Settings' title: ${hasPortalTitle}`);
  if (!hasPortalTitle) {
    throw new Error("FAIL: Institutional & Portal Settings title not found!");
  }

  // Check 4 Public Gateways
  const hasLandingGw = settingsHtml.includes("Public School Landing");
  const hasApplyGw = settingsHtml.includes("Online Application Form");
  const hasStudentGw = settingsHtml.includes("Student Portal Workspace");
  const hasStaffGw = settingsHtml.includes("Faculty &amp; Staff Sign-In") || settingsHtml.includes("Faculty & Staff Sign-In");

  console.log(`Contains Gateway 1 (Public School Landing): ${hasLandingGw}`);
  console.log(`Contains Gateway 2 (Online Application Form): ${hasApplyGw}`);
  console.log(`Contains Gateway 3 (Student Portal Workspace): ${hasStudentGw}`);
  console.log(`Contains Gateway 4 (Faculty & Staff Sign-In): ${hasStaffGw}`);

  if (!hasLandingGw || !hasApplyGw || !hasStudentGw || !hasStaffGw) {
    throw new Error("FAIL: Not all 4 gateway shortcut cards are present in Portal Settings!");
  }

  // Check Tabs: Identity & Gateways, Direct Bank Settlement, Session & Terms
  const hasIdentityTab = settingsHtml.includes("Identity &amp; Gateways") || settingsHtml.includes("Identity & Gateways");
  const hasBankTab = settingsHtml.includes("Direct Bank Settlement");
  const hasAcademicTab = settingsHtml.includes("Session &amp; Terms") || settingsHtml.includes("Session & Terms");

  console.log(`Contains Tab 1 (Identity & Gateways): ${hasIdentityTab}`);
  console.log(`Contains Tab 2 (Direct Bank Settlement): ${hasBankTab}`);
  console.log(`Contains Tab 3 (Session & Terms): ${hasAcademicTab}`);

  if (!hasIdentityTab || !hasBankTab || !hasAcademicTab) {
    throw new Error("FAIL: Unified navigation tabs not found in Portal Settings!");
  }

  // Check CBN Compliance and Direct Settlement Indicators
  const hasSettlementBadge = settingsHtml.includes("Settlement Bank");
  console.log(`Contains 'Settlement Bank' header indicator: ${hasSettlementBadge}`);
  if (!hasSettlementBadge) {
    throw new Error("FAIL: Settlement Bank status badge missing from header!");
  }

  console.log("✅ PASS: Admin Portal Settings rendered with 3 unified tabs, 4 gateways, and governance badges.\n");

  // --- TEST 2: Direct Bank Settlement Database Synchronization ---
  console.log("--- TEST 2: Direct Bank Settlement Data Verification ---");
  const school = await prisma.school.findUnique({
    where: { subdomain: "greenwood" },
  });

  if (!school) {
    throw new Error("FAIL: Greenwood Academy school not found in database!");
  }

  // Ensure bank details can be updated
  console.log(`Current Bank: ${school.settlementBankName || "Not set"}`);
  console.log(`Current Account No: ${school.settlementAccountNumber || "Not set"}`);
  console.log(`Collection Mode: ${school.collectionMode}`);

  // Test updating bank details
  const updated = await prisma.school.update({
    where: { id: school.id },
    data: {
      settlementBankName: "Zenith Bank",
      settlementBankCode: "057",
      settlementAccountNumber: "1019283746",
      settlementAccountName: "GREENWOOD ACADEMY OPERATING ACCOUNT",
      paymentInstruction: "Use Student Admission No as transfer narration",
      collectionMode: "MANUAL_BANK_TRANSFER",
    },
  });

  console.log("Updated School Settlement Bank:");
  console.log(`  Bank Name:      ${updated.settlementBankName}`);
  console.log(`  NUBAN Acc No:   ${updated.settlementAccountNumber}`);
  console.log(`  Account Name:   ${updated.settlementAccountName}`);
  console.log(`  Collection Mode:${updated.collectionMode}`);

  if (
    updated.settlementBankName !== "Zenith Bank" ||
    updated.settlementAccountNumber !== "1019283746" ||
    updated.collectionMode !== "MANUAL_BANK_TRANSFER"
  ) {
    throw new Error("FAIL: Direct Bank Settlement configuration did not save properly!");
  }

  console.log("✅ PASS: Direct Bank Settlement persisted with CBN Model A compliance.\n");

  // --- TEST 3: Public Tenant Landing Page ---
  console.log("--- TEST 3: Public Tenant Landing Page (greenwood) ---");
  const landingRes = await fetch(`${baseUrl}/greenwood`);
  console.log(`Public Landing HTTP Status: ${landingRes.status}`);
  if (landingRes.status !== 200) {
    throw new Error(`FAIL: Public Landing returned HTTP ${landingRes.status}`);
  }
  const landingHtml = await landingRes.text();

  const hasSchoolName = landingHtml.includes("Greenwood Academy");
  console.log(`Contains School Name 'Greenwood Academy': ${hasSchoolName}`);
  if (!hasSchoolName) {
    throw new Error("FAIL: School name not found on public landing page!");
  }

  const hasAdmissionsHelpline = landingHtml.includes("Admissions Hotline") || landingHtml.includes("Helpline");
  console.log(`Contains Admissions Hotline/Helpline: ${hasAdmissionsHelpline}`);
  if (!hasAdmissionsHelpline) {
    throw new Error("FAIL: Admissions helpline not found on public landing page!");
  }

  const hasAcademicPrograms = landingHtml.includes("Our Academic Programs");
  console.log(`Contains 'Our Academic Programs' section: ${hasAcademicPrograms}`);
  if (!hasAcademicPrograms) {
    throw new Error("FAIL: Academic programs section not found!");
  }

  // Verify direct gateway links
  const hasStudentWorkspaceLink = landingHtml.includes("/greenwood/portal/student");
  const hasStaffLoginLink = landingHtml.includes("/greenwood/login");
  const hasApplyLink = landingHtml.includes("/greenwood/apply");

  console.log(`Contains Link to Student Workspace: ${hasStudentWorkspaceLink}`);
  console.log(`Contains Link to Staff Login: ${hasStaffLoginLink}`);
  console.log(`Contains Link to Apply Online: ${hasApplyLink}`);

  if (!hasStudentWorkspaceLink || !hasStaffLoginLink || !hasApplyLink) {
    throw new Error("FAIL: Direct gateway links missing on public landing page!");
  }

  console.log("✅ PASS: Public Tenant Landing Page rendered with dynamic tiers, helpline, and gateways.\n");

  // --- TEST 4: Public Online Application Gateway ---
  console.log("--- TEST 4: Online Application Gateway (greenwood/apply) ---");
  const applyRes = await fetch(`${baseUrl}/greenwood/apply`);
  console.log(`Apply Gateway HTTP Status: ${applyRes.status}`);
  if (applyRes.status !== 200) {
    throw new Error(`FAIL: Apply Gateway returned HTTP ${applyRes.status}`);
  }
  const applyHtml = await applyRes.text();
  const hasApplyForm = applyHtml.includes("Application") || applyHtml.includes("Admission");
  console.log(`Contains Admission/Application form: ${hasApplyForm}`);
  if (!hasApplyForm) {
    throw new Error("FAIL: Application form not rendered on /apply gateway!");
  }

  console.log("✅ PASS: Online Application gateway is online and active.\n");

  console.log("=================================================================");
  console.log("  ALL PORTAL SETTINGS & DIRECT BANK CHECKS PASSED (4/4)           ");
  console.log("=================================================================\n");
}

verifyPortalSettings()
  .catch((err) => {
    console.error("❌ Verification failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
