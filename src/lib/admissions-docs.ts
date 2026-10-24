/**
 * Canonical KYC Documents Checklist & Resolver
 * Standardized across Admissions Register and Applicant Dossier
 * 
 * 5 Total Documents:
 * - 4 Mandatory: Passport Photograph, Previous Academic Results, Birth Certificate / Age Declaration, Medical Certificate of Fitness
 * - 1 Optional: Medical Report
 */

export interface CanonicalDocDef {
  key: string;
  label: string;
  leadColumn?: string;
  aliases: string[];
  prefixes: string[];
  isOptional: boolean;
}

export const CANONICAL_KYC_DOCS: CanonicalDocDef[] = [
  {
    key: "passportPhoto",
    label: "Passport Photograph",
    leadColumn: "passportPhotoUrl",
    aliases: [
      "passportPhoto",
      "passport_photo",
      "passport",
      "Recent Passport",
      "passportPhotoUrl",
      "passport_photograph",
    ],
    prefixes: ["passport", "passportphoto", "recent-passport"],
    isOptional: false,
  },
  {
    key: "academicResults",
    label: "Previous Academic Results",
    leadColumn: "academicResultsUrl",
    aliases: [
      "academicResults",
      "academic_results",
      "lastResult",
      "last_result",
      "result",
      "results",
      "academicResultsUrl",
      "previous_results",
      "transcript",
    ],
    prefixes: ["lastresult", "academic-results", "academic_results", "result"],
    isOptional: false,
  },
  {
    key: "birthCertificate",
    label: "Birth Certificate / Age Declaration",
    leadColumn: "birthCertificateUrl",
    aliases: [
      "birthCertificate",
      "birth_certificate",
      "birthCert",
      "NPC Birth Cert",
      "birthCertificateUrl",
      "age_declaration",
      "birth",
    ],
    prefixes: [
      "birthcertificate",
      "birth-certificate",
      "birth_certificate",
      "birthcert",
    ],
    isOptional: false,
  },
  {
    key: "medicalRecords",
    label: "Medical Certificate of Fitness",
    leadColumn: "medicalRecordsUrl",
    aliases: [
      "medicalRecords",
      "medical_records",
      "medical_fitness",
      "Medical Fitness",
      "Medical Certificate of Fitness",
      "medicalRecordsUrl",
      "nin",
      "fitness",
      "medical",
    ],
    prefixes: [
      "medical-records",
      "medical_records",
      "medicalrecords",
      "nin",
      "medical_fitness",
      "medical-fitness",
      "fitness",
    ],
    isOptional: false,
  },
  {
    key: "medicalReport",
    label: "Medical Report",
    leadColumn: "medicalReportUrl",
    aliases: [
      "medicalReport",
      "medical_report",
      "medicalReportUrl",
      "Medical Report",
      "doctor_report",
      "clinical_report",
      "hospital_report",
      "lab_report",
      "report",
    ],
    prefixes: [
      "medical-report",
      "medical_report",
      "medicalreport",
      "doctor-report",
      "lab-report",
      "clinical-report",
    ],
    isOptional: true,
  },
];

export interface CanonicalDocument {
  key: string;
  label: string;
  isOptional: boolean;
  fileName: string | null;
  fileUrl: string | null;
  verified: boolean;
  rejected: boolean;
  status: "VERIFIED" | "REJECTED" | "UPLOADED" | "MISSING" | "NOT_UPLOADED";
  hasFile: boolean;
  hasFileName: boolean;
  isMissing: boolean;
  size?: number;
}

export function normalizeDocUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  // Clean redundant slashes
  const clean = trimmed.replace(/^\/+/, "");
  if (clean.toLowerCase().startsWith("api/uploads/")) {
    return `/${clean}`;
  }
  if (clean.toLowerCase().startsWith("uploads/")) {
    return `/api/${clean}`;
  }
  return `/api/uploads/${clean}`;
}

/**
 * Resolves the 5 canonical documents for any applicant (register or lead object)
 * 4 Mandatory, 1 Optional (Medical Report).
 * Works in both client and server environments.
 */
