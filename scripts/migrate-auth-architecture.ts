import { basePrisma } from "../src/lib/tenant-prisma";
import bcrypt from "bcryptjs";

async function migrateAuthArchitecture() {
  console.log("=== EXECUTING AUTH ARCHITECTURE & DATA MIGRATION ===");

  // 1. Add schema columns if not already present
  await basePrisma.$executeRawUnsafe(`ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "userId" TEXT UNIQUE;`);
  await basePrisma.$executeRawUnsafe(`ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "userId" TEXT UNIQUE;`);
  await basePrisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE';`);

  const defaultHash = await bcrypt.hash("Welcome123", 12);

  // 2. Migrate Staff to User table and link userId
  console.log("\nMigrating Staff records to User table...");
  const staffList = await basePrisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Staff";`);
  console.log(`Found ${staffList.length} staff records to verify/link.`);

  for (const staff of staffList) {
    const rawRole = (staff.role || "").toUpperCase();
    let canonicalRole: string = "TEACHER";
    if (rawRole.includes("VICE PRINCIPAL")) {
      canonicalRole = "VICE_PRINCIPAL";
    } else if (rawRole.includes("PRINCIPAL")) {
      canonicalRole = "PRINCIPAL";
    } else if (rawRole.includes("HEADMASTER")) {
      canonicalRole = "HEADMASTER";
    } else if (rawRole.includes("BURSAR")) {
      canonicalRole = "BURSAR";
    } else if (rawRole.includes("ADMIN")) {
      canonicalRole = "SCHOOL_ADMIN";
    } else {
      canonicalRole = "TEACHER";
    }

    const email = (staff.email || "").trim().toLowerCase();
    const schoolId = staff.schoolId;

    // Check if user exists
    let existingUser = await basePrisma.user.findFirst({
      where: { schoolId, email },
    });

    if (existingUser) {
      // Update User role and status to match Staff role!
      await basePrisma.$executeRawUnsafe(
        `UPDATE "User" SET "role" = $1::"Role", "firstName" = $2, "lastName" = $3, "status" = $4 WHERE "id" = $5;`,
        canonicalRole,
        staff.firstName || existingUser.firstName,
        staff.lastName || existingUser.lastName,
        staff.status || "ACTIVE",
        existingUser.id
      );
    } else {
      // Create user using raw SQL
      const newUserId = staff.id;
      await basePrisma.$executeRawUnsafe(
        `INSERT INTO "User" ("id", "schoolId", "email", "passwordHash", "firstName", "lastName", "role", "status", "mustChangePassword", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::"Role", $8, $9, NOW(), NOW())
         ON CONFLICT ("schoolId", "email") DO UPDATE SET "role" = $7::"Role", "status" = $8;`,
        newUserId,
        schoolId,
        email,
        staff.password || defaultHash,
        staff.firstName,
        staff.lastName,
        canonicalRole,
        staff.status || "ACTIVE",
        staff.mustChangePassword ?? false
      );
      existingUser = await basePrisma.user.findFirst({ where: { schoolId, email } });
    }

    if (existingUser) {
      // Link staff.userId = existingUser.id
      await basePrisma.$executeRawUnsafe(
        `UPDATE "Staff" SET "userId" = $1 WHERE "id" = $2;`,
        existingUser.id,
        staff.id
      );
    }
  }
  console.log("Staff migration and linking completed successfully.");

  // 3. Migrate Students to User table and link userId
  console.log("\nMigrating Student records to User table...");
  const studentList = await basePrisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Student";`);
  console.log(`Found ${studentList.length} student records to verify/link.`);

  for (const student of studentList) {
    const schoolId = student.schoolId;
    const admissionNo = (student.admissionNumber || student.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = student.email ? student.email.trim().toLowerCase() : `${admissionNo}@student.portal`;

    let existingUser = await basePrisma.user.findFirst({
      where: { schoolId, email },
    });

    if (!existingUser) {
      await basePrisma.$executeRawUnsafe(
        `INSERT INTO "User" ("id", "schoolId", "email", "passwordHash", "firstName", "lastName", "role", "status", "mustChangePassword", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'STUDENT'::"Role", 'ACTIVE', $7, NOW(), NOW())
         ON CONFLICT ("schoolId", "email") DO NOTHING;`,
        student.id,
        schoolId,
        email,
        defaultHash,
        student.firstName,
        student.lastName,
        student.mustChangePassword ?? false
      );
      existingUser = await basePrisma.user.findFirst({ where: { schoolId, email } });
    }

    if (existingUser) {
      // Link student.userId = existingUser.id
      await basePrisma.$executeRawUnsafe(
        `UPDATE "Student" SET "userId" = $1 WHERE "id" = $2;`,
        existingUser.id,
        student.id
      );
    }
  }
  console.log("Student migration and linking completed successfully.");

  // 4. Recalculate feeStatus for students based on Fee Payment table
  console.log("\nRecalculating feeStatus for all students based on Payments and Invoices...");
  const payments = await basePrisma.payment.findMany();
  const invoices = await basePrisma.invoice.findMany();

  console.log(`Found ${payments.length} payments and ${invoices.length} invoices.`);

  // Update students who have completed payment
  for (const payment of payments) {
    if (payment.studentId) {
      await basePrisma.student.update({
        where: { id: payment.studentId },
        data: { feeStatus: "PAID" },
      });
    }
  }

  // Set feeStatus = 'PARTIAL' or 'PAID' or 'UNPAID' based on invoice status
  for (const invoice of invoices) {
    if (invoice.studentId) {
      const studentPayments = payments.filter(p => p.studentId === invoice.studentId || p.invoiceId === invoice.id);
      const paidTotal = studentPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
      let calculatedStatus = "UNPAID";
      if (paidTotal >= invoice.amountDue && invoice.amountDue > 0) {
        calculatedStatus = "PAID";
      } else if (paidTotal > 0) {
        calculatedStatus = "PARTIAL";
      }
      await basePrisma.student.update({
        where: { id: invoice.studentId },
        data: { feeStatus: calculatedStatus },
      });
    }
  }

  console.log("Fee status recalculation completed.");

  // 5. Verify results
  const updatedUsers = await basePrisma.user.count();
  const linkedStaff = await basePrisma.$queryRawUnsafe<any[]>(`SELECT count(*) FROM "Staff" WHERE "userId" IS NOT NULL;`);
  const linkedStudents = await basePrisma.$queryRawUnsafe<any[]>(`SELECT count(*) FROM "Student" WHERE "userId" IS NOT NULL;`);
  const principalCount = await basePrisma.user.count({ where: { role: "PRINCIPAL" as any } });
  const bursarCount = await basePrisma.user.count({ where: { role: "BURSAR" as any } });
  const studentUserCount = await basePrisma.user.count({ where: { role: "STUDENT" as any } });

  console.log("\n=== VERIFICATION METRICS ===");
  console.log("Total Users in User table:", updatedUsers);
  console.log("Staff linked with userId:", linkedStaff[0]?.count);
  console.log("Students linked with userId:", linkedStudents[0]?.count);
  console.log("Users with PRINCIPAL role:", principalCount);
  console.log("Users with BURSAR role:", bursarCount);
  console.log("Users with STUDENT role:", studentUserCount);
}

migrateAuthArchitecture().catch(console.error).finally(() => process.exit(0));
