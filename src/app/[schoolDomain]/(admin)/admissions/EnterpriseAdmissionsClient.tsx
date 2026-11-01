"use client";

import React, { useState, useTransition, useMemo } from "react";
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
} from "lucide-react";
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
  exportJambCapsCsvAction,
  reconcileFeeAction,
  verifyDocumentAction,
  approveAdmissionsFeeTransaction,
  rejectAdmissionsFeeTransaction,
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

interface EnterpriseAdmissionsProps {
  schoolId: string;
  schoolDomain: string;
  schoolName: string;
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
  { key: "INQUIRY", label: "Inquiry", bg: "bg-slate-50 dark:bg-zinc-900/60", border: "border-slate-200 dark:border-zinc-800" },
  { key: "DOCS PENDING", label: "Docs Pending", bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900/40" },
  { key: "VERIFIED", label: "Verified", bg: "bg-blue-50/50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-900/40" },
  { key: "APPROVED", label: "Approved", bg: "bg-purple-50/50 dark:bg-purple-950/20", border: "border-purple-200 dark:border-purple-900/40" },
  { key: "REJECTED", label: "Rejected", bg: "bg-rose-50/50 dark:bg-rose-950/20", border: "border-rose-200 dark:border-rose-900/40" },
  { key: "CONVERTED", label: "Converted", bg: "bg-emerald-50/50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900/40" },
];

export default function EnterpriseAdmissionsClient({
  schoolId,
  schoolDomain,
  schoolName,
  initialApplications,
  initialTransactions,
  cycles,
  academicTiers,
  bankDetails,
  canMutate = true,
}: EnterpriseAdmissionsProps) {
  const [applications, setApplications] = useState<SerializedApplication[]>(initialApplications);
  const [transactions, setTransactions] = useState<SerializedTransaction[]>(initialTransactions);
  const [activeTab, setActiveTab] = useState("kanban");
  const [isPending, startTransition] = useTransition();

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Read-only bank modal
  const [bankModalApp, setBankModalApp] = useState<SerializedApplication | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  // Funnel bar metrics calculation
  const funnelMetrics = useMemo(() => {
    const inquiries = applications.filter(
      (a) => a.status === "DRAFT" || a.intakeChannel === "WALK_IN"
    ).length;
    const screening = applications.filter(
      (a) => a.status === "PAYMENT_PENDING" || a.status === "SUBMITTED" || a.status === "UNDER_REVIEW"
    ).length;
    const exams = applications.filter(
      (a) => a.status === "ASSESSMENT_SCHEDULED"
    ).length;
    const offers = applications.filter(
      (a) => a.status === "OFFER_EXTENDED" || a.status === "OFFER_ACCEPTED"
    ).length;
    const matriculated = applications.filter(
      (a) => a.status === "ENROLLED"
    ).length;

    return { inquiries, screening, exams, offers, matriculated };
  }, [applications]);

  // Stage mapping helper
  const mapAppToKanbanStage = (status: string): string => {
    switch (status) {
      case "DRAFT":
        return "INQUIRY";
      case "PAYMENT_PENDING":
      case "ACTION_REQUIRED":
        return "DOCS PENDING";
      case "SUBMITTED":
      case "UNDER_REVIEW":
      case "ASSESSMENT_SCHEDULED":
        return "VERIFIED";
      case "OFFER_EXTENDED":
      case "OFFER_ACCEPTED":
        return "APPROVED";
      case "REJECTED":
        return "REJECTED";
      case "ENROLLED":
        return "CONVERTED";
      default:
        return "INQUIRY";
    }
  };

  // Helper to determine fee status
  const getFeeStatus = (app: SerializedApplication): "UNPAID" | "PENDING" | "SETTLED" => {
    if (!app.feeTransactions || app.feeTransactions.length === 0) return "UNPAID";
    const hasSettled = app.feeTransactions.some((t) => t.paymentStatus === "SETTLED");
    if (hasSettled) return "SETTLED";
    const hasPending = app.feeTransactions.some((t) => t.paymentStatus === "PENDING");
    if (hasPending) return "PENDING";
    return "UNPAID";
  };

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
          message: `Walk-in candidate registered: ${res.applicationNumber} (Payment Settled).`,
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
        // Also update local application status if present
        setApplications((prev) =>
          prev.map((a) =>
            a.id === res.transaction.applicationId ? { ...a, status: "SUBMITTED" } : a
          )
        );
        setFeedback({
          type: "success",
          message: "Transaction approved and settled. Candidate transitioned to SUBMITTED.",
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

  // Filtered applications for Register Data Table
  const filteredRegister = useMemo(() => {
    return applications.filter((app) => {
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
  }, [applications, selectedSession, selectedProgram, filterOLevel5, minUtmeScore, searchQuery]);

  const totalPages = Math.ceil(filteredRegister.length / pageSize) || 1;
  const paginatedRegister = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegister.slice(start, start + pageSize);
  }, [filteredRegister, currentPage, pageSize]);

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

      {/* 1. TOP METRICS FUNNEL BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Card 1: INQUIRIES */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              INQUIRIES
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50">
              {funnelMetrics.inquiries}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Portal &amp; Walk-In Leads
            </p>
          </div>
        </div>

        {/* Card 2: SCREENING & KYC */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              SCREENING &amp; KYC
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50">
              {funnelMetrics.screening}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Credentials &amp; Payment Verification
            </p>
          </div>
        </div>

        {/* Card 3: EXAMS & INTERVIEWS */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              EXAMS &amp; INTERVIEWS
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50">
              {funnelMetrics.exams}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Assessment Scheduled
            </p>
          </div>
        </div>

        {/* Card 4: OFFERS EXTENDED */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              OFFERS EXTENDED
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50">
              {funnelMetrics.offers}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Provisional Admissions
            </p>
          </div>
        </div>

        {/* Card 5: MATRICULATED */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              MATRICULATED
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50">
              {funnelMetrics.matriculated}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Enrolled in Active SIS
            </p>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE TABS */}
      <Tabs defaultValue="kanban" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <TabsTrigger value="kanban" className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 shadow-xs">
              Admissions Pipeline Kanban
            </TabsTrigger>
            <TabsTrigger value="register" className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 shadow-xs">
              Admissions Register Table
            </TabsTrigger>
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

                            {/* Badges: Fee Pill + Document Badge */}
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
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                                }`}
                              >
                                <FileCheck className="w-3 h-3" />
                                <span>{docStatus}</span>
                              </span>
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
                  placeholder="Search by candidate name, application number, phone..."
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

                {/* O'Level >= 5 Credits toggle */}
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
              </div>
            </div>

            {/* Batch Actions Bar (Visible when candidates selected) */}
            {selectedAppIds.length > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 animate-in fade-in">
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                  {selectedAppIds.length} candidate(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportJambCaps}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JAMB CAPS CSV</span>
                  </button>
                  <button
                    onClick={handleBatchSendOffers}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Batch Send Offers</span>
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
                    <th className="p-3">Candidate Full Name</th>
                    <th className="p-3">Application No</th>
                    <th className="p-3">Program / Dept</th>
                    <th className="p-3 text-center">O&apos;Level</th>
                    <th className="p-3 text-center">Score</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Fee Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs">
                  {paginatedRegister.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 dark:text-zinc-500">
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
                          <td className="p-3 font-semibold text-slate-900 dark:text-zinc-100 whitespace-normal break-words max-w-[200px]">
                            {app.lastName} {app.firstName} {app.middleName || ""}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-zinc-400">
                            {app.applicationNumber}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-zinc-400">
                            {app.programId || "General"}
                          </td>
                          <td className="p-3 text-center">
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
                          <td className="p-3 text-center font-mono font-medium text-slate-700 dark:text-zinc-300">
                            {utme}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                              {app.status}
                            </span>
                          </td>
                          <td className="p-3">
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
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Enroll action */}
                              {app.status === "OFFER_EXTENDED" && (
                                <button
                                  onClick={() => setEnrollingApp(app)}
                                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                >
                                  Matriculate
                                </button>
                              )}
                              {/* Stage update */}
                              <button
                                onClick={() => handleStageChange(app.id, "OFFER_EXTENDED")}
                                disabled={isPending || app.status === "OFFER_EXTENDED" || app.status === "ENROLLED"}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              >
                                Extend Offer
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

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
              <span>
                Showing {paginatedRegister.length} of {filteredRegister.length} candidate(s)
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
              {/* 1. Candidate Bio-data */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  1. Candidate Bio-Data
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
    </div>
  );
}
