import { getDevMockRoleConfig, checkRouteAuthorization } from "../src/lib/permissions";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log("=== TESTING FLEXIBLE LOCAL DEV MOCK ROLE MODE ===\n");

// 1. Test Bursar Mock
const bursarMock = getDevMockRoleConfig("Bursar");
assert(bursarMock?.role === "STAFF", "Bursar maps to STAFF role");
assert(bursarMock?.staffRole === "Bursar", "Bursar preserves staffRole title");

const bursarFinance = checkRouteAuthorization("/greenwood/finance", bursarMock!.role, bursarMock!.staffRole);
assert(bursarFinance.allowed === true, "Mock Bursar can access /greenwood/finance");

const bursarExams = checkRouteAuthorization("/greenwood/exams", bursarMock!.role, bursarMock!.staffRole);
assert(bursarExams.allowed === false, "Mock Bursar is BLOCKED from /greenwood/exams (Assessments)");

// 2. Test Principal Mock
const principalMock = getDevMockRoleConfig("Principal");
assert(principalMock?.role === "SCHOOL_ADMIN", "Principal maps to SCHOOL_ADMIN role");
assert(principalMock?.staffRole === "Principal", "Principal preserves staffRole title");

const principalExams = checkRouteAuthorization("/greenwood/exams", principalMock!.role, principalMock!.staffRole);
assert(principalExams.allowed === true, "Mock Principal can access /greenwood/exams");

const principalFinance = checkRouteAuthorization("/greenwood/finance", principalMock!.role, principalMock!.staffRole);
assert(principalFinance.allowed === true, "Mock Principal can access /greenwood/finance");

// 3. Test Tertiary Professor Mock
const profMock = getDevMockRoleConfig("Professor");
assert(profMock?.role === "STAFF", "Professor maps to STAFF role");
assert(profMock?.staffRole === "Professor", "Professor preserves staffRole title");

const profExams = checkRouteAuthorization("/greenwood/exams", profMock!.role, profMock!.staffRole);
assert(profExams.allowed === true, "Mock Professor can access /greenwood/exams");

const profFinance = checkRouteAuthorization("/greenwood/finance", profMock!.role, profMock!.staffRole);
assert(profFinance.allowed === false, "Mock Professor is BLOCKED from /greenwood/finance");

// 4. Test Class Teacher Mock
const teacherMock = getDevMockRoleConfig("Class Teacher");
assert(teacherMock?.role === "STAFF", "Teacher maps to STAFF role");
assert(teacherMock?.staffRole === "Class Teacher", "Teacher preserves staffRole title");

const teacherExams = checkRouteAuthorization("/greenwood/exams", teacherMock!.role, teacherMock!.staffRole);
assert(teacherExams.allowed === true, "Mock Class Teacher can access /greenwood/exams");

// 5. Test Null / Inactive check
const emptyMock = getDevMockRoleConfig("");
assert(emptyMock === null, "Empty mock returns null for Secure Production Mode fallback");

console.log("\nALL FLEXIBLE DEV MOCK TESTS PASSED SUCCESSFULLY!");
