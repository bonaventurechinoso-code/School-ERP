"use server";

import { getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { sendDirectCommunicationEmail, sendBroadcastNoticeEmail } from "@/lib/email-service";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}

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
    const notice = await tenantDb.notice.create({
      data: {
        schoolId,
        title: data.title,
        content: data.content,
        targetAudience: data.targetAudience,
        priority: data.priority,
      }
    });

    safeRevalidatePath(`/[schoolDomain]/communications`, "page");
    return { success: true, noticeId: notice.id };
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

    safeRevalidatePath(`/[schoolDomain]/communications`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to delete notice:", error);
    return { success: false, error: error.message || "Failed to delete notice." };
  }
}

export async function broadcastNotice(schoolId: string, noticeId: string) {
  try {
    const res = await sendBroadcastNoticeEmail({
      schoolId,
      noticeId,
    });

    safeRevalidatePath(`/[schoolDomain]/communications`, "page");
    return res;
  } catch (error: any) {
    console.error("[Server Action] Failed to broadcast notice:", error);
    return { success: false, error: error.message || "Failed to broadcast notice." };
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
    // Normalize channel safely: "BRANDED_HTML" or "Official Email" -> "EMAIL"
    const normalizedType =
      data.messageType === "BRANDED_HTML" || data.messageType === "Official Email"
        ? "EMAIL"
        : (data.messageType || "EMAIL");

    // 1. Dispatch actual formatted email notification
    await sendDirectCommunicationEmail({
      schoolId,
      recipientEmail: data.recipientEmail,
      recipientType: data.recipientType,
      messageType: normalizedType,
      subject: data.subject,
      body: data.body,
    });

    // 2. Persist audit log record
    await tenantDb.messageLog.create({
      data: {
        schoolId,
        recipientEmail: data.recipientEmail,
        recipientType: data.recipientType,
        messageType: normalizedType,
        subject: data.subject,
        body: data.body,
      }
    });

    safeRevalidatePath(`/[schoolDomain]/communications`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[Server Action] Failed to dispatch and log message:", error);
    return { success: false, error: error.message || "Failed to dispatch message." };
  }
}

