"use server";

import {
  verifyTenantAdminRole,
  verifyAdmissionsMutatorRole,
  isSessionMatchingTenant,
  evaluateStageConstraints,
  ensureTenantAdmissionTracks,
  StageConstraints,
} from "@/lib/admissions-pipeline.service";
import {
  buildDeduplicationCompoundKey,
  deduplicateTenantAdmissions,
} from "@/lib/admissions-deduplication.service";
import { AdmissionTierType } from "@prisma/client";

import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import {
  sendAdmissionOfferEmail,
  sendStudentEnrollmentConfirmationEmail,
  sendDocsRequestEmail,
  sendExamAdmitSlipEmail,
} from "@/lib/mail";
import { sendPaymentInstructionEmail } from "@/lib/email";
import { triggerInquiryNotification } from "@/lib/admissions-events";
import { generateAdmissionNumber, getExamSubjectsForTier } from "@/lib/tenant-tier-utils";
import { invalidateAdmissionsNamespace, invalidateStudentNamespace } from "@/lib/cache-invalidation";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword } from "@/lib/security-service";
import { getSession } from "@/lib/auth";
import {
  checkRouteAuthorization,
  convertLeadToRegister,
  checkDuplicate,
  getTenantFromSession,
} from "@/lib/admissions.service";
import { DuplicateCheckMatch } from "@/lib/admissions.types";
import {
  isAdmissionsAuthorized,
  findDuplicateAdmissionEntry,
  executeLeadToRegisterTransition,
} from "@/modules/enrollment/enrollment.controller";
import { executeEnrollmentHandshake } from "@/modules/admissions/enrollment-handshake";

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

    // SYSTEM ANTI-DUPLICATE GUARD (DEDUPLICATION):
    // Compound validation key: [schoolId + Candidate Name + Class/Grade + Parent Phone]
    const targetPhone = payload.parentPhone || payload.parentContact;
    const targetKey = buildDeduplicationCompoundKey(
      payload.applicantName,
      payload.targetGrade,
      targetPhone
    );

    // 1. Check active leads in database
    const existingLeads = await basePrisma.admissionLead.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
    });

    const matchingLead = existingLeads.find((l) => {
      const k = buildDeduplicationCompoundKey(
        l.applicantName,
        l.targetGrade,
        l.parentPhone || l.parentContact
      );
      return k && k === targetKey;
    });

    if (matchingLead) {
      // Merge incoming inquiry payload into active lead record to prevent data fracturing
      const existingLogs = Array.isArray(matchingLead.logs)
        ? (matchingLead.logs as any[])
        : [];
      const updatedLogs = [
        ...existingLogs,
        {
          timestamp: new Date().toISOString(),
          action: "INQUIRY_DEDUPLICATED_MERGE",
          note: `Follow-up inquiry registered via ${payload.source || "Walk-In"} merged into active candidate profile.`,
        },
      ];

      const mergedLead = await basePrisma.admissionLead.update({
        where: { id: matchingLead.id },
        data: {
          targetGrade: payload.targetGrade.trim() || matchingLead.targetGrade,
          parentName: payload.parentName?.trim() || matchingLead.parentName,
          parentContact: payload.parentContact.trim() || matchingLead.parentContact,
          parentPhone: payload.parentPhone?.trim() || matchingLead.parentPhone,
          parentEmail: payload.parentEmail?.trim().toLowerCase() || matchingLead.parentEmail,
          studentEmail: payload.studentEmail?.trim().toLowerCase() || matchingLead.studentEmail,
          studentPhone: payload.studentPhone?.trim() || matchingLead.studentPhone,
          logs: updatedLogs as any,
        },
        include: { tier: true, track: true, stage: true },
      });

      await invalidateAdmissionsNamespace(schoolId);
      safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
      return { success: true, lead: mergedLead, deduplicated: true };
    }

    const dupCheck = await findDuplicateAdmissionEntry({
      tenantId: schoolId,
      studentName: payload.applicantName.trim(),
      parentPhone: payload.parentPhone || payload.parentContact,
      email: payload.parentEmail || payload.studentEmail,
    });

    if (dupCheck.isDuplicate && dupCheck.leadRecord) {
      // Merge incoming inquiry payload into active lead record to prevent data fracturing
      const existingLogs = Array.isArray(dupCheck.leadRecord.logs)
        ? (dupCheck.leadRecord.logs as any[])
        : [];
      const updatedLogs = [
        ...existingLogs,
        {
          timestamp: new Date().toISOString(),
          action: "INQUIRY_MERGED",
          note: `Follow-up inquiry registered via ${payload.source || "Walk-In"}. Merged into active record without fracturing.`,
        },
      ];

      const mergedLead = await basePrisma.admissionLead.update({
        where: { id: dupCheck.leadRecord.id },
        data: {
          targetGrade: payload.targetGrade.trim() || dupCheck.leadRecord.targetGrade,
          parentContact: payload.parentContact.trim() || dupCheck.leadRecord.parentContact,
          parentPhone: payload.parentPhone?.trim() || dupCheck.leadRecord.parentPhone,
          parentEmail: payload.parentEmail?.trim().toLowerCase() || dupCheck.leadRecord.parentEmail,
          studentEmail: payload.studentEmail?.trim().toLowerCase() || dupCheck.leadRecord.studentEmail,
          studentPhone: payload.studentPhone?.trim() || dupCheck.leadRecord.studentPhone,
          logs: updatedLogs as any,
        },
        include: { tier: true, track: true, stage: true },
      });

      await invalidateAdmissionsNamespace(schoolId);
      safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
      return { success: true, lead: mergedLead, deduplicated: true };
    }

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

    // RBAC Permissions Check: Restrict structural state mutations strictly to authorized roles
    const session = await getSession(undefined, payload.schoolDomain);
    if (session && !isAdmissionsAuthorized(session.role, session.staffRole)) {
      return {
        success: false,
        error: "Unauthorized: Document verification and rejection is strictly restricted to Registrar, Admissions Officer, or Superadmin roles.",
      };
    }

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
 * Record Entrance Examination and Interview Assessment Results with Subject Breakdown
 */
