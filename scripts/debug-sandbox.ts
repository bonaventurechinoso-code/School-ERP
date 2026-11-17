import puppeteer from "puppeteer-core";
import path from "path";
import { basePrisma } from "../src/lib/tenant-prisma";

const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    defaultViewport: { width: 1440, height: 1100 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    page.on("requestfailed", (req) => console.log("REQ FAILED:", req.url(), req.failure()?.errorText));
    page.on("response", (res) => {
      if (res.status() >= 300 && res.status() < 400) {
        console.log(`REDIRECT ${res.status()}: ${res.url()} -> ${res.headers()["location"]}`);
      }
    });

    console.log("Navigating to http://localhost:3000/sandbox/report-cards...");
    await page.goto("http://localhost:3000/sandbox/report-cards", { waitUntil: "networkidle2" });
  } finally {
    await browser.close();
    await basePrisma.$disconnect();
  }
}

main().catch(console.error);
