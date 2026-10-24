/**
 * Canonical Types for Enterprise Admissions Architecture v2.2
 */

export type AdmissionStatus =
  | "INQUIRY"
  | "DOCS_PENDING"
  | "VERIFIED"
  | "APPROVED"
  | "REJECTED"
  | "CONVERTED";

export interface AdmissionStatusLog {
  id?: string;
  fromStatus: string;
  toStatus: string;
  changedById: string;
  reason?: string;
  createdAt: string | Date;
  applicationNo?: string;
  leadId?: string;
}

export interface CredentialDocument {
  type?: string;
  docType?: string;
  url?: string;
  path?: string;
  fileUrl?: string;
  filename?: string;
  originalName?: string;
  name?: string;
  verified?: boolean;
  size?: number;
  uploadedAt?: string;
}

export interface AdmissionRegisterRecord {
  id: string;
  tenantId: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  classApplied: string;
  assignedClass?: string;
  parentPhone: string;
  email?: string | null;
  status: AdmissionStatus | string;
  formFeePaid?: boolean;
  convertedFromLead?: boolean;
  leadSource?: string | null;
  leadId?: string | null;
  credentialsJson?: {
    documents?: CredentialDocument[];
    statusLogs?: AdmissionStatusLog[];
    formFeePaid?: boolean;
    convertedFromLead?: boolean;
    leadSource?: string;
    leadId?: string;
    targetClassCohort?: string;
    [key: string]: any;
  } | CredentialDocument[] | any;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  admittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateCheckMatch {
  isDuplicate: boolean;
  matchType?: "exact" | "fuzzy";
  confidence?: number;
  existingRegister?: AdmissionRegisterRecord | null;
  existingLead?: {
    id: string;
    applicantName: string;
    parentContact: string;
    parentPhone?: string | null;
    parentEmail?: string | null;
    status: string;
    targetGrade: string;
    createdAt: Date | string;
  } | null;
  matchedFields?: string[];
  normalizedCompoundKey?: string;
}

export interface AdmissionsAuthResult {
  allowed: boolean;
  canMutate: boolean;
  role: string;
  staffRole?: string;
  reason?: string;
}
