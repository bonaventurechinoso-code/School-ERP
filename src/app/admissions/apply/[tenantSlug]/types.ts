export type NigerianTier = "CRECHE" | "NURSERY_PRIMARY" | "SECONDARY" | "TERTIARY";

export interface PersonalData {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "";
  photoUrl?: string;
  photoName?: string;
  parentName: string;
  parentRelationship: string;
  parentPhone: string;
  parentEmail: string;
  residentialAddress: string;
  stateOfOrigin: string;
  lga: string;
}

export interface CrecheData {
  immunizationChecklist: {
    bcg: boolean;
    opv: boolean;
    dpt: boolean;
    measles: boolean;
    vitaminA: boolean;
    yellowFever: boolean;
  };
  bloodGroup: string;
  genotype: string;
  allergies: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface NurseryPrimaryData {
  guardianNin: string;
  previousSchool: string;
  previousClass: string;
  classApplying: string;
  hasSpecialNeeds: boolean;
  specialNeedsDescription?: string;
}

export interface SecondaryData {
  beceResultStatus: "Passed" | "Awaiting" | "Exempted";
  beceAggregateScore?: string;
  jss3SchoolAttended: string;
  jss3CompletionYear: string;
  classApplying: "JSS 1" | "JSS 2" | "JSS 3" | "SSS 1" | "SSS 2" | "SSS 3";
  secondaryChoice: "Science" | "Arts" | "Commercial" | "General Junior";
}

export interface WaecSubjectRow {
  subject: string;
  grade: "A1" | "B2" | "B3" | "C4" | "C5" | "C6" | "D7" | "E8" | "F9" | "";
}

export interface TertiaryData {
  jambRegNumber: string;
  jambScore: string;
  jambYear: string;
  facultyChoice: string;
  courseOfStudy: string;
  waecSitting1: {
    examType: "WAEC" | "NECO" | "NABTEB";
    examYear: string;
    centerNumber: string;
    results: WaecSubjectRow[];
  };
  hasSecondSitting: boolean;
  waecSitting2?: {
    examType: "WAEC" | "NECO" | "NABTEB";
    examYear: string;
    centerNumber: string;
    results: WaecSubjectRow[];
  };
}

export interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  fileSize?: string;
  uploadedAt: string;
  dataUrl?: string;
}

export interface DocumentsData {
  birthCertificate?: UploadedDoc;
  passportPhoto?: UploadedDoc;
  immunizationOrMedical?: UploadedDoc;
  academicResultOrTranscript?: UploadedDoc;
  guardianIdProof?: UploadedDoc;
}

export interface PaymentData {
  amount: number;
  feeType: string;
  paymentMethod: "BANK_TRANSFER" | "DIRECT_GATEWAY" | "FLUTTERWAVE";
  bankName: string;
  accountNumber: string;
  accountName: string;
  paymentReference: string;
  senderAccountName?: string;
  senderBank?: string;
  transactionReference?: string;
  paidAt?: string;
}

export interface PublicApplicationPayload {
  tenantSlug: string;
  schoolId: string;
  personal: PersonalData;
  tier: NigerianTier;
  creche?: CrecheData;
  nurseryPrimary?: NurseryPrimaryData;
  secondary?: SecondaryData;
  tertiary?: TertiaryData;
  documents: DocumentsData;
  payment: PaymentData;
  declarationAccepted: boolean;
}
