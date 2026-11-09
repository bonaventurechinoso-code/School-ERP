"use client";

import React, { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  ShieldCheck,
  FileCheck,
  Award,
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  Download,
  Printer,
  Loader2,
  Filter,
  Search,
  Plus,
  Send,
  Building,
  CreditCard,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  ChevronLeft,
  FileText,
  Eye,
  RefreshCw,
  UserPlus,
  X,
  Layers,
  Sparkles,
  Edit,
  Trash2,
  Calendar,
} from "lucide-react";
import ApplicantDossierDrawer from "./ApplicantDossierDrawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  updateApplicationStageAction,
  enrollAdmissionsApplicationAction,
  batchSendOffersAction,
  offerAdmissionAction,
  batchOfferAdmissionAction,
  exportJambCapsCsvAction,
  reconcileFeeAction,
  verifyDocumentAction,
  approveAdmissionsFeeTransaction,
  rejectAdmissionsFeeTransaction,
  updateAdmissionsApplicationBioAction,
  deleteAdmissionsApplicationAction,
  deduplicateAllAdmissionsAction,
  saveManualEntranceScoreAction,
} from "./actions";
import { recordWalkInApplication } from "./walk-in/actions";

export interface SerializedApplication {
  id: string;
  tenantId: string;
  schoolId: string;
  academicSessionId: string;
  programId: string;
  applicationNumber: string;
  intakeChannel: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email: string;
  phoneNumber: string;
  whatsappNumber?: string | null;
  dateOfBirth: string | Date;
  gender: string;
  status: string;
  tierSpecificData: any;
  documents: {
    id: string;
    documentType: string;
    storageKey: string;
    verificationStatus: string;
    rejectionReason?: string | null;
  }[];
  feeTransactions: {
    id: string;
    paymentMethod: string;
    amount: number | string;
    currency: string;
    paymentReference: string;
    paymentStatus: string;
    proofOfPaymentUrl?: string | null;
    createdAt: string | Date;
  }[];
  auditTrails?: {
    id: string;
    action: string;
    actorId?: string | null;
    fromStage?: string | null;
    toStage?: string | null;
    ipAddress?: string | null;
    createdAt: string | Date;
  }[];
  metadata: any;
  createdAt: string | Date;
}

export interface SerializedTransaction {
  id: string;
  tenantId: string;
  applicationId: string;
  paymentMethod: string;
  amount: number | string;
  currency: string;
  paymentReference: string;
  proofOfPaymentUrl?: string | null;
  paymentStatus: string;
  reconciliationNotes?: string | null;
  verifiedByUserId?: string | null;
  verifiedAt?: string | Date | null;
  createdAt: string | Date;
  application: {
    id: string;
    applicationNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    whatsappNumber?: string | null;
    programId: string;
    status: string;
  };
}

export interface AdmissionCycleItem {
  id: string;
  session: string;
  name: string;
  tier: string;
  applicationFee: number;
  isActive: boolean;
}

export interface TierConfig {
  showPostUTME: boolean;
  showOLevel: boolean;
  showProgramDept: boolean;
  applicantLabel: string;
  programLabel: string;
  searchPlaceholder: string;
  topCards: string[];
  columns: string[];
}

const DEFAULT_TIER_CONFIG: TierConfig = {
  showPostUTME: true,
  showOLevel: true,
  showProgramDept: true,
  applicantLabel: "Candidate",
  programLabel: "PROGRAM / DEPT",
  searchPlaceholder: "Search by candidate name, application number, JAMB reg...",
  topCards: ["INQUIRIES", "SCREENING & KYC", "EXAMS & INTERVIEWS", "OFFERS EXTENDED", "MATRICULATED"],
  columns: ["CANDIDATE FULL NAME", "APPLICATION NO", "PROGRAM / DEPT", "OLEVEL", "SCORE", "STATUS", "FEE STATUS"],
};

function calculateAge(dobString?: string | Date | null): string {
  if (!dobString) return "-";
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return "-";
  const now = new Date();
  const diffMs = now.getTime() - dob.getTime();
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
  if (totalMonths < 0) return "-";
  if (totalMonths < 24) {
    return `${totalMonths} mo`;
  }
  const years = Math.floor(totalMonths / 12);
  return `${years} yrs`;
}

export const TIER_COPY = {
  CRECHE: {
    subtitle: "Early years enrollment, guardian verification and care placement",
    cards: ["INQUIRIES", "PARENT SCREENING", "ASSESSMENT", "OFFERS", "ENROLLED"],
  },
  PRIMARY: {
    subtitle: "Pupil enrollment, parent guardian screening, fee assurance and class placement",
    cards: ["INQUIRIES", "SCREENING", "ASSESSMENT", "OFFERS", "ENROLLED"],
  },
  SECONDARY: {
    subtitle: "Student enrollment, entrance assessment, fee assurance and class placement",
    cards: ["INQUIRIES", "SCREENING & KYC", "ENTRANCE / BECE", "OFFERS", "ADMITTED"],
  },
  TERTIARY: {
    subtitle: "Student enrollment, screening, offers, fee reconciliation and matriculation",
    cards: ["INQUIRIES", "SCREENING & KYC", "EXAMS & INTERVIEWS", "OFFERS EXTENDED", "MATRICULATED"],
  },
};

interface AdmissionsWorkspaceProps {
  school?: any;
  tier?: string;
  schoolId: string;
  schoolDomain: string;
  schoolName: string;
  tierConfig?: TierConfig;
  initialApplications: SerializedApplication[];
  initialTransactions: SerializedTransaction[];
  cycles: AdmissionCycleItem[];
  academicTiers: { id: string; name: string; level: number }[];
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  canMutate?: boolean;
}

