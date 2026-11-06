import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { sendStudentEnrollmentConfirmationEmail } from "@/lib/mail";
import fs from "fs";
import path from "path";

export interface CredentialDoc {
  type: string;
  path?: string;
  url?: string;
  fileUrl?: string;
  filename?: string;
  originalName?: string;
  name?: string;
  verified: boolean;
  docType?: string;
  key?: string;
  size?: number;
  uploadedAt?: string;
}

import {
  AUTHORIZED_ADMISSION_ROLES,
  isAdmissionsAuthorized,
  assertAdmissionsAuthorized,
} from "@/lib/admissions-rbac";

export {
  AUTHORIZED_ADMISSION_ROLES,
  isAdmissionsAuthorized,
  assertAdmissionsAuthorized,
};

/**
 * Resolves effective school identifier and record for tenant isolation
 */
export async function resolveTenantSchool(tenantId: string) {
  try {
    const trimmed = (tenantId || "").trim();
    if (!trimmed) {
      return { effectiveTenantId: "", school: null };
    }
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { id: trimmed },
          { subdomain: trimmed.toLowerCase() },
          { slug: trimmed.toLowerCase() },
        ],
      },
      include: { academicTiers: true },
    });

    return {
      effectiveTenantId: school?.id || trimmed,
      school,
    };
  } catch (err) {
    console.error("[resolveTenantSchool] Error resolving school:", err);
    return {
      effectiveTenantId: tenantId,
      school: null,
    };
  }
}

/**
 * Normalization helpers for Compound Validation Key:
 * [schoolId + Student Name + Parent Phone/Email]
 */
export function normalizeStudentName(name: string): string {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/[^0-9]/g, "");
}

export function normalizeEmail(email?: string | null): string {
  return (email || "").toLowerCase().trim();
}

/**
 * SYSTEM ANTI-DUPLICATE GUARD (DEDUPLICATION):
 * Pre-flight database validation scan using compound validation key:
 * [schoolId + Student Name + Parent Phone/Email]
 */
export async function findDuplicateAdmissionEntry({
  tenantId,
  firstName,
  lastName,
  studentName,
  parentPhone,
  email,
}: {
  tenantId: string;
  firstName?: string;
  lastName?: string;
  studentName?: string;
  parentPhone?: string | null;
  email?: string | null;
}) {
  const { effectiveTenantId } = await resolveTenantSchool(tenantId);
  const rawFullName = studentName || `${firstName || ""} ${lastName || ""}`.trim();
  const cleanTargetName = normalizeStudentName(rawFullName);
  const cleanTargetPhone = normalizePhone(parentPhone);
  const cleanTargetEmail = normalizeEmail(email);

  // 1. Scan live AdmissionRegister
  const registerCandidates = await basePrisma.admissionRegister.findMany({
    where: {
      tenantId: effectiveTenantId,
      OR: [
        ...(cleanTargetEmail
          ? [{ email: { equals: cleanTargetEmail, mode: "insensitive" as const } }]
          : []),
        ...(cleanTargetPhone && cleanTargetPhone.length >= 7
          ? [{ parentPhone: { contains: cleanTargetPhone.slice(-8) } }]
          : []),
      ],
    },
  });

  const duplicateRegister = registerCandidates.find((rec) => {
    const recName = normalizeStudentName(`${rec.firstName} ${rec.lastName}`);
    if (recName === cleanTargetName) return true;
    if (cleanTargetName.length > 3 && (recName.includes(cleanTargetName) || cleanTargetName.includes(recName))) {
      return true;
    }
    return false;
  });

  // 2. Scan AdmissionLead
  const leadCandidates = await basePrisma.admissionLead.findMany({
    where: {
      schoolId: effectiveTenantId,
      OR: [
        ...(cleanTargetEmail
          ? [
              { studentEmail: { equals: cleanTargetEmail, mode: "insensitive" as const } },
              { parentEmail: { equals: cleanTargetEmail, mode: "insensitive" as const } },
            ]
          : []),
        ...(cleanTargetPhone && cleanTargetPhone.length >= 7
          ? [
              { parentPhone: { contains: cleanTargetPhone.slice(-8) } },
              { parentContact: { contains: cleanTargetPhone.slice(-8) } },
            ]
          : []),
      ],
    },
  });

  const duplicateLead = leadCandidates.find((lead) => {
    const leadName = normalizeStudentName(lead.applicantName);
    if (leadName === cleanTargetName) return true;
    if (cleanTargetName.length > 3 && (leadName.includes(cleanTargetName) || cleanTargetName.includes(leadName))) {
      return true;
    }
    return false;
  });

  return {
    isDuplicate: Boolean(duplicateRegister || duplicateLead),
    registerRecord: duplicateRegister || null,
    leadRecord: duplicateLead || null,
    effectiveTenantId,
  };
}

