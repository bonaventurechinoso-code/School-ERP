import puppeteer from "puppeteer-core";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function main() {
  const ssoToken = await new jose.SignJWT({
    isSuperAdmin: true,
    role: "SUPER_ADMIN",
    type: "super_admin_sso",
    email: "superadmin@bonaveeict.com.ng",
    subdomain: "egede",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(SECRET_KEY);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  const url = `http://localhost:3000/egede/staff?tier=Primary%20School&sso_token=${ssoToken}`;
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  const text = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT SNIPPET:\n", text.slice(0, 500));

  const currentUrl = page.url();
  console.log("Current URL:", currentUrl);

  await browser.close();
}

main().catch(console.error);