export async function updateLeadScreeningAction(payload: {
  leadId: string;
  schoolId: string;
  schoolDomain?: string;
  examScore?: number;
  subjectScores?: Record<string, number | string>;
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

    const docs = (lead.documents as any) || {};
    if (payload.subjectScores) {
      docs.examScores = payload.subjectScores;
    }
    if (payload.examScore !== undefined) {
      docs.examAggregate = payload.examScore;
    }

    const logs = Array.isArray(lead.logs) ? [...(lead.logs as any[])] : [];
    logs.push({
      timestamp: new Date().toISOString(),
      action: "SCREENING_EVALUATED",
      examScore: payload.examScore ?? null,
      subjectScores: payload.subjectScores ?? null,
      interviewRating: payload.interviewRating ?? null,
      recommendation: payload.recommendation ?? "RECOMMENDED",
      notes: payload.notes || "",
    });

    const updated = await basePrisma.admissionLead.update({
      where: { id: payload.leadId },
      data: {
        documents: docs,
        logs,
      },
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
 * Assign Entrance Examination Schedule and automatically dispatch Admit Slip via Resend
 */
export async function scheduleAndDispatchExamAdmitSlipAction(payload: {
  leadId: string;
  schoolId: string;
  schoolDomain?: string;
  examDate?: string;
  arrivalTime?: string;
  venue?: string;
  subjects?: string;
  recipientEmail?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: payload.leadId },
      include: { tier: true, school: true },
    });
    if (!lead) return { success: false, error: "Applicant lead not found." };

    const school = lead.school || (await basePrisma.school.findUnique({ where: { id: schoolId } }));
    const sub = payload.schoolDomain || school?.subdomain || "portal";
    const rollNo = `EXM-${sub.toUpperCase()}-2026-${lead.id.substring(0, 5).toUpperCase()}`;
    const examDate = payload.examDate || "Saturday, 27th September 2026";
    const arrivalTime = payload.arrivalTime || "08:30 AM Prompt";
    const venue = payload.venue || "Main ICT Complex / Hall A";
    const subjects = payload.subjects || getExamSubjectsForTier(lead.tier?.name, lead.targetGrade).join(", ");

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const admitSlipUrl = `${baseUrl}/${sub}/admissions/admit-slip/${lead.id}`;

    const examSchedule = {
      rollNo,
      testDate: examDate,
      arrivalTime,
      venue,
      subjects,
      admitSlipUrl,
      dispatchedAt: new Date().toISOString(),
    };

    const docs = (lead.documents as any) || {};
    docs.examSchedule = examSchedule;

    const logs = Array.isArray(lead.logs) ? [...(lead.logs as any[])] : [];
    logs.push({
      timestamp: new Date().toISOString(),
      action: "EXAM_ADMIT_SLIP_DISPATCHED",
      rollNo,
      testDate: examDate,
      venue,
      dispatchedTo: payload.recipientEmail || lead.studentEmail || lead.parentEmail || lead.parentContact,
    });

    const updated = await basePrisma.admissionLead.update({
      where: { id: payload.leadId },
      data: {
        documents: docs,
        logs,
      },
      include: { tier: true },
    });

    // Also sync to admissionRegister if present
    const cleanRef = lead.id.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
    const nameParts = (lead.applicantName || "").trim().split(" ");
    const firstName = nameParts[0] || "Student";
    const lastName = nameParts.slice(1).join(" ") || "Applicant";

    const registerRecord = await basePrisma.admissionRegister.findFirst({
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
      const existingExamIndex = creds.findIndex((c: any) => c.type === "EXAM_SCHEDULE" || c.key === "exam_schedule");
      const examEntry = {
        type: "EXAM_SCHEDULE",
        rollNo,
        testDate: examDate,
        venue,
        admitSlipUrl,
        dispatchedAt: new Date().toISOString(),
      };
      if (existingExamIndex >= 0) {
        creds[existingExamIndex] = { ...(creds[existingExamIndex] as any), ...examEntry };
      } else {
        creds.push(examEntry);
      }
      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: { credentialsJson: creds as any },
      });
    }

    // Resolve recipient email address
    const recipientEmail = (
      payload.recipientEmail ||
      lead.studentEmail ||
      lead.parentEmail ||
      registerRecord?.email ||
      (lead.parentContact?.includes("@") ? lead.parentContact : null) ||
      ""
    ).trim();

    let emailSent = false;
    let dispatchResult: any = null;

    if (recipientEmail && recipientEmail.includes("@")) {
      try {
        const mailRes = await sendExamAdmitSlipEmail({
          schoolId,
          applicantName: lead.applicantName,
          parentName: lead.parentName || "Parent / Guardian",
          applicationNo: `ADM-${lead.id.slice(0, 6).toUpperCase()}`,
          targetGrade: lead.targetGrade,
          tierName: lead.tier?.name || "General",
          recipientEmail,
          rollNo,
          examDate,
          arrivalTime,
          venue,
          subjects,
          admitSlipUrl,
          schoolName: school?.name || "School ERP",
          subdomain: sub,
        });
        emailSent = Boolean(mailRes?.success);
        dispatchResult = mailRes;
      } catch (err: any) {
        console.error("[scheduleAndDispatchExamAdmitSlipAction] Email dispatch failed:", err);
      }
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${sub}/admissions`);
    safeRevalidate(`/${sub}/admissions/track`);
    return {
      success: true,
      lead: updated,
      examSchedule,
      emailSent,
      recipient: recipientEmail,
      dispatchResult,
    };
  } catch (error: any) {
    console.error("[scheduleAndDispatchExamAdmitSlipAction] Error:", error);
    return { success: false, error: error.message || "Failed to schedule exam and dispatch admit slip." };
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

    // RBAC Permissions Check: Restrict 'Convert to Student' strictly to authorized roles
    const session = await getSession(undefined, schoolDomain);
    const auth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
    if (session && !auth.canMutate) {
      return {
        success: false,
        error: "403: " + (auth.reason || "Unauthorized: Student matriculation is strictly restricted to Registrar, Admissions Officer, or Superadmin roles."),
      };
    }

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
          admissionNumber: existingStudent.admissionNumber || admissionNumber,
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

    // Record immutable AdmissionAuditTrail entry
    try {
      await basePrisma.admissionAuditTrail.create({
        data: {
          tenantId: schoolId,
          registerId: lead.id,
          actorId: session?.userId || session?.name || "Admissions Officer",
          action: "ENROLLED",
          fromStage: lead.status,
          toStage: "ENROLLED",
          metadata: {
            studentId: newStudent.id,
            admissionNumber,
            tier: targetTier,
            source: "enrollApplicantAction",
          },
        },
      });
    } catch (auditTrailErr) {
      console.warn("[enrollApplicantAction] Warning logging admissionAuditTrail:", auditTrailErr);
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
      const emailResult = await sendStudentEnrollmentConfirmationEmail({
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

      if (!emailResult.success) {
        console.error(`[EMAIL_SYNC_ERROR] [STUDENT_ENROLLMENT] Delivery failure in enrollLead for student ${newStudent.id}:`, emailResult.error);
      }
    } catch (emailErr) {
      console.error("[EMAIL_SYNC_ERROR] [STUDENT_ENROLLMENT] Student enrollment confirmation error in enrollLead:", emailErr);
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
 * Enterprise Atomic Enrollment Handshake Action for Admission Register Records
 * Performs atomic enrollment:
 * 1. Updates register stage to ENROLLED
 * 2. Generates matriculation number ([TENANT]-[YEAR]-[SEQ])
 * 3. Creates Student in SIS with ENROLLED status
 * 4. Creates Parent/Guardian and links StudentParent
 * 5. Generates initial tuition billing Invoice in Bursary sub-ledger
 * 6. Records immutable AdmissionAuditTrail entry
 */
export async function enrollApplicantFromRegisterAction(payload: {
  registerId: string;
  schoolId: string;
  schoolDomain: string;
  tuitionFeeAmount?: number;
  feeDescription?: string;
}): Promise<AdmissionActionResult> {
  const { registerId, schoolDomain } = payload;
  try {
    if (!registerId) {
      return { success: false, error: "registerId is required." };
    }
    const schoolId = await resolveSchoolId(payload.schoolId);

    // Permissions check
    const session = await getSession(undefined, schoolDomain);
    const auth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
    if (session && !auth.canMutate) {
      return {
        success: false,
        error: "403: " + (auth.reason || "Unauthorized: Student matriculation is strictly restricted to Registrar, Admissions Officer, or Superadmin roles."),
      };
    }

    const handshakeResult = await executeEnrollmentHandshake({
      registerId,
      tenantId: schoolId,
      schoolDomain,
      actorId: session?.userId || session?.name || "Admissions Officer",
      tuitionFeeAmount: payload.tuitionFeeAmount,
      feeDescription: payload.feeDescription,
    });

    if (!handshakeResult.success) {
      return { success: false, error: handshakeResult.error };
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${schoolDomain}/admissions`);
    safeRevalidate(`/${schoolDomain}/students`);
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");

    return {
      success: true,
      student: handshakeResult.student,
      lead: handshakeResult.register,
    };
  } catch (error: any) {
    console.error("[enrollApplicantFromRegisterAction] Error:", error);
    return { success: false, error: error?.message || "Failed to finalize register enrollment." };
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
  targetStageId?: string;
}): Promise<AdmissionActionResult> {
  const { leadId, status, schoolDomain, targetStageId } = payload;
  try {
    if (!leadId || !status) {
      return { success: false, error: "Missing required parameters." };
    }
    const schoolId = await resolveSchoolId(payload.schoolId);

    // RBAC Permissions Check: Tenant Admin (own tenant) or Admissions Officer
    const session = await getSession(undefined, schoolDomain);
    const auth = await verifyAdmissionsMutatorRole(session, schoolId);
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.reason || "403 Forbidden: Admissions status transitions are strictly restricted to authorized roles.",
      };
    }

    // STAGE CONSTRAINT GUARDRAIL ENFORCEMENT
    const existingLead = await basePrisma.admissionLead.findUnique({
      where: { id: leadId },
      include: { stage: true, track: { include: { stages: true } } },
    });

    if (!existingLead || existingLead.schoolId !== schoolId) {
      return { success: false, error: "404 Not Found: Candidate dossier not found in this tenant." };
    }

    let targetStage: any = null;
    if (targetStageId) {
      targetStage = await basePrisma.admissionStage.findUnique({
        where: { id: targetStageId },
        include: { track: true },
      });
    } else if (existingLead.track?.stages) {
      targetStage = existingLead.track.stages.find(
        (s) => s.name.toUpperCase() === status.toUpperCase()
      );
    }

    if (targetStage?.constraints) {
      const evaluation = evaluateStageConstraints(existingLead, targetStage.constraints as any);
      if (!evaluation.satisfied) {
        return {
          success: false,
          error: `400 Bad Request: Stage guardrails not met. Missing prerequisites: ${evaluation.missingPrerequisites.join("; ")}`,
        };
      }
    }

    if (status === "ENROLLED") {
      return await enrollApplicantAction({ leadId, schoolId, schoolDomain });
    }

    // AUTOMATED FUNNEL STATE MACHINE:
    // If transitioning beyond INQUIRY (e.g. APPLIED, INTERVIEW, APPROVED), atomically promote/sync to live AdmissionRegister
    if (status !== "INQUIRY") {
      try {
        const lead = await basePrisma.admissionLead.findUnique({ where: { id: leadId } });
        if (lead) {
          const nameParts = (lead.applicantName || "").trim().split(" ");
          const firstName = nameParts[0] || "Student";
          const lastName = nameParts.slice(1).join(" ") || "Applicant";
          let regStatus = "docs_pending";
          if (status === "APPROVED") regStatus = "approved";
          else if (status === "INTERVIEW") regStatus = "under_review";
          else if (status === "APPLIED") regStatus = "docs_pending";

          await executeLeadToRegisterTransition({
            tenantId: schoolId,
            leadId: lead.id,
            bioData: {
              firstName,
              lastName,
              classApplied: lead.targetGrade || "N/A",
              parentPhone: lead.parentPhone || lead.parentContact || "N/A",
              email: lead.studentEmail || lead.parentEmail || null,
              parentName: lead.parentName || null,
            },
            status: regStatus,
          });
        }
      } catch (transErr) {
        console.warn("[updateLeadStatusAction] Auto-transition to register warning:", transErr);
      }
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
          console.error("[EMAIL_SYNC_ERROR] [ADMISSIONS_OFFER] Failed to dispatch admission offer email:", mailErr);
        }
      }
    } else {
      updatedLead = await basePrisma.admissionLead.update({
        where: { id: leadId },
        data: { status },
      });

      if (status === "INTERVIEW") {
        try {
          const slipRes = await scheduleAndDispatchExamAdmitSlipAction({
            leadId,
            schoolId,
            schoolDomain,
          });
          if (slipRes?.lead) {
            updatedLead = slipRes.lead;
          }
        } catch (slipErr) {
          console.warn("[updateLeadStatusAction] Failed to auto-dispatch exam admit slip:", slipErr);
        }
      }

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
      console.error(`[EMAIL_SYNC_ERROR] [REQUEST_DOCS] Delivery failure for ${recipientEmail}:`, mailResult.error);
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
    console.error("[EMAIL_SYNC_ERROR] [REQUEST_DOCS] Action error:", error);
    return { success: false, error: error?.message || "Failed to request applicant documents." };
  }
}

