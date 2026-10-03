import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { sendStudentEnrollmentConfirmationEmail } from "@/lib/mail";
import fs from "fs";
import path from "path";

export interface CredentialDoc {
  type: string;
  path: string;
  originalName?: string;
  verified: boolean;
}

/**
 * Generate Application No helper:
 * Format: TENANTCODE/YEAR/SEQ e.g TRIAL/2026/0001
 */
export async function generateApplicationNo(tenantId: string): Promise<string> {
  const count = await basePrisma.admissionRegister.count({
    where: { tenantId },
  });
  const year = new Date().getFullYear();
  const code = (tenantId || "TENANT").substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${code}/${year}/${String(count + 1).padStart(4, "0")}`;
}

/**
 * Store application in admission_registers table with tenantId scoping
 */
export async function storeApplication({
  tenantId,
  firstName,
  lastName,
  classApplied,
  parentPhone,
  email,
  files = [],
}: {
  tenantId: string;
  firstName: string;
  lastName: string;
  classApplied: string;
  parentPhone: string;
  email?: string;
  files?: Array<{ type: string; buffer: Buffer; filename: string; originalName?: string }>;
}) {
  if (!tenantId || !firstName || !lastName || !classApplied || !parentPhone) {
    throw new Error("Missing required applicant fields");
  }

  const applicationNo = await generateApplicationNo(tenantId);
  const year = new Date().getFullYear();
  const credentialsJson: CredentialDoc[] = [];

  // File upload to storage/app/public/tenants/{tenantId}/admissions/{year}/{applicationNo}/ or public/uploads/tenants/{tenantId}/admissions/{year}/{applicationNo}/
  if (files && files.length > 0) {
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "tenants",
      tenantId,
      "admissions",
      String(year),
      applicationNo.replace(/\//g, "-")
    );

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const sanitizedFilename = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const fullPath = path.join(uploadDir, sanitizedFilename);
      fs.writeFileSync(fullPath, file.buffer);

      const publicRelativePath = `/uploads/tenants/${tenantId}/admissions/${year}/${applicationNo.replace(/\//g, "-")}/${sanitizedFilename}`;
      credentialsJson.push({
        type: file.type,
        path: publicRelativePath,
        originalName: file.originalName || file.filename,
        verified: false,
      });
    }
  }

  const applicant = await basePrisma.admissionRegister.create({
    data: {
      tenantId,
      applicationNo,
      firstName,
      lastName,
      classApplied,
      parentPhone,
      email: email || null,
      credentialsJson: credentialsJson.length > 0 ? (credentialsJson as any) : null,
      status: "new",
    },
  });

  return applicant;
}

/**
 * Get all applications scoped by tenantId and optional status
 */
export async function getAllApplications({
  tenantId,
  status,
}: {
  tenantId: string;
  status?: string;
}) {
  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { id: tenantId },
        { subdomain: tenantId.toLowerCase().trim() },
        { slug: tenantId.toLowerCase().trim() },
      ],
    },
    select: { id: true },
  });

  const effectiveTenantId = school?.id || tenantId;

  const where: any = { tenantId: effectiveTenantId };
  if (status && status !== "ALL") {
    if (status.includes(",")) {
      where.status = { in: status.split(",").map((s) => s.trim()) };
    } else {
      where.status = status;
    }
  }

  const applications = await basePrisma.admissionRegister.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return applications;
}

/**
 * Get single application by ID with tenantId isolation
 */
export async function getApplicationById({
  id,
  tenantId,
}: {
  id: string;
  tenantId: string;
}) {
  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { id: tenantId },
        { subdomain: tenantId.toLowerCase().trim() },
        { slug: tenantId.toLowerCase().trim() },
      ],
    },
    select: { id: true },
  });

  const effectiveTenantId = school?.id || tenantId;

  const applicant = await basePrisma.admissionRegister.findFirst({
    where: {
      id,
      tenantId: effectiveTenantId,
    },
  });

  return applicant;
}

/**
 * Verify document in credentials_json
 */
