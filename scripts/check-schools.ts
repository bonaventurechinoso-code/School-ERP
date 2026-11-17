import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const schools = await basePrisma.school.findMany({
    select: {
      id: true,
      name: true,
      subdomain: true,
      academicTiers: { select: { id: true, name: true, level: true } },
      classrooms: { select: { id: true, name: true, tierId: true } },
    },
  });
  console.log("=== SCHOOLS AND CLASSROOMS IN DATABASE ===");
  for (const s of schools) {
    console.log(`School: ${s.name} (${s.subdomain}) - ID: ${s.id}`);
    console.log(`  Tiers (${s.academicTiers.length}):`, s.academicTiers.map(t => t.name).join(", "));
    console.log(`  Classrooms (${s.classrooms.length}):`, s.classrooms.map(c => c.name).join(", "));
  }
}

main().catch(console.error).finally(() => basePrisma.$disconnect());
