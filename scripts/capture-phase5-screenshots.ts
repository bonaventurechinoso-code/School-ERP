import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";
const PUBLIC_SCREENSHOTS_DIR = path.join(__dirname, "..", "public", "screenshots");

if (!fs.existsSync(PUBLIC_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });
}

async function selectTier(page: any, tierName: string) {
  await page.evaluate((targetTier: string) => {
    const selects = Array.from(document.querySelectorAll("select"));
    const tierSelect = selects[0];
    const option = Array.from(tierSelect.options).find(
      (o) => o.text.toLowerCase().includes(targetTier.toLowerCase()) || o.value.toLowerCase().includes(targetTier.toLowerCase())
    );
    if (!option) throw new Error(`Tier option ${targetTier} not found`);
    const val = option.value;
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(tierSelect, val);
    } else {
      tierSelect.value = val;
    }
    tierSelect.dispatchEvent(new Event("input", { bubbles: true }));
    tierSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }, tierName);
}

async function selectClass(page: any, className: string) {
  await page.evaluate((targetClass: string) => {
    const allSelects = Array.from(document.querySelectorAll("select"));
    const classSelect = allSelects.find((s) => Array.from(s.options).some((o) => o.value === targetClass || o.text === targetClass));
    if (!classSelect) {
      throw new Error(`Could not find select with option "${targetClass}"`);
    }
    const option = Array.from(classSelect.options).find((o) => o.value === targetClass || o.text === targetClass);
    const val = option ? option.value : targetClass;
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(classSelect, val);
    } else {
      classSelect.value = val;
    }
    classSelect.dispatchEvent(new Event("input", { bubbles: true }));
    classSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }, className);
}

async function selectSemester(page: any, semesterName: string) {
  await page.evaluate((targetSem: string) => {
    const allSelects = Array.from(document.querySelectorAll("select"));
    const semSelect = allSelects.find((s) => Array.from(s.options).some((o) => o.value === targetSem || o.text === targetSem));
    if (!semSelect) {
      throw new Error(`Could not find select with option "${targetSem}"`);
    }
    const option = Array.from(semSelect.options).find((o) => o.value === targetSem || o.text === targetSem);
    const val = option ? option.value : targetSem;
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(semSelect, val);
    } else {
      semSelect.value = val;
    }
    semSelect.dispatchEvent(new Event("input", { bubbles: true }));
    semSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }, semesterName);
}

async function main() {
  console.log("=== CAPTURING PHASE 5 TERTIARY LIVE SCREENSHOTS ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 120000,
    defaultViewport: { width: 1440, height: 1100 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    // -----------------------------------------------------------------------
    // 1. BABATUNDE ADEYEMI (ND 1) - DEMO SCHOOL
    // -----------------------------------------------------------------------
    console.log("\n[1/2] Capturing Babatunde Adeyemi (ND 1) in Demo School...");
    const demoPage = await browser.newPage();
    demoPage.on("console", (msg: any) => console.log("Demo Console:", msg.text()));
    await demoPage.goto("http://localhost:3000/demo/report-cards", { waitUntil: "networkidle2", timeout: 120000 });
    await demoPage.waitForSelector("select", { timeout: 15000 });

    console.log("Setting Tier to Polytechnic...");
    await selectTier(demoPage, "Polytechnic");
    await new Promise((r) => setTimeout(r, 1500));

    console.log("Setting Class to ND 1...");
    await selectClass(demoPage, "ND 1");
    await new Promise((r) => setTimeout(r, 1500));

    console.log("Setting Semester to 1st Semester...");
    await selectSemester(demoPage, "1st Semester");
    await new Promise((r) => setTimeout(r, 2000));

    console.log("Waiting for Babatunde Adeyemi (APX/2026/ND1/001) row to appear in roster...");
    await demoPage.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("tr")).some(
          (r) => r.innerText.includes("APX/2026/ND1/001") || (r.innerText.includes("Adeyemi") && r.innerText.includes("Babatunde"))
        ),
      { timeout: 30000 }
    );
    console.log("Found Babatunde Adeyemi in roster!");

    // Click "View Sheet"
    await demoPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const targetRow = rows.find(
        (r) => r.innerText.includes("APX/2026/ND1/001") || (r.innerText.includes("Adeyemi") && r.innerText.includes("Babatunde"))
      );
      if (targetRow) {
        const btn = Array.from(targetRow.querySelectorAll("button")).find((b) =>
          b.innerText.includes("View Sheet")
        );
        if (btn) btn.click();
      }
    });

    console.log("Waiting for modal dialog to render...");
    await demoPage.waitForSelector('.fixed.inset-0', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 3000));

    const babatundePath = path.join(ARTIFACT_DIR, "babatunde-nd1-live-report.png");
    await demoPage.screenshot({ path: babatundePath, fullPage: false });
    fs.copyFileSync(babatundePath, path.join(PUBLIC_SCREENSHOTS_DIR, "babatunde-nd1-live-report.png"));
    console.log("✅ Babatunde Adeyemi modal screenshot captured successfully:", babatundePath);
    await demoPage.close();

    // -----------------------------------------------------------------------
    // 2. EMEKA OKAFOR (100 LEVEL) - SANDBOX SCHOOL
    // -----------------------------------------------------------------------
    console.log("\n[2/2] Capturing Emeka Okafor (100 Level) in Sandbox School...");
    const sandboxPage = await browser.newPage();
    sandboxPage.on("console", (msg: any) => console.log("Sandbox Console:", msg.text()));
    await sandboxPage.goto("http://localhost:3000/sandbox/report-cards", { waitUntil: "networkidle2", timeout: 120000 });
    await sandboxPage.waitForSelector("select", { timeout: 15000 });

    console.log("Setting Tier to University...");
    await selectTier(sandboxPage, "University");
    await new Promise((r) => setTimeout(r, 1500));

    console.log("Setting Class to 100 Level...");
    await selectClass(sandboxPage, "100 Level");
    await new Promise((r) => setTimeout(r, 1500));

    console.log("Setting Semester to 1st Semester...");
    await selectSemester(sandboxPage, "1st Semester");
    await new Promise((r) => setTimeout(r, 2000));

    console.log("Waiting for Emeka Okafor (TSA/2026/100L/001) row to appear in roster...");
    await sandboxPage.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("tr")).some(
          (r) => r.innerText.includes("TSA/2026/100L/001") || (r.innerText.includes("Okafor") && r.innerText.includes("Emeka"))
        ),
      { timeout: 30000 }
    );
    console.log("Found Emeka Okafor in roster!");

    await sandboxPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const targetRow = rows.find(
        (r) => r.innerText.includes("TSA/2026/100L/001") || (r.innerText.includes("Okafor") && r.innerText.includes("Emeka"))
      );
      if (targetRow) {
        const btn = Array.from(targetRow.querySelectorAll("button")).find((b) =>
          b.innerText.includes("View Sheet")
        );
        if (btn) btn.click();
      }
    });

    console.log("Waiting for modal dialog to render...");
    await sandboxPage.waitForSelector('.fixed.inset-0', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 3000));

    const emekaPath = path.join(ARTIFACT_DIR, "emeka-100l-live-report.png");
    await sandboxPage.screenshot({ path: emekaPath, fullPage: false });
    fs.copyFileSync(emekaPath, path.join(PUBLIC_SCREENSHOTS_DIR, "emeka-100l-live-report.png"));
    console.log("✅ Emeka Okafor modal screenshot captured successfully:", emekaPath);
    await sandboxPage.close();

    console.log("\n=== ALL SCREENSHOTS CAPTURED SUCCESSFULLY ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
