"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { safeRedisDel, safeRedisScanDel } from "@/lib/redis";
import { isValidNubanAccountNumber } from "@/lib/nigerian-banks";

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op when executed outside HTTP request context (e.g. testing)
  }
}

export interface EntranceExamTierConfig {
  enabled: boolean;
  examDate?: string;
  arrivalTime?: string;
  venue?: string;
  subjects?: string;
  cutOffScore?: number;
  instructions?: string;
}

export interface EntranceExamSettings {
  enabled: boolean; // Institution master choice: require entrance exam before admission
  tiers: Record<string, EntranceExamTierConfig>;
}

export interface UpdatePortalSettingsPayload {
  name?: string;
  contactPhone?: string;
  isPublicPortalEnabled?: boolean;
  welcomeGreeting?: string;
  settlementBankName?: string | null;
  settlementBankCode?: string | null;
  settlementAccountNumber?: string | null;
  settlementAccountName?: string | null;
  paymentInstruction?: string | null;
  entranceExamSettings?: EntranceExamSettings;
}

export async function updatePortalSettings(
  schoolId: string, 
  data: UpdatePortalSettingsPayload,
  schoolDomain?: string
) {
  try {
    const updatePayload: any = {};

    if (data.isPublicPortalEnabled !== undefined) {
      updatePayload.isPublicPortalEnabled = Boolean(data.isPublicPortalEnabled);
    }
    if (data.welcomeGreeting !== undefined) {
      updatePayload.welcomeGreeting = (data.welcomeGreeting || "").trim();
    }
    if (data.name !== undefined && data.name.trim()) {
      updatePayload.name = data.name.trim();
    }
    if (data.contactPhone !== undefined) {
      updatePayload.contactPhone = data.contactPhone ? data.contactPhone.trim() : null;
    }

    // Direct Bank Settlement details (Manual Bank Transfer Engine)
    if (data.settlementBankName !== undefined) {
      updatePayload.settlementBankName = data.settlementBankName ? data.settlementBankName.trim() : null;
    }
    if (data.settlementBankCode !== undefined) {
      updatePayload.settlementBankCode = data.settlementBankCode ? data.settlementBankCode.trim() : null;
    }
    if (data.settlementAccountNumber !== undefined) {
      const cleanAcc = data.settlementAccountNumber ? data.settlementAccountNumber.replace(/\D/g, "").slice(0, 10) : "";
      if (cleanAcc && cleanAcc.length !== 10) {
        return { 
          success: false, 
          error: "Invalid account number. Nigerian Commercial Bank NUBAN must be exactly 10 digits." 
        };
      }
      updatePayload.settlementAccountNumber = cleanAcc || null;
    }
    if (data.settlementAccountName !== undefined) {
      updatePayload.settlementAccountName = data.settlementAccountName ? data.settlementAccountName.trim().toUpperCase() : null;
    }
    if (data.paymentInstruction !== undefined) {
      updatePayload.paymentInstruction = data.paymentInstruction 
        ? data.paymentInstruction.trim() 
        : "Use Student Admission No as transfer narration";
    }

    // Entrance Examination & Screening Scheduling per Academic Tier
    if (data.entranceExamSettings !== undefined) {
      const currentSchool = await basePrisma.school.findUnique({
        where: { id: schoolId },
        select: { tierDatabasesConfig: true },
      });
      const existingConfig: any = (currentSchool?.tierDatabasesConfig as object) || {};
      updatePayload.tierDatabasesConfig = {
        ...existingConfig,
        entranceExamSettings: data.entranceExamSettings,
      };
    }

    // Enforce CBN Model A Direct Manual Transfer
    updatePayload.collectionMode = "MANUAL_BANK_TRANSFER";

    const updatedSchool = await basePrisma.school.update({
      where: { id: schoolId },
      data: updatePayload
    });

    const targetSubdomain = schoolDomain || updatedSchool.subdomain;

    // Mirror updates to Tenant SaaS record if exists
    if (targetSubdomain) {
      try {
        const tenantUpdate: any = {
          collectionMode: "MANUAL_BANK_TRANSFER",
        };
        if (updatePayload.name) tenantUpdate.schoolName = updatePayload.name;
        if (updatePayload.contactPhone !== undefined) tenantUpdate.contactPhone = updatePayload.contactPhone;
        if (updatePayload.settlementBankName !== undefined) tenantUpdate.settlementBankName = updatePayload.settlementBankName;
        if (updatePayload.settlementAccountNumber !== undefined) tenantUpdate.settlementAccountNumber = updatePayload.settlementAccountNumber;
        if (updatePayload.settlementAccountName !== undefined) tenantUpdate.settlementAccountName = updatePayload.settlementAccountName;

        await basePrisma.tenant.updateMany({
          where: { subdomain: targetSubdomain.toLowerCase().trim() },
          data: tenantUpdate,
        });
      } catch (tenantErr) {
        console.warn("[Portal Settings] Could not sync tenant model:", tenantErr);
      }
    }

    // Invalidate Redis cache for tenant
    if (targetSubdomain) {
      const normDomain = targetSubdomain.toLowerCase().trim();
      await safeRedisDel(`cache:tenant:meta:${normDomain}`);
      await safeRedisScanDel(`cache:tenant:${schoolId}:*`);
    }

    // Revalidate relevant Next.js page paths
    if (targetSubdomain) {
      safeRevalidatePath(`/${targetSubdomain}/portal-settings`, "page");
      safeRevalidatePath(`/${targetSubdomain}/settings/bank`, "page");
      safeRevalidatePath(`/${targetSubdomain}`, "page");
      safeRevalidatePath(`/${targetSubdomain}`, "layout");
      safeRevalidatePath(`/${targetSubdomain}/apply`, "page");
      safeRevalidatePath(`/${targetSubdomain}/finance`, "page");
      safeRevalidatePath(`/${targetSubdomain}/portal/student`, "page");
    } else {
      safeRevalidatePath(`/portal-settings`, "page");
    }

    return { success: true, school: updatedSchool };
  } catch (error: any) {
    console.error("[Portal Settings Action] Failed to update portal settings:", error);
    return { success: false, error: error.message || "Failed to update portal settings." };
  }
}
