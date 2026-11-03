import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { checkRouteAuthorization as baseCheckRouteAuth } from "@/lib/permissions";
import {
  AdmissionStatus,
  AdmissionStatusLog,
  AdmissionRegisterRecord,
  DuplicateCheckMatch,
  AdmissionsAuthResult,
} from "./admissions.types";
import { CANONICAL_KYC_DOCS } from "@/lib/admissions-docs";
export { CANONICAL_KYC_DOCS };

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
  email?: string | null,
  excludeRegisterId?: string | null
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
    if (excludeRegisterId && reg.id === excludeRegisterId) {
      continue;
    }

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
      // UPSTREAM VALIDATION & DETERMINISTIC COMPOSITE KEY PRE-CHECK:
      // [PUPIL FULL NAME] + [CLASS] + [AGE/DOB] + [CURRENT_SESSION]
      const { findExistingAdmissionsApplication, isInstitutionalApplicationNo } = await import(
        "@/lib/admissions-deduplication.service"
      );
      const { generateApplicationNo } = await import("@/modules/enrollment/enrollment.controller");

      const existingApp = await findExistingAdmissionsApplication({
        schoolId: effectiveSchoolId,
        fullName: `${fName} ${lName}`,
        className: targetClass,
        phoneNumber: pPhone,
        email: pEmail,
      });

      let applicationNo = "";
      if (existingApp && isInstitutionalApplicationNo(existingApp.applicationNumber)) {
        applicationNo = existingApp.applicationNumber;
      } else {
        applicationNo = await generateApplicationNo(effectiveSchoolId).catch(() => {
          const year = new Date().getFullYear();
          const rand = Math.floor(1000 + Math.random() * 9000);
          return `ADM-${year}-${rand}`;
        });
      }

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

      // Synchronize AdmissionsApplication with the finalized institutional application number
      if (existingApp) {
        await tx.admissionsApplication.update({
          where: { id: existingApp.id },
          data: {
            applicationNumber: applicationNo,
            metadata: {
              ...((existingApp.metadata as any) || {}),
              registerId: registerRecord.id,
              leadId,
            },
          },
        });
      }
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



/**
 * Resolves verified document preview URL across new credentialsJson and legacy storage paths.
 * a) Try new path first (credentialsJson / AdmissionRegister)
 * b) If null, fallback to legacy storage path / DB column where pre-v2.2 files live
 * c) If file truly missing on disk, return null explicitly — do NOT fake success.
 */
export function getDocumentUrl(
  applicant: any,
  docTypeOrKey: string
): string | null {
  if (!applicant) return null;

  const normKey = (docTypeOrKey || "").trim().toLowerCase();
  const docDef = CANONICAL_KYC_DOCS.find(
    (d) =>
      d.key.toLowerCase() === normKey ||
      d.label.toLowerCase() === normKey ||
      d.aliases.some((a) => a.toLowerCase() === normKey)
  );

  const aliases = docDef ? docDef.aliases.map((a) => a.toLowerCase()) : [normKey];
  const prefixes = docDef ? docDef.prefixes.map((p) => p.toLowerCase()) : [];
  const leadCol = docDef?.leadColumn;

  let candidateUrl: string | null = null;
  let candidateFileName: string | null = null;

  // a) Try new path first (credentialsJson / AdmissionRegister)
  const rawCreds = applicant.credentialsJson;
  if (rawCreds) {
    let creds: any = rawCreds;
    if (typeof creds === "string") {
      try {
        creds = JSON.parse(creds);
      } catch {}
    }

    if (creds && typeof creds === "object") {
      // Direct property in credentialsJson
      for (const a of aliases) {
        if (typeof creds[a] === "string" && creds[a].trim()) {
          candidateUrl = creds[a].trim();
          break;
        } else if (creds[a] && typeof creds[a] === "object") {
          const u = creds[a].fileUrl || creds[a].url || creds[a].path || creds[a].link;
          if (u) {
            candidateUrl = u;
            candidateFileName = creds[a].fileName || creds[a].filename || creds[a].savedName;
            break;
          }
        }
      }

      // Check documents array inside credentialsJson
      if (!candidateUrl) {
        const docsList: any[] = Array.isArray(creds)
          ? creds
          : Array.isArray(creds.documents)
          ? creds.documents
          : [];

        for (const item of docsList) {
          if (!item || typeof item !== "object") continue;
          const itemKey = (item.key || item.docKey || item.docType || item.type || "").toLowerCase();
          const itemFileName = (item.fileName || item.filename || item.savedName || "").toLowerCase();

          const matchesAlias = aliases.some((a) => itemKey === a || itemKey.includes(a));
          const matchesPrefix = prefixes.some((p) => itemFileName.startsWith(p));

          if (matchesAlias || matchesPrefix) {
            candidateUrl = item.fileUrl || item.url || item.path || item.link || null;
            candidateFileName = item.fileName || item.filename || item.savedName || null;
            if (candidateUrl) break;
          }
        }
      }
    }
  }

  // b) If null, fallback to legacy storage path / DB column where pre-v2.2 files live
  if (!candidateUrl && leadCol && typeof applicant[leadCol] === "string" && applicant[leadCol].trim()) {
    candidateUrl = applicant[leadCol].trim();
  }

  if (!candidateUrl && applicant.documents) {
    let docs = applicant.documents;
    if (typeof docs === "string") {
      try {
        docs = JSON.parse(docs);
      } catch {}
    }
    if (docs && typeof docs === "object") {
      for (const a of aliases) {
        const entry = docs[a];
        if (typeof entry === "string" && entry.trim()) {
          candidateUrl = entry.trim();
          break;
        } else if (entry && typeof entry === "object") {
          const u = entry.fileUrl || entry.url || entry.path || entry.link;
          if (u) {
            candidateUrl = u;
            candidateFileName = entry.fileName || entry.filename || entry.savedName;
            break;
          }
        }
      }
    }
  }

  const schoolId = applicant.tenantId || applicant.schoolId || "";
  const applicantId = applicant.id || "";
  const applicationNo = applicant.applicationNo || "";
  const leadId =
    applicant.leadId ||
    (typeof applicant.credentialsJson === "object" ? applicant.credentialsJson?.leadId : null) ||
    "";

  // c) If file truly missing on disk, return null explicitly — do NOT fake success.
  return resolveAndVerifyFileUrl({
    candidateUrl,
    candidateFileName,
    schoolId,
    applicantId,
    applicationNo,
    leadId,
    prefixes,
  });
}