/**
 * Convert lead to live AdmissionRegister inside atomic Prisma transaction
 */
export async function convertLeadToRegisterAction(payload: {
  leadId: string;
  schoolId: string;
  schoolDomain: string;
  reason?: string;
  formFeePaid?: boolean;
}) {
  const { leadId, schoolDomain, reason, formFeePaid } = payload;
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, schoolDomain);

    const auth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
    if (session && !auth.canMutate) {
      return {
        success: false,
        error: "403: " + (auth.reason || "Unauthorized: Conversion to Register is strictly restricted to authorized Admissions staff."),
      };
    }

    const result = await convertLeadToRegister(leadId, { reason, formFeePaid }, session || { schoolId });
    safeRevalidate(`/${schoolDomain}/admissions`);
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");
    return result;
  } catch (error: any) {
    console.error("[convertLeadToRegisterAction] Error:", error);
    return { success: false, error: error?.message || "Failed to convert lead to register." };
  }
}

/**
 * Check for duplicate applicant entries using compound key and fuzzy matching
 */
export async function checkDuplicateAction(payload: {
  schoolId: string;
  name: string;
  phone?: string;
  email?: string;
  excludeRegisterId?: string;
}): Promise<DuplicateCheckMatch> {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    return await checkDuplicate(
      schoolId,
      payload.name,
      payload.phone,
      payload.email,
      payload.excludeRegisterId
    );
  } catch (error: any) {
    console.error("[checkDuplicateAction] Error:", error);
    return { isDuplicate: false };
  }
}

