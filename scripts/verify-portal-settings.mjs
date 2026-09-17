import * as jose from "jose";

async function verifyPortalSettings() {
  console.log("=================================================================");
  console.log("   VERIFYING PUBLIC PORTAL SETTINGS & LANDING GATEWAY            ");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // Create authorized admin JWT session token with production secret
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

  // --- TEST 1: Admin Portal Settings Page ---
  console.log("--- TEST 1: Admin Portal Settings (greenwood/portal-settings) ---");
  const settingsRes = await fetch(`${baseUrl}/greenwood/portal-settings`, {
    headers: authHeaders,
  });
  console.log(`Portal Settings HTTP Status: ${settingsRes.status}`);
  if (settingsRes.status !== 200) {
    throw new Error(`FAIL: Portal Settings returned HTTP ${settingsRes.status}`);
  }
  const settingsHtml = await settingsRes.text();

  const hasPortalTitle = settingsHtml.includes("Public Portal Settings");
  console.log(`Contains 'Public Portal Settings' title: ${hasPortalTitle}`);
  if (!hasPortalTitle) {
    throw new Error("FAIL: Public Portal Settings title not found!");
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

  // Check Form controls & Live Preview
  const hasHelplineInput = settingsHtml.includes("Admissions Helpline");
  const hasLivePreview = settingsHtml.includes("Interactive Public Header Preview");
  const hasTiersInPreview = settingsHtml.includes("Primary School") || settingsHtml.includes("Secondary School");

  console.log(`Contains 'Admissions Helpline' input: ${hasHelplineInput}`);
  console.log(`Contains 'Interactive Public Header Preview': ${hasLivePreview}`);
  console.log(`Contains Academic Tiers in Preview: ${hasTiersInPreview}`);

  if (!hasHelplineInput || !hasLivePreview) {
    throw new Error("FAIL: Essential settings controls or live preview not found!");
  }

  console.log("✅ PASS: Admin Portal Settings rendered with 4 gateways and live preview.\n");

  // --- TEST 2: Public Tenant Landing Page ---
  console.log("--- TEST 2: Public Tenant Landing Page (greenwood) ---");
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

  // Verify dynamic tier curriculum cards
  const hasNurseryTier = landingHtml.includes("Daycare") || landingHtml.includes("Nursery") || landingHtml.includes("Early");
  const hasPrimaryTier = landingHtml.includes("Primary");
  const hasSecondaryTier = landingHtml.includes("Secondary");

  console.log(`Renders Daycare/Nursery Curriculum Card: ${hasNurseryTier}`);
  console.log(`Renders Primary Curriculum Card: ${hasPrimaryTier}`);
  console.log(`Renders Secondary Curriculum Card: ${hasSecondaryTier}`);

  if (!hasPrimaryTier || !hasSecondaryTier) {
    throw new Error("FAIL: Academic tier curriculum cards not rendered properly!");
  }

  // Verify direct gateway links
  const hasStudentWorkspaceLink = landingHtml.includes("/greenwood/portal/student");
  const hasStaffLoginLink = landingHtml.includes("/greenwood/login");
  const hasApplyLink = landingHtml.includes("/greenwood/apply");

  console.log(`Contains Link to Student Workspace (/greenwood/portal/student): ${hasStudentWorkspaceLink}`);
  console.log(`Contains Link to Staff Login (/greenwood/login): ${hasStaffLoginLink}`);
  console.log(`Contains Link to Apply Online (/greenwood/apply): ${hasApplyLink}`);

  if (!hasStudentWorkspaceLink || !hasStaffLoginLink || !hasApplyLink) {
    throw new Error("FAIL: Direct gateway links missing on public landing page!");
  }

  console.log("✅ PASS: Public Tenant Landing Page rendered with dynamic tiers, helpline, and gateways.\n");

  // --- TEST 3: Public Online Application Gateway ---
  console.log("--- TEST 3: Online Application Gateway (greenwood/apply) ---");
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
  console.log("  ALL PUBLIC PORTAL SETTINGS & LANDING CHECKS PASSED (3/3)        ");
  console.log("=================================================================\n");
}

verifyPortalSettings()
  .catch((err) => {
    console.error("❌ Verification failed:", err.message);
    process.exit(1);
  });
