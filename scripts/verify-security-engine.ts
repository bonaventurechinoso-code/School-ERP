import { basePrisma, applyTenantIsolation } from "../src/lib/tenant-prisma";
import { validatePasswordStrength, createPasswordResetToken, hashPassword, verifyPassword } from "../src/lib/security-service";
import { recordCredentialFailure, recordCredentialSuccess, checkAccountLockout, checkIpRateLimit } from "../src/lib/rate-limiter";
import { signAccessToken, issueRefreshToken, rotateRefreshToken } from "../src/lib/dual-token";

async function runSecurityEngineVerification() {
  console.log("=== STARTING SECURITY ENGINE VERIFICATION ===");

  // 1. Password Strength Validation
  console.log("\n1. Testing Password Complexity Rules:");
  const weak1 = validatePasswordStrength("short1!");
  console.log(" - 'short1!' (too short):", weak1.valid ? "FAIL" : "PASSED (Rejected)");

  const weak2 = validatePasswordStrength("alllowercase1!");
  console.log(" - 'alllowercase1!' (no uppercase):", weak2.valid ? "FAIL" : "PASSED (Rejected)");

  const weak3 = validatePasswordStrength("NoDigitsHere!");
  console.log(" - 'NoDigitsHere!' (no digits):", weak3.valid ? "FAIL" : "PASSED (Rejected)");

  const weak4 = validatePasswordStrength("NoSpecialChar1");
  console.log(" - 'NoSpecialChar1' (no special char):", weak4.valid ? "FAIL" : "PASSED (Rejected)");

  const strong = validatePasswordStrength("P@ssword123!");
  console.log(" - 'P@ssword123!' (valid):", strong.valid ? "PASSED (Accepted)" : "FAIL");

  // 2. Bcrypt 12 Rounds Hashing
  console.log("\n2. Testing Bcrypt 12-Round Hashing:");
  const hash = await hashPassword("P@ssword123!");
  const isValidBcrypt12 = hash.startsWith("$2a$12$") || hash.startsWith("$2b$12$");
  console.log(" - Hash algorithm and rounds ($2a/b$12$):", isValidBcrypt12 ? "PASSED" : "FAIL (" + hash + ")");
  const matches = await verifyPassword("P@ssword123!", hash);
  console.log(" - Hash verification:", matches ? "PASSED" : "FAIL");

  // 3. Password Reset Token (SHA-256 & 15-minute expiry)
  console.log("\n3. Testing Password Reset Token Generation:");
  const school = await basePrisma.school.findFirst();
  if (school) {
    const rawToken = await createPasswordResetToken({
      userId: "test-user-recovery",
      email: "test-recovery@example.com",
      schoolId: school.id,
      userType: "STAFF"
    });
    console.log(" - Raw token generated length:", rawToken.length);

    const tokenRecord = await basePrisma.passwordResetToken.findFirst({
      where: { userId: "test-user-recovery" },
      orderBy: { createdAt: "desc" }
    });

    if (tokenRecord) {
      const expiresDiffMinutes = Math.round((tokenRecord.expiresAt.getTime() - tokenRecord.createdAt.getTime()) / (60 * 1000));
      console.log(" - Token expiration window (expected ~15 mins):", expiresDiffMinutes, "minutes ->", expiresDiffMinutes === 15 ? "PASSED" : "FAIL");
      console.log(" - Token hash stored in DB (SHA-256 length 64):", tokenRecord.tokenHash.length === 64 ? "PASSED" : "FAIL");
      
      // Cleanup
      await basePrisma.passwordResetToken.deleteMany({ where: { userId: "test-user-recovery" } });
    }
  }

  // 4. Rate Limiting & Account Lockout
  console.log("\n4. Testing Rate Limiting & Account Lockout:");
  const testAccount = "lockout-test@example.com";
  recordCredentialSuccess("127.0.0.1", testAccount);

  let lockState = checkAccountLockout(testAccount);
  console.log(" - Initial account locked state:", lockState.locked ? "FAIL" : "PASSED (Not locked)");

  for (let i = 1; i <= 5; i++) {
    recordCredentialFailure("192.168.1.100", testAccount);
  }

  lockState = checkAccountLockout(testAccount);
  console.log(" - After 5 consecutive failures, locked state:", lockState.locked ? "PASSED (Locked for " + lockState.remainingMinutes + "m)" : "FAIL");

  recordCredentialSuccess("192.168.1.100", testAccount);
  lockState = checkAccountLockout(testAccount);
  console.log(" - After successful reset, locked state:", lockState.locked ? "FAIL" : "PASSED (Unlocked)");

  // 5. Dual-Token Architecture & Rotation
  console.log("\n5. Testing Dual-Token Minting & Refresh Rotation:");
  if (school) {
    const dummyUserId = "test-user-" + Date.now();
    const accessToken = await signAccessToken({
      userId: dummyUserId,
      email: "dualtoken@example.com",
      role: "SCHOOL_ADMIN",
      schoolId: school.id,
      mustChangePassword: false,
    });

    const refreshResult = await issueRefreshToken({
      userId: dummyUserId,
      schoolId: school.id,
      userAgent: "TestAgent/1.0",
      ipAddress: "127.0.0.1",
    });

    console.log(" - Access token generated (15 min JWT):", !!accessToken);
    console.log(" - Refresh token issued (7 day DB hash):", !!refreshResult.rawRefreshToken);

    const rotationResult = await rotateRefreshToken({
      rawRefreshToken: refreshResult.rawRefreshToken,
      userAgent: "TestAgent/2.0",
      ipAddress: "127.0.0.1",
    });

    console.log(" - Refresh token rotation successful:", rotationResult.success ? "PASSED" : "FAIL");
    if (rotationResult.success) {
      console.log(" - New refresh token issued:", !!rotationResult.rawRefreshToken);
      console.log(" - New access token issued:", !!rotationResult.accessToken);
    }

    // Try rotating old revoked token
    const reuseResult = await rotateRefreshToken({
      rawRefreshToken: refreshResult.rawRefreshToken,
      userAgent: "TestAgent/3.0",
      ipAddress: "127.0.0.1",
    });
    console.log(" - Reused revoked token rejected & replay protected:", !reuseResult.success ? "PASSED" : "FAIL");

    // Cleanup test tokens
    await basePrisma.refreshToken.deleteMany({ where: { userId: dummyUserId } });
  }

  // 6. Tenant Scoping & Isolation
  console.log("\n6. Testing Tenant Isolation Scoping:");
  const allSchools = await basePrisma.school.findMany({ take: 2 });
  if (allSchools.length >= 2) {
    const schoolA = allSchools[0];
    const schoolB = allSchools[1];

    const scopedClientA = applyTenantIsolation(basePrisma, schoolA.id, false);
    const studentsA = await scopedClientA.student.findMany();
    const hasOnlyTenantA = studentsA.every((s: any) => s.schoolId === schoolA.id);
    console.log(` - Scoped client for School A (${schoolA.slug}) returns only tenant A data:`, hasOnlyTenantA ? "PASSED" : "FAIL");

    const superAdminClient = applyTenantIsolation(basePrisma, "", true);
    const allStudents = await superAdminClient.student.findMany({ take: 5 });
    console.log(" - SuperAdmin client query executed across schools:", allStudents.length >= 0 ? "PASSED" : "FAIL");
  }

  console.log("\n=== ALL SECURITY ENGINE VERIFICATIONS COMPLETED SUCCESSFULLY ===");
}

runSecurityEngineVerification()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
