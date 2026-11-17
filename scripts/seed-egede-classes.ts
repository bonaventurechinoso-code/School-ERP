import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const egede = await basePrisma.school.findFirst({
    where: { subdomain: "egede" },
    include: { academicTiers: true },
  });

  if (!egede) {
    console.error("Egede school not found");
    return;
  }

  const primaryTier = egede.academicTiers.find(t => t.name.toLowerCase().includes("primary"));
  const nurseryTier = egede.academicTiers.find(t => t.name.toLowerCase().includes("nursery") || t.name.toLowerCase().includes("kindergarten"));

  const classesToEnsure = [
    { name: "Creche", tierId: nurseryTier?.id || null, capacity: 20 },
    { name: "Nursery 1", tierId: nurseryTier?.id || null, capacity: 25 },
    { name: "Nursery 2", tierId: nurseryTier?.id || null, capacity: 25 },
    { name: "Primary 1", tierId: primaryTier?.id || null, capacity: 35 },
    { name: "Primary 2", tierId: primaryTier?.id || null, capacity: 35 },
    { name: "Primary 3", tierId: primaryTier?.id || null, capacity: 35 },
    { name: "Primary 4", tierId: primaryTier?.id || null, capacity: 35 },
    { name: "Primary 5", tierId: primaryTier?.id || null, capacity: 35 },
    { name: "Primary 6", tierId: primaryTier?.id || null, capacity: 35 },
  ];

  for (const c of classesToEnsure) {
    const existing = await basePrisma.classroom.findFirst({
      where: {
        schoolId: egede.id,
        name: c.name,
      },
    });

    if (existing) {
      await basePrisma.classroom.update({
        where: { id: existing.id },
        data: { tierId: c.tierId },
      });
      console.log(`Updated classroom: ${c.name} for Egede`);
    } else {
      await basePrisma.classroom.create({
        data: {
          schoolId: egede.id,
          name: c.name,
          capacity: c.capacity,
          tierId: c.tierId,
        },
      });
      console.log(`Created classroom: ${c.name} for Egede`);
    }
  }

  console.log("✅ Egede classrooms seeded successfully!");
}

main().catch(console.error).finally(() => basePrisma.$disconnect());
