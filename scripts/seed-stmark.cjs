require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seedStMark() {
  console.log("=== PROVISIONING ST. MARK SECONDARY SCHOOL IN LOCAL DB ===");
  const now = new Date();
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const passwordHash = await bcrypt.hash("Password123", 10);

  let school = await prisma.school.findUnique({
    where: { subdomain: "stmark" },
    include: { staff: true, academicTiers: true }
  });

  if (!school) {
    school = await prisma.school.create({
      data: {
        name: "St. Mark Secondary School",
        subdomain: "stmark",
        slug: "stmark",
        status: "ACTIVE",
        isActive: true,
        isBanned: false,
        trialStartDate: now,
        trialEndDate: fourteenDaysOut,
        collectionMode: "MANUAL_BANK_TRANSFER",
      }
    });
    console.log("Created School:", school.name, `(${school.subdomain})`);

    // Add Academic Tier
    await prisma.academicTier.create({
      data: {
        schoolId: school.id,
        name: "SECONDARY",
        level: 1,
      }
    });

    // Add Subscription
    await prisma.subscription.create({
      data: {
        schoolId: school.id,
        plan: "14_DAY_TRIAL",
        amount: 0.0,
        status: "ACTIVE",
        paymentMethod: "MANUAL",
        verifiedByAdmin: true,
        expiresAt: fourteenDaysOut,
      }
    });

    // Department
    const dept = await prisma.department.create({
      data: { schoolId: school.id, name: "Administration" }
    });

    // Admin staff
    const adminStaff = await prisma.staff.create({
      data: {
        schoolId: school.id,
        firstName: "Admin",
        lastName: "User",
        email: "admin@stmark.edu.ng",
        role: "ADMIN",
        departmentId: dept.id,
        status: "ACTIVE",
        activeAt: now,
        password: passwordHash
      }
    });
    console.log("Created Admin Staff:", adminStaff.email);

    // Also create Principal and Bursar for quick testing
    const principalStaff = await prisma.staff.create({
      data: {
        schoolId: school.id,
        firstName: "Rev. Fr.",
        lastName: "Mark",
        email: "principal@stmark.edu.ng",
        role: "Principal",
        departmentId: dept.id,
        status: "ACTIVE",
        activeAt: now,
        password: passwordHash
      }
    });
    console.log("Created Principal Staff:", principalStaff.email);

    const bursarStaff = await prisma.staff.create({
      data: {
        schoolId: school.id,
        firstName: "Mr. John",
        lastName: "Bursar",
        email: "bursar@stmark.edu.ng",
        role: "Bursar",
        departmentId: dept.id,
        status: "ACTIVE",
        activeAt: now,
        password: passwordHash
      }
    });
    console.log("Created Bursar Staff:", bursarStaff.email);

    // Schema
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_stmark";`);
    console.log("Created schema tenant_stmark");
  } else {
    console.log("School stmark already exists. Ensuring staff password is set...");
    for (const st of school.staff) {
      await prisma.staff.update({
        where: { id: st.id },
        data: { password: passwordHash }
      });
      console.log(`Updated password for ${st.email}`);
    }
  }

  console.log("\n=== ST. MARK PROVISIONED SUCCESSFULLY ===");
}

seedStMark().catch(console.error).finally(() => prisma.$disconnect());
