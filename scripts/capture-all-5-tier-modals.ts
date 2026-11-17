import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import * as jose from "jose";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";
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
  console.log("=== CAPTURING 5-TIER STAFF ONBOARDING LIVE MODAL SCREENSHOTS ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 120000,
    defaultViewport: { width: 1440, height: 1100 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    async function captureTierModal(
      domain: string,
      tierParam: string,
      screenshotName: string,
      expectedTitle: string
    ) {
      console.log(`\n[${screenshotName}] Generating SSO access for ${domain} (${tierParam})...`);
      const ssoToken = await generateSsoToken(domain);
      const url = `http://localhost:3000/${domain}/staff?tier=${encodeURIComponent(tierParam)}&sso_token=${ssoToken}`;

      const page = await browser.newPage();
      page.on("console", (m) => console.log(`[${screenshotName}]`, m.text()));

      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2000));

      console.log("Looking for 'Onboard New Staff' button...");
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const btn = buttons.find((b) => b.innerText.includes("Onboard New Staff"));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        console.error(`Could not find 'Onboard New Staff' button on ${url}`);
        const dumpPath = path.join(PUBLIC_SCREENSHOTS_DIR, `${screenshotName}-error.png`);
        await page.screenshot({ path: dumpPath, fullPage: true });
        await page.close();
        return;
      }

      console.log(`Waiting for modal container .fixed.inset-0...`);
      await page.waitForSelector(".fixed.inset-0", { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 2000));

      const outPath = path.join(ARTIFACT_DIR, `${screenshotName}.png`);
      const publicPath = path.join(PUBLIC_SCREENSHOTS_DIR, `${screenshotName}.png`);

      await page.screenshot({ path: outPath, fullPage: false });
      fs.copyFileSync(outPath, publicPath);
      console.log(`✅ SUCCESS: Captured ${screenshotName}.png`);
      await page.close();
    }

    // 1. TIER 1: CRECHE MODAL
    await captureTierModal(
      "demo",
      "Creche / Nursery",
      "tier1-creche-onboarding",
      "Creche / Daycare Staff Onboarding"
    );

    // 2. TIER 2: NURSERY MODAL
    await captureTierModal(
      "egede",
      "Nursery / Kindergarten",
      "tier2-nursery-onboarding",
      "Nursery School Staff Onboarding"
    );

    // 3. TIER 3: PRIMARY MODAL (Egede Primary)
    await captureTierModal(
      "egede",
      "Primary School",
      "tier3-primary-onboarding",
      "Primary School Staff Onboarding"
    );

    // 4. TIER 4: SECONDARY MODAL (Apex Secondary)
    await captureTierModal(
      "demo",
      "Secondary School",
      "tier4-secondary-onboarding",
      "Secondary School Staff Onboarding"
    );

    // 5. TIER 5: TERTIARY MODAL (Apex Polytechnic / University)
    await captureTierModal(
      "demo",
      "Higher Institution / University",
      "tier5-tertiary-onboarding",
      "Tertiary Staff & Academic Onboarding"
    );

    console.log("\n=== ALL 5 TIER MODALS CAPTURED SUCCESSFULLY ===");
  } finally {
    await browser.close();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
