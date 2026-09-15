import { checkRouteAuthorization } from "../src/lib/permissions";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log("=== RUNNING ROLE-BASED ACCESS CONTROL (RBAC) TEST SUITE ===\n");

// 1. Test Bursar / Accountant Access
const bursarFinance = checkRouteAuthorization("/greenwood/finance", "STAFF", "School Bursar");
assert(bursarFinance.allowed === true, "Bursar can access /finance");

const bursarExams = checkRouteAuthorization("/greenwood/exams", "STAFF", "School Bursar");
assert(bursarExams.allowed === false, "Bursar CANNOT access /exams (Assessments)");

const bursarReportCards = checkRouteAuthorization("/greenwood/report-cards", "STAFF", "Bursar / Accountant");
assert(bursarReportCards.allowed === false, "Bursar CANNOT access /report-cards");

const bursarHR = checkRouteAuthorization("/greenwood/hr", "STAFF", "School Bursar");
assert(bursarHR.allowed === false, "Bursar CANNOT access /hr (Payroll)");

const bursarStudents = checkRouteAuthorization("/greenwood/students", "STAFF", "School Bursar");
assert(bursarStudents.allowed === true, "Bursar CAN access /students for fee tracking");

// 2. Test Class Teacher / Academic Faculty Access
const teacherExams = checkRouteAuthorization("/greenwood/exams", "STAFF", "Class Teacher");
assert(teacherExams.allowed === true, "Teacher can access /exams");

const teacherReportCards = checkRouteAuthorization("/greenwood/report-cards", "STAFF", "Class Teacher");
assert(teacherReportCards.allowed === true, "Teacher can access /report-cards");

const teacherFinance = checkRouteAuthorization("/greenwood/finance", "STAFF", "Class Teacher");
assert(teacherFinance.allowed === false, "Teacher CANNOT access /finance");

const teacherHR = checkRouteAuthorization("/greenwood/hr", "STAFF", "Subject Teacher");
assert(teacherHR.allowed === false, "Teacher CANNOT access /hr");

const teacherSettings = checkRouteAuthorization("/greenwood/portal-settings", "STAFF", "Form Teacher");
assert(teacherSettings.allowed === false, "Teacher CANNOT access /portal-settings");

// 3. Test Tertiary Professor Access
const profExams = checkRouteAuthorization("/greenwood/exams", "STAFF", "Professor");
assert(profExams.allowed === true, "Professor can access /exams");

const profFinance = checkRouteAuthorization("/greenwood/finance", "STAFF", "Professor");
assert(profFinance.allowed === false, "Professor CANNOT access /finance");

// 4. Test School Admin / Principal / Headmaster (Executive Leadership)
const principalFinance = checkRouteAuthorization("/greenwood/finance", "SCHOOL_ADMIN", "Principal");
assert(principalFinance.allowed === true, "Principal can access /finance");

const principalHR = checkRouteAuthorization("/greenwood/hr", "SCHOOL_ADMIN", "Principal");
assert(principalHR.allowed === true, "Principal can access /hr");

const headmasterExams = checkRouteAuthorization("/greenwood/exams", "SCHOOL_ADMIN", "Headmaster / Headmistress");
assert(headmasterExams.allowed === true, "Headmaster can access /exams");

// 5. Test Student Lockdown
const studentDashboard = checkRouteAuthorization("/greenwood/dashboard", "STUDENT");
assert(studentDashboard.allowed === false, "Student CANNOT access /dashboard");

const studentFinance = checkRouteAuthorization("/greenwood/finance", "STUDENT");
assert(studentFinance.allowed === false, "Student CANNOT access /finance");

// 6. Test Super Admin Console Lockdown
const superAdminMaster = checkRouteAuthorization("/admin", "SUPER_ADMIN");
assert(superAdminMaster.allowed === true, "Super Admin can access /admin");

const tenantAdminMaster = checkRouteAuthorization("/admin", "SCHOOL_ADMIN", "Principal");
assert(tenantAdminMaster.allowed === false, "Principal CANNOT access master /admin console");

console.log("\nALL 17 RBAC SECURITY TEST CASES PASSED SUCCESSFULLY!");
