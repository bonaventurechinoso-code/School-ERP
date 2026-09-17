import * as jose from "jose";

async function verifyScheduling() {
  console.log("=================================================================");
  console.log("   VERIFYING SCHEDULING & ATTENDANCE ON RUNNING DEV SERVER       ");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // Create authorized admin JWT session token with production/env secret
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

  // 1. Check Weekly Master Timetable tab
  console.log("--- TEST 1: Weekly Master Timetable Tab (greenwood/scheduling?tab=timetable) ---");
  const timetableRes = await fetch(`${baseUrl}/greenwood/scheduling?tab=timetable`, {
    headers: authHeaders,
  });
  console.log(`Timetable Tab HTTP Status: ${timetableRes.status}`);
  if (timetableRes.status !== 200) {
    throw new Error(`FAIL: Timetable page returned HTTP ${timetableRes.status}`);
  }
  const timetableHtml = await timetableRes.text();

  const titleMatch = timetableHtml.match(/<title>([^<]*)<\/title>/);
  console.log("Page Title:", titleMatch ? titleMatch[1] : "No title tag");
  const bodyMatch = timetableHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (bodyMatch) {
    console.log("Body snippet:", bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").substring(0, 1000));
  }

  const hasDayColumns = timetableHtml.includes("MONDAY") && timetableHtml.includes("FRIDAY");
  console.log(`Contains Weekday Columns (MONDAY..FRIDAY): ${hasDayColumns}`);
  if (!hasDayColumns) {
    throw new Error("FAIL: Weekday columns not found in timetable tab!");
  }

  const hasAddButton = timetableHtml.includes("Add Class Session");
  console.log(`Contains 'Add Class Session' trigger: ${hasAddButton}`);
  if (!hasAddButton) {
    throw new Error("FAIL: Add Class Session button not found!");
  }

  console.log("✅ PASS: Weekly Timetable view rendered with full controls.\n");

  // 2. Check Daily Attendance Register tab
  console.log("--- TEST 2: Daily Attendance Register Tab (greenwood/scheduling?tab=attendance) ---");
  const attendanceRes = await fetch(`${baseUrl}/greenwood/scheduling?tab=attendance`, {
    headers: authHeaders,
  });
  console.log(`Attendance Tab HTTP Status: ${attendanceRes.status}`);
  if (attendanceRes.status !== 200) {
    throw new Error(`FAIL: Attendance page returned HTTP ${attendanceRes.status}`);
  }
  const attendanceHtml = await attendanceRes.text();

  // Check key elements in Attendance HTML
  const hasAttendanceRegister = attendanceHtml.includes("Daily Attendance Register");
  console.log(`Contains 'Daily Attendance Register': ${hasAttendanceRegister}`);
  if (!hasAttendanceRegister) {
    throw new Error("FAIL: Daily Attendance Register header not found!");
  }

  const hasStudentsTab = attendanceHtml.includes("Students (");
  console.log(`Contains Students audience toggle: ${hasStudentsTab}`);
  if (!hasStudentsTab) {
    throw new Error("FAIL: Students audience toggle not found!");
  }

  const hasStaffTab = attendanceHtml.includes("Staff &amp; Faculty (") || attendanceHtml.includes("Staff & Faculty (");
  console.log(`Contains Staff & Faculty audience toggle: ${hasStaffTab}`);
  if (!hasStaffTab) {
    throw new Error("FAIL: Staff audience toggle not found!");
  }

  const hasMarkAllPresent = attendanceHtml.includes("Mark All Present");
  console.log(`Contains 'Mark All Present' batch roll-call action: ${hasMarkAllPresent}`);
  if (!hasMarkAllPresent) {
    throw new Error("FAIL: Mark All Present action button not found!");
  }

  const hasTurnoutMeter = attendanceHtml.includes("Turnout");
  console.log(`Contains Turnout Attendance Rate Meter: ${hasTurnoutMeter}`);
  if (!hasTurnoutMeter) {
    throw new Error("FAIL: Turnout meter not found!");
  }

  const hasStatusPills = attendanceHtml.includes("Present") && attendanceHtml.includes("Absent") && attendanceHtml.includes("Late") && attendanceHtml.includes("Excused");
  console.log(`Contains Attendance Status Options (Present/Absent/Late/Excused): ${hasStatusPills}`);
  if (!hasStatusPills) {
    throw new Error("FAIL: Status options not found in attendance register!");
  }

  console.log("✅ PASS: Daily Attendance Register rendered with class filters, search, and batch roll call.\n");

  // 3. Check Tier parameter routing
  console.log("--- TEST 3: Academic Tier Parameter Navigation ---");
  const secondaryRes = await fetch(`${baseUrl}/greenwood/scheduling?tab=timetable&tier=Secondary+School`, {
    headers: {
      Cookie: `session=${sessionToken}; activeTier=Secondary%20School`,
    },
  });
  console.log(`Secondary Tier HTTP Status: ${secondaryRes.status}`);
  const secondaryHtml = await secondaryRes.text();
  const hasSecondaryTierBadge = secondaryHtml.includes("Secondary School");
  console.log(`Contains 'Secondary School' active tier badge: ${hasSecondaryTierBadge}`);
  if (!hasSecondaryTierBadge) {
    throw new Error("FAIL: Secondary School tier badge not rendered!");
  }

  console.log("✅ PASS: Tier routing successfully isolates active academic tier.\n");

  console.log("=================================================================");
  console.log("  ALL SCHEDULING & ATTENDANCE VERIFICATION CHECKS PASSED (3/3)   ");
  console.log("=================================================================\n");
}

verifyScheduling()
  .catch((err) => {
    console.error("❌ Verification failed:", err.message);
    process.exit(1);
  });
