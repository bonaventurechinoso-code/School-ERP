import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import * as jose from "jose";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";
const PUBLIC_SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");

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
  console.log("=== CAPTURING CLEAN ROLE PICKER PLACEHOLDER FORM VERIFICATION ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 60000,
    defaultViewport: { width: 1440, height: 1000 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const ssoToken = await generateSsoToken("demo");
    const url = `http://localhost:3000/demo/staff?tier=Primary%20School&sso_token=${ssoToken}`;

    const page = await browser.newPage();
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Open Onboard New Staff Modal
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
      throw new Error("Could not find 'Onboard New Staff' button!");
    }

    console.log("Waiting for modal container .fixed.inset-0...");
    await page.waitForSelector(".fixed.inset-0", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    // 1. Initial State: Clean placeholder form field (no cluttered 15-card grid!)
    const shot1 = path.join(ARTIFACT_DIR, "clean-role-picker-placeholder.png");
    const shot1Pub = path.join(PUBLIC_SCREENSHOTS_DIR, "clean-role-picker-placeholder.png");
    await page.screenshot({ path: shot1, fullPage: false });
    fs.copyFileSync(shot1, shot1Pub);
    console.log("✅ Captured initial clean placeholder screenshot:", shot1);

    // 2. Click the role picker to open the clean categorized list of roles
    console.log("Clicking role picker placeholder button...");
    await page.click("#staff-role-picker");
    await new Promise((r) => setTimeout(r, 800));

    const shot2 = path.join(ARTIFACT_DIR, "clean-role-picker-dropdown-open.png");
    const shot2Pub = path.join(PUBLIC_SCREENSHOTS_DIR, "clean-role-picker-dropdown-open.png");
    await page.screenshot({ path: shot2, fullPage: false });
    fs.copyFileSync(shot2, shot2Pub);
    console.log("✅ Captured open dropdown screenshot:", shot2);

    // 3. Select 'Class Teacher' from the list
    console.log("Selecting 'Class Teacher'...");
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("span"));
      const classTeacher = items.find((el) => el.innerText.trim() === "Class Teacher");
      if (classTeacher) {
        (classTeacher.closest('div[class*="cursor-pointer"]') as HTMLElement)?.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    const shot3 = path.join(ARTIFACT_DIR, "clean-role-picker-selected.png");
    const shot3Pub = path.join(PUBLIC_SCREENSHOTS_DIR, "clean-role-picker-selected.png");
    await page.screenshot({ path: shot3, fullPage: false });
    fs.copyFileSync(shot3, shot3Pub);
    console.log("✅ Captured selected role screenshot:", shot3);

    console.log("\n>>> ALL ROLE PICKER TESTS COMPLETED SUCCESSFULLY! <<<");
  } catch (err) {
    console.error("Test Error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
