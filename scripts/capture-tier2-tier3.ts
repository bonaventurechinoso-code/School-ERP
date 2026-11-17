import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import * as jose from "jose";
import { basePrisma } from "../src/lib/tenant-prisma";
import { createDatabaseSession } from "../src/lib/session-manager";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";
const PUBLIC_SCREENSHOTS_DIR = path.join(__dirname, "..", "public", "screenshots");

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function main() {
  console.log("=== CAPTURING TIER 2 & TIER 3 MODALS ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 120000,
    defaultViewport: { width: 1440, height: 1100 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    // -------------------------------------------------------------
    // CAPTURE TIER 2: NURSERY MODAL (on demo)
    // -------------------------------------------------------------
    console.log("\n--- Capturing Tier 2: Nursery Modal ---");
    const demoSsoToken = await new jose.SignJWT({
      isSuperAdmin: true,
      role: "SUPER_ADMIN",
      type: "super_admin_sso",
      email: "superadmin@bonaveeict.com.ng",
      subdomain: "demo",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(SECRET_KEY);

    const nurseryPage = await browser.newPage();
    const nurseryUrl = `http://localhost:3000/demo/staff?tier=Nursery%20School&sso_token=${demoSsoToken}`;
    console.log(`Navigating to ${nurseryUrl}...`);
    await nurseryPage.goto(nurseryUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));

    console.log("Clicking Onboard New Staff button for Nursery...");
    const clickedNursery = await nurseryPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.includes("Onboard New Staff"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clickedNursery) {
      await nurseryPage.waitForSelector(".fixed.inset-0", { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 2000));

      const outPath2 = path.join(ARTIFACT_DIR, "tier2-nursery-onboarding.png");
      const publicPath2 = path.join(PUBLIC_SCREENSHOTS_DIR, "tier2-nursery-onboarding.png");
      await nurseryPage.screenshot({ path: outPath2, fullPage: false });
      fs.copyFileSync(outPath2, publicPath2);
      console.log("✅ SUCCESS: Captured tier2-nursery-onboarding.png");
    } else {
      console.error("❌ Failed to find Onboard New Staff button for Nursery");
    }
    await nurseryPage.close();

    // -------------------------------------------------------------
    // CAPTURE TIER 3: PRIMARY MODAL (on Egede Primary)
    // -------------------------------------------------------------
    console.log("\n--- Capturing Tier 3: Primary Modal on Egede ---");
    
    // Ensure active session for egede
    const egede = await basePrisma.school.findFirst({ where: { subdomain: "egede" } });
    if (!egede) throw new Error("Egede school not found");
    const egedeAdmin = await basePrisma.user.findFirst({
      where: { schoolId: egede.id, role: "SCHOOL_ADMIN" },
    });
    if (!egedeAdmin) throw new Error("Egede admin not found");

    const sessionRes = await createDatabaseSession({
      userId: egedeAdmin.id,
      email: egedeAdmin.email,
      schoolDomain: "egede",
      tenantId: egede.id,
      role: "SCHOOL_ADMIN",
    });

    const primaryPage = await browser.newPage();
    
    // Set cookie on egede.localhost AND localhost
    await primaryPage.setCookie(
      {
        name: "session",
        value: sessionRes.cookieToken,
        domain: "egede.localhost",
        path: "/",
        httpOnly: true,
      },
      {
        name: "accessToken",
        value: sessionRes.cookieToken,
        domain: "egede.localhost",
        path: "/",
        httpOnly: true,
      },
      {
        name: "session",
        value: sessionRes.cookieToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
      },
      {
        name: "accessToken",
        value: sessionRes.cookieToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
      }
    );

    const primaryUrl = "http://egede.localhost:3000/staff?tier=Primary%20School";
    console.log(`Navigating to ${primaryUrl}...`);
    await primaryPage.goto(primaryUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    console.log("Primary page URL:", primaryPage.url());

    console.log("Clicking Onboard New Staff button for Primary on Egede...");
    const clickedPrimary = await primaryPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.includes("Onboard New Staff"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clickedPrimary) {
      await primaryPage.waitForSelector(".fixed.inset-0", { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 2000));

      // Inspect classrooms in modal dropdown
      const optionsInfo = await primaryPage.evaluate(() => {
        const selects = Array.from(document.querySelectorAll("select"));
        const classSelect = selects.find((s) =>
          Array.from(s.options).some((o) => o.text.includes("Primary") || o.text.includes("Nursery"))
        );
        if (classSelect) {
          return Array.from(classSelect.options).map((o) => o.text);
        }
        return [];
      });
      console.log("Dropdown class options detected:", optionsInfo);

      const outPath3 = path.join(ARTIFACT_DIR, "tier3-primary-onboarding.png");
      const publicPath3 = path.join(PUBLIC_SCREENSHOTS_DIR, "tier3-primary-onboarding.png");
      await primaryPage.screenshot({ path: outPath3, fullPage: false });
      fs.copyFileSync(outPath3, publicPath3);
      console.log("✅ SUCCESS: Captured tier3-primary-onboarding.png");
    } else {
      console.error("❌ Failed to find Onboard New Staff button for Primary on Egede");
      const errPath = path.join(PUBLIC_SCREENSHOTS_DIR, "tier3-error-debug.png");
      await primaryPage.screenshot({ path: errPath, fullPage: true });
    }
    await primaryPage.close();

    console.log("\n=== TIER 2 & TIER 3 CAPTURE COMPLETE ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
