import * as jose from "jose";

async function verifyFinanceModule() {
  console.log("=================================================================");
  console.log("   VERIFYING BURSARY, INVOICING & BANK RECONCILIATION MODULE     ");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // 1. Create authorized admin JWT session token
  const jwtSecret = "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new jose.SignJWT({
    role: "ADMIN",
    staffRole: "Bursar",
    email: "bursar@greenwood.edu.ng",
    schoolDomain: "greenwood",
    permissions: ["manage:all"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  const authHeaders = {
    Cookie: `session=${sessionToken}; activeTier=Secondary%20School`,
  };

  // --- TEST 1: Main Finance Dashboard & Hub ---
  console.log("--- TEST 1: Finance Dashboard (greenwood/finance) ---");
  const financeRes = await fetch(`${baseUrl}/greenwood/finance`, {
    headers: authHeaders,
  });
  console.log(`Finance Hub HTTP Status: ${financeRes.status}`);
  if (financeRes.status !== 200) {
    throw new Error(`FAIL: Finance hub returned HTTP ${financeRes.status}`);
  }
  const financeHtml = await financeRes.text();

  const hasTitle = financeHtml.includes("Fee Tracking &amp; Finance") || financeHtml.includes("Fee Tracking & Finance");
  console.log(`Contains 'Fee Tracking & Finance' header: ${hasTitle}`);
  if (!hasTitle) {
    throw new Error("FAIL: Finance header not found!");
  }

  const hasTiers = financeHtml.includes("Secondary School") && financeHtml.includes("Primary School");
  console.log(`Contains Multi-Tier Switcher Pills (Secondary, Primary, etc.): ${hasTiers}`);
  if (!hasTiers) {
    throw new Error("FAIL: Multi-Tier switcher pills not found!");
  }

  const hasTabs =
    financeHtml.includes("Overview &amp; Metrics") || financeHtml.includes("Overview & Metrics") &&
    financeHtml.includes("Invoices &amp; Payments") || financeHtml.includes("Invoices & Payments") &&
    financeHtml.includes("Bank Reconciliation");
  console.log(`Contains 5-Tab Navigation including 'Bank Reconciliation': ${hasTabs}`);
  if (!hasTabs) {
    throw new Error("FAIL: Tab navigation including Bank Reconciliation not found!");
  }

  const hasKpiCards =
    financeHtml.includes("Total Invoiced") &&
    financeHtml.includes("Total Collected") &&
    financeHtml.includes("Institutional Expenses");
  console.log(`Contains Finance KPI Summary Cards: ${hasKpiCards}`);
  if (!hasKpiCards) {
    throw new Error("FAIL: KPI summary cards not found!");
  }

  const hasReconciliationAction = financeHtml.includes("Reconcile Deposits") || financeHtml.includes("Bank Reconciliation");
  console.log(`Contains Bank Reconciliation quick action / tab: ${hasReconciliationAction}`);
  if (!hasReconciliationAction) {
    throw new Error("FAIL: Bank Reconciliation action not found!");
  }

  const hasClearanceAction = financeHtml.includes("Clearance") || financeHtml.includes("printClearancePass");
  console.log(`Contains Financial Clearance & Examination Pass action: ${hasClearanceAction}`);
  if (!hasClearanceAction) {
    throw new Error("FAIL: Financial Clearance Pass action not found!");
  }

  console.log("\n=================================================================");
  console.log("   🎉 ALL LIVE BURSARY & FINANCE VERIFICATION CHECKS PASSED!     ");
  console.log("=================================================================\n");
}

verifyFinanceModule().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