/**
 * Merge incoming duplicate data directly into an existing active record,
 * and DELETE the duplicate record so only 1 consolidated record remains.
 */
export async function mergeDuplicateAction(payload: {
  existingRegisterId: string;
  duplicateRegisterId?: string;
  duplicateLeadId?: string;
  incomingData: {
    firstName?: string;
    lastName?: string;
    classApplied?: string;
    parentPhone?: string;
    email?: string;
    documents?: any[];
    formFeePaid?: boolean;
    status?: string;
  };
  schoolId: string;
  schoolDomain: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);

    const auth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
    if (session && !auth.canMutate) {
      return {
        success: false,
        error: "403: " + (auth.reason || "Unauthorized to merge admissions records."),
      };
    }

    const existing = await basePrisma.admissionRegister.findUnique({
      where: { id: payload.existingRegisterId },
    });

    if (!existing) {
      return { success: false, error: "Primary register record not found." };
    }

    let duplicateRecord: any = null;
    if (payload.duplicateRegisterId && payload.duplicateRegisterId !== payload.existingRegisterId) {
      duplicateRecord = await basePrisma.admissionRegister.findUnique({
        where: { id: payload.duplicateRegisterId },
      });
    }

    const existingCreds =
      typeof existing.credentialsJson === "object" && existing.credentialsJson !== null
        ? (existing.credentialsJson as any)
        : {};

    const existingDocs = Array.isArray(existingCreds.documents)
      ? existingCreds.documents
      : [];

    const dupCreds =
      duplicateRecord && typeof duplicateRecord.credentialsJson === "object" && duplicateRecord.credentialsJson !== null
        ? (duplicateRecord.credentialsJson as any)
        : {};

    const dupDocs = Array.isArray(dupCreds.documents) ? dupCreds.documents : [];
    const incomingDocs = payload.incomingData.documents || [];

    // Deduplicate merged documents by doc key
    const docMap = new Map<string, any>();
    [...existingDocs, ...dupDocs, ...incomingDocs].forEach((d) => {
      const k = (d?.key || d?.docKey || d?.docType || d?.type || d?.label || "").toLowerCase();
      if (k) {
        if (!docMap.has(k) || d.verified || d.fileUrl) {
          docMap.set(k, d);
        }
      }
    });
    const mergedDocs = Array.from(docMap.values());

    // Elevate status if duplicate had higher verification status
    const statusRank: Record<string, number> = {
      enrolled: 5, ENROLLED: 5,
      approved: 4, APPROVED: 4,
      verified: 3, VERIFIED: 3,
      under_review: 2, UNDER_REVIEW: 2,
      docs_pending: 1, DOCS_PENDING: 1,
      new: 0, NEW: 0, INQUIRY: 0, inquiry: 0,
    };
    const currentRank = statusRank[existing.status] ?? 0;
    const dupRank = duplicateRecord ? (statusRank[duplicateRecord.status] ?? 0) : 0;
    const incomingRank = payload.incomingData.status ? (statusRank[payload.incomingData.status] ?? 0) : 0;

    let targetStatus = existing.status;
    let verifiedBy = existing.verifiedBy;
    let verifiedAt = existing.verifiedAt;

    if (dupRank > currentRank && duplicateRecord) {
      targetStatus = duplicateRecord.status;
      verifiedBy = duplicateRecord.verifiedBy || session?.name || "Admissions Officer";
      verifiedAt = duplicateRecord.verifiedAt || new Date();
    } else if (incomingRank > currentRank && payload.incomingData.status) {
      targetStatus = payload.incomingData.status;
      verifiedBy = session?.name || "Admissions Officer";
      verifiedAt = new Date();
    }

    const isFeePaid =
      Boolean(payload.incomingData.formFeePaid) ||
      Boolean(existingCreds.formFeePaid) ||
      Boolean(dupCreds.formFeePaid);

    const statusLog = {
      fromStatus: existing.status,
      toStatus: targetStatus,
      changedById: session?.name || "Admissions Officer",
      reason: duplicateRecord
        ? `Merged duplicate record ${duplicateRecord.applicationNo} into ${existing.applicationNo}. Redundant record deleted.`
        : "Duplicate records merged into active register file.",
      createdAt: new Date().toISOString(),
    };

    const updatedLogs = [
      ...(existingCreds.statusLogs || []),
      ...(dupCreds.statusLogs || []),
      statusLog,
    ];

    // 1. Update the primary record
    const updated = await basePrisma.admissionRegister.update({
      where: { id: existing.id },
      data: {
        parentPhone:
          payload.incomingData.parentPhone ||
          existing.parentPhone ||
          duplicateRecord?.parentPhone,
        email:
          payload.incomingData.email ||
          existing.email ||
          duplicateRecord?.email,
        classApplied:
          payload.incomingData.classApplied ||
          existing.classApplied ||
          duplicateRecord?.classApplied,
        status: targetStatus,
        verifiedBy,
        verifiedAt,
        credentialsJson: {
          ...existingCreds,
          ...dupCreds,
          documents: mergedDocs,
          statusLogs: updatedLogs,
          formFeePaid: isFeePaid,
        },
      },
    });

    // 2. DELETE the duplicate record from database
    if (payload.duplicateRegisterId && payload.duplicateRegisterId !== payload.existingRegisterId) {
      try {
        await basePrisma.admissionRegister.delete({
          where: { id: payload.duplicateRegisterId },
        });
        console.log(`[mergeDuplicateAction] Deleted duplicate AdmissionRegister record: ${payload.duplicateRegisterId}`);
      } catch (delErr) {
        console.warn(`[mergeDuplicateAction] Warning deleting duplicate record ${payload.duplicateRegisterId}:`, delErr);
      }
    }

    // 3. If there is an associated lead, mark it CONVERTED so it doesn't re-sync
    if (payload.duplicateLeadId) {
      try {
        await basePrisma.admissionLead.update({
          where: { id: payload.duplicateLeadId },
          data: { status: "CONVERTED" },
        });
      } catch {}
    }

    // 4. Log central audit
    try {
      await basePrisma.auditLog.create({
        data: {
          schoolId,
          tenantId: schoolId,
          actorId: session?.userId || session?.name || "Admissions Officer",
          action: "ADMISSION_DUPLICATE_MERGED",
          target: existing.id,
          metadata: {
            primaryId: existing.id,
            primaryAppNo: existing.applicationNo,
            deletedDuplicateId: payload.duplicateRegisterId || null,
            deletedDuplicateAppNo: duplicateRecord?.applicationNo || null,
          },
        },
      });
    } catch {}

    safeRevalidate(`/${payload.schoolDomain}/admissions`);
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");
    safeRevalidate("/api/v1/admissions");
    return { success: true, record: updated, deletedId: payload.duplicateRegisterId };
  } catch (error: any) {
    console.error("[mergeDuplicateAction] Error:", error);
    return { success: false, error: error?.message || "Failed to merge duplicate records." };
  }
}

