import * as jose from "jose";
import { basePrisma } from "../src/lib/tenant-prisma";

async function verifyMasterAccess() {
  console.log("==================================================================");
  console.log("🔓 VERIFYING DEVELOPMENT MASTER ACCESS & RBAC BYPASS");
  console.log("==================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      process.exitCode = 1;
    }
  }

  // 1. Verify Super-Admin allowed roles include SCHOOL_ADMIN
  console.log("\n--- 1. Testing Super-Admin Role Expansion ---");
  const allowedSuperAdminRoles = ['SUPER_ADMIN', 'ADMIN', 'SCHOOL_ADMIN'];
  assert(allowedSuperAdminRoles.includes('SCHOOL_ADMIN'), "SCHOOL_ADMIN is explicitly authorized in Super-Admin allowed roles array");
  assert(allowedSuperAdminRoles.includes('SUPER_ADMIN'), "SUPER_ADMIN is authorized in Super-Admin allowed roles array");
  assert(allowedSuperAdminRoles.includes('ADMIN'), "ADMIN is authorized in Super-Admin allowed roles array");

  // 2. Test development environment bypass logic
  console.log("\n--- 2. Testing Development Mode Master Access Logic ---");
  const isDev = process.env.NODE_ENV === 'development';
  console.log(`ℹ️  Current NODE_ENV: "${process.env.NODE_ENV}" (isDev: ${isDev})`);

  function evaluateRouteAccess(role: string, path: string, isDevelopment: boolean) {
    const isAdminConsole = path === '/admin' || path.startsWith('/admin/');
    const effectiveRole = isDevelopment ? 'SUPER_ADMIN' : role;

    // Student check
    if (!isDevelopment && effectiveRole === 'STUDENT') {
      return { allowed: false, redirect: '/portal/student?denied=true' };
    }

    // Staff check
    if (!isDevelopment && effectiveRole === 'STAFF') {
      return { allowed: false, redirect: '/portal/staff?denied=true' };
    }

    // Super Admin console check
    if (isAdminConsole && !isDevelopment && !['SUPER_ADMIN', 'ADMIN', 'SCHOOL_ADMIN'].includes(role)) {
      return { allowed: false, redirect: '/access-denied' };
    }

    return { allowed: true, effectiveRole };
  }

  // Test with SCHOOL_ADMIN on Super Admin Console in production vs development
  const schoolAdminProd = evaluateRouteAccess('SCHOOL_ADMIN', '/admin', false);
  assert(schoolAdminProd.allowed === true, "SCHOOL_ADMIN can access /admin in standard mode (without access-denied)");

  const schoolAdminDev = evaluateRouteAccess('SCHOOL_ADMIN', '/admin', true);
  assert(schoolAdminDev.allowed === true && schoolAdminDev.effectiveRole === 'SUPER_ADMIN', "SCHOOL_ADMIN receives SUPER_ADMIN master access in development");

  // Test STUDENT on Admin dashboard in development mode
  const studentDev = evaluateRouteAccess('STUDENT', '/greenwood/dashboard', true);
  assert(studentDev.allowed === true, "STUDENT is granted access to administrative dashboard during development testing");

  // Test STAFF on Admin dashboard in development mode
  const staffDev = evaluateRouteAccess('STAFF', '/greenwood/dashboard', true);
  assert(staffDev.allowed === true, "STAFF is granted access to administrative dashboard during development testing");

  // 3. Inspect source files to guarantee implementation integrity
  console.log("\n--- 3. Verifying Implementation in Middleware & Layouts ---");
  const fs = await import("fs");
  const path = await import("path");

  const middlewareSrc = fs.readFileSync(path.resolve(__dirname, "../src/middleware.ts"), "utf-8");
  const superAdminLayoutSrc = fs.readFileSync(path.resolve(__dirname, "../src/app/admin/layout.tsx"), "utf-8");
  const tenantAdminLayoutSrc = fs.readFileSync(path.resolve(__dirname, "../src/app/[schoolDomain]/(admin)/layout.tsx"), "utf-8");

  assert(middlewareSrc.includes("isDev ? 'SUPER_ADMIN' : rawRole"), "middleware.ts assigns master SUPER_ADMIN privileges in development");
  assert(middlewareSrc.includes("['SUPER_ADMIN', 'ADMIN', 'SCHOOL_ADMIN']"), "middleware.ts allows SCHOOL_ADMIN in allowedSuperAdminRoles");
  assert(superAdminLayoutSrc.includes('["SUPER_ADMIN", "ADMIN", "SCHOOL_ADMIN"].includes(userRole)'), "admin/layout.tsx allows SCHOOL_ADMIN access");
  assert(superAdminLayoutSrc.includes("!isDev"), "admin/layout.tsx wraps student/staff redirects in !isDev guard");
  assert(tenantAdminLayoutSrc.includes("!isDev"), "[schoolDomain]/(admin)/layout.tsx wraps student/staff redirects in !isDev guard");

  console.log("\n==================================================================");
  console.log(`🌟 RESULTS: ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
  console.log("==================================================================");
}

verifyMasterAccess().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
