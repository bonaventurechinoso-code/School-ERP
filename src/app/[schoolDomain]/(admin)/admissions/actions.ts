"use server";

import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { sendAdmissionOfferEmail, sendStudentEnrollmentConfirmationEmail, sendDocsRequestEmail } from "@/lib/email-service";
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
    if (error?.code === "P2002") {
      const field = Array.isArray(error?.meta?.target) ? error.meta.target.join(", ") : error?.meta?.target || "contact/email";
      return { success: false, error: `An inquiry record with this ${field} already exists.` };
    }
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
      rejectedAt: payload.status === "REJECTED" ? new Date().toISOString() : null,
    };

    const updated = await basePrisma.admissionLead.update({
      where: { id: payload.leadId },
      data: {
        documents: docs,
      },
      include: { tier: true },
    });

    // 2. Sync to AdmissionRegister so applicant's tracking dashboard reflects REJECTED in real-time
    const cleanRef = lead.id.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
    const nameParts = (lead.applicantName || "").trim().split(" ");
    const firstName = nameParts[0] || "Student";
    const lastName = nameParts.slice(1).join(" ") || "Applicant";

    let registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        tenantId: schoolId,
        OR: [
          { id: lead.id },
          ...(cleanRef ? [{ applicationNo: { contains: cleanRef, mode: "insensitive" as const } }] : []),
          ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
          ...(lead.parentEmail ? [{ email: lead.parentEmail }] : []),
          ...(lead.parentPhone ? [{ parentPhone: lead.parentPhone }] : []),
          { firstName, lastName },
        ],
      },
    });

    if (registerRecord) {
      const creds = Array.isArray(registerRecord.credentialsJson) ? [...registerRecord.credentialsJson] : [];
      let found = false;
      const updatedCreds = creds.map((c: any) => {
        if (
          c.type === payload.documentType ||
          c.key === payload.documentType ||
          c.docType === payload.documentType ||
          c.altType === payload.documentType
        ) {
          found = true;
          return {
            ...c,
            status: payload.status,
            verified: payload.status === "VERIFIED",
            rejected: payload.status === "REJECTED",
            rejectedAt: payload.status === "REJECTED" ? new Date().toISOString() : c.rejectedAt,
          };
        }
        return c;
      });

      if (!found && payload.status === "REJECTED") {
        updatedCreds.push({
          type: payload.documentType,
          name: payload.documentType,
          docType: payload.documentType,
          status: "REJECTED",
          rejected: true,
          rejectedAt: new Date().toISOString(),
        });
      }

      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          ...(payload.status === "REJECTED" ? { status: "rejected" } : {}),
          credentialsJson: updatedCreds as any,
          updatedAt: new Date(),
        },
      });
    }

    // 3. Dispatch rejection email via Resend if rejected
    if (payload.status === "REJECTED") {
      const recipientEmail = (
        lead.studentEmail ||
        lead.parentEmail ||
        registerRecord?.email ||
        (lead.parentContact?.includes("@") ? lead.parentContact : null) ||
        ""
      ).trim();

      if (recipientEmail && recipientEmail.includes("@")) {
        try {
          const appNo = registerRecord?.applicationNo || `APP-${lead.id.slice(0, 6).toUpperCase()}`;
          const sub = payload.schoolDomain || "portal";
          const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
          const uploadUrl = (lead as any).uploadToken
            ? `${baseUrl}/${sub}/admissions/upload/${lead.id}?token=${(lead as any).uploadToken}`
            : `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(appNo)}`;
          const trackUrl = `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(appNo)}`;

          const { sendDocumentRejectedEmail } = await import("@/lib/email-service");
          await sendDocumentRejectedEmail({
            schoolId,
            applicantName: lead.applicantName,
            parentName: lead.parentName || "Parent / Guardian",
            applicationNo: appNo,
            targetGrade: lead.targetGrade || "Selected Grade",
            recipientEmail,
            documentType: payload.documentType,
            uploadUrl,
            trackUrl,
            subdomain: sub,
          });
        } catch (emailErr) {
          console.error("[updateLeadDocumentsAction] Rejection email dispatch error:", emailErr);
        }
      }
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions/track`);
    if (registerRecord) {
      safeRevalidate(`/${payload.schoolDomain || ""}/admissions/track/${registerRecord.applicationNo}`);
    }
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

    // Verify applicant has docs uploaded before student creation
    const leadDocuments = (lead.documents as any) || {};
    const hasLeadDocs =
      Boolean(lead.passportPhotoUrl) ||
      Boolean(lead.academicResultsUrl) ||
      Boolean(lead.birthCertificateUrl) ||
      Boolean(lead.medicalRecordsUrl) ||
      Object.keys(leadDocuments).some((k) => k !== "passwordHash" && Boolean(leadDocuments[k]));

    const registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        tenantId: schoolId,
        OR: [
          ...(lead.studentEmail || lead.parentEmail ? [{ email: lead.studentEmail || lead.parentEmail }] : []),
          ...(lead.parentPhone || lead.parentContact ? [{ parentPhone: lead.parentPhone || lead.parentContact }] : []),
          { firstName, lastName },
        ],
      },
    });

    const hasRegisterDocs = Boolean(
      registerRecord &&
      Array.isArray(registerRecord.credentialsJson) &&
      registerRecord.credentialsJson.length > 0
    );

    if (!hasLeadDocs && !hasRegisterDocs) {
      return { success: false, error: "Documents not uploaded yet" };
    }

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

    // 4b. Sync status to AdmissionRegister audit trail (DO NOT DELETE)
    try {
      const existingReg = await basePrisma.admissionRegister.findFirst({
        where: {
          tenantId: schoolId,
          OR: [
            { email: lead.studentEmail || lead.parentEmail || undefined },
            { parentPhone: lead.parentPhone || lead.parentContact || undefined },
            { firstName, lastName },
          ],
        },
      });

      if (existingReg) {
        await basePrisma.admissionRegister.update({
          where: { id: existingReg.id },
          data: {
            status: "admitted",
            admittedAt: new Date(),
          },
        });
      } else {
        const { generateApplicationNo } = await import("@/modules/enrollment/enrollment.controller");
        const appNo = await generateApplicationNo(schoolId);
        await basePrisma.admissionRegister.create({
          data: {
            tenantId: schoolId,
            applicationNo: appNo,
            firstName: firstName || "Student",
            lastName,
            classApplied: lead.targetGrade || "N/A",
            parentPhone: lead.parentPhone || lead.parentContact || "N/A",
            email: lead.studentEmail || lead.parentEmail || null,
            status: "admitted",
            admittedAt: new Date(),
          },
        });
      }
    } catch (auditErr) {
      console.warn("[enrollApplicantAction] Warning: Could not mirror audit to admission_registers:", auditErr);
    }

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
    try {
      await sendStudentEnrollmentConfirmationEmail({
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
      });
    } catch (emailErr) {
      console.error("[EMAIL_DISPATCH] Student enrollment confirmation error in enrollLead:", emailErr);
    }

    return {
      success: true,
      student: newStudent,
      lead: updatedLead,
      tierName: lead.tier?.name || "Default Tier",
    };
  } catch (error: any) {
    console.error("Error executing enrollApplicantAction:", error);
    if (error?.code === "P2002") {
      const field = Array.isArray(error?.meta?.target) ? error.meta.target.join(", ") : error?.meta?.target || "unique field";
      return {
        success: false,
        error: `A record with this ${field} already exists. Please verify the student's admission number or email.`,
      };
    }
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

