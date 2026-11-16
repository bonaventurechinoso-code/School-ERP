import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting full database & grade records backup...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `db-backup-${timestamp}.json`);

  // Target critical tables
  const backupData: Record<string, any> = {
    timestamp: new Date().toISOString(),
    purpose: "Pre-Phase 1 Grade Engine single-source-of-truth backup",
  };

  // Inspect models on prisma
  const models = [
    "gradeRecord",
    "academicRecord",
    "examResult",
    "reportCard",
    "student",
    "school",
    "tenant",
    "user",
    "classroom",
    "subject",
    "course",
    "curriculumSubject",
    "exam",
    "transcriptRecord",
  ];

  for (const model of models) {
    try {
      if ((prisma as any)[model] && typeof (prisma as any)[model].findMany === "function") {
        console.log(`Backing up model: ${model}...`);
        const records = await (prisma as any)[model].findMany();
        backupData[model] = records;
        console.log(`  -> ${records.length} records saved.`);
      }
    } catch (err: any) {
      console.warn(`Could not backup model ${model}: ${err.message}`);
    }
  }

  fs.writeFileSync(
    backupFile,
    JSON.stringify(backupData, (key, value) => (typeof value === "bigint" ? value.toString() : value), 2),
    "utf-8"
  );
  console.log(`\nSUCCESS: Backup successfully written to ${backupFile}`);
}

main()
  .catch((e) => {
    console.error("Backup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
