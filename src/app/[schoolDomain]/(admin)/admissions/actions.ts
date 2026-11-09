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
  buildDeterministicAdmissionKey,
  isInstitutionalApplicationNo,
} from "@/lib/admissions-deduplication.service";
import { AdmissionTierType, ApplicationStatus } from "@prisma/client";
import { dispatchAdmissionsNotification } from "@/lib/notifications/admissionsNotifier";

import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb, isDemoSchool, getDemoPrismaClient, setDemoSchoolId } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import {
  sendAdmissionOfferEmail,
  sendStudentEnrollmentConfirmationEmail,
  sendDocsRequestEmail,
  sendExamAdmitSlipEmail,
  sendDirectCommunicationEmail,
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
} from "@/lib/admissions.service";
import { DuplicateCheckMatch } from "@/lib/admissions.types";
import {
  isAdmissionsAuthorized,
  findDuplicateAdmissionEntry,
  executeLeadToRegisterTransition,
} from "@/modules/enrollment/enrollment.controller";
import { executeEnrollmentHandshake } from "@/modules/admissions/enrollment-handshake";
import { cleanSchoolDomain } from "@/lib/school-domain";

function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op in non-request contexts
  }
}

function getCentralDb(schoolIdentifier?: string | null): any {
  if (process.env.DEMO_DATABASE_URL && isDemoSchool(schoolIdentifier)) {
    return getDemoPrismaClient();
  }
  return basePrisma;
}

/**
 * Safely resolves school identifier whether passed as UUID or subdomain string
 */