export function resolveApplicantDocs(applicant: any): CanonicalDocument[] {
  if (!applicant) {
    return CANONICAL_KYC_DOCS.map((docDef) => ({
      key: docDef.key,
      label: docDef.label,
      isOptional: docDef.isOptional,
      fileName: null,
      fileUrl: null,
      verified: false,
      rejected: false,
      status: "NOT_UPLOADED",
      hasFile: false,
      hasFileName: false,
      isMissing: false,
    }));
  }

  // If server-verified resolvedDocuments already attached
  if (
    Array.isArray(applicant.resolvedDocuments) &&
    applicant.resolvedDocuments.length >= 4
  ) {
    // Map existing or complement to 5 docs
    return CANONICAL_KYC_DOCS.map((docDef) => {
      const existing = applicant.resolvedDocuments.find(
        (d: any) =>
          d.key?.toLowerCase() === docDef.key.toLowerCase() ||
          d.label?.toLowerCase() === docDef.label.toLowerCase() ||
          docDef.aliases.some((a) => a.toLowerCase() === d.key?.toLowerCase())
      );

      if (existing) {
        const isApplicantVerified = !docDef.isOptional && Boolean(
          applicant.status === "VERIFIED" ||
          applicant.status === "APPROVED" ||
          applicant.status === "ENROLLED"
        );
        const hasFile = Boolean(
          (existing.hasFile && existing.fileUrl) ||
          existing.fileUrl ||
          existing.hasFile ||
          existing.fileName ||
          isApplicantVerified
        );
        const verified = Boolean(
          (hasFile && (existing.isVerified ?? existing.verified)) ||
          isApplicantVerified
        );
        const rejected = Boolean(existing.isRejected ?? existing.rejected);
        const hasFileName = Boolean(existing.hasFileName || existing.fileName);
        const isMissing = Boolean((existing.isMissing || (existing.fileName && !existing.fileUrl)) && !isApplicantVerified);

        let status: "VERIFIED" | "REJECTED" | "UPLOADED" | "MISSING" | "NOT_UPLOADED" = "NOT_UPLOADED";
        if (verified) status = "VERIFIED";
        else if (rejected) status = "REJECTED";
        else if (hasFile) status = "UPLOADED";
        else if (isMissing) status = "MISSING";

        return {
          key: docDef.key,
          label: docDef.label,
          isOptional: docDef.isOptional,
          fileName: existing.fileName || null,
          fileUrl: existing.fileUrl || null,
          verified,
          rejected,
          status,
          hasFile,
          hasFileName,
          isMissing,
          size: existing.size,
        };
      }

      return {
        key: docDef.key,
        label: docDef.label,
        isOptional: docDef.isOptional,
        fileName: null,
        fileUrl: null,
        verified: false,
        rejected: false,
        status: "NOT_UPLOADED",
        hasFile: false,
        hasFileName: false,
        isMissing: false,
      };
    });
  }

  // Parse credentialsJson if present
  let credItems: any[] = [];
  if (applicant.credentialsJson) {
    let c = applicant.credentialsJson;
    if (typeof c === "string") {
      try {
        c = JSON.parse(c);
      } catch {}
    }
    if (Array.isArray(c)) {
      credItems = c;
    } else if (c && typeof c === "object") {
      if (Array.isArray(c.documents)) {
        credItems = c.documents;
      } else {
        Object.entries(c).forEach(([k, v]: [string, any]) => {
          if (
            [
              "TIER_INFO",
              "statusLogs",
              "formFeePaid",
              "convertedFromLead",
              "leadSource",
              "leadId",
            ].includes(k)
          ) {
            return;
          }
          if (v && typeof v === "object") {
            credItems.push({ key: k, ...v });
          } else if (typeof v === "string" && v.trim()) {
            credItems.push({ key: k, fileUrl: v, url: v });
          }
        });
      }
    }
  }

  // Parse documents field (used by AdmissionLead)
  let leadDocs: Record<string, any> = {};
  if (applicant.documents) {
    let d = applicant.documents;
    if (typeof d === "string") {
      try {
        d = JSON.parse(d);
      } catch {}
    }
    if (d && typeof d === "object") {
      leadDocs = d;
      if (Array.isArray(d)) {
        credItems.push(...d);
      } else {
        Object.entries(d).forEach(([k, v]: [string, any]) => {
          if (v && typeof v === "object") {
            credItems.push({ key: k, ...v });
          } else if (typeof v === "string" && v.trim()) {
            credItems.push({ key: k, fileUrl: v, url: v });
          }
        });
      }
    }
  }

  return CANONICAL_KYC_DOCS.map((docDef) => {
    const aliases = docDef.aliases.map((a) => a.toLowerCase());
    const prefixes = docDef.prefixes.map((p) => p.toLowerCase());

    // 1. Find matching item in credentials / documents list
    const match = credItems.find((it) => {
      if (!it || typeof it !== "object") return false;
      const k = (
        it.key ||
        it.docKey ||
        it.docType ||
        it.type ||
        it.name ||
        ""
      ).toLowerCase();
      const fn = (it.fileName || it.filename || it.savedName || "").toLowerCase();
      return (
        aliases.some((a) => k === a || k.includes(a)) ||
        prefixes.some((p) => fn.startsWith(p))
      );
    });

    // 2. Direct column on applicant (lead columns)
    const directUrl =
      docDef.leadColumn && typeof applicant[docDef.leadColumn] === "string"
        ? applicant[docDef.leadColumn]?.trim()
        : null;

    // 3. Lead documents object entry
    let leadDocEntry: any = null;
    for (const a of docDef.aliases) {
      if (leadDocs[a]) {
        leadDocEntry = leadDocs[a];
        break;
      }
    }

    const rawUrl =
      match?.fileUrl ||
      match?.url ||
      match?.path ||
      match?.link ||
      (typeof leadDocEntry === "string" ? leadDocEntry : leadDocEntry?.fileUrl || leadDocEntry?.url) ||
      directUrl ||
      null;

    let fileName: string | null =
      match?.fileName ||
      match?.filename ||
      match?.savedName ||
      match?.originalName ||
      leadDocEntry?.fileName ||
      leadDocEntry?.filename ||
      null;

    if (!fileName && rawUrl) {
      fileName = rawUrl.split("/").pop()?.split("?")[0] || null;
    }

    // If fileName or rawUrl contains a valid path or filename:
    const fileUrl = normalizeDocUrl(rawUrl);
    const isApplicantVerified = !docDef.isOptional && Boolean(
      applicant.status === "VERIFIED" ||
      applicant.status === "APPROVED" ||
      applicant.status === "ENROLLED"
    );
    const rawHasFile = Boolean(fileUrl || (fileName && fileName !== `${docDef.label}.pdf`));
    const hasFile = Boolean(rawHasFile || isApplicantVerified);
    const hasFileName = Boolean(fileName);
    const isMissing = Boolean(hasFileName && !rawHasFile && !isApplicantVerified);

    // Determine verified status
    const isVerified = Boolean(
      (rawHasFile && (
        match?.verified === true ||
        match?.status === "VERIFIED" ||
        leadDocEntry?.verified === true ||
        leadDocEntry?.status === "VERIFIED"
      )) ||
      isApplicantVerified
    );

    const isRejected = Boolean(
      match?.status === "REJECTED" ||
      leadDocEntry?.status === "REJECTED"
    );

    let status: "VERIFIED" | "REJECTED" | "UPLOADED" | "MISSING" | "NOT_UPLOADED" =
      "NOT_UPLOADED";
    if (isVerified) {
      status = "VERIFIED";
    } else if (isRejected) {
      status = "REJECTED";
    } else if (hasFile) {
      status = "UPLOADED";
    } else if (isMissing) {
      status = "MISSING";
    }

    return {
      key: docDef.key,
      label: docDef.label,
      isOptional: docDef.isOptional,
      fileName,
      fileUrl,
      verified: isVerified,
      rejected: isRejected,
      status,
      hasFile,
      hasFileName,
      isMissing,
      size: match?.size || leadDocEntry?.size,
    };
  });
}

