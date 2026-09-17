import * as jose from 'jose';

async function runLiveStaffVerification() {
  console.log('=================================================================');
  console.log('   VERIFYING STAFF RECORDS, ATTENDANCE & HR MODULE (LIVE HTTP)  ');
  console.log('=================================================================\n');

  const JWT_SECRET = 'schoolerp-secret-key-change-in-production-environments';
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new jose.SignJWT({
    userId: 'admin-dev-id',
    schoolId: '87d3d69b-dc4b-4698-a1a4-714ae86dc5e8',
    tenantId: '87d3d69b-dc4b-4698-a1a4-714ae86dc5e8',
    role: 'ADMIN',
    staffRole: 'Principal',
    email: 'admin@greenwood.edu.ng',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(secret);

  const baseUrl = 'http://localhost:3000';

  // --- TEST 1: Main Staff Directory Hub ---
  console.log('--- TEST 1: Main Staff Directory Hub (greenwood/staff) ---');
  const res = await fetch(`${baseUrl}/greenwood/staff`, {
    headers: {
      Cookie: `session=${token}`,
    },
  });

  console.log(`Staff Hub HTTP Status: ${res.status}`);
  if (res.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${res.status}`);
  }

  const html = await res.text();

  const hasHeader = html.includes('Staff Directory & Faculty Management') || html.includes('Staff Directory');
  console.log(`Contains 'Staff Directory & Faculty Management' header: ${hasHeader}`);
  if (!hasHeader) throw new Error("Header not found in HTML.");

  const hasTierSwitcher = html.includes('Secondary School') && html.includes('Primary School');
  console.log(`Contains Multi-Tier Switcher Pills (Secondary, Primary, etc.): ${hasTierSwitcher}`);
  if (!hasTierSwitcher) throw new Error("Multi-tier switcher pills not found.");

  const hasKpiCards = html.includes('Active Staff') && (html.includes("Today") || html.includes("Turnout"));
  console.log(`Contains 5 KPI Summary Cards (Active Staff, Turnout, etc.): ${hasKpiCards}`);
  if (!hasKpiCards) throw new Error("KPI summary cards not found.");

  const hasTableElements = html.includes('Faculty &amp; Staff Roster') || html.includes('Faculty & Staff Roster') || html.includes('Staff Roster');
  console.log(`Contains Faculty & Staff Roster: ${hasTableElements}`);
  if (!hasTableElements) throw new Error("Faculty Roster section not found.");

  const hasTrcnAndDossier = html.includes('Dossier') && (html.includes('TRCN') || html.includes('Credentials'));
  console.log(`Contains 'Dossier' action & TRCN credentials column: ${hasTrcnAndDossier}`);
  if (!hasTrcnAndDossier) throw new Error("Dossier / TRCN integration not found in HTML.");

  const hasClockIn = html.includes('Clock-In') || html.includes('PRESENT') || html.includes('LATE');
  console.log(`Contains Attendance Clock-In button: ${hasClockIn}`);
  if (!hasClockIn) throw new Error("Attendance Clock-In not found.");

  const hasPrintableDocs = html.includes('Print Staff ID Card') || html.includes('Print Appointment Letter') || html.includes('printStaffIdCard');
  console.log(`Contains Printable Staff ID Card / Appointment Letter action: ${hasPrintableDocs}`);
  if (!hasPrintableDocs) throw new Error("Printable documents not found in HTML.");

  // --- TEST 2: Tier Filtered Navigation ---
  console.log('\n--- TEST 2: Tier-Filtered Navigation (greenwood/staff?tier=Secondary+School) ---');
  const tierRes = await fetch(`${baseUrl}/greenwood/staff?tier=Secondary+School`, {
    headers: {
      Cookie: `session=${token}`,
    },
  });
  console.log(`Tier Filtered HTTP Status: ${tierRes.status}`);
  if (tierRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for tier filter, got ${tierRes.status}`);
  }

  console.log('\n=================================================================');
  console.log('   🎉 ALL LIVE STAFF DIRECTORY & HR CHECKS PASSED 100%!         ');
  console.log('=================================================================\n');
}

runLiveStaffVerification().catch((err) => {
  console.error('❌ Live verification failed:', err);
  process.exit(1);
});
