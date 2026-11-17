import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const schools = ["egede", "demo", "sandbox"];
  for (const s of schools) {
    const school = await basePrisma.school.findFirst({
      where: { subdomain: s },
      include: {
        academicTiers: true,
        users: {
          take: 5,
          select: { id: true, email: true, role: true },
        },
      },
    });
    console.log(`School: ${s}`, {
      id: school?.id,
      tiers: school?.academicTiers.map((t) => t.name),
      users: school?.users,
    });
  }
}

main().catch(console.error).finally(() => basePrisma.$disconnect());
