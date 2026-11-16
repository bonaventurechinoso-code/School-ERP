import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    include: { school: true },
  });
  console.log(`Total students across all schools: ${students.length}`);
  const okonkwoOrJoseph = students.filter(
    (s) =>
      s.firstName?.toLowerCase().includes("joseph") ||
      s.lastName?.toLowerCase().includes("okonkwo") ||
      s.lastName?.toLowerCase().includes("testtwo")
  );
  console.log("Matching students:", JSON.stringify(okonkwoOrJoseph, null, 2));

  // Let's also check all teachers / staff
  const staff = await prisma.staff.findMany({
    include: { school: true },
  });
  console.log(`Total staff: ${staff.length}`);
  const francisca = staff.filter(
    (s) =>
      s.firstName?.toLowerCase().includes("francisca") ||
      s.lastName?.toLowerCase().includes("okoli")
  );
  console.log("Matching staff:", JSON.stringify(francisca, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
