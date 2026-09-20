import * as jose from 'jose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTerminology() {
  const school = await prisma.school.findFirst({
    include: { academicTiers: true, departments: true }
  });

  if (!school) {
    console.error("No schools found in DB!");
    process.exit(1);
  }

  console.log(`Testing with tenant: "${school.name}" (${school.subdomain})`);

  const jwtSecret = "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new jose.SignJWT({
    role: "ADMIN",
    staffRole: "Principal",
    email: `principal@${school.subdomain}.edu.ng`,
    schoolDomain: school.subdomain,
    permissions: ["manage:all"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  const res = await fetch(`http://localhost:3000/${school.subdomain}/staff`, {
    headers: {
      Cookie: `session=${sessionToken}; activeTier=Secondary`,
    },
  });

  const data = await res.text();
  console.log(`HTTP Status: ${res.status}, Length: ${data.length}`);
  const titleMatch = data.match(/<title>(.*?)<\/title>/);
  console.log(`Page Title: ${titleMatch ? titleMatch[1] : 'None'}`);
  const bodyMatch = data.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const textOnly = (bodyMatch ? bodyMatch[1] : '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`Page Plain Text:`, textOnly.slice(0, 500));

  const shouldNotExist = [
    'Faculty & Staff Roster',
    'FACULTY & TEACHERS',
    'ADMIN & SUPPORT',
    'All Departments (',
    'Departments (0)',
    '+ Add Staff Member',
    'Faculty & Staff Only'
  ];
  const shouldExist = [
    'Staff Directory',
    'TEACHING STAFF',
    'NON-TEACHING STAFF',
    'All Subjects / Departments',
    'Staff Categories',
    'Onboard New Staff'
  ];

  console.log('\n--- Banned Terminology Checks (Must be False) ---');
  let allPassed = true;
  for (const term of shouldNotExist) {
    const found = data.includes(term);
    console.log(`"${term}": ${found ? 'FAIL (Found in HTML)' : 'PASS (Not Found)'}`);
    if (found) allPassed = false;
  }

  console.log('\n--- Expected Terminology Checks (Must be True) ---');
  for (const term of shouldExist) {
    const found = data.includes(term);
    console.log(`"${term}": ${found ? 'PASS (Found in HTML)' : 'FAIL (Missing in HTML)'}`);
    if (!found) allPassed = false;
  }

  console.log(`\nOverall Result: ${allPassed ? 'ALL CHECKS PASSED ✅' : 'SOME CHECKS FAILED ❌'}`);
  await prisma.$disconnect();
}

testTerminology().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
