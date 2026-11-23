const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
const jose = require("jose");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ARTIFACT_DIR = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\362f6193-ea22-4062-84a4-8adfa010f82e";
const PUBLIC_SCREENSHOTS_DIR = path.join(__dirname, "..", "public", "screenshots");

if (!fs.existsSync(PUBLIC_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });
}

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
  console.log("=== VERIFYING SECONDARY STAFF ONBOARDING & OPTION 1 MAPPING ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    protocolTimeout: 120000,
    defaultViewport: { width: 1366, height: 950 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const domain = "demo-secondary";
    const tierParam = "Secondary School";
    console.log(`Generating SSO access for ${domain}...`);
    const ssoToken = await generateSsoToken(domain);
    const url = `http://localhost:3000/${domain}/staff?tier=${encodeURIComponent(tierParam)}&sso_token=${ssoToken}`;

    const page = await browser.newPage();
    page.on("console", (m) => console.log("[Browser Console]", m.text()));

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 4000));

    console.log("Waiting for 'Onboard New Staff' button...");
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some((b) => b.innerText.includes("Onboard New Staff"));
    }, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));

    console.log("Clicking 'Onboard New Staff' button...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.includes("Onboard New Staff"));
      if (btn) btn.click();
    });

    console.log("Waiting for modal container...");
    await page.waitForSelector("#section-d-container", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Scroll to Section D (Closed State)
    console.log("Scrolling to Section D (Closed State)...");
    await page.evaluate(() => {
      const secD = document.getElementById("section-d-container");
      if (secD) secD.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 1000));

    // CAPTURE 1: Section D CLOSED
    const closedArtifact = path.join(ARTIFACT_DIR, "secondary-staff-section-d-closed.png");
    const closedPublic = path.join(PUBLIC_SCREENSHOTS_DIR, "secondary-staff-section-d-closed.png");
    await page.screenshot({ path: closedArtifact, fullPage: false });
    await page.screenshot({ path: closedPublic, fullPage: false });
    console.log(`✅ Captured Section D CLOSED: ${closedArtifact}`);

    // Click on "Classes / Arms Taught" dropdown to OPEN it
    console.log("Opening Classes / Arms Taught dropdown...");
    await page.evaluate(() => {
      const classesDropdownTrigger = document.querySelector("#field-teachingClasses [role='button']");
      if (classesDropdownTrigger) classesDropdownTrigger.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // CAPTURE 2: Section D OPEN
    const openArtifact = path.join(ARTIFACT_DIR, "secondary-staff-section-d-open.png");
    const openPublic = path.join(PUBLIC_SCREENSHOTS_DIR, "secondary-staff-section-d-open.png");
    await page.screenshot({ path: openArtifact, fullPage: false });
    await page.screenshot({ path: openPublic, fullPage: false });
    console.log(`✅ Captured Section D OPEN: ${openArtifact}`);

    // Select JSS 1A and JSS 1B checkboxes inside the dropdown
    console.log("Selecting JSS 1A and JSS 1B in classes dropdown...");
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("#field-teachingClasses label"));
      labels.forEach((l) => {
        if (l.innerText.includes("JSS 1A") || l.innerText.includes("JSS 1B")) {
          const input = l.querySelector("input[type='checkbox']");
          if (input && !input.checked) input.click();
        }
      });
      // Click 'Done' in footer
      const buttons = Array.from(document.querySelectorAll("#field-teachingClasses button"));
      const doneBtn = buttons.find((b) => b.innerText.includes("Done"));
      if (doneBtn) doneBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Select Subjects Taught: Open subjects dropdown and select Mathematics & English Language
    console.log("Selecting subjects in subjects dropdown...");
    await page.evaluate(() => {
      const subjectsTrigger = document.querySelector("#field-subjects [role='button']");
      if (subjectsTrigger) subjectsTrigger.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("#field-subjects label"));
      labels.forEach((l) => {
        if (l.innerText.includes("Mathematics") || l.innerText.includes("English Language")) {
          const input = l.querySelector("input[type='checkbox']");
          if (input && !input.checked) input.click();
        }
      });
      const buttons = Array.from(document.querySelectorAll("#field-subjects button"));
      const doneBtn = buttons.find((b) => b.innerText.includes("Done"));
      if (doneBtn) doneBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Fill the rest of the form to submit and test saving
    console.log("Filling form fields for full save verification...");
    const testEmail = `chidi.okafor.${Date.now()}@greenwood.edu.ng`;

    // 1. Select Staff Role (Subject Teacher) via StaffRolePickerForm
    console.log("Selecting Staff Role (Subject Teacher)...");
    await page.evaluate(() => {
      const trigger = document.getElementById("staff-role-picker");
      if (trigger) trigger.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("[role='option']"));
      const target = opts.find((o) => o.innerText.includes("Subject Teacher"));
      if (target) target.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 2. Select Gender (Male)
    await page.evaluate(() => {
      const genderSelect = document.querySelector("#field-gender select");
      if (genderSelect) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSetter.call(genderSelect, "Male");
        genderSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const fieldsToFill = [
      { sel: "#field-firstName input", val: "Chidi" },
      { sel: "#field-lastName input", val: "Okafor" },
      { sel: "#field-dateOfBirth input", val: "1992-06-15" },
      { sel: "#field-phone input", val: "08031234567" },
      { sel: "#field-email input", val: testEmail },
      { sel: "#field-residentialAddress input", val: "Plot 12 Independence Layout, Enugu" },
      { sel: "#field-lga input", val: "Enugu North" },
      { sel: "#field-dateOfEmployment input", val: "2024-09-01" },
      { sel: "#field-fieldOfStudy input", val: "Mathematics Education" },
      { sel: "#field-trcnNumber input", val: "TRCN/EN/2023/12345" },
      { sel: "#field-nextOfKinName input", val: "Ngozi Okafor" },
      { sel: "#field-nextOfKinPhone input", val: "08039876543" },
    ];

    for (const f of fieldsToFill) {
      await page.evaluate((sel, val) => {
        const el = document.querySelector(sel);
        if (el) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          nativeSetter.call(el, val);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, f.sel, f.val);
    }

    // Selects
    await page.evaluate(() => {
      const st = document.querySelector("#field-state select");
      if (st) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSetter.call(st, "Enugu");
        st.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const empType = document.querySelector("#field-employmentType select");
      if (empType) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSetter.call(empType, "Full-time");
        empType.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const dept = document.querySelector("#field-departmentName select");
      if (dept) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSetter.call(dept, "Sciences");
        dept.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const qual = document.querySelector("#field-qualification select");
      if (qual) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSetter.call(qual, "B.Ed (Bachelor of Education)");
        qual.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const nokRel = document.querySelector("#field-nextOfKinRelationship select");
      if (nokRel) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        nativeSetter.call(nokRel, "Spouse");
        nokRel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await new Promise((r) => setTimeout(r, 1500));

    // Scroll to bottom and click Submit
    console.log("Submitting the onboarding form...");
    await page.evaluate(() => {
      const submitBtn = document.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.click();
    });

    console.log("Waiting for submission result...");
    await new Promise((r) => setTimeout(r, 6000));

    // CAPTURE 3: Save Success
    const saveArtifact = path.join(ARTIFACT_DIR, "secondary-staff-save-success.png");
    const savePublic = path.join(PUBLIC_SCREENSHOTS_DIR, "secondary-staff-save-success.png");
    await page.screenshot({ path: saveArtifact, fullPage: false });
    await page.screenshot({ path: savePublic, fullPage: false });
    console.log(`✅ Captured Save Success: ${saveArtifact}`);

    // Verify in database: Find newly created staff and assignments
    console.log("Verifying assignments created in DB...");
    const createdStaff = await prisma.staff.findFirst({
      where: { email: testEmail },
      include: {
        assignments: {
          include: { classroom: true }
        }
      }
    });

    console.log("=== CREATED STAFF IN DB ===");
    if (createdStaff) {
      console.log(`Staff ID: ${createdStaff.staffId}, Name: ${createdStaff.firstName} ${createdStaff.lastName}`);
      console.log(`Assignments Count: ${createdStaff.assignments.length}`);
      createdStaff.assignments.forEach((a, i) => {
        console.log(`Assignment ${i + 1}: type=${a.assignmentType}, classroomId=${a.classroomId}, classroomName=${a.classroom ? a.classroom.name : null}, metadata=${a.metadata}`);
      });
    } else {
      console.log("No staff found with email:", testEmail);
    }

  } catch (err) {
    console.error("Error during capture:", err);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