/**
 * Generate Application No helper:
 * Format: TENANTCODE/YEAR/SEQ e.g TRIAL/2026/0001
 */
export async function generateApplicationNo(tenantId: string): Promise<string> {
  const { effectiveTenantId, school } = await resolveTenantSchool(tenantId);
  const count = await basePrisma.admissionRegister.count({
    where: { tenantId: effectiveTenantId },
  });
  const year = new Date().getFullYear();
  const code = (school?.subdomain || effectiveTenantId || "TENANT")
    .substring(0, 5)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return `${code}/${year}/${String(count + 1).padStart(4, "0")}`;
}

/**
 * AUTOMATED FUNNEL STATE MACHINE (ATOMIC TRANSACTION):
 * The exact millisecond an applicant submits bio-data, pays fee, or uploads documents:
 * a) Create or merge into live 'AdmissionRegister' model (Status: DOCS_PENDING).
 * b) Automatically update corresponding record in 'AdmissionLeads' to 'CONVERTED'
 *    so it clears out of the active inquiry view without erasing historical logs.
 */
export async function executeLeadToRegisterTransition({
  tenantId,
  leadId,
  bioData,
  credentials = [],
  userRole,
  staffRole,
  verifiedBy,
  status = "docs_pending",
}: {
  tenantId: string;
  leadId?: string;
  bioData: {
    firstName: string;
    lastName: string;
    classApplied: string;
    parentPhone: string;
    email?: string | null;
    parentName?: string | null;
  };
  credentials?: CredentialDoc[];
  userRole?: string | null;
  staffRole?: string | null;
  verifiedBy?: string | null;
  status?: string;
}) {
  const { effectiveTenantId } = await resolveTenantSchool(tenantId);

  // Pre-flight Deduplication scan
  const dupCheck = await findDuplicateAdmissionEntry({
    tenantId: effectiveTenantId,
    firstName: bioData.firstName,
    lastName: bioData.lastName,
    parentPhone: bioData.parentPhone,
    email: bioData.email,
  });

  return await basePrisma.$transaction(async (tx) => {
    let registerRecord: any = dupCheck.registerRecord;

    if (registerRecord) {
      // Deduplication Guard: Merge incoming payload directly into active record without wiping object keys
      const rawExistingCreds = registerRecord.credentialsJson;
      const isObjCreds = rawExistingCreds && typeof rawExistingCreds === "object" && !Array.isArray(rawExistingCreds);
      const existingCreds: CredentialDoc[] = Array.isArray(rawExistingCreds)
        ? (rawExistingCreds as CredentialDoc[])
        : isObjCreds && Array.isArray((rawExistingCreds as any).documents)
        ? ((rawExistingCreds as any).documents as CredentialDoc[])
        : [];
      
      const mergedCreds = [...existingCreds];
      for (const cred of credentials) {
        const existingIdx = mergedCreds.findIndex(
          (c) =>
            (c.type && cred.type && c.type.toLowerCase() === cred.type.toLowerCase()) ||
            (c.path && cred.path && c.path === cred.path) ||
            (c.url && cred.url && c.url === cred.url)
        );
        if (existingIdx >= 0) {
          mergedCreds[existingIdx] = {
            ...mergedCreds[existingIdx],
            ...cred,
            url: cred.url || cred.path || mergedCreds[existingIdx].url || mergedCreds[existingIdx].path,
            path: cred.path || cred.url || mergedCreds[existingIdx].path || mergedCreds[existingIdx].url,
          };
        } else {
          mergedCreds.push(cred);
        }
      }

      const nextCredentialsJson = isObjCreds
        ? { ...(rawExistingCreds as Record<string, any>), documents: mergedCreds }
        : mergedCreds.length > 0
        ? (mergedCreds as any)
        : registerRecord.credentialsJson;

      registerRecord = await tx.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          classApplied: bioData.classApplied || registerRecord.classApplied,
          parentPhone: bioData.parentPhone || registerRecord.parentPhone,
          email: bioData.email || registerRecord.email,
          credentialsJson: nextCredentialsJson,
          status: registerRecord.status === "new" ? status : registerRecord.status,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new profile record in live AdmissionRegister (Status: DOCS_PENDING)
      const applicationNo = await generateApplicationNo(effectiveTenantId);
      registerRecord = await tx.admissionRegister.create({
        data: {
          tenantId: effectiveTenantId,
          applicationNo,
          firstName: bioData.firstName.trim(),
          lastName: bioData.lastName.trim(),
          classApplied: bioData.classApplied.trim(),
          parentPhone: bioData.parentPhone.trim(),
          email: bioData.email ? bioData.email.trim().toLowerCase() : null,
          credentialsJson: credentials.length > 0 ? (credentials as any) : null,
          status,
          verifiedBy: verifiedBy || null,
        },
      });
    }

    // Automatically update or flag corresponding record in AdmissionLeads to CONVERTED
    let leadTargetId = leadId || dupCheck.leadRecord?.id;
    if (!leadTargetId && registerRecord) {
      const matchLead = await tx.admissionLead.findFirst({
        where: {
          schoolId: effectiveTenantId,
          OR: [
            ...(bioData.email ? [{ studentEmail: bioData.email }, { parentEmail: bioData.email }] : []),
            ...(bioData.parentPhone ? [{ parentPhone: bioData.parentPhone }, { parentContact: bioData.parentPhone }] : []),
          ],
        },
      });
      if (matchLead) leadTargetId = matchLead.id;
    }

    let updatedLead = null;
    if (leadTargetId) {
      const currentLead = await tx.admissionLead.findUnique({
        where: { id: leadTargetId },
      });

      if (currentLead) {
        const existingLogs = Array.isArray(currentLead.logs) ? (currentLead.logs as any[]) : [];
        const updatedLogs = [
          ...existingLogs,
          {
            timestamp: new Date().toISOString(),
            action: "CONVERTED_TO_REGISTER",
            note: `Applicant bio-data and credentials transitioned to AdmissionRegister (${registerRecord.applicationNo}). Status: ${status.toUpperCase()}`,
            operator: verifiedBy || "System State Machine",
          },
        ];

        updatedLead = await tx.admissionLead.update({
          where: { id: leadTargetId },
          data: {
            status: "CONVERTED",
            logs: updatedLogs as any,
          },
        });
      }
    }

    return {
      registerRecord,
      leadRecord: updatedLead,
      isDeduplicated: Boolean(dupCheck.registerRecord),
    };
  });
}

