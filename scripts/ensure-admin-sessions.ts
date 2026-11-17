import { basePrisma } from "../src/lib/tenant-prisma";
import { createDatabaseSession } from "../src/lib/session-manager";
import bcrypt from "bcryptjs";

async function main() {
  const egede = await basePrisma.school.findFirst({ where: { subdomain: "egede" } });
  if (!egede) throw new Error("Egede not found");

  const pwHash = await bcrypt.hash("Password123!", 10);

  // Ensure admin user for Egede
  let egedeAdmin = await basePrisma.user.findFirst({
    where: { schoolId: egede.id, role: "SCHOOL_ADMIN" },
  });

  if (!egedeAdmin) {
    egedeAdmin = await basePrisma.user.create({
      data: {
        email: "admin@egede.bonaveeict.com.ng",
        password: pwHash,
        role: "SCHOOL_ADMIN",
        schoolId: egede.id,
        status: "ACTIVE",
      },
    });
    console.log("Created egede admin:", egedeAdmin.email);
  } else {
    console.log("Existing egede admin:", egedeAdmin.email);
  }

  // Create session for Egede Admin
  const egedeSession = await createDatabaseSession({
    userId: egedeAdmin.id,
    email: egedeAdmin.email,
    schoolDomain: "egede",
    tenantId: egede.id,
    role: "SCHOOL_ADMIN",
  });

  console.log("Egede Session Cookie:", egedeSession.cookieToken);

  // Get Demo Admin
  const demo = await basePrisma.school.findFirst({ where: { subdomain: "demo" } });
  if (!demo) throw new Error("Demo not found");

  let demoAdmin = await basePrisma.user.findFirst({
    where: { schoolId: demo.id, role: "SCHOOL_ADMIN" },
  });

  const demoSession = await createDatabaseSession({
    userId: demoAdmin!.id,
    email: demoAdmin!.email,
    schoolDomain: "demo",
    tenantId: demo.id,
    role: "SCHOOL_ADMIN",
  });

  console.log("Demo Session Cookie:", demoSession.cookieToken);
}

main().catch(console.error).finally(() => basePrisma.$disconnect());