export async function verifyDocument({
  id,
  tenantId,
  docType,
  verified = true,
  verifiedBy,
}: {
  id: string;
  tenantId: string;
  docType: string;
  verified?: boolean;
  verifiedBy?: string;
}) {
  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  const docs = (applicant.credentialsJson as any[]) || [];
  const updatedDocs = docs.map((doc: any) => {
    if (doc.type === docType || doc.originalName === docType) {
      return { ...doc, verified };
    }
    return doc;
  });

  const allVerified = updatedDocs.length > 0 && updatedDocs.every((d) => d.verified);

  const updated = await basePrisma.admissionRegister.update({
    where: { id: applicant.id },
    data: {
      credentialsJson: updatedDocs as any,
      verifiedBy: verifiedBy || applicant.verifiedBy,
      verifiedAt: verified ? new Date() : applicant.verifiedAt,
      status: allVerified ? "under_review" : applicant.status,
    },
  });

  return updated;
}

/**
 * Admit applicant:
 * 1. Updates admission_registers status to 'admitted' and sets admittedAt (audit record kept)
 * 2. Creates the student record in Student table with tenantId scoping
 */
export async function admitApplicant({
  id,
  tenantId,
  verifiedBy,
}: {
  id: string;
  tenantId: string;
  verifiedBy?: string;
}) {
  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  // Verify applicant has docs uploaded
  const creds = Array.isArray(applicant.credentialsJson) ? applicant.credentialsJson : [];
  if (creds.length === 0) {
    throw new Error("Documents not uploaded yet");
  }

  // 1. Update audit record status in admission_registers (DO NOT DELETE)
  const updatedAdmission = await basePrisma.admissionRegister.update({
    where: { id: applicant.id },
    data: {
      status: "admitted",
      admittedAt: new Date(),
      verifiedBy: verifiedBy || applicant.verifiedBy,
    },
  });

  // 2. Resolve School Tenant for Student placement
  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { id: tenantId },
        { subdomain: tenantId },
        { slug: tenantId },
      ],
    },
    include: { academicTiers: true },
  });

  const tenantDb = getTenantClient(school?.id || tenantId);

  // 3. Resolve Classroom or Tier
  const classroom = await tenantDb.classroom.findFirst({
    where: {
      schoolId: school?.id || tenantId,
      name: { equals: applicant.classApplied, mode: "insensitive" },
    },
  });

  const tier =
    school?.academicTiers?.[0] ||
    (await basePrisma.academicTier.findFirst({ where: { schoolId: school?.id || tenantId } }));

  const studentData: any = {
    schoolId: school?.id || tenantId,
    admissionNumber: applicant.applicationNo,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    currentClass: applicant.classApplied,
    status: "ENROLLED",
    parentPhone: applicant.parentPhone,
    parentName: `${applicant.lastName} Family`,
  };

  if (tier?.id) {
    studentData.tierId = tier.id;
  }
  studentData.enrolledAt = new Date();
  if (applicant.email) {
    studentData.email = applicant.email;
    studentData.parentEmail = applicant.email;
  }

  // 4. Create Student record from admission_register data
  const student = await tenantDb.student.create({
    data: studentData,
  });

  // 5. Dispatch enrollment confirmation email via unified mail service
  if (applicant.email) {
    try {
      const emailResult = await sendStudentEnrollmentConfirmationEmail({
        schoolId: school?.id || tenantId,
        studentId: student.id,
        schoolName: school?.name,
        subdomain: school?.subdomain,
        studentName: `${applicant.firstName} ${applicant.lastName}`.trim(),
        admissionNumber: applicant.applicationNo,
        currentClass: applicant.classApplied,
        tierName: tier?.name || null,
        studentEmail: applicant.email,
        parentEmail: applicant.email,
        parentName: `${applicant.lastName} Family`,
      });

      if (!emailResult.success) {
        console.error(`[EMAIL_SYNC_ERROR] [ENROLLMENT_CONTROLLER] Failed to send enrollment confirmation to ${applicant.email}:`, emailResult.error);
      }
    } catch (emailErr) {
      console.error("[EMAIL_SYNC_ERROR] [ENROLLMENT_CONTROLLER] Error sending enrollment confirmation email:", emailErr);
    }
  }

  return {
    success: true,
    admissionRegister: updatedAdmission,
    student,
  };
}

/**
 * Reject applicant
 */
