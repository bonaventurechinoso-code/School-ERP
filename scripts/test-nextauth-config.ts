import { authOptions } from "../src/lib/nextauth-config";
import { basePrisma } from "../src/lib/tenant-prisma";
import bcrypt from "bcryptjs";
import assert from "assert";

async function runNextAuthTests() {
  console.log("=== RUNNING NEXTAUTH.JS AUTHENTICATION & MULTI-PROVIDER TESTS ===\n");

  // 1. Verify Simultaneous Providers
  console.log("1. Verifying Providers in authOptions...");
  const providers = authOptions.providers;
  assert(providers.length >= 2, "Expected at least 2 providers in authOptions");

  const credProvider = providers.find((p: any) => p.id === "credentials");
  const googleProvider = providers.find((p: any) => p.id === "google");

  assert(credProvider, "PASS: CredentialsProvider is configured");
  assert(googleProvider, "PASS: GoogleProvider is configured simultaneously");
  console.log("PASS: Both CredentialsProvider and GoogleProvider registered simultaneously in authOptions.\n");

  // Setup test school tenant and staff with authentic Nigerian role
  const testSubdomain = `test-school-${Date.now()}`;
  const testSchool = await basePrisma.school.create({
    data: {
      name: "Nigerian Federal Demonstration College",
      subdomain: testSubdomain,
      isActive: true,
      academicTiers: {
        create: [
          { name: "Junior Secondary", level: 1 },
          { name: "Senior Secondary", level: 2 },
        ],
      },
    },
    include: { academicTiers: true },
  });

  const staffPasswordRaw = "SecurePass2026!";
  const staffPasswordHashed = await bcrypt.hash(staffPasswordRaw, 10);
  const staffEmail = `bursar.${Date.now()}@gmail.com`;

  const testStaff = await basePrisma.staff.create({
    data: {
      schoolId: testSchool.id,
      firstName: "Chidi",
      lastName: "Okonkwo",
      email: staffEmail,
      password: staffPasswordHashed,
      role: "Bursar", // Authentic Nigerian school role
      status: "ACTIVE",
    },
  });

  console.log(`Created test tenant [${testSchool.subdomain}] and Staff [${testStaff.firstName} ${testStaff.lastName} - Role: ${testStaff.role}]`);

  // 2. Testing CredentialsProvider Authorization Logic
  console.log("\n2. Testing CredentialsProvider Authorization Logic...");
  const authorizeFn = (credProvider as any).options?.authorize || (credProvider as any).authorize;

  // 2a. Bad password
  const badLoginResult = await authorizeFn({ email: staffEmail, password: "WrongPassword" }, {} as any);
  assert.strictEqual(badLoginResult, null, "PASS: Invalid password rejected by bcrypt comparison (returns null)");
  console.log("PASS: Invalid password rejected by bcrypt comparison.");


  // 2b. Valid credentials
  const authorizedUser = await authorizeFn({ email: staffEmail, password: staffPasswordRaw }, {} as any);
  assert(authorizedUser, "PASS: Authorized user returned");
  assert.strictEqual(authorizedUser.email, staffEmail, "PASS: User email matches");
  assert.strictEqual(authorizedUser.staffRole, "Bursar", "PASS: Authentic Nigerian school role (Bursar) resolved");
  assert.strictEqual(authorizedUser.role, "STAFF", "PASS: Normalized role is STAFF");
  assert.strictEqual(authorizedUser.tenantId, testSchool.id, "PASS: Tenant ID matches");
  assert.strictEqual(authorizedUser.schoolDomain, testSubdomain, "PASS: School subdomain matches");
  assert(authorizedUser.permissions.includes("mark:attendance"), "PASS: Role permissions attached");
  console.log("PASS: CredentialsProvider successfully authenticated user and returned Nigerian role.\n");

  // 3. Testing GoogleProvider.signIn Callback
  console.log("3. Testing GoogleProvider signIn Callback & Tenant Database Role Lookup...");
  const signInCallback = authOptions.callbacks?.signIn;
  assert(signInCallback, "signIn callback must be defined");

  // 3a. Registered Google email (matching our Nigerian school Bursar)
  const googleUserObj: any = { email: staffEmail, name: "Chidi Okonkwo (Google)" };
  const googleAccountObj: any = { provider: "google", type: "oauth" };
  const googleProfileObj: any = { email: staffEmail };

  const signInResultAllowed = await (signInCallback as any)({
    user: googleUserObj,
    account: googleAccountObj,
    profile: googleProfileObj,
  });

  assert.strictEqual(signInResultAllowed, true, "PASS: Registered Google user allowed to sign in");
  assert.strictEqual(googleUserObj.staffRole, "Bursar", "PASS: Google login resolved Nigerian school role: Bursar");
  assert.strictEqual(googleUserObj.tenantId, testSchool.id, "PASS: Google login bound to tenantId");
  assert.strictEqual(googleUserObj.schoolDomain, testSubdomain, "PASS: Google login bound to schoolDomain");
  console.log("PASS: GoogleProvider successfully retrieved designated Nigerian school role from tenant database.\n");

  // 3b. Unregistered Google email (unknown Gmail user trying to login)
  const unknownGoogleUser: any = { email: "unauthorized.intruder@gmail.com", name: "Intruder" };
  const signInResultDenied = await (signInCallback as any)({
    user: unknownGoogleUser,
    account: googleAccountObj,
    profile: { email: unknownGoogleUser.email },
  });

  assert(
    signInResultDenied === false || (typeof signInResultDenied === "string" && signInResultDenied.includes("/access-denied")),
    "PASS: Unregistered Google email rejected or redirected to /access-denied"
  );
  console.log("PASS: Unregistered Google OAuth account blocked from accessing platform.\n");

  // 4. Testing NextAuth JWT Callback -> Database Session Strategy Integration
  console.log("4. Testing NextAuth JWT Callback & Database Session Strategy Integration...");
  const jwtCallback = authOptions.callbacks?.jwt;
  assert(jwtCallback, "jwt callback must be defined");

  const initialToken: any = { email: staffEmail };
  const updatedToken = await (jwtCallback as any)({
    token: initialToken,
    user: googleUserObj,
    account: googleAccountObj,
  });

  assert(updatedToken.sessionToken, "PASS: sessionToken generated and added to JWT token");
  assert.strictEqual(updatedToken.staffRole, "Bursar", "PASS: Token contains Nigerian staffRole");

  // Verify the row was created in PostgreSQL basePrisma.session
  const dbSessionRow = await basePrisma.session.findUnique({
    where: { sessionToken: updatedToken.sessionToken },
  });

  assert(dbSessionRow, "PASS: Authoritative session row inserted into PostgreSQL basePrisma.session");
  assert.strictEqual(dbSessionRow.userId, testStaff.id, "PASS: Database session userId matches staff id");
  assert.strictEqual(dbSessionRow.staffRole, "Bursar", "PASS: Database session staffRole matches authentic Nigerian role");
  assert.strictEqual(dbSessionRow.tenantId, testSchool.id, "PASS: Database session tenantId bound");
  assert(dbSessionRow.expiresAt.getTime() > Date.now(), "PASS: Expiration is in the future");
  const idleWindowMinutes = (dbSessionRow.expiresAt.getTime() - Date.now()) / (1000 * 60);
  assert(idleWindowMinutes > 25 && idleWindowMinutes <= 31, "PASS: Strict 30-minute idle limit configured");

  // 5. Testing NextAuth Session Callback
  console.log("\n5. Testing NextAuth Session Callback...");
  const sessionCallback = authOptions.callbacks?.session;
  assert(sessionCallback, "session callback must be defined");

  const mockSessionObj: any = { user: {}, expires: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
  const clientSession = await (sessionCallback as any)({
    session: mockSessionObj,
    token: updatedToken,
  });

  assert.strictEqual(clientSession.user.staffRole, "Bursar", "PASS: Client session.user contains Nigerian role: Bursar");
  assert.strictEqual(clientSession.user.tenantId, testSchool.id, "PASS: Client session.user contains tenantId");
  assert.strictEqual(clientSession.user.sessionToken, updatedToken.sessionToken, "PASS: Client session.user contains sessionToken");
  console.log("PASS: Session callback populated client and server session object.\n");

  // Cleanup test fixtures
  await basePrisma.session.deleteMany({ where: { tenantId: testSchool.id } });
  await basePrisma.staff.deleteMany({ where: { schoolId: testSchool.id } });
  await basePrisma.academicTier.deleteMany({ where: { schoolId: testSchool.id } });
  await basePrisma.school.delete({ where: { id: testSchool.id } });
  console.log("Cleaned up test tenant fixtures.");

  console.log("\nALL NEXTAUTH MULTI-PROVIDER & DATABASE SESSION TESTS PASSED SUCCESSFULLY!");
}

runNextAuthTests()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  })
  .finally(() => {
    basePrisma.$disconnect();
  });
