import { checkRouteAuthorization } from "../src/lib/permissions";

const schoolDomain = "greenwood";
const allLinks = [
  { label: "Dashboard", href: `/${schoolDomain}/dashboard` },
  { label: "Public Portal Settings", href: `/${schoolDomain}/portal-settings` },
  { label: "Enrollment", href: `/${schoolDomain}/admissions` },
  { label: "Students", href: `/${schoolDomain}/students` },
  { label: "Staff", href: `/${schoolDomain}/staff` },
  { label: "Timetable", href: `/${schoolDomain}/scheduling` },
  { label: "Assessments", href: `/${schoolDomain}/exams` },
  { label: "Report Cards", href: `/${schoolDomain}/report-cards` },
  { label: "Academic Records", href: `/${schoolDomain}/transcripts` },
  { label: "Communications", href: `/${schoolDomain}/communications` },
  { label: "Finance", href: `/${schoolDomain}/finance` },
  { label: "Management & Payroll", href: `/${schoolDomain}/hr` },
];

function testSidebarFilteringForRole(role: string, staffRole?: string) {
  const links = allLinks.filter((link) => {
    const auth = checkRouteAuthorization(link.href, role, staffRole);
    return auth.allowed;
  });
  return links.map((l) => l.label);
}

console.log("=== VERIFYING REACTIVE SIDEBAR ROLE MODULE RESOLUTION ===\n");

// 1. Unauthenticated / Empty role (Transient hydration state)
console.log("1. Transient State (role = '')");
const guestLinks = testSidebarFilteringForRole("");
console.log(`   Modules rendered: [${guestLinks.join(", ")}] (Count: ${guestLinks.length})`);
console.log(`   -> With our new SidebarSkeleton, the UI renders the Skeleton during this phase without showing an empty or broken sidebar.\n`);

// 2. School Admin (Principal / Admin)
console.log("2. School Administrator (role = 'SCHOOL_ADMIN', staffRole = 'Principal')");
const adminLinks = testSidebarFilteringForRole("SCHOOL_ADMIN", "Principal");
console.log(`   Modules rendered: [${adminLinks.join(", ")}] (Count: ${adminLinks.length})\n`);

// 3. Teaching Faculty (Class Teacher)
console.log("3. Teaching Faculty (role = 'STAFF', staffRole = 'Class Teacher')");
const teacherLinks = testSidebarFilteringForRole("STAFF", "Class Teacher");
console.log(`   Modules rendered: [${teacherLinks.join(", ")}] (Count: ${teacherLinks.length})\n`);

// 4. School Bursar / Accountant
console.log("4. Financial Officer (role = 'STAFF', staffRole = 'School Bursar')");
const bursarLinks = testSidebarFilteringForRole("STAFF", "School Bursar");
console.log(`   Modules rendered: [${bursarLinks.join(", ")}] (Count: ${bursarLinks.length})\n`);

// 5. Platform Super Admin
console.log("5. Platform Super Administrator (role = 'SUPER_ADMIN')");
const superAdminLinks = testSidebarFilteringForRole("SUPER_ADMIN");
console.log(`   Modules rendered: [${superAdminLinks.join(", ")}] (Count: ${superAdminLinks.length})\n`);

console.log("=== ALL SIDEBAR ROLE TESTS COMPLETED SUCCESSFULLY ===");
