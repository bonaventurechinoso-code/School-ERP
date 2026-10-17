import { createSchool } from "../src/app/admin/actions";
import { basePrisma } from "../src/lib/tenant-prisma";
import bcrypt from "bcryptjs";

async function testSuperAdmin() {
  const fd = new FormData();
  fd.append("name", "TestStMary Secondary");
  fd.append("subdomain", "teststmary");
  fd.append("adminEmail", "gabrielchinonso16@gmail.com");
  fd.append("password", "Password1234!");
  fd.append("confirmPassword", "Password1234!");
  fd.append("contactPhone", "+2348000000000");
  fd.append("tiers", "Senior Secondary School");

  console.log("Calling createSchool with Password1234!...");
  await createSchool(fd);

  const school = await basePrisma.school.findFirst({
    where: { subdomain: "teststmary" },
    include: { academicTiers: true, users: true, staff: true }
  });

  console.log("School created:", JSON.stringify(school, null, 2));

  if (school && school.users.length > 0) {
    const u = school.users[0];
    const match = await bcrypt.compare("Password1234!", u.passwordHash);
    console.log(`User ${u.email} password match for Password1234!:`, match);
  }

  // Now try login endpoint with schoolCode=teststmary, email=gabrielchinonso16@gmail.com, password=Password1234!
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schoolCode: "teststmary",
      email: "gabrielchinonso16@gmail.com",
      password: "Password1234!"
    })
  });
  console.log("Login status for teststmary with Password1234!:", loginRes.status);
  console.log("Login response for teststmary with Password1234!:", await loginRes.json());
}

testSuperAdmin().catch(console.error).finally(() => process.exit(0));
