import { basePrisma } from "../src/lib/tenant-prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("--- SCHOOLS ---");
  const schools = await basePrisma.school.findMany({
    select: { id: true, name: true, subdomain: true, slug: true, status: true, isActive: true },
  });
  console.log(JSON.stringify(schools, null, 2));

  console.log("--- ALL USERS WITH SCHOOL ---");
  const users = await basePrisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      schoolId: true,
      passwordHash: true,
      school: {
        select: { subdomain: true, slug: true, name: true, status: true }
      }
    }
  });
  
  for (const u of users) {
    const isPass1234 = await bcrypt.compare("Password1234", u.passwordHash).catch(() => false);
    const isPass123 = await bcrypt.compare("Password123", u.passwordHash).catch(() => false);
    console.log(`User: ${u.email} | School: ${u.school?.subdomain || "none"} (${u.school?.name}) | Status: ${u.status} | Role: ${u.role} | Password1234: ${isPass1234} | Password123: ${isPass123}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
