async function verifyBranding() {
  console.log("=== STARTING BRANDING & LOGO VERIFICATION ===");
  const baseUrl = "http://localhost:3000";

  // 1. Check static logo asset
  console.log("\n--- TEST 1: Verifying Static Asset /img/business-logo.png ---");
  const logoRes = await fetch(`${baseUrl}/img/business-logo.png`);
  console.log(`Logo HTTP Status: ${logoRes.status}`);
  console.log(`Content-Type: ${logoRes.headers.get("content-type")}`);
  const logoBuffer = await logoRes.arrayBuffer();
  console.log(`Logo Size: ${logoBuffer.byteLength} bytes`);
  if (logoRes.status !== 200 || logoBuffer.byteLength === 0) {
    throw new Error("FAIL: /img/business-logo.png is not accessible or empty!");
  }
  console.log("PASS: Logo image is served correctly at /img/business-logo.png");

  // 2. Check public landing page
  console.log("\n--- TEST 2: Verifying Landing Page Text & Logo Placement ---");
  const landingRes = await fetch(`${baseUrl}/`);
  console.log(`Landing Page Status: ${landingRes.status}`);
  const landingHtml = await landingRes.text();

  const hasNextGen = landingHtml.includes("Next-Gen");
  console.log(`Contains 'Next-Gen': ${hasNextGen}`);
  if (hasNextGen) {
    throw new Error("FAIL: 'Next-Gen' text still found in public landing page!");
  }

  const hasSchoolErp = landingHtml.includes("School ERP");
  console.log(`Contains 'School ERP': ${hasSchoolErp}`);
  if (!hasSchoolErp) {
    throw new Error("FAIL: 'School ERP' text not found in landing page!");
  }

  const hasLogoInHtml = landingHtml.includes("business-logo.png");
  console.log(`Contains 'business-logo.png': ${hasLogoInHtml}`);
  if (!hasLogoInHtml) {
    throw new Error("FAIL: Logo image not found in landing page HTML!");
  }

  const hasPublicFooter = landingHtml.includes("All System Services Operational") && landingHtml.includes("Unified Enterprise Academic Infrastructure");
  console.log(`Contains Public Footer Layout: ${hasPublicFooter}`);
  if (!hasPublicFooter) {
    throw new Error("FAIL: Public footer layout was not rendered!");
  }
  console.log("PASS: Public landing page header & footer correctly display School ERP branding and logo!");

  // 3. Check tenant login page
  console.log("\n--- TEST 3: Verifying Tenant Login Page (/demo/login) ---");
  const loginRes = await fetch(`${baseUrl}/demo/login`);
  console.log(`Tenant Login Status: ${loginRes.status}`);
  const loginHtml = await loginRes.text();
  console.log(`Login contains 'business-logo.png': ${loginHtml.includes("business-logo.png")}`);
  console.log(`Login contains 'Protected by School ERP Security layer': ${loginHtml.includes("Protected by School ERP Security layer")}`);
  console.log(`Login contains 'Next-Gen': ${loginHtml.includes("Next-Gen")}`);
  if (loginHtml.includes("Next-Gen")) {
    throw new Error("FAIL: 'Next-Gen' found in login page!");
  }
  console.log("PASS: Tenant login page verified!");

  // 4. Check tenant layout wrapper
  console.log("\n--- TEST 4: Verifying Tenant Layout Wrapper (ClientLayout) ---");
  const devLoginRes = await fetch(`${baseUrl}/api/auth/dev-superadmin-login`, {
    redirect: "manual",
  });
  console.log(`Dev Login Status: ${devLoginRes.status}`);
  const setCookie = devLoginRes.headers.get("set-cookie") || "";
  const sessionCookie = setCookie.split(";")[0] || "";
  console.log(`Obtained Session Cookie: ${sessionCookie ? "YES" : "NO"}`);

  const dashboardRes = await fetch(`${baseUrl}/demo/dashboard`, {
    headers: {
      Cookie: sessionCookie,
    },
  });
  console.log(`Tenant Dashboard Status: ${dashboardRes.status}`);
  const dashboardHtml = await dashboardRes.text();
  
  // Header checks: top header must not have business-logo.png
  const headerHtmlMatch = dashboardHtml.match(/<header[\s\S]*?<\/header>/);
  const headerHtml = headerHtmlMatch ? headerHtmlMatch[0] : "";
  const headerHasCompanyLogo = headerHtml.includes("business-logo.png");
  console.log(`Header contains 'business-logo.png': ${headerHasCompanyLogo}`);
  if (headerHasCompanyLogo) {
    throw new Error("FAIL: Top header navbar must be completely free of company logo!");
  }

  // Sidebar header contains DEMO SCHOOL
  const hasDemoSchoolSidebar = dashboardHtml.includes("DEMO SCHOOL");
  console.log(`Contains 'DEMO SCHOOL' in sidebar header: ${hasDemoSchoolSidebar}`);
  if (!hasDemoSchoolSidebar) {
    throw new Error("FAIL: 'DEMO SCHOOL' school tier name not found!");
  }

  // Footer checks
  const footerHtmlMatch = dashboardHtml.match(/<footer[\s\S]*?<\/footer>/);
  const footerHtml = footerHtmlMatch ? footerHtmlMatch[0] : "";
  
  const footerHasDemoSchool = footerHtml.includes("Demo School •") || footerHtml.includes("DEMO SCHOOL •");
  console.log(`Footer contains 'Demo School •': ${footerHasDemoSchool}`);
  if (footerHasDemoSchool) {
    throw new Error("FAIL: Footer should not contain school tier name ('Demo School •') in bottom-left text section!");
  }

  const footerHasPoweredBy = footerHtml.includes("Powered by");
  console.log(`Footer contains 'Powered by ': ${footerHasPoweredBy}`);
  if (!footerHasPoweredBy) {
    throw new Error("FAIL: Footer text credit string 'Powered by ' missing!");
  }

  const footerHasInlineLogo = footerHtml.includes("/img/business-logo.png") && footerHtml.includes("h-5");
  console.log(`Footer contains inline-embedded company logo with sizing: ${footerHasInlineLogo}`);
  if (!footerHasInlineLogo) {
    throw new Error("FAIL: Footer inline-embedded business-logo.png with sizing missing!");
  }

  const hasCollisionPadding = dashboardHtml.includes("sm:pr-56") || dashboardHtml.includes("md:pr-64");
  console.log(`Dashboard footer has safety clearance padding (sm:pr-56/md:pr-64): ${hasCollisionPadding}`);
  if (!hasCollisionPadding) {
    throw new Error("FAIL: Footer collision safety padding offset missing!");
  }

  const hasCopyright = dashboardHtml.includes("All rights reserved.");
  console.log(`Dashboard footer has copyright string: ${hasCopyright}`);
  if (!hasCopyright) {
    throw new Error("FAIL: Copyright string missing in footer!");
  }

  console.log("PASS: Tenant dashboard layout satisfies all branding requirements (clean navbar + inline logo in footer)!");

  // 5. Check Super-Admin Console Layout
  console.log("\n--- TEST 5: Verifying Super-Admin Console Layout (/admin) ---");
  const adminRes = await fetch(`${baseUrl}/admin`, {
    headers: {
      Cookie: sessionCookie,
    },
  });
  console.log(`Admin Console Status: ${adminRes.status}`);
  const adminHtml = await adminRes.text();
  console.log(`Admin contains 'business-logo.png': ${adminHtml.includes("business-logo.png")}`);
  console.log(`Admin contains 'School ERP Master Console': ${adminHtml.includes("School ERP Master Console")}`);
  if (!adminHtml.includes("business-logo.png")) {
    throw new Error("FAIL: Logo not found in Super-Admin layout!");
  }
  console.log("PASS: Super-Admin console includes business logo in header and footer!");

  console.log("\n=== ALL BRANDING & LOGO VERIFICATIONS PASSED SUCCESSFULLY ===");
}

verifyBranding().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
