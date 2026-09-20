import * as jose from "jose";

async function verifyBursarPortal() {
  console.log("=================================================================");
  console.log("    VERIFYING DEDICATED BURSAR PORTAL ON LOCALHOST:3000          ");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // Create authorized Bursar JWT session token
  const jwtSecret = "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new jose.SignJWT({
    role: "FINANCIAL",
    staffRole: "School Bursar",
    email: "bursar@greenwood.edu.ng",
    schoolDomain: "greenwood",
    permissions: ["manage:finance", "manage:all"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  const authHeaders = {
    Cookie: `session=${sessionToken}; mockTenant=greenwood`,
  };

  const routesToTest = [
    {
      url: `${baseUrl}/bursar`,
      name: "1. Command Center Overview (/bursar)",
      expectedSnippets: [
        "Bursar Command Center",
        "Total Invoiced",
        "Total Collections",
        "Outstanding Debt",
        "Collect Fee",
      ],
    },
    {
      url: `${baseUrl}/bursar/collect`,
      name: "2. Rapid Cashier Counter (/bursar/collect)",
      expectedSnippets: [
        "Rapid Fee Collection Counter",
        "Step 1: Student Lookup",
        "Step 2: Enter Payment Details",
        "Issue Official Receipt",
      ],
    },
    {
      url: `${baseUrl}/bursar/verifications`,
      name: "3. Payment Verifications (/bursar/verifications)",
      expectedSnippets: [
        "Bursar Payment Verifications",
        "Audit Desk",
      ],
    },
    {
      url: `${baseUrl}/bursar/invoices`,
      name: "4. Student Invoices Desk (/bursar/invoices)",
      expectedSnippets: [
        "Student Invoices",
        "Generate Invoices",
      ],
    },
    {
      url: `${baseUrl}/bursar/receipts`,
      name: "5. Official Receipts (/bursar/receipts)",
      expectedSnippets: [
        "Official Bursary Receipts",
        "Receipt No",
      ],
    },
    {
      url: `${baseUrl}/bursar/fees`,
      name: "6. Fee Structures & Tariffs (/bursar/fees)",
      expectedSnippets: [
        "Fee Structures",
        "New Fee Template",
      ],
    },
    {
      url: `${baseUrl}/bursar/banking`,
      name: "7. Direct Bank Accounts (/bursar/banking)",
      expectedSnippets: [
        "Direct Bank Collection Accounts",
        "Account Number",
        "Save Bank Settings",
      ],
    },
    {
      url: `${baseUrl}/bursar/reports`,
      name: "8. Defaulters & Financial Audit (/bursar/reports)",
      expectedSnippets: [
        "Defaulters &amp; Debtors Audit",
        "Export Defaulters CSV",
        "Total Debt Outstanding",
      ],
    },
  ];

  let passedCount = 0;

  for (const r of routesToTest) {
    console.log(`--- Testing ${r.name} ---`);
    const res = await fetch(r.url, { headers: authHeaders });
    console.log(`HTTP Status: ${res.status}`);

    if (res.status !== 200) {
      throw new Error(`FAIL: ${r.name} returned HTTP ${res.status}`);
    }

    const html = await res.text();
    for (const snippet of r.expectedSnippets) {
      const found = html.includes(snippet);
      if (!found) {
        throw new Error(`FAIL: Expected string "${snippet}" not found in ${r.name}!`);
      }
    }
    console.log(`✅ PASS: All expected markers verified in ${r.name}.\n`);
    passedCount++;
  }

  console.log("=================================================================");
  console.log(`  ALL BURSAR WORKSTATION CHECKS PASSED (${passedCount}/${routesToTest.length}) `);
  console.log("=================================================================\n");
}

verifyBursarPortal().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