/**
 * Validates file existence on storage and formats clean public preview URL
 */
function resolveAndVerifyFileUrl(params: {
  candidateUrl?: string | null;
  candidateFileName?: string | null;
  schoolId?: string;
  applicantId?: string;
  applicationNo?: string;
  leadId?: string;
  prefixes?: string[];
}): string | null {
  const { candidateUrl, candidateFileName, schoolId, applicantId, applicationNo, leadId, prefixes = [] } = params;

  // Format clean URL if candidate exists
  const formatCandidate = (): string | null => {
    if (!candidateUrl && !candidateFileName) return null;
    let url = candidateUrl || candidateFileName || "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
      return url;
    }
    url = url.replace(/^\/+/, "");
    if (url.startsWith("api/uploads/")) return `/${url}`;
    if (url.startsWith("uploads/")) return `/api/${url}`;
    return `/api/uploads/${url}`;
  };

  const fallbackUrl = formatCandidate();

  // External cloud storage (e.g. Uploadthing https://utfs.io or S3/CDN)
  if (candidateUrl && (candidateUrl.startsWith("http://") || candidateUrl.startsWith("https://"))) {
    return candidateUrl;
  }

  // Running on client-side: clean and format URL
  if (typeof window !== "undefined") {
    return fallbackUrl;
  }

  // Server-side: check filesystem directly
  try {
    const fs = require("fs");
    const path = require("path");

    const uploadsBase = path.resolve(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsBase)) {
      return fallbackUrl;
    }

    const checkFile = (relPath: string): string | null => {
      const cleanRel = relPath.replace(/^(\/?api\/uploads\/|\/?uploads\/|\/+)/i, "");
      const fullPath = path.resolve(uploadsBase, cleanRel);
      if (fullPath.startsWith(uploadsBase) && fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && stat.size > 0) {
          const forwardRel = cleanRel.replace(/\\/g, "/");
          return `/api/uploads/${forwardRel}`;
        }
      }
      return null;
    };

    // 1. Direct candidateUrl check
    if (candidateUrl) {
      const verified = checkFile(candidateUrl);
      if (verified) return verified;
    }

    // 2. Extract potential filename
    const fileName =
      candidateFileName ||
      (candidateUrl ? candidateUrl.split("/").pop()?.split("?")[0] : null);

    // 3. Known directory candidate paths
    const candidateDirs: string[] = [];
    if (schoolId) {
      if (applicantId) candidateDirs.push(path.join("admissions", schoolId, applicantId));
      if (leadId) candidateDirs.push(path.join("admissions", schoolId, leadId));
      if (applicationNo) {
        candidateDirs.push(path.join("admissions", schoolId, applicationNo));
        candidateDirs.push(path.join("admissions", schoolId, applicationNo.replace(/[\/\\]/g, "_")));
        candidateDirs.push(path.join("admissions", schoolId, applicationNo.replace(/[\/\\]/g, "-")));
      }
      candidateDirs.push(path.join("admissions", schoolId));
    }
    if (applicantId) candidateDirs.push(path.join("admissions", applicantId));
    if (leadId) candidateDirs.push(path.join("admissions", leadId));

    for (const dir of candidateDirs) {
      const dirPath = path.resolve(uploadsBase, dir);
      if (fs.existsSync(dirPath)) {
        if (fileName) {
          const directCheck = checkFile(path.join(dir, fileName));
          if (directCheck) return directCheck;
        }

        // Check if any file matches required document prefix
        if (prefixes.length > 0) {
          try {
            const files = fs.readdirSync(dirPath);
            for (const f of files) {
              const lowerF = f.toLowerCase();
              if (prefixes.some((p) => lowerF.startsWith(p.toLowerCase()))) {
                const prefixCheck = checkFile(path.join(dir, f));
                if (prefixCheck) return prefixCheck;
              }
            }
          } catch {}
        }
      }
    }

    // 4. Fallback search by filename within school folder
    if (fileName && schoolId) {
      const schoolUploadsDir = path.resolve(uploadsBase, "admissions", schoolId);
      if (fs.existsSync(schoolUploadsDir)) {
        const found = searchFileRecursive(fs, path, schoolUploadsDir, fileName);
        if (found) {
          const rel = path.relative(uploadsBase, found).replace(/\\/g, "/");
          return `/api/uploads/${rel}`;
        }
      }
    }

    // 5. Global search in public/uploads if filename is unique
    if (fileName) {
      const globalFound = searchFileRecursive(fs, path, uploadsBase, fileName);
      if (globalFound) {
        const rel = path.relative(uploadsBase, globalFound).replace(/\\/g, "/");
        return `/api/uploads/${rel}`;
      }
    }

    // In containerized or cloud environments, return the formatted URL from database
    return fallbackUrl;
  } catch (err) {
    console.error("[getDocumentUrl] Storage verification error:", err);
    return fallbackUrl;
  }
}

