import { basePrisma } from "@/lib/tenant-prisma";

/**
 * Normalization helpers for Compound Validation Key:
 * [Candidate Name + Class/Grade + Parent Phone Number]
 */
export function normalizeCandidateName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeCandidateGrade(grade?: string | null): string {
  if (!grade) return "";
  return grade
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeParentPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/[^0-9]/g, "");
  // Last 10 digits covers +23480..., 23480..., 080...
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function buildDeduplicationCompoundKey(
  name?: string | null,
  grade?: string | null,
  phone?: string | null
): string {
  const normName = normalizeCandidateName(name);
  const normGrade = normalizeCandidateGrade(grade);
  const normPhone = normalizeParentPhone(phone);
  return `${normName}|${normGrade}|${normPhone}`;
}

export function normalizeDobOrAge(
  dob?: Date | string | null,
  age?: number | string | null
): {
  birthYear: string;
  approxAge: number | null;
} {
  const currentYear = new Date().getFullYear();
  if (dob) {
    const d = new Date(dob);
    if (!isNaN(d.getTime())) {
      const bYear = d.getFullYear();
      const approx = Math.max(0, currentYear - bYear);
      return { birthYear: String(bYear), approxAge: approx };
    }
  }
  if (age !== undefined && age !== null && age !== "") {
    const numericAge = parseInt(String(age).replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numericAge) && numericAge > 0 && numericAge < 100) {
      return { birthYear: String(currentYear - numericAge), approxAge: numericAge };
    }
  }
  return { birthYear: "", approxAge: null };
}

export function normalizeAcademicSession(session?: string | null): string {
  if (!session) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}/${currentYear + 1}`;
  }
  const digits = session.replace(/[^0-9]/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}/${digits.slice(4, 8)}`;
  }
  if (digits.length >= 4) {
    const startYear = parseInt(digits.slice(0, 4), 10);
    return `${startYear}/${startYear + 1}`;
  }
  return session.trim();
}

export function isInstitutionalApplicationNo(appNo?: string | null): boolean {
  if (!appNo) return false;
  // Localized / institutional formats contain slashes (e.g. EGEDE/2026/0001, SCH/2026/0002)
  // or multi-part structured prefixes like APP-EGED-2026-W1234 or ADM-2026-1234
  if (appNo.includes("/")) return true;
  if (/^APP-[A-Z0-9]{4,10}-\d{4}-[A-Z0-9]+$/i.test(appNo)) return true;
  // Temporary portal format is typically APP- followed by short hex (e.g. APP-7F6950)
  if (/^APP-[0-9A-Fa-f]{6}$/.test(appNo)) return false;
  return false;
}

/**
 * Deterministic Matching Key:
 * [PUPIL FULL NAME] + [CLASS] + [AGE/DOB] + [CURRENT_SESSION]
 */
export function buildDeterministicAdmissionKey(params: {
  fullName?: string | null;
  className?: string | null;
  dateOfBirth?: Date | string | null;
  age?: number | string | null;
  session?: string | null;
}): string {
  const normName = normalizeCandidateName(params.fullName);
  const normClass = normalizeCandidateGrade(params.className);
  const { birthYear, approxAge } = normalizeDobOrAge(params.dateOfBirth, params.age);
  const normSession = normalizeAcademicSession(params.session);
  const dobKey = birthYear ? `yr:${birthYear}` : approxAge ? `age:${approxAge}` : "unknown";
  return `${normName}|${normClass}|${dobKey}|${normSession}`;
}

/**
 * Finds an existing AdmissionsApplication record matching the deterministic composite key:
 * [PUPIL FULL NAME] + [CLASS] + [AGE/DOB] + [CURRENT_SESSION] (with phone/email fallback)
 */