/**
 * Permanently delete a duplicate or cancelled admission register record
 */
export async function deleteAdmissionRegisterAction(payload: {
  id: string;
  schoolId: string;
  schoolDomain: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);

    const auth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
    if (session && !auth.canMutate) {
      return {
        success: false,
        error: "403: " + (auth.reason || "Unauthorized to delete admissions records."),
      };
    }

    const existing = await basePrisma.admissionRegister.findUnique({
      where: { id: payload.id },
    });

    if (!existing) {
      return { success: false, error: "Admission record not found or already deleted." };
    }

    // Delete record from admissionRegister
    await basePrisma.admissionRegister.delete({
      where: { id: payload.id },
    });

    // If an associated lead exists with this appNo, ensure it is set to CONVERTED
    try {
      const matchLeadId = existing.applicationNo.replace(/^APP-/, "").toLowerCase();
      await basePrisma.admissionLead.updateMany({
        where: {
          schoolId,
          OR: [
            { id: { startsWith: matchLeadId } },
            { applicantName: { equals: `${existing.firstName} ${existing.lastName}` } },
          ],
        },
        data: { status: "CONVERTED" },
      });
    } catch {}

    // Audit log
    try {
      await basePrisma.auditLog.create({
        data: {
          schoolId,
          tenantId: schoolId,
          actorId: session?.userId || session?.name || "Admissions Officer",
          action: "ADMISSION_REGISTER_DELETED",
          target: payload.id,
          metadata: {
            applicationNo: existing.applicationNo,
            name: `${existing.firstName} ${existing.lastName}`,
            status: existing.status,
          },
        },
      });
    } catch {}

    safeRevalidate(`/${payload.schoolDomain}/admissions`);
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");
    safeRevalidate("/api/v1/admissions");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteAdmissionRegisterAction] Error:", error);
    return { success: false, error: error?.message || "Failed to delete admission record." };
  }
}

export async function sendBankDetailsEmailAction(payload: {
  registerId: string;
  schoolDomain: string;
  guardianEmail?: string;
  applicantName: string;
  applicationNo: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  try {
    const session = await getSession();
    const resolvedSchoolId = await resolveSchoolId(payload.schoolDomain);
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { id: resolvedSchoolId },
          { subdomain: payload.schoolDomain.toLowerCase() },
          { slug: payload.schoolDomain.toLowerCase() },
        ],
      },
    });

    const targetEmail = payload.guardianEmail?.trim() || "bonaveeict@gmail.com";

    // 1. Resolve applicant record (AdmissionRegister or AdmissionLead)
    const registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [{ id: payload.registerId }, { applicationNo: payload.registerId }],
      },
    });

    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          { id: payload.registerId },
          ...(registerRecord?.email ? [{ studentEmail: registerRecord.email }, { parentEmail: registerRecord.email }] : []),
          ...(registerRecord?.parentPhone ? [{ parentPhone: registerRecord.parentPhone }, { parentContact: registerRecord.parentPhone }] : []),
        ],
      },
    });

    // 2. Ensure or generate secure upload token for applicant credentials submission
    let uploadToken = (lead as any)?.uploadToken;
    const isTokenExpired = (lead as any)?.uploadExpiresAt && new Date((lead as any).uploadExpiresAt) < new Date();

    if (!uploadToken || isTokenExpired) {
      uploadToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day upload window

      if (lead) {
        try {
          await basePrisma.admissionLead.update({
            where: { id: lead.id },
            data: {
              uploadToken,
              uploadExpiresAt: expiresAt,
            } as any,
          });
          (lead as any).uploadToken = uploadToken;
          (lead as any).uploadExpiresAt = expiresAt;
        } catch (tokenUpdateErr) {
          console.warn("[sendBankDetailsEmailAction] Warning: Could not persist uploadToken to lead:", tokenUpdateErr);
        }
      }
    }

    // Fallback: If no lead exists, persist uploadToken in registerRecord.credentialsJson
    if (!uploadToken) {
      const regCreds: any = registerRecord?.credentialsJson || {};
      uploadToken = regCreds.uploadToken || crypto.randomUUID();
      if (registerRecord && !regCreds.uploadToken) {
        try {
          regCreds.uploadToken = uploadToken;
          await basePrisma.admissionRegister.update({
            where: { id: registerRecord.id },
            data: { credentialsJson: regCreds },
          });
        } catch (regTokenErr) {
          console.warn("[sendBankDetailsEmailAction] Warning: Could not persist uploadToken to register:", regTokenErr);
        }
      }
    }

    const effectiveTargetId = lead?.id || registerRecord?.id || payload.registerId;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const uploadUrl = `${baseUrl}/${payload.schoolDomain}/admissions/upload/${effectiveTargetId}?token=${uploadToken}`;

    // 3. Dispatch Payment Instruction Email
    await sendPaymentInstructionEmail({
      to: targetEmail,
      applicantName: payload.applicantName,
      applicationNo: payload.applicationNo,
      amount: payload.amount,
      bankName: payload.bankName,
      accountNumber: payload.accountNumber,
      accountName: payload.accountName,
      narration: `APPLICATION FEE ${payload.applicationNo}`,
      uploadUrl,
      schoolName: school?.name || "Institution Admissions Desk",
      schoolId: school?.id || resolvedSchoolId,
    });

    // 4. Log in Audit Timeline in AdmissionRegister credentialsJson.statusLogs
    if (registerRecord) {
      let rawCreds: any = registerRecord.credentialsJson || {};
      let isArrayCreds = Array.isArray(rawCreds);
      let credsObj = isArrayCreds ? { documents: rawCreds } : { ...(rawCreds || {}) };

      const existingLogs = Array.isArray(credsObj.statusLogs) ? credsObj.statusLogs : [];
      const newLog = {
        fromStatus: registerRecord.status,
        toStatus: registerRecord.status,
        action: "BANK_DETAILS_SENT",
        changedById: session?.userId || session?.name || "Admissions Officer",
        reason: `Bank details sent to ${targetEmail} for ref ${payload.applicationNo} (₦${Number(payload.amount).toLocaleString()})`,
        createdAt: new Date().toISOString(),
      };
      credsObj.statusLogs = [...existingLogs, newLog];

      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          credentialsJson: credsObj,
          updatedAt: new Date(),
        },
      });

      // Also sync log to linked AdmissionLead if present
      try {
        if (lead) {
          const leadLogs = Array.isArray(lead.logs) ? (lead.logs as any[]) : [];
          leadLogs.push({
            timestamp: new Date().toISOString(),
            action: "BANK_DETAILS_SENT",
            note: `Bank details sent to ${targetEmail} for ref ${payload.applicationNo} (₦${Number(payload.amount).toLocaleString()})`,
            operator: session?.userId || session?.name || "Admissions Officer",
          });
          await basePrisma.admissionLead.update({
            where: { id: lead.id },
            data: { logs: leadLogs as any },
          });
        }
      } catch (leadErr) {
        console.warn("[sendBankDetailsEmailAction_leadLogWarn]:", leadErr);
      }
    }

    safeRevalidate(`/${payload.schoolDomain}/admissions`);
    safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");
    return { success: true, message: `Bank details sent to ${targetEmail}` };
  } catch (error: any) {
    console.error("[sendBankDetailsEmailAction] Error:", error);
    return { success: false, error: error?.message || "Failed to send bank details email." };
  }
}

