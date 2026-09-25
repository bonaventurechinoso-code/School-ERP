import { basePrisma } from "../src/lib/tenant-prisma";

async function showTestUsers() {
  const users = await basePrisma.user.findMany({
    where: { email: { contains: "1790364467575" } },
    select: {
      id: true,
      email: true,
      role: true,
      mustChangePassword: true,
      status: true,
      createdAt: true,
      staff: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
        }
      },
      student: {
        select: {
          id: true,
          userId: true,
          admissionNumber: true,
          feeStatus: true,
        }
      }
    }
  });

  console.log("=== CREATED VERIFICATION TEST ACCOUNTS ===");
  console.log(JSON.stringify(users, null, 2));
}

showTestUsers().finally(() => basePrisma.$disconnect());
