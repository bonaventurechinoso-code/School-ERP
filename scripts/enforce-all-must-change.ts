import { basePrisma } from "../src/lib/tenant-prisma";

async function enforceAllMustChangePassword() {
  console.log("Setting mustChangePassword = true across User and Student tables...");

  const userUpdate = await basePrisma.user.updateMany({
    where: {
      role: { not: "SUPER_ADMIN" },
    },
    data: {
      mustChangePassword: true,
    },
  });
  console.log(`Updated ${userUpdate.count} users in User table to mustChangePassword = true.`);

  const studentUpdate = await basePrisma.student.updateMany({
    data: {
      mustChangePassword: true,
    },
  });
  console.log(`Updated ${studentUpdate.count} students in Student table to mustChangePassword = true.`);

  // Verify counts
  const userStats = await basePrisma.user.groupBy({
    by: ["mustChangePassword"],
    _count: { id: true },
  });
  console.log("User table mustChangePassword stats:", userStats);

  const studentStats = await basePrisma.student.groupBy({
    by: ["mustChangePassword"],
    _count: { id: true },
  });
  console.log("Student table mustChangePassword stats:", studentStats);
}

enforceAllMustChangePassword()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());
