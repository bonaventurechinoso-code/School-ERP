"use server";

import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { sendAdmissionOfferEmail, sendStudentEnrollmentConfirmationEmail } from "@/lib/email-service";
import { triggerInquiryNotification } from "@/lib/admissions-events";
import { generateAdmissionNumber } from "@/lib/tenant-tier-utils";
import { invalidateAdmissionsNamespace, invalidateStudentNamespace } from "@/lib/cache-invalidation";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword } from "@/lib/security-service";

function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op in non-request contexts
  }
}

/**
 * Safely resolves school identifier whether passed as UUID or subdomain string
 */
export async function resolveSchoolId(schoolIdentifier: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolIdentifier);
  if (isUuid) return schoolIdentifier;

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolIdentifier },
    select: { id: true },
  });
  return school?.id || schoolIdentifier;
}

export type AdmissionActionResult = {
  success: boolean;
  student?: any;
  lead?: any;
  tierName?: string;
  error?: string;
};

/**
 * Register a new walk-in or telephone admission inquiry
 */
export async function createAdmissionLeadAction(payload: {
  schoolId: string;
  schoolDomain?: string;
  applicantName: string;
  targetGrade: string;
  tierId: string;
  parentName?: string;
  parentContact: string;
  parentPhone?: string;
  parentEmail?: string;
  studentEmail?: string;
  studentPhone?: string;
  source?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const uploadToken = crypto.randomUUID();
    const uploadExpiresAt = new Date();
    uploadExpiresAt.setDate(uploadExpiresAt.getDate() + 30); // 30 days valid

    const lead = await basePrisma.admissionLead.create({
      data: {
        schoolId,
        tierId: payload.tierId,
        applicantName: payload.applicantName.trim(),
        targetGrade: payload.targetGrade.trim(),
        parentName: payload.parentName?.trim() || null,
        parentContact: payload.parentContact.trim(),
        parentPhone: payload.parentPhone?.trim() || payload.parentContact.trim(),
        parentEmail: payload.parentEmail?.trim().toLowerCase() || null,
        studentEmail: payload.studentEmail?.trim().toLowerCase() || null,
        studentPhone: payload.studentPhone?.trim() || null,
        source: payload.source || "Walk-In Inquiry",
        status: "INQUIRY",
        uploadToken,
        uploadExpiresAt,
        documents: {},
        logs: [
          {
            timestamp: new Date().toISOString(),
            action: "INQUIRY_CREATED",
            note: "New direct admission inquiry registered.",
          }
        ]
      },
      include: { tier: true },
    });

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
    return { success: true, lead };
  } catch (error: any) {
    console.error("[createAdmissionLeadAction] Error:", error);
    return { success: false, error: error.message || "Failed to create inquiry." };
  }
}

/**
 * Update candidate document verification checklist (Passport, Birth Cert, Results, Medical)
 */
export async function updateLeadDocumentsAction(payload: {
  leadId: string;
  schoolId: string;
  schoolDomain?: string;
  documentType: string;
  status: "VERIFIED" | "PENDING" | "REJECTED";
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: payload.leadId },
    });
    if (!lead) return { success: false, error: "Applicant lead not found." };

    const docs = (lead.documents as any) || {};
    docs[payload.documentType] = {
      status: payload.status,
      verifiedAt: payload.status === "VERIFIED" ? new Date().toISOString() : null,
    };

    const updated = await basePrisma.admissionLead.update({
      where: { id: payload.leadId },
      data: {
        documents: docs,
      },
      include: { tier: true },
    });

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
    return { success: true, lead: updated };
  } catch (error: any) {
    console.error("[updateLeadDocumentsAction] Error:", error);
    return { success: false, error: error.message || "Failed to update document status." };
  }
}

/**
 * Record Entrance Examination and Interview Assessment Results
 */