/**
 * Mark applicant application fee as PAID via manual bank transfer and append timeline audit log
 */
export async function markFormFeePaidAction(payload: {
  registerId: string;
  schoolDomain?: string;
  userRole?: string;
}) {
  try {
    const session = await getSession();
    let registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [{ id: payload.registerId }, { applicationNo: payload.registerId }],
      },
    });

    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          { id: payload.registerId },
          ...(registerRecord?.email ? [{ studentEmail: registerRecord.email }, { parentEmail: registerRecord.email }] : []),
          ...(registerRecord?.parentPhone ? [{ parentPhone: registerRecord.parentPhone }, { parentContact: registerRecord.parentPhone }] : []),
        ],
      },
    });

    if (!registerRecord && !lead) {
      return { success: false, error: "Applicant record not found" };
    }

    const verifiedBy = payload.userRole || session?.userId || session?.name || "Admissions Officer";
    const verifiedAt = new Date().toISOString();

    let updated: any = null;

    if (registerRecord) {
      let rawCreds: any = registerRecord.credentialsJson || {};
      let isArrayCreds = Array.isArray(rawCreds);
      let credsObj = isArrayCreds ? { documents: rawCreds } : { ...(rawCreds || {}) };

      credsObj.formFeePaid = true;
      credsObj.formFeeStatus = "PAID";
      credsObj.paymentState = "SETTLED";
      credsObj.formFeeVerifiedAt = verifiedAt;
      credsObj.formFeeVerifiedBy = verifiedBy;

      const existingLogs = Array.isArray(credsObj.statusLogs) ? credsObj.statusLogs : [];
      const newLog = {
        fromStatus: registerRecord.status,
        toStatus: registerRecord.status,
        action: "FORM_FEE_PAID",
        changedById: verifiedBy,
        reason: "Application fee verified and marked as PAID by Admin",
        createdAt: verifiedAt,
      };
      credsObj.statusLogs = [...existingLogs, newLog];

      updated = await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          credentialsJson: credsObj,
          updatedAt: new Date(),
        },
      });
    }

    // Also update linked AdmissionLead
    if (lead) {
      const leadDocs: any = { ...(lead.documents as any || {}) };
      leadDocs.formFeePaid = true;
      leadDocs.formFeeStatus = "PAID";
      leadDocs.paymentState = "SETTLED";
      leadDocs.formFeeVerifiedAt = verifiedAt;
      leadDocs.formFeeVerifiedBy = verifiedBy;

      const leadLogs = Array.isArray(lead.logs) ? (lead.logs as any[]) : [];
      leadLogs.push({
        timestamp: verifiedAt,
        action: "FORM_FEE_PAID",
        note: "Application fee verified and marked as PAID by Admin.",
        operator: verifiedBy,
      });

      const updatedLead = await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          documents: leadDocs,
          logs: leadLogs as any,
        },
      });
      if (!updated) updated = updatedLead;
    }

    // Update corresponding PaymentReceipt records if any
    try {
      const appRef = registerRecord?.applicationNo || (lead as any)?.applicationNo;
      if (appRef || lead?.id) {
        await basePrisma.paymentReceipt.updateMany({
          where: {
            OR: [
              ...(appRef ? [{ referenceNo: appRef }] : []),
              ...(lead?.id ? [{ payerId: lead.id }] : []),
            ],
            moduleType: "ADMISSION_FORM_FEE",
          },
          data: {
            status: "VERIFIED",
            state: "SETTLED",
            verifiedBy,
            verifiedAt: new Date(),
          },
        });
      }
    } catch (prErr) {
      console.warn("[markFormFeePaidAction] PaymentReceipt sync note:", prErr);
    }

    if (payload.schoolDomain) {
      safeRevalidate(`/${payload.schoolDomain}/admissions`);
      safeRevalidate("/[schoolDomain]/(admin)/admissions", "page");
    }

    return { success: true, applicant: updated };
  } catch (error: any) {
    console.error("[markFormFeePaidAction] Error:", error);
    return { success: false, error: error?.message || "Failed to mark application fee as paid" };
  }
}




// =========================================================================
// ENTERPRISE MULTI-TIER PIPELINE & STAGE GUARDRAIL ACTIONS
// =========================================================================

/**
 * Loads or automatically initializes multi-tier tracks and customizable stages for the tenant
 */
export async function getTenantAdmissionTracksAction(payload: {
  schoolId: string;
  schoolDomain?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const tracks = await ensureTenantAdmissionTracks(schoolId);
    return { success: true, tracks };
  } catch (err: any) {
    console.error("[getTenantAdmissionTracksAction] Error:", err);
    return { success: false, error: err.message || "Failed to load admission tracks." };
  }
}

/**
 * Creates a new admission track. Restricted exclusively to the Tenant Admin within their own tenantId.
 */
export async function createAdmissionTrackAction(payload: {
  schoolId: string;
  schoolDomain: string;
  name: string;
  tierType: AdmissionTierType;
  description?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyTenantAdminRole(session, schoolId);
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.reason || "403 Forbidden: Only the Tenant Admin can configure admission tracks.",
      };
    }

    const track = await basePrisma.admissionTrack.create({
      data: {
        tenantId: schoolId,
        name: payload.name.trim(),
        tierType: payload.tierType,
        description: payload.description?.trim() || null,
        isActive: true,
      },
    });

    const defaultStages = [
      { name: "Inquiry & Prospect Log", sequenceOrder: 0, color: "#94a3b8", constraints: {} },
      { name: "Documentation & Intake", sequenceOrder: 1, color: "#f59e0b", constraints: { require_birth_cert: true } },
      { name: "Screening & Assessment", sequenceOrder: 2, color: "#8b5cf6", constraints: { require_payment: true } },
      { name: "Provisional Offer", sequenceOrder: 3, color: "#3b82f6", constraints: {} },
      { name: "Matriculated", sequenceOrder: 4, color: "#10b981", constraints: {} },
    ];

    for (const s of defaultStages) {
      await basePrisma.admissionStage.create({
        data: {
          trackId: track.id,
          name: s.name,
          sequenceOrder: s.sequenceOrder,
          color: s.color,
          constraints: s.constraints,
        },
      });
    }

    const fullTrack = await basePrisma.admissionTrack.findUnique({
      where: { id: track.id },
      include: { stages: { orderBy: { sequenceOrder: "asc" } } },
    });

    safeRevalidate(`/${payload.schoolDomain}/admissions`);
    return { success: true, track: fullTrack };
  } catch (err: any) {
    console.error("[createAdmissionTrackAction] Error:", err);
    return { success: false, error: err.message || "Failed to create admission track." };
  }
}