export async function findExistingAdmissionsApplication(params: {
  schoolId: string;
  fullName: string;
  className?: string | null;
  dateOfBirth?: Date | string | null;
  age?: number | string | null;
  session?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}) {
  const normTargetName = normalizeCandidateName(params.fullName);
  if (!normTargetName) return null;

  const normTargetClass = normalizeCandidateGrade(params.className);
  const { birthYear: targetBirthYear } = normalizeDobOrAge(params.dateOfBirth, params.age);
  const normTargetSession = normalizeAcademicSession(params.session);
  const normPhone = normalizeParentPhone(params.phoneNumber);
  const normEmail = params.email ? params.email.trim().toLowerCase() : "";

  // Query existing applications for this school
  const candidates = await basePrisma.admissionsApplication.findMany({
    where: {
      schoolId: params.schoolId,
    },
    include: {
      feeTransactions: true,
      documents: true,
      auditTrails: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return candidates.find((app) => {
    const appFullName = normalizeCandidateName(`${app.firstName} ${app.middleName || ""} ${app.lastName}`);
    const appSimpleName = normalizeCandidateName(`${app.firstName} ${app.lastName}`);
    const appReversedName = normalizeCandidateName(`${app.lastName} ${app.firstName}`);

    const nameMatch =
      appFullName === normTargetName ||
      appSimpleName === normTargetName ||
      appReversedName === normTargetName ||
      (normTargetName.length > 5 && (appFullName.includes(normTargetName) || normTargetName.includes(appFullName)));

    if (!nameMatch) return false;

    // Check class / program
    const appClass = normalizeCandidateGrade(
      app.programId || (app.tierSpecificData as any)?.targetGrade || (app.tierSpecificData as any)?.targetClass
    );
    const classMatch = !normTargetClass || !appClass || appClass === normTargetClass;

    // Check DOB / Birth Year
    const { birthYear: appBirthYear } = normalizeDobOrAge(app.dateOfBirth);
    const dobMatch =
      !targetBirthYear ||
      !appBirthYear ||
      targetBirthYear === appBirthYear ||
      Math.abs(parseInt(targetBirthYear, 10) - parseInt(appBirthYear, 10)) <= 1;

    // Check Session
    const appSession = normalizeAcademicSession(app.academicSessionId);
    const sessionMatch = !normTargetSession || !appSession || appSession === normTargetSession;

    // If deterministic key matches: name + class + session + dob
    if (classMatch && sessionMatch && dobMatch) {
      return true;
    }

    // Secondary match: name + verified phone or email
    const appPhone = normalizeParentPhone(
      app.phoneNumber || (app.tierSpecificData as any)?.parentPhone || (app.tierSpecificData as any)?.parent?.phone
    );
    const appEmail = (app.email || "").toLowerCase().trim();

    if (normPhone && appPhone && normPhone === appPhone) return true;
    if (normEmail && appEmail && !appEmail.includes("@applicant.schoolerp") && normEmail === appEmail) return true;

    return false;
  }) || null;
}

const STAGE_RANK: Record<string, number> = {
  ENROLLED: 5,
  ADMITTED: 5,
  CONVERTED: 5,
  APPROVED: 4,
  OFFERED: 4,
  PROVISIONAL: 4,
  INTERVIEW: 3,
  SCREENED: 3,
  EXAM: 3,
  APPLIED: 2,
  DOCS_PENDING: 2,
  UNDER_REVIEW: 2,
  DOCS_SUBMITTED: 2,
  INQUIRY: 1,
  NEW: 1,
};

function getStatusRank(status?: string | null): number {
  if (!status) return 0;
  return STAGE_RANK[status.toUpperCase()] || 1;
}

/**
 * Consolidates duplicate AdmissionLead records into the master record.
 * Preserves the most complete bio-data, documents, exam marks, and audit logs.
 */
export function mergeDuplicateLeads(leads: any[]): { master: any; duplicates: any[] } {
  if (leads.length <= 1) {
    return { master: leads[0], duplicates: [] };
  }

  // Pick master: highest status rank > most documents/scores > earliest createdAt
  const sorted = [...leads].sort((a, b) => {
    const rankA = getStatusRank(a.status);
    const rankB = getStatusRank(b.status);
    if (rankB !== rankA) return rankB - rankA;

    const docsA = a.documents || {};
    const docsB = b.documents || {};
    const completenessA =
      (a.birthCertificateUrl ? 1 : 0) +
      (a.passportPhotoUrl ? 1 : 0) +
      (docsA.entranceScore !== undefined || a.entranceScore !== undefined ? 2 : 0) +
      (docsA.formFeePaid || a.formFeePaid ? 2 : 0);
    const completenessB =
      (b.birthCertificateUrl ? 1 : 0) +
      (b.passportPhotoUrl ? 1 : 0) +
      (docsB.entranceScore !== undefined || b.entranceScore !== undefined ? 2 : 0) +
      (docsB.formFeePaid || b.formFeePaid ? 2 : 0);
    if (completenessB !== completenessA) return completenessB - completenessA;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const master = { ...sorted[0] };
  const duplicates = sorted.slice(1);

  const masterDocs: Record<string, any> =
    typeof master.documents === "object" && master.documents !== null
      ? { ...master.documents }
      : {};

  const masterLogs: any[] = Array.isArray(master.logs) ? [...master.logs] : [];

  for (const dup of duplicates) {
    // Preserve media URLs
    if (!master.birthCertificateUrl && dup.birthCertificateUrl) {
      master.birthCertificateUrl = dup.birthCertificateUrl;
    }
    if (!master.passportPhotoUrl && dup.passportPhotoUrl) {
      master.passportPhotoUrl = dup.passportPhotoUrl;
    }
    if (!master.academicResultsUrl && dup.academicResultsUrl) {
      master.academicResultsUrl = dup.academicResultsUrl;
    }
    if (!master.medicalRecordsUrl && dup.medicalRecordsUrl) {
      master.medicalRecordsUrl = dup.medicalRecordsUrl;
    }

    // Preserve Contact Info
    if (!master.studentEmail && dup.studentEmail) master.studentEmail = dup.studentEmail;
    if (!master.parentEmail && dup.parentEmail) master.parentEmail = dup.parentEmail;
    if (!master.studentPhone && dup.studentPhone) master.studentPhone = dup.studentPhone;
    if (!master.parentName && dup.parentName) master.parentName = dup.parentName;
    if (!master.source && dup.source) master.source = dup.source;
    if (!master.stageId && dup.stageId) master.stageId = dup.stageId;
    if (!master.trackId && dup.trackId) master.trackId = dup.trackId;

    // Merge documents JSON payload (scores, fee status, notes)
    const dupDocs = typeof dup.documents === "object" && dup.documents !== null ? dup.documents : {};
    for (const [k, v] of Object.entries(dupDocs)) {
      if (masterDocs[k] === undefined || masterDocs[k] === null || masterDocs[k] === "") {
        masterDocs[k] = v;
      }
    }

    // Highest exam score
    if (dupDocs.entranceScore !== undefined && dupDocs.entranceScore !== null) {
      const existingScore = Number(masterDocs.entranceScore);
      const dupScore = Number(dupDocs.entranceScore);
      if (isNaN(existingScore) || (!isNaN(dupScore) && dupScore > existingScore)) {
        masterDocs.entranceScore = dupScore;
        masterDocs.examScore = dupScore;
        masterDocs.examAggregate = dupScore;
        masterDocs.manualScoreEntry = true;
        masterDocs.examPassed = dupScore >= 50;
      }
    }

    // Payment verification
    if (dupDocs.formFeePaid || dupDocs.feePaid) {
      masterDocs.formFeePaid = true;
      masterDocs.feePaid = true;
    }

    // Merge duplicate audit logs
    if (Array.isArray(dup.logs)) {
      for (const logItem of dup.logs) {
        masterLogs.push({
          ...logItem,
          mergedFromLeadId: dup.id,
        });
      }
    }
  }

  masterLogs.push({
    timestamp: new Date().toISOString(),
    action: "RECORD_DEDUPLICATION_MERGE",
    note: `Automated deduplication merged ${duplicates.length} duplicate lead profile(s) (${duplicates.map((d) => d.id).join(", ")}) into master record.`,
  });

  master.documents = masterDocs;
  master.logs = masterLogs;

  return { master, duplicates };
}

/**
 * Consolidates duplicate AdmissionRegister records into the master record.
 */
export function mergeDuplicateRegisters(registers: any[]): { master: any; duplicates: any[] } {
  if (registers.length <= 1) {
    return { master: registers[0], duplicates: [] };
  }

  const sorted = [...registers].sort((a, b) => {
    const rankA = getStatusRank(a.status);
    const rankB = getStatusRank(b.status);
    if (rankB !== rankA) return rankB - rankA;

    const credsA = Array.isArray(a.credentialsJson) ? a.credentialsJson.length : 0;
    const credsB = Array.isArray(b.credentialsJson) ? b.credentialsJson.length : 0;
    if (credsB !== credsA) return credsB - credsA;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const master = { ...sorted[0] };
  const duplicates = sorted.slice(1);

  const masterCreds: any[] = Array.isArray(master.credentialsJson)
    ? [...master.credentialsJson]
    : [];

  for (const dup of duplicates) {
    if (!master.email && dup.email) master.email = dup.email;
    if (!master.cycleId && dup.cycleId) master.cycleId = dup.cycleId;
    if (!master.stageId && dup.stageId) master.stageId = dup.stageId;
    if (!master.trackId && dup.trackId) master.trackId = dup.trackId;
    if (!master.verifiedBy && dup.verifiedBy) master.verifiedBy = dup.verifiedBy;
    if (!master.verifiedAt && dup.verifiedAt) master.verifiedAt = dup.verifiedAt;
    if (!master.admittedAt && dup.admittedAt) master.admittedAt = dup.admittedAt;

    // Merge credentials
    if (Array.isArray(dup.credentialsJson)) {
      for (const cred of dup.credentialsJson) {
        const alreadyExists = masterCreds.some(
          (c) =>
            (c.type && c.type === cred.type) ||
            (c.path && c.path === cred.path) ||
            (c.url && c.url === cred.url) ||
            (c.name && c.name === cred.name)
        );
        if (!alreadyExists) {
          masterCreds.push(cred);
        }
      }
    }
  }

  master.credentialsJson = masterCreds;

  return { master, duplicates };
}

/**
 * Consolidates duplicate AdmissionsApplication records into the master record.
 * Prioritizes finalized/institutional application number format (e.g. EGEDE/2026/0001) over temporary portal ID (APP-XXXXXX),
 * preserves documents, fee transactions, uploadToken, and audit trails.
 */
export function mergeDuplicateAdmissionsApplications(applications: any[]): { master: any; duplicates: any[] } {
  if (applications.length <= 1) {
    return { master: applications[0], duplicates: [] };
  }

  const sorted = [...applications].sort((a, b) => {
    // 1. Prefer institutional localized application numbers (e.g. EGEDE/2026/0001) over temporary portal IDs (e.g. APP-7F6950)
    const isInstA = isInstitutionalApplicationNo(a.applicationNumber) ? 1 : 0;
    const isInstB = isInstitutionalApplicationNo(b.applicationNumber) ? 1 : 0;
    if (isInstB !== isInstA) return isInstB - isInstA;

    // 2. Higher status rank
    const rankA = getStatusRank(a.status);
    const rankB = getStatusRank(b.status);
    if (rankB !== rankA) return rankB - rankA;

    // 3. Settled fee transactions or more documents
    const feesA = Array.isArray(a.feeTransactions) ? a.feeTransactions.filter((f: any) => f.paymentStatus === "SETTLED").length : 0;
    const feesB = Array.isArray(b.feeTransactions) ? b.feeTransactions.filter((f: any) => f.paymentStatus === "SETTLED").length : 0;
    if (feesB !== feesA) return feesB - feesA;

    const docsA = Array.isArray(a.documents) ? a.documents.length : 0;
    const docsB = Array.isArray(b.documents) ? b.documents.length : 0;
    if (docsB !== docsA) return docsB - docsA;

    // 4. Earliest created
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const master = { ...sorted[0] };
  const duplicates = sorted.slice(1);

  const masterTierData =
    typeof master.tierSpecificData === "object" && master.tierSpecificData !== null
      ? { ...master.tierSpecificData }
      : {};

  const masterMetadata =
    typeof master.metadata === "object" && master.metadata !== null
      ? { ...master.metadata }
      : {};

  for (const dup of duplicates) {
    const dupTierData =
      typeof dup.tierSpecificData === "object" && dup.tierSpecificData !== null
        ? dup.tierSpecificData
        : {};
    for (const [k, v] of Object.entries(dupTierData)) {
      if (masterTierData[k] === undefined || masterTierData[k] === null || masterTierData[k] === "") {
        masterTierData[k] = v;
      }
    }

    const dupMetadata =
      typeof dup.metadata === "object" && dup.metadata !== null
        ? dup.metadata
        : {};
    for (const [k, v] of Object.entries(dupMetadata)) {
      if (masterMetadata[k] === undefined || masterMetadata[k] === null || masterMetadata[k] === "") {
        masterMetadata[k] = v;
      }
    }

    // Ensure uploadToken from duplicate portal session is preserved
    if (!masterMetadata.uploadToken && dupMetadata.uploadToken) {
      masterMetadata.uploadToken = dupMetadata.uploadToken;
    }

    if (!master.middleName && dup.middleName) master.middleName = dup.middleName;
    if ((!master.email || master.email.includes("@applicant.schoolerp")) && dup.email && !dup.email.includes("@applicant.schoolerp")) {
      master.email = dup.email;
    }
    if ((!master.phoneNumber || master.phoneNumber === "N/A") && dup.phoneNumber && dup.phoneNumber !== "N/A") {
      master.phoneNumber = dup.phoneNumber;
    }
    if (!master.whatsappNumber && dup.whatsappNumber) {
      master.whatsappNumber = dup.whatsappNumber;
    }
  }

  master.tierSpecificData = masterTierData;
  master.metadata = masterMetadata;

  return { master, duplicates };
}

/**
 * Executes full deduplication across AdmissionLead, AdmissionRegister, and AdmissionsApplication for a specific tenant.
 * Consolidates duplicate profiles into single master records and safely deletes redundant rows in a transaction.
 */
export async function deduplicateTenantAdmissions(schoolId: string) {
  let leadsMergedGroups = 0;
  let leadsPurgedCount = 0;
  let registersMergedGroups = 0;
  let registersPurgedCount = 0;
  let applicationsMergedGroups = 0;
  let applicationsPurgedCount = 0;

  // =========================================================================
  // 1. DEDUPLICATE ADMISSION LEADS
  // =========================================================================
  const allLeads = await basePrisma.admissionLead.findMany({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });

  const leadGroups = new Map<string, any[]>();
  for (const lead of allLeads) {
    const key = buildDeduplicationCompoundKey(
      lead.applicantName,
      lead.targetGrade,
      lead.parentPhone || lead.parentContact
    );
    if (!key || key === "||") continue;

    const existing = leadGroups.get(key) || [];
    existing.push(lead);
    leadGroups.set(key, existing);
  }

  for (const [, group] of leadGroups.entries()) {
    if (group.length > 1) {
      const { master, duplicates } = mergeDuplicateLeads(group);
      const duplicateIds = duplicates.map((d) => d.id);

      await basePrisma.$transaction(async (tx) => {
        // Update master lead
        await tx.admissionLead.update({
          where: { id: master.id },
          data: {
            applicantName: master.applicantName,
            targetGrade: master.targetGrade,
            parentContact: master.parentContact,
            parentPhone: master.parentPhone,
            parentEmail: master.parentEmail,
            studentEmail: master.studentEmail,
            studentPhone: master.studentPhone,
            parentName: master.parentName,
            birthCertificateUrl: master.birthCertificateUrl,
            passportPhotoUrl: master.passportPhotoUrl,
            academicResultsUrl: master.academicResultsUrl,
            medicalRecordsUrl: master.medicalRecordsUrl,
            documents: master.documents,
            logs: master.logs,
            stageId: master.stageId,
            trackId: master.trackId,
            status: master.status,
          },
        });

        // Reassign any notes from duplicates to master
        await tx.admissionNote.updateMany({
          where: { studentLeadId: { in: duplicateIds } },
          data: { studentLeadId: master.id },
        });

        // Delete redundant duplicate leads
        await tx.admissionLead.deleteMany({
          where: { id: { in: duplicateIds } },
        });
      });

      leadsMergedGroups++;
      leadsPurgedCount += duplicates.length;
    }
  }

  // =========================================================================
  // 2. DEDUPLICATE ADMISSION REGISTER CANDIDATES
  // =========================================================================
  const allRegisters = await basePrisma.admissionRegister.findMany({
    where: { tenantId: schoolId },
    orderBy: { createdAt: "asc" },
  });

  const registerGroups = new Map<string, any[]>();
  for (const reg of allRegisters) {
    const fullName = `${reg.firstName || ""} ${reg.lastName || ""}`.trim();
    const key = buildDeduplicationCompoundKey(fullName, reg.classApplied, reg.parentPhone);
    if (!key || key === "||") continue;

    const existing = registerGroups.get(key) || [];
    existing.push(reg);
    registerGroups.set(key, existing);
  }

  for (const [, group] of registerGroups.entries()) {
    if (group.length > 1) {
      const { master, duplicates } = mergeDuplicateRegisters(group);
      const duplicateIds = duplicates.map((d) => d.id);

      await basePrisma.$transaction(async (tx) => {
        // Update master register
        await tx.admissionRegister.update({
          where: { id: master.id },
          data: {
            email: master.email,
            cycleId: master.cycleId,
            stageId: master.stageId,
            trackId: master.trackId,
            credentialsJson: master.credentialsJson,
            status: master.status,
            verifiedBy: master.verifiedBy,
            verifiedAt: master.verifiedAt,
            admittedAt: master.admittedAt,
          },
        });

        // Re-link audit trails to master
        await tx.admissionAuditTrail.updateMany({
          where: { registerId: { in: duplicateIds } },
          data: { registerId: master.id },
        });

        // Delete redundant duplicate register records
        await tx.admissionRegister.deleteMany({
          where: { id: { in: duplicateIds } },
        });
      });

      registersMergedGroups++;
      registersPurgedCount += duplicates.length;
    }
  }

  // =========================================================================
  // 3. DEDUPLICATE ADMISSIONS APPLICATION PIPELINE (PORTAL VS ADMIN ROWS)
  // =========================================================================
  const allApplications = await basePrisma.admissionsApplication.findMany({
    where: { schoolId },
    include: {
      feeTransactions: true,
      documents: true,
      auditTrails: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const appGroups = new Map<string, any[]>();
  for (const app of allApplications) {
    const fullName = `${app.firstName || ""} ${app.middleName || ""} ${app.lastName || ""}`.trim();
    const key = buildDeterministicAdmissionKey({
      fullName,
      className: app.programId,
      dateOfBirth: app.dateOfBirth,
      session: app.academicSessionId,
    });
    if (!key || key === "|||") continue;

    const existing = appGroups.get(key) || [];
    existing.push(app);
    appGroups.set(key, existing);
  }

  for (const [, group] of appGroups.entries()) {
    if (group.length > 1) {
      const { master, duplicates } = mergeDuplicateAdmissionsApplications(group);
      const duplicateIds = duplicates.map((d) => d.id);

      await basePrisma.$transaction(async (tx) => {
        // Update master application
        await tx.admissionsApplication.update({
          where: { id: master.id },
          data: {
            applicationNumber: master.applicationNumber,
            middleName: master.middleName,
            email: master.email,
            phoneNumber: master.phoneNumber,
            whatsappNumber: master.whatsappNumber,
            tierSpecificData: master.tierSpecificData,
            metadata: master.metadata,
            status: master.status,
          },
        });

        // Re-link fee transactions to master
        await tx.admissionsFeeTransaction.updateMany({
          where: { applicationId: { in: duplicateIds } },
          data: { applicationId: master.id },
        });

        // Re-link documents to master
        await tx.admissionsDocument.updateMany({
          where: { applicationId: { in: duplicateIds } },
          data: { applicationId: master.id },
        });

        // Re-link audit trails to master
        await tx.admissionAuditTrail.updateMany({
          where: { applicationId: { in: duplicateIds } },
          data: { applicationId: master.id },
        });

        // Re-link any admission registers referencing duplicate IDs
        await tx.admissionRegister.updateMany({
          where: { applicationNo: { in: duplicates.map((d) => d.applicationNumber) } },
          data: { applicationNo: master.applicationNumber },
        });

        // Delete redundant duplicate applications
        await tx.admissionsApplication.deleteMany({
          where: { id: { in: duplicateIds } },
        });
      });

      applicationsMergedGroups++;
      applicationsPurgedCount += duplicates.length;
    }
  }

  return {
    totalMergedGroups: leadsMergedGroups + registersMergedGroups + applicationsMergedGroups,
    totalPurged: leadsPurgedCount + registersPurgedCount + applicationsPurgedCount,
    leadsMergedGroups,
    leadsPurgedCount,
    registersMergedGroups,
    registersPurgedCount,
    applicationsMergedGroups,
    applicationsPurgedCount,
  };
}

