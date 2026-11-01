"use server";

import { basePrisma } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { PublicApplicationPayload } from "./types";
import { invalidateAdmissionsNamespace } from "@/lib/cache-invalidation";

export async function submitPublicApplicationAction(payload: PublicApplicationPayload): Promise<{
  success: boolean;
  applicationRef?: string;
  leadId?: string;
  error?: string;
}> {
  try {
    if (!payload.personal.firstName?.trim() || !payload.personal.lastName?.trim()) {
      return { success: false, error: "Applicant first and last name are required." };
    }
    if (!payload.personal.parentPhone?.trim()) {
      return { success: false, error: "Parent / Guardian phone number is required." };
    }

    // Resolve School Tenant
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: payload.tenantSlug.toLowerCase().trim() },
          { slug: payload.tenantSlug.toLowerCase().trim() },
          { id: payload.tenantSlug },
          { id: payload.schoolId },
        ],
      },
      include: { academicTiers: true },
    });

    if (!school) {
      return { success: false, error: `School tenant '${payload.tenantSlug}' not found.` };
    }

    // Resolve Target Class / Grade based on Nigerian tier
    let targetGrade = "Class 1";
    let tierKeyword = "PRIMARY";

    switch (payload.tier) {
      case "CRECHE":
        targetGrade = "Creche";
        tierKeyword = "CRECHE";
        break;
      case "NURSERY_PRIMARY":
        targetGrade = payload.nurseryPrimary?.classApplying || "Primary 1";
        tierKeyword = targetGrade.toLowerCase().includes("nursery") ? "NURSERY" : "PRIMARY";
        break;
      case "SECONDARY":
        targetGrade = payload.secondary?.classApplying || "JSS 1";
        tierKeyword = "SECONDARY";
        break;
      case "TERTIARY":
        targetGrade = payload.tertiary?.courseOfStudy
          ? `${payload.tertiary.courseOfStudy} (${payload.tertiary.facultyChoice || "General"})`
          : "100 Level";
        tierKeyword = "TERTIARY";
        break;
    }

    // Find closest matching AcademicTier for this school
    let matchedTier = school.academicTiers.find((t) => {
      const name = t.name.toUpperCase();
      return name.includes(tierKeyword) || (tierKeyword === "CRECHE" && (name.includes("CRECHE") || name.includes("NURSERY")));
    });

    if (!matchedTier && school.academicTiers.length > 0) {
      matchedTier = school.academicTiers[0];
    }

    // Generate standard official application reference: APP-xxxx (e.g. APP-084EB1)
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    const applicationRef = `APP-${randomHex}`;

    const fullName = `${payload.personal.firstName.trim()} ${payload.personal.lastName.trim()}${
      payload.personal.middleName ? ` ${payload.personal.middleName.trim()}` : ""
    }`;

    // Token for applicant document upload/tracking window
    const uploadToken = crypto.randomUUID();
    const uploadExpiresAt = new Date();
    uploadExpiresAt.setDate(uploadExpiresAt.getDate() + 45); // 45-day tracking window

    // Persist as new admission inquiry lead in the admin pipeline INQUIRY stage
    const lead = await basePrisma.admissionLead.create({
      data: {
        schoolId: school.id,
        tierId: matchedTier?.id || "default-tier",
        applicantName: fullName,
        targetGrade: targetGrade,
        parentName: payload.personal.parentName?.trim() || null,
        parentContact: payload.personal.parentPhone.trim(),
        parentPhone: payload.personal.parentPhone.trim(),
        parentEmail: payload.personal.parentEmail?.trim().toLowerCase() || null,
        studentEmail: payload.personal.parentEmail?.trim().toLowerCase() || null,
        studentPhone: payload.personal.parentPhone.trim(),
        source: "Public Online Portal",
        status: "INQUIRY", // Stage 1 of the admissions kanban
        uploadToken,
        uploadExpiresAt,
        documents: {
          applicationRef,
          applicationDate: new Date().toISOString(),
          tier: payload.tier,
          personal: {
            firstName: payload.personal.firstName,
            lastName: payload.personal.lastName,
            middleName: payload.personal.middleName || "",
            dob: payload.personal.dateOfBirth,
            gender: payload.personal.gender,
            photoUrl: payload.personal.photoUrl || "",
            photoName: payload.personal.photoName || "",
            parentRelationship: payload.personal.parentRelationship,
            residentialAddress: payload.personal.residentialAddress,
            stateOfOrigin: payload.personal.stateOfOrigin,
            lga: payload.personal.lga,
          },
          academic: {
            creche: payload.creche || null,
            nurseryPrimary: payload.nurseryPrimary || null,
            secondary: payload.secondary || null,
            tertiary: payload.tertiary || null,
          },
          uploadedDocuments: payload.documents || {},
          payment: {
            ...payload.payment,
            applicationRef,
            amount: payload.payment?.amount || 5000,
            status: "PENDING_CONFIRMATION",
          },
          declarationAccepted: payload.declarationAccepted,
        } as any,
        logs: [
          {
            timestamp: new Date().toISOString(),
            action: "ONLINE_INQUIRY_SUBMITTED",
            note: `Public 5-step application submitted via portal for ${fullName} (${targetGrade}). Application Ref: ${applicationRef}.`,
          },
        ],
      },
    });

    try {
      await invalidateAdmissionsNamespace(school.id);
      revalidatePath(`/${school.subdomain}/admissions`);
      revalidatePath(`/admissions/apply/${payload.tenantSlug}`);
    } catch {
      // Revalidation is best-effort
    }

    return {
      success: true,
      applicationRef,
      leadId: lead.id,
    };
  } catch (error: any) {
    console.error("[submitPublicApplicationAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to process application. Please review your entries and try again.",
    };
  }
}
