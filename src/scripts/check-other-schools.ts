import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      subdomain: true,
      slug: true,
      tier: true,
      academicTiers: true,
    },
  });
  console.log("All Schools in DB:", schools);
}

main().catch(console.error).finally(() => prisma.$disconnect());
