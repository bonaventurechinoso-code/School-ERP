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
  console.log("=== CAPTURING SECONDARY STAFF ONBOARDING MODAL SCREENSHOTS ===");

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
      throw new Error(`Could not find 'Onboard New Staff' button on ${url}`);
    }

    console.log("Waiting for modal container .fixed.inset-0...");
    await page.waitForSelector(".fixed.inset-0", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    // 1. Pick role "Subject Teacher"
    console.log("Selecting role 'Subject Teacher'...");
    await page.evaluate(() => {
      const picker = document.getElementById("staff-role-picker");
      if (picker) (picker as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 800));

    await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll("[role='option']"));
      const opt = options.find((o) => (o as HTMLElement).innerText.includes("Subject Teacher"));
      if (opt) (opt as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 2. Click class pills: JSS 1A, SSS 1A
    console.log("Clicking class pills in Section D...");
    await page.evaluate(() => {
      const container = document.getElementById("field-teachingClasses");
      if (container) {
        const buttons = Array.from(container.querySelectorAll("button"));
        buttons.forEach((b) => {
          const txt = (b as HTMLElement).innerText;
          if (txt.includes("JSS 1A") || txt.includes("SSS 1A")) {
            (b as HTMLElement).click();
          }
        });
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // 3. Click subject pills: English Language, Mathematics
    console.log("Clicking subject pills...");
    await page.evaluate(() => {
      const container = document.getElementById("field-subjects");
      if (container) {
        const buttons = Array.from(container.querySelectorAll("button"));
        buttons.forEach((b) => {
          const txt = (b as HTMLElement).innerText;
          if (txt.includes("English Language") || txt.includes("Mathematics")) {
            (b as HTMLElement).click();
          }
        });
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // 4. Scroll to Section D and capture screenshot
    console.log("Scrolling to Section D...");
    await page.evaluate(() => {
      const secD = document.getElementById("section-d-container");
      if (secD) secD.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 1000));

    const shot1Artifact = path.join(ARTIFACT_DIR, "secondary-staff-section-d.png");
    const shot1Public = path.join(PUBLIC_SCREENSHOTS_DIR, "secondary-staff-section-d.png");
    await page.screenshot({ path: shot1Artifact, fullPage: false });
    await page.screenshot({ path: shot1Public, fullPage: false });
    console.log(`✅ Captured Section D screenshot: ${shot1Artifact}`);

    // 5. Scroll down to Section G & Sticky Footer
    console.log("Scrolling down to Sticky Footer and Section G...");
    await page.evaluate(() => {
      const scrollable = document.querySelector(".overflow-y-auto.p-4");
      if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
      }
    });
    await new Promise((r) => setTimeout(r, 1000));

    const shot2Artifact = path.join(ARTIFACT_DIR, "secondary-staff-footer.png");
    const shot2Public = path.join(PUBLIC_SCREENSHOTS_DIR, "secondary-staff-footer.png");
    await page.screenshot({ path: shot2Artifact, fullPage: false });
    await page.screenshot({ path: shot2Public, fullPage: false });
    console.log(`✅ Captured Footer screenshot: ${shot2Artifact}`);

  } catch (err) {
    console.error("Error during capture:", err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