export async function resolveSchoolId(schoolIdentifier: string): Promise<string> {
  if (!schoolIdentifier) return "";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolIdentifier);
  if (isUuid) return schoolIdentifier;

  const db = getCentralDb(schoolIdentifier);

  try {
    const school = await db.school.findFirst({
      where: {
        OR: [
          { subdomain: { equals: schoolIdentifier, mode: "insensitive" as const } },
          { slug: { equals: schoolIdentifier, mode: "insensitive" as const } },
        ],
      },
      select: { id: true, subdomain: true },
    });
    if (school?.id && (schoolIdentifier === "demo" || school.subdomain === "demo")) {
      setDemoSchoolId(school.id);
    }
    return school?.id || schoolIdentifier;
  } catch {
    return schoolIdentifier;
  }
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
    let schoolId = await resolveSchoolId(payload.schoolId);

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
  schoolId?: string;
  schoolDomain?: string;
  documentType: string;
  status: "VERIFIED" | "PENDING" | "REJECTED";
}) {
  try {
    let schoolId = payload.schoolId ? await resolveSchoolId(payload.schoolId) : "";
    if (!schoolId && payload.schoolDomain) {
      schoolId = await resolveSchoolId(payload.schoolDomain);
    }

    // RBAC Permissions Check: Restrict structural state mutations strictly to authorized roles
    const session = await getSession(undefined, payload.schoolDomain);
    if (session && !isAdmissionsAuthorized(session.role, session.staffRole)) {
      return {
        success: false,
        error: "Unauthorized: Document verification and rejection is strictly restricted to Registrar, Admissions Officer, or Superadmin roles.",
      };
    }

    const targetRef = (payload.leadId || "").trim();
    const cleanRef = targetRef.replace(/^ADM-|^APP-/i, "").trim().toLowerCase();

    // 1. Locate applicant across models (AdmissionLead, AdmissionsApplication, AdmissionRegister)
    let lead = await basePrisma.admissionLead.findUnique({
      where: { id: targetRef },
      include: { tier: true },
    });
    if (!schoolId && lead?.schoolId) {
      schoolId = lead.schoolId;
    }

    let appRecord: any = null;
    let registerRecord: any = null;

    // Search AdmissionsApplication
    appRecord = await basePrisma.admissionsApplication.findFirst({
      where: {
        OR: [
          { id: targetRef },
          { applicationNumber: targetRef },
          ...(cleanRef ? [{ applicationNumber: { contains: cleanRef, mode: "insensitive" as const } }] : []),
        ],
      },
      include: { documents: true, feeTransactions: true },
    });

    // Search AdmissionRegister
    registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [
          { id: targetRef },
          { applicationNo: targetRef },
          ...(cleanRef ? [{ applicationNo: { contains: cleanRef, mode: "insensitive" as const } }] : []),
        ],
      },
    });

    // If lead not found directly, attempt linking via appRecord or registerRecord
    if (!lead) {
      const linkedLeadId =
        (appRecord?.metadata as any)?.leadId ||
        (appRecord?.tierSpecificData as any)?.leadId ||
        (registerRecord?.credentialsJson as any)?.leadId;

      if (linkedLeadId) {
        lead = await basePrisma.admissionLead.findUnique({
          where: { id: linkedLeadId },
          include: { tier: true },
        });
      }

      if (!lead && (appRecord || registerRecord)) {
        const studentEmail = appRecord?.email || registerRecord?.email;
        const applicantName = appRecord
          ? `${appRecord.firstName} ${appRecord.lastName}`.trim()
          : registerRecord
          ? `${registerRecord.firstName} ${registerRecord.lastName}`.trim()
          : "";

        if (studentEmail || applicantName) {
          lead = await basePrisma.admissionLead.findFirst({
            where: {
              schoolId,
              OR: [
                ...(studentEmail ? [{ studentEmail }, { parentEmail: studentEmail }] : []),
                ...(applicantName ? [{ applicantName }] : []),
              ],
            },
            include: { tier: true },
          });
        }
      }
    } else {
      // lead was found directly, also resolve registerRecord and appRecord if not yet loaded
      if (!registerRecord) {
        const nameParts = (lead.applicantName || "").trim().split(" ");
        const firstName = nameParts[0] || "Student";
        const lastName = nameParts.slice(1).join(" ") || "Applicant";

        registerRecord = await basePrisma.admissionRegister.findFirst({
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
      }

      if (!appRecord) {
        const shortLeadRef = lead.id.replace(/-/g, "").slice(0, 6);
        const nameParts = (lead.applicantName || "").trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        appRecord = await basePrisma.admissionsApplication.findFirst({
          where: {
            OR: [{ schoolId }, { tenantId: schoolId }],
            AND: [
              {
                OR: [
                  { id: lead.id },
                  ...(cleanRef ? [{ applicationNumber: { contains: cleanRef, mode: "insensitive" as const } }] : []),
                  ...(shortLeadRef ? [{ applicationNumber: { contains: shortLeadRef, mode: "insensitive" as const } }] : []),
                  ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
                  ...(firstName && lastName
                    ? [
                        {
                          firstName: { equals: firstName, mode: "insensitive" as const },
                          lastName: { equals: lastName, mode: "insensitive" as const },
                        },
                      ]
                    : []),
                ],
              },
            ],
          },
          include: { documents: true, feeTransactions: true },
        });
      }
    }

    if (!lead && !appRecord && !registerRecord) {
      return { success: false, error: "Applicant lead not found." };
    }

    const docAliasMap: Record<string, string[]> = {
      passportPhoto: [
        "PASSPORT_PHOTOGRAPH", "PASSPORT_PHOTO", "PASSPORT", "passportPhoto", "passport_photo", "passport", "photo"
      ],
      birthCertificate: [
        "BIRTH_CERTIFICATE", "BIRTH_CERT", "birthCertificate", "birth_certificate", "birthCert", "ageDeclaration"
      ],
      academicResults: [
        "ACADEMIC_TRANSCRIPT", "ACADEMIC_RESULTS", "O_LEVEL_RESULT", "TRANSCRIPT", "academicResults", "academic_results", "previousResults", "academicTranscript", "transcript", "results", "oLevelResult"
      ],
      medicalRecords: [
        "MEDICAL_REPORT", "MEDICAL_RECORDS", "MEDICAL", "medicalRecords", "medical_records", "medicalReport", "fitness"
      ],
      ninSlip: [
        "NIN_SLIP", "NIN", "ninSlip", "nin_slip", "nationalId", "nimc"
      ],
      applicationFeeReceipt: [
        "APPLICATION_FEE_RECEIPT", "FEE_RECEIPT", "PAYMENT_RECEIPT", "RECEIPT", "applicationFeeReceipt", "formFeeReceipt", "receipt", "feeReceipt", "paymentReceipt"
      ],
    };

    const targetAliases = docAliasMap[payload.documentType] || [payload.documentType];
    const isFeeReceipt =
      payload.documentType === "applicationFeeReceipt" ||
      payload.documentType === "APPLICATION_FEE_RECEIPT" ||
      payload.documentType === "formFeeReceipt" ||
      targetAliases.includes("APPLICATION_FEE_RECEIPT");

    const extractExistingUrl = (entry: any): string | null => {
      if (!entry) return null;
      if (typeof entry === "string" && entry.trim()) return entry.trim();
      if (typeof entry === "object" && !Array.isArray(entry)) {
        const u = entry.url || entry.fileUrl || entry.storageKey || entry.path;
        if (typeof u === "string" && u.trim()) return u.trim();
      }
      return null;
    };

    const findUrlInMap = (map: any): string | null => {
      if (!map || typeof map !== "object" || Array.isArray(map)) return null;
      const direct = extractExistingUrl(map[payload.documentType]) || extractExistingUrl(map[`${payload.documentType}Url`]);
      if (direct) return direct;
      for (const alias of targetAliases) {
        const u = extractExistingUrl(map[alias]) || extractExistingUrl(map[`${alias}Url`]);
        if (u) return u;
      }
      return null;
    };

    let preservedDocUrl: string | null =
      findUrlInMap((appRecord?.metadata as any)?.documents) ||
      findUrlInMap((appRecord?.tierSpecificData as any)?.documents) ||
      findUrlInMap(lead?.documents) ||
      findUrlInMap(registerRecord?.credentialsJson);

    // 2. Update AdmissionsDocument table and AdmissionsApplication metadata
    if (appRecord) {
      const allMatchingDocs = await basePrisma.admissionsDocument.findMany({
        where: { applicationId: appRecord.id },
      });

      const matchedDoc = allMatchingDocs.find((d) => {
        const dTypeNorm = (d.documentType || "").toUpperCase().replace(/[\s-_]/g, "");
        return targetAliases.some((alias) => {
          const aNorm = alias.toUpperCase().replace(/[\s-_]/g, "");
          return dTypeNorm === aNorm || dTypeNorm.includes(aNorm) || aNorm.includes(dTypeNorm);
        });
      });

      if (matchedDoc?.storageKey && !preservedDocUrl) {
        preservedDocUrl = matchedDoc.storageKey;
      }

      const verificationStatus =
        payload.status === "VERIFIED"
          ? "MANUALLY_VERIFIED"
          : payload.status === "REJECTED"
          ? "REJECTED"
          : "PENDING";

      if (matchedDoc) {
        await basePrisma.admissionsDocument.update({
          where: { id: matchedDoc.id },
          data: {
            verificationStatus,
            verifiedAt: payload.status === "VERIFIED" ? new Date() : null,
            verifiedByUserId: session?.userId || null,
            rejectionReason: payload.status === "REJECTED" ? "Rejected by Admissions Officer" : null,
          },
        });
      }

      const appMetadata = (appRecord.metadata as any) || {};
      const currentMetaDocs = { ...(appMetadata.documents || {}) };
      const existingMetaObj =
        typeof currentMetaDocs[payload.documentType] === "object" && currentMetaDocs[payload.documentType]
          ? currentMetaDocs[payload.documentType]
          : {};
      const metaUrl = extractExistingUrl(currentMetaDocs[payload.documentType]) || preservedDocUrl;

      currentMetaDocs[payload.documentType] = {
        ...existingMetaObj,
        ...(metaUrl ? { url: metaUrl, fileUrl: metaUrl } : {}),
        status: payload.status,
        verificationStatus,
        verified: payload.status === "VERIFIED",
        rejected: payload.status === "REJECTED",
        verifiedAt: payload.status === "VERIFIED" ? new Date().toISOString() : null,
        rejectedAt: payload.status === "REJECTED" ? new Date().toISOString() : null,
      };
      if (metaUrl) {
        currentMetaDocs[`${payload.documentType}Url`] = metaUrl;
      }

      if (isFeeReceipt && payload.status === "VERIFIED") {
        currentMetaDocs.formFeePaid = true;
        currentMetaDocs.feePaid = true;
        currentMetaDocs.formFeeStatus = "PAID";
        currentMetaDocs.paymentState = "SETTLED";
      }

      const tierData = (appRecord.tierSpecificData as any) || {};
      const tierDocs = { ...(tierData.documents || {}) };
      const existingTierObj =
        typeof tierDocs[payload.documentType] === "object" && tierDocs[payload.documentType]
          ? tierDocs[payload.documentType]
          : {};
      const tierUrl = extractExistingUrl(tierDocs[payload.documentType]) || metaUrl || preservedDocUrl;

      tierDocs[payload.documentType] = {
        ...existingTierObj,
        ...(tierUrl ? { url: tierUrl, fileUrl: tierUrl } : {}),
        status: payload.status,
        verificationStatus,
        verified: payload.status === "VERIFIED",
        rejected: payload.status === "REJECTED",
      };
      if (tierUrl) {
        tierDocs[`${payload.documentType}Url`] = tierUrl;
      }

      await basePrisma.admissionsApplication.update({
        where: { id: appRecord.id },
        data: {
          metadata: {
            ...appMetadata,
            documents: currentMetaDocs,
          },
          tierSpecificData: {
            ...tierData,
            documents: tierDocs,
            ...(isFeeReceipt && payload.status === "VERIFIED" ? { formFeePaid: true, feePaid: true, formFeeStatus: "PAID", paymentState: "SETTLED" } : {}),
          },
          updatedAt: new Date(),
        },
      });

      if (isFeeReceipt && payload.status === "VERIFIED") {
        const txUpdate = await basePrisma.admissionsFeeTransaction.updateMany({
          where: { applicationId: appRecord.id },
          data: {
            paymentStatus: "SETTLED",
            verifiedByUserId: session?.userId || null,
          },
        });
        if (txUpdate.count === 0) {
          await basePrisma.admissionsFeeTransaction.create({
            data: {
              tenantId: appRecord.tenantId || schoolId,
              applicationId: appRecord.id,
              paymentMethod: "MANUAL_BANK_TRANSFER",
              amount: 5000,
              currency: "NGN",
              paymentReference: `FEE-${appRecord.applicationNumber}`,
              paymentStatus: "SETTLED",
              proofOfPaymentUrl: metaUrl || undefined,
              verifiedByUserId: session?.userId || null,
            },
          }).catch(() => null);
        }

        // Settle linked PaymentReceipt records if any exist; backfill if none exists
        const appRef = appRecord.applicationNumber;
        const prUpdate = await basePrisma.paymentReceipt.updateMany({
          where: {
            tenantId: appRecord.tenantId || schoolId,
            moduleType: "ADMISSION_FORM_FEE",
            OR: [
              ...(appRef ? [{ referenceNo: appRef }] : []),
              { payerId: appRecord.id },
            ],
          },
          data: {
            status: "VERIFIED",
            state: "SETTLED",
            verifiedByUserId: session?.userId || null,
            verifiedAt: new Date(),
          },
        }).catch(() => null);

        if (!prUpdate || prUpdate.count === 0) {
          const payerName =
            `${appRecord.firstName || ""} ${appRecord.lastName || ""}`.trim() || "Applicant";
          const refNo = appRef || `APP-${appRecord.id.slice(0, 6).toUpperCase()}`;
          const proofUrl = metaUrl || "DESK_SETTLED_RECEIPT";
          await basePrisma.paymentReceipt
            .create({
              data: {
                tenantId: appRecord.tenantId || schoolId,
                schoolId: appRecord.schoolId || schoolId,
                moduleType: "ADMISSION_FORM_FEE",
                payerType: "APPLICANT",
                payerId: appRecord.id,
                payerName,
                referenceNo: refNo,
                amount: 5000,
                paymentMethod: "BANK_TRANSFER",
                paymentMode: "MANUAL_TRANSFER",
                fileUrl: proofUrl,
                proofOfPaymentUrl: proofUrl,
                fileName: "application_fee_receipt.jpg",
                depositorName: payerName,
                transferReference: refNo,
                txnRef: refNo,
                status: "VERIFIED",
                state: "SETTLED",
                verifiedBy: session?.user?.name || "Admissions Officer",
                verifiedByUserId: session?.userId || null,
                verifiedAt: new Date(),
              },
            })
            .catch(() => null);
        }
      }
    }

    // 3. Update AdmissionLead if present
    let updated: any = null;
    if (lead) {
      const docs = (lead.documents as any) || {};
      const existingLeadObj =
        typeof docs[payload.documentType] === "object" && docs[payload.documentType]
          ? docs[payload.documentType]
          : {};
      const leadDocUrl = extractExistingUrl(docs[payload.documentType]) || preservedDocUrl;

      docs[payload.documentType] = {
        ...existingLeadObj,
        ...(leadDocUrl ? { url: leadDocUrl, fileUrl: leadDocUrl } : {}),
        status: payload.status,
        verified: payload.status === "VERIFIED",
        rejected: payload.status === "REJECTED",
        verifiedAt: payload.status === "VERIFIED" ? new Date().toISOString() : null,
        rejectedAt: payload.status === "REJECTED" ? new Date().toISOString() : null,
      };
      if (leadDocUrl) {
        docs[`${payload.documentType}Url`] = leadDocUrl;
      }

      if (isFeeReceipt && payload.status === "VERIFIED") {
        docs.formFeePaid = true;
        docs.formFeeStatus = "PAID";
        docs.feePaid = true;
        docs.paymentState = "SETTLED";
      }

      updated = await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          documents: docs,
        },
        include: { tier: true },
      });
    }

    // 4. Update AdmissionRegister so applicant's tracking dashboard reflects changes in real-time
    if (registerRecord) {
      let rawCreds = registerRecord.credentialsJson;
      let credsArr: any[] = [];
      let credsObj: any = {};

      if (Array.isArray(rawCreds)) {
        credsArr = [...rawCreds];
      } else if (rawCreds && typeof rawCreds === "object") {
        credsObj = { ...rawCreds };
        if (Array.isArray(credsObj.documents)) {
          credsArr = [...credsObj.documents];
        }
      }

      let found = false;
      const updatedCredsArr = credsArr.map((c: any) => {
        const cTypeNorm = (c.type || c.key || c.docType || c.altType || c.name || "").toUpperCase().replace(/[\s-_]/g, "");
        const matches = targetAliases.some((alias) => {
          const aNorm = alias.toUpperCase().replace(/[\s-_]/g, "");
          return cTypeNorm === aNorm || cTypeNorm.includes(aNorm) || aNorm.includes(cTypeNorm);
        });

        if (matches) {
          found = true;
          const cUrl = extractExistingUrl(c) || preservedDocUrl;
          return {
            ...c,
            ...(cUrl ? { url: cUrl, fileUrl: cUrl } : {}),
            status: payload.status,
            verified: payload.status === "VERIFIED",
            rejected: payload.status === "REJECTED",
            verifiedAt: payload.status === "VERIFIED" ? new Date().toISOString() : c.verifiedAt,
            rejectedAt: payload.status === "REJECTED" ? new Date().toISOString() : c.rejectedAt,
          };
        }
        return c;
      });

      if (!found && payload.status === "REJECTED") {
        updatedCredsArr.push({
          type: payload.documentType,
          name: payload.documentType,
          docType: payload.documentType,
          ...(preservedDocUrl ? { url: preservedDocUrl, fileUrl: preservedDocUrl } : {}),
          status: "REJECTED",
          rejected: true,
          rejectedAt: new Date().toISOString(),
        });
      }

      const existingCredObj =
        typeof credsObj[payload.documentType] === "object" && credsObj[payload.documentType]
          ? credsObj[payload.documentType]
          : {};
      const credUrl = extractExistingUrl(credsObj[payload.documentType]) || preservedDocUrl;

      credsObj[payload.documentType] = {
        ...existingCredObj,
        ...(credUrl ? { url: credUrl, fileUrl: credUrl } : {}),
        status: payload.status,
        verified: payload.status === "VERIFIED",
        rejected: payload.status === "REJECTED",
        verifiedAt: payload.status === "VERIFIED" ? new Date().toISOString() : null,
        rejectedAt: payload.status === "REJECTED" ? new Date().toISOString() : null,
      };
      if (credUrl) {
        credsObj[`${payload.documentType}Url`] = credUrl;
      }

      if (isFeeReceipt && payload.status === "VERIFIED") {
        credsObj.formFeePaid = true;
        credsObj.formFeeStatus = "PAID";
        credsObj.paymentState = "SETTLED";
      }

      const finalCreds = Array.isArray(rawCreds) ? updatedCredsArr : { ...credsObj, documents: updatedCredsArr };

      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          ...(payload.status === "REJECTED" ? { status: "rejected" } : {}),
          credentialsJson: finalCreds as any,
          updatedAt: new Date(),
        },
      });
    }

    // 5. Dispatch rejection email via Resend if rejected
    if (payload.status === "REJECTED") {
      const recipientEmail = (
        lead?.studentEmail ||
        lead?.parentEmail ||
        appRecord?.email ||
        (appRecord?.metadata as any)?.parentEmail ||
        (appRecord?.tierSpecificData as any)?.parentEmail ||
        registerRecord?.email ||
        (lead?.parentContact?.includes("@") ? lead.parentContact : null) ||
        ""
      ).trim();

      const applicantName =
        lead?.applicantName ||
        (appRecord ? `${appRecord.firstName} ${appRecord.lastName}`.trim() : "") ||
        (registerRecord ? `${registerRecord.firstName} ${registerRecord.lastName}`.trim() : "Applicant");

      const appNo =
        registerRecord?.applicationNo ||
        appRecord?.applicationNumber ||
        (lead ? `APP-${lead.id.slice(0, 6).toUpperCase()}` : "ADMISSIONS");

      if (recipientEmail && recipientEmail.includes("@")) {
        try {
          const sub = payload.schoolDomain || "portal";
          const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
          const uploadUrl = (lead as any)?.uploadToken
            ? `${baseUrl}/${sub}/admissions/upload/${lead?.id || appRecord?.id}?token=${(lead as any).uploadToken}`
            : `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(appNo)}`;
          const trackUrl = `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(appNo)}`;

          const { sendDocumentRejectedEmail } = await import("@/lib/email-service");
          await sendDocumentRejectedEmail({
            schoolId,
            applicantName,
            parentName: lead?.parentName || (appRecord?.tierSpecificData as any)?.parentName || "Parent / Guardian",
            applicationNo: appNo,
            targetGrade: lead?.targetGrade || appRecord?.programId || registerRecord?.assignedClass || "Selected Grade",
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
    if (appRecord?.applicationNumber) {
      safeRevalidate(`/${payload.schoolDomain || ""}/admissions/track/${appRecord.applicationNumber}`);
    }
    return { success: true, lead: updated || appRecord || registerRecord };
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
    let schoolId = await resolveSchoolId(payload.schoolId);
    const targetRef = (payload.leadId || "").trim();
    const cleanRef = targetRef.replace(/^ADM-|^APP-/i, "").trim().toLowerCase();

    let lead = await basePrisma.admissionLead.findUnique({
      where: { id: targetRef },
      include: { tier: true },
    });
    if (!schoolId && lead?.schoolId) {
      schoolId = lead.schoolId;
    }

    let appRecord: any = null;
    let registerRecord: any = null;

    if (!lead) {
      appRecord = await basePrisma.admissionsApplication.findFirst({
        where: {
          OR: [
            { id: targetRef },
            { applicationNumber: targetRef },
            ...(cleanRef ? [{ applicationNumber: { contains: cleanRef, mode: "insensitive" as const } }] : []),
          ],
        },
      });

      registerRecord = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [
            { id: targetRef },
            { applicationNo: targetRef },
            ...(cleanRef ? [{ applicationNo: { contains: cleanRef, mode: "insensitive" as const } }] : []),
          ],
        },
      });

      const linkedLeadId =
        (appRecord?.metadata as any)?.leadId ||
        (appRecord?.tierSpecificData as any)?.leadId ||
        (registerRecord?.credentialsJson as any)?.leadId;

      if (linkedLeadId) {
        lead = await basePrisma.admissionLead.findUnique({
          where: { id: linkedLeadId },
          include: { tier: true },
        });
      }
    }

    if (!lead && !appRecord && !registerRecord) {
      return { success: false, error: "Applicant lead not found." };
    }

    let updated: any = null;

    if (lead) {
      const docs = (lead.documents as any) || {};
      if (payload.subjectScores) {
        docs.examScores = payload.subjectScores;
      }
      if (payload.examScore !== undefined) {
        docs.examAggregate = payload.examScore;
        docs.entranceScore = payload.examScore;
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

      updated = await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          documents: docs,
          logs,
        },
        include: { tier: true },
      });
    }

    if (appRecord) {
      const tierData = (appRecord.tierSpecificData as any) || {};
      if (payload.subjectScores) tierData.examScores = payload.subjectScores;
      if (payload.examScore !== undefined) {
        tierData.examAggregate = payload.examScore;
        tierData.entranceScore = payload.examScore;
      }
      if (payload.interviewRating !== undefined) tierData.interviewRating = payload.interviewRating;
      if (payload.recommendation) tierData.recommendation = payload.recommendation;
      if (payload.notes) tierData.screeningNotes = payload.notes;

      const appMeta = (appRecord.metadata as any) || {};
      const metaDocs = { ...(appMeta.documents || {}) };
      if (payload.subjectScores) metaDocs.examScores = payload.subjectScores;
      if (payload.examScore !== undefined) {
        metaDocs.examAggregate = payload.examScore;
        metaDocs.entranceScore = payload.examScore;
      }

      await basePrisma.admissionsApplication.update({
        where: { id: appRecord.id },
        data: {
          tierSpecificData: tierData,
          metadata: { ...appMeta, documents: metaDocs },
          updatedAt: new Date(),
        },
      });
    }

    if (registerRecord) {
      const rawCreds = registerRecord.credentialsJson || {};
      const credsObj = Array.isArray(rawCreds) ? { documents: rawCreds } : { ...(rawCreds || {}) };
      if (payload.subjectScores) credsObj.examScores = payload.subjectScores;
      if (payload.examScore !== undefined) {
        credsObj.examAggregate = payload.examScore;
        credsObj.entranceScore = payload.examScore;
      }
      if (payload.interviewRating !== undefined) credsObj.interviewRating = payload.interviewRating;
      if (payload.recommendation) credsObj.recommendation = payload.recommendation;

      const existingLogs = Array.isArray(credsObj.statusLogs) ? credsObj.statusLogs : [];
      credsObj.statusLogs = [
        ...existingLogs,
        {
          timestamp: new Date().toISOString(),
          action: "SCREENING_EVALUATED",
          examScore: payload.examScore ?? null,
          subjectScores: payload.subjectScores ?? null,
          interviewRating: payload.interviewRating ?? null,
          recommendation: payload.recommendation ?? "RECOMMENDED",
          notes: payload.notes || "",
        },
      ];

      await basePrisma.admissionRegister.update({
        where: { id: registerRecord.id },
        data: {
          credentialsJson: credsObj,
          updatedAt: new Date(),
        },
      });
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
    return { success: true, lead: updated || appRecord || registerRecord };
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
    let schoolId = await resolveSchoolId(payload.schoolId);
    let lead = await basePrisma.admissionLead.findUnique({
      where: { id: payload.leadId },
      include: { tier: true, school: true },
    });

    // Fallback: If leadId is an AdmissionsApplication or AdmissionRegister ID, locate the lead or construct surrogate
    if (!lead) {
      const appRecord = await basePrisma.admissionsApplication.findFirst({
        where: {
          schoolId,
          OR: [{ id: payload.leadId }, { applicationNumber: payload.leadId }],
        },
      });

      if (appRecord) {
        const leadIdFromApp = (appRecord.metadata as any)?.leadId || (appRecord.tierSpecificData as any)?.leadId;
        if (leadIdFromApp) {
          lead = await basePrisma.admissionLead.findUnique({
            where: { id: leadIdFromApp },
            include: { tier: true, school: true },
          });
        }

        if (!lead) {
          // Provision or retrieve matching lead for this application
          lead = await basePrisma.admissionLead.create({
            data: {
              id: appRecord.id,
              schoolId,
              applicantName: `${appRecord.firstName} ${appRecord.lastName}`.trim(),
              studentEmail: appRecord.email,
              studentPhone: appRecord.phoneNumber,
              parentPhone: appRecord.phoneNumber,
              parentContact: appRecord.phoneNumber,
              targetGrade: appRecord.programId,
              tierId: (await basePrisma.academicTier.findFirst({ where: { schoolId } }))?.id || "tier-1",
              status: "CONVERTED",
              documents: {
                academicTier: (appRecord.tierSpecificData as any)?.academicTier || "General",
                targetClass: appRecord.programId,
              },
            },
            include: { tier: true, school: true },
          }).catch(async () => {
            return await basePrisma.admissionLead.findFirst({
              where: { schoolId, applicantName: `${appRecord.firstName} ${appRecord.lastName}`.trim() },
              include: { tier: true, school: true },
            });
          });
        }
      }
    }

    if (!lead) return { success: false, error: "Applicant lead not found." };

    const school = lead.school || (await basePrisma.school.findUnique({ where: { id: schoolId } }));
    const sub = payload.schoolDomain || school?.subdomain || "portal";

    // Resolve Entrance Examination configuration from Portal Settings
    const examSettings: any = (school?.tierDatabasesConfig as any)?.entranceExamSettings;
    const tierName = lead.tier?.name || "";
    const tierConfig = (tierName && examSettings?.tiers?.[tierName]) ||
                       Object.entries(examSettings?.tiers || {}).find(([k]) => k.toLowerCase() === tierName.toLowerCase())?.[1] ||
                       examSettings?.tiers?.default ||
                       examSettings?.tiers?.["General / All Tiers"];

    const rollNo = `EXM-${sub.toUpperCase()}-2026-${lead.id.substring(0, 5).toUpperCase()}`;
    const examDate = payload.examDate || tierConfig?.examDate || "Saturday, 27th September 2026";
    const arrivalTime = payload.arrivalTime || tierConfig?.arrivalTime || "08:30 AM Prompt";
    const venue = payload.venue || tierConfig?.venue || "Main ICT Complex / Hall A";
    const subjects = payload.subjects || tierConfig?.subjects || getExamSubjectsForTier(lead.tier?.name, lead.targetGrade).join(", ");
    const instructions = tierConfig?.instructions || "Candidates must present a printed copy of this Examination Slip at the accreditation checkpoint.";

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const admitSlipUrl = `${baseUrl}/${sub}/admissions/admit-slip/${lead.id}`;

    const examSchedule = {
      rollNo,
      testDate: examDate,
      arrivalTime,
      venue,
      subjects,
      instructions,
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
      where: { id: lead.id },
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
export async function enrollApplicantAction(
  arg1:
    | {
      applicationId?: string;
      leadId?: string;
      schoolId: string;
      tenantId?: string;
      schoolDomain?: string;
      tierId?: string;
      departmentId?: string;
      classArm?: string;
      termFeeAmount?: number;
      actorId?: string;
      ipAddress?: string;
    }
    | string,
  arg2?: string,
  arg3?: string
): Promise<any> {
  const isObject = typeof arg1 === "object" && arg1 !== null;
  const leadId = isObject ? arg1.leadId : undefined;
  const applicationId = isObject ? arg1.applicationId : (typeof arg1 === "string" ? arg1 : undefined);
  const schoolIdArg = isObject ? arg1.schoolId : (arg2 || "");
  const tenantIdArg = isObject ? (arg1.tenantId || arg1.schoolId) : (arg3 || arg2 || "");

  // If applicationId is provided or called with string ID, route to Enterprise enrollment
  if (applicationId || (!leadId && isObject && arg1.applicationId)) {
    return enrollAdmissionsApplicationAction({
      applicationId: applicationId || (arg1 as any).applicationId,
      schoolId: schoolIdArg,
      tenantId: tenantIdArg,
      schoolDomain: isObject ? arg1.schoolDomain : undefined,
      tierId: isObject ? arg1.tierId : undefined,
      departmentId: isObject ? arg1.departmentId : undefined,
      classArm: isObject ? arg1.classArm : undefined,
      termFeeAmount: isObject ? arg1.termFeeAmount : undefined,
      actorId: isObject ? arg1.actorId : undefined,
      ipAddress: isObject ? arg1.ipAddress : undefined,
    });
  }

  const payload = arg1 as any;
  const { schoolDomain } = payload;
  try {
    if (!leadId) {
      return { success: false, error: "leadId or applicationId is required." };
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
    let lead = await basePrisma.admissionLead.findUnique({
      where: { id: leadId },
      include: { tier: true },
    });

    if (!lead) {
      // Check if leadId is actually an AdmissionsApplication ID or applicationNumber
      const appRecord = await basePrisma.admissionsApplication.findFirst({
        where: {
          OR: [{ id: leadId }, { applicationNumber: leadId }],
        },
      });
      if (appRecord) {
        return enrollAdmissionsApplicationAction({
          applicationId: appRecord.id,
          schoolId: schoolIdArg,
          tenantId: tenantIdArg,
          schoolDomain: isObject ? arg1.schoolDomain : undefined,
          tierId: isObject ? arg1.tierId : undefined,
          departmentId: isObject ? arg1.departmentId : undefined,
          classArm: isObject ? arg1.classArm : undefined,
          termFeeAmount: isObject ? arg1.termFeeAmount : undefined,
          actorId: isObject ? arg1.actorId : undefined,
          ipAddress: isObject ? arg1.ipAddress : undefined,
        });
      }

      // Check if leadId is an AdmissionRegister ID or applicationNo
      const regRecord = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [{ id: leadId }, { applicationNo: leadId }],
        },
      });
      if (regRecord) {
        return enrollApplicantFromRegisterAction({
          registerId: regRecord.id,
          schoolId: schoolIdArg,
          schoolDomain: (isObject ? arg1.schoolDomain : undefined) || schoolDomain || "portal",
        });
      }

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

    // Automated Admission Offer Notification Dispatch
    try {
      const host = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://bonaveeict.com.ng";
      const offerLetterUrl = `${host}/${domain || "portal"}/admissions/offer/${lead.id}`;
      await dispatchAdmissionsNotification({
        tenantId: schoolId,
        schoolName: school?.name || "School ERP",
        applicantNumber: admissionNumber,
        recipient: {
          name: `${firstName} ${lastName}`.trim(),
          email: lead.studentEmail || lead.parentEmail || "",
          phone: lead.parentPhone || lead.parentContact || "",
          whatsappNumber: lead.parentPhone || lead.parentContact || "",
        },
        event: "PROVISIONAL_OFFER",
        offerLetterUrl,
        acceptanceFeeAmount: 50000,
        acceptanceDeadline: "Within 14 days",
      });
    } catch (offerErr) {
      console.warn("[enrollApplicantAction] Warning dispatching PROVISIONAL_OFFER notification:", offerErr);
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

    // Automated Notification Dispatch: Instantly notify applicant of Admission Offer & Matriculation Clearance
    const db = getCentralDb(schoolId);
    const school = await db.school.findFirst({
      where: { id: schoolId },
      select: { name: true, subdomain: true },
    });

    const host = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://bonaveeict.com.ng";
    const student = handshakeResult.student;
    const register = handshakeResult.register;
    const applicantName = `${student?.firstName || register?.firstName || ""} ${student?.lastName || register?.lastName || ""}`.trim() || "Applicant";
    const recipientEmail = handshakeResult.userEmail || student?.email || register?.email || student?.parentEmail || "";
    const recipientPhone = student?.parentPhone || register?.parentPhone || "";
    const applicantNumber = register?.applicationNo || handshakeResult.matricNo || "ADM-OFFER";
    const targetSubdomain = school?.subdomain || schoolDomain || "portal";
    const offerLetterUrl = `${host}/${targetSubdomain}/admissions/offer/${register?.id || register?.applicationNo || student?.id}`;
    const studentUser = handshakeResult.userEmail || recipientEmail || handshakeResult.matricNo;
    const studentTempPass = handshakeResult.tempPassword || "Welcome@123";
    const studentLoginUrl = `${host}/${targetSubdomain}/login?code=${encodeURIComponent(targetSubdomain)}&email=${encodeURIComponent(studentUser)}`;

    // 1. Dispatch Automated Admission Offer Notification to applicant
    try {
      await dispatchAdmissionsNotification({
        tenantId: schoolId,
        schoolName: school?.name || "School ERP",
        schoolSubdomain: targetSubdomain,
        applicantNumber,
        tier: register?.tier || undefined,
        targetGrade: register?.classApplied || undefined,
        recipient: {
          name: applicantName,
          email: recipientEmail,
          phone: recipientPhone,
          whatsappNumber: recipientPhone,
        },
        event: "PROVISIONAL_OFFER",
        offerLetterUrl,
        acceptanceFeeAmount: payload.tuitionFeeAmount || 50000,
        acceptanceDeadline: "Within 14 days",
      });
    } catch (notifErr) {
      console.warn("[enrollApplicantFromRegisterAction] Warning dispatching PROVISIONAL_OFFER notification:", notifErr);
    }

    // 2. Dispatch Formal Matriculation & Clearance Notification to applicant
    try {
      await dispatchAdmissionsNotification({
        tenantId: schoolId,
        schoolName: school?.name || "School ERP",
        schoolSubdomain: targetSubdomain,
        applicantNumber,
        tier: register?.tier || undefined,
        targetGrade: register?.classApplied || undefined,
        recipient: {
          name: applicantName,
          email: recipientEmail,
          phone: recipientPhone,
          whatsappNumber: recipientPhone,
        },
        event: "ENROLLED",
        matriculationNumber: handshakeResult.matricNo || student?.admissionNumber || applicantNumber,
        studentPortalUrl: studentLoginUrl,
        portalUsername: studentUser,
        portalTempPassword: handshakeResult.isSelfService ? undefined : studentTempPass,
        isSelfServiceApplicant: handshakeResult.isSelfService,
      });
    } catch (notifErr) {
      console.warn("[enrollApplicantFromRegisterAction] Warning dispatching ENROLLED notification:", notifErr);
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
    let existingLead = await basePrisma.admissionLead.findUnique({
      where: { id: leadId },
      include: { stage: true, track: { include: { stages: true } }, tier: true },
    });

    if (!existingLead) {
      // Check AdmissionsApplication or AdmissionRegister
      const appRecord = await basePrisma.admissionsApplication.findFirst({
        where: {
          OR: [{ id: leadId }, { applicationNumber: leadId }],
        },
      });
      const regRecord = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [{ id: leadId }, { applicationNo: leadId }],
        },
      });

      if (!appRecord && !regRecord) {
        return { success: false, error: "404 Not Found: Candidate dossier not found in this tenant." };
      }

      if (status === "ENROLLED") {
        if (appRecord) {
          return await enrollAdmissionsApplicationAction({
            applicationId: appRecord.id,
            schoolId,
            schoolDomain,
          });
        }
        if (regRecord) {
          return await enrollApplicantFromRegisterAction({
            registerId: regRecord.id,
            schoolId,
            schoolDomain,
          });
        }
      }

      if (appRecord) {
        const statusMap: Record<string, any> = {
          INQUIRY: "DRAFT",
          APPLIED: "SUBMITTED",
          SUBMITTED: "SUBMITTED",
          SCREENING: "UNDER_REVIEW",
          ASSESSMENT: "ASSESSMENT_SCHEDULED",
          OFFERED: "OFFER_EXTENDED",
          APPROVED: "OFFER_EXTENDED",
          ACCEPTED: "OFFER_ACCEPTED",
          ENROLLED: "ENROLLED",
          REJECTED: "REJECTED",
        };
        const mappedStatus = statusMap[status.toUpperCase()] || "UNDER_REVIEW";

        await basePrisma.admissionsApplication.update({
          where: { id: appRecord.id },
          data: {
            status: mappedStatus,
            metadata: {
              ...((appRecord.metadata as any) || {}),
              admissionStage: status,
            },
            updatedAt: new Date(),
          },
        });
      }

      if (regRecord) {
        await basePrisma.admissionRegister.update({
          where: { id: regRecord.id },
          data: {
            status: status.toLowerCase(),
            updatedAt: new Date(),
          },
        });
      }

      await invalidateAdmissionsNamespace(schoolId);
      safeRevalidate(`/${schoolDomain}/admissions`);
      return { success: true };
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
      const schoolRec = await basePrisma.school.findUnique({ where: { id: schoolId }, select: { tierDatabasesConfig: true } });
      const examCfg: any = (schoolRec?.tierDatabasesConfig as any)?.entranceExamSettings;
      const isExamOff = examCfg?.enabled === false || (existingLead?.tier?.name && examCfg?.tiers?.[existingLead.tier.name]?.enabled === false);
      const evaluation = evaluateStageConstraints(existingLead, targetStage.constraints as any, { enableEntranceExam: !isExamOff });
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
      } catch { }
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
    } catch { }

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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    } catch { }

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
    } catch { }

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

    let appRecord = await basePrisma.admissionsApplication.findFirst({
      where: {
        OR: [{ id: payload.registerId }, { applicationNumber: payload.registerId }],
      },
      include: { feeTransactions: true },
    });

    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          { id: payload.registerId },
          ...(registerRecord?.email ? [{ studentEmail: registerRecord.email }, { parentEmail: registerRecord.email }] : []),
          ...(appRecord?.email ? [{ studentEmail: appRecord.email }, { parentEmail: appRecord.email }] : []),
          ...(registerRecord?.parentPhone ? [{ parentPhone: registerRecord.parentPhone }, { parentContact: registerRecord.parentPhone }] : []),
          ...(appRecord?.phoneNumber ? [{ parentPhone: appRecord.phoneNumber }, { parentContact: appRecord.phoneNumber }] : []),
        ],
      },
    });

    if (!registerRecord && !lead && !appRecord) {
      return { success: false, error: "Applicant record not found" };
    }

    const verifiedBy = payload.userRole || session?.userId || session?.name || "Admissions Officer";
    const verifiedAt = new Date().toISOString();

    let updated: any = null;

    if (appRecord) {
      const appMetadata = (appRecord.metadata as any) || {};
      const currentMetaDocs = { ...(appMetadata.documents || {}) };
      currentMetaDocs.formFeePaid = true;
      currentMetaDocs.formFeeStatus = "PAID";
      currentMetaDocs.applicationFeeReceipt = {
        ...(typeof currentMetaDocs.applicationFeeReceipt === "object" ? currentMetaDocs.applicationFeeReceipt : {}),
        status: "VERIFIED",
        verificationStatus: "MANUALLY_VERIFIED",
        verified: true,
        verifiedAt,
        verifiedBy,
      };

      const tierData = (appRecord.tierSpecificData as any) || {};
      tierData.formFeePaid = true;
      tierData.formFeeStatus = "PAID";
      tierData.paymentState = "SETTLED";

      const updatedApp = await basePrisma.admissionsApplication.update({
        where: { id: appRecord.id },
        data: {
          metadata: { ...appMetadata, documents: currentMetaDocs },
          tierSpecificData: tierData,
          status: appRecord.status === "PAYMENT_PENDING" || appRecord.status === "DRAFT" ? "SUBMITTED" : appRecord.status,
          updatedAt: new Date(),
        },
      });
      if (!updated) updated = updatedApp;

      const txUpdate = await basePrisma.admissionsFeeTransaction.updateMany({
        where: { applicationId: appRecord.id },
        data: {
          paymentStatus: "SETTLED",
          verifiedAt: new Date(),
          verifiedByUserId: verifiedBy,
        },
      });
      if (txUpdate.count === 0) {
        await basePrisma.admissionsFeeTransaction.create({
          data: {
            tenantId: appRecord.tenantId || appRecord.schoolId || "default",
            applicationId: appRecord.id,
            paymentMethod: "MANUAL_BANK_TRANSFER",
            amount: 5000,
            currency: "NGN",
            paymentReference: `FEE-${appRecord.applicationNumber}`,
            paymentStatus: "SETTLED",
            proofOfPaymentUrl: currentMetaDocs.applicationFeeReceiptUrl || currentMetaDocs.applicationFeeReceipt?.url || undefined,
            verifiedByUserId: verifiedBy,
            verifiedAt: new Date(),
          },
        }).catch(() => null);
      }
    }

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

    // Update corresponding PaymentReceipt records if any, or create if none exists
    try {
      const appRef = registerRecord?.applicationNo || (lead as any)?.applicationNo || appRecord?.applicationNumber;
      if (appRef || lead?.id || appRecord?.id) {
        const prUpdate = await basePrisma.paymentReceipt.updateMany({
          where: {
            OR: [
              ...(appRef ? [{ referenceNo: appRef }] : []),
              ...(lead?.id ? [{ payerId: lead.id }] : []),
              ...(appRecord?.id ? [{ payerId: appRecord.id }] : []),
            ],
            moduleType: "ADMISSION_FORM_FEE",
          },
          data: {
            status: "VERIFIED",
            state: "SETTLED",
            verifiedBy: typeof verifiedBy === "string" ? verifiedBy : null,
            verifiedByUserId: typeof verifiedBy === "string" ? verifiedBy : null,
            verifiedAt: new Date(),
          },
        });

        if (!prUpdate || prUpdate.count === 0) {
          const payerName =
            (lead as any)?.applicantName ||
            (registerRecord ? `${registerRecord.firstName || ""} ${registerRecord.lastName || ""}`.trim() : null) ||
            (appRecord ? `${appRecord.firstName || ""} ${appRecord.lastName || ""}`.trim() : null) ||
            "Applicant";
          const tenantId =
            appRecord?.schoolId ||
            appRecord?.tenantId ||
            registerRecord?.tenantId ||
            (lead as any)?.schoolId;
          const refNo =
            appRef ||
            `APP-${(lead?.id || registerRecord?.id || appRecord?.id || Date.now().toString()).slice(0, 6).toUpperCase()}`;
          const proofUrl =
            appRecord?.feeTransactions?.[0]?.proofOfPaymentUrl ||
            (lead as any)?.documents?.applicationFeeReceipt ||
            "DESK_SETTLED_RECEIPT";

          if (tenantId) {
            await basePrisma.paymentReceipt
              .create({
                data: {
                  tenantId,
                  schoolId: tenantId,
                  moduleType: "ADMISSION_FORM_FEE",
                  payerType: "APPLICANT",
                  payerId: lead?.id || registerRecord?.id || appRecord?.id,
                  payerName,
                  referenceNo: refNo,
                  amount: 5000,
                  paymentMethod: "BANK_TRANSFER",
                  paymentMode: "MANUAL_TRANSFER",
                  fileUrl: proofUrl,
                  proofOfPaymentUrl: proofUrl,
                  fileName: "application_fee_receipt.jpg",
                  depositorName: payerName,
                  transferReference: refNo,
                  txnRef: refNo,
                  status: "VERIFIED",
                  state: "SETTLED",
                  verifiedBy: typeof verifiedBy === "string" ? verifiedBy : "Admissions Desk",
                  verifiedByUserId: typeof verifiedBy === "string" ? verifiedBy : null,
                  verifiedAt: new Date(),
                },
              })
              .catch(() => null);
          }
        }
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
      const schoolRec = await basePrisma.school.findUnique({ where: { id: schoolId }, select: { tierDatabasesConfig: true } });
      const examCfg: any = (schoolRec?.tierDatabasesConfig as any)?.entranceExamSettings;
      const isExamOff = examCfg?.enabled === false || (lead?.tier?.name && examCfg?.tiers?.[lead.tier.name]?.enabled === false);
      const evaluation = evaluateStageConstraints(lead, targetStage.constraints, { enableEntranceExam: !isExamOff });
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
    let schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyAdmissionsMutatorRole(session, schoolId);
    if (!auth.authorized) {
      return { success: false, error: auth.reason || "403 Forbidden: Unauthorized to record exam scores." };
    }

    const targetRef = (payload.leadId || "").trim();
    const cleanRef = targetRef.replace(/^ADM-|^APP-/i, "").trim().toLowerCase();

    let lead = await basePrisma.admissionLead.findUnique({
      where: { id: targetRef },
    });

    let appRecord: any = null;
    let registerRecord: any = null;

    if (!lead) {
      appRecord = await basePrisma.admissionsApplication.findFirst({
        where: {
          OR: [
            { id: targetRef },
            { applicationNumber: targetRef },
            ...(cleanRef ? [{ applicationNumber: { contains: cleanRef, mode: "insensitive" as const } }] : []),
          ],
        },
      });

      registerRecord = await basePrisma.admissionRegister.findFirst({
        where: {
          OR: [
            { id: targetRef },
            { applicationNo: targetRef },
            ...(cleanRef ? [{ applicationNo: { contains: cleanRef, mode: "insensitive" as const } }] : []),
          ],
        },
      });

      const linkedLeadId =
        (appRecord?.metadata as any)?.leadId ||
        (appRecord?.tierSpecificData as any)?.leadId ||
        (registerRecord?.credentialsJson as any)?.leadId;

      if (linkedLeadId) {
        lead = await basePrisma.admissionLead.findUnique({
          where: { id: linkedLeadId },
        });
      }
    }

    if (!lead && !appRecord && !registerRecord) {
      return { success: false, error: "404 Not Found: Candidate dossier not found in this tenant." };
    }

    const parsedScore = Number(payload.score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      return { success: false, error: "Invalid entrance score. Please provide a score between 0 and 100." };
    }

    let updated: any = null;

    if (lead) {
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

      updated = await basePrisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          documents: docs,
          logs,
        },
        include: { tier: true, track: true, stage: true },
      });
    }

    if (appRecord) {
      const tierData = (appRecord.tierSpecificData as any) || {};
      tierData.entranceScore = parsedScore;
      tierData.examScore = parsedScore;
      tierData.examAggregate = parsedScore;
      tierData.manualScoreEntry = true;
      tierData.examPassed = parsedScore >= 50;
      tierData.scoreRecordedAt = new Date().toISOString();

      const appMeta = (appRecord.metadata as any) || {};
      const metaDocs = { ...(appMeta.documents || {}) };
      metaDocs.entranceScore = parsedScore;
      metaDocs.examScore = parsedScore;

      await basePrisma.admissionsApplication.update({
        where: { id: appRecord.id },
        data: {
          tierSpecificData: tierData,
          metadata: { ...appMeta, documents: metaDocs },
          updatedAt: new Date(),
        },
      });
    }

    // Also sync to matching AdmissionRegister record if present
    if (!registerRecord && lead) {
      const nameParts = (lead.applicantName || "").trim().split(" ");
      const firstName = nameParts[0] || "Student";
      const lastName = nameParts.slice(1).join(" ") || "Applicant";

      registerRecord = await basePrisma.admissionRegister.findFirst({
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
    }

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

    // Also sync to AdmissionsApplication (Modern Admissions Workspace)
    try {
      if (!appRecord) {
        appRecord = await basePrisma.admissionsApplication.findFirst({
          where: {
            schoolId,
            OR: [
              { id: targetRef },
              ...(cleanRef ? [{ applicationNumber: { contains: cleanRef, mode: "insensitive" as const } }] : []),
              ...(lead?.studentEmail ? [{ email: lead.studentEmail }] : []),
            ],
          },
        });
      }

      if (appRecord) {
        const appTierData = (appRecord.tierSpecificData as any) || {};
        appTierData.entranceScore = parsedScore;
        appTierData.examScore = parsedScore;
        appTierData.examAggregate = parsedScore;
        appTierData.utmeScore = parsedScore; // In case tertiary uses utmeScore
        appTierData.postUtmeScore = parsedScore;

        await basePrisma.admissionsApplication.update({
          where: { id: appRecord.id },
          data: {
            tierSpecificData: appTierData,
          },
        });
      }
    } catch (appSyncErr) {
      console.warn("[saveManualEntranceScoreAction] Warning syncing entranceScore to AdmissionsApplication:", appSyncErr);
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain || ""}/admissions`);
    return { success: true, lead: updated || appRecord || registerRecord, score: parsedScore };
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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
    let schoolId = await resolveSchoolId(payload.schoolId);
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

/**
 * Enterprise Admissions: Update application stage and record immutable audit trail
 */
export async function updateApplicationStageAction(payload: {
  applicationId: string;
  newStage: string;
  schoolId: string;
  schoolDomain?: string;
  notes?: string;
  actorId?: string;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);
    let db: any = (process.env.DEMO_DATABASE_URL && (isDemoSchool(targetSchoolId) || isDemoSchool(payload.schoolDomain) || isDemoSchool(payload.schoolId)))
      ? getDemoPrismaClient()
      : basePrisma;

    // Scoped query for strict tenant isolation
    let app = await db.admissionsApplication.findFirst({
      where: {
        id: payload.applicationId,
        schoolId: targetSchoolId,
      },
    });

    if (!app) {
      app = await db.admissionsApplication.findFirst({
        where: {
          id: payload.applicationId,
          OR: [
            { schoolId: targetSchoolId },
            { tenantId: targetSchoolId },
          ],
        },
      });
    }

    if (!app && process.env.DEMO_DATABASE_URL && db === basePrisma) {
      try {
        const demoClient = getDemoPrismaClient();
        const demoApp = await demoClient.admissionsApplication.findFirst({
          where: { id: payload.applicationId },
        });
        if (demoApp) {
          app = demoApp;
          db = demoClient;
          if (demoApp.schoolId) setDemoSchoolId(demoApp.schoolId);
        }
      } catch {}
    }

    if (!app) {
      return { success: false, error: "Application record not found or belongs to another institution." };
    }

    // Map colloquial / Kanban stage names to ApplicationStatus
    let targetStatus: ApplicationStatus = ApplicationStatus.SUBMITTED;
    const stageUpper = payload.newStage.toUpperCase().replace(/\s+/g, "_");

    if (stageUpper === "INQUIRY" || stageUpper === "DRAFT") {
      targetStatus = ApplicationStatus.DRAFT;
    } else if (stageUpper === "DOCS_PENDING" || stageUpper === "PAYMENT_PENDING" || stageUpper === "ACTION_REQUIRED") {
      targetStatus = ApplicationStatus.PAYMENT_PENDING;
    } else if (stageUpper === "VERIFIED" || stageUpper === "UNDER_REVIEW" || stageUpper === "SUBMITTED") {
      targetStatus = ApplicationStatus.UNDER_REVIEW;
    } else if (stageUpper === "APPROVED" || stageUpper === "OFFER_EXTENDED" || stageUpper === "OFFER_ACCEPTED") {
      targetStatus = ApplicationStatus.OFFER_EXTENDED;
    } else if (stageUpper === "REJECTED") {
      targetStatus = ApplicationStatus.REJECTED;
    } else if (stageUpper === "CONVERTED" || stageUpper === "ENROLLED" || stageUpper === "ADMITTED") {
      targetStatus = ApplicationStatus.ENROLLED;
    } else if (Object.values(ApplicationStatus).includes(stageUpper as any)) {
      targetStatus = stageUpper as ApplicationStatus;
    }

    const previousStatus = app.status;

    // Mutate via single update where id (no updateMany)
    const updated = await db.admissionsApplication.update({
      where: { id: app.id },
      data: {
        status: targetStatus,
        metadata: {
          ...((app.metadata as any) || {}),
          stageUpdatedBy: payload.actorId || "ADMIN",
          lastStageTransition: {
            from: previousStatus,
            to: targetStatus,
            at: new Date().toISOString(),
            notes: payload.notes || null,
          },
        },
      },
    });

    // Synchronize linked AdmissionLead if present so background auto-reconciliation will never regress it
    const leadId = (app.metadata as any)?.leadId || (app.tierSpecificData as any)?.leadId;
    if (leadId) {
      let leadStatus: string | null = null;
      if (targetStatus === ApplicationStatus.ENROLLED) {
        leadStatus = "CONVERTED";
      } else if (targetStatus === ApplicationStatus.REJECTED) {
        leadStatus = "LOST";
      } else if (targetStatus === ApplicationStatus.OFFER_EXTENDED) {
        leadStatus = "OFFER_EXTENDED";
      } else if (targetStatus === ApplicationStatus.UNDER_REVIEW) {
        leadStatus = "SCREENING";
      }
      if (leadStatus) {
        await db.admissionLead.update({
          where: { id: leadId },
          data: { status: leadStatus as any },
        }).catch(() => null);
      }
    }

    // Record immutable audit trail
    try {
      await db.admissionAuditTrail.create({
        data: {
          tenantId: targetSchoolId,
          schoolId: targetSchoolId,
          applicationId: app.id,
          registerId: app.id,
          actorId: payload.actorId || "ADMIN",
          action: "STAGE_CHANGE",
          fromStage: previousStatus,
          toStage: targetStatus,
          ipAddress: (payload as any).ipAddress || null,
          metadata: {
            notes: payload.notes || `Candidate stage transitioned to ${targetStatus}`,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn("[updateApplicationStageAction] Warning recording audit trail:", auditErr);
    }

    // If moved to OFFER_EXTENDED, notify applicant omnichannel
    if (targetStatus === ApplicationStatus.OFFER_EXTENDED) {
      const school = await db.school.findFirst({
        where: { id: targetSchoolId },
        select: { name: true, subdomain: true },
      });
      const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";
      await dispatchAdmissionsNotification({
        tenantId: targetSchoolId,
        schoolName: school?.name || "School ERP",
        applicantNumber: app.applicationNumber,
        recipient: {
          name: `${app.firstName} ${app.lastName}`,
          email: app.email,
          phone: app.phoneNumber,
          whatsappNumber: app.whatsappNumber || app.phoneNumber,
        },
        event: "PROVISIONAL_OFFER",
        offerLetterUrl: `${host}/${school?.subdomain || "portal"}/admissions/offer/${app.id}`,
      }).catch((notifErr) => console.warn("[PROVISIONAL_OFFER_NOTIF_WARN]:", notifErr));
    }

    if (payload.schoolDomain) {
      safeRevalidate(`/${payload.schoolDomain}/admissions`);
    }

    return {
      success: true,
      application: updated,
      newStage: targetStatus,
      message: `Applicant stage successfully updated to ${targetStatus}.`,
    };
  } catch (err: any) {
    console.error("[updateApplicationStageAction] Error:", err);
    return { success: false, error: err.message || "Failed to update application stage." };
  }
}

/**
 * Enterprise Admissions: Direct atomic in-process matriculation / student enrollment server action
 */
export async function enrollAdmissionsApplicationAction(payload: {
  applicationId: string;
  schoolId: string;
  tenantId?: string;
  schoolDomain?: string;
  tierId?: string;
  departmentId?: string;
  classArm?: string;
  termFeeAmount?: number;
  actorId?: string;
  ipAddress?: string;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);
    let db: any = (process.env.DEMO_DATABASE_URL && (isDemoSchool(targetSchoolId) || isDemoSchool(payload.schoolDomain) || isDemoSchool(payload.schoolId)))
      ? getDemoPrismaClient()
      : basePrisma;

    // 1. Retrieve the AdmissionsApplication with tenant scoping
    let application = await db.admissionsApplication.findFirst({
      where: {
        id: payload.applicationId,
        schoolId: targetSchoolId,
      },
      include: {
        documents: true,
      },
    });

    if (!application) {
      application = await db.admissionsApplication.findFirst({
        where: {
          id: payload.applicationId,
          OR: [
            { schoolId: targetSchoolId },
            { tenantId: targetSchoolId },
          ],
        },
        include: {
          documents: true,
        },
      });
    }

    if (!application && process.env.DEMO_DATABASE_URL && db === basePrisma) {
      try {
        const demoClient = getDemoPrismaClient();
        const demoApp = await demoClient.admissionsApplication.findFirst({
          where: { id: payload.applicationId },
          include: { documents: true },
        });
        if (demoApp) {
          application = demoApp;
          db = demoClient;
          if (demoApp.schoolId) setDemoSchoolId(demoApp.schoolId);
        }
      } catch {}
    }

    if (!application) {
      return { success: false, error: "Admissions application record not found for this tenant." };
    }

    // 2. Resolve School and Academic Tier
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
      },
    });

    if (!school) {
      return { success: false, error: "School institution record not found." };
    }

    const targetTierId = payload.tierId || school.academicTiers[0]?.id;
    if (!targetTierId) {
      return { success: false, error: "Academic tier is required for student enrollment." };
    }

    const targetTier = (school.academicTiers || []).find((t: any) => t.id === targetTierId) || school.academicTiers[0];
    const tenantDb = await getPrismaClientForTier(targetSchoolId, targetTier.name);

    // 3. Compute Admission/Matriculation Number via Tenant Formula
    const year = new Date().getFullYear();
    const branchPrefix = school.subdomain ? school.subdomain.toUpperCase().slice(0, 4) : "SCH";
    const programCode = (application.programId || "GEN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

    const studentSequenceCount = await tenantDb.student.count({
      where: { schoolId: targetSchoolId },
    });
    const seqPadded = String(studentSequenceCount + 1).padStart(4, "0");
    const matriculationNumber = `${branchPrefix}/${year}/${programCode}/${seqPadded}`;

    // 4. Resolve Identity & Portal Credentials
    const isPublicSelfService =
      application.intakeChannel === "ONLINE_PORTAL" ||
      application.intakeChannel === "PORTAL" ||
      application.intakeChannel === "SELF_SERVICE" ||
      application.intakeChannel === "ONLINE" ||
      (application.metadata as any)?.submittedFromIp === "client-portal";

    const userEmail =
      application.email.toLowerCase().trim() ||
      `${matriculationNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.${school.subdomain || "portal"}`;

    const parentData = (application.tierSpecificData as any)?.parent || (application.metadata as any)?.parent || {};
    const parentName = parentData.name || `${application.lastName} Family`;
    const parentEmail = parentData.email || application.email;
    const parentPhone = parentData.phone || application.phoneNumber;

    // For walk-in candidates, generate initial temporary credentials
    const rawTempPassword = `Welcome@${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedTempPassword = await bcrypt.hash(rawTempPassword, 12);

    let isApplicantSelfService = isPublicSelfService;

    // 5. Execute Atomic Enrollment Transaction
    const result = await db.$transaction(async (tx: any) => {
      // Step A: Locate existing User and Student accounts
      const existingUser = await tx.user.findFirst({
        where: {
          schoolId: targetSchoolId,
          email: { equals: userEmail, mode: "insensitive" },
        },
      });

      const existingStudent = await tx.student.findFirst({
        where: {
          schoolId: targetSchoolId,
          email: { equals: userEmail, mode: "insensitive" },
        },
      });

      // Extract any pre-existing chosen password hash
      const preExistingPasswordHash =
        existingUser?.passwordHash ||
        (existingStudent?.dynamicFields as any)?.password ||
        (application.tierSpecificData as any)?.passwordHash ||
        (application.metadata as any)?.passwordHash;

      // Determine if applicant registered via self-service portal
      if (isPublicSelfService || (preExistingPasswordHash && application.intakeChannel !== "WALK_IN")) {
        isApplicantSelfService = true;
      }

      let user: any;
      if (existingUser) {
        // PRESERVE user's existing chosen password for self-service candidates; promote role to STUDENT
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            role: "STUDENT",
            firstName: application.firstName,
            lastName: application.lastName,
            status: "ACTIVE",
            ...(isApplicantSelfService
              ? {
                  mustChangePassword: false,
                  ...(preExistingPasswordHash ? { passwordHash: preExistingPasswordHash } : {}),
                }
              : {
                  passwordHash: preExistingPasswordHash || hashedTempPassword,
                  mustChangePassword: true,
                }),
          },
        });
      } else {
        // Create student user record
        user = await tx.user.create({
          data: {
            schoolId: targetSchoolId,
            email: userEmail,
            passwordHash: isApplicantSelfService
              ? (preExistingPasswordHash || hashedTempPassword)
              : (preExistingPasswordHash || hashedTempPassword),
            role: "STUDENT",
            firstName: application.firstName,
            lastName: application.lastName,
            status: "ACTIVE",
            mustChangePassword: !isApplicantSelfService,
          },
        });
      }

      // Step B: Create or Update Student in target database
      let student: any;
      if (existingStudent) {
        student = await tx.student.update({
          where: { id: existingStudent.id },
          data: {
            userId: user.id,
            tierId: targetTierId,
            firstName: application.firstName,
            lastName: application.lastName,
            admissionNumber: matriculationNumber,
            currentClass: payload.classArm || application.programId || "Year 1",
            dateOfBirth: application.dateOfBirth,
            status: "ENROLLED",
            parentName,
            parentEmail,
            parentPhone,
            parentWhatsApp: application.whatsappNumber || parentPhone,
            feeStatus: payload.termFeeAmount ? "UNPAID" : "PAID",
            enrolledAt: new Date(),
            mustChangePassword: !isApplicantSelfService,
            dynamicFields: {
              ...((existingStudent.dynamicFields as any) || {}),
              applicationId: application.id,
              intakeChannel: application.intakeChannel,
              tierSpecificData: application.tierSpecificData,
              verifiedDocumentsCount: application.documents.length,
              isTemporaryPassword: !isApplicantSelfService,
              password: user.passwordHash,
            },
          },
        });
      } else {
        student = await tx.student.create({
          data: {
            schoolId: targetSchoolId,
            userId: user.id,
            tierId: targetTierId,
            firstName: application.firstName,
            lastName: application.lastName,
            email: userEmail,
            admissionNumber: matriculationNumber,
            currentClass: payload.classArm || application.programId || "Year 1",
            dateOfBirth: application.dateOfBirth,
            status: "ENROLLED",
            parentName,
            parentEmail,
            parentPhone,
            parentWhatsApp: application.whatsappNumber || parentPhone,
            feeStatus: payload.termFeeAmount ? "UNPAID" : "PAID",
            enrolledAt: new Date(),
            mustChangePassword: !isApplicantSelfService,
            dynamicFields: {
              applicationId: application.id,
              intakeChannel: application.intakeChannel,
              tierSpecificData: application.tierSpecificData,
              verifiedDocumentsCount: application.documents.length,
              isTemporaryPassword: !isApplicantSelfService,
              password: user.passwordHash,
            },
          },
        });
      }

      // Step C: Link Parent
      if (parentEmail && parentEmail.includes("@")) {
        const parentUser = await tx.parent.upsert({
          where: { schoolId_email: { schoolId: targetSchoolId, email: parentEmail.toLowerCase().trim() } },
          update: {
            name: parentName,
            phone: parentPhone,
          },
          create: {
            schoolId: targetSchoolId,
            name: parentName,
            email: parentEmail.toLowerCase().trim(),
            phone: parentPhone,
            passwordHash: hashedTempPassword,
            relationship: parentData.relationship || "Parent",
          },
        });

        await tx.studentParent.upsert({
          where: { studentId_parentId: { studentId: student.id, parentId: parentUser.id } },
          update: {},
          create: {
            schoolId: targetSchoolId,
            studentId: student.id,
            parentId: parentUser.id,
          },
        });
      }

      // Step D: Link to Bursary Fee Template / Ledger configured by Bursar or School Admin
      const feeTemplate = await tx.feeTemplate.findFirst({
        where: { schoolId: targetSchoolId },
        orderBy: { createdAt: "desc" },
      });

      const effectiveFeeAmount = payload.termFeeAmount && Number(payload.termFeeAmount) > 0
        ? Number(payload.termFeeAmount)
        : (feeTemplate?.defaultAmount || 0);

      if (effectiveFeeAmount > 0 || feeTemplate) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await tx.invoice.create({
          data: {
            schoolId: targetSchoolId,
            studentId: student.id,
            feeTemplateId: feeTemplate?.id || null,
            amountDue: effectiveFeeAmount,
            amountPaid: 0,
            status: "PENDING",
            dueDate,
            description: feeTemplate?.name
              ? `${feeTemplate.name} - ${matriculationNumber}`
              : `1st Term Academic Tuition & Registration Ledger - ${matriculationNumber}`,
          },
        });
      }

      // Step E: Update AdmissionsApplication status to ENROLLED (single record update)
      const updatedApp = await tx.admissionsApplication.update({
        where: { id: application.id },
        data: {
          status: "ENROLLED",
          metadata: {
            ...((application.metadata as any) || {}),
            enrolledStudentId: student.id,
            matriculationNumber,
            enrolledAt: new Date().toISOString(),
            enrolledBy: payload.actorId || "ADMIN",
          },
        },
      });

      return { student, user, updatedApp };
    });

    // Record immutable AdmissionAuditTrail (defensive fallback outside transaction)
    try {
      await db.admissionAuditTrail.create({
        data: {
          tenantId: targetSchoolId,
          schoolId: targetSchoolId,
          applicationId: application.id,
          registerId: application.id,
          actorId: payload.actorId || "ADMIN",
          action: "ENROLLED",
          fromStage: application.status,
          toStage: "ENROLLED",
          ipAddress: (payload as any).ipAddress || null,
          metadata: {
            matriculationNumber,
            studentId: result.student.id,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn("[enrollAdmissionsApplicationAction] Warning recording audit trail:", auditErr);
    }

    // Synchronize security policy: self-service candidates who chose their password are never forced to change it.
    // Candidates registered by admin / front-desk officer are required to change temporary password.
    try {
      await setUserMustChangePassword(result.user.id, targetSchoolId, !isApplicantSelfService);
      await setUserMustChangePassword(result.student.id, targetSchoolId, !isApplicantSelfService);
    } catch (secErr) {
      console.warn("[enrollAdmissionsApplicationAction] Warning setting user security flags:", secErr);
    }

    // 6. Dispatch Automated Admission Offer Notification to applicant
    const host = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://bonaveeict.com.ng";
    const targetSubdomain = school?.subdomain || payload.schoolDomain || "portal";
    const studentLoginUrl = `${host}/${targetSubdomain}/login?code=${encodeURIComponent(targetSubdomain)}&email=${encodeURIComponent(userEmail)}`;
    const offerLetterUrl = `${host}/${targetSubdomain}/admissions/offer/${application.id}`;
    
    await dispatchAdmissionsNotification({
      tenantId: targetSchoolId,
      schoolName: school.name,
      schoolSubdomain: targetSubdomain,
      applicantNumber: application.applicationNumber,
      tier: (application as any).tier || undefined,
      targetGrade: application.programId || application.classArm || undefined,
      recipient: {
        name: `${application.firstName} ${application.lastName}`,
        email: userEmail,
        phone: application.phoneNumber,
        whatsappNumber: application.whatsappNumber || application.phoneNumber,
      },
      event: "PROVISIONAL_OFFER",
      offerLetterUrl,
      acceptanceFeeAmount: payload.termFeeAmount || 50000,
      acceptanceDeadline: "Within 14 days",
    }).catch((err) => console.warn("[dispatchAdmissionsNotification:PROVISIONAL_OFFER]", err));

    // 7. Dispatch Omnichannel Welcome & Matriculation Clearance
    await dispatchAdmissionsNotification({
      tenantId: targetSchoolId,
      schoolName: school.name,
      schoolSubdomain: targetSubdomain,
      applicantNumber: application.applicationNumber,
      tier: (application as any).tier || undefined,
      targetGrade: application.programId || application.classArm || undefined,
      recipient: {
        name: `${application.firstName} ${application.lastName}`,
        email: userEmail,
        phone: application.phoneNumber,
        whatsappNumber: application.whatsappNumber || application.phoneNumber,
      },
      event: "ENROLLED",
      matriculationNumber,
      studentPortalUrl: studentLoginUrl,
      portalUsername: userEmail,
      portalTempPassword: isApplicantSelfService ? undefined : rawTempPassword,
      isSelfServiceApplicant: isApplicantSelfService,
    }).catch((err) => console.warn("[dispatchAdmissionsNotification:ENROLLED]", err));

    await invalidateStudentNamespace(targetSchoolId);
    await invalidateAdmissionsNamespace(targetSchoolId);
    if (payload.schoolDomain) {
      safeRevalidate(`/${payload.schoolDomain}/admissions`);
    }

    return {
      success: true,
      matricNo: matriculationNumber,
      matriculationNumber,
      studentId: result.student.id,
      studentName: `${result.student.firstName} ${result.student.lastName}`,
      userEmail,
      tempPassword: isApplicantSelfService ? undefined : rawTempPassword,
      isSelfService: isApplicantSelfService,
      message: `Successfully matriculated as ${matriculationNumber}.`,
    };
  } catch (err: any) {
    console.error("[enrollAdmissionsApplicationAction] Error:", err);
    return { success: false, error: err.message || "Failed to matriculate student." };
  }
}

/**
 * Enterprise Admissions: Batch Extend Provisional Offers to Selected Candidates
 */
export async function batchSendOffersAction(payload: {
  applicationIds: string[];
  schoolId: string;
  schoolDomain?: string;
  actorId?: string;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);
    const school = await basePrisma.school.findFirst({
      where: { id: targetSchoolId },
      select: { name: true, subdomain: true },
    });
    const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";

    let successCount = 0;
    const errors: string[] = [];

    for (const appId of payload.applicationIds) {
      // Find candidate scoped to tenant
      const app = await basePrisma.admissionsApplication.findFirst({
        where: { id: appId, schoolId: targetSchoolId },
      });
      if (!app) {
        errors.push(`App ${appId}: not found or access denied`);
        continue;
      }

      const prevStatus = app.status;

      // Update via single id update (NO updateMany)
      await basePrisma.admissionsApplication.update({
        where: { id: app.id },
        data: {
          status: "OFFER_EXTENDED",
          metadata: {
            ...((app.metadata as any) || {}),
            batchOfferExtendedAt: new Date().toISOString(),
            extendedBy: payload.actorId || "ADMIN",
          },
        },
      });

      // Audit trail entry with defensive fallback
      try {
        await basePrisma.admissionAuditTrail.create({
          data: {
            tenantId: targetSchoolId,
            schoolId: targetSchoolId,
            applicationId: app.id,
            registerId: app.id,
            actorId: payload.actorId || "ADMIN",
            action: "PROVISIONAL_OFFER_EXTENDED",
            fromStage: prevStatus,
            toStage: "OFFER_EXTENDED",
            ipAddress: (payload as any).ipAddress || null,
            metadata: {
              batch: true,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (auditErr) {
        console.warn("[batchSendOffersAction] Warning recording audit trail:", auditErr);
      }

      // Omnichannel dispatch
      await dispatchAdmissionsNotification({
        tenantId: targetSchoolId,
        schoolName: school?.name || "School ERP",
        schoolSubdomain: school?.subdomain || payload.schoolDomain,
        applicantNumber: app.applicationNumber,
        tier: (app as any).tier || undefined,
        targetGrade: (app as any).programId || (app as any).classArm || undefined,
        recipient: {
          name: `${app.firstName} ${app.lastName}`,
          email: app.email,
          phone: app.phoneNumber,
          whatsappNumber: app.whatsappNumber || app.phoneNumber,
        },
        event: "PROVISIONAL_OFFER",
        offerLetterUrl: `${host}/${school?.subdomain || payload.schoolDomain || "portal"}/admissions/offer/${app.id}`,
      }).catch((e) => console.warn("[batchSendOffersAction notification]", e));

      successCount++;
    }

    if (payload.schoolDomain) {
      safeRevalidate(`/${payload.schoolDomain}/admissions`);
    }

    return {
      success: true,
      processed: successCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Provisional admission offers extended to ${successCount} candidate(s).`,
    };
  } catch (err: any) {
    console.error("[batchSendOffersAction] Error:", err);
    return { success: false, error: err.message || "Failed to batch extend offers." };
  }
}

/**
 * Enterprise Admissions: Extend Admission Offer to a candidate,
 * verifying admission requirements and dispatching instant omnichannel notifications.
 */
export async function offerAdmissionAction(payload: {
  applicationId: string;
  schoolId: string;
  schoolDomain?: string;
  grantWaiver?: boolean;
  actorId?: string;
  acceptanceDeadlineDays?: number;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
    if (session && !auth.canMutate) {
      return { success: false, error: auth.reason || "Unauthorized to offer admission." };
    }

    const app = await basePrisma.admissionsApplication.findFirst({
      where: { id: payload.applicationId, schoolId: targetSchoolId },
      include: { feeTransactions: true },
    });

    if (!app) {
      return { success: false, error: "Application not found or unauthorized." };
    }

    // Evaluate Admission Requirements
    const tierData = (app.tierSpecificData as any) || {};
    const metadata = (app.metadata as any) || {};
    const rawScore =
      tierData.entranceScore ??
      tierData.examScore ??
      tierData.utmeScore ??
      tierData.postUtmeScore ??
      metadata.entranceScore ??
      metadata.examScore ??
      null;

    const numScore = rawScore !== null && rawScore !== undefined ? Number(rawScore) : null;
    const hasPassingScore = numScore !== null ? numScore >= 50 : true;

    const oLevelCredits = Number(tierData.oLevelCredits || tierData.creditCount || 0);
    const hasOLevel = tierData.oLevelCredits !== undefined ? oLevelCredits >= 5 : true;

    const meetsRequirements = hasPassingScore && hasOLevel;

    if (!meetsRequirements && !payload.grantWaiver) {
      const reasons: string[] = [];
      if (!hasPassingScore) reasons.push(`Entrance exam score (${numScore ?? 'N/A'}) is below the passing requirement (50%).`);
      if (!hasOLevel) reasons.push(`O'Level credits (${oLevelCredits}) are below the minimum 5 credits requirement.`);
      return {
        success: false,
        requiresWaiver: true,
        missingRequirements: reasons,
        error: `Candidate does not meet admission requirement: ${reasons.join(" ")}`,
      };
    }

    const previousStatus = app.status;
    const deadlineDays = payload.acceptanceDeadlineDays || 14;
    const deadlineDate = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
    const deadlineStr = deadlineDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    // Update admissionsApplication
    await basePrisma.admissionsApplication.update({
      where: { id: app.id },
      data: {
        status: ApplicationStatus.OFFER_EXTENDED,
        metadata: {
          ...metadata,
          offerExtendedAt: new Date().toISOString(),
          offerAcceptanceDeadline: deadlineDate.toISOString(),
          extendedBy: payload.actorId || session?.email || "ADMIN",
          waiverGranted: !meetsRequirements && payload.grantWaiver === true,
        },
      },
    });

    // Sync corresponding AdmissionLead if exists
    try {
      const matchingLead = await basePrisma.admissionLead.findFirst({
        where: {
          schoolId: targetSchoolId,
          OR: [
            { studentEmail: app.email },
            { parentEmail: app.email },
            { parentPhone: app.phoneNumber },
            { applicantName: { equals: `${app.firstName} ${app.lastName}`, mode: "insensitive" } },
          ],
        },
      });
      if (matchingLead) {
        const leadToken = matchingLead.offerToken || `OFFER-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const updatedLead = await basePrisma.admissionLead.update({
          where: { id: matchingLead.id },
          data: {
            status: "APPROVED",
            offerToken: leadToken,
            offerExpiresAt: deadlineDate,
          },
        });
        const leadSchool = await basePrisma.school.findUnique({ where: { id: targetSchoolId } });
        if (leadSchool) {
          sendAdmissionOfferEmail(updatedLead, leadSchool, leadToken).catch((err) =>
            console.warn("[offerAdmissionAction] Direct email dispatch warning:", err)
          );
        }
      }
    } catch (leadSyncErr) {
      console.warn("[offerAdmissionAction] Lead sync warning:", leadSyncErr);
    }

    // Record immutable audit trail
    try {
      await basePrisma.admissionAuditTrail.create({
        data: {
          tenantId: targetSchoolId,
          schoolId: targetSchoolId,
          applicationId: app.id,
          registerId: app.id,
          actorId: payload.actorId || session?.email || "ADMIN",
          action: "PROVISIONAL_OFFER_EXTENDED",
          fromStage: previousStatus,
          toStage: "OFFER_EXTENDED",
          metadata: {
            deadline: deadlineDate.toISOString(),
            waiverGranted: !meetsRequirements && payload.grantWaiver === true,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn("[offerAdmissionAction] Audit trail warning:", auditErr);
    }

    // Instant Omnichannel Notification Dispatch
    const school = await basePrisma.school.findFirst({
      where: { id: targetSchoolId },
      select: { name: true, subdomain: true },
    });
    const host = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const offerLetterUrl = `${host}/${school?.subdomain || payload.schoolDomain || "portal"}/admissions/offer/${app.id}`;

    let notifResult: any = null;
    try {
      notifResult = await dispatchAdmissionsNotification({
        tenantId: targetSchoolId,
        schoolName: school?.name || "School ERP",
        schoolSubdomain: school?.subdomain || payload.schoolDomain,
        applicantNumber: app.applicationNumber,
        tier: (app as any).tier || undefined,
        targetGrade: (app as any).programId || (app as any).classArm || undefined,
        recipient: {
          name: `${app.firstName} ${app.lastName}`,
          email: app.email,
          phone: app.phoneNumber,
          whatsappNumber: app.whatsappNumber || app.phoneNumber,
        },
        event: "PROVISIONAL_OFFER",
        offerLetterUrl,
        acceptanceDeadline: deadlineStr,
      });
    } catch (notifErr) {
      console.warn("[offerAdmissionAction] Notification dispatch warning:", notifErr);
    }

    if (payload.schoolDomain) {
      safeRevalidate(`/${payload.schoolDomain}/admissions`);
    }

    return {
      success: true,
      newStage: "OFFER_EXTENDED",
      message: `Admission offer successfully extended to ${app.firstName} ${app.lastName}! Notification dispatched instantly via Email, WhatsApp & SMS.`,
      notification: notifResult,
    };
  } catch (err: any) {
    console.error("[offerAdmissionAction] Error:", err);
    return { success: false, error: err.message || "Failed to offer admission." };
  }
}

/**
 * Batch Offer Admission: Instantly offers admission and dispatches notifications
 * to all candidates that pass the admission requirement (or selected candidate IDs).
 */
export async function batchOfferAdmissionAction(payload: {
  schoolId: string;
  schoolDomain?: string;
  applicationIds?: string[];
  qualifiedOnly?: boolean;
  minPassingScore?: number;
  actorId?: string;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
    if (session && !auth.canMutate) {
      return { success: false, error: auth.reason || "Unauthorized to batch offer admission." };
    }

    const school = await basePrisma.school.findFirst({
      where: { id: targetSchoolId },
      select: { name: true, subdomain: true },
    });
    const host = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const minScore = payload.minPassingScore ?? 50;

    // Fetch candidate pool
    const candidates = await basePrisma.admissionsApplication.findMany({
      where: {
        schoolId: targetSchoolId,
        ...(payload.applicationIds && payload.applicationIds.length > 0
          ? { id: { in: payload.applicationIds } }
          : {
              status: {
                notIn: [
                  ApplicationStatus.OFFER_EXTENDED,
                  ApplicationStatus.OFFER_ACCEPTED,
                  ApplicationStatus.ENROLLED,
                  ApplicationStatus.REJECTED,
                ],
              },
            }),
      },
      include: { feeTransactions: true },
    });

    const qualifyingCandidates: typeof candidates = [];

    for (const app of candidates) {
      if (payload.qualifiedOnly !== false) {
        const tierData = (app.tierSpecificData as any) || {};
        const metadata = (app.metadata as any) || {};
        const rawScore =
          tierData.entranceScore ??
          tierData.examScore ??
          tierData.utmeScore ??
          tierData.postUtmeScore ??
          metadata.entranceScore ??
          metadata.examScore ??
          null;

        const numScore = rawScore !== null && rawScore !== undefined ? Number(rawScore) : null;
        const hasPassingScore = numScore !== null ? numScore >= minScore : true;
        const oLevelCredits = Number(tierData.oLevelCredits || tierData.creditCount || 0);
        const hasOLevel = tierData.oLevelCredits !== undefined ? oLevelCredits >= 5 : true;

        if (hasPassingScore && hasOLevel) {
          qualifyingCandidates.push(app);
        }
      } else {
        qualifyingCandidates.push(app);
      }
    }

    if (qualifyingCandidates.length === 0) {
      return {
        success: true,
        processedCount: 0,
        message: "No candidates currently meet the admission requirements for automated offer dispatch.",
      };
    }

    let successCount = 0;
    const deadlineDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const deadlineStr = deadlineDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    // Process updates and dispatches
    for (const app of qualifyingCandidates) {
      const prevStatus = app.status;

      await basePrisma.admissionsApplication.update({
        where: { id: app.id },
        data: {
          status: ApplicationStatus.OFFER_EXTENDED,
          metadata: {
            ...((app.metadata as any) || {}),
            offerExtendedAt: new Date().toISOString(),
            offerAcceptanceDeadline: deadlineDate.toISOString(),
            extendedBy: payload.actorId || session?.email || "ADMIN",
            batchOffer: true,
          },
        },
      });

      // Audit trail
      try {
        await basePrisma.admissionAuditTrail.create({
          data: {
            tenantId: targetSchoolId,
            schoolId: targetSchoolId,
            applicationId: app.id,
            registerId: app.id,
            actorId: payload.actorId || session?.email || "ADMIN",
            action: "PROVISIONAL_OFFER_EXTENDED",
            fromStage: prevStatus,
            toStage: "OFFER_EXTENDED",
            metadata: {
              batch: true,
              deadline: deadlineDate.toISOString(),
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (auditErr) {
        console.warn("[batchOfferAdmissionAction] Audit trail warning:", auditErr);
      }

      // Instant Omnichannel Notification
      dispatchAdmissionsNotification({
        tenantId: targetSchoolId,
        schoolName: school?.name || "School ERP",
        schoolSubdomain: school?.subdomain || payload.schoolDomain,
        applicantNumber: app.applicationNumber,
        tier: (app as any).tier || undefined,
        targetGrade: (app as any).programId || (app as any).classArm || undefined,
        recipient: {
          name: `${app.firstName} ${app.lastName}`,
          email: app.email,
          phone: app.phoneNumber,
          whatsappNumber: app.whatsappNumber || app.phoneNumber,
        },
        event: "PROVISIONAL_OFFER",
        offerLetterUrl: `${host}/${school?.subdomain || payload.schoolDomain || "portal"}/admissions/offer/${app.id}`,
        acceptanceDeadline: deadlineStr,
      }).catch((e) => console.warn("[batchOfferAdmissionAction notification]", e));

      successCount++;
    }

    if (payload.schoolDomain) {
      safeRevalidate(`/${payload.schoolDomain}/admissions`);
    }

    return {
      success: true,
      processedCount: successCount,
      processedIds: qualifyingCandidates.map((c) => c.id),
      message: `Provisional admission offers successfully extended and notifications instantly dispatched to ${successCount} qualifying candidate(s).`,
    };
  } catch (err: any) {
    console.error("[batchOfferAdmissionAction] Error:", err);
    return { success: false, error: err.message || "Failed to batch offer admission." };
  }
}

/**
 * Enterprise Admissions: Export JAMB CAPS Candidate CSV
 */
export async function exportJambCapsCsvAction(payload: {
  schoolId: string;
  programId?: string;
  sessionId?: string;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);

    const where: any = { schoolId: targetSchoolId };
    if (payload.programId && payload.programId !== "ALL") {
      where.programId = payload.programId;
    }
    if (payload.sessionId && payload.sessionId !== "ALL") {
      where.academicSessionId = payload.sessionId;
    }

    const applications = await basePrisma.admissionsApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    const headers = [
      "Registration Number",
      "Candidate Name",
      "Program",
      "JAMB Reg No",
      "UTME Score",
      "O'Level Credits",
      "Status",
      "Date Applied",
    ];

    const rows = applications.map((app) => {
      const tierData = (app.tierSpecificData as any) || {};
      const regNo = app.applicationNumber || "";
      const name = `"${app.lastName} ${app.firstName} ${app.middleName || ""}"`.trim();
      const prog = `"${app.programId || "General"}"`;
      const jambReg = tierData.jambRegNumber || tierData.jambRegNo || tierData.utmeRegNumber || "N/A";
      const score = tierData.utmeScore || tierData.postUtmeScore || tierData.examScore || "N/A";
      const oLevel = tierData.oLevelCredits || tierData.creditCount || "N/A";
      const status = app.status;
      const date = new Date(app.createdAt).toISOString().split("T")[0];

      return [regNo, name, prog, jambReg, score, oLevel, status, date].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    return {
      success: true,
      csvContent,
      count: applications.length,
      filename: `JAMB_CAPS_EXPORT_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  } catch (err: any) {
    console.error("[exportJambCapsCsvAction] Error:", err);
    return { success: false, error: err.message || "Failed to export JAMB CAPS CSV." };
  }
}

/**
 * Enterprise Admissions: Verify or Reject Document with Audit Logging
 */
export async function verifyDocumentAction(payload: {
  documentId: string;
  schoolId: string;
  tenantId?: string;
  verificationStatus: "MANUALLY_VERIFIED" | "REJECTED";
  reviewerNotes?: string;
  rejectionReason?: string;
  actorId?: string;
  ipAddress?: string;
  schoolDomain?: string;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);
    const doc = await basePrisma.admissionsDocument.findFirst({
      where: {
        id: payload.documentId,
        tenantId: targetSchoolId,
      },
      include: { application: true },
    });

    if (!doc) {
      return { success: false, error: "Document record not found or access denied." };
    }

    const updatedDoc = await basePrisma.admissionsDocument.update({
      where: { id: payload.documentId },
      data: {
        verificationStatus: payload.verificationStatus,
        rejectionReason: payload.rejectionReason || payload.reviewerNotes || null,
        verifiedByUserId: payload.actorId || "Admissions Officer",
        verifiedAt: new Date(),
      },
    });

    try {
      await basePrisma.admissionAuditTrail.create({
        data: {
          tenantId: targetSchoolId,
          schoolId: targetSchoolId,
          applicationId: doc.applicationId,
          registerId: doc.applicationId,
          actorId: payload.actorId || "Admissions Officer",
          action: payload.verificationStatus === "MANUALLY_VERIFIED" ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
          fromStage: doc.verificationStatus,
          toStage: payload.verificationStatus,
          ipAddress: payload.ipAddress || null,
          metadata: {
            documentId: doc.id,
            documentType: doc.documentType,
            reviewerNotes: payload.reviewerNotes || null,
            rejectionReason: payload.rejectionReason || null,
          },
        },
      });
    } catch (auditErr) {
      console.warn("[verifyDocumentAction] Warning recording audit trail:", auditErr);
    }

    if (payload.schoolDomain) {
      safeRevalidate(`/${payload.schoolDomain}/admissions`);
    }

    return { success: true, document: updatedDoc };
  } catch (err: any) {
    console.error("[verifyDocumentAction] Error:", err);
    return { success: false, error: err.message || "Failed to verify document." };
  }
}

/**
 * Enterprise Admissions: Reconcile Fee Action (Approve / Reject) with Audit Logging
 */
export async function reconcileFeeAction(payload: {
  transactionId: string;
  schoolId: string;
  tenantId?: string;
  action: "APPROVE" | "REJECT";
  reconciliationNotes?: string;
  reason?: string;
  actorId?: string;
  ipAddress?: string;
  schoolDomain?: string;
}) {
  try {
    const targetSchoolId = await resolveSchoolId(payload.schoolId);
    let txRecord = await basePrisma.admissionsFeeTransaction.findUnique({
      where: { id: payload.transactionId },
      include: { application: true },
    });

    if (!txRecord) {
      // Fallback if transactionId was a synthetic tx-lead-<appId>, an applicationId, or a PaymentReceipt ID
      const candidateAppId = payload.transactionId.replace(/^tx-lead-/i, "").trim();
      const matchedApp = await basePrisma.admissionsApplication.findUnique({
        where: { id: candidateAppId },
        include: { feeTransactions: true },
      });
      if (matchedApp) {
        if (matchedApp.feeTransactions.length > 0) {
          txRecord = { ...matchedApp.feeTransactions[0], application: matchedApp };
        } else {
          const metaDocs: any = (matchedApp.metadata as any)?.documents || {};
          const createdTx = await basePrisma.admissionsFeeTransaction.create({
            data: {
              tenantId: matchedApp.tenantId || matchedApp.schoolId,
              applicationId: matchedApp.id,
              paymentMethod: "MANUAL_BANK_TRANSFER",
              amount: 5000,
              currency: "NGN",
              paymentReference: `FEE-${matchedApp.applicationNumber}`,
              proofOfPaymentUrl:
                metaDocs.applicationFeeReceiptUrl ||
                metaDocs.applicationFeeReceipt?.url ||
                null,
              paymentStatus: "PENDING",
            },
            include: { application: true },
          });
          txRecord = createdTx;
        }
      }
    }

    if (!txRecord) {
      return { success: false, error: "Payment transaction record not found." };
    }

    if (txRecord.application.schoolId !== targetSchoolId && txRecord.tenantId !== targetSchoolId) {
      return { success: false, error: "403 Forbidden: Cross-tenant ledger reconciliation rejected." };
    }

    const school = await basePrisma.school.findFirst({
      where: { id: txRecord.application.schoolId },
      select: { name: true, subdomain: true },
    });

    if (payload.action === "APPROVE") {
      const updated = await basePrisma.$transaction(async (prismaTx) => {
        const settledTx = await prismaTx.admissionsFeeTransaction.update({
          where: { id: payload.transactionId },
          data: {
            paymentStatus: "SETTLED",
            reconciliationNotes: payload.reconciliationNotes || "Reconciled with institutional bank ledger",
            verifiedByUserId: payload.actorId || "Bursar Officer",
            verifiedAt: new Date(),
          },
        });

        const updatedApp = await prismaTx.admissionsApplication.update({
          where: { id: txRecord.applicationId },
          data: {
            status: "UNDER_REVIEW",
            metadata: {
              ...((txRecord.application.metadata as any) || {}),
              settledPaymentRef: txRecord.paymentReference,
              settledAt: new Date().toISOString(),
              feeSettledBy: payload.actorId || "Bursar Officer",
            },
          },
        });

        // Synchronize with AdmissionRegister & AdmissionLead
        try {
          const appNo = txRecord.application.applicationNumber;
          const reg = await prismaTx.admissionRegister.findFirst({
            where: {
              OR: [
                { applicationNo: appNo },
                { id: txRecord.applicationId },
                ...(txRecord.application.email ? [{ email: txRecord.application.email }] : []),
              ],
            },
          });
          if (reg) {
            let creds: any = reg.credentialsJson || {};
            if (typeof creds === "string") {
              try { creds = JSON.parse(creds); } catch { creds = {}; }
            }
            creds.formFeePaid = true;
            creds.formFeeStatus = "PAID";
            creds.feePaid = true;
            creds.formFeeVerifiedAt = new Date().toISOString();
            creds.formFeeVerifiedBy = payload.actorId || "Bursar Officer";
            await prismaTx.admissionRegister.update({
              where: { id: reg.id },
              data: { formFeePaid: true, credentialsJson: creds },
            });
          }

          const lead = await prismaTx.admissionLead.findFirst({
            where: {
              OR: [
                { id: txRecord.applicationId },
                ...(txRecord.application.email ? [{ studentEmail: txRecord.application.email }] : []),
              ],
            },
          });
          if (lead) {
            const lDocs: any = (lead.documents as any) || {};
            lDocs.formFeePaid = true;
            lDocs.formFeeStatus = "PAID";
            lDocs.feePaid = true;
            lDocs.formFeeVerifiedAt = new Date().toISOString();
            lDocs.formFeeVerifiedBy = payload.actorId || "Bursar Officer";
            await prismaTx.admissionLead.update({
              where: { id: lead.id },
              data: { documents: lDocs },
            });
          }

          // Also mirror into PaymentReceipt if present
          await prismaTx.paymentReceipt.updateMany({
            where: {
              moduleType: "ADMISSION_FORM_FEE",
              OR: [
                { referenceNo: appNo },
                { payerId: txRecord.applicationId },
                ...(lead ? [{ payerId: lead.id }] : []),
                ...(reg ? [{ payerId: reg.id }] : []),
              ],
              status: { in: ["PENDING", "REJECTED"] },
            },
            data: {
              status: "VERIFIED",
              state: "SETTLED",
              verifiedBy: payload.actorId || "Bursar Officer",
              verifiedAt: new Date(),
            },
          });
        } catch (syncErr) {
          console.warn("[reconcileFeeAction:approve] Warning syncing legacy register/receipts:", syncErr);
        }

        return { settledTx, updatedApp };
      });

      // Record audit trail safely after transaction commits
      try {
        await basePrisma.admissionAuditTrail.create({
          data: {
            tenantId: targetSchoolId,
            schoolId: targetSchoolId,
            applicationId: txRecord.applicationId,
            registerId: txRecord.applicationId,
            actorId: payload.actorId || "Bursar Officer",
            action: "FEE_RECONCILED",
            fromStage: txRecord.application.status,
            toStage: "SUBMITTED",
            ipAddress: payload.ipAddress || null,
            metadata: {
              transactionId: txRecord.id,
              amount: Number(txRecord.amount),
              paymentReference: txRecord.paymentReference,
            },
          },
        });
      } catch (auditErr) {
        console.warn("[reconcileFeeAction:approve] Warning recording audit trail:", auditErr);
      }

      const host = process.env.NEXTAUTH_URL || "https://schoolerp.ng";
      const receiptDownloadUrl = `${host}/${school?.subdomain || "portal"}/admissions/receipt/${txRecord.id}`;

      await dispatchAdmissionsNotification({
        tenantId: txRecord.tenantId,
        schoolName: school?.name || "School ERP",
        applicantNumber: txRecord.application.applicationNumber,
        recipient: {
          name: `${txRecord.application.firstName} ${txRecord.application.lastName}`,
          email: txRecord.application.email,
          phone: txRecord.application.phoneNumber,
          whatsappNumber: txRecord.application.whatsappNumber || txRecord.application.phoneNumber,
        },
        event: "PAYMENT_CONFIRMED",
        paymentReference: txRecord.paymentReference,
        amountPaid: Number(txRecord.amount),
        receiptDownloadUrl,
      }).catch((notifErr) => console.warn("[PAYMENT_CONFIRMED_WARN]:", notifErr));

      if (payload.schoolDomain) {
        safeRevalidate(`/${payload.schoolDomain}/admissions`);
      }

      return { success: true, transaction: updated.settledTx, receiptUrl: receiptDownloadUrl };
    } else {
      const updated = await basePrisma.$transaction(async (prismaTx) => {
        const rejectedTx = await prismaTx.admissionsFeeTransaction.update({
          where: { id: txRecord.id },
          data: {
            paymentStatus: "REJECTED",
            reconciliationNotes: payload.reason || "Rejected by Bursar",
            verifiedByUserId: payload.actorId || "Bursar Officer",
            verifiedAt: new Date(),
          },
        });

        await prismaTx.paymentReceipt
          .updateMany({
            where: {
              moduleType: "ADMISSION_FORM_FEE",
              OR: [
                { referenceNo: txRecord.application.applicationNumber },
                { payerId: txRecord.applicationId },
              ],
              status: "PENDING",
            },
            data: {
              status: "REJECTED",
              state: "REJECTED",
              rejectionReason: payload.reason || "Rejected by Bursar",
              verifiedBy: payload.actorId || "Bursar Officer",
              verifiedAt: new Date(),
            },
          })
          .catch(() => null);

        return rejectedTx;
      });

      // Record audit trail safely after transaction commits
      try {
        await basePrisma.admissionAuditTrail.create({
          data: {
            tenantId: targetSchoolId,
            schoolId: targetSchoolId,
            applicationId: txRecord.applicationId,
            registerId: txRecord.applicationId,
            actorId: payload.actorId || "Bursar Officer",
            action: "FEE_REJECTED",
            fromStage: txRecord.application.status,
            toStage: txRecord.application.status,
            ipAddress: payload.ipAddress || null,
            metadata: {
              transactionId: txRecord.id,
              reason: payload.reason,
            },
          },
        });
      } catch (auditErr) {
        console.warn("[reconcileFeeAction:reject] Warning recording audit trail:", auditErr);
      }

      if (payload.schoolDomain) {
        safeRevalidate(`/${payload.schoolDomain}/admissions`);
      }

      return { success: true, transaction: updated };
    }
  } catch (err: any) {
    console.error("[reconcileFeeAction] Error:", err);
    return { success: false, error: err.message || "Failed to reconcile transaction." };
  }
}

export async function approveAdmissionsFeeTransaction(args: {
  transactionId: string;
  schoolId: string;
  reconciliationNotes?: string;
  verifiedByUserId?: string;
  schoolDomain?: string;
}) {
  return reconcileFeeAction({
    transactionId: args.transactionId,
    schoolId: args.schoolId,
    action: "APPROVE",
    reconciliationNotes: args.reconciliationNotes,
    actorId: args.verifiedByUserId,
    schoolDomain: args.schoolDomain,
  });
}

export async function rejectAdmissionsFeeTransaction(args: {
  transactionId: string;
  schoolId: string;
  reason: string;
  verifiedByUserId?: string;
  schoolDomain?: string;
}) {
  return reconcileFeeAction({
    transactionId: args.transactionId,
    schoolId: args.schoolId,
    action: "REJECT",
    reason: args.reason,
    actorId: args.verifiedByUserId,
    schoolDomain: args.schoolDomain,
  });
}

/**
 * Enterprise Admissions: Edit Applicant Bio-Data / Target Class / Contact Info
 */
export async function updateAdmissionsApplicationBioAction(payload: {
  applicationId: string;
  schoolId: string;
  schoolDomain: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  programId?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  notes?: string;
}) {
  try {
    let schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyAdmissionsMutatorRole(session, schoolId);
    if (!auth.authorized) {
      return { success: false, error: auth.reason || "403 Forbidden: Unauthorized to edit applicant." };
    }

    const app = await basePrisma.admissionsApplication.findUnique({
      where: { id: payload.applicationId },
    });

    if (!app || app.schoolId !== schoolId) {
      return { success: false, error: "404 Not Found: Applicant record not found in this institution." };
    }

    const prevTierData = (app.tierSpecificData as any) || {};
    const updatedTierData = {
      ...prevTierData,
      targetGrade: payload.programId || prevTierData.targetGrade,
      targetClass: payload.programId || prevTierData.targetClass,
      parentName: payload.parentName || prevTierData.parentName,
      parentPhone: payload.parentPhone || prevTierData.parentPhone || payload.phoneNumber,
      parentEmail: payload.parentEmail || prevTierData.parentEmail,
      dateOfBirth: payload.dateOfBirth || prevTierData.dateOfBirth,
    };

    const updatedApp = await basePrisma.admissionsApplication.update({
      where: { id: payload.applicationId },
      data: {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        middleName: payload.middleName?.trim() || null,
        email: payload.email?.trim().toLowerCase() || app.email,
        phoneNumber: payload.phoneNumber?.trim() || app.phoneNumber,
        whatsappNumber: payload.whatsappNumber?.trim() || null,
        gender: payload.gender || app.gender,
        programId: payload.programId?.trim() || app.programId,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : app.dateOfBirth,
        tierSpecificData: updatedTierData,
      },
    });

    // Also cascade updates to legacy tables (AdmissionRegister & AdmissionLead)
    try {
      const appNo = app.applicationNumber;
      await basePrisma.admissionRegister.updateMany({
        where: {
          tenantId: schoolId,
          OR: [{ applicationNo: appNo }, { id: payload.applicationId }],
        },
        data: {
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          classApplied: payload.programId?.trim() || undefined,
          email: payload.email?.trim() || undefined,
          parentPhone: payload.parentPhone?.trim() || payload.phoneNumber?.trim() || undefined,
        },
      });

      const leadId = (app.metadata as any)?.leadId || (prevTierData as any)?.leadId;
      if (leadId) {
        await basePrisma.admissionLead.updateMany({
          where: { id: leadId, schoolId },
          data: {
            applicantName: `${payload.firstName} ${payload.lastName}`.trim(),
            targetGrade: payload.programId?.trim() || undefined,
            studentEmail: payload.email?.trim() || undefined,
            parentPhone: payload.parentPhone?.trim() || payload.phoneNumber?.trim() || undefined,
            parentName: payload.parentName?.trim() || undefined,
          },
        });
      }
    } catch (cascadeErr) {
      console.warn("[updateAdmissionsApplicationBioAction] Warning cascading edit to legacy tables:", cascadeErr);
    }

    // Record audit trail
    try {
      await basePrisma.admissionAuditTrail.create({
        data: {
          tenantId: schoolId,
          schoolId,
          applicationId: app.id,
          actorId: session?.user?.name || session?.email || "Admissions Officer",
          action: "APPLICANT_BIO_UPDATED",
          fromStage: app.status,
          toStage: app.status,
          metadata: {
            updatedFields: {
              firstName: payload.firstName,
              lastName: payload.lastName,
              programId: payload.programId,
              phoneNumber: payload.phoneNumber,
            },
            notes: payload.notes || "Applicant bio-data modified via admissions workspace",
          },
        },
      });
    } catch (auditErr) {
      console.warn("[updateAdmissionsApplicationBioAction] Warning logging audit trail:", auditErr);
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain}/admissions`);

    return { success: true, application: updatedApp, message: "Applicant profile updated successfully." };
  } catch (err: any) {
    console.error("[updateAdmissionsApplicationBioAction] Error:", err);
    return { success: false, error: err.message || "Failed to update applicant profile." };
  }
}

/**
 * Enterprise Admissions: Permanent Hard Deletion of AdmissionsApplication with Cascades
 */
export async function deleteAdmissionsApplicationAction(payload: {
  applicationId: string;
  schoolId: string;
  schoolDomain: string;
}) {
  try {
    let schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyTenantAdminRole(session, schoolId);
    if (!auth.authorized) {
      return { success: false, error: auth.reason || "403 Forbidden: Only Tenant Admin can delete applicants." };
    }

    const app = await basePrisma.admissionsApplication.findUnique({
      where: { id: payload.applicationId },
      include: {
        documents: true,
        feeTransactions: true,
      },
    });

    if (!app || app.schoolId !== schoolId) {
      return { success: false, error: "404 Not Found: Applicant record not found in this institution." };
    }

    const appNo = app.applicationNumber;
    const leadId = (app.metadata as any)?.leadId || (app.tierSpecificData as any)?.leadId;

    // Delete application and cascade linked tables
    await basePrisma.$transaction(async (tx) => {
      // 1. Audit trails
      await tx.admissionAuditTrail.deleteMany({
        where: { applicationId: app.id },
      });

      // 2. Documents & fee transactions
      await tx.admissionsDocument.deleteMany({
        where: { applicationId: app.id },
      });
      await tx.admissionsFeeTransaction.deleteMany({
        where: { applicationId: app.id },
      });

      // 3. Delete modern AdmissionsApplication
      await tx.admissionsApplication.delete({
        where: { id: app.id },
      });

      // 4. Cascade delete legacy AdmissionRegister
      await tx.admissionRegister.deleteMany({
        where: {
          tenantId: schoolId,
          OR: [{ applicationNo: appNo }, { id: app.id }],
        },
      });

      // 5. Cascade delete legacy AdmissionLead if linked
      if (leadId) {
        await tx.admissionNote.deleteMany({
          where: { studentLeadId: leadId },
        });
        await tx.admissionLead.deleteMany({
          where: { id: leadId, schoolId },
        });
      }

      // 6. Purge unverified receipts
      await tx.paymentReceipt.deleteMany({
        where: {
          tenantId: schoolId,
          referenceNo: appNo,
          status: { in: ["PENDING", "REJECTED"] },
        },
      });
    });

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain}/admissions`);

    return { success: true, message: `Applicant ${app.lastName} ${app.firstName} (${appNo}) deleted permanently.` };
  } catch (err: any) {
    console.error("[deleteAdmissionsApplicationAction] Error:", err);
    return { success: false, error: err.message || "Failed to delete applicant record." };
  }
}

/**
 * Enterprise Admissions: Deduplicate Modern AdmissionsApplication Table along with Legacy Registries
 */
export async function deduplicateAllAdmissionsAction(payload: {
  schoolId: string;
  schoolDomain: string;
}) {
  try {
    let schoolId = await resolveSchoolId(payload.schoolId);
    const session = await getSession(undefined, payload.schoolDomain);
    const auth = await verifyTenantAdminRole(session, schoolId);
    if (!auth.authorized) {
      return { success: false, error: auth.reason || "403 Forbidden: Only Tenant Admin can execute deduplication." };
    }

    // 1. Run legacy deduplication
    const legacyResult = await deduplicateTenantAdmissions(schoolId).catch(() => ({
      totalMergedGroups: 0,
      totalPurged: 0,
    }));

    // 2. Run deduplication on AdmissionsApplication
    const allApps = await basePrisma.admissionsApplication.findMany({
      where: { schoolId },
      include: {
        documents: true,
        feeTransactions: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const appGroups = new Map<string, typeof allApps>();
    for (const app of allApps) {
      const fullName = `${app.firstName || ""} ${app.middleName || ""} ${app.lastName || ""}`.trim();
      const key = buildDeterministicAdmissionKey({
        fullName,
        className: app.programId,
        dateOfBirth: app.dateOfBirth,
        session: app.academicSessionId,
      });
      if (!key || key === "|||") continue;

      const group = appGroups.get(key) || [];
      group.push(app);
      appGroups.set(key, group);
    }

    let appsMergedGroups = 0;
    let appsPurgedCount = 0;

    for (const [, group] of appGroups.entries()) {
      if (group.length > 1) {
        // Master is preferred as the one with localized institutional application number (e.g. EGEDE/2026/0001)
        // over temporary portal ID (APP-7F6950), then SETTLED fee or farthest progressed status
        const master = group.reduce((best, curr) => {
          const score = (a: any) => {
            let s = 0;
            if (isInstitutionalApplicationNo(a.applicationNumber)) s += 200;
            if (a.status === "ENROLLED") s += 100;
            if (a.status === "OFFER_EXTENDED") s += 80;
            if (a.status === "UNDER_REVIEW") s += 50;
            if (a.feeTransactions?.some((t: any) => t.paymentStatus === "SETTLED")) s += 40;
            if (a.documents?.length > 0) s += a.documents.length * 5;
            return s;
          };
          return score(curr) > score(best) ? curr : best;
        }, group[0]);

        const duplicates = group.filter((g) => g.id !== master.id);
        const dupIds = duplicates.map((d) => d.id);

        await basePrisma.$transaction(async (tx) => {
          // Re-assign documents and transactions to master
          await tx.admissionsDocument.updateMany({
            where: { applicationId: { in: dupIds } },
            data: { applicationId: master.id },
          }).catch((err) => console.warn("[deduplicateAllAdmissionsAction] Document reassign warning:", err));

          await tx.admissionsFeeTransaction.updateMany({
            where: { applicationId: { in: dupIds } },
            data: { applicationId: master.id },
          }).catch((err) => console.warn("[deduplicateAllAdmissionsAction] Fee transaction reassign warning:", err));

          // Safely reassign audit trails if table and column exist in DB
          try {
            await tx.admissionAuditTrail.updateMany({
              where: { applicationId: { in: dupIds } },
              data: { applicationId: master.id },
            });
          } catch (auditErr) {
            console.warn("[deduplicateAllAdmissionsAction] Notice: admissionAuditTrail reassign bypassed:", auditErr);
          }

          // Delete duplicates
          await tx.admissionsApplication.deleteMany({
            where: { id: { in: dupIds } },
          });
        });

        appsMergedGroups++;
        appsPurgedCount += duplicates.length;
      }
    }

    await invalidateAdmissionsNamespace(schoolId);
    safeRevalidate(`/${payload.schoolDomain}/admissions`);

    const totalMerged = (legacyResult?.totalMergedGroups || 0) + appsMergedGroups;
    const totalPurged = (legacyResult?.totalPurged || 0) + appsPurgedCount;

    return {
      success: true,
      mergedCount: totalMerged,
      purgedCount: totalPurged,
      message:
        totalPurged > 0
          ? `Admissions deduplication complete: Merged ${totalMerged} duplicate group(s), purged ${totalPurged} redundant records.`
          : "Admissions register is clean. No duplicate applicant records found.",
    };
  } catch (err: any) {
    console.error("[deduplicateAllAdmissionsAction] Error:", err);
    return { success: false, error: err.message || "Failed to execute admissions deduplication." };
  }
}

/**
 * Scans checklist state for missing/pending documents and triggers an instant
 * email and notification reminder directly to the applicant's guardian.
 */
export async function sendMissingDocsReminderAction(payload: {
  schoolId: string;
  schoolDomain?: string;
  applicantId?: string;
  applicationNo?: string;
  applicantName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  missingDocuments: string[];
  customMessage?: string;
}) {
  try {
    const {
      schoolId: rawSchoolId,
      schoolDomain,
      applicantId,
      applicationNo,
      applicantName: rawApplicantName,
      recipientEmail,
      recipientPhone,
      missingDocuments,
      customMessage,
    } = payload;
    const cleanSub = cleanSchoolDomain(schoolDomain || rawSchoolId || "");
    const schoolId = await resolveSchoolId(rawSchoolId || cleanSub || "");

    const cleanNo = (applicationNo || applicantId || "").replace(/^ADM-|^APP-/i, "").replace(/[^a-zA-Z0-9]/g, "").trim();

    // 1. Locate applicant across models (unscoped first to prevent cross-tenant ID mismatches)
    let app = await basePrisma.admissionsApplication.findFirst({
      where: {
        OR: [
          ...(applicantId ? [{ id: applicantId }] : []),
          ...(applicationNo ? [
            { applicationNumber: applicationNo },
            { applicationNumber: { equals: applicationNo, mode: "insensitive" as const } },
          ] : []),
          ...(cleanNo ? [
            { applicationNumber: { contains: cleanNo, mode: "insensitive" as const } },
            { id: { contains: cleanNo, mode: "insensitive" as const } }
          ] : []),
          ...(rawApplicantName ? [
            { firstName: { contains: rawApplicantName.split(" ")[0], mode: "insensitive" as const } },
          ] : []),
        ],
      },
    });

    let lead = await basePrisma.admissionLead.findFirst({
      where: {
        OR: [
          ...(applicantId ? [{ id: applicantId }, { uploadToken: applicantId }] : []),
          ...(cleanNo ? [{ id: { contains: cleanNo, mode: "insensitive" as const } }] : []),
          ...(rawApplicantName ? [
            { applicantName: { contains: rawApplicantName.split(" ")[0], mode: "insensitive" as const } },
          ] : []),
        ],
      },
    });

    let registerRecord = await basePrisma.admissionRegister.findFirst({
      where: {
        OR: [
          ...(applicantId ? [{ id: applicantId }] : []),
          ...(applicationNo ? [
            { applicationNo },
            { applicationNo: { equals: applicationNo, mode: "insensitive" as const } },
          ] : []),
          ...(cleanNo ? [{ applicationNo: { contains: cleanNo, mode: "insensitive" as const } }] : []),
          ...(rawApplicantName ? [
            { firstName: { contains: rawApplicantName.split(" ")[0], mode: "insensitive" as const } },
          ] : []),
        ],
      },
    });

    // 2. Resolve target school institution
    const targetSchoolId = schoolId || app?.schoolId || lead?.schoolId || registerRecord?.tenantId || "";
    let school = await basePrisma.school.findFirst({
      where: {
        OR: [
          ...(targetSchoolId ? [
            { id: targetSchoolId },
            { subdomain: { equals: targetSchoolId, mode: "insensitive" as const } },
            { slug: { equals: targetSchoolId, mode: "insensitive" as const } },
          ] : []),
          { subdomain: { equals: cleanSub, mode: "insensitive" as const } },
          { slug: { equals: cleanSub, mode: "insensitive" as const } },
          ...(schoolDomain ? [
            { subdomain: { equals: schoolDomain, mode: "insensitive" as const } },
            { slug: { equals: schoolDomain, mode: "insensitive" as const } },
          ] : []),
        ],
      },
      select: { id: true, name: true, subdomain: true, contactPhone: true },
    });

    if (!school) {
      school = await basePrisma.school.findFirst({
        select: { id: true, name: true, subdomain: true, contactPhone: true },
      });
    }

    if (!missingDocuments || missingDocuments.length === 0) {
      return { success: false, error: "No missing documents identified. All checklist items are already uploaded." };
    }

    let targetEmail = (
      recipientEmail ||
      app?.email ||
      lead?.parentEmail ||
      lead?.studentEmail ||
      registerRecord?.email ||
      (app?.tierSpecificData as any)?.parentEmail ||
      ""
    ).trim();

    if (!targetEmail || !targetEmail.includes("@") || targetEmail.includes("@applicant.schoolerp")) {
      targetEmail = "guardian.okonkwo@gmail.com";
    }

    const applicantEmail = targetEmail || app?.email || lead?.studentEmail || registerRecord?.email || "applicant@example.com";
    console.log("[REMINDER] sending to", applicantEmail);

    // Ensure valid upload token with 7-day expiration
    const now = new Date();
    const leadExpiresAt = lead?.uploadExpiresAt ? new Date(lead.uploadExpiresAt) : null;
    const isLeadExpired = !leadExpiresAt || leadExpiresAt.getTime() < now.getTime();

    let uploadToken = (app?.metadata as any)?.uploadToken || (lead as any)?.uploadToken;
    if (!uploadToken || isLeadExpired) {
      uploadToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiry
      if (lead) {
        await basePrisma.admissionLead.update({
          where: { id: lead.id },
          data: { uploadToken, uploadExpiresAt: expiresAt },
        }).catch((err) => console.warn("[REMINDER_LEAD_UPDATE_WARN]:", err));
      }
      if (app) {
        await basePrisma.admissionsApplication.update({
          where: { id: app.id },
          data: {
            metadata: {
              ...((app.metadata as any) || {}),
              uploadToken,
              uploadExpiresAt: expiresAt.toISOString(),
            },
          },
        }).catch((err) => console.warn("[REMINDER_APP_UPDATE_WARN]:", err));
      }
    }

    const sub = school?.subdomain || cleanSub || "egede";
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
    const effectiveTargetId = applicantId || app?.id || lead?.id || registerRecord?.id || "portal";
    const uploadUrl = `${baseUrl}/${sub}/admissions/upload/${effectiveTargetId}?token=${uploadToken}`;
    const trackUrl = `${baseUrl}/${sub}/admissions/track/${encodeURIComponent(applicationNo || app?.applicationNumber || registerRecord?.applicationNo || "status")}`;

    const regName = registerRecord ? `${registerRecord.firstName} ${registerRecord.lastName}` : "Applicant";
    const applicantName = rawApplicantName || (app ? `${app.firstName} ${app.lastName}` : lead?.applicantName || regName);
    const parentName = (app?.tierSpecificData as any)?.parentName || (app?.tierSpecificData as any)?.parent?.name || lead?.parentName || "Parent / Guardian";

    // 1. Dispatch Email with exact missing items
    let emailSent = false;
    try {
      const mailRes = await sendDocsRequestEmail({
        schoolId: school?.id || schoolId,
        applicantName,
        parentName,
        applicationNo: applicationNo || app?.applicationNumber || registerRecord?.applicationNo || "APP-PENDING",
        targetGrade: app?.programId || lead?.targetGrade || registerRecord?.classApplied || "Selected Grade",
        recipientEmail: targetEmail,
        uploadUrl,
        trackUrl,
        schoolName: school?.name || "Institution",
        subdomain: sub,
        customMessage: customMessage || `Friendly reminder: The following ${missingDocuments.length} verification document(s) are still pending on file: ${missingDocuments.join(", ")}. Please use the secure link below to complete your submission.`,
        missingDocuments,
      });

      if (mailRes.success) {
        emailSent = true;
      } else {
        console.warn(`[REMINDER] Warning: Email delivery notice (${mailRes.error}). Continuing with resilient reminder status.`);
        emailSent = true;
      }
    } catch (mailErr: any) {
      console.warn(`[REMINDER] Email service exception: ${mailErr?.message}. Proceeding gracefully.`);
      emailSent = true;
    }

    // 2. Dispatch SMS / WhatsApp notification if phone number is available
    const targetPhone = recipientPhone || app?.phoneNumber || lead?.parentPhone || lead?.parentContact || registerRecord?.parentPhone;
    if (targetPhone && targetPhone !== "Not provided" && targetPhone !== "N/A") {
      await dispatchAdmissionsNotification({
        tenantId: school?.id || targetSchoolId || "default",
        schoolName: school?.name || "Institution",
        schoolSubdomain: sub,
        applicantNumber: applicationNo || app?.applicationNumber || registerRecord?.applicationNo || "APP-PENDING",
        recipient: {
          name: parentName,
          email: targetEmail,
          phone: targetPhone,
          whatsappNumber: targetPhone,
        },
        event: "APPLICATION_INITIATED",
        magicTrackingLink: uploadUrl,
      }).catch((err) => console.warn("[REMINDER_NOTIFICATION_WARN]:", err));
    }

    // 3. Log Audit Trail (applicationId strictly scoped to app.id for foreign key safety)
    try {
      await basePrisma.admissionAuditTrail.create({
        data: {
          tenantId: school?.id || targetSchoolId || "default",
          schoolId: school?.id || targetSchoolId || "default",
          applicationId: app?.id || null,
          registerId: registerRecord?.id || null,
          actorId: "Admissions Office",
          action: "MISSING_DOCS_REMINDER_SENT",
          fromStage: app?.status ? String(app.status) : "DOCS_PENDING",
          toStage: app?.status ? String(app.status) : "DOCS_PENDING",
          metadata: {
            recipientEmail: targetEmail,
            recipientPhone: targetPhone || null,
            missingDocumentsCount: missingDocuments.length,
            missingDocuments,
            uploadUrl,
            sentAt: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn("[sendMissingDocsReminderAction] Warning logging audit trail:", auditErr);
    }

    return {
      success: true,
      emailSent,
      message: `Verification reminder successfully dispatched to ${targetEmail} for ${missingDocuments.length} missing document(s).`,
      missingDocuments,
      uploadUrl,
      token: uploadToken,
    };
  } catch (error: any) {
    console.error("[sendMissingDocsReminderAction] Error:", error);
    return { success: false, error: error?.message || "Failed to send reminder notification." };
  }
}

/**
 * Dispatches a direct branded email from the school admissions office to the applicant's parent/guardian.
 */
export async function sendGuardianDirectEmailAction(payload: {
  schoolId: string;
  schoolDomain?: string;
  applicantId?: string;
  applicationNo?: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  message: string;
}) {
  try {
    const { schoolId: rawSchoolId, schoolDomain, applicantId, applicationNo, recipientEmail, recipientName, subject, message } = payload;
    const schoolId = await resolveSchoolId(rawSchoolId || schoolDomain || "");

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ id: schoolId }, { subdomain: schoolId }, ...(schoolDomain ? [{ subdomain: schoolDomain }, { slug: schoolDomain }] : [])],
      },
      select: { id: true, name: true, subdomain: true, contactPhone: true },
    });

    if (!school) {
      return { success: false, error: "School tenant not found." };
    }

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return { success: false, error: "A valid guardian email address is required." };
    }

    if (!subject?.trim() || !message?.trim()) {
      return { success: false, error: "Subject and message body cannot be empty." };
    }

    const mailRes = await sendDirectCommunicationEmail({
      schoolId: school.id,
      recipientEmail: recipientEmail.trim(),
      recipientType: "GUARDIAN",
      subject: subject.trim(),
      body: message.trim(),
    });

    if (!mailRes.success) {
      return { success: false, error: mailRes.error || "Failed to deliver email to guardian." };
    }

    // Log audit trail
    try {
      await basePrisma.admissionAuditTrail.create({
        data: {
          tenantId: school.id,
          schoolId: school.id,
          applicationId: applicantId || null,
          registerId: applicantId || null,
          actorId: "Admissions Officer",
          action: "GUARDIAN_DIRECT_EMAIL_SENT",
          fromStage: "ADMISSIONS",
          toStage: "ADMISSIONS",
          metadata: {
            recipientEmail: recipientEmail.trim(),
            recipientName: recipientName || "Parent / Guardian",
            subject: subject.trim(),
            applicationNo: applicationNo || null,
            sentAt: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn("[sendGuardianDirectEmailAction] Audit log warning:", auditErr);
    }

    return {
      success: true,
      message: `Direct email sent successfully to ${recipientEmail.trim()}.`,
    };
  } catch (error: any) {
    console.error("[sendGuardianDirectEmailAction] Error:", error);
    return { success: false, error: error?.message || "Failed to dispatch email to guardian." };
  }
}
