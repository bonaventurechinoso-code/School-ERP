import { basePrisma } from "../src/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import { createSchool } from "../src/app/admin/actions";

async function verifyAll() {
  console.log("=================================================================");
  console.log("TEST 1: LANDING PAGE CREATION (Riverside / rivers)");
  console.log("=================================================================");

  const riversSlug = `rivers${Date.now().toString().slice(-4)}`;
  const landingPayload = {
    schoolName: "Riverside secondary school",
    subdomain: riversSlug,
    adminEmail: "gabrielchinonso16@gmail.com",
    contactPhone: "+2348000000000",
    adminPassword: "Password1234",
    password: "Password1234",
    tiers: ["Senior Secondary School"]
  };

  const regRes = await fetch("http://localhost:3000/api/tenants/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(landingPayload)
  });

  const regJson = await regRes.json();
  console.log(`[TEST 1] Register status: ${regRes.status}, success: ${regJson.success}`);

  // Check /admin/tenants query directly
  const adminTenantsQuery = await basePrisma.school.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, subdomain: true, slug: true, status: true }
  });
  const foundInAdmin = adminTenantsQuery.some(s => s.subdomain === riversSlug || s.slug === riversSlug);
  console.log(`[TEST 1] Does ${riversSlug} appear in /admin/tenants DB query? ${foundInAdmin ? "YES ✅" : "NO ❌"}`);

  // Test LOGIN with schoolCode
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: riversSlug,
      email: "gabrielchinonso16@gmail.com",
      password: "Password1234"
    })
  });
  const loginJson = await loginRes.json();
  console.log(`[TEST 1] Login status: ${loginRes.status}, success: ${loginJson.success ? "YES ✅" : "NO ❌"}`);

  // Test FORGOT PASSWORD with schoolDomain
  const forgotRes = await fetch("http://localhost:3000/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolDomain: riversSlug,
      email: "gabrielchinonso16@gmail.com"
    })
  });
  const forgotJson = await forgotRes.json();
  console.log(`[TEST 1] Forgot password status: ${forgotRes.status}, success: ${forgotJson.success ? "YES ✅" : "NO ❌"}`);

  console.log("\n=================================================================");
  console.log("TEST 2: SUPER ADMIN CREATION (St.Mary / stmary)");
  console.log("=================================================================");

  const stmarySlug = `stmary${Date.now().toString().slice(-4)}`;
  const fd = new FormData();
  fd.append("name", "St.Mary secondary school");
  fd.append("subdomain", stmarySlug);
  fd.append("adminEmail", "admin@stmary.edu.ng");
  fd.append("password", "Password1234");
  fd.append("confirmPassword", "Password1234");
  fd.append("contactPhone", "+2348000000000");
  fd.append("tiers", "Senior Secondary School");

  const createResult = await createSchool(fd);
  console.log(`[TEST 2] Super admin createSchool result:`, createResult.success ? "SUCCESS ✅" : "FAIL ❌");

  // Check in admin tenants query
  const adminTenantsQuery2 = await basePrisma.school.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, subdomain: true, slug: true, status: true }
  });
  const foundInAdmin2 = adminTenantsQuery2.some(s => s.subdomain === stmarySlug || s.slug === stmarySlug);
  console.log(`[TEST 2] Does ${stmarySlug} appear in /admin/tenants DB query? ${foundInAdmin2 ? "YES ✅" : "NO ❌"}`);

  // Test LOGIN for stmary
  const loginRes2 = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: stmarySlug,
      email: "admin@stmary.edu.ng",
      password: "Password1234"
    })
  });
  const loginJson2 = await loginRes2.json();
  console.log(`[TEST 2] Login status: ${loginRes2.status}, success: ${loginJson2.success ? "YES ✅" : "NO ❌"}`);

  // Test FORGOT PASSWORD for stmary
  const forgotRes2 = await fetch("http://localhost:3000/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolDomain: stmarySlug,
      email: "admin@stmary.edu.ng"
    })
  });
  const forgotJson2 = await forgotRes2.json();
  console.log(`[TEST 2] Forgot password status: ${forgotRes2.status}, success: ${forgotJson2.success ? "YES ✅" : "NO ❌"}`);

  console.log("\n=================================================================");
  console.log("TEST 3: VERIFY EXISTING DEMO TENANT STILL LOGS IN");
  console.log("=================================================================");

  const demoLoginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: "demo",
      email: "headmaster@demo.edu.ng",
      password: "Password123"
    })
  });
  const demoLoginJson = await demoLoginRes.json();
  console.log(`[TEST 3] Demo tenant login status: ${demoLoginRes.status}, success: ${demoLoginJson.success ? "YES ✅" : "NO ❌"}`);

  console.log("\n=================================================================");
  console.log("TEST 4: VERIFY SERVER LOGGING (tenant-not-found / user-not-found / password-mismatch)");
  console.log("=================================================================");

  // 4A: Tenant not found
  const badTenantRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: "nonexistenttenant999",
      email: "someone@example.com",
      password: "Password1234"
    })
  });
  console.log(`[TEST 4A] Bad tenant status: ${badTenantRes.status}, error message preserved: "${(await badTenantRes.json()).error}"`);

  // 4B: User not found in valid tenant
  const badUserRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: demoLoginJson.schoolDomain || "demo",
      email: "nonexistentuser@demo.edu.ng",
      password: "Password1234"
    })
  });
  console.log(`[TEST 4B] Bad user status: ${badUserRes.status}, error message preserved: "${(await badUserRes.json()).error}"`);

  // 4C: Password mismatch
  const badPassRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: demoLoginJson.schoolDomain || "demo",
      email: "headmaster@demo.edu.ng",
      password: "WrongPassword999!"
    })
  });
  console.log(`[TEST 4C] Bad password status: ${badPassRes.status}, error message preserved: "${(await badPassRes.json()).error}"`);
}

verifyAll().catch(console.error).finally(() => process.exit(0));