/**
 * Store application in admission_registers table with tenantId scoping
 * Enforces pre-flight deduplication and funnel state machine
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

  const { effectiveTenantId } = await resolveTenantSchool(tenantId);
  const year = new Date().getFullYear();
  const credentialsJson: CredentialDoc[] = [];

  // File upload to storage/app/public/tenants/{tenantId}/admissions/{year}/{applicationNo}/
  if (files && files.length > 0) {
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "tenants",
      effectiveTenantId,
      "admissions",
      String(year),
      `${firstName}-${lastName}`.replace(/[^a-zA-Z0-9_-]/g, "_")
    );

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const sanitizedFilename = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const fullPath = path.join(uploadDir, sanitizedFilename);
      fs.writeFileSync(fullPath, file.buffer);

      const publicRelativePath = `/uploads/tenants/${effectiveTenantId}/admissions/${year}/${firstName}-${lastName}/${sanitizedFilename}`;
      credentialsJson.push({
        type: file.type,
        path: publicRelativePath,
        url: publicRelativePath,
        fileUrl: publicRelativePath,
        originalName: file.originalName || file.filename,
        verified: false,
      });
    }
  }

  // Execute atomic state machine transaction with deduplication guard
  const result = await executeLeadToRegisterTransition({
    tenantId: effectiveTenantId,
    bioData: {
      firstName,
      lastName,
      classApplied,
      parentPhone,
      email,
    },
    credentials: credentialsJson,
    status: "docs_pending",
  });

  return result.registerRecord;
}

/**
 * Get all applications scoped by tenantId and optional status
 * Auto-syncs and transitions active CRM leads to CONVERTED
 */