const KANBAN_STAGES = [
  { key: "DOCS PENDING", label: "Docs Pending", bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900/40" },
  { key: "VERIFIED", label: "Verified", bg: "bg-blue-50/50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-900/40" },
  { key: "APPROVED", label: "Approved", bg: "bg-purple-50/50 dark:bg-purple-950/20", border: "border-purple-200 dark:border-purple-900/40" },
  { key: "ADMITTED", label: "Admitted / Enrolled", bg: "bg-emerald-50/50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900/40" },
];

export default function AdmissionsWorkspaceClient({
  school,
  tier: passedTier,
  schoolId,
  schoolDomain,
  schoolName,
  tierConfig: incomingTierConfig,
  initialApplications,
  initialTransactions,
  cycles,
  academicTiers,
  bankDetails,
  canMutate = true,
}: AdmissionsWorkspaceProps) {
  // Resolve tier strictly from passed tier, school.tier, or school name
  const rawTier = (passedTier || school?.tier || "").toUpperCase();
  let tier: keyof typeof TIER_COPY = "PRIMARY";
  if (rawTier in TIER_COPY) {
    tier = rawTier as keyof typeof TIER_COPY;
  } else {
    const sName = (school?.name || schoolName || "").toLowerCase();
    if (sName.includes("creche") || sName.includes("daycare") || sName.includes("crèche")) tier = "CRECHE";
    else if (sName.includes("primary") || sName.includes("basic") || sName.includes("elementary") || sName.includes("nursery")) tier = "PRIMARY";
    else if (sName.includes("secondary") || sName.includes("high") || (sName.includes("college") && !sName.includes("education"))) tier = "SECONDARY";
    else tier = "TERTIARY";
  }

  const copy = TIER_COPY[tier] || TIER_COPY.PRIMARY;
  const tierConfig = incomingTierConfig || DEFAULT_TIER_CONFIG;
  const router = useRouter();

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const [applications, setApplications] = useState<SerializedApplication[]>(initialApplications);
  const [transactions, setTransactions] = useState<SerializedTransaction[]>(initialTransactions);
  const [activeTab, setActiveTab] = useState("kanban");
  const [isPending, startTransition] = useTransition();

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Read-only bank modal
  const [bankModalApp, setBankModalApp] = useState<SerializedApplication | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Dossier Drawer state
  const [dossierApp, setDossierApp] = useState<SerializedApplication | null>(null);

  // Keep active dossierApp synchronized with latest updated applications
  useEffect(() => {
    if (dossierApp) {
      const fresh = (applications || initialApplications || []).find((a) => a.id === dossierApp.id);
      if (fresh) {
        setDossierApp(fresh);
      }
    }
  }, [applications, initialApplications]);

  const searchParams = useSearchParams();
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["kanban", "exams", "register", "walkin", "reconciliation"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Entrance examination schedules state
  const [examSearch, setExamSearch] = useState("");
  const [examGradeFilter, setExamGradeFilter] = useState("ALL");
  const [examStatusFilter, setExamStatusFilter] = useState("ALL");
  const [savingExamScoreId, setSavingExamScoreId] = useState<string | null>(null);
  const [editingExamScoreId, setEditingExamScoreId] = useState<string | null>(null);
  const [examScoreInputs, setExamScoreInputs] = useState<Record<string, string>>({});

  // Edit Applicant Modal state
  const [editingApp, setEditingApp] = useState<SerializedApplication | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    phoneNumber: "",
    whatsappNumber: "",
    gender: "MALE",
    programId: "",
    dateOfBirth: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
  });

  // Delete Applicant Confirmation Modal state
  const [deletingApp, setDeletingApp] = useState<SerializedApplication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deduplication state
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  // Enroll modal
  const [enrollingApp, setEnrollingApp] = useState<SerializedApplication | null>(null);
  const [enrollClassArm, setEnrollClassArm] = useState("");
  const [enrollTermFee, setEnrollTermFee] = useState<number>(0);
  const [enrollTierId, setEnrollTierId] = useState<string>(academicTiers[0]?.id || "");

  // Table filters & batch selection
  const [selectedSession, setSelectedSession] = useState<string>(cycles[0]?.session || "ALL");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedProgram, setSelectedProgram] = useState<string>("ALL");
  const [filterOLevel5, setFilterOLevel5] = useState(false);
  const [minUtmeScore, setMinUtmeScore] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  // View filter: ALL, QUALIFIED, or ADMISSION_LIST
  const [registerViewFilter, setRegisterViewFilter] = useState<"ALL" | "QUALIFIED" | "ADMISSION_LIST">("ALL");
  const [offeringAdmissionId, setOfferingAdmissionId] = useState<string | null>(null);
  const [isOfferingBatch, setIsOfferingBatch] = useState(false);
  const [requirementsWaiverApp, setRequirementsWaiverApp] = useState<{ app: SerializedApplication; missing: string[] } | null>(null);
  const [confirmBatchOfferOpen, setConfirmBatchOfferOpen] = useState(false);

  // Walk-In Drawer state
  const [walkInDrawerOpen, setWalkInDrawerOpen] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    whatsappNumber: "",
    dateOfBirth: "2010-01-01",
    gender: "MALE",
    parentName: "",
    parentPhone: "",
    parentRelationship: "Parent",
    previousSchool: "",
    programId: "Primary",
    academicSessionId: cycles[0]?.session || "2026/2027",
    docBirthCert: true,
    docPassport: true,
    docResults: false,
    docIndigene: false,
    paymentMethod: "POS_COUNTER" as "POS_COUNTER" | "CASH",
    paymentAmount: 5000,
    posTerminalReference: "",
  });

  // Reconciliation reject modal
  const [rejectTxId, setRejectTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("UNCONFIRMED");

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Funnel bar metrics calculation - deduplicated inquiry counts
  const funnelMetrics = useMemo(() => {
    const inquiries = applications.filter(
      (a) => ["DRAFT", "INQUIRY", "NEW"].includes((a.status || "").toUpperCase())
    ).length;
    const screening = applications.filter(
      (a) => ["PAYMENT_PENDING", "SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "DOCS PENDING", "DOCS_PENDING", "APPLIED"].includes((a.status || "").toUpperCase())
    ).length;
    const exams = applications.filter(
      (a) => ["ASSESSMENT_SCHEDULED", "INTERVIEW", "EXAM"].includes((a.status || "").toUpperCase())
    ).length;
    const offers = applications.filter(
      (a) => ["OFFER_EXTENDED", "OFFER_ACCEPTED", "APPROVED"].includes((a.status || "").toUpperCase())
    ).length;
    const matriculated = applications.filter(
      (a) => ["ENROLLED", "ADMITTED", "MATRICULATED", "CONVERTED"].includes((a.status || "").toUpperCase())
    ).length;

    return { inquiries, screening, exams, offers, matriculated };
  }, [applications]);

  // Stage mapping helper - accurately maps all pipeline states to visible Kanban columns
  const mapAppToKanbanStage = (status: string): string => {
    const s = (status || "").toUpperCase().trim();
    switch (s) {
      case "SUBMITTED":
      case "UNDER_REVIEW":
      case "VERIFIED":
      case "ASSESSMENT_SCHEDULED":
      case "INTERVIEW":
      case "SCREENED":
        return "VERIFIED";
      case "OFFER_EXTENDED":
      case "OFFER_ACCEPTED":
      case "APPROVED":
        return "APPROVED";
      case "ENROLLED":
      case "ADMITTED":
      case "MATRICULATED":
      case "CONVERTED":
        return "ADMITTED";
      case "REJECTED":
      case "DECLINED":
        return "";
      case "DOCS PENDING":
      case "DOCS_PENDING":
      case "PAYMENT_PENDING":
      case "ACTION_REQUIRED":
      case "APPLIED":
      case "NEW":
      case "DRAFT":
      case "INQUIRY":
      default:
        return "DOCS PENDING";
    }
  };

  // Helper to determine fee status
  const getFeeStatus = useCallback((app: SerializedApplication): "UNPAID" | "PENDING" | "SETTLED" => {
    const metaDocs = (app.metadata as any)?.documents || {};
    const tierDocs = (app.tierSpecificData as any)?.documents || {};
    const hasSettledTx = app.feeTransactions?.some(
      (t) => t.paymentStatus === "SETTLED" || t.paymentStatus === "VERIFIED" || t.paymentStatus === "PAID"
    );
    const isDocPaid = Boolean(
      (app as any).formFeePaid ||
      (app as any).feePaid ||
      metaDocs.formFeePaid ||
      metaDocs.feePaid ||
      metaDocs.formFeeStatus === "PAID" ||
      metaDocs.formFeeStatus === "SETTLED" ||
      metaDocs.paymentState === "SETTLED" ||
      metaDocs.applicationFeeReceipt?.status === "VERIFIED" ||
      metaDocs.applicationFeeReceipt?.verified === true ||
      metaDocs.applicationFeeReceipt?.verificationStatus === "MANUALLY_VERIFIED" ||
      tierDocs.formFeePaid ||
      tierDocs.feePaid ||
      tierDocs.formFeeStatus === "PAID" ||
      tierDocs.formFeeStatus === "SETTLED" ||
      tierDocs.paymentState === "SETTLED" ||
      tierDocs.applicationFeeReceipt?.status === "VERIFIED" ||
      tierDocs.applicationFeeReceipt?.verified === true ||
      tierDocs.applicationFeeReceipt?.verificationStatus === "MANUALLY_VERIFIED" ||
      (app.tierSpecificData as any)?.formFeePaid ||
      (app.tierSpecificData as any)?.formFeeStatus === "PAID" ||
      (app.tierSpecificData as any)?.formFeeStatus === "SETTLED" ||
      (app.tierSpecificData as any)?.paymentState === "SETTLED" ||
      hasSettledTx ||
      app.status === "APPROVED" ||
      app.status === "ENROLLED" ||
      app.status === "ADMITTED"
    );
    if (isDocPaid) return "SETTLED";

    const hasPendingTx = app.feeTransactions?.some(
      (t) => t.paymentStatus === "PENDING" || t.paymentStatus === "PENDING_VERIFICATION"
    );
    const hasPendingDoc = Boolean(
      metaDocs.formFeeStatus === "PENDING" ||
      metaDocs.formFeeStatus === "PENDING_VERIFICATION" ||
      metaDocs.paymentState === "PAYMENT_PENDING_REVIEW" ||
      metaDocs.applicationFeeReceiptUrl ||
      metaDocs.formFeeReceiptUrl ||
      metaDocs.applicationFeeReceipt?.url ||
      tierDocs.formFeeStatus === "PENDING" ||
      tierDocs.formFeeStatus === "PENDING_VERIFICATION" ||
      tierDocs.applicationFeeReceiptUrl ||
      hasPendingTx
    );
    if (hasPendingDoc) return "PENDING";

    return "UNPAID";
  }, []);

  // Helper for document status
  const getDocStatus = (app: SerializedApplication): "PENDING" | "MANUALLY_VERIFIED" | "REJECTED" => {
    if (!app.documents || app.documents.length === 0) return "PENDING";
    const anyRejected = app.documents.some((d) => d.verificationStatus === "REJECTED");
    if (anyRejected) return "REJECTED";
    const allVerified = app.documents.every(
      (d) => d.verificationStatus === "MANUALLY_VERIFIED" || d.verificationStatus === "AUTO_VERIFIED"
    );
    if (allVerified) return "MANUALLY_VERIFIED";
    return "PENDING";
  };

  // Helper to accurately count distinct uploaded credentials
  const countUploadedDocs = (app: SerializedApplication): number => {
    const foundKeys = new Set<string>();

    if (Array.isArray(app.documents)) {
      for (const d of app.documents) {
        const rawType = (d.documentType || "").toUpperCase().replace(/[\s-_]/g, "");
        if (rawType.includes("PASSPORT")) foundKeys.add("passportPhoto");
        else if (rawType.includes("BIRTH") || rawType.includes("AGE")) foundKeys.add("birthCertificate");
        else if (rawType.includes("ACADEMIC") || rawType.includes("TRANSCRIPT") || rawType.includes("RESULT") || rawType.includes("OLEVEL")) foundKeys.add("academicResults");
        else if (rawType.includes("MEDICAL") || rawType.includes("FITNESS") || rawType.includes("REPORT")) foundKeys.add("medicalRecords");
        else if (rawType.includes("NIN") || rawType.includes("NATIONAL")) foundKeys.add("ninSlip");
        else if (rawType.includes("FEE") || rawType.includes("RECEIPT")) foundKeys.add("applicationFeeReceipt");
        else if (d.storageKey) foundKeys.add(rawType);
      }
    }

    const metaDocs = (app.metadata as any)?.documents || (app.tierSpecificData as any)?.documents;
    if (metaDocs && typeof metaDocs === "object" && !Array.isArray(metaDocs)) {
      if (metaDocs.passportPhoto?.url || metaDocs.passportPhoto || metaDocs.passportPhotoUrl) foundKeys.add("passportPhoto");
      if (metaDocs.birthCertificate?.url || metaDocs.birthCertificate || metaDocs.birthCertificateUrl) foundKeys.add("birthCertificate");
      if (metaDocs.academicResults?.url || metaDocs.academicResults || metaDocs.academicResultsUrl) foundKeys.add("academicResults");
      if (metaDocs.medicalRecords?.url || metaDocs.medicalRecords || metaDocs.medicalRecordsUrl) foundKeys.add("medicalRecords");
      if (metaDocs.ninSlip?.url || metaDocs.ninSlip || metaDocs.ninSlipUrl) foundKeys.add("ninSlip");
      if (metaDocs.applicationFeeReceipt?.url || metaDocs.applicationFeeReceiptUrl || metaDocs.formFeeReceiptUrl) foundKeys.add("applicationFeeReceipt");
    }

    if (app.feeTransactions?.some((t) => t.proofOfPaymentUrl)) {
      foundKeys.add("applicationFeeReceipt");
    }

    return foundKeys.size;
  };

  // Action: update stage
  const handleStageChange = (appId: string, targetStage: string) => {
    startTransition(async () => {
      const res = await updateApplicationStageAction({
        applicationId: appId,
        newStage: targetStage,
        schoolId,
        schoolDomain,
      });

      if (res.success && res.newStage) {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: res.newStage } : a))
        );
        setFeedback({ type: "success", message: res.message || "Stage updated successfully." });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to update stage." });
      }
    });
  };

  // Action: enroll candidate
  const handleEnrollConfirm = () => {
    if (!enrollingApp) return;
    startTransition(async () => {
      const res = await enrollAdmissionsApplicationAction({
        applicationId: enrollingApp.id,
        schoolId,
        schoolDomain,
        tierId: enrollTierId,
        classArm: enrollClassArm || enrollingApp.programId,
        termFeeAmount: enrollTermFee,
      });

      if (res.success) {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === enrollingApp.id ? { ...a, status: "ENROLLED" } : a
          )
        );
        setEnrollingApp(null);
        setFeedback({
          type: "success",
          message: `Candidate enrolled successfully as ${res.matriculationNumber}!`,
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Enrollment failed." });
      }
    });
  };

  // Batch action: export JAMB CAPS CSV
  const handleExportJambCaps = () => {
    startTransition(async () => {
      const res = await exportJambCapsCsvAction({
        schoolId,
        programId: selectedProgram,
        sessionId: selectedSession,
      });

      if (res.success && res.csvContent) {
        const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.filename || "JAMB_CAPS_EXPORT.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setFeedback({ type: "success", message: `Exported ${res.count} records for JAMB CAPS.` });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to export JAMB CAPS CSV." });
      }
    });
  };

  // Batch action: send offers
  const handleBatchSendOffers = () => {
    if (selectedAppIds.length === 0) return;
    startTransition(async () => {
      const res = await batchSendOffersAction({
        applicationIds: selectedAppIds,
        schoolId,
        schoolDomain,
      });

      if (res.success) {
        setApplications((prev) =>
          prev.map((a) =>
            selectedAppIds.includes(a.id) ? { ...a, status: "OFFER_EXTENDED" } : a
          )
        );
        setSelectedAppIds([]);
        setFeedback({ type: "success", message: res.message || "Batch offers sent." });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to send batch offers." });
      }
    });
  };

  // Action: Offer Admission to single candidate
  const handleOfferAdmission = async (app: SerializedApplication, grantWaiver: boolean = false) => {
    const reqCheck = checkCandidateRequirements(app);
    if (!reqCheck.isQualified && !grantWaiver) {
      setRequirementsWaiverApp({ app, missing: reqCheck.missing });
      return;
    }

    setOfferingAdmissionId(app.id);
    setRequirementsWaiverApp(null);

    // Optimistic UI transition
    setApplications((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, status: "OFFER_EXTENDED" } : a))
    );

    try {
      const res = await offerAdmissionAction({
        applicationId: app.id,
        schoolId,
        schoolDomain,
        grantWaiver,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || `Provisional admission offer successfully dispatched to ${app.firstName} ${app.lastName}! Omnichannel notification sent.`,
        });
      } else {
        // Revert optimistic update on failure
        setApplications((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: app.status } : a))
        );
        setFeedback({ type: "error", message: res.error || "Failed to offer admission." });
      }
    } catch (err: any) {
      setApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: app.status } : a))
      );
      setFeedback({ type: "error", message: err.message || "Failed to offer admission." });
    } finally {
      setOfferingAdmissionId(null);
    }
  };

  // Action: Offer Admission to all candidates that pass requirements
  const handleOfferAdmissionToAllQualified = async () => {
    if (qualifiedCandidates.length === 0) {
      setFeedback({
        type: "error",
        message: "There are currently no candidates meeting passing requirements awaiting an offer.",
      });
      return;
    }

    setIsOfferingBatch(true);
    setConfirmBatchOfferOpen(false);

    try {
      const res = await batchOfferAdmissionAction({
        schoolId,
        schoolDomain,
        qualifiedOnly: true,
      });

      if (res.success && (res.processedCount ?? 0) > 0) {
        const processedSet = new Set(res.processedIds || []);
        setApplications((prev) =>
          prev.map((a) => (processedSet.has(a.id) ? { ...a, status: "OFFER_EXTENDED" } : a))
        );
        setRegisterViewFilter("ADMISSION_LIST"); // Automatically display the official Admission List!
        setFeedback({
          type: "success",
          message: res.message || `🎉 Successfully offered admission and dispatched notifications to ${res.processedCount} qualified candidate(s)!`,
        });
      } else {
        setFeedback({
          type: res.success ? "success" : "error",
          message: res.message || res.error || "No candidates were processed.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to batch offer admission." });
    } finally {
      setIsOfferingBatch(false);
    }
  };

  // Action: Print Official Published Admission List
  const handlePrintAdmissionList = () => {
    window.print();
  };

  // Batch action: Offer Admission to selected candidates
  const handleBatchOfferAdmissionSelected = () => {
    if (selectedAppIds.length === 0) return;
    setIsOfferingBatch(true);
    startTransition(async () => {
      try {
        const res = await batchOfferAdmissionAction({
          applicationIds: selectedAppIds,
          schoolId,
          schoolDomain,
          qualifiedOnly: false,
        });

        if (res.success) {
          setApplications((prev) =>
            prev.map((a) =>
              selectedAppIds.includes(a.id) ? { ...a, status: "OFFER_EXTENDED" } : a
            )
          );
          setSelectedAppIds([]);
          setFeedback({
            type: "success",
            message: res.message || `Admission offers extended and notifications dispatched to ${res.processedCount ?? selectedAppIds.length} selected candidate(s).`,
          });
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to batch offer admission." });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Failed to batch offer admission." });
      } finally {
        setIsOfferingBatch(false);
      }
    });
  };

  // Action: Walk-in submit
  const handleWalkInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordWalkInApplication({
        schoolId,
        registrarName: "Admissions Officer",
        academicSessionId: walkInForm.academicSessionId,
        programId: walkInForm.programId,
        firstName: walkInForm.firstName,
        lastName: walkInForm.lastName,
        middleName: walkInForm.middleName,
        email: walkInForm.email,
        phoneNumber: walkInForm.phoneNumber,
        whatsappNumber: walkInForm.whatsappNumber || walkInForm.phoneNumber,
        dateOfBirth: walkInForm.dateOfBirth,
        gender: walkInForm.gender,
        parentName: walkInForm.parentName,
        parentPhone: walkInForm.parentPhone,
        physicalDocsSighted: {
          birthCertificate: walkInForm.docBirthCert,
          passportPhotograph: walkInForm.docPassport,
          academicResults: walkInForm.docResults,
          lgaIndigeneCert: walkInForm.docIndigene,
        },
        payment: {
          method: walkInForm.paymentMethod,
          amount: walkInForm.paymentAmount,
          posTerminalReference: walkInForm.posTerminalReference || undefined,
        },
      });

      if (res.success && res.applicationNumber) {
        const newApp: SerializedApplication = {
          id: `walkin-${Date.now()}`,
          tenantId: schoolId,
          schoolId,
          academicSessionId: walkInForm.academicSessionId,
          programId: walkInForm.programId,
          applicationNumber: res.applicationNumber,
          intakeChannel: "WALK_IN",
          firstName: walkInForm.firstName,
          lastName: walkInForm.lastName,
          middleName: walkInForm.middleName,
          email: walkInForm.email,
          phoneNumber: walkInForm.phoneNumber,
          whatsappNumber: walkInForm.whatsappNumber || walkInForm.phoneNumber,
          dateOfBirth: walkInForm.dateOfBirth,
          gender: walkInForm.gender,
          status: "SUBMITTED",
          tierSpecificData: {
            parent: { name: walkInForm.parentName, phone: walkInForm.parentPhone },
          },
          documents: [],
          feeTransactions: [
            {
              id: `tx-${Date.now()}`,
              paymentMethod: walkInForm.paymentMethod,
              amount: walkInForm.paymentAmount,
              currency: "NGN",
              paymentReference: res.paymentReference || "POS-SETTLED",
              paymentStatus: "SETTLED",
              createdAt: new Date().toISOString(),
            },
          ],
          metadata: {},
          createdAt: new Date().toISOString(),
        };
        setApplications((prev) => [newApp, ...prev]);
        setWalkInDrawerOpen(false);
        setFeedback({
          type: "success",
          message: `Walk-in ${tierConfig.applicantLabel.toLowerCase()} registered: ${res.applicationNumber} (Payment Settled).`,
        });
        setWalkInForm({
          firstName: "",
          middleName: "",
          lastName: "",
          email: "",
          phoneNumber: "",
          whatsappNumber: "",
          dateOfBirth: "2010-01-01",
          gender: "MALE",
          parentName: "",
          parentPhone: "",
          parentRelationship: "Parent",
          previousSchool: "",
          programId: "Primary",
          academicSessionId: cycles[0]?.session || "2026/2027",
          docBirthCert: true,
          docPassport: true,
          docResults: false,
          docIndigene: false,
          paymentMethod: "POS_COUNTER",
          paymentAmount: 5000,
          posTerminalReference: "",
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Walk-in registration failed." });
      }
    });
  };

  // Action: Approve reconciliation transaction
  const handleApproveTx = (txId: string) => {
    startTransition(async () => {
      const res = await approveAdmissionsFeeTransaction({
        transactionId: txId,
        schoolId,
      });

      if (res.success && res.transaction) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === txId ? { ...t, paymentStatus: "SETTLED" } : t
          )
        );
        // Also update local application status if present and settle fee transaction in application
        setApplications((prev) =>
          prev.map((a) => {
            if (a.id === res.transaction.applicationId) {
              const updatedFeeTxs = (a.feeTransactions || []).map((t) =>
                t.id === txId || t.paymentStatus === "PENDING"
                  ? { ...t, paymentStatus: "SETTLED" }
                  : t
              );
              return {
                ...a,
                status: "UNDER_REVIEW",
                feeTransactions: updatedFeeTxs,
              };
            }
            return a;
          })
        );
        setFeedback({
          type: "success",
          message: "Transaction approved and settled. Candidate fee marked PAID (SETTLED) with status UNDER_REVIEW.",
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to settle payment." });
      }
    });
  };

  // Action: Reject reconciliation transaction
  const handleRejectTx = () => {
    if (!rejectTxId) return;
    startTransition(async () => {
      const res = await rejectAdmissionsFeeTransaction({
        transactionId: rejectTxId,
        schoolId,
        reason: rejectReason,
      });

      if (res.success) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === rejectTxId ? { ...t, paymentStatus: "REJECTED" } : t
          )
        );
        setRejectTxId(null);
        setFeedback({
          type: "success",
          message: `Transaction rejected: reason recorded (${rejectReason}).`,
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to reject transaction." });
      }
    });
  };

  // Action: Open Edit Applicant Modal
  const handleOpenEdit = (app: SerializedApplication) => {
    setEditingApp(app);
    const tierData = (app.tierSpecificData as any) || {};
    setEditForm({
      firstName: app.firstName || "",
      lastName: app.lastName || "",
      middleName: app.middleName || "",
      email: app.email || "",
      phoneNumber: app.phoneNumber || "",
      whatsappNumber: app.whatsappNumber || "",
      gender: app.gender || "MALE",
      programId: app.programId || tierData.targetGrade || "",
      dateOfBirth: app.dateOfBirth
        ? new Date(app.dateOfBirth).toISOString().split("T")[0]
        : "",
      parentName: tierData.parentName || tierData.parent?.name || "",
      parentPhone: tierData.parentPhone || tierData.parent?.phone || "",
      parentEmail: tierData.parentEmail || "",
    });
  };

  // Action: Save Edit Applicant
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    startTransition(async () => {
      const res = await updateAdmissionsApplicationBioAction({
        applicationId: editingApp.id,
        schoolId,
        schoolDomain,
        ...editForm,
      });

      if (res.success && res.application) {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === editingApp.id
              ? {
                  ...a,
                  firstName: res.application.firstName,
                  lastName: res.application.lastName,
                  middleName: res.application.middleName,
                  email: res.application.email,
                  phoneNumber: res.application.phoneNumber,
                  whatsappNumber: res.application.whatsappNumber,
                  gender: res.application.gender,
                  programId: res.application.programId,
                  dateOfBirth: res.application.dateOfBirth,
                  tierSpecificData: res.application.tierSpecificData,
                }
              : a
          )
        );
        setEditingApp(null);
        setFeedback({
          type: "success",
          message: `Applicant profile for ${res.application.firstName} ${res.application.lastName} updated successfully.`,
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to update applicant bio-data." });
      }
    });
  };

  // Action: Delete Applicant
  const handleConfirmDelete = () => {
    if (!deletingApp) return;
    setIsDeleting(true);

    startTransition(async () => {
      const res = await deleteAdmissionsApplicationAction({
        applicationId: deletingApp.id,
        schoolId,
        schoolDomain,
      });

      if (res.success) {
        setApplications((prev) => prev.filter((a) => a.id !== deletingApp.id));
        setDeletingApp(null);
        setFeedback({
          type: "success",
          message: res.message || "Applicant record removed permanently.",
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to delete applicant record." });
      }
      setIsDeleting(false);
    });
  };

  // Action: Run Global Deduplication
  const handleRunDeduplication = () => {
    setIsDeduplicating(true);
    startTransition(async () => {
      const res = await deduplicateAllAdmissionsAction({
        schoolId,
        schoolDomain,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || "Admissions deduplication completed successfully.",
        });
        // Filter out any applications that were deleted during deduplication
        // In real use, a full reload or state sync will reflect the cleanest ledger
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to execute admissions deduplication.",
        });
      }
      setIsDeduplicating(false);
    });
  };

  // Evaluate whether candidate satisfies admission requirements
  const checkCandidateRequirements = useCallback((app: SerializedApplication) => {
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
    const minCutoff = tierConfig.showPostUTME ? 160 : 50;
    const hasPassingScore = numScore !== null ? numScore >= minCutoff : true;

    const oLevelCredits = Number(tierData.oLevelCredits || tierData.creditCount || 0);
    const hasOLevel = tierConfig.showOLevel ? oLevelCredits >= 5 : true;

    const feeStatus = getFeeStatus(app);
    const feePaid =
      feeStatus === "SETTLED" ||
      Boolean(app.feeTransactions?.some((t) => t.paymentStatus === "SUCCESS" || t.paymentStatus === "PAID")) ||
      metadata.formFeeStatus === "PAID" ||
      metadata.formFeeStatus === "SETTLED";

    const missing: string[] = [];
    if (numScore !== null && !hasPassingScore) {
      missing.push(`Entrance score (${numScore}) is below passing threshold (${minCutoff}).`);
    }
    if (tierConfig.showOLevel && !hasOLevel) {
      missing.push(`O'Level credits (${oLevelCredits}) is below minimum 5 credits.`);
    }

    const isQualified = hasPassingScore && hasOLevel && app.status !== "REJECTED";

    return {
      isQualified,
      numScore,
      hasPassingScore,
      oLevelCredits,
      hasOLevel,
      feePaid,
      missing,
    };
  }, [tierConfig, getFeeStatus]);

  // Pre-filtered admission list & qualified pool
  const admissionListApps = useMemo(() => {
    return applications.filter((a) =>
      ["OFFER_EXTENDED", "OFFER_ACCEPTED", "APPROVED", "ADMITTED", "ENROLLED"].includes((a.status || "").toUpperCase())
    );
  }, [applications]);

  const qualifiedCandidates = useMemo(() => {
    return applications.filter(
      (a) =>
        !["OFFER_EXTENDED", "OFFER_ACCEPTED", "APPROVED", "ADMITTED", "ENROLLED", "REJECTED"].includes(
          (a.status || "").toUpperCase()
        ) && checkCandidateRequirements(a).isQualified
    );
  }, [applications, checkCandidateRequirements]);

  // Filtered applications for Register Data Table
  const filteredRegister = useMemo(() => {
    return applications.filter((app) => {
      // 1. Admission List / Qualified view filter
      if (registerViewFilter === "ADMISSION_LIST") {
        const isOfferedOrAdmitted = ["OFFER_EXTENDED", "OFFER_ACCEPTED", "APPROVED", "ADMITTED", "ENROLLED"].includes(
          (app.status || "").toUpperCase()
        );
        if (!isOfferedOrAdmitted) return false;
      } else if (registerViewFilter === "QUALIFIED") {
        const isAlreadyOffered = ["OFFER_EXTENDED", "OFFER_ACCEPTED", "APPROVED", "ADMITTED", "ENROLLED", "REJECTED"].includes(
          (app.status || "").toUpperCase()
        );
        if (isAlreadyOffered || !checkCandidateRequirements(app).isQualified) return false;
      }

      // Session filter
      if (selectedSession !== "ALL" && app.academicSessionId !== selectedSession) {
        return false;
      }
      // Program filter
      if (selectedProgram !== "ALL" && app.programId !== selectedProgram) {
        return false;
      }
      // O'Level Credits >= 5 filter
      if (filterOLevel5) {
        const credits = (app.tierSpecificData as any)?.oLevelCredits || 0;
        if (Number(credits) < 5) return false;
      }
      // UTME score range
      if (minUtmeScore) {
        const score = (app.tierSpecificData as any)?.utmeScore || 0;
        if (Number(score) < Number(minUtmeScore)) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${app.firstName} ${app.middleName || ""} ${app.lastName}`.toLowerCase();
        const match =
          fullName.includes(q) ||
          app.applicationNumber.toLowerCase().includes(q) ||
          app.email.toLowerCase().includes(q) ||
          app.phoneNumber.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [applications, registerViewFilter, selectedSession, selectedProgram, filterOLevel5, minUtmeScore, searchQuery, checkCandidateRequirements]);

  const totalPages = Math.ceil(filteredRegister.length / pageSize) || 1;
  const paginatedRegister = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegister.slice(start, start + pageSize);
  }, [filteredRegister, currentPage, pageSize]);

  const examCandidates = useMemo(() => {
    return applications.filter((app) => {
      const q = examSearch.toLowerCase().trim();
      const fullName = `${app.firstName} ${app.middleName || ""} ${app.lastName}`.toLowerCase();
      const appNo = (app.applicationNumber || "").toLowerCase();
      const phone = (app.phoneNumber || "").toLowerCase();

      const matchesSearch = !q || fullName.includes(q) || appNo.includes(q) || phone.includes(q);
      const matchesGrade = examGradeFilter === "ALL" || app.programId === examGradeFilter;

      const tierData = (app.tierSpecificData as any) || {};
      const score = tierData.examScore ?? tierData.entranceScore ?? (app.metadata as any)?.examScore;
      const numScore = score !== undefined && score !== null && score !== "" ? Number(score) : null;

      let matchesStatus = true;
      if (examStatusFilter === "PENDING") {
        matchesStatus = numScore === null;
      } else if (examStatusFilter === "PASSED") {
        matchesStatus = numScore !== null && numScore >= 50;
      } else if (examStatusFilter === "FAILED") {
        matchesStatus = numScore !== null && numScore < 50;
      }

      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [applications, examSearch, examGradeFilter, examStatusFilter]);

  const handleSaveExamScore = async (app: SerializedApplication, scoreVal: string) => {
    const num = Number(scoreVal);
    if (isNaN(num) || num < 0 || num > 100) {
      setFeedback({ type: "error", message: "Please enter a valid exam score between 0 and 100." });
      return;
    }
    setSavingExamScoreId(app.id);
    try {
      const res = await saveManualEntranceScoreAction({
        leadId: app.id,
        score: num,
        schoolId,
        schoolDomain,
      });
      if (res.success) {
        setApplications((prev) =>
          prev.map((a) => {
            if (a.id === app.id) {
              const updatedTier = { ...((a.tierSpecificData as any) || {}), examScore: num, entranceScore: num };
              return { ...a, tierSpecificData: updatedTier };
            }
            return a;
          })
        );
        setEditingExamScoreId(null);
        setFeedback({
          type: "success",
          message: `Entrance examination score for ${app.firstName} ${app.lastName} saved: ${num}%.`,
        });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to record exam score." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save exam score." });
    } finally {
      setSavingExamScoreId(null);
    }
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dynamic Tier Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
            Admissions Workspace
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-xs sm:text-sm flex items-center gap-2">
            <span>{copy.subtitle}</span>
            {tier === "TERTIARY" && school?.tertiaryType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Tertiary • {school.tertiaryType.replace(/_/g, " ")}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/${schoolDomain}/portal-settings?tab=entrance-exam`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 shadow-xs hover:bg-indigo-50 dark:hover:bg-zinc-700 transition"
            title="Configure Entrance Examination dates, venues, subjects, and cut-off scores"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>Entrance Exam Settings</span>
          </Link>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>{schoolName || school?.name}</span>
          </span>
        </div>
      </header>

      {/* 1. TOP METRICS FUNNEL BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {copy.cards.map((cardTitle, idx) => {
          const config = [
            { count: funnelMetrics.inquiries, subtitle: "Portal & Walk-In Leads", Icon: Users, textCls: "text-amber-600", bgCls: "bg-amber-50 dark:bg-amber-950/50" },
            { count: funnelMetrics.screening, subtitle: "Credentials & Verification", Icon: ShieldCheck, textCls: "text-blue-600", bgCls: "bg-blue-50 dark:bg-blue-950/50" },
            { count: funnelMetrics.exams, subtitle: "Assessment Scheduled", Icon: FileCheck, textCls: "text-purple-600", bgCls: "bg-purple-50 dark:bg-purple-950/50" },
            { count: funnelMetrics.offers, subtitle: "Provisional Admissions", Icon: Award, textCls: "text-indigo-600", bgCls: "bg-indigo-50 dark:bg-indigo-950/50" },
            { count: funnelMetrics.matriculated, subtitle: "Enrolled in Active SIS", Icon: GraduationCap, textCls: "text-emerald-600", bgCls: "bg-emerald-50 dark:bg-emerald-950/50" },
          ][idx] || { count: 0, subtitle: "", Icon: Users, textCls: "text-blue-600", bgCls: "bg-blue-50" };

          const { count, subtitle, Icon, textCls, bgCls } = config;

          return (
            <div
              key={cardTitle}
              className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between ${
                idx === 4 ? "col-span-2 md:col-span-1" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  {cardTitle}
                </span>
                <div className={`w-8 h-8 rounded-lg ${bgCls} flex items-center justify-center ${textCls}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50">
                  {count}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  {subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. MAIN WORKSPACE TABS */}
      <Tabs defaultValue="kanban" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <TabsTrigger value="kanban" className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 shadow-xs">
              Admissions Pipeline
            </TabsTrigger>
            <TabsTrigger value="exams" className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 shadow-xs flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Entrance Examination Schedules</span>
            </TabsTrigger>
            <TabsTrigger value="register" className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 shadow-xs">
              Admissions Register Table
            </TabsTrigger>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setRegisterViewFilter("ADMISSION_LIST");
              }}
              className={`text-xs font-semibold px-4 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition ${
                activeTab === "register" && registerViewFilter === "ADMISSION_LIST"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Admission List ({admissionListApps.length})</span>
            </button>
            <TabsTrigger value="walkin" className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 shadow-xs">
              Walk-In Intake Drawer
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 shadow-xs">
              Fee Reconciliation ({transactions.filter((t) => t.paymentStatus === "PENDING").length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWalkInDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Quick Walk-In Intake</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ADMISSIONS PIPELINE KANBAN                                         */}
        {/* ========================================================================= */}
        <TabsContent value="kanban" className="mt-4">
          <div className="flex gap-4 overflow-x-auto pb-6 w-full snap-x">
            {KANBAN_STAGES.map((col) => {
              const columnApps = applications.filter((app) => mapAppToKanbanStage(app.status) === col.key);

              return (
                <div
                  key={col.key}
                  className={`min-w-[310px] w-[310px] shrink-0 rounded-2xl p-3 border ${col.border} ${col.bg} flex flex-col max-h-[750px] shadow-2xs`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-zinc-800/60 mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                        {col.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 shadow-2xs border border-slate-200/60 dark:border-zinc-700/60">
                        {columnApps.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Cards Scroll */}
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {columnApps.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 dark:text-zinc-600 text-xs font-medium">
                        No candidates in this stage
                      </div>
                    ) : (
                      columnApps.map((app) => {
                        const feeStatus = getFeeStatus(app);
                        const docStatus = getDocStatus(app);
                        const uploadedDocsCount = countUploadedDocs(app);

                        return (
                          <div
                            key={app.id}
                            className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition space-y-2.5"
                          >
                            {/* Candidate Full Name - Strictly No Ellipsis */}
                            <div>
                              <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 whitespace-normal break-words leading-snug">
                                {app.lastName} {app.firstName} {app.middleName || ""}
                              </h3>
                              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">
                                {app.programId || "General Program"}
                              </p>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 mt-0.5">
                                {app.applicationNumber}
                              </div>
                            </div>

                            {/* Badges: Fee Pill + Document Badge + Dossier Button */}
                            <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                              {/* Fee Pill - Clicking opens read-only bank details modal */}
                              <button
                                type="button"
                                onClick={() => setBankModalApp(app)}
                                title="Click to view tenant bank details & memo reference"
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                                  feeStatus === "SETTLED"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                    : feeStatus === "PENDING"
                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                                }`}
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>{feeStatus}</span>
                              </button>

                              {/* Document Verification Badge */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                  docStatus === "MANUALLY_VERIFIED"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                    : docStatus === "REJECTED"
                                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                                    : uploadedDocsCount > 0
                                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                                }`}
                              >
                                <FileCheck className="w-3 h-3" />
                                <span>
                                  {docStatus === "MANUALLY_VERIFIED"
                                    ? "VERIFIED"
                                    : docStatus === "REJECTED"
                                    ? "REJECTED"
                                    : uploadedDocsCount > 0
                                    ? `${uploadedDocsCount}/6 DOCS`
                                    : "NO DOCS"}
                                </span>
                              </span>

                              {/* Direct Dossier Button */}
                              <button
                                type="button"
                                onClick={() => setDossierApp(app)}
                                title="Open Candidate Dossier Drawer"
                                className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer transition"
                              >
                                <Eye className="w-3 h-3 text-blue-500" />
                                <span>Dossier</span>
                              </button>
                            </div>

                            {/* Stage Selector / Action Controls */}
                            {canMutate && (
                              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-zinc-800/80">
                                <select
                                  value={col.key}
                                  onChange={(e) => handleStageChange(app.id, e.target.value)}
                                  disabled={isPending}
                                  className="text-[11px] font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-slate-700 dark:text-zinc-200 focus:outline-hidden w-full cursor-pointer"
                                >
                                  {KANBAN_STAGES.map((s) => (
                                    <option key={s.key} value={s.key}>
                                      Move to {s.label}
                                    </option>
                                  ))}
                                </select>

                                {/* Direct matriculate button if approved */}
                                {(app.status === "OFFER_EXTENDED" || app.status === "OFFER_ACCEPTED") && (
                                  <button
                                    onClick={() => setEnrollingApp(app)}
                                    title="Matriculate candidate into active SIS"
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-2xs"
                                  >
                                    Enroll
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB: ENTRANCE EXAMINATION SCHEDULES & SCORES                              */}
        {/* ========================================================================= */}
        <TabsContent value="exams" className="mt-4 space-y-4">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Total Exam Candidates
                </span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50 mt-2">
                {applications.length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Applicants in active intake queue
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Scores Recorded
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FileCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50 mt-2">
                {applications.filter((a) => {
                  const s = (a.tierSpecificData as any)?.examScore ?? (a.tierSpecificData as any)?.entranceScore ?? (a.metadata as any)?.examScore;
                  return s !== undefined && s !== null && s !== "";
                }).length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Evaluated candidate dossiers
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Passed (Qualified)
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                {applications.filter((a) => {
                  const s = (a.tierSpecificData as any)?.examScore ?? (a.tierSpecificData as any)?.entranceScore ?? (a.metadata as any)?.examScore;
                  return s !== undefined && s !== null && s !== "" && Number(s) >= 50;
                }).length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Score &ge; 50% benchmark
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Pending Examination
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                {applications.filter((a) => {
                  const s = (a.tierSpecificData as any)?.examScore ?? (a.tierSpecificData as any)?.entranceScore ?? (a.metadata as any)?.examScore;
                  return s === undefined || s === null || s === "";
                }).length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Awaiting CBT / oral screening
              </p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search exam candidates by name, application number, phone..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={examGradeFilter}
                  onChange={(e) => setExamGradeFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-700 dark:text-zinc-300 focus:outline-hidden"
                >
                  <option value="ALL">All Grades / Classes</option>
                  {Array.from(new Set(applications.map((a) => a.programId).filter(Boolean))).map((prog) => (
                    <option key={prog} value={prog}>
                      {prog}
                    </option>
                  ))}
                </select>

                <select
                  value={examStatusFilter}
                  onChange={(e) => setExamStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-700 dark:text-zinc-300 focus:outline-hidden"
                >
                  <option value="ALL">All Exam Statuses</option>
                  <option value="PENDING">Pending Evaluation</option>
                  <option value="PASSED">Passed (&ge; 50%)</option>
                  <option value="FAILED">Failed (&lt; 50%)</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setExamSearch("");
                    setExamGradeFilter("ALL");
                    setExamStatusFilter("ALL");
                  }}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Candidates Examination Table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  Entrance Examination & Screening Schedule
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Scheduled candidates, CBT scores, screening recommendations, and admit slips.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {examCandidates.length} candidate{examCandidates.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Candidate & Application</th>
                    <th className="py-3 px-4">Target Class</th>
                    <th className="py-3 px-4">Examination Session & Venue</th>
                    <th className="py-3 px-4">Entrance Score</th>
                    <th className="py-3 px-4">Recommendation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {examCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium">No entrance examination candidates found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    examCandidates.map((app) => {
                      const tierData = (app.tierSpecificData as any) || {};
                      const rawScore = tierData.examScore ?? tierData.entranceScore ?? (app.metadata as any)?.examScore;
                      const hasScore = rawScore !== undefined && rawScore !== null && rawScore !== "";
                      const numScore = hasScore ? Number(rawScore) : null;
                      const isPassed = numScore !== null && numScore >= 50;
                      const isEditingThis = editingExamScoreId === app.id;
                      const isSavingThis = savingExamScoreId === app.id;

                      const venue = tierData.examVenue || tierData.venue || "Campus CBT Center (Main Hall)";
                      const scheduleDate = tierData.examDate || tierData.interviewDate || (app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "Scheduled on Notice");

                      return (
                        <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-zinc-100 text-xs">
                              {app.firstName} {app.middleName || ""} {app.lastName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                {app.applicationNumber}
                              </span>
                              {app.phoneNumber && (
                                <span className="text-[10px] text-slate-400">{app.phoneNumber}</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                              {app.programId || tierData.targetGrade || "Standard"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 dark:text-zinc-200 font-medium text-xs flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{venue}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              Session: {app.academicSessionId || "2026/2027"} &bull; {scheduleDate}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={examScoreInputs[app.id] ?? (hasScore ? String(rawScore) : "")}
                                  onChange={(e) =>
                                    setExamScoreInputs((prev) => ({ ...prev, [app.id]: e.target.value }))
                                  }
                                  placeholder="0-100"
                                  className="w-16 px-2 py-1 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  disabled={isSavingThis}
                                  onClick={() => handleSaveExamScore(app, examScoreInputs[app.id] ?? String(rawScore ?? ""))}
                                  className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                  {isSavingThis ? "..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingExamScoreId(null)}
                                  className="px-1.5 py-1 text-[11px] rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
                                >
                                  &times;
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {hasScore ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      isPassed
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                    }`}
                                  >
                                    {numScore}%
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    Pending Exam
                                  </span>
                                )}
                                {canMutate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingExamScoreId(app.id);
                                      setExamScoreInputs((prev) => ({
                                        ...prev,
                                        [app.id]: hasScore ? String(rawScore) : "",
                                      }));
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 transition"
                                    title="Edit exam score"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {hasScore ? (
                              isPassed ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  Recommend for Admission
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  Below Cut-off (Review)
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                Awaiting CBT Results
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDossierApp(app)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition border border-indigo-200 dark:border-indigo-800/60"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect Dossier</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: ADMISSIONS REGISTER DATA TABLE                                     */}
        {/* ========================================================================= */}
        <TabsContent value="register" className="mt-4 space-y-4">
          {/* Advanced Filter Toolbar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search query input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder={tierConfig.searchPlaceholder || `Search by ${tierConfig.applicantLabel.toLowerCase()} name, application number...`}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Advanced Filter Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Academic Session from AdmissionCycle */}
                <select
                  value={selectedSession}
                  onChange={(e) => {
                    setSelectedSession(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-700 dark:text-zinc-300 focus:outline-hidden"
                >
                  <option value="ALL">All Academic Sessions</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={c.session}>
                      Session: {c.session}
                    </option>
                  ))}
                </select>

                {/* Tier dropdown */}
                <select
                  value={selectedTier}
                  onChange={(e) => {
                    setSelectedTier(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-700 dark:text-zinc-300 focus:outline-hidden"
                >
                  <option value="ALL">All Academic Tiers</option>
                  {academicTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                {/* Min UTME score */}
                {tierConfig.showPostUTME && (
                  <input
                    type="number"
                    placeholder="Min Post-UTME"
                    value={minUtmeScore}
                    onChange={(e) => {
                      setMinUtmeScore(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-28 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-700 dark:text-zinc-300 focus:outline-hidden"
                  />
                )}

                {/* O'Level >= 5 Credits toggle */}
                {tierConfig.showOLevel && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer bg-slate-50 dark:bg-zinc-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <input
                      type="checkbox"
                      checked={filterOLevel5}
                      onChange={(e) => {
                        setFilterOLevel5(e.target.checked);
                        setCurrentPage(1);
                      }}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>O&apos;Level &gt;= 5 Credits</span>
                  </label>
                )}

                {/* Deduplicate Button in Toolbar */}
                {canMutate && (
                  <button
                    type="button"
                    onClick={handleRunDeduplication}
                    disabled={isDeduplicating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 transition shadow-2xs cursor-pointer disabled:opacity-50"
                    title="Audit and clean up duplicate applicant records"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${isDeduplicating ? "animate-spin" : ""}`} />
                    <span>{isDeduplicating ? "Deduplicating..." : "✨ Deduplicate"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Batch Actions Bar (Visible when candidates selected) */}
            {selectedAppIds.length > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 animate-in fade-in">
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                  {selectedAppIds.length} {tierConfig.applicantLabel.toLowerCase()}(s) selected
                </span>
                <div className="flex items-center gap-2">
                  {tierConfig.showPostUTME && (
                    <button
                      onClick={handleExportJambCaps}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JAMB CAPS CSV</span>
                    </button>
                  )}
                  <button
                    onClick={handleBatchOfferAdmissionSelected}
                    disabled={isPending || isOfferingBatch}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition disabled:opacity-50"
                    title="Offer admission to selected candidates"
                  >
                    {isOfferingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                    <span>Offer Admission ({selectedAppIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedAppIds([])}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 px-2 py-1"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          paginatedRegister.length > 0 &&
                          paginatedRegister.every((a) => selectedAppIds.includes(a.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newIds = Array.from(
                              new Set([...selectedAppIds, ...paginatedRegister.map((a) => a.id)])
                            );
                            setSelectedAppIds(newIds);
                          } else {
                            setSelectedAppIds((prev) =>
                              prev.filter((id) => !paginatedRegister.some((a) => a.id === id))
                            );
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                    </th>
                    {tierConfig.columns.map((col) => (
                      <th
                        key={col}
                        className={`p-3 ${
                          col === "OLEVEL" || col === "SCORE" || col === "AGE"
                            ? "text-center"
                            : ""
                        }`}
                      >
                        {col === "OLEVEL" ? "O'LEVEL" : col}
                      </th>
                    ))}
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs">
                  {paginatedRegister.length === 0 ? (
                    <tr>
                      <td colSpan={tierConfig.columns.length + 2} className="text-center py-12 text-slate-400 dark:text-zinc-500">
                        No admissions records match your active filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRegister.map((app) => {
                      const tierData = (app.tierSpecificData as any) || {};
                      const oLevel = tierData.oLevelCredits || tierData.creditCount || "-";
                      const utme = tierData.utmeScore || tierData.postUtmeScore || "-";
                      const feeStatus = getFeeStatus(app);
                      const isSelected = selectedAppIds.includes(app.id);

                      return (
                        <tr
                          key={app.id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition ${
                            isSelected ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAppIds((prev) => [...prev, app.id]);
                                } else {
                                  setSelectedAppIds((prev) => prev.filter((id) => id !== app.id));
                                }
                              }}
                              className="rounded text-blue-600"
                            />
                          </td>
                          {tierConfig.columns.map((colName) => {
                            if (colName.includes("FULL NAME")) {
                              return (
                                <td
                                  key={colName}
                                  className="p-3 font-semibold text-slate-900 dark:text-zinc-100 whitespace-normal break-words max-w-[200px]"
                                >
                                  {app.lastName} {app.firstName} {app.middleName || ""}
                                </td>
                              );
                            }
                            if (colName === "APPLICATION NO") {
                              return (
                                <td key={colName} className="p-3 font-mono text-slate-600 dark:text-zinc-400">
                                  {app.applicationNumber}
                                </td>
                              );
                            }
                            if (
                              colName === "GROUP / ROOM" ||
                              colName === "CLASS" ||
                              colName === "CLASS / ARM" ||
                              colName === "PROGRAM / DEPT"
                            ) {
                              return (
                                <td key={colName} className="p-3 text-slate-600 dark:text-zinc-400">
                                  {app.programId || "General"}
                                </td>
                              );
                            }
                            if (colName === "AGE") {
                              return (
                                <td key={colName} className="p-3 text-center font-medium text-slate-700 dark:text-zinc-300">
                                  {calculateAge(app.dateOfBirth)}
                                </td>
                              );
                            }
                            if (colName === "PARENT NAME") {
                              const parentName =
                                (app.tierSpecificData as any)?.parent?.name ||
                                (app.tierSpecificData as any)?.parentName ||
                                (app.metadata as any)?.parentName ||
                                "-";
                              return (
                                <td key={colName} className="p-3 text-slate-600 dark:text-zinc-400">
                                  {parentName}
                                </td>
                              );
                            }
                            if (colName === "OLEVEL") {
                              return (
                                <td key={colName} className="p-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                      Number(oLevel) >= 5
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                        : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                                    }`}
                                  >
                                    {oLevel}
                                  </span>
                                </td>
                              );
                            }
                            if (colName === "SCORE") {
                              return (
                                <td key={colName} className="p-3 text-center font-mono font-medium text-slate-700 dark:text-zinc-300">
                                  {utme}
                                </td>
                              );
                            }
                            if (colName === "STATUS") {
                              const uploadedDocsCount = countUploadedDocs(app);
                              return (
                                <td key={colName} className="p-3">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                                      {app.status}
                                    </span>
                                    {uploadedDocsCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        <FileCheck className="w-2.5 h-2.5" />
                                        <span>{uploadedDocsCount}/6 Docs</span>
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-medium text-slate-400 dark:text-zinc-500">
                                        No docs
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            if (colName === "FEE STATUS") {
                              return (
                                <td key={colName} className="p-3">
                                  <button
                                    type="button"
                                    onClick={() => setBankModalApp(app)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                                      feeStatus === "SETTLED"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                        : feeStatus === "PENDING"
                                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                                    }`}
                                  >
                                    {feeStatus}
                                  </button>
                                </td>
                              );
                            }
                            return <td key={colName} className="p-3">-</td>;
                          })}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Dossier Drawer */}
                              <button
                                type="button"
                                onClick={() => setDossierApp(app)}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer"
                                title="Open Candidate Dossier Drawer"
                              >
                                <Eye className="w-3 h-3 text-blue-500" />
                                <span>Dossier</span>
                              </button>

                              {/* Edit Applicant Profile */}
                              {canMutate && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(app)}
                                  className="p-1.5 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:text-zinc-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-zinc-750 transition cursor-pointer"
                                  title="Edit Applicant Bio-data"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Enroll action */}
                              {app.status === "OFFER_EXTENDED" && (
                                <button
                                  onClick={() => setEnrollingApp(app)}
                                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                >
                                  Matriculate
                                </button>
                              )}
                              {/* Offer Admission Action Button */}
                              {app.status === "OFFER_EXTENDED" || app.status === "OFFER_ACCEPTED" || app.status === "APPROVED" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Provisional admission offer active and notification dispatched">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Admitted</span>
                                </span>
                              ) : app.status !== "ENROLLED" && (
                                <button
                                  type="button"
                                  onClick={() => handleOfferAdmission(app)}
                                  disabled={isPending || offeringAdmissionId === app.id || isOfferingBatch}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition shadow-2xs cursor-pointer ${
                                    checkCandidateRequirements(app).isQualified
                                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                      : "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                  } disabled:opacity-50`}
                                  title={
                                    checkCandidateRequirements(app).isQualified
                                      ? "Passes entrance requirements: Click to offer admission and dispatch instant notification"
                                      : "Admission requirements pending: Click to review or grant administrative waiver"
                                  }
                                >
                                  {offeringAdmissionId === app.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Offering...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Award className="w-3 h-3" />
                                      <span>Offer Admission</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Delete Applicant Record */}
                              {canMutate && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingApp(app)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-zinc-750 transition cursor-pointer"
                                  title="Delete Applicant Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
              <span>
                Showing {paginatedRegister.length} of {filteredRegister.length} {tierConfig.applicantLabel.toLowerCase()}(s)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: WALK-IN INTAKE DRAWER                                              */}
        {/* ========================================================================= */}
        <TabsContent value="walkin" className="mt-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs max-w-3xl mx-auto space-y-6">
            <div className="border-b border-slate-200 dark:border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>Registrar Front-Desk Walk-In Intake</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Direct single-page rapid enrollment for walk-in applicants with physical document sighting and instant POS/Cash settlement.
              </p>
            </div>

            <form onSubmit={handleWalkInSubmit} className="space-y-5">
              {/* 1. Applicant Bio-data */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  1. {tierConfig.applicantLabel} Bio-Data
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={walkInForm.firstName}
                      onChange={(e) => setWalkInForm({ ...walkInForm, firstName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      value={walkInForm.middleName}
                      onChange={(e) => setWalkInForm({ ...walkInForm, middleName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={walkInForm.lastName}
                      onChange={(e) => setWalkInForm({ ...walkInForm, lastName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={walkInForm.email}
                      onChange={(e) => setWalkInForm({ ...walkInForm, email: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={walkInForm.phoneNumber}
                      onChange={(e) => setWalkInForm({ ...walkInForm, phoneNumber: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      placeholder="Optional"
                      value={walkInForm.whatsappNumber}
                      onChange={(e) => setWalkInForm({ ...walkInForm, whatsappNumber: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      required
                      value={walkInForm.dateOfBirth}
                      onChange={(e) => setWalkInForm({ ...walkInForm, dateOfBirth: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Gender
                    </label>
                    <select
                      value={walkInForm.gender}
                      onChange={(e) => setWalkInForm({ ...walkInForm, gender: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Program / Class Applied *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Primary 1 or JSS 1"
                      value={walkInForm.programId}
                      onChange={(e) => setWalkInForm({ ...walkInForm, programId: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Parent / Guardian Bio-Data */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  2. Parent / Guardian Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Parent / Guardian Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={walkInForm.parentName}
                      onChange={(e) => setWalkInForm({ ...walkInForm, parentName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Parent Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={walkInForm.parentPhone}
                      onChange={(e) => setWalkInForm({ ...walkInForm, parentPhone: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Previous School Attended
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. St. Paul Academy"
                      value={walkInForm.previousSchool}
                      onChange={(e) => setWalkInForm({ ...walkInForm, previousSchool: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Physical Documents Checklist */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  3. Physical Documents Sighted by Officer
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={walkInForm.docBirthCert}
                      onChange={(e) => setWalkInForm({ ...walkInForm, docBirthCert: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Birth Certificate</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={walkInForm.docPassport}
                      onChange={(e) => setWalkInForm({ ...walkInForm, docPassport: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Passport Photos</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={walkInForm.docResults}
                      onChange={(e) => setWalkInForm({ ...walkInForm, docResults: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Academic Results</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={walkInForm.docIndigene}
                      onChange={(e) => setWalkInForm({ ...walkInForm, docIndigene: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>LGA Indigene Cert</span>
                  </label>
                </div>
              </div>

              {/* 4. Instant POS / Cash Payment Settlement */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  4. Application Fee Settlement (Auto-Settled)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={walkInForm.paymentMethod}
                      onChange={(e) =>
                        setWalkInForm({ ...walkInForm, paymentMethod: e.target.value as any })
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    >
                      <option value="POS_COUNTER">POS Terminal (Counter)</option>
                      <option value="CASH">Cash Over-the-Counter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Amount (NGN)
                    </label>
                    <input
                      type="number"
                      required
                      value={walkInForm.paymentAmount}
                      onChange={(e) =>
                        setWalkInForm({ ...walkInForm, paymentAmount: Number(e.target.value) })
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      POS Reference / Receipt Memo
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. POS-STANBIC-9982"
                      value={walkInForm.posTerminalReference}
                      onChange={(e) =>
                        setWalkInForm({ ...walkInForm, posTerminalReference: e.target.value })
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit &amp; Settle Walk-In Intake</span>
                </button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: FEE RECONCILIATION (EMBEDDED)                                      */}
        {/* ========================================================================= */}
        <TabsContent value="reconciliation" className="mt-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Admissions Fee Reconciliation Desk</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Verify candidate payment transfers against institutional bank ledger. Unique reference check prevents double-credit.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="p-3">Reference / Date</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Proof Receipt</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-zinc-500">
                        No admissions fee payment transactions recorded.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition">
                        <td className="p-3 font-mono">
                          <div className="font-bold text-slate-800 dark:text-zinc-200">{tx.paymentReference}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 dark:text-zinc-100">
                            {tx.application?.firstName} {tx.application?.lastName}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {tx.application?.applicationNumber}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex px-2 py-0.5 rounded-md font-medium text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-zinc-100">
                          ₦{Number(tx.amount).toLocaleString()}
                        </td>
                        <td className="p-3">
                          {tx.proofOfPaymentUrl ? (
                            <a
                              href={tx.proofOfPaymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Receipt</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No file</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              tx.paymentStatus === "SETTLED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                : tx.paymentStatus === "REJECTED"
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                            }`}
                          >
                            {tx.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {tx.paymentStatus === "PENDING" && canMutate && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveTx(tx.id)}
                                disabled={isPending}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                              >
                                Settle
                              </button>
                              <button
                                onClick={() => setRejectTxId(tx.id)}
                                disabled={isPending}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL 1: READ-ONLY TENANT BANK DETAILS MODAL                              */}
      {/* ========================================================================= */}
      {bankModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Tenant Official Settlement Bank Details</span>
              </h3>
              <button
                onClick={() => setBankModalApp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Zero-custody bank account configured for <strong>{schoolName}</strong>. Application fee transfers route directly to this account.
            </p>

            <div className="space-y-2.5 bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Bank Name:</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">
                  {bankDetails.bankName || "Zenith Bank Plc"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Account Number:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                    {bankDetails.accountNumber || "1012345678"}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(bankDetails.accountNumber || "1012345678", "accNum")
                    }
                    className="p-1 text-slate-400 hover:text-blue-600"
                    title="Copy Account Number"
                  >
                    {copiedField === "accNum" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Account Name:</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">
                  {bankDetails.accountName || schoolName}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-700">
                <span className="text-slate-500 dark:text-zinc-400">Mandatory Memo Ref:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {bankModalApp.applicationNumber}
                  </span>
                  <button
                    onClick={() => copyToClipboard(bankModalApp.applicationNumber, "memoRef")}
                    className="p-1 text-slate-400 hover:text-blue-600"
                    title="Copy Memo Reference"
                  >
                    {copiedField === "memoRef" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setBankModalApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MATRICULATION / STUDENT ENROLLMENT CONFIRMATION                  */}
      {/* ========================================================================= */}
      {enrollingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                <span>Matriculate Candidate to Active SIS</span>
              </h3>
              <button
                onClick={() => setEnrollingApp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
              <p>
                Candidate:{" "}
                <strong className="text-slate-900 dark:text-zinc-100">
                  {enrollingApp.lastName} {enrollingApp.firstName}
                </strong>{" "}
                ({enrollingApp.applicationNumber})
              </p>
              <p>
                This in-process server action generates an immutable Matriculation Number, links portal credentials, seeds 1st Term billing, and transitions status to <strong>ENROLLED</strong>.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Target Academic Tier
                </label>
                <select
                  value={enrollTierId}
                  onChange={(e) => setEnrollTierId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                >
                  {academicTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Class Arm / Grade Assignment
                </label>
                <input
                  type="text"
                  placeholder={enrollingApp.programId || "e.g. Primary 1A"}
                  value={enrollClassArm}
                  onChange={(e) => setEnrollClassArm(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Initial Term Fee Billing (NGN)
                </label>
                <input
                  type="number"
                  placeholder="0 (leave 0 if tuition billed separately)"
                  value={enrollTermFee}
                  onChange={(e) => setEnrollTermFee(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setEnrollingApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollConfirm}
                disabled={isPending}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              >
                Confirm Matriculation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RECONCILIATION REJECTION REASON                                  */}
      {/* ========================================================================= */}
      {rejectTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50">
              Reject Payment Transaction
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Select the audit reason for rejecting this fee transaction. The applicant will be notified to re-upload proof.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Rejection Reason
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
              >
                <option value="UNCONFIRMED">Unconfirmed on Bank Statement</option>
                <option value="UNDERPAID">Underpaid / Incorrect Amount</option>
                <option value="INVALID_REF">Invalid Payment Reference</option>
                <option value="FRAUDULENT">Suspected Fraudulent / Altered Slip</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setRejectTxId(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectTx}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK LAUNCHER SHEET FOR WALK-IN INTAKE */}
      <Sheet open={walkInDrawerOpen} onOpenChange={setWalkInDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              <span>Walk-In Intake Drawer</span>
            </SheetTitle>
            <SheetDescription className="text-xs">
              Quickly create and clear walk-in candidates with immediate POS/Cash receipting.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleWalkInSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={walkInForm.firstName}
                  onChange={(e) => setWalkInForm({ ...walkInForm, firstName: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={walkInForm.lastName}
                  onChange={(e) => setWalkInForm({ ...walkInForm, lastName: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={walkInForm.email}
                  onChange={(e) => setWalkInForm({ ...walkInForm, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={walkInForm.phoneNumber}
                  onChange={(e) => setWalkInForm({ ...walkInForm, phoneNumber: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Program / Grade *</label>
              <input
                type="text"
                required
                value={walkInForm.programId}
                onChange={(e) => setWalkInForm({ ...walkInForm, programId: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Parent / Guardian Name *</label>
              <input
                type="text"
                required
                value={walkInForm.parentName}
                onChange={(e) => setWalkInForm({ ...walkInForm, parentName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Parent Phone *</label>
              <input
                type="tel"
                required
                value={walkInForm.parentPhone}
                onChange={(e) => setWalkInForm({ ...walkInForm, parentPhone: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWalkInDrawerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save &amp; Settle Intake
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT APPLICANT BIO-DATA MODAL                                    */}
      {/* ========================================================================= */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <Edit className="w-4 h-4 text-indigo-600" />
                <span>Edit Applicant Bio-Data ({editingApp.applicationNumber})</span>
              </h3>
              <button
                onClick={() => setEditingApp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Target Class / Program *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.programId}
                    onChange={(e) => setEditForm({ ...editForm, programId: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Parent / Guardian Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Parent Name
                    </label>
                    <input
                      type="text"
                      value={editForm.parentName}
                      onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Parent Phone
                    </label>
                    <input
                      type="tel"
                      value={editForm.parentPhone}
                      onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE APPLICANT CONFIRMATION MODAL                              */}
      {/* ========================================================================= */}
      {deletingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                  Delete Applicant Record
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Are you sure you want to permanently remove <strong>{deletingApp.firstName} {deletingApp.lastName}</strong> ({deletingApp.applicationNumber})?
                </p>
              </div>
              <button
                onClick={() => setDeletingApp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold">Permanent removal:</span> This will safely purge the applicant profile, uploaded documents, fee transaction history, and progression records from the institution&apos;s admissions register.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingApp(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOSSIER DRAWER COMPONENT (VERIFY DOCUMENTS & DISPATCH ADMIT SLIP)         */}
      {/* ========================================================================= */}
      {dossierApp && (() => {
        const dossierFeeStatus = getFeeStatus(dossierApp);
        const isDossierFeeSettled = dossierFeeStatus === "SETTLED";
        return (
        <ApplicantDossierDrawer
          lead={{
            id: dossierApp.id,
            applicantName: `${dossierApp.firstName} ${dossierApp.lastName}`,
            targetGrade: dossierApp.programId,
            studentEmail: dossierApp.email,
            studentPhone: dossierApp.phoneNumber,
            parentEmail:
              (dossierApp.tierSpecificData as any)?.parentEmail ||
              (dossierApp.tierSpecificData as any)?.parent?.email ||
              (dossierApp.metadata as any)?.parentEmail ||
              dossierApp.email,
            parentName:
              (dossierApp.tierSpecificData as any)?.parentName ||
              (dossierApp.tierSpecificData as any)?.parent?.name,
            parentPhone:
              (dossierApp.tierSpecificData as any)?.parentPhone ||
              (dossierApp.tierSpecificData as any)?.parent?.phone ||
              dossierApp.phoneNumber,
            status: dossierApp.status,
            feePaid: isDossierFeeSettled,
            formFeePaid: isDossierFeeSettled,
            formFeeStatus: isDossierFeeSettled ? "PAID" : dossierFeeStatus === "PENDING" ? "PENDING" : "UNPAID",
            paymentState: isDossierFeeSettled ? "SETTLED" : "UNPAID",
            rawDocuments: dossierApp.documents,
            feeTransactions: dossierApp.feeTransactions,
            metadata: dossierApp.metadata,
            tierSpecificData: dossierApp.tierSpecificData,
            documents: {
              ...(dossierApp.tierSpecificData || {}),
              ...((dossierApp.tierSpecificData as any)?.documents || {}),
              ...((dossierApp.metadata as any)?.documents || {}),
              ...(isDossierFeeSettled ? { formFeePaid: true, feePaid: true, formFeeStatus: "PAID", paymentState: "SETTLED" } : {}),
              entranceScore: (dossierApp.tierSpecificData as any)?.entranceScore ?? (dossierApp.tierSpecificData as any)?.examScore ?? null,
              applicationFeeReceiptUrl:
                dossierApp.feeTransactions?.find((t) => t.proofOfPaymentUrl)?.proofOfPaymentUrl ||
                dossierApp.documents?.find((d) => ["APPLICATION_FEE_RECEIPT", "FEE_RECEIPT", "RECEIPT"].includes((d.documentType || "").toUpperCase()))?.storageKey ||
                (dossierApp.metadata as any)?.documents?.applicationFeeReceiptUrl ||
                (dossierApp.metadata as any)?.documents?.applicationFeeReceipt?.url ||
                (dossierApp.tierSpecificData as any)?.documents?.applicationFeeReceipt?.url ||
                null,
              passportPhotoUrl:
                dossierApp.documents?.find((d) => ["PASSPORT_PHOTOGRAPH", "PASSPORT_PHOTO", "PASSPORT"].includes((d.documentType || "").toUpperCase()))?.storageKey ||
                (dossierApp.metadata as any)?.documents?.passportPhotoUrl ||
                (dossierApp.metadata as any)?.documents?.passportPhoto?.url ||
                (dossierApp.tierSpecificData as any)?.documents?.passportPhoto?.url ||
                null,
              birthCertificateUrl:
                dossierApp.documents?.find((d) => ["BIRTH_CERTIFICATE", "BIRTH_CERT"].includes((d.documentType || "").toUpperCase()))?.storageKey ||
                (dossierApp.metadata as any)?.documents?.birthCertificateUrl ||
                (dossierApp.metadata as any)?.documents?.birthCertificate?.url ||
                (dossierApp.tierSpecificData as any)?.documents?.birthCertificate?.url ||
                null,
              academicResultsUrl:
                dossierApp.documents?.find((d) => ["ACADEMIC_TRANSCRIPT", "ACADEMIC_RESULTS", "O_LEVEL_RESULT", "LAST_SCHOOL_RESULT", "JAMB_RESULT_SLIP"].includes((d.documentType || "").toUpperCase()))?.storageKey ||
                (dossierApp.metadata as any)?.documents?.academicResultsUrl ||
                (dossierApp.metadata as any)?.documents?.academicResults?.url ||
                (dossierApp.tierSpecificData as any)?.documents?.academicResults?.url ||
                null,
              medicalRecordsUrl:
                dossierApp.documents?.find((d) => ["MEDICAL_REPORT", "MEDICAL_RECORDS", "MEDICAL", "IMMUNIZATION_RECORD"].includes((d.documentType || "").toUpperCase()))?.storageKey ||
                (dossierApp.metadata as any)?.documents?.medicalRecordsUrl ||
                (dossierApp.metadata as any)?.documents?.medicalRecords?.url ||
                (dossierApp.tierSpecificData as any)?.documents?.medicalRecords?.url ||
                null,
              ninSlipUrl:
                dossierApp.documents?.find((d) => ["NIN_SLIP", "NIN"].includes((d.documentType || "").toUpperCase()))?.storageKey ||
                (dossierApp.metadata as any)?.documents?.ninSlipUrl ||
                (dossierApp.metadata as any)?.documents?.ninSlip?.url ||
                (dossierApp.tierSpecificData as any)?.documents?.ninSlip?.url ||
                null,
            },
          }}
          applicant={{
            id: dossierApp.id,
            applicationNo: dossierApp.applicationNumber,
            firstName: dossierApp.firstName,
            lastName: dossierApp.lastName,
            classApplied: dossierApp.programId,
            email: dossierApp.email,
            parentEmail:
              (dossierApp.tierSpecificData as any)?.parentEmail ||
              (dossierApp.tierSpecificData as any)?.parent?.email ||
              (dossierApp.metadata as any)?.parentEmail ||
              dossierApp.email,
            parentPhone: dossierApp.phoneNumber,
            status: dossierApp.status,
            feePaid: isDossierFeeSettled,
            formFeePaid: isDossierFeeSettled,
            formFeeStatus: isDossierFeeSettled ? "PAID" : dossierFeeStatus === "PENDING" ? "PENDING" : "UNPAID",
            paymentState: isDossierFeeSettled ? "SETTLED" : "UNPAID",
            feeTransactions: dossierApp.feeTransactions,
            rawDocuments: dossierApp.documents,
            metadata: dossierApp.metadata,
            tierSpecificData: dossierApp.tierSpecificData,
          }}
          isOpen={Boolean(dossierApp)}
          onClose={() => {
            setDossierApp(null);
            startTransition(() => {
              router.refresh();
            });
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          canMutate={canMutate}
          onLeadUpdated={() => {
            // Silently keep background state fresh without reloading the page or closing the drawer
            startTransition(() => {
              router.refresh();
            });
          }}
          onRecordUpdated={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
        );
      })()}
      {/* Requirements Warning / Waiver Modal */}
      {requirementsWaiverApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-800/80 max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Admission Requirement Notice
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  <strong>{requirementsWaiverApp.app.firstName} {requirementsWaiverApp.app.lastName}</strong> ({requirementsWaiverApp.app.applicationNumber}) has pending prerequisite criteria:
                </p>
                <ul className="mt-2 text-xs text-amber-800 dark:text-amber-300 list-disc list-inside space-y-1 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60">
                  {requirementsWaiverApp.missing.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2">
                  As an admissions administrator, you may grant an official administrative waiver to extend the admission offer.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setRequirementsWaiverApp(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleOfferAdmission(requirementsWaiverApp.app, true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              >
                Grant Waiver & Offer Admission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Offer Admission to All Qualified Confirmation Modal */}
      {confirmBatchOfferOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-800 max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                <Award className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Offer Admission to Qualified Candidates
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">
                  You are about to offer provisional admission to <strong>{qualifiedCandidates.length}</strong> candidate{qualifiedCandidates.length === 1 ? "" : "s"} who passed institutional entrance requirements.
                </p>
                <div className="mt-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Instant Omnichannel Delivery</span>
                  </div>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                    Formal admission offer letters and acceptance guidelines will be dispatched instantly via Email, WhatsApp & SMS.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmBatchOfferOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOfferAdmissionToAllQualified}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm & Dispatch Offers</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
