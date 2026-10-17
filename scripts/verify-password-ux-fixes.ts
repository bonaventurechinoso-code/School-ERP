import { basePrisma } from "../src/lib/tenant-prisma";
import { createSchool } from "../src/app/admin/actions";
import { changeUserPassword } from "../src/lib/security-service";

async function runTests() {
  const ts = Date.now().toString().slice(-4);
  console.log("=================================================================");
  console.log("TEST 1: Register Tenant with STRONG password -> Direct Dashboard");
  console.log("=================================================================");

  const strongSlug = `strong${ts}`;
  const strongPassword = "StrongP@ssw0rd2026!";
  const strongEmail = `admin@${strongSlug}.edu.ng`;

  const reg1Res = await fetch("http://localhost:3000/api/tenants/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolName: `Strong Academy ${ts}`,
      subdomain: strongSlug,
      adminEmail: strongEmail,
      contactPhone: "+2348011112222",
      adminPassword: strongPassword,
      password: strongPassword,
      tiers: ["Senior Secondary School"],
    }),
  });

  const reg1Json = await reg1Res.json();
  console.log(`[TEST 1] Register Response Status: ${reg1Res.status}, Success: ${reg1Json.success}`);

  const user1 = await basePrisma.user.findFirst({
    where: { email: strongEmail },
    select: { id: true, mustChangePassword: true },
  });
  console.log(`[TEST 1] User in DB mustChangePassword: ${user1?.mustChangePassword} (Expected: false)`);

  const login1Res = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: strongSlug,
      email: strongEmail,
      password: strongPassword,
    }),
  });

  const login1Json = await login1Res.json();
  console.log(`[TEST 1] Login Response Status: ${login1Res.status}`);
  console.log(`[TEST 1] Login mustChangePassword: ${login1Json.mustChangePassword} (Expected: false)`);
  console.log(`[TEST 1] Login redirectUrl: ${login1Json.redirectUrl} (Expected: /${strongSlug}/dashboard)`);
  const test1Passed =
    reg1Res.status === 200 &&
    user1?.mustChangePassword === false &&
    login1Json.mustChangePassword === false &&
    login1Json.redirectUrl === `/${strongSlug}/dashboard`;
  console.log(`[TEST 1] Result: ${test1Passed ? "PASSED ✅" : "FAILED ❌"}`);

  console.log("\n=================================================================");
  console.log("TEST 2: Register with WEAK-BUT-VALID password (e.g. Password1#)");
  console.log("=================================================================");

  const weakSlug = `weak${ts}`;
  const weakPassword = "Password1#"; // Meets: >=8 chars, 1 uppercase, 1 digit, 1 special char; Weak: contains "password", only 1 symbol
  const weakEmail = `admin@${weakSlug}.edu.ng`;

  const reg2Res = await fetch("http://localhost:3000/api/tenants/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolName: `Weak Password School ${ts}`,
      subdomain: weakSlug,
      adminEmail: weakEmail,
      contactPhone: "+2348033334444",
      adminPassword: weakPassword,
      password: weakPassword,
      tiers: ["Senior Secondary School"],
    }),
  });

  const reg2Json = await reg2Res.json();
  console.log(`[TEST 2] Register Response Status: ${reg2Res.status}, Success: ${reg2Json.success}`);

  const user2 = await basePrisma.user.findFirst({
    where: { email: weakEmail },
    select: { id: true, mustChangePassword: true },
  });
  console.log(`[TEST 2] User in DB mustChangePassword: ${user2?.mustChangePassword} (Expected: false)`);

  const auditLog2 = await basePrisma.auditLog.findFirst({
    where: {
      action: "PASSWORD_POLICY_UPDATED",
      target: weakEmail,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`[TEST 2] PASSWORD_POLICY_UPDATED Audit Log: ${auditLog2 ? "FOUND ✅" : "NOT FOUND ❌"}`);

  const login2Res = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: weakSlug,
      email: weakEmail,
      password: weakPassword,
    }),
  });

  const login2Json = await login2Res.json();
  console.log(`[TEST 2] Login Response Status: ${login2Res.status}`);
  console.log(`[TEST 2] Login mustChangePassword: ${login2Json.mustChangePassword} (Expected: false)`);
  console.log(`[TEST 2] Login redirectUrl: ${login2Json.redirectUrl} (Expected: /${weakSlug}/dashboard)`);
  const test2Passed =
    reg2Res.status === 200 &&
    user2?.mustChangePassword === false &&
    auditLog2 !== null &&
    login2Json.mustChangePassword === false &&
    login2Json.redirectUrl === `/${weakSlug}/dashboard`;
  console.log(`[TEST 2] Result: ${test2Passed ? "PASSED ✅" : "FAILED ❌"}`);

  console.log("\n=================================================================");
  console.log("TEST 3: Super Admin creates user with temp password -> Forced reset");
  console.log("=================================================================");

  const tempSlug = `super${ts}`;
  const tempEmail = `admin@${tempSlug}.edu.ng`;
  const tempPassword = "Password123";

  const formData = new FormData();
  formData.append("name", `Super Admin Created School ${ts}`);
  formData.append("subdomain", tempSlug);
  formData.append("adminEmail", tempEmail);
  formData.append("contactPhone", "+2348055556666");
  formData.append("password", tempPassword);
  formData.append("confirmPassword", tempPassword);
  formData.append("tiers", "Senior Secondary School");

  const actionResult = await createSchool(formData);
  console.log(`[TEST 3] createSchool Action Success: ${actionResult.success}`);

  const user3 = await basePrisma.user.findFirst({
    where: { email: tempEmail },
    select: { id: true, mustChangePassword: true },
  });
  console.log(`[TEST 3] User in DB mustChangePassword: ${user3?.mustChangePassword} (Expected: true)`);

  const login3Res = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: tempSlug,
      email: tempEmail,
      password: tempPassword,
    }),
  });

  const login3Json = await login3Res.json();
  console.log(`[TEST 3] Login mustChangePassword: ${login3Json.mustChangePassword} (Expected: true)`);
  console.log(`[TEST 3] Login redirectUrl: ${login3Json.redirectUrl} (Expected: /change-password)`);
  const test3Passed =
    user3?.mustChangePassword === true &&
    login3Json.mustChangePassword === true &&
    login3Json.redirectUrl === "/change-password";
  console.log(`[TEST 3] Result: ${test3Passed ? "PASSED ✅" : "FAILED ❌"}`);

  console.log("\n=================================================================");
  console.log("TEST 4: User updates password -> Not forced again");
  console.log("=================================================================");

  const newPermPassword = "NewP@ssword2026!";
  const school3 = await basePrisma.school.findFirst({ where: { subdomain: tempSlug } });

  const changeResult = await changeUserPassword({
    userId: user3!.id,
    schoolId: school3!.id,
    role: "SCHOOL_ADMIN",
    oldPassword: tempPassword,
    newPassword: newPermPassword,
    confirmPassword: newPermPassword,
    ip: "127.0.0.1",
  });
  console.log(`[TEST 4] changeUserPassword result success: ${changeResult.success}`);

  const user4After = await basePrisma.user.findFirst({
    where: { email: tempEmail },
    select: { mustChangePassword: true },
  });
  console.log(`[TEST 4] User in DB mustChangePassword after change: ${user4After?.mustChangePassword} (Expected: false)`);

  const login4Res = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: tempSlug,
      email: tempEmail,
      password: newPermPassword,
    }),
  });

  const login4Json = await login4Res.json();
  console.log(`[TEST 4] Login mustChangePassword: ${login4Json.mustChangePassword} (Expected: false)`);
  console.log(`[TEST 4] Login redirectUrl: ${login4Json.redirectUrl} (Expected: /${tempSlug}/dashboard)`);
  const test4Passed =
    user4After?.mustChangePassword === false &&
    login4Json.mustChangePassword === false &&
    login4Json.redirectUrl === `/${tempSlug}/dashboard`;
  console.log(`[TEST 4] Result: ${test4Passed ? "PASSED ✅" : "FAILED ❌"}`);

  console.log("\n=================================================================");
  console.log(`FINAL SUMMARY: Test 1=${test1Passed}, Test 2=${test2Passed}, Test 3=${test3Passed}, Test 4=${test4Passed}`);
  console.log("=================================================================");
}

runTests()
  .catch((e) => {
    console.error("Test error:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