/**
 * Creates or updates a customizable admission stage with stage constraints.
 * Restricted to the Tenant Admin within their own tenantId.
 */
export async function configureAdmissionStageAction(payload: {
  schoolId: string;
  schoolDomain: string;
  stageId?: string;
  trackId?: string;
  name?: string;
  sequenceOrder?: number;
  constraints?: StageConstraints;
  color?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyTenantAdminRole(session, schoolId);
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.reason || "403 Forbidden: Only the Tenant Admin can configure stage constraints.",
      };
    }

    if (payload.stageId) {
      const existing = await basePrisma.admissionStage.findUnique({
        where: { id: payload.stageId },
        include: { track: true },
      });
      if (!existing) {
        return { success: false, error: "404 Not Found: Stage not found." };
      }

      const isStageOwner = await isSessionMatchingTenant(session, existing.track.tenantId);
      if (!isStageOwner && !auth.isGlobalSuperAdmin) {
        return { success: false, error: "403 Forbidden: Stage does not belong to your school pipeline." };
      }

      const updated = await basePrisma.admissionStage.update({
        where: { id: payload.stageId },
        data: {
          ...(payload.name ? { name: payload.name.trim() } : {}),
          ...(typeof payload.sequenceOrder === "number" ? { sequenceOrder: payload.sequenceOrder } : {}),
          ...(payload.constraints !== undefined ? { constraints: payload.constraints as any } : {}),
          ...(payload.color ? { color: payload.color } : {}),
        },
      });

      safeRevalidate(`/${payload.schoolDomain}/admissions`);
      return { success: true, stage: updated };
    } else {
      if (!payload.trackId || !payload.name) {
        return { success: false, error: "400 Bad Request: Missing required trackId or stage name." };
      }

      const track = await basePrisma.admissionTrack.findUnique({
        where: { id: payload.trackId },
      });
      if (!track) {
        return { success: false, error: "404 Not Found: Target track not found." };
      }

      const isTrackOwner = await isSessionMatchingTenant(session, track.tenantId);
      if (!isTrackOwner && !auth.isGlobalSuperAdmin) {
        return { success: false, error: "403 Forbidden: Target track does not belong to your school." };
      }

      const created = await basePrisma.admissionStage.create({
        data: {
          trackId: payload.trackId,
          name: payload.name.trim(),
          sequenceOrder: payload.sequenceOrder ?? 0,
          constraints: (payload.constraints || {}) as any,
          color: payload.color || "#3b82f6",
        },
      });

      safeRevalidate(`/${payload.schoolDomain}/admissions`);
      return { success: true, stage: created };
    }
  } catch (err: any) {
    console.error("[configureAdmissionStageAction] Error:", err);
    return { success: false, error: err.message || "Failed to configure stage." };
  }
}

/**
 * Transitions candidate to a target stage with automated constraint verification
 */
export async function transitionCandidateStageAction(payload: {
  leadId: string;
  targetStageId?: string;
  targetStatus?: string;
  schoolId: string;
  schoolDomain: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);

    const auth = await verifyAdmissionsMutatorRole(session, schoolId);
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.reason || "403 Forbidden: Moving candidates requires Tenant Admin or Admissions Officer privileges.",
      };
    }

    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: payload.leadId },
      include: { tier: true, track: true, stage: true },
    });

    if (!lead || lead.schoolId !== schoolId) {
      return { success: false, error: "404 Not Found: Candidate dossier not found in this tenant." };
    }

    let targetStage: any = null;
    if (payload.targetStageId) {
      targetStage = await basePrisma.admissionStage.findUnique({
        where: { id: payload.targetStageId },
        include: { track: true },
      });
    }

    if (targetStage?.constraints) {
      const evaluation = evaluateStageConstraints(lead, targetStage.constraints);
      if (!evaluation.satisfied) {
        return {
          success: false,
          error: `400 Bad Request: Stage guardrails not met. Missing prerequisites: ${evaluation.missingPrerequisites.join("; ")}`,
          missingPrerequisites: evaluation.missingPrerequisites,
          targetStageName: targetStage.name,
        };
      }
    }

    const newStatus = payload.targetStatus || targetStage?.name || lead.status;

    const res = await updateLeadStatusAction({
      leadId: payload.leadId,
      status: newStatus,
      targetStageId: targetStage?.id,
      schoolId,
      schoolDomain: payload.schoolDomain,
    });

    if (res.success && targetStage) {
      await basePrisma.admissionLead.update({
        where: { id: payload.leadId },
        data: {
          stageId: targetStage.id,
          trackId: targetStage.trackId,
        },
      });
    }

    return res;
  } catch (err: any) {
    console.error("[transitionCandidateStageAction] Error:", err);
    return { success: false, error: err.message || "Failed to transition candidate stage." };
  }
}

/**
 * Manually record or override offline entrance examination / assessment score
 * Enables traditional pen-and-paper schools to log exam marks directly.
 * Automatically fulfills stage constraints (require_exam_score: true).
 */
export async function saveManualEntranceScoreAction(payload: {
  leadId: string;
  score: number;
  schoolId: string;
  schoolDomain?: string;
  notes?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyAdmissionsMutatorRole(session, schoolId);
    if (!auth.authorized) {
      return { success: false, error: auth.reason || "403 Forbidden: Unauthorized to record exam scores." };
    }

    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: payload.leadId },
    });
    if (!lead || lead.schoolId !== schoolId) {
      return { success: false, error: "404 Not Found: Candidate dossier not found in this tenant." };
    }

    const parsedScore = Number(payload.score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      return { success: false, error: "Invalid entrance score. Please provide a score between 0 and 100." };
    }

    const docs = (lead.documents as any) || {};
    docs.entranceScore = parsedScore;
    docs.examScore = parsedScore;
    docs.examAggregate = parsedScore;
    docs.manualScoreEntry = true;
    docs.examPassed = parsedScore >= 50;
    docs.scoreRecordedAt = new Date().toISOString();

    const logs = Array.isArray(lead.logs) ? [...(lead.logs as any[])] : [];
    logs.push({
      timestamp: new Date().toISOString(),
      action: "MANUAL_SCORE_OVERRIDE",
      score: parsedScore,
      recordedBy: session?.user?.name || session?.email || "Admissions Officer",
      notes: payload.notes || "Offline Entrance Assessment score recorded",
    });

    const updated = await basePrisma.admissionLead.update({
      where: { id: payload.leadId },
      data: {
        documents: docs,
        logs,
      },
      include: { tier: true, track: true, stage: true },
    });

    // Also sync to matching AdmissionRegister record if present
    const cleanRef = lead.id.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
    const nameParts = (lead.applicantName || "").trim().split(" ");
    const firstName = nameParts[0] || "Student";
    const lastName = nameParts.slice(1).join(" ") || "Applicant";

    const registerRecord = await basePrisma.admissionRegister.findFirst({
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
      const creds =
        typeof registerRecord.credentialsJson === "object" && registerRecord.credentialsJson !== null
          ? { ...(registerRecord.credentialsJson as any) }
          : {};
      creds.entranceScore = parsedScore;
      creds.examScore = parsedScore;
      creds.examPassed = parsedScore >= 50;
      creds.manualScoreEntry = true;

      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          credentialsJson: creds,
        },
      });
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
    return { success: true, lead: updated, score: parsedScore };
  } catch (err: any) {
    console.error("[saveManualEntranceScoreAction] Error:", err);
    return { success: false, error: err.message || "Failed to save entrance score." };
  }
}

