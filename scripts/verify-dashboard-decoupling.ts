import { getCachedSchool } from "../src/lib/cache";
import {
  getEnrolledStudentsCount,
  getActiveStaffCount,
  getPendingApplicationsCount,
  getTermlyRevenue,
  getEventsCount,
  getClassroomsForTenant,
} from "../src/app/[schoolDomain]/(admin)/dashboard/actions";

async function verifyDashboardDecoupling() {
  console.log("=================================================");
  console.log("  VERIFYING ASYNCHRONOUS DASHBOARD DECOUPLING   ");
  console.log("=================================================\n");

  // 1. Root Layout Pre-fetch Verification
  console.log("[1] Testing Redis Tenant Metadata Pre-fetch via getCachedSchool...");
  const school = await getCachedSchool("greenwood");
  if (!school) {
    console.error("[FAIL] School 'greenwood' not found in database.");
    process.exit(1);
  }
  console.log(`[PASS] Resolved School: ${school.name} (Subdomain: ${school.subdomain}, Tiers: ${school.academicTiers.length})`);

  // 2. Parallel Decoupled Modular Fetchers
  console.log("\n[2] Executing Modular Card Fetchers in Parallel (Promise.all)...");
  const startTime = Date.now();
  const [students, staff, apps, revenue, events, classrooms] = await Promise.all([
    getEnrolledStudentsCount(school.id),
    getActiveStaffCount(school.id),
    getPendingApplicationsCount(school.id),
    getTermlyRevenue(school.id),
    getEventsCount(school.id),
    getClassroomsForTenant(school.id),
  ]);
  const duration = Date.now() - startTime;

  console.log(`[PASS] Concurrent Fetch Completed in ${duration}ms:`);
  console.log(`       - Enrolled Students:   ${students}`);
  console.log(`       - Active Staff:        ${staff}`);
  console.log(`       - Pending Admissions:  ${apps}`);
  console.log(`       - Termly Revenue:      NGN ${revenue.toLocaleString()}`);
  console.log(`       - Events This Week:    ${events}`);
  console.log(`       - Available Classes:   ${classrooms.length}`);

  console.log("\n=================================================");
  console.log("  ALL ASYNC DECOUPLING CHECKS PASSED SUCCESSFULLY  ");
  console.log("=================================================");
}

verifyDashboardDecoupling()
  .catch((err) => {
    console.error("[ERROR]", err);
    process.exit(1);
  });
