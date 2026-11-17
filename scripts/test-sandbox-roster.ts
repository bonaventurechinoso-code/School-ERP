import * as jose from "jose";

async function main() {
  const JWT_SECRET = process.env.JWT_SECRET_KEY || "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(JWT_SECRET);

  const tokenId = `sandbox-test-${Date.now()}`;
  const sToken = await new jose.SignJWT({
    jti: tokenId,
    sessionToken: tokenId,
    userId: "sandbox-admin-staff",
    tenantId: "sandbox",
    schoolId: "sandbox",
    schoolDomain: "sandbox",
    role: "TENANT_ADMIN",
    permissions: ["*"],
    isDemo: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  const res = await fetch(
    `http://localhost:3000/api/v1/report-cards/roster?term=${encodeURIComponent("1st Semester")}&className=${encodeURIComponent("100 Level")}`,
    { headers: { Cookie: `session=${sToken}` } }
  );
  const data = await res.json();
  console.log("Roster for 100 Level with tenantId='sandbox':", JSON.stringify(data, null, 2));
}

main().catch(console.error);