/**
 * Bulk save offline entrance exam scores for multiple applicants at once
 */
export async function bulkSaveManualEntranceScoresAction(payload: {
  entries: Array<{ leadId: string; score: number }>;
  schoolId: string;
  schoolDomain?: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyAdmissionsMutatorRole(session, schoolId);
    if (!auth.authorized) {
      return { success: false, error: auth.reason || "403 Forbidden: Unauthorized to record exam scores." };
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const entry of payload.entries) {
      const res = await saveManualEntranceScoreAction({
        leadId: entry.leadId,
        score: entry.score,
        schoolId,
        schoolDomain: payload.schoolDomain,
      });
      if (res.success) {
        successCount++;
      } else {
        errors.push(res.error || `Failed to save score for lead ${entry.leadId}`);
      }
    }

    return {
      success: errors.length === 0,
      savedCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: any) {
    console.error("[bulkSaveManualEntranceScoresAction] Error:", err);
    return { success: false, error: err.message || "Failed to bulk save entrance scores." };
  }
}

/**
 * Safely removes an applicant record from both AdmissionLead and AdmissionRegister.
 * Restricted strictly to Tenant Admin or Super Admin within their matching schoolId.
 */
export async function deleteApplicantAction(payload: {
  applicantId: string;
  leadId?: string;
  registerId?: string;
  schoolId: string;
  schoolDomain: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyTenantAdminRole(session, schoolId);
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.reason || "403 Forbidden: Only the Tenant Admin can delete applicant records.",
      };
    }

    const targetId = payload.applicantId || payload.leadId || payload.registerId;
    if (!targetId) {
      return { success: false, error: "400 Bad Request: Missing applicant identifier." };
    }

    // 1. Locate corresponding AdmissionLead if any within active schoolId
    const lead = await basePrisma.admissionLead.findFirst({
      where: {
        schoolId,
        OR: [
          { id: targetId },
          ...(payload.leadId ? [{ id: payload.leadId }] : []),
        ],
      },
    });

    // 2. Locate corresponding AdmissionRegister if any within active schoolId
    const cleanRef = targetId.replace(/^ADM-|^APP-/, "").trim().toLowerCase();
    const register = await basePrisma.admissionRegister.findFirst({
      where: {
        tenantId: schoolId,
        OR: [
          { id: targetId },
          ...(payload.registerId ? [{ id: payload.registerId }] : []),
          ...(cleanRef && cleanRef.length >= 4 ? [{ applicationNo: { contains: cleanRef, mode: "insensitive" as const } }] : []),
          ...(lead?.studentEmail ? [{ email: lead.studentEmail }] : []),
          ...(lead?.parentEmail ? [{ email: lead.parentEmail }] : []),
        ],
      },
    });

    if (!lead && !register) {
      // Diagnostic check: check if record exists under a different institution
      const crossLead = await basePrisma.admissionLead.findFirst({
        where: {
          OR: [
            { id: targetId },
            ...(payload.leadId ? [{ id: payload.leadId }] : []),
          ],
        },
      });
      const crossRegister = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [
            { id: targetId },
            ...(payload.registerId ? [{ id: payload.registerId }] : []),
          ],
        },
      });
      if (crossLead || crossRegister) {
        return { success: false, error: "403 Forbidden: Candidate record belongs to another institution." };
      }
      return { success: false, error: "404 Not Found: Applicant record not found in this institution." };
    }

    // Strict Tenancy Verification
    if (lead) {
      const isLeadOwner = lead.schoolId === schoolId || (await isSessionMatchingTenant(session, lead.schoolId));
      if (!isLeadOwner && !auth.isGlobalSuperAdmin) {
        return { success: false, error: "403 Forbidden: Candidate record belongs to another institution." };
      }
    }
    if (register) {
      const isRegOwner = register.tenantId === schoolId || (await isSessionMatchingTenant(session, register.tenantId));
      if (!isRegOwner && !auth.isGlobalSuperAdmin) {
        return { success: false, error: "403 Forbidden: Candidate record belongs to another institution." };
      }
    }

    // Execute Safe Database Transaction Permanent Hard Deletion
    await basePrisma.$transaction(async (tx) => {
      if (lead) {
        // Cascade delete notes
        await tx.admissionNote.deleteMany({
          where: { studentLeadId: lead.id },
        });
        await tx.admissionLead.delete({
          where: { id: lead.id },
        });
      }

      if (register) {
        // Remove linked audit trails
        await tx.admissionAuditTrail.deleteMany({
          where: { registerId: register.id },
        });
        await tx.admissionRegister.delete({
          where: { id: register.id },
        });
      }
    });

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain}/admissions`);

    return {
      success: true,
      applicantId: targetId,
      message: "Applicant record removed successfully.",
    };
  } catch (err: any) {
    console.error("[deleteApplicantAction] Error:", err);
    return { success: false, error: err.message || "Failed to delete applicant record." };
  }
}

/**
 * Scans, consolidates, and purges duplicate applicant records within the institution.
 * Restricted strictly to Tenant Admin or Super Admin within their matching schoolId.
 */
export async function deduplicateAdmissionsAction(payload: {
  schoolId: string;
  schoolDomain: string;
}) {
  try {
    const schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyTenantAdminRole(session, schoolId);
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.reason || "403 Forbidden: Only the Tenant Admin can execute deduplication.",
      };
    }

    const result = await deduplicateTenantAdmissions(schoolId);

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain}/admissions`);

    return {
      success: true,
      mergedCount: result.totalMergedGroups,
      purgedCount: result.totalPurged,
      details: result,
      message:
        result.totalPurged > 0
          ? `Successfully consolidated ${result.totalMergedGroups} duplicate group(s) and purged ${result.totalPurged} redundant record(s).`
          : "Admissions register is clean. No duplicate records detected.",
    };
  } catch (err: any) {
    console.error("[deduplicateAdmissionsAction] Error:", err);
    return { success: false, error: err.message || "Failed to execute deduplication." };
  }
}
