const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'Tenant' 
    ORDER BY ordinal_position;
  `);
  console.log("PostgreSQL Tenant Table Columns:");
  console.table(cols);

  const sampleRows = await prisma.tenant.findMany({
    select: {
      id: true,
      schoolName: true,
      subdomain: true,
      status: true,
      subscriptionStatus: true,
      isDemo: true,
      isTrial: true,
      trialEndsAt: true,
    }
  });
  console.log("Current Tenant Records in DB:");
  console.table(sampleRows);
}

main().catch(console.error).finally(() => prisma.$disconnect());
