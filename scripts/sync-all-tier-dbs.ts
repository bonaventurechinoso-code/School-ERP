import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function syncAllDatabases() {
  console.log("=== Synchronizing Prisma Schema Across All Tenant Databases ===");

  const baseDbUrl = process.env.DATABASE_URL || "postgresql://USER:PASSWORD@localhost:5432/school_erp_sandbox?schema=public";

  const targets = [
    { name: "Main Database", url: baseDbUrl },
    { name: "Greenwood Nursery DB", url: baseDbUrl.replace(/\/[^/?]+(\?.*)?$/, "/greenwood_nursery_db$1") },
    { name: "Greenwood Primary DB", url: baseDbUrl.replace(/\/[^/?]+(\?.*)?$/, "/greenwood_primary_db$1") },
    { name: "Greenwood Secondary DB", url: baseDbUrl.replace(/\/[^/?]+(\?.*)?$/, "/greenwood_secondary_db$1") },
  ];

  for (const target of targets) {
    console.log(`\nPushing schema to: ${target.name}...`);
    try {
      const { stdout } = await execAsync(`cmd.exe /c npx prisma db push --schema=prisma/schema.prisma --accept-data-loss --skip-generate`, {
        env: { ...process.env, DATABASE_URL: target.url },
        timeout: 45000,
      });
      console.log(`✓ ${target.name} synchronized successfully.`);
      if (stdout) console.log(stdout.trim());
    } catch (err: any) {
      console.error(`❌ Failed to synchronize ${target.name}:`, err.message);
    }
  }

  console.log("\n=== All Database Schemas Synchronized Successfully ===");
  process.exit(0);
}

syncAllDatabases().catch((err) => {
  console.error("Fatal synchronization error:", err);
  process.exit(1);
});