export async function getAllApplications({
  tenantId,
  status,
}: {
  tenantId: string;
  status?: string;
}) {
  try {
    const { effectiveTenantId, school } = await resolveTenantSchool(tenantId);

    const tenantIdsToMatch = Array.from(
      new Set(
        [
          effectiveTenantId,
          school?.id,
          school?.subdomain,
          school?.slug,
          tenantId,
        ].filter(Boolean) as string[]
      )
    );

    // Auto-sync active applicant profiles from admissionLead into live admissionRegister
    try {
      const activeLeads = await basePrisma.admissionLead.findMany({
        where: {
          schoolId: { in: tenantIdsToMatch },
          status: { notIn: ["CONVERTED", "DELETED", "deleted"] },
          OR: [
            { status: { in: ["APPLIED", "INTERVIEW", "APPROVED", "ENROLLED"] } },
            { passportPhotoUrl: { not: null } },
            { academicResultsUrl: { not: null } },
            { birthCertificateUrl: { not: null } },
            { medicalRecordsUrl: { not: null } },
            { offerToken: { not: null } },
          ],
        },
      });

      for (const lead of activeLeads) {
        const appNo = `APP-${lead.id.slice(0, 8).toUpperCase()}`;
        const nameParts = (lead.applicantName || "Applicant").trim().split(" ");
        const firstName = nameParts[0] || "Student";
        const lastName = nameParts.slice(1).join(" ") || "Applicant";

        let regStatus = "docs_pending";
        if (lead.status === "ENROLLED") regStatus = "admitted";
        else if (lead.status === "APPROVED") regStatus = "approved";
        else if (lead.status === "INTERVIEW") regStatus = "under_review";
        else if (lead.status === "APPLIED") regStatus = "docs_pending";

        const creds: any[] = [];
        if (lead.passportPhotoUrl) creds.push({ type: "passport", docType: "passportPhoto", path: lead.passportPhotoUrl, url: lead.passportPhotoUrl, verified: lead.status === "ENROLLED" });
        if (lead.academicResultsUrl) creds.push({ type: "result", docType: "academicResults", path: lead.academicResultsUrl, url: lead.academicResultsUrl, verified: lead.status === "ENROLLED" });
        if (lead.birthCertificateUrl) creds.push({ type: "birth_cert", docType: "birthCertificate", path: lead.birthCertificateUrl, url: lead.birthCertificateUrl, verified: lead.status === "ENROLLED" });
        if (lead.medicalRecordsUrl) creds.push({ type: "medical", docType: "medicalRecords", path: lead.medicalRecordsUrl, url: lead.medicalRecordsUrl, verified: lead.status === "ENROLLED" });

        await basePrisma.$transaction([
          basePrisma.admissionRegister.upsert({
            where: { applicationNo: appNo },
            create: {
              tenantId: effectiveTenantId,
              applicationNo: appNo,
              firstName,
              lastName,
              classApplied: lead.targetGrade || "N/A",
              parentPhone: lead.parentPhone || lead.parentContact || "N/A",
              email: lead.studentEmail || lead.parentEmail || null,
              status: regStatus,
              credentialsJson: creds.length > 0 ? (creds as any) : null,
              admittedAt: lead.status === "ENROLLED" ? lead.updatedAt : null,
              verifiedAt: ["ENROLLED", "APPROVED"].includes(lead.status) ? lead.updatedAt : null,
              verifiedBy: ["ENROLLED", "APPROVED"].includes(lead.status) ? "Admissions Officer" : null,
              createdAt: lead.createdAt,
              updatedAt: lead.updatedAt,
            },
            update: {
              status: regStatus,
              classApplied: lead.targetGrade || "N/A",
              parentPhone: lead.parentPhone || lead.parentContact || "N/A",
              email: lead.studentEmail || lead.parentEmail || null,
              credentialsJson: creds.length > 0 ? (creds as any) : undefined,
            },
          }),
          basePrisma.admissionLead.update({
            where: { id: lead.id },
            data: {
              status: "CONVERTED",
            },
          }),
        ]).catch((err) => {
          console.warn("[ENROLLMENT_CONTROLLER] Skip auto-sync for lead " + lead.id + ":", err);
        });
      }
    } catch (syncErr) {
      console.warn("[ENROLLMENT_CONTROLLER] Auto-sync active leads to admission_registers:", syncErr);
    }

    const where: any = {
      tenantId: tenantIdsToMatch.length === 1 ? tenantIdsToMatch[0] : { in: tenantIdsToMatch },
    };
    if (status && status !== "ALL") {
      if (status.includes(",")) {
        where.status = { in: status.split(",").map((s) => s.trim()) };
      } else {
        where.status = status;
      }
    } else {
      where.status = { notIn: ["DELETED", "deleted"] };
    }

    const applications = await basePrisma.admissionRegister.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }).catch(() => []);

    const { resolveCanonicalDocuments } = await import("@/lib/admissions.service");
    return (applications ?? []).map((app) => ({
      ...app,
      resolvedDocuments: resolveCanonicalDocuments ? resolveCanonicalDocuments(app) : [],
    }));
  } catch (err) {
    console.error("[ENROLLMENT_CONTROLLER] getAllApplications error:", err);
    return [];
  }
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
  const { effectiveTenantId } = await resolveTenantSchool(tenantId);

  const applicant = await basePrisma.admissionRegister.findFirst({
    where: {
      tenantId: effectiveTenantId,
      OR: [{ id }, { applicationNo: id }],
    },
  });

  if (!applicant) return null;

  const { resolveCanonicalDocuments } = await import("@/lib/admissions.service");
  return {
    ...applicant,
    resolvedDocuments: resolveCanonicalDocuments(applicant),
  };
}