export async function updateLeadScreeningAction(payload: {
  leadId: string;
  schoolId: string;
  schoolDomain?: string;
  examScore?: number;
  interviewRating?: number;
  recommendation?: string;
  notes?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: payload.leadId },
    });
    if (!lead) return { success: false, error: "Applicant lead not found." };

    const logs = Array.isArray(lead.logs) ? [...(lead.logs as any[])] : [];
    logs.push({
      timestamp: new Date().toISOString(),
      action: "SCREENING_EVALUATED",
      examScore: payload.examScore ?? null,
      interviewRating: payload.interviewRating ?? null,
      recommendation: payload.recommendation ?? "RECOMMENDED",
      notes: payload.notes || "",
    });

    const updated = await basePrisma.admissionLead.update({
      where: { id: payload.leadId },
      data: { logs },
      include: { tier: true },
    });

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
    return { success: true, lead: updated };
  } catch (error: any) {
    console.error("[updateLeadScreeningAction] Error:", error);
    return { success: false, error: error.message || "Failed to update screening data." };
  }
}

/**
 * 1-Click Final Matriculation: Converts approved applicant into official Student record
 */
export async function enrollApplicantAction(payload: {
  leadId: string;
  schoolId: string;
  schoolDomain: string;
}): Promise<AdmissionActionResult> {
  const { leadId, schoolDomain } = payload;
  try {
    if (!leadId) {
      return { success: false, error: "leadId is required." };
    }
    const schoolId = await resolveSchoolId(payload.schoolId);

    // 1. Fetch applicant lead with academic tier context
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: leadId },
      include: { tier: true },
    });

    if (!lead) {
      return { success: false, error: "Applicant lead not found." };
    }

    if (lead.status === "ENROLLED") {
      return { success: false, error: "Applicant is already marked as enrolled." };
    }

    // 2. DYNAMIC ENROLLMENT TARGET ROUTING:
    // Dynamically initialize the Prisma client connected strictly to this applicant's designated tier database
    const targetTier = lead.tier?.name || lead.tierId;
    const tierDb = await getPrismaClientForTier(schoolId, targetTier);
    const isolatedTierId = await resolveTierIdForTierDb(tierDb, schoolId, {
      id: lead.tierId,
      name: lead.tier?.name,
      level: lead.tier?.level,
    });

    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, subdomain: true, name: true },
    });

    const [firstName, ...lastNameParts] = (lead.applicantName || "").trim().split(" ");
    const lastName = lastNameParts.join(" ") || "Enrolled";

    // Generate isolated tier admission number with authentic tier code (e.g. GW/SEC/2026/001)
    const studentCount = await tierDb.student.count();
    const admissionNumber = generateAdmissionNumber({
      schoolSubdomain: school?.subdomain,
      tierName: lead.tier?.name,
      currentClass: lead.targetGrade,
      studentSequence: studentCount + 1,
    });

    // 3. Write student profile directly into the isolated tier database's Student table
    const existingStudent = await tierDb.student.findFirst({
      where: {
        schoolId: lead.schoolId,
        OR: [
          ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
          { admissionNumber },
        ],
      },
    });

    const leadDocuments = (lead.documents as any) || {};
    const leadPasswordHash = leadDocuments.passwordHash;
    const defaultPasswordHash = await bcrypt.hash("Welcome123", 10);
    const finalPasswordHash = leadPasswordHash || defaultPasswordHash;
    const isTemporary = !leadPasswordHash;

    let newStudent;
    if (existingStudent) {
      const existingDynamic = (existingStudent.dynamicFields as any) || {};
      newStudent = await tierDb.student.update({
        where: { id: existingStudent.id },
        data: {
          status: "ENROLLED",
          enrolledAt: new Date(),
          tierId: isolatedTierId,
          currentClass: lead.targetGrade || existingStudent.currentClass,
          dynamicFields: {
            ...existingDynamic,
            password: existingDynamic.password || finalPasswordHash,
            isTemporaryPassword: existingDynamic.isTemporaryPassword ?? isTemporary,
          },
        },
      });
      await setUserMustChangePassword(existingStudent.id, lead.schoolId, existingDynamic.isTemporaryPassword ?? isTemporary);
    } else {
      newStudent = await tierDb.student.create({
        data: {
          schoolId: lead.schoolId,
          tierId: isolatedTierId,
          firstName: firstName || "Student",
          lastName,
          email: lead.studentEmail || null,
          parentName: lead.parentName || null,
          parentEmail: lead.parentEmail || null,
          parentPhone: lead.parentPhone || lead.parentContact || null,
          currentClass: lead.targetGrade || null,
          admissionNumber,
          status: "ENROLLED",
          enrolledAt: new Date(),
          dynamicFields: {
            password: finalPasswordHash,
            isTemporaryPassword: isTemporary,
          },
        },
      });
      await setUserMustChangePassword(newStudent.id, lead.schoolId, isTemporary);
    }

    // 4. Update the central AdmissionLead record
    const updatedLead = await basePrisma.admissionLead.update({
      where: { id: leadId },
      data: {
        status: "ENROLLED",
        updatedAt: new Date(),
      },
    });

    // 5. ROSTER DYNAMIC SYNC REFRESH & CACHE PURGE
    invalidateTierConnection();
    await Promise.all([
      invalidateAdmissionsNamespace(schoolId),
      invalidateStudentNamespace(schoolId, targetTier),
    ]);

    const domain = schoolDomain || school?.subdomain;
    if (domain) {
      safeRevalidate(`/${domain}/students`);
      safeRevalidate(`/${domain}/admissions`);
      safeRevalidate(`/${domain}/dashboard`);
      safeRevalidate(`/${domain}/scheduling`);
    }
    safeRevalidate("/[schoolDomain]/(admin)/students", "page");
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");
    safeRevalidate("/[schoolDomain]/(admin)/dashboard", "page");

    // Dispatch enrollment confirmation email to student / parent
    sendStudentEnrollmentConfirmationEmail({
      schoolId: lead.schoolId,
      studentId: newStudent.id,
      schoolName: school?.name,
      subdomain: domain,
      studentName: `${firstName} ${lastName}`.trim(),
      admissionNumber,
      currentClass: lead.targetGrade,
      tierName: targetTier || lead.tier?.name,
      studentEmail: lead.studentEmail,
      parentEmail: lead.parentEmail,
      parentName: lead.parentName,
      temporaryPassword: isTemporary ? "Welcome123" : undefined,
    }).catch((emailErr) => {
      console.error("[EMAIL_DISPATCH] Student enrollment confirmation error in enrollLead:", emailErr);
    });

    return {
      success: true,
      student: newStudent,
      lead: updatedLead,
      tierName: lead.tier?.name || "Default Tier",
    };
  } catch (error: any) {
    console.error("Error executing enrollApplicantAction:", error);
    return { success: false, error: error?.message || "Failed to finalize enrollment." };
  }
}

