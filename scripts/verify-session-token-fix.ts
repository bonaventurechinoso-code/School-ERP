import * as jose from "jose";
import { createDatabaseSession, validateDatabaseSession } from "../src/lib/session-manager";
import { getSession } from "../src/lib/auth";
import { basePrisma } from "../src/lib/tenant-prisma";

async function verifySessionTokenFix() {
  console.log("=== STARTING SESSION TOKEN & CLAIM VALIDATION VERIFICATION ===\n");

  const testUserId = "test-security-user-001";
  const testEmail = "security.test@schoolerp.com";

  // 1. Verify createDatabaseSession JWT creation
  console.log("Step 1: Testing createDatabaseSession token generation...");
  const sessionResult = await createDatabaseSession({
    userId: testUserId,
    email: testEmail,
    tenantId: "global-saas",
    schoolDomain: "admin",
    tenantName: "Security Test Academy",
    role: "SUPER_ADMIN",
    activeTiers: ["Primary School"],
    permissions: ["manage:all"],
    userAgent: "Automated Security Test Suite",
  });

  if (!sessionResult.sessionToken) {
    throw new Error("FAIL: createDatabaseSession did not return sessionToken!");
  }
  console.log("  ✅ Generated sessionToken:", sessionResult.sessionToken);

  // Decode the raw JWT token to inspect the explicit payload claims
  const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jose.jwtVerify(sessionResult.cookieToken, secret);

  console.log("  🔍 Inspecting payload claims in signed JWT:");
  console.log("    - payload.sessionToken:", payload.sessionToken);
  console.log("    - payload.sessionId:", payload.sessionId);
  console.log("    - payload.jti:", payload.jti);
  console.log("    - payload.id:", payload.id);
  console.log("    - payload.token:", payload.token);

  if (payload.sessionToken !== sessionResult.sessionToken) {
    throw new Error("FAIL: payload.sessionToken does not match expected sessionToken!");
  }
  if (payload.jti !== sessionResult.sessionToken) {
    throw new Error("FAIL: payload.jti is not populated!");
  }
  console.log("  ✅ JWT Payload claims explicitly verified.");

  // 2. Verify validateDatabaseSession using the generated cookie token
  console.log("\nStep 2: Testing validateDatabaseSession with generated cookie token...");
  const validatedSession = await validateDatabaseSession(sessionResult.cookieToken);
  if (!validatedSession) {
    throw new Error("FAIL: validateDatabaseSession returned null for valid database session!");
  }
  if (validatedSession.sessionToken !== sessionResult.sessionToken) {
    throw new Error("FAIL: validatedSession does not contain sessionToken!");
  }
  console.log("  ✅ validateDatabaseSession returned server-authoritative session with sessionToken:", validatedSession.sessionToken);

  // 3. Verify getSession() with tokenOverride
  console.log("\nStep 3: Testing getSession(tokenOverride)...");
  const authSession = await getSession(sessionResult.cookieToken);
  if (!authSession || !authSession.sessionToken) {
    throw new Error("FAIL: getSession(tokenOverride) did not return session or missing sessionToken!");
  }
  console.log("  ✅ getSession(tokenOverride) succeeded with role:", authSession.role, "and sessionToken:", authSession.sessionToken);

  // 4. Test Token Validation with Alternative Claim Formats (sessionId, id, token)
  console.log("\nStep 4: Testing token validation across claim naming variations...");
  const variations = [
    { name: "sessionId claim", payload: { sessionId: sessionResult.sessionToken } },
    { name: "id claim", payload: { id: sessionResult.sessionToken } },
    { name: "token claim", payload: { token: sessionResult.sessionToken } },
    { name: "jti claim", payload: { jti: sessionResult.sessionToken } },
  ];

  for (const v of variations) {
    const customJwt = await new jose.SignJWT({
      userId: testUserId,
      email: testEmail,
      tenantId: "global-saas",
      schoolDomain: "admin",
      role: "SUPER_ADMIN",
      ...v.payload,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    const check = await validateDatabaseSession(customJwt);
    if (!check) {
      throw new Error(`FAIL: validateDatabaseSession failed to resolve session using ${v.name}`);
    }
    console.log(`  ✅ Successfully resolved session via: ${v.name}`);
  }

  // Cleanup test database row
  await basePrisma.session.deleteMany({
    where: { userId: testUserId },
  });
  console.log("\n  🧹 Test session cleaned up successfully.");

  console.log("\n=== ALL AUTH & SESSION TOKEN TESTS PASSED ===");
}

verifySessionTokenFix()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification error:", err);
    process.exit(1);
  });