/**
 * Returns canonical count summary:
 * - Total counter = X/5 Uploaded
 * - Mandatory counter = X/4 Verified
 * - Optional counter = X/1 Optional
 */
export function getApplicantDocsSummary(applicant: any): {
  label: string;
  verifiedLabel: string;
  mandatorySummary: string;
  optionalSummary: string;
  status: "verified" | "pending" | "empty";
  uploadedCount: number;
  verifiedCount: number;
  totalCount: number;
  mandatoryTotal: number;
  optionalTotal: number;
  mandatoryVerifiedCount: number;
  mandatoryUploadedCount: number;
  optionalUploadedCount: number;
  optionalVerifiedCount: number;
  isMandatoryComplete: boolean;
} {
  const docs = resolveApplicantDocs(applicant);
  const mandatoryDocs = docs.filter((d) => !d.isOptional);
  const optionalDocs = docs.filter((d) => d.isOptional);

  const mandatoryVerifiedCount = mandatoryDocs.filter((d) => d.verified).length;
  const mandatoryUploadedCount = mandatoryDocs.filter((d) => d.hasFile).length;
  const optionalUploadedCount = optionalDocs.filter((d) => d.hasFile).length;
  const optionalVerifiedCount = optionalDocs.filter((d) => d.verified).length;

  const totalUploaded = docs.filter((d) => d.hasFile).length;
  const isMandatoryComplete = mandatoryVerifiedCount === 4;

  let label = `${totalUploaded}/5 Uploaded`;
  let verifiedLabel = `${mandatoryVerifiedCount}/4 Verified`;
  let status: "verified" | "pending" | "empty" = "empty";

  if (isMandatoryComplete) {
    status = "verified";
  } else if (totalUploaded > 0 || mandatoryVerifiedCount > 0) {
    status = "pending";
  } else {
    status = "empty";
  }

  return {
    label,
    verifiedLabel,
    mandatorySummary: `${mandatoryVerifiedCount}/4 Mandatory`,
    optionalSummary: `${optionalUploadedCount}/1 Optional`,
    status,
    uploadedCount: totalUploaded,
    verifiedCount: mandatoryVerifiedCount,
    totalCount: 5,
    mandatoryTotal: 4,
    optionalTotal: 1,
    mandatoryVerifiedCount,
    mandatoryUploadedCount,
    optionalUploadedCount,
    optionalVerifiedCount,
    isMandatoryComplete,
  };
}
