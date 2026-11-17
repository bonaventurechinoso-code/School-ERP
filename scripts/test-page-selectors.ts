import puppeteer from "puppeteer-core";
import * as jose from "jose";
import path from "path";
import fs from "fs";
import { basePrisma } from "../src/lib/tenant-prisma";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";

async function main() {
  const demoSchool = await basePrisma.school.findUnique({ where: { subdomain: "demo" } });
  const sandboxSchool = await basePrisma.school.findUnique({ where: { subdomain: "sandbox" } });

  if (!demoSchool || !sandboxSchool) {
    throw new Error("Demo or Sandbox school not found");
  }

  const JWT_SECRET = process.env.JWT_SECRET_KEY || "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(JWT_SECRET);

  async function createToken(subdomain: string, schoolId: string, schoolName: string) {
    const tokenId = `${subdomain}-session-${Date.now()}`;
    return new jose.SignJWT({
      jti: tokenId,
      sessionToken: tokenId,
      sessionId: tokenId,
      id: tokenId,
      token: tokenId,
      userId: `${subdomain}-admin-staff`,
      email: `${subdomain}.admin@schoolerp.local`,
      tenantId: schoolId,
      schoolId: schoolId,
      schoolDomain: subdomain,
      tenantName: schoolName,
      role: "TENANT_ADMIN",
      userRole: "TENANT_ADMIN",
      staffRole: "School Administrator",
      activeTiers: [
        "Creche / Nursery",
        "Primary School",
        "Secondary School",
        "Higher Institution / University",
      ],
      permissions: ["*"],
      isDemo: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    defaultViewport: { width: 1440, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    // -------------------------------------------------------------
    // BABATUNDE (ND 1) - DEMO
    // -------------------------------------------------------------
    console.log("Navigating to Demo Report Cards...");
    const demoToken = await createToken("demo", demoSchool.id, demoSchool.name);
    await page.setCookie(
      { name: "session", value: demoToken, domain: "localhost", path: "/" },
      { name: "accessToken", value: demoToken, domain: "localhost", path: "/" }
    );

    await page.goto("http://localhost:3000/demo/report-cards", { waitUntil: "networkidle2" });
    await page.waitForSelector("select", { timeout: 10000 });

    // Inspect the select elements on page
    const selectInfo = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      return selects.map((s, idx) => ({
        index: idx,
        value: s.value,
        options: Array.from(s.options).map((o) => ({ value: o.value, text: o.text })),
      }));
    });
    console.log("Found selects on Demo:", JSON.stringify(selectInfo, null, 2));

  } finally {
    await browser.close();
    await basePrisma.$disconnect();
  }
}

main().catch(console.error);
