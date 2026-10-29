import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing Egede tenant and ensuring active status...");

  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  // 1. Force update Tenant for egede
  const updatedTenants = await prisma.tenant.updateMany({
    where: {
      OR: [
        { subdomain: "egede" },
        { slug: "egede" },
      ],
    },
    data: {
      isSuspended: false,
      isActive: true,
      status: "ACTIVE",
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: nextYear,
      suspendedAt: null,
      suspendedReason: null,
    },
  });
  console.log(`Updated ${updatedTenants.count} Tenant record(s).`);

  // 2. Force update School for egede
  const updatedSchools = await prisma.school.updateMany({
    where: {
      OR: [
        { subdomain: "egede" },
        { slug: "egede" },
      ],
    },
    data: {
      isSuspended: false,
      isActive: true,
      status: "ACTIVE",
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: nextYear,
      trialEndDate: nextYear,
      deletedAt: null,
    },
  });
  console.log(`Updated ${updatedSchools.count} School record(s).`);

  // 3. Find the school/tenant to ensure admin user
  const school = await prisma.school.findFirst({
    where: {
      OR: [
        { subdomain: "egede" },
        { slug: "egede" },
      ],
    },
  });

  if (school) {
    const passwordHash = await bcrypt.hash("Password123#", 10);
    // Check if user exists
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: "chinonsomabia8@gmail.com" },
          { email: "admin@egede.edu.ng" },
          { schoolId: school.id },
        ],
      },
    });

    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          school: { connect: { id: school.id } },
          passwordHash: passwordHash,
          status: "ACTIVE",
          mustChangePassword: false,
        },
      });
      console.log(`Updated admin user ${adminUser.email} with Password123#.`);
    } else {
      await prisma.user.create({
        data: {
          email: "chinonsomabia8@gmail.com",
          firstName: "Egede",
          lastName: "Admin",
          passwordHash: passwordHash,
          role: "SCHOOL_ADMIN",
          school: { connect: { id: school.id } },
          status: "ACTIVE",
          mustChangePassword: false,
        },
      });
      console.log("Created admin user chinonsomabia8@gmail.com with Password123#.");
    }
  }

  // 4. Invalidate Redis cache if REDIS_URL or KV configured
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const { Redis } = await import("ioredis");
      const redis = new Redis(redisUrl);
      const keys = await redis.keys("*egede*");
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Deleted ${keys.length} cached Redis key(s) for egede.`);
      }
      await redis.quit();
    }
  } catch (err) {
    console.log("Redis cache invalidation non-fatal note:", err);
  }

  console.log("Egede fixed successfully!");
}

main()
  .catch((e) => {
    console.error("Error fixing Egede:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
