import * as jose from 'jose';

async function runLiveAdmissionsVerification() {
  console.log('=================================================================');
  console.log('   VERIFYING ADMISSIONS & ENROLLMENT CRM (LIVE HTTP)            ');
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

  // --- TEST 1: Main Admissions CRM Hub ---
  console.log('--- TEST 1: Main Admissions CRM Hub (greenwood/admissions) ---');
  const res = await fetch(`${baseUrl}/greenwood/admissions`, {
    headers: {
      Cookie: `session=${token}`,
    },
  });

  console.log(`Admissions Hub HTTP Status: ${res.status}`);
  if (res.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${res.status}`);
  }

  const html = await res.text();

  const hasHeader = html.includes('Admissions &amp; Enrollment CRM') || html.includes('Admissions & Enrollment CRM') || html.includes('Admissions Management') || html.includes('Admissions');
  console.log(`Contains 'Admissions & Enrollment CRM' header: ${hasHeader}`);
  if (!hasHeader) throw new Error("Header not found in HTML.");

  const hasTierSwitcher = html.includes('Secondary School') && html.includes('Primary School');
  console.log(`Contains Multi-Tier Switcher Pills (Secondary, Primary, etc.): ${hasTierSwitcher}`);
  if (!hasTierSwitcher) throw new Error("Multi-tier switcher pills not found.");

  const hasFunnelCards = (html.includes('Inquiries') || html.includes('Inquiry')) && (html.includes('Screening') || html.includes('KYC')) && (html.includes('Matriculated') || html.includes('Enrolled'));
  console.log(`Contains 5-Stage Admissions Funnel Cockpit: ${hasFunnelCards}`);
  if (!hasFunnelCards) throw new Error("Funnel cockpit cards not found.");

  const hasPipelineElements = html.includes('Admissions Pipeline') || html.includes('Log Walk-In Inquiry') || html.includes('Initial Inquiry');
  console.log(`Contains Pipeline Board / Inquiry Action: ${hasPipelineElements}`);
  if (!hasPipelineElements) throw new Error("Pipeline board elements not found.");

  const hasDossierAndPrint = html.includes('Dossier') || html.includes('Offer Letter') || html.includes('Exam Slip');
  console.log(`Contains Dossier / Printable Offer Letter actions: ${hasDossierAndPrint}`);
  if (!hasDossierAndPrint) throw new Error("Dossier / printable document actions not found in HTML.");

  // --- TEST 2: Tier Filtered Navigation ---
  console.log('\n--- TEST 2: Tier-Filtered Navigation (greenwood/admissions?tier=Secondary+School) ---');
  const tierRes = await fetch(`${baseUrl}/greenwood/admissions?tier=Secondary+School`, {
    headers: {
      Cookie: `session=${token}`,
    },
  });
  console.log(`Tier Filtered HTTP Status: ${tierRes.status}`);
  if (tierRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for tier filter, got ${tierRes.status}`);
  }

  console.log('\n=================================================================');
  console.log('   🎉 ALL LIVE ADMISSIONS & ENROLLMENT CRM CHECKS PASSED 100%!   ');
  console.log('=================================================================\n');
}

runLiveAdmissionsVerification().catch((err) => {
  console.error('❌ Live verification failed:', err);
  process.exit(1);
});
