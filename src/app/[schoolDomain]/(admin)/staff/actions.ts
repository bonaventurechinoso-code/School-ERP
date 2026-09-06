"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

export async function createStaff(
  schoolId: string,
  data: { firstName: string; lastName: string; email: string; role: string; status: string }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    const timestampData: any = {};
    if (data.status === "ONBOARDING") timestampData.onboardingAt = new Date();
    if (data.status === "ACTIVE") timestampData.activeAt = new Date();

    await tenantDb.staff.create({
      data: {
        schoolId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
        status: data.status,
        ...timestampData
      }
    });

    revalidatePath(`/[schoolDomain]/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create staff:", error);
    return { success: false, error: error.message || "Failed to create staff." };
  }
}

export async function updateStaff(
  schoolId: string,
  staffId: string,
  data: { firstName: string; lastName: string; email: string; role: string }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.staff.update({
      where: { id: staffId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
      }
    });

    revalidatePath(`/[schoolDomain]/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to update staff:", error);
    return { success: false, error: error.message || "Failed to update staff." };
  }
}

export async function deleteStaff(schoolId: string, staffId: string) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.staff.delete({
      where: { id: staffId }
    });

    revalidatePath(`/[schoolDomain]/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete staff:", error);
    return { success: false, error: error.message || "Failed to delete staff." };
  }
}

export async function updateStaffStatus(
  schoolId: string,
  staffId: string,
  newStatus: string
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    const data: any = { status: newStatus };
    
    switch (newStatus) {
      case "ONBOARDING":
        data.onboardingAt = new Date();
        break;
      case "ACTIVE":
        data.activeAt = new Date();
        break;
      case "LEAVE":
        data.leaveAt = new Date();
        break;
      case "OFFBOARDED":
        data.offboardedAt = new Date();
        break;
      case "TERMINATED":
        data.terminatedAt = new Date();
        break;
    }

    await tenantDb.staff.update({
      where: { id: staffId },
      data
    });

    revalidatePath(`/[schoolDomain]/staff`, "page");
  } catch (error) {
    console.error("[Server Action] Failed to update staff status:", error);
    throw new Error("Failed to update staff status.");
  }
}
