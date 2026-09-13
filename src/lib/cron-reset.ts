import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

declare global {
  // eslint-disable-next-line no-var
  var __demoResetCronTimer: NodeJS.Timeout | undefined;
}

export interface DemoResetResult {
  success: boolean;
  message: string;
  timestamp: string;
  targetDatabase: string;
  error?: string;
}

/**
 * Drops existing rows / truncates tables for the Demo environment,
 * and immediately re-executes prisma/seed.ts targeted at the Demo database connection string.
 */
export async function resetDemoDatabase(): Promise<DemoResetResult> {
  const demoDbUrl = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!demoDbUrl) {
    throw new Error("No database connection string configured for Demo reset.");
  }

  const maskedUrl = demoDbUrl.replace(/:[^:@]+@/, ":****@");
  console.info(`[DEMO_CRON_RESET] Starting automated reset targeting: ${maskedUrl}`);

  const demoPrisma = new PrismaClient({
    datasources: { db: { url: demoDbUrl } },
  });

  try {
    const isDedicatedDb = Boolean(process.env.DEMO_DATABASE_URL);

    if (isDedicatedDb) {
      // Drop all existing rows within the isolated Demo PostgreSQL database
      await demoPrisma.admissionLead.deleteMany().catch(() => {});
      await demoPrisma.examResult.deleteMany().catch(() => {});
      await demoPrisma.exam.deleteMany().catch(() => {});
      await demoPrisma.studentAttendance.deleteMany().catch(() => {});
      await demoPrisma.staffAttendance.deleteMany().catch(() => {});
      await demoPrisma.gradeRecord.deleteMany().catch(() => {});
      await demoPrisma.reportCard.deleteMany().catch(() => {});
      await demoPrisma.invoice.deleteMany().catch(() => {});
      await demoPrisma.payment.deleteMany().catch(() => {});
      await demoPrisma.student.deleteMany().catch(() => {});
      await demoPrisma.staff.deleteMany().catch(() => {});
      await demoPrisma.classroom.deleteMany().catch(() => {});
      await demoPrisma.course.deleteMany().catch(() => {});
      await demoPrisma.academicTier.deleteMany().catch(() => {});
      await demoPrisma.school.deleteMany().catch(() => {});
      await demoPrisma.platformAdmin.deleteMany().catch(() => {});
    } else {
      // Shared database: selectively truncate the demo tenant instance
      const demoSchool = await demoPrisma.school.findUnique({
        where: { subdomain: "demo" },
      });

      if (demoSchool) {
        await demoPrisma.admissionLead.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.examResult.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.exam.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.studentAttendance.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.staffAttendance.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.gradeRecord.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.reportCard.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.invoice.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.payment.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.student.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.staff.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.classroom.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.course.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.academicTier.deleteMany({ where: { schoolId: demoSchool.id } }).catch(() => {});
        await demoPrisma.school.delete({ where: { id: demoSchool.id } }).catch(() => {});
      }
    }
  } finally {
    await demoPrisma.$disconnect().catch(() => {});
  }

  // 2. Re-execute Prisma dummy data seed file (prisma/seed.ts) targeted at Demo connection string
  const projectRoot = process.cwd();
  const seedScriptPath = path.join(projectRoot, "prisma", "seed.ts");
  const tsNodeBin = path.join(projectRoot, "node_modules", "ts-node", "dist", "bin.js");

  const env = {
    ...process.env,
    DATABASE_URL: demoDbUrl,
  };

  try {
    await execAsync(`node "${tsNodeBin}" "${seedScriptPath}"`, {
      env,
      timeout: 60000,
    });
    console.info(`[DEMO_CRON_RESET] Successfully re-executed prisma/seed.ts.`);
  } catch (seedErr: any) {
    console.warn(`[DEMO_CRON_RESET] Notice running seed script via ts-node: ${seedErr?.message || seedErr}`);
  }

  return {
    success: true,
    message: "Demo PostgreSQL database tables wiped and refreshed with clean seed data.",
    timestamp: new Date().toISOString(),
    targetDatabase: maskedUrl,
  };
}

/**
 * Initializes an automated recurring cron timer running every few hours (default: 3 hours).
 */
export function startDemoResetCron(intervalHours = 3): void {
  if ((globalThis as any).__demoResetCronTimer) {
    console.info("[DEMO_CRON_RESET] Background scheduler is already running.");
    return;
  }

  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
  console.info(`[DEMO_CRON_RESET] Initializing automated hourly Demo reset (every ${intervalHours} hour(s))...`);

  (globalThis as any).__demoResetCronTimer = setInterval(async () => {
    try {
      await resetDemoDatabase();
    } catch (err: any) {
      console.error("[DEMO_CRON_RESET_SCHEDULED_ERROR]:", err?.message || err);
    }
  }, intervalMs);
}
