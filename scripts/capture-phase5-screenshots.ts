import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";

async function main() {
  console.log("=== CAPTURING PHASE 5 TERTIARY LIVE SCREENSHOTS ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    defaultViewport: { width: 1440, height: 1100 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    // -----------------------------------------------------------------------
    // 1. BABATUNDE ADEYEMI (ND 1) - DEMO SCHOOL
    // -----------------------------------------------------------------------
    console.log("\n[1/2] Capturing Babatunde Adeyemi (ND 1) in Demo School...");
    const demoPage = await browser.newPage();
    await demoPage.goto("http://localhost:3000/demo/report-cards", { waitUntil: "networkidle2", timeout: 60000 });
    await demoPage.waitForSelector("select", { timeout: 15000 });

    console.log("Setting Class to ND 1...");
    await demoPage.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const classSelect = selects[2];
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(classSelect, "ND 1");
      } else {
        classSelect.value = "ND 1";
      }
      classSelect.dispatchEvent(new Event("input", { bubbles: true }));
      classSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await new Promise((r) => setTimeout(r, 1500));

    console.log("Setting Semester to 1st Semester...");
    await demoPage.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const semSelect = selects[1];
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(semSelect, "1st Semester");
      } else {
        semSelect.value = "1st Semester";
      }
      semSelect.dispatchEvent(new Event("input", { bubbles: true }));
      semSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    console.log("Waiting for Babatunde Adeyemi (APX/2026/ND1/001) row to appear in roster...");
    await demoPage.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("tr")).some(
          (r) => r.innerText.includes("APX/2026/ND1/001") || (r.innerText.includes("Adeyemi") && r.innerText.includes("Babatunde"))
        ),
      { timeout: 45000 }
    );
    console.log("Found Babatunde Adeyemi in roster!");

    console.log("Clicking 'View Sheet' to open Babatunde modal...");
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
    await demoPage.waitForSelector('[role="dialog"], .fixed.inset-0', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2500));

    const babatundePath = path.join(ARTIFACT_DIR, "babatunde-nd1-live-report.png");
    await demoPage.screenshot({ path: babatundePath, fullPage: false });
    console.log("✅ Babatunde Adeyemi modal screenshot captured successfully:", babatundePath);
    await demoPage.close();

    // -----------------------------------------------------------------------
    // 2. EMEKA OKAFOR (100 LEVEL) - SANDBOX SCHOOL
    // -----------------------------------------------------------------------
    console.log("\n[2/2] Capturing Emeka Okafor (100 Level) in Sandbox School...");
    const sandboxPage = await browser.newPage();
    await sandboxPage.goto("http://localhost:3000/sandbox/report-cards", { waitUntil: "networkidle2", timeout: 60000 });
    await sandboxPage.waitForSelector("select", { timeout: 15000 });

    console.log("Setting Class to 100 Level...");
    await sandboxPage.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const classSelect = selects[2];
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(classSelect, "100 Level");
      } else {
        classSelect.value = "100 Level";
      }
      classSelect.dispatchEvent(new Event("input", { bubbles: true }));
      classSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await new Promise((r) => setTimeout(r, 1500));

    console.log("Setting Semester to 1st Semester...");
    await sandboxPage.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const semSelect = selects[1];
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(semSelect, "1st Semester");
      } else {
        semSelect.value = "1st Semester";
      }
      semSelect.dispatchEvent(new Event("input", { bubbles: true }));
      semSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    console.log("Waiting for Emeka Okafor (TSA/2026/100L/001) row to appear in roster...");
    await sandboxPage.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("tr")).some(
          (r) => r.innerText.includes("TSA/2026/100L/001") || (r.innerText.includes("Okafor") && r.innerText.includes("Emeka"))
        ),
      { timeout: 45000 }
    );
    console.log("Found Emeka Okafor in roster!");

    console.log("Clicking 'View Sheet' to open Emeka modal...");
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
    await sandboxPage.waitForSelector('[role="dialog"], .fixed.inset-0', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2500));

    const emekaPath = path.join(ARTIFACT_DIR, "emeka-100l-live-report.png");
    await sandboxPage.screenshot({ path: emekaPath, fullPage: false });
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