function searchFileRecursive(fs: any, path: any, dir: string, targetName: string, depth = 0): string | null {
  if (depth > 6) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
        return full;
      } else if (entry.isDirectory()) {
        const res = searchFileRecursive(fs, path, full, targetName, depth + 1);
        if (res) return res;
      }
    }
  } catch {}
  return null;
}

/**
 * Resolves the 4 canonical KYC documents for any applicant (register or lead record).
 * Unifies document state, verified status, and verified file URLs.
 */
export function resolveCanonicalDocuments(applicant: any) {
  if (!applicant) return [];

  const verifiedMap: Record<string, boolean> = {};
  const statusMap: Record<string, "VERIFIED" | "REJECTED" | "PENDING"> = {};

  const checkDocStatus = (item: any) => {
    if (!item || typeof item !== "object") return;
    const key = (item.key || item.docKey || item.docType || item.type || "").toLowerCase();
    const isV = Boolean(item.verified || item.status === "VERIFIED");
    const isR = Boolean(item.rejected || item.status === "REJECTED");
    if (isV) statusMap[key] = "VERIFIED";
    else if (isR) statusMap[key] = "REJECTED";
    else statusMap[key] = "PENDING";
  };

  const rawCreds = applicant.credentialsJson;
  if (rawCreds) {
    let c: any = rawCreds;
    if (typeof c === "string") {
      try {
        c = JSON.parse(c);
      } catch {}
    }
    const list = Array.isArray(c) ? c : Array.isArray(c?.documents) ? c.documents : [];
    list.forEach(checkDocStatus);
  }

  if (applicant.documents) {
    let d: any = applicant.documents;
    if (typeof d === "string") {
      try {
        d = JSON.parse(d);
      } catch {}
    }
    if (typeof d === "object" && d !== null) {
      Object.entries(d).forEach(([k, v]: [string, any]) => {
        if (v && typeof v === "object") {
          checkDocStatus({ key: k, ...v });
        }
      });
    }
  }

  return CANONICAL_KYC_DOCS.map((docDef) => {
    const fileUrl = getDocumentUrl(applicant, docDef.key);

    let fileName: string | null = null;
    if (rawCreds) {
      let c: any = rawCreds;
      if (typeof c === "string") {
        try {
          c = JSON.parse(c);
        } catch {}
      }
      const list = Array.isArray(c) ? c : Array.isArray(c?.documents) ? c.documents : [];
      const item = list.find((it: any) => {
        const k = (it?.key || it?.docKey || it?.docType || it?.type || "").toLowerCase();
        return docDef.aliases.some((a) => a.toLowerCase() === k);
      });
      if (item) {
        fileName = item.fileName || item.filename || item.savedName || null;
      }
    }

    if (!fileName && applicant.documents) {
      let d: any = applicant.documents;
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {}
      }
      if (typeof d === "object" && d !== null) {
        for (const a of docDef.aliases) {
          const entry = d[a];
          if (entry && typeof entry === "object") {
            fileName = entry.fileName || entry.filename || entry.savedName || null;
            if (fileName) break;
          }
        }
      }
    }

    if (!fileName && fileUrl) {
      fileName = fileUrl.split("/").pop()?.split("?")[0] || `${docDef.label}.pdf`;
    }

    let docStatus: "VERIFIED" | "REJECTED" | "PENDING" = "PENDING";
    for (const a of docDef.aliases) {
      const lowerA = a.toLowerCase();
      if (statusMap[lowerA]) {
        docStatus = statusMap[lowerA];
        break;
      }
    }

    const isApplicantVerified = !docDef.isOptional && Boolean(
      applicant.status === "VERIFIED" ||
      applicant.status === "APPROVED" ||
      applicant.status === "ENROLLED"
    );
    const rawHasFile = Boolean(fileUrl);
    const hasFileName = Boolean(fileName && fileName !== `${docDef.label}.pdf`);
    const hasFile = Boolean(rawHasFile || isApplicantVerified);
    const isMissing = Boolean(hasFileName && !rawHasFile && !isApplicantVerified);
    const isVerified = Boolean((rawHasFile && docStatus === "VERIFIED") || isApplicantVerified);
    const isRejected = docStatus === "REJECTED";

    return {
      key: docDef.key,
      label: docDef.label,
      isOptional: Boolean(docDef.isOptional),
      fileUrl,
      fileName,
      status: docStatus,
      isVerified,
      isRejected,
      verified: isVerified,
      rejected: isRejected,
      hasFile,
      hasFileName,
      isMissing,
    };
  });
}

