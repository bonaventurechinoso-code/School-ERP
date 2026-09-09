"use server";

import { revalidatePath } from "next/cache";
import { basePrisma } from "@/lib/tenant-prisma";

const VALID_TIERS = ['NURSERY', 'DAYCARE', 'PRIMARY', 'SECONDARY', 'PRIMARY_SECONDARY', 'UNIVERSITY', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION', 'COMBINED_NURSERY_PRIMARY_SECONDARY'];

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
    if (tiers.includes('COMBINED_NURSERY_PRIMARY_SECONDARY')) {
      const subdomains = [
          { suffix: '-nursery', tier: 'DAYCARE', name: `${name} Nursery` },
          { suffix: '-primary', tier: 'PRIMARY', name: `${name} Primary` },
          { suffix: '-secondary', tier: 'SECONDARY', name: `${name} Secondary` }
      ];
      await basePrisma.$transaction(async (tx) => {
        for (const sub of subdomains) {
          const tenantSubdomain = subdomain + sub.suffix;
          const school = await tx.school.create({
            data: {
              name: sub.name,
              subdomain: tenantSubdomain,
              isActive: true,
              academicTiers: {
                create: { name: sub.tier, level: 1 }
              }
            }
          });
          
          const dept = await tx.department.create({
            data: { name: "Administration", schoolId: school.id }
          });
          
          await tx.staff.create({
            data: {
              schoolId: school.id,
              firstName: "Admin",
              lastName: "User",
              email: adminEmail,
              role: "ADMIN",
              departmentId: dept.id,
              status: "ACTIVE",
              password: ""
            }
          });
        }
      });
    } else {
       await basePrisma.$transaction(async (tx) => {
          const school = await tx.school.create({
            data: {
              name,
              subdomain,
              isActive: true,
              academicTiers: {
                create: tiers.map((tierName, idx) => ({ name: tierName, level: idx + 1 }))
              }
            }
          });

          const dept = await tx.department.create({
            data: { name: "Administration", schoolId: school.id }
          });
          
          await tx.staff.create({
            data: {
              schoolId: school.id,
              firstName: "Admin",
              lastName: "User",
              email: adminEmail,
              role: "ADMIN",
              departmentId: dept.id,
              status: "ACTIVE",
              password: ""
            }
          });
       });
    }

    revalidatePath("/admin");
  } catch (error: any) {
    console.error("Database Error:", error.message);
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

export async function deleteSchool(schoolId: string) {
  try {
    await basePrisma.school.delete({
      where: { id: schoolId }
    });
    revalidatePath("/admin");
  } catch (error: any) {
    console.error(error.message);
  }
}