/**
 * Triggers an automated document request email via Resend to the applicant,
 * providing them with a direct secure link to the upload portal.
 */
export async function requestApplicantDocsAction(payload: {
  admissionId?: string;
  applicationNo?: string;
  schoolId?: string;
  schoolDomain?: string;
  recipientEmail?: string;
  customMessage?: string;
}) {
  try {
    const { admissionId, applicationNo, schoolDomain, customMessage } = payload;
    if (!admissionId && !applicationNo) {
      return { success: false, error: "Missing required application identifier." };
    }

    // 1. Locate AdmissionRegister record
    const record = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [
          ...(admissionId ? [{ id: admissionId }] : []),
          ...(applicationNo ? [{ applicationNo }] : []),
        ],
      },
    });

    const targetSchoolId = await resolveSchoolId(payload.schoolId || record?.tenantId || schoolDomain || "");
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          ...(targetSchoolId ? [{ id: targetSchoolId }, { subdomain: targetSchoolId }] : []),
          ...(schoolDomain ? [{ subdomain: schoolDomain }, { slug: schoolDomain }] : []),
        ],
      },
    });

    if (!school) {
      return { success: false, error: "School institution record not found." };
    }

    // 2. Locate linked AdmissionLead (if exists) or query by application parameters
    const cleanRef = (record?.applicationNo || applicationNo || "").replace(/^ADM-|^APP-/, "").trim().toLowerCase();
    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        schoolId: school.id,
        OR: [
          ...(admissionId ? [{ id: admissionId }] : []),
          ...(record?.id ? [{ id: record.id }] : []),
          ...(cleanRef ? [{ id: { startsWith: cleanRef } }] : []),
          ...(record ? [
            { applicantName: { equals: `${record.firstName} ${record.lastName}`.trim(), mode: "insensitive" as const } },
            { applicantName: { equals: `${record.lastName} ${record.firstName}`.trim(), mode: "insensitive" as const } },
            ...(record.email ? [{ studentEmail: record.email }, { parentEmail: record.email }] : []),
            ...(record.parentPhone ? [{ parentPhone: record.parentPhone }, { parentContact: record.parentPhone }] : []),
          ] : []),
        ],
      },
      include: { tier: true },
    });

    // 3. Ensure valid uploadToken (valid for 30 days)
    let uploadToken = (lead as any)?.uploadToken;
    const isTokenExpired = (lead as any)?.uploadExpiresAt && new Date((lead as any).uploadExpiresAt) < new Date();

    if (!uploadToken || isTokenExpired) {
      uploadToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day upload window

      if (lead) {
        lead = await basePrisma.admissionLead.update({
          where: { id: lead.id },
          data: { uploadToken, uploadExpiresAt: expiresAt },
          include: { tier: true },
        });
      }
    }

    const appNo = record?.applicationNo || applicationNo || (lead?.id ? `APP-${lead.id.slice(-6).toUpperCase()}` : "APP-PENDING");
    const applicantName = lead?.applicantName || (record ? `${record.firstName} ${record.lastName}`.trim() : "Applicant");
    const parentName = lead?.parentName || "Parent / Guardian";
    const targetGrade = lead?.targetGrade || record?.classApplied || "Selected Class";

    const recipientEmail = (
      payload.recipientEmail ||
      record?.email ||
      lead?.parentEmail ||
      lead?.studentEmail ||
      (lead?.parentContact?.includes("@") ? lead.parentContact : null) ||
      ""
    ).trim();

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return {
        success: false,
        error: `No valid email address registered for applicant "${applicantName}". Please verify the applicant email.`,
      };
    }

    const sub = school.subdomain || schoolDomain || "portal";
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const uploadUrl = lead?.id && uploadToken
      ? `${baseUrl}/${sub}/admissions/upload/${lead.id}?token=${uploadToken}`
      : `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(appNo)}`;
    const trackUrl = `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(appNo)}`;

    // 4. Dispatch Email via Resend
    const mailResult = await sendDocsRequestEmail({
      schoolId: school.id,
      applicantName,
      parentName,
      applicationNo: appNo,
      targetGrade,
      recipientEmail,
      uploadUrl,
      trackUrl,
      schoolName: school.name,
      subdomain: sub,
      customMessage,
    });

    if (!mailResult.success) {
      return {
        success: false,
        error: mailResult.error || "Failed to dispatch email via Resend service.",
        uploadUrl,
      };
    }

    // 5. Update status to docs_pending if currently new
    if (record && (record.status.toLowerCase() === "new" || !record.status)) {
      await basePrisma.admissionRegister.update({
        where: { id: record.id },
        data: { status: "docs_pending", updatedAt: new Date() },
      });
    }

    safeRevalidate(`/${sub}/admissions`);
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");

    return {
      success: true,
      message: `Document request email successfully dispatched to ${recipientEmail}`,
      uploadUrl,
      trackUrl,
      recipientEmail,
    };
  } catch (error: any) {
    console.error("[requestApplicantDocsAction] Error:", error);
    return { success: false, error: error?.message || "Failed to request applicant documents." };
  }
}
