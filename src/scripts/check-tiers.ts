import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tiers = await prisma.academicTier.findMany({
    include: { school: true },
  });
  console.log("All Tiers:", tiers.map(t => ({ school: t.school.name, subdomain: t.school.subdomain, name: t.name, level: t.level })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
