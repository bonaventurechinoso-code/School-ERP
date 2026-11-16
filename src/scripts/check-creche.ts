import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      subdomain: true,
      tier: true,
      tierDatabasesConfig: true,
      academicTiers: { select: { id: true, name: true } },
    },
  });
  console.log("Schools count:", schools.length);
  for (const s of schools) {
    console.log(`- School: ${s.name} (${s.subdomain}) | Tier: ${s.tier} | AcademicTiers: ${s.academicTiers.map(t => t.name).join(", ")}`);
  }

  const crecheStudents = await prisma.student.findMany({
    where: {
      OR: [
        { currentClass: { contains: "Creche", mode: "insensitive" } },
        { currentClass: { contains: "Playgroup", mode: "insensitive" } },
        { currentClass: { contains: "Toddler", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      currentClass: true,
      schoolId: true,
      school: { select: { name: true, subdomain: true } },
    },
  });
  console.log("\nCreche students count:", crecheStudents.length);
  for (const st of crecheStudents) {
    console.log(`- ${st.firstName} ${st.lastName} (${st.admissionNumber}) | Class: ${st.currentClass} | School: ${st.school.name} (${st.school.subdomain})`);
  }
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
