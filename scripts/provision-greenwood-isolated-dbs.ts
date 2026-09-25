import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const firstNames = ["Emeka", "Amina", "Oluwaseun", "Chioma", "Chinedu", "Fatima", "Ayodeji", "Ngozi", "Tunde", "Zainab", "Kelechi", "Adeola", "Musa", "Blessing", "Chukwudi", "Ifeoma", "Abubakar", "Funke", "Nnamdi", "Binta"];
const lastNames = ["Adebayo", "Okafor", "Danjuma", "Chukwu", "Balogun", "Ibrahim", "Okoro", "Adeyemi", "Eze", "Mohammed", "Ogunleye", "Nwosu", "Abiola", "Aliyu", "Obi", "Ojo", "Umar", "Akinyemi", "Nwachukwu", "Sanusi"];
const states = ["Lagos", "Kano", "Rivers", "Kaduna", "Oyo", "Abuja", "Enugu", "Delta", "Anambra", "Edo"];
const occupations = ["Engineer", "Trader", "Civil Servant", "Teacher", "Doctor", "Businesswoman", "Banker", "Lawyer", "Contractor", "Farmer"];

const getRandomItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function provision() {
  console.log("=== Provisioning Physical Isolated Databases for Greenwood Academy ===");

  const basePrisma = new PrismaClient();
  const baseDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/school_erp?schema=public";

  // 1. Locate Greenwood Academy in main database
  const school = await basePrisma.school.findUnique({
    where: { subdomain: "greenwood" },
  });

  if (!school) {
    console.error("Greenwood Academy tenant not found in main database!");
    process.exit(1);
  }

  console.log(`Found Greenwood Academy: ${school.id}`);

  const tierConfigs = [
    {
      tierKey: "NURSERY",
      tierName: "Daycare / Nursery",
      dbName: "greenwood_nursery_db",
      classes: ["Crèche / Daycare", "Nursery 1", "Nursery 2", "Kindergarten"],
      studentCount: 15,
      level: 1,
    },
    {
      tierKey: "PRIMARY",
      tierName: "Primary School",
      dbName: "greenwood_primary_db",
      classes: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
      studentCount: 20,
      level: 2,
    },
    {
      tierKey: "SECONDARY",
      tierName: "Secondary School",
      dbName: "greenwood_secondary_db",
      classes: ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
      studentCount: 20,
      level: 3,
    },
  ];

  const tierDatabasesConfig: Record<string, string> = {};
  let nurseryDbUrl = "";
  let primaryDbUrl = "";
  let secondaryDbUrl = "";

  for (const config of tierConfigs) {
    const tierDbUrl = baseDbUrl.replace(/\/[^/?]+(\?.*)?$/, `/${config.dbName}$1`);
    tierDatabasesConfig[config.tierKey] = tierDbUrl;
    if (config.tierKey === "NURSERY") nurseryDbUrl = tierDbUrl;
    if (config.tierKey === "PRIMARY") primaryDbUrl = tierDbUrl;
    if (config.tierKey === "SECONDARY") secondaryDbUrl = tierDbUrl;

    console.log(`\n--- Setting Up Database: ${config.dbName} (${config.tierName}) ---`);

    // A. Create physical database if not exists
    try {
      const checkResult: any[] = await basePrisma.$queryRawUnsafe(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        config.dbName
      );

      if (!checkResult || checkResult.length === 0) {
        console.log(`Creating physical database "${config.dbName}"...`);
        await basePrisma.$executeRawUnsafe(`CREATE DATABASE "${config.dbName}"`);
        console.log(`✓ Physical database "${config.dbName}" created.`);
      } else {
        console.log(`Physical database "${config.dbName}" already exists.`);
      }
    } catch (createErr: any) {
      console.warn(`Note creating database ${config.dbName}:`, createErr?.message);
    }

    // B. Push schema to target physical database
    console.log(`Pushing Prisma schema to ${config.dbName}...`);
    try {
      await execAsync(`npx prisma db push --schema=prisma/schema.prisma --accept-data-loss --skip-generate`, {
        env: { ...process.env, DATABASE_URL: tierDbUrl },
        timeout: 45000,
      });
      console.log(`✓ Schema synchronized to ${config.dbName}.`);
    } catch (pushErr: any) {
      console.error(`Error pushing schema to ${config.dbName}:`, pushErr?.message);
      continue;
    }

    // C. Connect to the isolated physical database and seed ONLY its specific tier records
    const tierPrisma = new PrismaClient({
      datasources: { db: { url: tierDbUrl } },
    });

    try {
      // Clean isolated database tables
      await tierPrisma.examResult.deleteMany().catch(() => {});
      await tierPrisma.exam.deleteMany().catch(() => {});
      await tierPrisma.student.deleteMany().catch(() => {});
      await tierPrisma.classroom.deleteMany().catch(() => {});
      await tierPrisma.course.deleteMany().catch(() => {});
      await tierPrisma.academicTier.deleteMany().catch(() => {});
      await tierPrisma.school.deleteMany().catch(() => {});

      // Upsert School in isolated DB
      await tierPrisma.school.create({
        data: {
          id: school.id,
          name: school.name,
          subdomain: school.subdomain,
          databaseUrl: tierDbUrl,
          isMultiDbEnabled: true,
          isActive: true,
        },
      });

      // Create AcademicTier in isolated DB
      const tier = await tierPrisma.academicTier.create({
        data: {
          id: `${school.id}-${config.tierKey.toLowerCase()}`,
          name: config.tierName,
          schoolId: school.id,
          level: config.level,
          databaseUrl: tierDbUrl,
          databaseName: config.dbName,
        },
      });

      // Create Classrooms
      for (const className of config.classes) {
        await tierPrisma.classroom.create({
          data: {
            name: className,
            capacity: 35,
            schoolId: school.id,
            tierId: tier.id,
          },
        });
      }

      // Department & Admin Staff
      const dept = await tierPrisma.department.create({
        data: {
          name: `${config.tierName} Administration`,
          schoolId: school.id,
        },
      });

      await tierPrisma.staff.create({
        data: {
          schoolId: school.id,
          firstName: "Admin",
          lastName: "User",
          email: "admin@greenwood.edu",
          departmentId: dept.id,
          status: "ACTIVE",
        },
      });

      // Optional Secondary Course & Exam
      let examId = "";
      if (config.tierKey === "SECONDARY") {
        const course = await tierPrisma.course.create({
          data: {
            name: "Mathematics",
            code: "MATH101",
            schoolId: school.id,
            tierId: tier.id,
          },
        });

        const exam = await tierPrisma.exam.create({
          data: {
            schoolId: school.id,
            courseId: course.id,
            name: "First Term Examination",
            semester: "1st Term",
            date: new Date(),
            maxScore: 100,
          },
        });
        examId = exam.id;
      }

      // Seed strictly isolated students
      for (let i = 1; i <= config.studentCount; i++) {
        const firstName = getRandomItem(firstNames);
        const lastName = getRandomItem(lastNames);
        const seq = String(i).padStart(3, "0");
        const admissionNumber = `GW/${config.tierKey.substring(0, 3)}/2026/${seq}`;
        const currentClass = getRandomItem(config.classes);

        const student = await tierPrisma.student.create({
          data: {
            schoolId: school.id,
            tierId: tier.id,
            firstName,
            lastName,
            status: "ENROLLED",
            admissionNumber,
            currentClass,
            stateOfOrigin: getRandomItem(states),
            parentName: `Mr/Mrs ${lastName}`,
            parentOccupation: getRandomItem(occupations),
            parentEmail: `parent.${lastName.toLowerCase()}@gmail.com`,
            parentPhone: `+234${getRandomInt(7000000000, 9999999999)}`,
          },
        });

        if (examId) {
          await tierPrisma.examResult.create({
            data: {
              schoolId: school.id,
              studentId: student.id,
              examId,
              score: getRandomInt(50, 95),
              letterGrade: "A1",
            },
          });
        }
      }

      console.log(`✓ Seeded ${config.studentCount} isolated students into ${config.dbName}.`);
    } finally {
      await tierPrisma.$disconnect();
    }
  }

  // 2. Update Main Database Metadata for Greenwood Academy
  console.log("\n--- Updating Greenwood Academy Metadata in Main Database ---");
  await basePrisma.school.update({
    where: { id: school.id },
    data: {
      isMultiDbEnabled: true,
      tierDatabasesConfig,
      nurseryDbUrl,
      primaryDbUrl,
      secondaryDbUrl,
    },
  });

  // Update or upsert TenantTierDatabase records
  for (const config of tierConfigs) {
    const tierDbUrl = tierDatabasesConfig[config.tierKey];
    const dbRecord = await basePrisma.tenantTierDatabase.upsert({
      where: { schoolId_tierName: { schoolId: school.id, tierName: config.tierName } },
      update: {
        databaseName: config.dbName,
        databaseUrl: tierDbUrl,
        status: "ACTIVE",
        isProvisioned: true,
      },
      create: {
        schoolId: school.id,
        tierName: config.tierName,
        databaseName: config.dbName,
        databaseUrl: tierDbUrl,
        status: "ACTIVE",
        isProvisioned: true,
      },
    });

    await basePrisma.academicTier.updateMany({
      where: { schoolId: school.id, name: config.tierName },
      data: {
        databaseUrl: tierDbUrl,
        databaseName: config.dbName,
        tierDatabaseId: dbRecord.id,
      },
    });
  }

  console.log("✓ Main database metadata updated successfully!");
  console.log("=== Provisioning Complete! ===");
  await basePrisma.$disconnect();
}

provision().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
