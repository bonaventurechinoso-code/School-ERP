/**
 * Canonical KYC Documents Checklist & Resolver
 * Standardized across Admissions Register and Applicant Dossier
 */

export interface CanonicalDocDef {
  key: string;
  label: string;
  leadColumn: string;
  aliases: string[];
  prefixes: string[];
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
    ],
  },
];

export interface CanonicalDocument {
  key: string;
  label: string;
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
 * Resolves the 4 canonical documents for any applicant (register or lead object)
 * Works in both client and server environments.
 */
export function resolveApplicantDocs(applicant: any): CanonicalDocument[] {
  if (!applicant) {
    return CANONICAL_KYC_DOCS.map((docDef) => ({
      key: docDef.key,
      label: docDef.label,
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
    applicant.resolvedDocuments.length === 4
  ) {
    return applicant.resolvedDocuments.map((d: any) => ({
      key: d.key,
      label: d.label,
      fileName: d.fileName || null,
      fileUrl: d.fileUrl || null,
      verified: Boolean(d.isVerified ?? d.verified),
      rejected: Boolean(d.isRejected ?? d.rejected),
      status:
        (d.isVerified ?? d.verified)
          ? "VERIFIED"
          : (d.isRejected ?? d.rejected)
          ? "REJECTED"
          : d.hasFile && d.fileUrl
          ? "UPLOADED"
          : d.isMissing
          ? "MISSING"
          : "NOT_UPLOADED",
      hasFile: Boolean(d.hasFile && d.fileUrl),
      hasFileName: Boolean(d.hasFileName || d.fileName),
      isMissing: Boolean(d.isMissing || (d.fileName && !d.fileUrl)),
      size: d.size,
    }));
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

    // Determine verified status
    const isVerified = Boolean(
      match?.verified === true ||
      match?.status === "VERIFIED" ||
      leadDocEntry?.verified === true ||
      leadDocEntry?.status === "VERIFIED" ||
      applicant.status === "VERIFIED" ||
      applicant.status === "APPROVED" ||
      applicant.status === "ENROLLED"
    );

    const isRejected = Boolean(
      match?.status === "REJECTED" ||
      leadDocEntry?.status === "REJECTED"
    );

    // If fileName or rawUrl contains a valid path or filename:
    const fileUrl = normalizeDocUrl(rawUrl);
    const hasFile = Boolean(fileUrl);
    const hasFileName = Boolean(fileName);
    const isMissing = hasFileName && !hasFile;

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
 * Returns canonical count summary (e.g. "0/4 Uploaded", "1/4 Verified")
 */
export function getApplicantDocsSummary(applicant: any): {
  label: string;
  status: "verified" | "pending" | "empty";
  verifiedCount: number;
  uploadedCount: number;
} {
  const docs = resolveApplicantDocs(applicant);
  const verifiedCount = docs.filter((d) => d.verified).length;
  const uploadedCount = docs.filter((d) => d.hasFile).length;

  if (verifiedCount === 4) {
    return {
      label: "4/4 Verified",
      status: "verified",
      verifiedCount,
      uploadedCount,
    };
  }

  if (verifiedCount > 0) {
    return {
      label: `${verifiedCount}/4 Verified`,
      status: "verified",
      verifiedCount,
      uploadedCount,
    };
  }

  if (uploadedCount > 0) {
    return {
      label: `${uploadedCount}/4 Uploaded`,
      status: "pending",
      verifiedCount,
      uploadedCount,
    };
  }

  return {
    label: "0/4 Uploaded",
    status: "empty",
    verifiedCount: 0,
    uploadedCount: 0,
  };
}
