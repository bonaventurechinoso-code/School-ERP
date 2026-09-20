/**
 * verify-manual-saas.mjs
 * Comprehensive automated verification of the 100% Manual SaaS Subscription
 * & Payment Verification Framework across Super Admin, Tenant, and Teacher dashboards.
 */

import fs from "fs";
import path from "path";
import assert from "assert";

console.log("================================================================================");
console.log("🔍 RUNNING AUTOMATED VERIFICATION: 100% MANUAL SAAS & PAYMENT FRAMEWORK");
console.log("================================================================================\n");

let passedChecks = 0;
let totalChecks = 0;

function check(title, condition, detail = "") {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${title}`);
    if (detail) console.log(`     └─ ${detail}`);
  } else {
    console.error(`  ❌ [FAIL] ${title}`);
    if (detail) console.error(`     └─ ${detail}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. WEBHOOKS DEACTIVATION & STATIC RESPONSES
// -----------------------------------------------------------------------------
console.log("\n📦 1. Verifying Webhook Endpoints Short-Circuit to Manual Response:");
const webhookFiles = [
  "src/app/api/webhooks/paystack/route.ts",
  "src/app/api/v1/webhooks/paystack/route.ts",
  "src/app/api/super-admin/webhooks/paystack/route.ts",
  "src/app/api/wallet/webhook/route.ts",
];

for (const relPath of webhookFiles) {
  const fullPath = path.resolve(process.cwd(), relPath);
  check(`File exists: ${relPath}`, fs.existsSync(fullPath));
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf8");
    check(
      `${relPath} returns static "Manual environment active" response`,
      content.includes('message: "Manual environment active"') &&
        !content.includes("fetch(") &&
        !content.includes("axios")
    );
  }
}

// -----------------------------------------------------------------------------
// 2. ERADICATION OF OUTGOING PAYMENT GATEWAY FETCH/AXIOS CALLS
// -----------------------------------------------------------------------------
console.log("\n📡 2. Verifying Zero Outgoing External Gateway Calls:");
const localApiFiles = [
  "src/app/api/tenant/paystack-balance/route.ts",
  "src/app/api/super-admin/tenants/create/route.ts",
  "src/app/api/saas/route.ts",
];

for (const relPath of localApiFiles) {
  const fullPath = path.resolve(process.cwd(), relPath);
  check(`File exists: ${relPath}`, fs.existsSync(fullPath));
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf8");
    const hasPaystackApiUrl = content.includes("api.paystack.co");
    check(
      `${relPath} has no outgoing calls to api.paystack.co`,
      !hasPaystackApiUrl,
      hasPaystackApiUrl ? "Found api.paystack.co reference" : "Clean local database execution"
    );
  }
}

// Check tenant paystack-balance route performs safe PostgreSQL lookups
const balanceRoutePath = path.resolve(process.cwd(), "src/app/api/tenant/paystack-balance/route.ts");
if (fs.existsSync(balanceRoutePath)) {
  const balanceContent = fs.readFileSync(balanceRoutePath, "utf8");
  check(
    "paystack-balance route queries local Prisma Tenant & Subscription models",
    balanceContent.includes("prisma.tenant.findFirst") &&
      balanceContent.includes("subscriptions") &&
      balanceContent.includes("success: true") &&
      balanceContent.includes("balance: 0")
  );
}

// -----------------------------------------------------------------------------
// 3. SUPER ADMIN SAAS DASHBOARD & CORPORATE ACCOUNT
// -----------------------------------------------------------------------------
console.log("\n🏛️ 3. Verifying Super Admin Platform Console (/admin/saas):");
const saasDashboardPath = path.resolve(process.cwd(), "src/app/admin/saas/SaasAdminDashboard.tsx");
if (fs.existsSync(saasDashboardPath)) {
  const content = fs.readFileSync(saasDashboardPath, "utf8");
  
  check(
    "Contains panel: 'Platform Subscription Corporate Account (Super Admin)'",
    content.includes("Platform Subscription Corporate Account (Super Admin)")
  );
  
  check(
    "Binds to NIGERIAN_BANKS dataset for settlement bank selection",
    content.includes("NIGERIAN_BANKS.map") && content.includes("Settlement Bank Selection")
  );
  
  check(
    "Enforces 10-digit validated NUBAN account number field",
    content.includes("maxLength={10}") && content.includes("10-digit NUBAN")
  );

  check(
    "Sequential table columns: School & Subdomain | Plan & Subscription | Monthly Rate | Subscription Status | Next Renewal Date | Actions",
    content.includes("School & Subdomain") &&
      content.includes("Plan & Subscription") &&
      content.includes("Monthly Rate") &&
      content.includes("Subscription Status") &&
      content.includes("Next Renewal Date") &&
      content.includes("Actions")
  );

  check(
    "Excludes Paystack subaccounts, commission splits, and processing fees columns",
    !content.includes("Subaccount Code") &&
      !content.includes("Split Code") &&
      !content.includes("2% Commission")
  );

  check(
    "Prominently displays 0% transaction fee compliance disclaimer banner",
    content.includes("100% Manual SaaS Subscription & Payment Verification Framework") &&
      content.includes("0% Transaction Fees")
  );
}

