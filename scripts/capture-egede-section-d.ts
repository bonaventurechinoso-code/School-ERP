import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import { basePrisma } from "../src/lib/tenant-prisma";
import { createDatabaseSession } from "../src/lib/session-manager";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";
const PUBLIC_SCREENSHOTS_DIR = path.join(__dirname, "..", "public", "screenshots");

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    defaultViewport: { width: 1440, height: 1100 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
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

    const page = await browser.newPage();
    await page.setCookie(
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
      }
    );

    await page.goto("http://egede.localhost:3000/staff?tier=Primary%20School", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));

    // Click Onboard New Staff
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.includes("Onboard New Staff"));
      if (btn) btn.click();
    });

    await page.waitForSelector(".fixed.inset-0", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2500));

    // Scroll Section D into view inside modal scroll container
    const classList = await page.evaluate(() => {
      const modalScroll = document.querySelector(".fixed.inset-0 .overflow-y-auto");
      const selects = Array.from(document.querySelectorAll(".fixed.inset-0 select"));
      // The class assigned select is inside Section D
      const classSelect = selects.find((s) =>
        Array.from(s.options).some((o) => o.text.includes("Primary") || o.text.includes("Nursery") || o.text.includes("Creche"))
      );
      if (classSelect && modalScroll) {
        classSelect.scrollIntoView({ behavior: "smooth", block: "center" });
        return Array.from(classSelect.options).map((o) => o.text);
      }
      return [];
    });

    console.log("EGEDE PRIMARY MODAL CLASS DROPDOWN LIST:", classList);
    await new Promise((r) => setTimeout(r, 1000));

    const outPath = path.join(ARTIFACT_DIR, "tier3-egede-primary-section-d.png");
    const publicPath = path.join(PUBLIC_SCREENSHOTS_DIR, "tier3-egede-primary-section-d.png");
    await page.screenshot({ path: outPath, fullPage: false });
    fs.copyFileSync(outPath, publicPath);
    console.log("✅ SUCCESS: Captured tier3-egede-primary-section-d.png");

    await page.close();
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
