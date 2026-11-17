import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const egede = await basePrisma.school.findFirst({
    where: { subdomain: "egede" },
    include: {
      academicTiers: true,
      classrooms: true,
    },
  });
  console.log("Egede:", JSON.stringify(egede, null, 2));
}

main().catch(console.error).finally(() => basePrisma.$disconnect());
