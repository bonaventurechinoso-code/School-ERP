import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function applyIndexes() {
  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS "Student_schoolId_currentClass_idx" ON "Student"("schoolId", "currentClass");`,
    `CREATE INDEX IF NOT EXISTS "Staff_schoolId_role_idx" ON "Staff"("schoolId", "role");`,
    `CREATE INDEX IF NOT EXISTS "Staff_schoolId_email_idx" ON "Staff"("schoolId", "email");`,
    `CREATE INDEX IF NOT EXISTS "StudentAttendance_schoolId_studentId_date_idx" ON "StudentAttendance"("schoolId", "studentId", "date");`,
    `CREATE INDEX IF NOT EXISTS "StaffAttendance_schoolId_staffId_date_idx" ON "StaffAttendance"("schoolId", "staffId", "date");`,
    `CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant"("status");`,
    `CREATE INDEX IF NOT EXISTS "Tenant_createdAt_idx" ON "Tenant"("createdAt" DESC);`,
    `CREATE INDEX IF NOT EXISTS "Tenant_planId_idx" ON "Tenant"("planId");`,
    `CREATE INDEX IF NOT EXISTS "WalletTransaction_tenantId_createdAt_type_idx" ON "WalletTransaction"("tenantId", "createdAt", "type");`,
    `CREATE INDEX IF NOT EXISTS "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");`,
    `CREATE INDEX IF NOT EXISTS "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt" DESC);`,
    `CREATE INDEX IF NOT EXISTS "Subscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");`,
    `CREATE INDEX IF NOT EXISTS "Subscription_planId_idx" ON "Subscription"("planId");`,
    `CREATE INDEX IF NOT EXISTS "PlatformTransaction_tenantId_createdAt_idx" ON "PlatformTransaction"("tenantId", "createdAt" DESC);`,
  ];

  console.log("Applying PostgreSQL performance indexes safely without dropping any tables...");
  for (const sql of indexStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`[APPLIED]: ${sql}`);
    } catch (err) {
      console.warn(`[SKIP/WARN]: ${sql} -> ${err.message}`);
    }
  }
  console.log("\nAll performance indexes applied successfully!");
  await prisma.$disconnect();
  process.exit(0);
}

applyIndexes().catch((err) => {
  console.error("Index migration failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
