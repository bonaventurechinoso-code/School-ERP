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
  console.log("=== VERIFYING MOBILE ONBOARDING FORM PASSWORD CONFIRMATION ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 60000,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
      await page.goto("http://localhost:3000/register", { waitUntil: "networkidle0", timeout: 30000 });

      // Type Admin Password and Confirm Password to test matching feedback
      await page.type('#adminPassword', 'Enterprise2026!');
      await page.type('#confirmPassword', 'Enterprise2026!');
      await new Promise((r) => setTimeout(r, 600));

      // Scroll to bottom of outer scroll container
      await page.evaluate(() => {
        const scrollable = document.querySelector('.overflow-y-auto') || document.documentElement;
        scrollable.scrollTop = scrollable.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((r) => setTimeout(r, 500));

      const filename = `mobile-register-${vp.name}-verified.png`;
      const artifactPath = path.join(ARTIFACT_DIR, filename);
      const publicPath = path.join(PUBLIC_SCREENSHOTS_DIR, filename);

      await page.screenshot({ path: artifactPath, fullPage: false });
      try {
        fs.copyFileSync(artifactPath, publicPath);
      } catch (e) {}

      console.log(`Saved screenshot: ${artifactPath}`);

      // Evaluate bounding boxes
      const check = await page.evaluate(() => {
        const confirmInput = document.getElementById("confirmPassword");
        const adminInput = document.getElementById("adminPassword");
        const submitBtn = document.querySelector('button[type="submit"]');
        const footer = submitBtn?.closest('div');

        const confirmRect = confirmInput?.getBoundingClientRect();
        const adminRect = adminInput?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();

        const matchIndicator = Array.from(document.querySelectorAll('span')).find(el => el.textContent?.includes('Passwords match'));

        return {
          adminVisible: adminRect ? (adminRect.bottom > 0 && adminRect.top < window.innerHeight) : false,
          confirmVisible: confirmRect ? (confirmRect.bottom > 0 && confirmRect.top < window.innerHeight) : false,
          confirmTop: confirmRect?.top,
          confirmBottom: confirmRect?.bottom,
          footerTop: footerRect?.top,
          footerBottom: footerRect?.bottom,
          isConfirmAboveFooter: confirmRect && footerRect ? confirmRect.bottom <= footerRect.top : false,
          hasMatchIndicator: !!matchIndicator,
          matchText: matchIndicator?.textContent?.trim(),
        };
      });

      console.log(`Diagnostics for ${vp.name}:`, JSON.stringify(check, null, 2));

      if (!check.confirmVisible || !check.isConfirmAboveFooter) {
        throw new Error(`FAILURE on ${vp.name}: Confirm password is not visible or overlaps footer!`);
      }

      await page.close();
    }

    console.log("\n>>> ALL MOBILE VIEWPORT TESTS PASSED PERFECTLY! <<<");

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
