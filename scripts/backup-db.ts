import { basePrisma } from "../src/lib/tenant-prisma";
import fs from "fs";
import path from "path";

async function backup() {
  const backupDir = path.join(process.cwd(), "backup");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const schools = await basePrisma.school.findMany({ include: { academicTiers: true } });
  const users = await basePrisma.user.findMany();
  const staff = await basePrisma.staff.findMany();
  const students = await basePrisma.student.findMany();

  const backupData = {
    timestamp: new Date().toISOString(),
    schools,
    users,
    staff,
    students,
  };

  const backupFile = path.join(backupDir, `db-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`Database backup written to: ${backupFile}`);
}

backup().catch(console.error).finally(() => process.exit(0));
