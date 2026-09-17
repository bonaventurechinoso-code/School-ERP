import * as jose from "jose";

async function verifyStudentsRoster() {
  console.log("=================================================================");
  console.log("   VERIFYING STUDENT ROSTER & MULTI-TIER PROMOTION VIEW          ");
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
    Cookie: `session=${sessionToken}; activeTier=Primary%20School`,
  };

  // --- TEST 1: Default Primary School Student Roster ---
  console.log("--- TEST 1: Primary School Roster (greenwood/students) ---");
  const rosterRes = await fetch(`${baseUrl}/greenwood/students`, {
    headers: authHeaders,
  });
  console.log(`Students Roster HTTP Status: ${rosterRes.status}`);
  if (rosterRes.status !== 200) {
    throw new Error(`FAIL: Students roster returned HTTP ${rosterRes.status}`);
  }
  const rosterHtml = await rosterRes.text();

  const hasRosterTitle = rosterHtml.includes("Student Roster");
  console.log(`Contains 'Student Roster' title: ${hasRosterTitle}`);
  if (!hasRosterTitle) {
    throw new Error("FAIL: Student Roster title not found!");
  }

  const hasMetrics = rosterHtml.includes("Total Enrolled") && rosterHtml.includes("Alumni");
  console.log(`Contains dynamic metric cards: ${hasMetrics}`);
  if (!hasMetrics) {
    throw new Error("FAIL: Metric cards not found!");
  }

  const hasTierSwitcher = rosterHtml.includes("Academic Tier:") || rosterHtml.includes("Primary School");
  console.log(`Contains Tier Switcher Navigation: ${hasTierSwitcher}`);
  if (!hasTierSwitcher) {
    throw new Error("FAIL: Tier switcher navigation not found!");
  }

  const hasKycAction = rosterHtml.includes("KYC") || rosterHtml.includes("View Profile");
  console.log(`Contains KYC / Profile view actions: ${hasKycAction}`);
  if (!hasKycAction) {
    throw new Error("FAIL: KYC Profile action button not found!");
  }

  console.log("✅ PASS: Primary School Student Roster rendered with full controls.\n");

  // --- TEST 2: Secondary School Tier Navigation ---
  console.log("--- TEST 2: Secondary School Tier (greenwood/students?tier=Secondary+School) ---");
  const secondaryRes = await fetch(`${baseUrl}/greenwood/students?tier=Secondary+School`, {
    headers: {
      Cookie: `session=${sessionToken}; activeTier=Secondary%20School`,
    },
  });
  console.log(`Secondary Tier HTTP Status: ${secondaryRes.status}`);
  if (secondaryRes.status !== 200) {
    throw new Error(`FAIL: Secondary tier returned HTTP ${secondaryRes.status}`);
  }
  const secondaryHtml = await secondaryRes.text();
  const hasSecondaryBadge = secondaryHtml.includes("Secondary School");
  console.log(`Contains 'Secondary School' active tier badge: ${hasSecondaryBadge}`);
  if (!hasSecondaryBadge) {
    throw new Error("FAIL: Secondary School tier badge missing!");
  }

  console.log("✅ PASS: Secondary School tier navigation verified.\n");

  // --- TEST 3: Daycare / Nursery Tier Navigation ---
  console.log("--- TEST 3: Daycare / Nursery Tier (greenwood/students?tier=Daycare+%2F+Nursery) ---");
  const nurseryRes = await fetch(`${baseUrl}/greenwood/students?tier=Daycare+%2F+Nursery`, {
    headers: {
      Cookie: `session=${sessionToken}; activeTier=Daycare%20%2F%20Nursery`,
    },
  });
  console.log(`Nursery Tier HTTP Status: ${nurseryRes.status}`);
  if (nurseryRes.status !== 200) {
    throw new Error(`FAIL: Nursery tier returned HTTP ${nurseryRes.status}`);
  }
  const nurseryHtml = await nurseryRes.text();
  const hasNurseryBadge = nurseryHtml.includes("Daycare") || nurseryHtml.includes("Nursery");
  console.log(`Contains Daycare / Nursery tier badge: ${hasNurseryBadge}`);
  if (!hasNurseryBadge) {
    throw new Error("FAIL: Daycare / Nursery tier badge missing!");
  }

  console.log("✅ PASS: Daycare / Nursery tier navigation verified.\n");

  console.log("=================================================================");
  console.log("  ALL STUDENT ROSTER HTTP CHECKS PASSED (3/3)                     ");
  console.log("=================================================================\n");
}

verifyStudentsRoster()
  .catch((err) => {
    console.error("❌ Verification failed:", err.message);
    process.exit(1);
  });
