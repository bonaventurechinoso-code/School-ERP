export type TierCategory = "EARLY_CHILDHOOD" | "SECONDARY" | "HIGHER_ED";

export interface TierPresentationConfig {
  category: TierCategory;
  tierName: string;
  tierSlug: string;
  badgeCode: string;
  billingTitle: string;
  courseMetricTitle: string;
  academicRankTitle: string;
  audienceFocus: string;
  hasGpaMatrix: boolean;
  hasCreditUnitLoading: boolean;
  hasPickupLog: boolean;
  hasMidtermBreakdown: boolean;
  hasParentOrientation: boolean;
  currencySymbol: string;
}

export interface StudentProfileData {
  id: string;
  admissionNumber: string; // Unique student login ID
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  currentClass: string;
  dateOfBirth?: string | null;
  stateOfOrigin?: string | null;
  gender?: string | null;
  enrollmentDate?: string | null;
  status: "ENROLLED" | "SUSPENDED" | "ALUMNI" | "PROSPECT" | string;
  
  // Guardian / Parent bio data
  parentName?: string | null;
  parentRelationship?: string | null;
  parentOccupation?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  parentWhatsApp?: string | null;
  emergencyAddress?: string | null;

  // Academic metrics (tier-adaptive)
  academicRank: {
    // Early childhood / Primary
    developmentalRating?: string;
    classStage?: string;
    pickupAuthorizedPersons?: Array<{
      name: string;
      relation: string;
      phone: string;
      securityPin: string;
      isAuthorized: boolean;
    }>;
    
    // Secondary
    classPosition?: string;
    termAverage?: string;
    totalStudentsInClass?: number;
    standingStatus?: string;
    continuousAssessments?: Array<{
      subject: string;
      ca1: number;
      ca2: number;
      exam: number;
      total: number;
      grade: string;
    }>;

    // Higher Ed
    semesterGpa?: number;
    cumulativeGpa?: number;
    degreeClassification?: string;
    creditUnitsRegistered?: number;
    creditUnitsMax?: number;
    faculty?: string;
    department?: string;
    matriculationNo?: string;
    level?: string;
    gpaMatrixBreakdown?: Array<{
      semester: string;
      level: string;
      gpa: number;
      credits: number;
      status: string;
    }>;
  };
}

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  targetAudience: "ALL" | "STUDENTS" | "STAFF" | string;
  priority: "LOW" | "NORMAL" | "HIGH";
  category?: "ACADEMIC" | "FINANCE" | "ADMINISTRATIVE" | "SECURITY" | "EVENT";
  authorName?: string;
  publishedAt: string;
}

export interface MessageLogItem {
  id: string;
  recipientEmail: string;
  recipientType: "STUDENT" | "PARENT" | "STAFF";
  messageType: "EMAIL" | "SMS";
  subject: string;
  body: string;
  sentAt: string;
  isRead?: boolean;
}

export interface SystemNotificationItem {
  id: string;
  title: string;
  message: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  timestamp: string;
}

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  description: string;
  category: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  status: "PAID" | "PENDING" | "PARTIAL" | "OVERDUE";
  feeTemplateName?: string;
  createdAt: string;
}

export interface PaymentItem {
  id: string;
  reference: string;
  invoiceId: string;
  invoiceDescription: string;
  amountPaid: number;
  paymentDate: string;
  method: "CARD" | "TRANSFER" | "CASH" | string;
  status: "VERIFIED" | "PROCESSING" | "FAILED";
  receiptNumber: string;
}

export interface FeesFinanceData {
  currency: string;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  paymentStatus: "CLEAR" | "DUE" | "OVERDUE";
  invoices: InvoiceItem[];
  payments: PaymentItem[];
}

export interface CommunicationsData {
  notices: NoticeItem[];
  messages: MessageLogItem[];
  systemNotifications: SystemNotificationItem[];
}

export interface StudentPortalWorkspaceData {
  school: {
    id: string;
    name: string;
    subdomain: string;
    logoUrl?: string | null;
    brandingColor?: string | null;
    availableTiers: string[];
    isolatedDbStatus: {
      isIsolated: boolean;
      databaseName: string;
      tierName: string;
    };
  };
  tierConfig: TierPresentationConfig;
  student: StudentProfileData;
  communications: CommunicationsData;
  finance: FeesFinanceData;
  isAccessDenied?: boolean;
  isSuspended?: boolean;
}

export type StudentPortalTab = "OVERVIEW" | "PROFILE" | "COMMUNICATIONS" | "FINANCE" | "TRANSACTIONS" | "REPORTS" | "TIMETABLE" | "SECURITY";
