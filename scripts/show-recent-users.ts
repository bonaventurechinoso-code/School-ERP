import { basePrisma } from "../src/lib/tenant-prisma";

async function showTopUsers() {
  const users = await basePrisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      mustChangePassword: true,
      status: true,
      createdAt: true,
    },
  });
  console.log(JSON.stringify(users, null, 2));
}

showTopUsers().finally(() => basePrisma.$disconnect());