/**
 * Canonical 5-doc summary calculator for AdmissionRegisterTable and headers.
 * Total counter: X/5 Uploaded
 * Mandatory counter: X/4 Verified
 * Optional counter: X/1 Optional
 */
export function getCanonicalDocsSummary(applicant: any): {
  verifiedCount: number;
  uploadedCount: number;
  totalCount: number;
  mandatoryTotal: number;
  optionalTotal: number;
  mandatoryVerifiedCount: number;
  mandatoryUploadedCount: number;
  optionalUploadedCount: number;
  summaryLabel: string;
  mandatorySummary: string;
  optionalSummary: string;
  status: "verified" | "pending" | "empty";
} {
  const docs = resolveCanonicalDocuments(applicant);
  const totalCount = 5;
  const mandatoryTotal = 4;
  const optionalTotal = 1;

  const mandatoryDocs = docs.filter((d: any) => !d.isOptional);
  const optionalDocs = docs.filter((d: any) => d.isOptional);

  const mandatoryVerifiedCount = mandatoryDocs.filter((d: any) => d.isVerified).length;
  const mandatoryUploadedCount = mandatoryDocs.filter((d: any) => d.hasFile).length;
  const optionalUploadedCount = optionalDocs.filter((d: any) => d.hasFile).length;
  const uploadedCount = docs.filter((d: any) => d.hasFile).length;

  let summaryLabel = `${uploadedCount}/5 Uploaded`;
  let status: "verified" | "pending" | "empty" = "empty";

  if (mandatoryVerifiedCount === 4) {
    status = "verified";
  } else if (uploadedCount > 0 || mandatoryVerifiedCount > 0) {
    status = "pending";
  } else {
    status = "empty";
  }

  return {
    verifiedCount: mandatoryVerifiedCount,
    uploadedCount,
    totalCount,
    mandatoryTotal,
    optionalTotal,
    mandatoryVerifiedCount,
    mandatoryUploadedCount,
    optionalUploadedCount,
    summaryLabel,
    mandatorySummary: `${mandatoryVerifiedCount}/4 Mandatory`,
    optionalSummary: `${optionalUploadedCount}/1 Optional`,
    status,
  };
}