/**
 * Verify document in credentials_json
 * Enforces RBAC permissions check
 */
export async function verifyDocument({
  id,
  tenantId,
  docType,
  verified = true,
  verifiedBy,
  userRole,
  staffRole,
}: {
  id: string;
  tenantId: string;
  docType: string;
  verified?: boolean;
  verifiedBy?: string;
  userRole?: string | null;
  staffRole?: string | null;
}) {
  // Enforce RBAC
  if (userRole || staffRole) {
    assertAdmissionsAuthorized(userRole, staffRole, "Mark Verified");
  }

  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  let rawCreds: any = applicant.credentialsJson;
  let isObj = false;
  let docs: any[] = [];
  if (Array.isArray(rawCreds)) {
    docs = rawCreds;
  } else if (rawCreds && typeof rawCreds === "object") {
    isObj = true;
    docs = Array.isArray(rawCreds.documents) ? rawCreds.documents : [];
  }

  const updatedDocs = docs.map((doc: any) => {
    const k = (doc.type || doc.docType || doc.originalName || doc.key || "").toLowerCase();
    const target = (docType || "").toLowerCase();
    if (k === target || k.includes(target) || target.includes(k)) {
      return { ...doc, verified };
    }
    return doc;
  });

  const mandatoryUpdatedDocs = updatedDocs.filter((d: any) => !d.isOptional && d.key !== "medicalReport" && d.type !== "medicalReport" && d.docType !== "medicalReport");
  const allVerified = mandatoryUpdatedDocs.length > 0 && mandatoryUpdatedDocs.every((d) => d.verified);
  const updatedCreds = isObj ? { ...rawCreds, documents: updatedDocs } : updatedDocs;

  const updated = await basePrisma.admissionRegister.update({
    where: { id: applicant.id },
    data: {
      credentialsJson: updatedCreds as any,
      verifiedBy: verifiedBy || applicant.verifiedBy || "Admissions Officer",
      verifiedAt: verified ? new Date() : applicant.verifiedAt,
      status: allVerified ? "under_review" : applicant.status,
    },
  });

  return updated;
}

