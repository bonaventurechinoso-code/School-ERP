"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

export async function updatePortalSettings(
  schoolId: string, 
  data: { isPublicPortalEnabled: boolean; welcomeGreeting: string }
) {
  try {
    await basePrisma.school.update({
      where: { id: schoolId },
      data: {
        isPublicPortalEnabled: data.isPublicPortalEnabled,
        welcomeGreeting: data.welcomeGreeting,
      }
    });
    
    revalidatePath(`/[schoolDomain]/portal-settings`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to update portal settings:", error);
    return { success: false, error: "Failed to update portal settings." };
  }
}
