"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

const VALID_TIERS = ['NURSERY', 'DAYCARE', 'PRIMARY', 'SECONDARY', 'PRIMARY_SECONDARY', 'UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION'];

export async function createSchool(formData: FormData) {
  const name = formData.get("name") as string;
  let subdomain = formData.get("subdomain") as string;
  const adminEmail = formData.get("adminEmail") as string;
  const contactPhone = formData.get("contactPhone") as string;
  const tiers = formData.getAll("tiers") as string[];

  if (!name || !subdomain || !adminEmail || tiers.length === 0) {
    console.error("Missing required fields or academic tiers.");
    return;
  }

  const invalidTiers = tiers.filter((t: string) => !VALID_TIERS.includes(t));
  if (invalidTiers.length > 0) {
    console.error(`Invalid academic tier subtypes provided: ${invalidTiers.join(', ')}`);
    return;
  }

  subdomain = subdomain.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!subdomain) {
    console.error("Subdomain cannot be empty or invalid.");
    return;
  }

  try {
    const formattedSubdomain = subdomain;
    
    await basePrisma.$transaction(async (tx) => {
      // Phase A: Create baseline Tenant management record
      // 1. Create School
      const school = await tx.school.create({
        data: {
          name,
          subdomain: formattedSubdomain,
          isActive: true
        }
      });

      // 2. Persist exact standardized backend enum keys as subtypes
      const tierPromises = tiers.map((tierName: string, index: number) => {
        return tx.academicTier.create({
          data: {
            schoolId: school.id,
            name: tierName,
            level: index + 1
          }
        });
      });
      await Promise.all(tierPromises);

      // 3. Create Default Admin
      await tx.staff.create({
        data: {
          schoolId: school.id,
          firstName: "Admin",
          lastName: "User",
          email: adminEmail,
          role: "ADMIN",
          status: "ACTIVE",
          activeAt: new Date()
        }
      });

      // 4. Create Default Department
      await tx.department.create({
        data: {
          schoolId: school.id,
          name: "Administration"
        }
      });

      // Phase B: Provision an isolated boundary
      await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "tenant_${formattedSubdomain}";`);
    });

    // Schema Migration Handshake: Programmatically duplicate baseline structures
    if (process.env.DATABASE_URL) {
      const dbUrl = new URL(process.env.DATABASE_URL);
      dbUrl.searchParams.set("schema", `tenant_${formattedSubdomain}`);
      
      await execAsync("npx prisma db push --skip-generate", {
        env: { ...process.env, DATABASE_URL: dbUrl.toString() }
      });
    }

    revalidatePath("/admin");
  } catch (error: any) {
    console.error(error.message);
  }
}

export async function toggleSchoolStatus(schoolId: string, currentStatus: boolean) {
  try {
    await basePrisma.school.update({
      where: { id: schoolId },
      data: { isActive: !currentStatus }
    });
    revalidatePath("/admin");
  } catch (error: any) {
    console.error(error.message);
  }
}

export async function softDeleteSchool(schoolId: string) {
  try {
    await basePrisma.school.update({
      where: { id: schoolId },
      data: { deletedAt: new Date() }
    });
    revalidatePath("/admin");
  } catch (error: any) {
    console.error(error.message);
  }
}