/**
 * Admit applicant:
 * 1. Validates RBAC permissions
 * 2. Updates admission_registers status to 'admitted' and sets admittedAt (audit record kept)
 * 3. Creates the student record in Student table with tenantId scoping
 */
export async function admitApplicant({
  id,
  tenantId,
  verifiedBy,
  userRole,
  staffRole,
}: {
  id: string;
  tenantId: string;
  verifiedBy?: string;
  userRole?: string | null;
  staffRole?: string | null;
}) {
  // Enforce RBAC
  if (userRole || staffRole) {
    assertAdmissionsAuthorized(userRole, staffRole, "Convert to Student");
  }

  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  const rawCreds = applicant.credentialsJson;
  let creds: any[] = [];
  if (Array.isArray(rawCreds)) {
    creds = rawCreds;
  } else if (rawCreds && typeof rawCreds === "object") {
    creds = Array.isArray((rawCreds as any).documents) ? (rawCreds as any).documents : Object.values(rawCreds);
  }
  if (creds.length === 0 && !applicant.resolvedDocuments?.some((d: any) => d.hasFile)) {
    throw new Error("Documents not uploaded yet. Complete credential verification before admission.");
  }

  // 1. Update audit record status in admission_registers (DO NOT DELETE)
  const updatedAdmission = await basePrisma.admissionRegister.update({
    where: { id: applicant.id },
    data: {
      status: "admitted",
      admittedAt: new Date(),
      verifiedBy: verifiedBy || applicant.verifiedBy || "Admissions Officer",
    },
  });

  // 2. Resolve School Tenant for Student placement
  const { effectiveTenantId, school } = await resolveTenantSchool(tenantId);
  const tenantDb = getTenantClient(effectiveTenantId);

  // 3. Resolve Classroom or Tier
  const tier =
    school?.academicTiers?.[0] ||
    (await basePrisma.academicTier.findFirst({ where: { schoolId: effectiveTenantId } }));

  const studentData: any = {
    schoolId: effectiveTenantId,
    admissionNumber: applicant.applicationNo,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    currentClass: applicant.classApplied,
    status: "ENROLLED",
    parentPhone: applicant.parentPhone,
    parentName: `${applicant.lastName} Family`,
    enrolledAt: new Date(),
  };

  if (tier?.id) {
    studentData.tierId = tier.id;
  }
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
        schoolId: effectiveTenantId,
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
        console.error(`[EMAIL_SYNC_ERROR] Failed to send enrollment confirmation to ${applicant.email}:`, emailResult.error);
      }
    } catch (emailErr) {
      console.error("[EMAIL_SYNC_ERROR] Error sending enrollment confirmation email:", emailErr);
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
 * Enforces RBAC permissions check
 */
export async function rejectApplicant({
  id,
  tenantId,
  reason,
  documentType,
  userRole,
  staffRole,
}: {
  id: string;
  tenantId: string;
  reason?: string;
  documentType?: string;
  userRole?: string | null;
  staffRole?: string | null;
}) {
  // Enforce RBAC
  if (userRole || staffRole) {
    assertAdmissionsAuthorized(userRole, staffRole, "Reject File");
  }

  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  const { effectiveTenantId } = await resolveTenantSchool(tenantId);

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
        schoolId: effectiveTenantId,
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
        schoolId: effectiveTenantId,
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
 * Enforces RBAC permissions check
 */
export async function updateApplicantStatus({
  id,
  tenantId,
  status,
  verifiedBy,
  reason,
  documentType,
  userRole,
  staffRole,
}: {
  id: string;
  tenantId: string;
  status: string;
  verifiedBy?: string;
  reason?: string;
  documentType?: string;
  userRole?: string | null;
  staffRole?: string | null;
}) {
  // Enforce RBAC
  if (userRole || staffRole) {
    assertAdmissionsAuthorized(userRole, staffRole, "Update Applicant Status");
  }

  const applicant = await getApplicationById({ id, tenantId });
  if (!applicant) {
    throw new Error("Applicant not found for tenant");
  }

  const { effectiveTenantId } = await resolveTenantSchool(tenantId);

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
          schoolId: effectiveTenantId,
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
          schoolId: effectiveTenantId,
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
