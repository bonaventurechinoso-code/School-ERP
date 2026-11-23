"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { safeRedisDel, safeRedisScanDel } from "@/lib/redis";
import { clearL1TenantCache } from "@/lib/cache";
import { isValidNubanAccountNumber } from "@/lib/nigerian-banks";
import { CrecheAssessmentConfig, DEFAULT_CRECHE_CONFIG } from "@/lib/creche-config";
import { NurseryAssessmentConfig, DEFAULT_NURSERY_CONFIG } from "@/lib/nursery-config";

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
  logo?: string | null;
  customHeroImage?: string | null;
  customHeroVideo?: string | null;
  customHeroType?: "image" | "video" | null;
  settlementBankName?: string | null;
  settlementBankCode?: string | null;
  settlementAccountNumber?: string | null;
  settlementAccountName?: string | null;
  paymentInstruction?: string | null;
  entranceExamSettings?: EntranceExamSettings;
  crecheAssessmentConfig?: Partial<CrecheAssessmentConfig>;
  nurseryAssessmentConfig?: Partial<NurseryAssessmentConfig>;
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
    if (data.logo !== undefined) {
      updatePayload.logo = data.logo ? data.logo.trim() : null;
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

    // Extended Tier / Portal Configuration (Entrance Exam & Custom Hero Media & Creche Formula)
    const hasTierConfigUpdate = 
      data.entranceExamSettings !== undefined ||
      data.customHeroImage !== undefined ||
      data.customHeroVideo !== undefined ||
      data.customHeroType !== undefined ||
      data.crecheAssessmentConfig !== undefined;

    if (hasTierConfigUpdate) {
      const currentSchool = await basePrisma.school.findUnique({
        where: { id: schoolId },
        select: { tierDatabasesConfig: true },
      });
      const existingConfig: any = (currentSchool?.tierDatabasesConfig as object) || {};
      const nextConfig: any = { ...existingConfig };

      if (data.entranceExamSettings !== undefined) {
        nextConfig.entranceExamSettings = data.entranceExamSettings;
      }
      if (data.customHeroImage !== undefined) {
        nextConfig.customHeroImage = data.customHeroImage ? data.customHeroImage.trim() : null;
      }
      if (data.customHeroVideo !== undefined) {
        nextConfig.customHeroVideo = data.customHeroVideo ? data.customHeroVideo.trim() : null;
      }
      if (data.customHeroType !== undefined) {
        nextConfig.customHeroType = data.customHeroType || "image";
      }
      if (data.crecheAssessmentConfig !== undefined) {
        const existingCreche = existingConfig.crecheAssessmentConfig || {};
        nextConfig.crecheAssessmentConfig = {
          hasExam: data.crecheAssessmentConfig.hasExam !== undefined ? Boolean(data.crecheAssessmentConfig.hasExam) : (existingCreche.hasExam ?? false),
          ca1Name: data.crecheAssessmentConfig.ca1Name?.trim() || existingCreche.ca1Name || "Observation",
          ca1Max: Number(data.crecheAssessmentConfig.ca1Max) > 0 ? Number(data.crecheAssessmentConfig.ca1Max) : (data.crecheAssessmentConfig.hasExam ? 20 : 50),
          ca2Name: data.crecheAssessmentConfig.ca2Name?.trim() || existingCreche.ca2Name || "Continuous Assessment",
          ca2Max: Number(data.crecheAssessmentConfig.ca2Max) > 0 ? Number(data.crecheAssessmentConfig.ca2Max) : (data.crecheAssessmentConfig.hasExam ? 20 : 50),
          examName: data.crecheAssessmentConfig.examName?.trim() || existingCreche.examName || "Terminal Exam",
          examMax: data.crecheAssessmentConfig.hasExam ? (Number(data.crecheAssessmentConfig.examMax) > 0 ? Number(data.crecheAssessmentConfig.examMax) : 60) : 0,
          totalMax: 100,
        };
      }
      if (data.nurseryAssessmentConfig !== undefined) {
        const existingNursery = existingConfig.nurseryAssessmentConfig || {};
        nextConfig.nurseryAssessmentConfig = {
          hasExam: data.nurseryAssessmentConfig.hasExam !== undefined ? Boolean(data.nurseryAssessmentConfig.hasExam) : (existingNursery.hasExam ?? false),
          ca1Name: data.nurseryAssessmentConfig.ca1Name?.trim() || existingNursery.ca1Name || "Observation",
          ca1Max: Number(data.nurseryAssessmentConfig.ca1Max) > 0 ? Number(data.nurseryAssessmentConfig.ca1Max) : (data.nurseryAssessmentConfig.hasExam ? 20 : 50),
          ca2Name: data.nurseryAssessmentConfig.ca2Name?.trim() || existingNursery.ca2Name || "Continuous Assessment",
          ca2Max: Number(data.nurseryAssessmentConfig.ca2Max) > 0 ? Number(data.nurseryAssessmentConfig.ca2Max) : (data.nurseryAssessmentConfig.hasExam ? 20 : 50),
          examName: data.nurseryAssessmentConfig.examName?.trim() || existingNursery.examName || "Terminal Exam",
          examMax: data.nurseryAssessmentConfig.hasExam ? (Number(data.nurseryAssessmentConfig.examMax) > 0 ? Number(data.nurseryAssessmentConfig.examMax) : 60) : 0,
          totalMax: 100,
        };
      }

      updatePayload.tierDatabasesConfig = nextConfig;
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

    // Invalidate L1 & Redis L2 cache for tenant
    if (targetSubdomain) {
      const normDomain = targetSubdomain.toLowerCase().trim();
      clearL1TenantCache(normDomain);
      clearL1TenantCache(schoolId);
      if (updatedSchool.slug) {
        clearL1TenantCache(updatedSchool.slug.toLowerCase().trim());
        await safeRedisDel(`cache:tenant:meta:${updatedSchool.slug.toLowerCase().trim()}`);
      }
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
      safeRevalidatePath(`/${targetSubdomain}/portal/principal`, "page");
      safeRevalidatePath(`/[schoolDomain]`, "page");
      safeRevalidatePath(`/[schoolDomain]`, "layout");
    } else {
      safeRevalidatePath(`/portal-settings`, "page");
      safeRevalidatePath(`/[schoolDomain]`, "page");
    }

    return { success: true, school: updatedSchool };
  } catch (error: any) {
    console.error("[Portal Settings Action] Failed to update portal settings:", error);
    return { success: false, error: error.message || "Failed to update portal settings." };
  }
}

