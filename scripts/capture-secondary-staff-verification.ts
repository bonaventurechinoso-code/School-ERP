import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import * as jose from "jose";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\362f6193-ea22-4062-84a4-8adfa010f82e";
const PUBLIC_SCREENSHOTS_DIR = path.join(__dirname, "..", "public", "screenshots");

if (!fs.existsSync(PUBLIC_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });
}

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function generateSsoToken(subdomain: string) {
  return await new jose.SignJWT({
    isSuperAdmin: true,
    role: "SUPER_ADMIN",
    type: "super_admin_sso",
    email: "superadmin@bonaveeict.com.ng",
    subdomain,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(SECRET_KEY);
}

async function main() {
  console.log("=== CAPTURING SIDEBAR & STAFF ONBOARDING SCREENSHOTS ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 120000,
    defaultViewport: { width: 1366, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const domain = "demo-secondary";
    const tierParam = "Secondary School";
    console.log(`Generating SSO access for ${domain}...`);
    const ssoToken = await generateSsoToken(domain);
    const url = `http://localhost:3000/${domain}/staff?tier=${encodeURIComponent(tierParam)}&sso_token=${ssoToken}`;

    const page = await browser.newPage();
    page.on("console", (m) => console.log("[Browser Console]", m.text()));

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 4000));

    // CAPTURE SCREENSHOT 1: DASHBOARD SIDEBAR (Bolder & Thicker Sidebar Apps)
    console.log("Capturing Dashboard Sidebar with bold/thick apps...");
    const sidebarArtifact = path.join(ARTIFACT_DIR, "sidebar-apps-bold.png");
    const sidebarPublic = path.join(PUBLIC_SCREENSHOTS_DIR, "sidebar-apps-bold.png");
    await page.screenshot({ path: sidebarArtifact, fullPage: false });
    await page.screenshot({ path: sidebarPublic, fullPage: false });
    console.log(`✅ Captured Sidebar: ${sidebarArtifact}`);

    console.log("Waiting for 'Onboard New Staff' button...");
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some((b) => b.innerText.includes("Onboard New Staff"));
    }, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    console.log("Clicking 'Onboard New Staff' button...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.includes("Onboard New Staff"));
      if (btn) btn.click();
    });

    console.log("Waiting for modal container .fixed.inset-0...");
    await page.waitForSelector(".fixed.inset-0", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Scroll to Section A
    console.log("Scrolling to Section A (Personal & Identity)...");
    await page.evaluate(() => {
      const fieldLga = document.getElementById("field-lga");
      if (fieldLga) fieldLga.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 1000));

    // CAPTURE SCREENSHOT 2: SECTION A WITH L.G.A INPUT & PLACEHOLDER
    console.log("Capturing Section A with L.G.A input...");
    const lgaArtifact = path.join(ARTIFACT_DIR, "staff-onboarding-section-a-lga.png");
    const lgaPublic = path.join(PUBLIC_SCREENSHOTS_DIR, "staff-onboarding-section-a-lga.png");
    await page.screenshot({ path: lgaArtifact, fullPage: false });
    await page.screenshot({ path: lgaPublic, fullPage: false });
    console.log(`✅ Captured Section A with L.G.A: ${lgaArtifact}`);

  } catch (err) {
    console.error("Error during capture:", err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
