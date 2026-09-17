"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}

export async function updatePortalSettings(
  schoolId: string, 
  data: { 
    name?: string;
    contactPhone?: string;
    isPublicPortalEnabled: boolean; 
    welcomeGreeting: string;
  },
  schoolDomain?: string
) {
  try {
    const updatePayload: any = {
      isPublicPortalEnabled: data.isPublicPortalEnabled,
      welcomeGreeting: data.welcomeGreeting.trim(),
    };

    if (data.name?.trim()) {
      updatePayload.name = data.name.trim();
    }
    if (data.contactPhone !== undefined) {
      updatePayload.contactPhone = data.contactPhone.trim() || null;
    }

    await basePrisma.school.update({
      where: { id: schoolId },
      data: updatePayload
    });
    
    if (schoolDomain) {
      safeRevalidatePath(`/${schoolDomain}/portal-settings`, "page");
      safeRevalidatePath(`/${schoolDomain}`, "page");
      safeRevalidatePath(`/${schoolDomain}`, "layout");
      safeRevalidatePath(`/${schoolDomain}/apply`, "page");
    } else {
      safeRevalidatePath(`/portal-settings`, "page");
    }
    return { success: true };
  } catch (error: any) {
    console.error("[Portal Settings Action] Failed to update portal settings:", error);
    return { success: false, error: error.message || "Failed to update portal settings." };
  }
}
