import { basePrisma } from "../src/lib/tenant-prisma";

async function main() {
  const users = await basePrisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      schoolId: true,
      school: {
        select: {
          subdomain: true,
          name: true,
        },
      },
    },
    take: 10,
  });

  console.log("Admins:", JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => basePrisma.$disconnect());
