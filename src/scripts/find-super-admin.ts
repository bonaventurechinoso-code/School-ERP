import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
  });
  console.log("SuperAdmins:", superAdmins.map((a) => ({ id: a.id, email: a.email, name: `${a.firstName} ${a.lastName}` })));

  const egedeUsers = await prisma.user.findMany({
    where: { schoolId: "e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8" },
  });
  console.log("Egede Users:", egedeUsers.map((u) => ({ id: u.id, email: u.email, role: u.role, name: `${u.firstName} ${u.lastName}` })));
}

main().finally(() => prisma.$disconnect());
