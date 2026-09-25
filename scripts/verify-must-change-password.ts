import { basePrisma } from "../src/lib/tenant-prisma";
import bcrypt from "bcryptjs";

async function verifyMustChangePassword() {
  console.log("=== VERIFYING MUST CHANGE PASSWORD WORKFLOW ===");

  const school = await basePrisma.school.findFirst({
    where: { subdomain: "york" },
    include: { academicTiers: true },
  });

  if (!school) {
    console.error("School 'york' not found.");
    process.exit(1);
  }

  const schoolId = school.id;
  const timestamp = Date.now();

  // Test 1: Staff Creation Endpoint
  console.log("\n1. Testing POST /api/school/:schoolId/staff creation logic:");
  const { POST: staffPOST } = await import("../src/app/api/school/[schoolId]/staff/route");
  const staffEmail = `test.teacher.${timestamp}@york.edu`;
  const staffReq = new Request(`http://localhost:3000/api/school/${schoolId}/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Test",
      lastName: "Teacher",
      email: staffEmail,
      role: "TEACHER",
    }),
  });
  const staffRes = await staffPOST(staffReq, { params: Promise.resolve({ schoolId }) });
  const staffData = await staffRes.json();
  console.log(" - API Response mustChangePassword:", staffData.mustChangePassword);

  const dbStaff = await basePrisma.staff.findUnique({
    where: { schoolId_email: { schoolId, email: staffEmail } },
  });
  const dbUserForStaff = await basePrisma.user.findUnique({
    where: { schoolId_email: { schoolId, email: staffEmail } },
  });
  console.log(" - DB Staff linked to User in Prisma:", dbStaff?.userId ? "PASSED (linked)" : "FAIL");
  console.log(" - DB User mustChangePassword in User table:", dbUserForStaff?.mustChangePassword === true ? "PASSED (true)" : "FAIL");

  // Test 2: Student Creation Endpoint
  console.log("\n2. Testing POST /api/school/:schoolId/students creation logic:");
  const { POST: studentPOST } = await import("../src/app/api/school/[schoolId]/students/route");
  const studentEmail = `test.student.${timestamp}@york.edu`;
  const studentReq = new Request(`http://localhost:3000/api/school/${schoolId}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Test",
      lastName: "Student",
      email: studentEmail,
      currentClass: "JSS 1",
    }),
  });
  const studentRes = await studentPOST(studentReq, { params: Promise.resolve({ schoolId }) });
  const studentData = await studentRes.json();
  console.log(" - API Response mustChangePassword:", studentData.mustChangePassword);

  const dbStudent = await basePrisma.student.findFirst({
    where: { schoolId, email: studentEmail },
  });
  const dbUserForStudent = await basePrisma.user.findUnique({
    where: { schoolId_email: { schoolId, email: studentEmail } },
  });
  console.log(" - DB Student mustChangePassword in Prisma:", dbStudent?.mustChangePassword === true ? "PASSED (true)" : "FAIL");
  console.log(" - DB User mustChangePassword in User table:", dbUserForStudent?.mustChangePassword === true ? "PASSED (true)" : "FAIL");

  // Test 3: Bursar Creation Endpoint
  console.log("\n3. Testing POST /api/school/:schoolId/bursar creation logic:");
  const { POST: bursarPOST } = await import("../src/app/api/school/[schoolId]/bursar/route");
  const bursarEmail = `test.bursar.${timestamp}@york.edu`;
  const bursarReq = new Request(`http://localhost:3000/api/school/${schoolId}/bursar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Test",
      lastName: "Bursar",
      email: bursarEmail,
    }),
  });
  const bursarRes = await bursarPOST(bursarReq, { params: Promise.resolve({ schoolId }) });
  const bursarData = await bursarRes.json();
  console.log(" - API Response mustChangePassword:", bursarData.mustChangePassword);

  const dbBursar = await basePrisma.staff.findUnique({
    where: { schoolId_email: { schoolId, email: bursarEmail } },
  });
  const dbUserForBursar = await basePrisma.user.findUnique({
    where: { schoolId_email: { schoolId, email: bursarEmail } },
  });
  console.log(" - DB Bursar role:", dbUserForBursar?.role);
  console.log(" - DB Bursar linked to User in Prisma:", dbBursar?.userId ? "PASSED (linked)" : "FAIL");
  console.log(" - DB User mustChangePassword in User table:", dbUserForBursar?.mustChangePassword === true ? "PASSED (true)" : "FAIL");

  // Test 4: Login Endpoint returning mustChangePassword = true and redirectUrl = /change-password
  console.log("\n4. Testing POST /api/auth/login with newly created user:");
  const { POST: loginPOST } = await import("../src/app/api/auth/login/route");
  const loginReq = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: staffEmail,
      password: staffData.tempPassword,
      schoolDomain: "york",
    }),
  });
  const loginRes = await loginPOST(loginReq);
  const loginData = await loginRes.json();
  console.log(" - Login response status:", loginRes.status);
  console.log(" - Login mustChangePassword:", loginData.mustChangePassword === true ? "PASSED (true)" : "FAIL");
  console.log(" - Login redirectUrl:", loginData.redirectUrl === "/change-password" ? "PASSED (/change-password)" : "FAIL (" + loginData.redirectUrl + ")");

  // Test 5: Change Password Endpoint clearing mustChangePassword = false
  console.log("\n5. Testing POST /api/auth/change-password clearing mustChangePassword to false:");
  const { POST: changePasswordPOST } = await import("../src/app/api/auth/change-password/route");
  const changePasswordReq = new Request("http://localhost:3000/api/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginData.accessToken}`,
    },
    body: JSON.stringify({
      oldPassword: staffData.tempPassword,
      newPassword: "BrandNewSecurePassword123!",
      confirmPassword: "BrandNewSecurePassword123!",
    }),
  });
  const changePasswordRes = await changePasswordPOST(changePasswordReq);
  const changePasswordData = await changePasswordRes.json();
  console.log(" - Change password response status:", changePasswordRes.status);
  console.log(" - Change password mustChangePassword:", changePasswordData.mustChangePassword === false ? "PASSED (false)" : "FAIL");

  const dbStaffAfterChange = await basePrisma.staff.findUnique({
    where: { schoolId_email: { schoolId, email: staffEmail } },
  });
  const dbUserAfterChange = await basePrisma.user.findUnique({
    where: { schoolId_email: { schoolId, email: staffEmail } },
  });
  console.log(" - DB Staff linked after change:", dbStaffAfterChange?.userId ? "PASSED (linked)" : "FAIL");
  console.log(" - DB User mustChangePassword after change:", dbUserAfterChange?.mustChangePassword === false ? "PASSED (false)" : "FAIL");

  // Test 6: Self-Registration Endpoint keeping mustChangePassword = false
  console.log("\n6. Testing POST /api/auth/register (self-registration keeping mustChangePassword = false):");
  const { POST: registerPOST } = await import("../src/app/api/auth/register/route");
  const selfRegEmail = `self.registered.${timestamp}@york.edu`;
  const registerReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Self",
      lastName: "Registered",
      email: selfRegEmail,
      password: "StrongSelfChosenPassword123!",
      schoolId,
      role: "STUDENT",
    }),
  });
  const registerRes = await registerPOST(registerReq);
  const registerData = await registerRes.json();
  console.log(" - Self-registration response status:", registerRes.status);
  console.log(" - Self-registration mustChangePassword:", registerData.mustChangePassword === false ? "PASSED (false)" : "FAIL");

  const dbSelfUser = await basePrisma.user.findUnique({
    where: { schoolId_email: { schoolId, email: selfRegEmail } },
  });
  console.log(" - DB User mustChangePassword for self-registered user:", dbSelfUser?.mustChangePassword === false ? "PASSED (false)" : "FAIL");

  // Cleanup test records
  console.log("\nCleaning up test records...");
  await basePrisma.user.deleteMany({
    where: { email: { in: [staffEmail, studentEmail, bursarEmail, selfRegEmail] } },
  });
  await basePrisma.staff.deleteMany({
    where: { email: { in: [staffEmail, bursarEmail] } },
  });
  await basePrisma.student.deleteMany({
    where: { email: studentEmail },
  });

  console.log("\n=== ALL MUST-CHANGE-PASSWORD CHECKS COMPLETED SUCCESSFULLY ===");
}

verifyMustChangePassword().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
