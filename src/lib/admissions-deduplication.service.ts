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
 * Executes full deduplication across AdmissionLead and AdmissionRegister for a specific tenant.
 * Consolidates duplicate profiles into single master records and safely deletes redundant rows in a transaction.
 */
export async function deduplicateTenantAdmissions(schoolId: string) {
  let leadsMergedGroups = 0;
  let leadsPurgedCount = 0;
  let registersMergedGroups = 0;
  let registersPurgedCount = 0;

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

  return {
    totalMergedGroups: leadsMergedGroups + registersMergedGroups,
    totalPurged: leadsPurgedCount + registersPurgedCount,
    leadsMergedGroups,
    leadsPurgedCount,
    registersMergedGroups,
    registersPurgedCount,
  };
}

