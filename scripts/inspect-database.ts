import { basePrisma } from "../src/lib/tenant-prisma";

async function inspect() {
  const users = await basePrisma.user.findMany({
    select: { id: true, email: true, role: true, schoolId: true, mustChangePassword: true, status: true },
  });
  const staff = await basePrisma.staff.findMany({
    select: {
      id: true,
      email: true,
      userId: true,
      schoolId: true,
      user: { select: { role: true, mustChangePassword: true } },
    },
  });
  const students = await basePrisma.student.findMany({
    select: {
      id: true,
      email: true,
      userId: true,
      schoolId: true,
      feeStatus: true,
      user: { select: { role: true, mustChangePassword: true } },
    },
  });

  console.log("Users count in User table:", users.length);
  console.log("User roles in User table:", [...new Set(users.map(u => u.role))]);
  console.log("Staff count:", staff.length);
  console.log("Staff linked to User:", staff.filter(s => s.userId).length);
  console.log("Staff roles via User link:", [...new Set(staff.map(s => s.user?.role))]);
  console.log("Students count:", students.length);
  console.log("Students linked to User:", students.filter(s => s.userId).length);
  console.log("Student fee statuses:", [...new Set(students.map(s => s.feeStatus))]);
}

inspect().catch(console.error).finally(() => process.exit(0));