export async function rejectApplicant({
  id,
  tenantId,
  reason,
  documentType,
}: {
  id: string;
  tenantId: string;
  reason?: string;
  documentType?: string;
}) {
  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  const updated = await basePrisma.admissionRegister.update({
    where: { id: applicant.id },
    data: {
      status: "rejected",
      updatedAt: new Date(),
    },
  });

  // 1. Sync status to linked AdmissionLead (if exists)
  try {
    const lead = await basePrisma.admissionLead.findFirst({
      where: {
        schoolId: tenantId,
        OR: [
          { id: applicant.id },
          ...(applicant.email ? [{ studentEmail: applicant.email }, { parentEmail: applicant.email }] : []),
          ...(applicant.parentPhone ? [{ parentPhone: applicant.parentPhone }, { parentContact: applicant.parentPhone }] : []),
        ],
      },
    });

    if (lead) {
      const docs = (lead.documents as any) || {};
      if (documentType) {
        docs[documentType] = { status: "REJECTED", rejectedAt: new Date().toISOString() };
      }
      await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          status: "REJECTED",
          documents: docs,
        },
      });
    }
  } catch (leadSyncErr) {
    console.warn("[rejectApplicant] Warning syncing to admissionLead:", leadSyncErr);
  }

  // 2. Dispatch rejection notification email via Resend
  const recipientEmail = applicant.email;
  if (recipientEmail && recipientEmail.includes("@")) {
    try {
      const { sendDocumentRejectedEmail } = await import("@/lib/email-service");
      await sendDocumentRejectedEmail({
        schoolId: tenantId,
        applicantName: `${applicant.firstName} ${applicant.lastName}`.trim(),
        applicationNo: applicant.applicationNo,
        targetGrade: applicant.classApplied,
        recipientEmail,
        documentType: documentType || "Application Credential",
        feedback: reason,
      });
    } catch (mailErr) {
      console.error("[rejectApplicant] Failed to dispatch rejection email via Resend:", mailErr);
    }
  }

  return updated;
}

/**
 * Update applicant status (e.g. docs_pending, rejected, under_review, etc.)
 */
export async function updateApplicantStatus({
  id,
  tenantId,
  status,
  verifiedBy,
  reason,
  documentType,
}: {
  id: string;
  tenantId: string;
  status: string;
  verifiedBy?: string;
  reason?: string;
  documentType?: string;
}) {
  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  const data: any = { status };
  if (status === "docs_pending" || status === "under_review" || status === "verified") {
    if (verifiedBy) data.verifiedBy = verifiedBy;
    data.verifiedAt = new Date();
  }

  const updated = await basePrisma.admissionRegister.update({
    where: { id: applicant.id },
    data,
  });

  // If status is rejected, sync to admissionLead and dispatch Resend email
  if (status.toLowerCase() === "rejected") {
    try {
      const lead = await basePrisma.admissionLead.findFirst({
        where: {
          schoolId: tenantId,
          OR: [
            { id: applicant.id },
            ...(applicant.email ? [{ studentEmail: applicant.email }, { parentEmail: applicant.email }] : []),
            ...(applicant.parentPhone ? [{ parentPhone: applicant.parentPhone }, { parentContact: applicant.parentPhone }] : []),
          ],
        },
      });

      if (lead) {
        const docs = (lead.documents as any) || {};
        if (documentType) {
          docs[documentType] = { status: "REJECTED", rejectedAt: new Date().toISOString() };
        }
        await basePrisma.admissionLead.update({
          where: { id: lead.id },
          data: {
            status: "REJECTED",
            documents: docs,
          },
        });
      }

      if (applicant.email && applicant.email.includes("@")) {
        const { sendDocumentRejectedEmail } = await import("@/lib/email-service");
        await sendDocumentRejectedEmail({
          schoolId: tenantId,
          applicantName: `${applicant.firstName} ${applicant.lastName}`.trim(),
          applicationNo: applicant.applicationNo,
          targetGrade: applicant.classApplied,
          recipientEmail: applicant.email,
          documentType: documentType || "Application Credentials",
          feedback: reason,
        });
      }
    } catch (syncErr) {
      console.warn("[updateApplicantStatus] Rejection sync error:", syncErr);
    }
  }

  return updated;
}

