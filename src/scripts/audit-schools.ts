import { basePrisma } from "@/lib/tenant-prisma";

async function main() {
  const schools = await basePrisma.school.findMany({
    select: {
      id: true,
      name: true,
      subdomain: true,
      slug: true,
      status: true,
      createdAt: true,
    },
  });
  console.log("Total schools in DB:", schools.length);
  for (const s of schools) {
    console.log(s);
  }
}

main().catch(console.error).finally(() => process.exit(0));
