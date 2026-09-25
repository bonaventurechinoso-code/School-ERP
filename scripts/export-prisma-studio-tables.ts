import { basePrisma } from "../src/lib/tenant-prisma";

async function exportTables() {
  console.log("=== PRISMA STUDIO DATA AUDIT ===\n");

  console.log("1. USER TABLE RECENT ROWS:");
  const users = await basePrisma.user.findMany({
    take: 10,
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
  console.table(users);

  console.log("\n2. STAFF TABLE RECENT ROWS (Notice userId link and NO duplicate role/password):");
  const staff = await basePrisma.staff.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
    },
  });
  console.table(staff);

  console.log("\n3. STUDENT TABLE RECENT ROWS (Notice userId link and recalculated feeStatus):");
  const students = await basePrisma.student.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      feeStatus: true,
      mustChangePassword: true,
    },
  });
  console.table(students);

  console.log("\n4. USER ROLES BREAKDOWN:");
  const roleGroups = await basePrisma.user.groupBy({
    by: ["role"],
    _count: { id: true },
  });
  console.table(roleGroups.map(g => ({ role: g.role, count: g._count.id })));

  console.log("\n5. STUDENT FEE STATUS BREAKDOWN:");
  const feeGroups = await basePrisma.student.groupBy({
    by: ["feeStatus"],
    _count: { id: true },
  });
  console.table(feeGroups.map(g => ({ feeStatus: g.feeStatus, count: g._count.id })));
}

exportTables()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());
