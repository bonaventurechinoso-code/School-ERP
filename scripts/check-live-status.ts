import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const demoSchool = await basePrisma.school.findUnique({ where: { subdomain: "demo" } });
  const sandboxSchool = await basePrisma.school.findUnique({ where: { subdomain: "sandbox" } });

  console.log("Demo School ID:", demoSchool?.id);
  console.log("Sandbox School ID:", sandboxSchool?.id);

  if (!demoSchool || !sandboxSchool) return;

  // 1. Check Demo Live Roster for ND 1
  try {
    const demoUrl = `https://demo.bonaveeict.com.ng/api/v1/report-cards/roster?schoolId=${demoSchool.id}&className=ND%201&term=1st%20Semester`;
    console.log("\nChecking Demo Live Roster:", demoUrl);
    const res = await fetch(demoUrl);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Roster items:", data.roster?.length || 0);
    if (data.roster && data.roster.length > 0) {
      console.log("Student 1:", JSON.stringify(data.roster[0], null, 2));
    }
  } catch (err: any) {
    console.error("Demo fetch error:", err.message);
  }

  // 2. Check Sandbox Live Roster for 100 Level
  try {
    const sandboxUrl = `https://sandbox.bonaveeict.com.ng/api/v1/report-cards/roster?schoolId=${sandboxSchool.id}&className=100%20Level&term=1st%20Semester`;
    console.log("\nChecking Sandbox Live Roster:", sandboxUrl);
    const res = await fetch(sandboxUrl);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Roster items:", data.roster?.length || 0);
    if (data.roster && data.roster.length > 0) {
      console.log("Student 1:", JSON.stringify(data.roster[0], null, 2));
    }
  } catch (err: any) {
    console.error("Sandbox fetch error:", err.message);
  }
}

main().finally(() => basePrisma.$disconnect());
