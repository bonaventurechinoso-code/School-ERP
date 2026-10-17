import { basePrisma } from "../src/lib/tenant-prisma";
import bcrypt from "bcryptjs";

async function runReproduction() {
  console.log("=================================================================");
  console.log("REPRODUCTION STEP 1: Create REAL tenant via LANDING PAGE (/api/tenants/register)");
  console.log("=================================================================");

  const payloadLanding = {
    schoolName: "TestRiverside Secondary",
    subdomain: "testrivers",
    adminEmail: "gabrielchinonso16@gmail.com",
    contactPhone: "+2348000000000",
    adminPassword: "Password1234",
    password: "Password1234",
    tiers: ["SECONDARY"]
  };

  const registerRes = await fetch("http://localhost:3000/api/tenants/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadLanding)
  });

  const registerStatus = registerRes.status;
  const registerJson = await registerRes.json().catch(() => null);
  console.log(`[1] Register Response Status: ${registerStatus}`);
  console.log(`[1] Register Response Body:`, JSON.stringify(registerJson, null, 2));

  console.log("\n=================================================================");
  console.log("REPRODUCTION STEP 2: Check if testrivers appears in /admin/tenants");
  console.log("=================================================================");
  const adminTenantsRes = await fetch("http://localhost:3000/admin/tenants");
  const adminTenantsHtml = await adminTenantsRes.text();
  const appearsInAdmin = adminTenantsHtml.includes("testrivers") || adminTenantsHtml.includes("TestRiverside");
  console.log(`[2] Does testrivers appear in /admin/tenants HTML? ${appearsInAdmin ? "YES" : "NO"}`);

  console.log("\n=================================================================");
  console.log("REPRODUCTION STEP 3: Try LOGIN: School Code = testrivers, Email = gabrielchinonso16@gmail.com, Password = Password1234");
  console.log("=================================================================");
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: "testrivers",
      email: "gabrielchinonso16@gmail.com",
      password: "Password1234"
    })
  });
  const loginStatus = loginRes.status;
  const loginJson = await loginRes.json().catch(() => null);
  console.log(`[3] Login Status: ${loginStatus}`);
  console.log(`[3] Login Response:`, JSON.stringify(loginJson, null, 2));

  console.log("\n=================================================================");
  console.log("REPRODUCTION STEP 4: Try FORGOT PASSWORD: Same credentials");
  console.log("=================================================================");
  const forgotRes = await fetch("http://localhost:3000/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolDomain: "testrivers",
      email: "gabrielchinonso16@gmail.com"
    })
  });
  const forgotStatus = forgotRes.status;
  const forgotJson = await forgotRes.json().catch(() => null);
  console.log(`[4] Forgot Password Status: ${forgotStatus}`);
  console.log(`[4] Forgot Password Response:`, JSON.stringify(forgotJson, null, 2));

  console.log("\n=================================================================");
  console.log("REPRODUCTION STEP 5: Query DB for testrivers");
  console.log("=================================================================");
  const tenantRows: any[] = await basePrisma.$queryRawUnsafe(
    `SELECT id, slug, subdomain, status FROM "School" WHERE slug='testrivers' OR subdomain='testrivers'`
  );
  console.log(`[5] School row in platform DB:`, tenantRows);

  const userRows: any[] = await basePrisma.$queryRawUnsafe(
    `SELECT id, email, role, "passwordHash", "schoolId" FROM "User" WHERE email='gabrielchinonso16@gmail.com'`
  );
  console.log(`[5] User rows in platform DB:`, userRows);

  if (userRows.length > 0) {
    for (const u of userRows) {
      const match = await bcrypt.compare("Password1234", u.passwordHash);
      console.log(`[5] User ${u.email} bcrypt.compare('Password1234', stored_hash) => ${match}`);
    }
  }

  // Check tenant schema
  try {
    const tenantUsers: any[] = await basePrisma.$queryRawUnsafe(
      `SELECT * FROM "tenant_testrivers"."User" LIMIT 5;`
    );
    console.log(`[5] User in tenant_testrivers schema:`, tenantUsers);
  } catch (err: any) {
    console.log(`[5] Tenant schema tenant_testrivers check: ${err.message}`);
  }

  console.log("\n=================================================================");
  console.log("REPRODUCTION STEP 6: Super Admin creation with slug = teststmary");
  console.log("=================================================================");
  // Let's call the super admin createSchool or the super admin drawer endpoint
  // In super admin drawer, RegisterSchoolForm submits to /api/tenants/register or createSchool
  // But wait! Let's see what createSchool does directly!
  const { createSchool } = await import("../src/app/admin/actions");
  const fd = new FormData();
  fd.append("name", "TestStMary Secondary");
  fd.append("subdomain", "teststmary");
  fd.append("adminEmail", "gabrielchinonso16@gmail.com");
  fd.append("password", "Password1234");
  fd.append("confirmPassword", "Password1234");
  fd.append("contactPhone", "+2348000000000");
  fd.append("tiers", "Senior Secondary School");

  console.log(`[6] Invoking createSchool action (Super Admin)...`);
  await createSchool(fd).catch(e => console.error("createSchool error:", e));

  // Check if teststmary appears in /admin/tenants
  const adminTenantsRes2 = await fetch("http://localhost:3000/admin/tenants");
  const adminTenantsHtml2 = await adminTenantsRes2.text();
  const appearsInAdmin2 = adminTenantsHtml2.includes("teststmary") || adminTenantsHtml2.includes("TestStMary");
  console.log(`[6] Does teststmary appear in /admin/tenants HTML? ${appearsInAdmin2 ? "YES" : "NO"}`);

  // Try LOGIN
  const loginRes2 = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: "teststmary",
      email: "gabrielchinonso16@gmail.com",
      password: "Password1234"
    })
  });
  const loginStatus2 = loginRes2.status;
  const loginJson2 = await loginRes2.json().catch(() => null);
  console.log(`[6] Super Admin created tenant Login Status: ${loginStatus2}`);
  console.log(`[6] Super Admin created tenant Login Response:`, JSON.stringify(loginJson2, null, 2));

  // Try FORGOT PASSWORD
  const forgotRes2 = await fetch("http://localhost:3000/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolDomain: "teststmary",
      email: "gabrielchinonso16@gmail.com"
    })
  });
  const forgotStatus2 = forgotRes2.status;
  const forgotJson2 = await forgotRes2.json().catch(() => null);
  console.log(`[6] Super Admin created tenant Forgot Password Status: ${forgotStatus2}`);
  console.log(`[6] Super Admin created tenant Forgot Password Response:`, JSON.stringify(forgotJson2, null, 2));

  // Query DB for teststmary
  const tenantRows2: any[] = await basePrisma.$queryRawUnsafe(
    `SELECT id, slug, subdomain, status FROM "School" WHERE slug='teststmary' OR subdomain='teststmary'`
  );
  console.log(`[6] School row for teststmary in platform DB:`, tenantRows2);

  const userRows2: any[] = await basePrisma.$queryRawUnsafe(
    `SELECT id, email, role, "passwordHash", "schoolId" FROM "User" WHERE email='gabrielchinonso16@gmail.com' AND "schoolId"='${tenantRows2[0]?.id}'`
  );
  console.log(`[6] User row for teststmary in platform DB:`, userRows2);

  if (userRows2.length > 0) {
    const match2 = await bcrypt.compare("Password1234", userRows2[0].passwordHash);
    console.log(`[6] User ${userRows2[0].email} bcrypt.compare('Password1234', stored_hash) => ${match2}`);
  }
}

runReproduction().catch(console.error).finally(() => process.exit(0));
