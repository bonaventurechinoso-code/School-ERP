import * as jose from "jose";
import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const demoSchool = await basePrisma.school.findUnique({ where: { subdomain: "demo" } });
  if (!demoSchool) throw new Error("Demo not found");

  const JWT_SECRET = process.env.JWT_SECRET_KEY || "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(JWT_SECRET);

  const tokenId = `demo-test-${Date.now()}`;
  const token = await new jose.SignJWT({
    jti: tokenId,
    sessionToken: tokenId,
    userId: "demo-admin-staff",
    tenantId: demoSchool.id,
    schoolId: demoSchool.id,
    schoolDomain: "demo",
    role: "TENANT_ADMIN",
    permissions: ["*"],
    isDemo: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  // Test 1: Fetch with 1st Semester
  const res1 = await fetch(
    `http://localhost:3000/api/v1/report-cards/roster?term=${encodeURIComponent("1st Semester")}&className=${encodeURIComponent("ND 1")}&schoolId=${demoSchool.id}`,
    { headers: { Cookie: `session=${token}` } }
  );
  const data1 = await res1.json();
  console.log("Roster for ND 1 (1st Semester):", JSON.stringify(data1, null, 2));

  // Test 2: Fetch for Sandbox 100 Level
  const sandboxSchool = await basePrisma.school.findUnique({ where: { subdomain: "sandbox" } });
  if (sandboxSchool) {
    const sToken = await new jose.SignJWT({
      jti: tokenId,
      sessionToken: tokenId,
      userId: "sandbox-admin-staff",
      tenantId: sandboxSchool.id,
      schoolId: sandboxSchool.id,
      schoolDomain: "sandbox",
      role: "TENANT_ADMIN",
      permissions: ["*"],
      isDemo: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    const res2 = await fetch(
      `http://localhost:3000/api/v1/report-cards/roster?term=${encodeURIComponent("1st Semester")}&className=${encodeURIComponent("100 Level")}&schoolId=${sandboxSchool.id}`,
      { headers: { Cookie: `session=${sToken}` } }
    );
    const data2 = await res2.json();
    console.log("Roster for 100 Level (1st Semester):", JSON.stringify(data2, null, 2));
  }
}

main().finally(() => basePrisma.$disconnect());
