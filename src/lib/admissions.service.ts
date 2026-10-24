import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { checkRouteAuthorization as baseCheckRouteAuth } from "@/lib/permissions";
import {
  AdmissionStatus,
  AdmissionStatusLog,
  AdmissionRegisterRecord,
  DuplicateCheckMatch,
  AdmissionsAuthResult,
} from "./admissions.types";

/**
 * Normalization helpers according to v2.2 specification
 */
export function normalizeName(name?: string | null): string {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("234")) {
    digits = digits.slice(3);
  }
  digits = digits.replace(/^0+/, "");
  return digits;
}

export function normalizeEmail(email?: string | null): string {
  if (!email) return "";
  return email.toLowerCase().trim();
}

/**
 * Calculates string similarity using normalized Levenshtein metric [0.0 - 1.0]
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLen;
}

/**
 * Extracts effective schoolId/tenantId from session
 */
export function getTenantFromSession(session: any): string {
  if (!session) return "";
  return (
    session.schoolId ||
    session.tenantId ||
    session.user?.schoolId ||
    session.user?.tenantId ||
    session.schoolDomain ||
    session.user?.schoolDomain ||
    ""
  );
}

/**
 * Role-Based Access Control evaluator for admissions actions
 * Mutators allowed: REGISTRAR, ADMISSIONS_OFFICER, SCHOOL_ADMIN, SUPER_ADMIN
 */
export function checkRouteAuthorization(
  session: any,
  opts?: { resource?: string; action?: "view" | "mutate" }
): AdmissionsAuthResult {
  const role = (
    session?.role ||
    session?.user?.role ||
    (session as any)?.userRole ||
    ""
  ).toUpperCase();
  const staffRole = (
    session?.staffRole ||
    session?.user?.staffRole ||
    ""
  ).toUpperCase();

  const isSuperAdmin =
    role === "SUPER_ADMIN" ||
    role === "SUPERADMIN" ||
    staffRole.includes("SUPER-ADMIN") ||
    staffRole.includes("SUPER_ADMIN");

  const isSchoolAdmin =
    role === "ADMIN" ||
    role === "SCHOOL_ADMIN" ||
    role === "TENANT_ADMIN" ||
    staffRole.includes("ADMIN") ||
    staffRole.includes("PRINCIPAL") ||
    staffRole.includes("DIRECTOR") ||
    staffRole.includes("HEADMASTER") ||
    staffRole.includes("HEADMISTRESS") ||
    staffRole.includes("PROPRIETOR");

  const isRegistrar =
    staffRole.includes("REGISTRAR") || role.includes("REGISTRAR");

  const isAdmissionsOfficer =
    staffRole.includes("ADMISSION") ||
    staffRole.includes("ENROLLMENT") ||
    role.includes("ADMISSION");

  const canMutate =
    isSuperAdmin || isSchoolAdmin || isRegistrar || isAdmissionsOfficer;

  // If requesting mutate action and user is not in the allowed mutator roles:
  if (opts?.action === "mutate") {
    if (!canMutate) {
      return {
        allowed: false,
        canMutate: false,
        role,
        staffRole,
        reason:
          "Access Denied: State mutation requires authorized Registrar, Admissions Officer, School Admin, or Super Admin privileges.",
      };
    }
  }

  // Fallback to base route check for general read/view access
  const baseResult = baseCheckRouteAuth(
    "/admissions",
    session?.role || session?.user?.role,
    session?.staffRole || session?.user?.staffRole
  );

  return {
    allowed: baseResult.allowed,
    canMutate,
    role,
    staffRole,
    reason: baseResult.reason,
  };
}

/**
 * Deduplication Scanner: compound key [schoolId + normalizedName + normalizedPhone/Email]
 * with >85% fuzzy match AND phone/email match
 */
