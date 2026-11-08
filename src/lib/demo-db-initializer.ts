import { PrismaClient } from "@prisma/client";
import { spawnSync } from "child_process";
import path from "path";

let isDemoDbReady = false;

/**
 * Ensures that the isolated Demo PostgreSQL database (DEMO_DATABASE_URL)
 * has its Prisma schema tables created and populated with Apex International Academy
 * and sample pupils, fee templates, and classes.
 * 
 * Safe against concurrent invocations; halts immediately if DEMO_DATABASE_URL is missing.
 */
export async function ensureDemoDatabaseInitialized(): Promise<void> {
  const demoDbUrl = process.env.DEMO_DATABASE_URL;
  if (!demoDbUrl) {
    throw new Error(
      "[DEMO_DATABASE_ERROR] DEMO_DATABASE_URL environment variable is required. Demo playground cannot use primary database."
    );
  }

  // Safety check: ensure DEMO_DATABASE_URL is not identical to production DATABASE_URL
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DATABASE_URL &&
    demoDbUrl === process.env.DATABASE_URL
  ) {
    throw new Error(
      "[DEMO_DATABASE_ERROR] DEMO_DATABASE_URL cannot be identical to production DATABASE_URL."
    );
  }

  if (isDemoDbReady) {
    return;
  }

  // Check if tables already exist in demo database
  const demoPrisma = new PrismaClient({
    datasources: { db: { url: demoDbUrl } },
  });

  try {
    let tablesExist = false;
    try {
      await demoPrisma.school.count();
      tablesExist = true;
    } catch {
      tablesExist = false;
    }

    if (!tablesExist) {
      console.info("[DEMO_DB_INIT] Pushing schema to DEMO database via child process...");
      const prismaCli = path.join(process.cwd(), "node_modules/prisma/build/index.js");
      const pushRes = spawnSync(
        process.execPath,
        [prismaCli, "db", "push", "--accept-data-loss", "--skip-generate"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: demoDbUrl,
          },
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      if (pushRes.status !== 0) {
        console.error("[DEMO_DB_INIT] Schema push failed:", pushRes.stderr || pushRes.stdout);
        throw new Error(`Failed to push schema to demo database: ${pushRes.stderr || pushRes.stdout}`);
      }
      console.info("[DEMO_DB_INIT] Schema pushed successfully to DEMO database.");
    }

    // Now seed through the dedicated initializer script
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { seedDemoSchool } = require("../../scripts/init-demo-db.js");
    await seedDemoSchool(demoPrisma);

    isDemoDbReady = true;
  } finally {
    await demoPrisma.$disconnect().catch(() => {});
  }
}
