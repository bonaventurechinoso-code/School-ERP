const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
const jose = require("jose");

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\362f6193-ea22-4062-84a4-8adfa010f82e";
const PUBLIC_SCREENSHOTS_DIR = path.join(__dirname, "..", "public", "screenshots");

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function generateSsoToken(subdomain) {
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
  console.log("=== CAPTURING BOLD & BRIGHT SIDEBAR SCREENSHOT ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 120000,
    defaultViewport: { width: 1366, height: 950 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const domain = "demo-secondary";
    const ssoToken = await generateSsoToken(domain);
    const url = `http://localhost:3000/${domain}/dashboard?sso_token=${ssoToken}`;

    const page = await browser.newPage();
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 4000));

    // Capture sidebar
    const sidebarArtifact = path.join(ARTIFACT_DIR, "sidebar-apps-bold.png");
    const sidebarPublic = path.join(PUBLIC_SCREENSHOTS_DIR, "sidebar-apps-bold.png");
    await page.screenshot({ path: sidebarArtifact, fullPage: false });
    await page.screenshot({ path: sidebarPublic, fullPage: false });
    console.log(`✅ Captured bold & bright sidebar: ${sidebarArtifact}`);

  } catch (err) {
    console.error("Error capturing sidebar:", err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