/**
 * Server Action: Update Creche Assessment Formula
 * Defaults to Observation / Continuous Assessment (No Exam 60) unless enabled by admin.
 */
export async function updateCrecheFormulaAction(
  schoolId: string,
  config: Partial<CrecheAssessmentConfig>,
  schoolDomain?: string
) {
  try {
    const currentSchool = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { tierDatabasesConfig: true, subdomain: true },
    });
    const existingConfig: any = (currentSchool?.tierDatabasesConfig as object) || {};
    const existingCreche: any = existingConfig.crecheAssessmentConfig || {};
    const hasExam = config.hasExam !== undefined ? Boolean(config.hasExam) : (existingCreche.hasExam ?? false);
    const updatedCreche: CrecheAssessmentConfig = {
      hasExam,
      ca1Name: config.ca1Name?.trim() || existingCreche.ca1Name || "Observation",
      ca1Max: Number(config.ca1Max) > 0 ? Number(config.ca1Max) : (hasExam ? 20 : 50),
      ca2Name: config.ca2Name?.trim() || existingCreche.ca2Name || "Continuous Assessment",
      ca2Max: Number(config.ca2Max) > 0 ? Number(config.ca2Max) : (hasExam ? 20 : 50),
      examName: config.examName?.trim() || existingCreche.examName || "Terminal Exam",
      examMax: hasExam ? (Number(config.examMax) > 0 ? Number(config.examMax) : 60) : 0,
      totalMax: 100,
    };

    const nextConfig = {
      ...existingConfig,
      crecheAssessmentConfig: updatedCreche,
    };

    await basePrisma.school.update({
      where: { id: schoolId },
      data: {
        tierDatabasesConfig: nextConfig as any,
      },
    });

    await basePrisma.auditLog.create({
      data: {
        schoolId,
        action: "UPDATE_CRECHE_ASSESSMENT_FORMULA",
        target: "Admin Settings - Creche Formula",
        metadata: {
          formula: updatedCreche as any,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const targetSub = schoolDomain || currentSchool?.subdomain;
    if (targetSub) {
      safeRevalidatePath(`/${targetSub}/portal-settings`, "page");
      safeRevalidatePath(`/${targetSub}/exams`, "page");
      safeRevalidatePath(`/${targetSub}/report-cards`, "page");
    }

    return { success: true, config: updatedCreche };
  } catch (error: any) {
    console.error("[updateCrecheFormulaAction Error]:", error);
    return { success: false, error: error.message || "Failed to update Creche formula." };
  }
}

/**
 * Server Action: Update Nursery Assessment Formula (Default: Continuous Assessment / Observation 50/50, No Exam unless enabled)
 */
export async function updateNurseryFormulaAction(
  schoolId: string,
  config: Partial<NurseryAssessmentConfig>,
  schoolDomain?: string
) {
  try {
    const currentSchool = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { tierDatabasesConfig: true, subdomain: true },
    });
    const existingConfig: any = (currentSchool?.tierDatabasesConfig as object) || {};
    const existingNursery: any = existingConfig.nurseryAssessmentConfig || {};
    const hasExam = config.hasExam !== undefined ? Boolean(config.hasExam) : (existingNursery.hasExam ?? false);
    const updatedNursery: NurseryAssessmentConfig = {
      hasExam,
      ca1Name: config.ca1Name?.trim() || existingNursery.ca1Name || "Observation",
      ca1Max: Number(config.ca1Max) > 0 ? Number(config.ca1Max) : (hasExam ? 20 : 50),
      ca2Name: config.ca2Name?.trim() || existingNursery.ca2Name || "Continuous Assessment",
      ca2Max: Number(config.ca2Max) > 0 ? Number(config.ca2Max) : (hasExam ? 20 : 50),
      examName: config.examName?.trim() || existingNursery.examName || "Terminal Exam",
      examMax: hasExam ? (Number(config.examMax) > 0 ? Number(config.examMax) : 60) : 0,
      totalMax: 100,
    };

    const nextConfig = {
      ...existingConfig,
      nurseryAssessmentConfig: updatedNursery,
    };

    await basePrisma.school.update({
      where: { id: schoolId },
      data: {
        tierDatabasesConfig: nextConfig as any,
      },
    });

    await basePrisma.auditLog.create({
      data: {
        schoolId,
        action: "UPDATE_NURSERY_ASSESSMENT_FORMULA",
        target: "Admin Settings - Nursery Formula",
        metadata: {
          formula: updatedNursery as any,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const targetSub = schoolDomain || currentSchool?.subdomain;
    if (targetSub) {
      safeRevalidatePath(`/${targetSub}/portal-settings`, "page");
      safeRevalidatePath(`/${targetSub}/exams`, "page");
      safeRevalidatePath(`/${targetSub}/report-cards`, "page");
    }

    return { success: true, config: updatedNursery };
  } catch (error: any) {
    console.error("[updateNurseryFormulaAction Error]:", error);
    return { success: false, error: error.message || "Failed to update Nursery formula." };
  }
}