/**
 * Move lead across the admissions pipeline stages
 */
export async function updateLeadStatusAction(payload: {
  leadId: string;
  status: string;
  schoolId: string;
  schoolDomain: string;
}): Promise<AdmissionActionResult> {
  const { leadId, status, schoolDomain } = payload;
  try {
    if (!leadId || !status) {
      return { success: false, error: "Missing required parameters." };
    }
    const schoolId = await resolveSchoolId(payload.schoolId);

    if (status === "ENROLLED") {
      return await enrollApplicantAction({ leadId, schoolId, schoolDomain });
    }

    let updatedLead;

    if (status === "APPROVED") {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // 14-day offer window

      updatedLead = await basePrisma.admissionLead.update({
        where: { id: leadId },
        data: {
          status,
          offerToken: token,
          offerExpiresAt: expiresAt,
        },
      });

      const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
      if (school) {
        try {
          await sendAdmissionOfferEmail(updatedLead, school, token);
        } catch (mailErr) {
          console.warn("Failed to dispatch admission offer email:", mailErr);
        }
      }
    } else {
      updatedLead = await basePrisma.admissionLead.update({
        where: { id: leadId },
        data: { status },
      });

      if (status === "INQUIRY") {
        const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
        triggerInquiryNotification({
          leadId,
          schoolId,
          lead: updatedLead,
          school,
          force: true,
        });
      }
    }

    await invalidateAdmissionsNamespace(schoolId);

    const domain = schoolDomain;
    if (domain) {
      safeRevalidate(`/${domain}/admissions`);
      safeRevalidate(`/${domain}/dashboard`);
    }
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");
    safeRevalidate("/[schoolDomain]/(admin)/dashboard", "page");

    return { success: true, lead: updatedLead };
  } catch (error: any) {
    console.error("Error executing updateLeadStatusAction:", error);
    return { success: false, error: error?.message || "Failed to update lead status." };
  }
}
