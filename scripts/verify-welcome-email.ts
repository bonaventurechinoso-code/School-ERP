import { sendSchoolRegistrationSuccessEmail } from "../src/lib/email-service";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

async function main() {
  console.log("=== GENERATING PREVIEWS & SCREENSHOTS FOR VERIFICATION ===");

  const schools = [
    {
      name: "Greenwood Secondary School",
      subdomain: "greenwood-secondary-school",
      email: "admin@greenwood.bonaveeict.com.ng",
      htmlFile: "greenwood-welcome-email.html",
      pngFile: "greenwood-welcome-email.png",
    },
    {
      name: "Bright Future Academy",
      subdomain: "bright-future-academy",
      email: "admin@brightfuture.bonaveeict.com.ng",
      htmlFile: "bright-future-welcome-email.html",
      pngFile: "bright-future-welcome-email.png",
    },
  ];

  const artifactDir = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\6b5dce7a-3df3-4100-827d-6a687470408f";
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  for (const s of schools) {
    const res = await sendSchoolRegistrationSuccessEmail({
      schoolName: s.name,
      subdomain: s.subdomain,
      adminEmail: s.email,
      adminPassword: "SecurePassword2026#",
      tiers: ["SECONDARY"],
    });

    const expectedUrl = `https://${s.subdomain}.bonaveeict.com.ng/login`;
    if (res.portalUrl !== expectedUrl) {
      throw new Error(`Portal URL mismatch: expected ${expectedUrl}, got ${res.portalUrl}`);
    }

    const htmlPath = path.resolve(process.cwd(), s.htmlFile);
    fs.writeFileSync(htmlPath, res.html, "utf-8");
    console.log(`Saved ${s.name} HTML to ${htmlPath}`);

    const pngArtifactPath = path.join(artifactDir, s.pngFile);
    const cmd = `"${chromePath}" --headless --disable-gpu --window-size=700,920 --screenshot="${pngArtifactPath}" "file:///${htmlPath.replace(/\\/g, "/")}"`;
    execSync(cmd, { stdio: "inherit" });
    console.log(`Generated screenshot for ${s.name} at ${pngArtifactPath}`);
  }

  console.log("ALL PREVIEWS & SCREENSHOTS SUCCESSFULLY GENERATED!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
