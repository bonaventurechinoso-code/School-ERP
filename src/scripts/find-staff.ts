import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.staff.findMany({
    where: { schoolId: "e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8" },
    include: { user: true },
  });
  console.log("Egede StaffProfiles:", JSON.stringify(staff, null, 2));
}

main().finally(() => prisma.$disconnect());