// -----------------------------------------------------------------------------
// 4. TENANT SIDEBAR & DASHBOARD CARDS
// -----------------------------------------------------------------------------
console.log("\n🏫 4. Verifying Tenant Sidebar & Dashboard Metrics:");
const sidebarPath = path.resolve(process.cwd(), "src/components/Sidebar.tsx");
if (fs.existsSync(sidebarPath)) {
  const content = fs.readFileSync(sidebarPath, "utf8");
  
  check(
    "Sidebar deploys read-only 'SaaS Portal Subscription' status card widget",
    content.includes("SaaS Portal Subscription") &&
      content.includes("Status:") &&
      content.includes("0% Transaction Fees")
  );

  check(
    "Displays corporate transfer instructions with bank and account details",
    content.includes("Renew via Transfer to:")
  );

  check(
    "Displays next invoice renewal date helper note",
    content.includes("Next Invoice Date:")
  );

  check(
    "Includes compliance micro-disclaimer on 0% transaction fee scope",
    content.includes("Compliance: Platform processes 0% transaction collections. Schools manage independent external banking paths directly.")
  );

  check(
    "Purged top-up wallet buttons and withdrawal links from sidebar",
    !content.includes("Top Up") && !content.includes("Fund Account")
  );
}

const dashboardCardsPath = path.resolve(
  process.cwd(),
  "src/app/[schoolDomain]/(admin)/dashboard/DashboardCards.tsx"
);
if (fs.existsSync(dashboardCardsPath)) {
  const content = fs.readFileSync(dashboardCardsPath, "utf8");

  check(
    "Revenue metric card displays subtitle: 'Internal Fee Records (100% Direct to School Bank)'",
    content.includes("Internal Fee Records (100% Direct to School Bank)")
  );

  check(
    "Revenue card click interaction routes to offline analytical reports (/${subdomain}/finance)",
    content.includes("targetFinanceUrl = subdomain ? `/${subdomain}/finance` : \"/dashboard/finance\"")
  );
}

// -----------------------------------------------------------------------------
// 5. SUBSCRIPTION LOCK MODAL
// -----------------------------------------------------------------------------
console.log("\n🔒 5. Verifying Subscription Lock Modal:");
const lockModalPath = path.resolve(process.cwd(), "src/components/SubscriptionLockModal.tsx");
if (fs.existsSync(lockModalPath)) {
  const content = fs.readFileSync(lockModalPath, "utf8");

  check(
    "Displays manual corporate account details card (Wema Bank • 0123456789)",
    content.includes("Platform Corporate Account") &&
      content.includes("Wema Bank • 0123456789") &&
      content.includes("0% Fee Verified")
  );

  check(
    "Action controls guide manual transfer receipt submission instead of inline gateway",
    content.includes("Submit Transfer Receipt") && !content.includes("usePaystackPayment")
  );
}

// -----------------------------------------------------------------------------
// 6. TEACHER'S PORTAL STREAMLINING & VISUAL FIXES
// -----------------------------------------------------------------------------
console.log("\n👩‍🏫 6. Verifying Teacher's Portal Strategic Streamlining:");
const teacherSidebarPath = path.resolve(process.cwd(), "src/app/teacher/TeacherSidebar.tsx");
if (fs.existsSync(teacherSidebarPath)) {
  const content = fs.readFileSync(teacherSidebarPath, "utf8");

  check(
    "Attendance and Gradebook removed from TEACHER_NAV_MODULES sidebar routing loop",
    !content.includes('id: "attendance"') && !content.includes('id: "gradebook"')
  );
}

const teacherMyClassPath = path.resolve(process.cwd(), "src/app/teacher/my-class/page.tsx");
if (fs.existsSync(teacherMyClassPath)) {
  const content = fs.readFileSync(teacherMyClassPath, "utf8");

  check(
    "Homeroom Student Roster table completely deleted from classroom overview",
    !content.includes("Homeroom Student Roster") &&
      !content.includes("Aliyu") &&
      !content.includes("Binta")
  );

  check(
    "Executive Hero Cockpit contains fast-access 'Take Roll Call' and 'Input Scores' actions",
    content.includes("Take Roll Call") && content.includes("Input Scores")
  );

  check(
    "Displays 3 non-redundant core performance tiles (Class Enrollment, Gender Demographics, Attendance Today)",
    content.includes("Class Enrollment") &&
      content.includes("Gender Demographics") &&
      content.includes("Attendance Today")
  );
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`📊 VERIFICATION SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED`);
console.log("================================================================================");

if (passedChecks === totalChecks) {
  console.log("\n🎉 ALL 100% MANUAL SAAS & PAYMENT VERIFICATION CRITERIA VALIDATED PERFECTLY!\n");
  process.exit(0);
} else {
  console.error(`\n⚠️  ${totalChecks - passedChecks} CHECK(S) FAILED. REVIEW DETAILS ABOVE.\n`);
  process.exit(1);
}
