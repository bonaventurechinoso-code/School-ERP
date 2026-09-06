"use server";

import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

export async function acceptOfferAction(token: string, schoolDomain: string) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain }
    });
    if (!school) throw new Error("School not found");

    const tenantDb = getTenantClient(school.id);
    const lead = await tenantDb.admissionLead.findUnique({
      where: { offerToken: token }
    });

    if (!lead || lead.status !== "APPROVED") {
      throw new Error("Invalid or expired offer token");
    }

    // Run transaction via basePrisma to bridge into Student Lifecycle
    await basePrisma.$transaction(async (tx) => {
      // 1. Update lead status
      const updatedLead = await tx.admissionLead.update({
        where: { id: lead.id, schoolId: school.id },
        data: { status: "ENROLLED" }
      });

      // 2. Map names
      const names = updatedLead.applicantName.split(" ");
      const firstName = names[0];
      const lastName = names.length > 1 ? names.slice(1).join(" ") : "Student";

      // 3. Create Student profile
      await tx.student.create({
        data: {
          schoolId: school.id,
          tierId: updatedLead.tierId,
          firstName,
          lastName,
          parentPhone: updatedLead.parentContact,
          parentEmail: updatedLead.parentEmail,
          status: "ENROLLED",
          enrolledAt: new Date(),
        }
      });
    });

    revalidatePath(`/${schoolDomain}/admissions/accept`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function declineOfferAction(token: string, schoolDomain: string) {
  try {
    const school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain }
    });
    if (!school) throw new Error("School not found");

    const tenantDb = getTenantClient(school.id);
    const lead = await tenantDb.admissionLead.findUnique({
      where: { offerToken: token }
    });

    if (!lead || lead.status !== "APPROVED") {
      throw new Error("Invalid or expired offer token");
    }

    await tenantDb.admissionLead.update({
      where: { id: lead.id },
      data: { status: "REJECTED" } // Using REJECTED or DECLINED
    });

    revalidatePath(`/${schoolDomain}/admissions/accept`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