export async function checkDuplicate(
  schoolId: string,
  name: string,
  phone?: string | null,
  email?: string | null
): Promise<DuplicateCheckMatch> {
  const normName = normalizeName(name);
  const normPhone = normalizePhone(phone);
  const normEmail = normalizeEmail(email);

  if (!normName && !normPhone && !normEmail) {
    return { isDuplicate: false };
  }

  // 1. Scan AdmissionRegister
  const registerEntries = await basePrisma.admissionRegister.findMany({
    where: { tenantId: schoolId },
    select: {
      id: true,
      tenantId: true,
      applicationNo: true,
      firstName: true,
      lastName: true,
      classApplied: true,
      parentPhone: true,
      email: true,
      status: true,
      credentialsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  for (const reg of registerEntries) {
    const regName = normalizeName(`${reg.firstName} ${reg.lastName}`);
    const regPhone = normalizePhone(reg.parentPhone);
    const regEmail = normalizeEmail(reg.email);

    const nameSim = calculateStringSimilarity(normName, regName);
    const phoneMatch = Boolean(normPhone && regPhone && normPhone === regPhone);
    const emailMatch = Boolean(normEmail && regEmail && normEmail === regEmail);

    // Exact compound match
    if (normName === regName && (phoneMatch || emailMatch)) {
      return {
        isDuplicate: true,
        matchType: "exact",
        confidence: 1.0,
        existingRegister: reg as any,
        matchedFields: [
          ...(normName === regName ? ["name"] : []),
          ...(phoneMatch ? ["phone"] : []),
          ...(emailMatch ? ["email"] : []),
        ],
        normalizedCompoundKey: `${schoolId}::${normName}::${normPhone || normEmail}`,
      };
    }

    // Fuzzy match > 85% AND phone or email matches
    if (nameSim >= 0.85 && (phoneMatch || emailMatch)) {
      return {
        isDuplicate: true,
        matchType: "fuzzy",
        confidence: nameSim,
        existingRegister: reg as any,
        matchedFields: [
          `name (${Math.round(nameSim * 100)}% fuzzy)`,
          ...(phoneMatch ? ["phone"] : []),
          ...(emailMatch ? ["email"] : []),
        ],
        normalizedCompoundKey: `${schoolId}::${normName}::${normPhone || normEmail}`,
      };
    }
  }

  // 2. Scan AdmissionLead
  const leadEntries = await basePrisma.admissionLead.findMany({
    where: { schoolId },
    select: {
      id: true,
      applicantName: true,
      parentContact: true,
      parentPhone: true,
      parentEmail: true,
      status: true,
      targetGrade: true,
      createdAt: true,
    },
  });

  for (const lead of leadEntries) {
    const leadName = normalizeName(lead.applicantName);
    const leadPhone = normalizePhone(lead.parentPhone || lead.parentContact);
    const leadEmail = normalizeEmail(lead.parentEmail);

    const nameSim = calculateStringSimilarity(normName, leadName);
    const phoneMatch = Boolean(normPhone && leadPhone && normPhone === leadPhone);
    const emailMatch = Boolean(normEmail && leadEmail && normEmail === leadEmail);

    if (normName === leadName && (phoneMatch || emailMatch)) {
      return {
        isDuplicate: true,
        matchType: "exact",
        confidence: 1.0,
        existingLead: lead,
        matchedFields: [
          ...(normName === leadName ? ["name"] : []),
          ...(phoneMatch ? ["phone"] : []),
          ...(emailMatch ? ["email"] : []),
        ],
        normalizedCompoundKey: `${schoolId}::${normName}::${normPhone || normEmail}`,
      };
    }

    if (nameSim >= 0.85 && (phoneMatch || emailMatch)) {
      return {
        isDuplicate: true,
        matchType: "fuzzy",
        confidence: nameSim,
        existingLead: lead,
        matchedFields: [
          `name (${Math.round(nameSim * 100)}% fuzzy)`,
          ...(phoneMatch ? ["phone"] : []),
          ...(emailMatch ? ["email"] : []),
        ],
        normalizedCompoundKey: `${schoolId}::${normName}::${normPhone || normEmail}`,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Transitions an applicant lead into the live AdmissionRegister model inside an atomic Prisma $transaction.
 *
 * Steps:
 * a) Create/Merge AdmissionRegister { status: 'DOCS_PENDING' }
 * b) Update AdmissionLeads { status: 'CONVERTED' } - never hard delete
 * c) Create AdmissionStatusLog { fromStatus, toStatus, changedById, reason }
 */
export async function convertLeadToRegister(
  leadId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    classApplied?: string;
    parentPhone?: string;
    email?: string;
    documents?: any[];
    formFeePaid?: boolean;
    reason?: string;
  },
  session: any
) {
  const schoolId = getTenantFromSession(session);
  const operatorId =
    session?.userId ||
    session?.user?.id ||
    session?.name ||
    session?.user?.name ||
    "System State Machine";

  const lead = await basePrisma.admissionLead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error(`Admission lead not found with ID: ${leadId}`);
  }

  const effectiveSchoolId = schoolId || lead.schoolId;

  // Split name if not provided separately
  let fName = payload.firstName?.trim();
  let lName = payload.lastName?.trim();
  if (!fName || !lName) {
    const parts = (lead.applicantName || "").trim().split(/\s+/);
    fName = fName || parts[0] || "Applicant";
    lName = lName || (parts.length > 1 ? parts.slice(1).join(" ") : "Candidate");
  }

  const pPhone = payload.parentPhone || lead.parentPhone || lead.parentContact || "N/A";
  const pEmail = payload.email || lead.parentEmail || lead.studentEmail || null;
  const targetClass = payload.classApplied || lead.targetGrade || "Unassigned";

  // Check duplicate inside register
  const dupCheck = await checkDuplicate(effectiveSchoolId, `${fName} ${lName}`, pPhone, pEmail);

  return await basePrisma.$transaction(async (tx) => {
    let registerRecord: any = null;
    const fromStatus = lead.status || "INQUIRY";
    const toStatus: AdmissionStatus = "DOCS_PENDING";
    const statusLog: AdmissionStatusLog = {
      fromStatus,
      toStatus,
      changedById: operatorId,
      reason: payload.reason || "Converted from prospective inquiry to active register",
      createdAt: new Date().toISOString(),
      leadId,
    };

    if (dupCheck.isDuplicate && dupCheck.existingRegister) {
      // Merge into existing record
      const existing = dupCheck.existingRegister;
      const existingCreds =
        typeof existing.credentialsJson === "object" && existing.credentialsJson !== null
          ? existing.credentialsJson
          : {};

      const existingDocs = Array.isArray(existingCreds.documents)
        ? existingCreds.documents
        : Array.isArray(existingCreds)
        ? existingCreds
        : [];

      const newDocs = Array.isArray(payload.documents) ? payload.documents : [];
      const mergedDocs = [...existingDocs, ...newDocs];

      const existingLogs = Array.isArray(existingCreds.statusLogs)
        ? existingCreds.statusLogs
        : [];
      const updatedLogs = [...existingLogs, statusLog];

      registerRecord = await tx.admissionRegister.update({
        where: { id: existing.id },
        data: {
          parentPhone: pPhone || existing.parentPhone,
          email: pEmail || existing.email,
          classApplied: targetClass || existing.classApplied,
          credentialsJson: {
            ...existingCreds,
            documents: mergedDocs,
            statusLogs: updatedLogs,
            formFeePaid: payload.formFeePaid ?? existingCreds.formFeePaid ?? false,
            convertedFromLead: true,
            leadSource: lead.source || existingCreds.leadSource || "Portal Inquiry",
            leadId,
          } as any,
          status: "DOCS_PENDING",
        },
      });
    } else {
      // Create new register record
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const applicationNo = `ADM-${year}-${rand}`;

      registerRecord = await tx.admissionRegister.create({
        data: {
          tenantId: effectiveSchoolId,
          applicationNo,
          firstName: fName,
          lastName: lName,
          classApplied: targetClass,
          parentPhone: pPhone,
          email: pEmail,
          status: "DOCS_PENDING",
          credentialsJson: {
            documents: payload.documents || [],
            statusLogs: [statusLog],
            formFeePaid: Boolean(payload.formFeePaid),
            convertedFromLead: true,
            leadSource: lead.source || "Portal Inquiry",
            leadId,
          } as any,
        },
      });
    }

    // b) Update AdmissionLeads { status: CONVERTED } - do NOT delete
    const existingLeadLogs = Array.isArray(lead.logs) ? (lead.logs as any[]) : [];
    const updatedLeadLogs = [
      ...existingLeadLogs,
      {
        ...statusLog,
        applicationNo: registerRecord.applicationNo,
        action: "LEAD_CONVERTED_TO_REGISTER",
      },
    ];

    const updatedLead = await tx.admissionLead.update({
      where: { id: leadId },
      data: {
        status: "CONVERTED",
        logs: updatedLeadLogs as any,
      },
    });

    // c) Record in central AuditLog table
    await tx.auditLog.create({
      data: {
        schoolId: effectiveSchoolId,
        tenantId: effectiveSchoolId,
        actorId: operatorId,
        action: "ADMISSION_LEAD_CONVERTED",
        target: registerRecord.id,
        metadata: {
          leadId,
          registerId: registerRecord.id,
          applicationNo: registerRecord.applicationNo,
          fromStatus,
          toStatus,
          changedById: operatorId,
          reason: statusLog.reason,
        },
      },
    });

    return {
      success: true,
      registerRecord,
      leadRecord: updatedLead,
      isMerged: Boolean(dupCheck.existingRegister),
      applicationNo: registerRecord.applicationNo,
    };
  });
}
