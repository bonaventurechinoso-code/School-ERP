"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { transitionStudentState } from "@/lib/lifecycle-handler";
import { revalidatePath } from "next/cache";

export async function advanceStudentState(
  schoolId: string, 
  studentId: string, 
  currentStatus: string, 
  targetStatus: string
) {
  const tenantDb = getTenantClient(schoolId);
  const updatePayload = transitionStudentState(currentStatus, targetStatus);
  
  try {
    await tenantDb.student.update({
      where: { id: studentId },
      data: updatePayload
    });

    revalidatePath(`/[schoolDomain]/dashboard/admissions`, "page");
    
  } catch (error) {
    console.error("[Server Action] Failed to advance student state:", error);
    throw new Error("Failed to transition student lifecycle state.");
  }
}
