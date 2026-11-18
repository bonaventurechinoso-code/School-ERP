import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";
const PUBLIC_SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");

if (!fs.existsSync(PUBLIC_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14-pro", width: 393, height: 852 },
  { name: "pixel-7", width: 412, height: 915 },
];

async function main() {
  console.log("=== VERIFYING MOBILE ONBOARDING 'NEXT STEP' ACTION BUTTON & FORM RESIZE ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 60000,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n========================================`);
      console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`========================================`);

      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
      await page.goto("http://localhost:3000/register", { waitUntil: "networkidle0", timeout: 30000 });

      // 1. Initial State Check (Without scrolling)
      const initialMetrics = await page.evaluate(() => {
        const nextBtn = document.querySelector('button[type="submit"]');
        if (!nextBtn) return { hasBtn: false };

        const btnRect = nextBtn.getBoundingClientRect();

        const isVisibleInViewport = (
          btnRect.top >= 0 &&
          btnRect.top < window.innerHeight &&
          btnRect.bottom <= window.innerHeight + 10
        );

        return {
          hasBtn: true,
          btnText: (nextBtn as HTMLElement).innerText.trim(),
          top: Math.round(btnRect.top),
          bottom: Math.round(btnRect.bottom),
          height: Math.round(btnRect.height),
          viewportHeight: window.innerHeight,
          isVisibleInViewport,
        };
      });

      console.log(`[${vp.name}] Initial Next Button Metrics:`, JSON.stringify(initialMetrics, null, 2));

      const initScreenshot = `mobile-step1-initial-${vp.name}.png`;
      await page.screenshot({ path: path.join(ARTIFACT_DIR, initScreenshot), fullPage: false });
      try { fs.copyFileSync(path.join(ARTIFACT_DIR, initScreenshot), path.join(PUBLIC_SCREENSHOTS_DIR, initScreenshot)); } catch(e){}

      if (!initialMetrics.hasBtn) {
        throw new Error(`[${vp.name}] Failed: Next Step button is not found in DOM!`);
      }
      if (!initialMetrics.isVisibleInViewport) {
        throw new Error(`[${vp.name}] Failed: Next Step button is not immediately visible in viewport! btnBottom=${initialMetrics.bottom}, vh=${initialMetrics.viewportHeight}`);
      }

      // 2. Fill form inputs with unique name so subdomain is guaranteed available
      const uniqueSuffix = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
      const schoolName = `Apex Acad ${uniqueSuffix}`;

      await page.type('#institutionName', schoolName);
      await page.type('#adminEmail', `admin.${uniqueSuffix}@apex.edu`);
      await page.type('#adminPhone', '08012345678');
      await page.type('#adminPassword', 'Password123!');
      await page.type('#confirmPassword', 'Password123!');

      // Wait for slug check to show "Available"
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('span')).some(el => el.textContent?.includes('Available'));
      }, { timeout: 10000 });

      const filledScreenshot = `mobile-step1-filled-${vp.name}.png`;
      await page.screenshot({ path: path.join(ARTIFACT_DIR, filledScreenshot), fullPage: false });
      try { fs.copyFileSync(path.join(ARTIFACT_DIR, filledScreenshot), path.join(PUBLIC_SCREENSHOTS_DIR, filledScreenshot)); } catch(e){}

      // Check confirm password visibility
      const confirmVisible = await page.evaluate(() => {
        const confirmInput = document.getElementById('confirmPassword');
        if (!confirmInput) return false;
        const rect = confirmInput.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
      console.log(`[${vp.name}] Confirm Password Input Visible in Viewport:`, confirmVisible);

      // 3. Click the Next Step button
      console.log(`[${vp.name}] Clicking 'Next Step: Select Tiers' button...`);
      const nextBtnElement = await page.$('button[type="submit"]');
      if (!nextBtnElement) throw new Error("Could not find submit button element");
      await nextBtnElement.click();

      // Wait for step 2 transition
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('h3')).some(el => el.textContent?.includes('Academic Tier Allocation'));
      }, { timeout: 10000 });

      const step2Metrics = await page.evaluate(() => {
        const stepBadge = Array.from(document.querySelectorAll('span')).find(el => el.textContent?.includes('Step 2 of 2'));
        const tierHeading = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.includes('Academic Tier Allocation'));
        const backBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.includes('Back'));
        const completeBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.includes('Complete Registration'));

        return {
          isStep2: !!stepBadge && !!tierHeading,
          hasBackBtn: !!backBtn,
          hasCompleteBtn: !!completeBtn,
        };
      });

      console.log(`[${vp.name}] Step 2 Transition Metrics:`, JSON.stringify(step2Metrics, null, 2));

      const step2Screenshot = `mobile-step2-transitioned-${vp.name}.png`;
      await page.screenshot({ path: path.join(ARTIFACT_DIR, step2Screenshot), fullPage: false });
      try { fs.copyFileSync(path.join(ARTIFACT_DIR, step2Screenshot), path.join(PUBLIC_SCREENSHOTS_DIR, step2Screenshot)); } catch(e){}

      if (!step2Metrics.isStep2) {
        throw new Error(`[${vp.name}] Failed to transition to Step 2!`);
      }

      await page.close();
    }

    console.log("\n=======================================================");
    console.log(">>> SUCCESS: ALL VIEWPORTS ACCOMMODATE NEXT STEP BUTTON <<<");
    console.log("=======================================================");
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
