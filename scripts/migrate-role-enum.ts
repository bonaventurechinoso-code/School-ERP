import { basePrisma } from "../src/lib/tenant-prisma";

async function testEnum() {
  await basePrisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRINCIPAL';`);
  await basePrisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VICE_PRINCIPAL';`);
  await basePrisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HEADMASTER';`);
  console.log("Successfully added enum values to Role in PostgreSQL!");
}

testEnum().catch(console.error).finally(() => process.exit(0));
