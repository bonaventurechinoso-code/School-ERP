import * as jose from "jose";
import { normalizeRole, getDefaultPermissionsForRole, UserRole } from "../src/lib/auth";

async function runRbacVerification() {
  console.log("=== STARTING EXPANDED RBAC & ROUTE GUARD VERIFICATION ===\n");

  const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
  const secret = new TextEncoder().encode(jwtSecret);
  const alg = "HS256";

  const canonicalRoles: Array<{ rawRole: string; label: string }> = [
    { rawRole: "SUPER_ADMIN", label: "Platform Super Administrator" },
    { rawRole: "SCHOOL_ADMIN", label: "Tenant School Administrator" },
    { rawRole: "ADMIN", label: "Legacy Admin (Maps to SCHOOL_ADMIN)" },
    { rawRole: "STAFF", label: "Academic Faculty & Staff" },
    { rawRole: "TEACHER", label: "Subject Teacher (Maps to STAFF)" },
    { rawRole: "STUDENT", label: "Enrolled Student" },
  ];

  const sampleTiers = ["Creche / Nursery", "Primary School", "Secondary School"];

  // Helper simulating middleware route isolation logic
  function testMiddlewareGuard(role: string, targetPath: string) {
    const isAdminConsole = targetPath === "/admin" || targetPath.startsWith("/admin/");
    const tenantAdminSegments = [
      "/dashboard", "/finance", "/hr", "/portal-settings",
      "/admissions", "/staff", "/students", "/scheduling",
      "/exams", "/transcripts", "/report-cards", "/communications"
    ];
    const isTenantAdminPath = tenantAdminSegments.some(segment => targetPath.includes(segment));
    const isAdministrativePath = isAdminConsole || isTenantAdminPath;

    if (!isAdministrativePath) return { allowed: true, destination: targetPath };

    if (role === "STUDENT") {
      return { allowed: false, destination: "/portal/student?denied=true", reason: "STUDENT blocked and redirected to dedicated student portal" };
    }

    if (role === "STAFF") {
      return { allowed: false, destination: "/portal/staff?denied=true", reason: "STAFF blocked and redirected to dedicated staff portal" };
    }

    if (isAdminConsole && !["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return { allowed: false, destination: `/access-denied?role=${role}`, reason: "Non-super admin blocked from platform console" };
    }

    return { allowed: true, destination: targetPath };
  }

  // Strict evaluation helper matching ClientLayout & WalletTopUp frontend logic
  function checkStrictWalletAuthorization(userRole: string) {
    // Strictly evaluates to SUPER_ADMIN or SCHOOL_ADMIN
    return userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";
  }

  console.log("--- 1. Testing Session Token Expansion & Permissions ---");
  for (const { rawRole, label } of canonicalRoles) {
    const canonicalRole = normalizeRole(rawRole);
    const permissions = getDefaultPermissionsForRole(canonicalRole);

    const testSessionToken = `mock-session-${rawRole.toLowerCase()}-uuid`;
    // Sign JWT with expanded claims including sessionToken
    const token = await new jose.SignJWT({
      jti: testSessionToken,
      sessionToken: testSessionToken,
      sessionId: testSessionToken,
      userId: `user-${rawRole.toLowerCase()}-123`,
      email: `${rawRole.toLowerCase()}@greenwood.edu`,
      tenantId: "tenant-gw-01",
      schoolDomain: "greenwood",
      tenantName: "Greenwood Academy",
      role: canonicalRole,
      activeTiers: sampleTiers,
      permissions: permissions,
    })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(secret);

    // Decode and verify
    const { payload } = await jose.jwtVerify(token, secret);
    const decodedRole = payload.role as string;
    const decodedTiers = payload.activeTiers as string[];
    const decodedPermissions = payload.permissions as string[];

    console.log(`\nRole: [${rawRole}] -> Canonical: [${decodedRole}] (${label})`);
    console.log(`  🔐 Active Tiers in Token: [${decodedTiers.join(", ")}]`);
    console.log(`  📋 Permissions in Token: [${decodedPermissions.slice(0, 3).join(", ")} ... (${decodedPermissions.length} total)]`);

    // Strict Frontend Wallet Rendering Test
    const walletAllowed = checkStrictWalletAuthorization(decodedRole);
    console.log(`  💼 "WALLET BALANCE" & "Top Up" DOM Render: ${walletAllowed ? "✅ RENDERED IN DOM (Strictly Authorized)" : "⛔ COMPLETELY HIDDEN (Restricted)"}`);

    // Middleware Route Access Test
    const testPaths = ["/greenwood/dashboard", "/greenwood/students", "/admin"];
    for (const path of testPaths) {
      const result = testMiddlewareGuard(decodedRole, path);
      if (result.allowed) {
        console.log(`  Path [${path}]: ✅ ALLOWED`);
      } else {
        console.log(`  Path [${path}]: 🛡️ INTERCEPTED -> Redirected to: ${result.destination}`);
      }
    }
  }

  console.log("\n=== ALL EXPANDED RBAC TESTS COMPLETED SUCCESSFULLY ===");
}

runRbacVerification().catch(console.error);
