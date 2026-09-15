import { basePrisma } from "../src/lib/tenant-prisma";
import {
  createDatabaseSession,
  validateDatabaseSession,
  revokeDatabaseSession,
  SESSION_MAX_AGE_SECONDS,
} from "../src/lib/session-manager";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function runDatabaseSessionTests() {
  console.log("=== RUNNING DATABASE SESSION STRATEGY & AUTHENTICATION HARDENING TESTS ===\n");

  const testUserId = "test-user-bursar-101";
  const testTenantId = "tenant-greenwood-001";
  const testRole = "STAFF";
  const testStaffRole = "School Bursar";

  // 1. Create a database session
  console.log("1. Testing Session Creation in Database...");
  const { sessionToken, cookieToken, expiresAt } = await createDatabaseSession({
    userId: testUserId,
    email: "bursar@greenwood.edu",
    tenantId: testTenantId,
    schoolDomain: "greenwood",
    role: testRole,
    staffRole: testStaffRole,
  });

  assert(Boolean(sessionToken), "SessionToken generated");
  assert(Boolean(cookieToken), "Signed cryptographic cookie token generated");

  // Verify record in PostgreSQL database
  const dbRecord = await basePrisma.session.findUnique({
    where: { sessionToken },
  });

  assert(Boolean(dbRecord), "Session row found in PostgreSQL database");
  assert(dbRecord?.userId === testUserId, "Database record userId matches");
  assert(dbRecord?.tenantId === testTenantId, "Database record tenantId matches");
  assert(dbRecord?.role === testRole, "Database record role matches");
  assert(dbRecord?.staffRole === testStaffRole, "Database record staffRole matches");
  assert(dbRecord?.isRevoked === false, "Database record isRevoked is false initially");

  // Verify 30-minute timeout limit
  const expectedMaxExpiry = new Date(Date.now() + (SESSION_MAX_AGE_SECONDS + 5) * 1000);
  const expectedMinExpiry = new Date(Date.now() + (SESSION_MAX_AGE_SECONDS - 5) * 1000);
  assert(
    dbRecord!.expiresAt <= expectedMaxExpiry && dbRecord!.expiresAt >= expectedMinExpiry,
    "Strict 30-minute timeout window enforced on database row"
  );

  // 2. Validate Session against Database Row
  console.log("\n2. Testing Server-Side Database Verification...");
  const validated = await validateDatabaseSession(cookieToken);
  assert(Boolean(validated), "validateDatabaseSession succeeded with active database row");
  assert(validated?.userId === testUserId, "Server verified userId directly from database");
  assert(validated?.tenantId === testTenantId, "Server verified tenantId directly from database");
  assert(validated?.role === testRole, "Server verified role directly from database");
  assert(validated?.staffRole === testStaffRole, "Server verified staffRole directly from database");

  // 3. Test Inactivity / Expiration
  console.log("\n3. Testing 30-Minute Expiration Enforcement...");
  await basePrisma.session.update({
    where: { sessionToken },
    data: { expiresAt: new Date(Date.now() - 1000) }, // Set expiry in the past
  });

  const expiredCheck = await validateDatabaseSession(cookieToken);
  assert(expiredCheck === null, "Expired session rejected by database validation");

  // 4. Test Immediate Revocation
  console.log("\n4. Testing Immediate Database Revocation...");
  // Create another fresh session
  const fresh = await createDatabaseSession({
    userId: "test-user-teacher-202",
    tenantId: testTenantId,
    role: "STAFF",
    staffRole: "Class Teacher",
  });

  const freshValidBefore = await validateDatabaseSession(fresh.cookieToken);
  assert(Boolean(freshValidBefore), "Fresh session is initially valid");

  // Revoke the session
  await revokeDatabaseSession(fresh.cookieToken);

  const freshValidAfter = await validateDatabaseSession(fresh.cookieToken);
  assert(freshValidAfter === null, "Revoked session rejected immediately across all requests");

  const revokedDbRecord = await basePrisma.session.findUnique({
    where: { sessionToken: fresh.sessionToken },
  });
  assert(revokedDbRecord?.isRevoked === true, "Database session record marked isRevoked: true");

  // Clean up test records
  await basePrisma.session.deleteMany({
    where: {
      userId: { in: [testUserId, "test-user-teacher-202"] },
    },
  });

  console.log("\nALL DATABASE SESSION HARDENING TESTS PASSED SUCCESSFULLY!");
}

runDatabaseSessionTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
