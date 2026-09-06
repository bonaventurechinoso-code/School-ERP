"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";

export async function createNotice(
  schoolId: string,
  data: {
    title: string;
    content: string;
    targetAudience: string;
    priority: string;
  }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.notice.create({
      data: {
        schoolId,
        title: data.title,
        content: data.content,
        targetAudience: data.targetAudience,
        priority: data.priority,
      }
    });

    revalidatePath(`/[schoolDomain]/communications`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to create notice:", error);
    return { success: false, error: error.message || "Failed to create notice." };
  }
}

export async function deleteNotice(schoolId: string, id: string) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.notice.delete({
      where: { id }
    });

    revalidatePath(`/[schoolDomain]/communications`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete notice:", error);
    return { success: false, error: error.message || "Failed to delete notice." };
  }
}

export async function logMessage(
  schoolId: string,
  data: {
    recipientEmail: string;
    recipientType: string;
    messageType: string;
    subject: string;
    body: string;
  }
) {
  const tenantDb = getTenantClient(schoolId);
  
  try {
    await tenantDb.messageLog.create({
      data: {
        schoolId,
        recipientEmail: data.recipientEmail,
        recipientType: data.recipientType,
        messageType: data.messageType,
        subject: data.subject,
        body: data.body,
      }
    });

    revalidatePath(`/[schoolDomain]/communications`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to log message:", error);
    return { success: false, error: error.message || "Failed to log message." };
  }
}
