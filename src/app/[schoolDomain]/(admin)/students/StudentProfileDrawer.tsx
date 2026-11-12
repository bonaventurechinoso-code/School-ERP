"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import { Student, AcademicTier } from "@prisma/client";
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  GraduationCap, 
  Briefcase, 
  Calendar,
  ShieldCheck,
  ShieldAlert,
  HeartPulse,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Edit3,
  Save,
  MessageCircle,
  FileText,
  History,
  Layers,
  Receipt,
  CreditCard,
  Banknote,
  Eye,
  Download,
  ZoomIn,
  RefreshCw,
  Plus,
  Building,
  ExternalLink,
  Check,
} from "lucide-react";
import { 
  updateStudentKyc, 
  promoteStudentSingle, 
  toggleStudentSuspension, 
  getNextGrade,
  fetchStudentFinancials,
  recordManualStudentPayment,
} from "./actions";
import { approvePaymentProof, rejectPaymentProof } from "../finance/verifications/actions";

type StudentWithTier = Student & { 
  tier?: AcademicTier | null;
  cohort?: string | null;
};

function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StudentProfileDrawer({
  student: initialStudent,
  schoolId,
  tiers = [],
  activeTier,
  initialTab = "BIO",
  onClose,
  onStudentUpdated,
}: {
  student: StudentWithTier;
  schoolId: string;
  tiers?: AcademicTier[];
  activeTier?: string;
  initialTab?: "BIO" | "GUARDIAN" | "DOCS" | "LIFECYCLE" | "FINANCE";
  onClose: () => void;
  onStudentUpdated?: (updated: StudentWithTier) => void;
}) {
  const [student, setStudent] = useState<StudentWithTier>(initialStudent);
  const [activeTab, setActiveTab] = useState<"BIO" | "GUARDIAN" | "DOCS" | "LIFECYCLE" | "FINANCE">(initialTab || "BIO");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Financial State
  const [financialData, setFinancialData] = useState<{
    feeStatus: string;
    summary: {
      totalInvoiced: number;
      totalPaid: number;
      outstandingBalance: number;
      pendingProofsCount: number;
      invoicesCount: number;
      paymentProofsCount: number;
      paymentsCount: number;
    };
    invoices: any[];
    paymentProofs: any[];
    payments: any[];
  } | null>(null);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [activeFinanceSubtab, setActiveFinanceSubtab] = useState<"INVOICES" | "PROOFS" | "PAYMENTS">("INVOICES");

  // Lightbox Receipt State
  const [lightboxProof, setLightboxProof] = useState<any | null>(null);

  // Manual Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<string>("MANUAL_TRANSFER");

  // Rejection Modal State
  const [rejectingProofId, setRejectingProofId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Promotion local form state
  const [targetClassInput, setTargetClassInput] = useState<string>("");
  const [targetTierIdInput, setTargetTierIdInput] = useState<string>("");
  const [promotionReason, setPromotionReason] = useState<string>("");
  const [calculatedNextClass, setCalculatedNextClass] = useState<string | null>(null);
  const [isTerminalGraduation, setIsTerminalGraduation] = useState<boolean>(false);

  // Editable KYC form state initialized from student & dynamicFields
  const dynamic = (student.dynamicFields as Record<string, any>) || {};
  
  const [editForm, setEditForm] = useState({
    firstName: student.firstName || "",
    lastName: student.lastName || "",
    email: student.email || "",
    admissionNumber: student.admissionNumber || "",
    currentClass: student.currentClass || "",
    dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split("T")[0] : "",
    stateOfOrigin: student.stateOfOrigin || "",
    parentName: student.parentName || "",
    parentOccupation: student.parentOccupation || "",
    parentPhone: student.parentPhone || "",
    parentWhatsApp: student.parentWhatsApp || "",
    parentEmail: student.parentEmail || "",
    // Health & KYC in dynamicFields
    nin: dynamic.nin || "",
    lgaOfOrigin: dynamic.lgaOfOrigin || "",
    bloodGroup: dynamic.bloodGroup || "",
    genotype: dynamic.genotype || "",
    allergies: dynamic.allergies || "",
    medicalNotes: dynamic.medicalNotes || "",
    emergencyContactName: dynamic.emergencyContactName || "",
    emergencyContactPhone: dynamic.emergencyContactPhone || "",
    birthCertVerified: Boolean(dynamic.birthCertVerified),
    ninVerified: Boolean(dynamic.ninVerified),
    medicalCertVerified: Boolean(dynamic.medicalCertVerified),
    previousSchoolVerified: Boolean(dynamic.previousSchoolVerified),
  });

  // Calculate next class when student opens LIFECYCLE tab
  React.useEffect(() => {
    async function calculate() {
      const res = await getNextGrade(student.currentClass, student.tier?.name || activeTier);
      setCalculatedNextClass(res.nextClass);
      setIsTerminalGraduation(res.isGraduation);
      if (res.nextClass) {
        setTargetClassInput(res.nextClass);
      }
    }
    calculate();
  }, [student.currentClass, student.tier?.name, activeTier]);

  const loadFinancials = useCallback(async () => {
    setLoadingFinance(true);
    try {
      const res = await fetchStudentFinancials(schoolId, student.id, student.tier?.name || activeTier);
      if (res.success && res.summary) {
        setFinancialData(res as any);
        if (res.feeStatus && res.feeStatus !== student.feeStatus) {
          const updated = { ...student, feeStatus: res.feeStatus };
          setStudent(updated);
          if (onStudentUpdated) onStudentUpdated(updated);
        }
      }
    } catch (err) {
      console.error("Failed to load student financials:", err);
    } finally {
      setLoadingFinance(false);
    }
  }, [schoolId, student, activeTier, onStudentUpdated]);

  useEffect(() => {
    if (activeTab === "FINANCE") {
      loadFinancials();
    }
  }, [activeTab, loadFinancials]);

  const handleApproveProof = (proofId: string) => {
    setActionMsg(null);
    startTransition(async () => {
      const res = await approvePaymentProof(schoolId, proofId);
      if (res.success) {
        setActionMsg({ type: "success", text: res.message || "Payment proof approved and invoice credited!" });
        loadFinancials();
      } else {
        setActionMsg({ type: "error", text: res.error || "Failed to approve payment proof." });
      }
    });
  };

  const handleConfirmReject = () => {
    if (!rejectingProofId) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejecting this payment proof.");
      return;
    }
    setActionMsg(null);
    startTransition(async () => {
      const res = await rejectPaymentProof(schoolId, rejectingProofId, rejectionReason);
      if (res.success) {
        setActionMsg({ type: "success", text: res.message || "Payment proof rejected." });
        setRejectingProofId(null);
        setRejectionReason("");
        loadFinancials();
      } else {
        setActionMsg({ type: "error", text: res.error || "Failed to reject payment proof." });
      }
    });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoiceId || !paymentAmount || Number(paymentAmount) <= 0) {
      alert("Please select an invoice and enter a valid positive payment amount.");
      return;
    }
    setActionMsg(null);
    startTransition(async () => {
      const res = await recordManualStudentPayment(
        schoolId,
        paymentInvoiceId,
        Number(paymentAmount),
        paymentMethod,
        student.tier?.name || activeTier
      );
      if (res.success) {
        setActionMsg({ type: "success", text: res.message || "Payment recorded and student ledger updated!" });
        setShowPaymentModal(false);
        setPaymentInvoiceId("");
        setPaymentAmount("");
        loadFinancials();
      } else {
        setActionMsg({ type: "error", text: res.error || "Failed to record manual payment." });
      }
    });
  };

  const handleSaveKyc = (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg(null);
    startTransition(async () => {
      const res = await updateStudentKyc(
        schoolId,
        student.id,
        editForm,
        student.tier?.name || activeTier
      );

      if (res.success && res.student) {
        const updated = res.student as StudentWithTier;
        setStudent(updated);
        setIsEditing(false);
        setActionMsg({ type: "success", text: "Student KYC and identity profile updated successfully!" });
        if (onStudentUpdated) onStudentUpdated(updated);
      } else {
        setActionMsg({ type: "error", text: res.error || "Failed to update student profile." });
      }
    });
  };

  const handleExecutePromotion = () => {
    setActionMsg(null);
    startTransition(async () => {
      const res = await promoteStudentSingle(schoolId, {
        studentId: student.id,
        targetClass: targetClassInput || undefined,
        targetTierId: targetTierIdInput || undefined,
        reason: promotionReason || undefined,
        tierContext: student.tier?.name || activeTier
      });

      if (res.success && res.student) {
        const updated = res.student as StudentWithTier;
        setStudent(updated);
        setActionMsg({ 
          type: "success", 
          text: res.isGraduation 
            ? "Student successfully graduated to Alumni status!" 
            : `Student promoted to ${updated.currentClass}!` 
        });
        setPromotionReason("");
        if (onStudentUpdated) onStudentUpdated(updated);
      } else {
        setActionMsg({ type: "error", text: res.error || "Promotion failed." });
      }
    });
  };

  const handleToggleSuspend = () => {
    setActionMsg(null);
    startTransition(async () => {
      const res = await toggleStudentSuspension(schoolId, student.id, student.tier?.name || activeTier);
      if (res.success && res.student) {
        const updated = res.student as StudentWithTier;
        setStudent(updated);
        setActionMsg({
          type: "success",
          text: updated.status === "SUSPENDED" 
            ? "Student placed on administrative suspension." 
            : "Student reinstated to active enrollment."
        });
        if (onStudentUpdated) onStudentUpdated(updated);
      } else {
        setActionMsg({ type: "error", text: res.error || "Failed to update suspension status." });
      }
    });
  };

  const promotionHistory: Array<{
    date: string;
    fromClass: string;
    toClass: string;
    fromTier: string;
    toTier: string;
    type: string;
    remarks?: string;
  }> = Array.isArray(dynamic.promotionHistory) ? dynamic.promotionHistory : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 sm:w-14 h-12 sm:h-14 shrink-0 rounded-2xl bg-indigo-600/10 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-lg shadow-xs overflow-hidden">
              {dynamic.passportPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dynamic.passportPhotoUrl} alt="Student" className="w-full h-full object-cover" />
              ) : (
                <span>{student.firstName[0]}{student.lastName[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                  {student.firstName} {student.lastName}
                </h2>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  student.status === "ENROLLED" 
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : student.status === "SUSPENDED"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    : student.status === "ALUMNI"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}>
                  {student.status}
                </span>

                {/* Fee Status Badge */}
                {student.feeStatus && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("FINANCE")}
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full transition flex items-center gap-1 cursor-pointer hover:opacity-90 ${
                      student.feeStatus === "PAID"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                        : student.feeStatus === "PENDING_VERIFICATION"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse"
                        : student.feeStatus === "PARTIAL"
                        ? "bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
                        : "bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                    }`}
                    title="Click to view Financial Records"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    <span>Fee: {student.feeStatus.replace("_", " ")}</span>
                  </button>
                )}
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">{student.currentClass || "Unassigned Grade"}</span>
                <span className="mx-1.5">•</span>
                <span>{student.tier?.name || activeTier || "General"}</span>
                <span className="mx-1.5">•</span>
                <span className="font-mono text-slate-600 dark:text-zinc-400">{student.admissionNumber || "No ID"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                isEditing 
                  ? "bg-indigo-600 text-white border-indigo-600" 
                  : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEditing ? "Editing Mode" : "Edit Profile"}</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 bg-slate-50 dark:bg-zinc-950 hide-scrollbar gap-2 sm:gap-4">
          <button
            onClick={() => setActiveTab("BIO")}
            className={`py-3 px-1 sm:px-2 font-bold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "BIO" 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Bio-Data & Health</span>
          </button>
          <button
            onClick={() => setActiveTab("GUARDIAN")}
            className={`py-3 px-1 sm:px-2 font-bold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "GUARDIAN" 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Guardian & Contacts</span>
          </button>
          <button
            onClick={() => setActiveTab("DOCS")}
            className={`py-3 px-1 sm:px-2 font-bold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "DOCS" 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>KYC Documents</span>
          </button>
          <button
            onClick={() => setActiveTab("LIFECYCLE")}
            className={`py-3 px-1 sm:px-2 font-bold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "LIFECYCLE" 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Promotion & Lifecycle</span>
          </button>
          <button
            onClick={() => setActiveTab("FINANCE")}
            className={`py-3 px-1 sm:px-2 font-bold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "FINANCE" 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Fees & Billing</span>
            {financialData?.summary?.pendingProofsCount ? (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white animate-pulse">
                {financialData.summary.pendingProofsCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Action Alert Message */}
        {actionMsg && (
          <div className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl text-xs font-medium border flex items-center gap-2 animate-in fade-in duration-200 ${
            actionMsg.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800"
          }`}>
            {actionMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-zinc-900 space-y-6">
          
          {/* TAB 1: BIO & HEALTH */}
          {activeTab === "BIO" && (
            <div className="space-y-6 animate-in fade-in">
              {isEditing ? (
                <form id="kyc-edit-form" onSubmit={handleSaveKyc} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">First Name *</label>
                      <input 
                        type="text" 
                        required
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Last Name *</label>
                      <input 
                        type="text" 
                        required
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Admission Number</label>
                      <input 
                        type="text" 
                        value={editForm.admissionNumber}
                        onChange={(e) => setEditForm({...editForm, admissionNumber: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-mono bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Date of Birth</label>
                      <input 
                        type="date" 
                        value={editForm.dateOfBirth}
                        onChange={(e) => setEditForm({...editForm, dateOfBirth: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">State of Origin</label>
                      <input 
                        type="text" 
                        value={editForm.stateOfOrigin}
                        onChange={(e) => setEditForm({...editForm, stateOfOrigin: e.target.value})}
                        placeholder="e.g. Lagos, Anambra, Kaduna"
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">LGA of Origin</label>
                      <input 
                        type="text" 
                        value={editForm.lgaOfOrigin}
                        onChange={(e) => setEditForm({...editForm, lgaOfOrigin: e.target.value})}
                        placeholder="e.g. Ikeja, Idemili North"
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">National Identification Number (NIN)</label>
                      <input 
                        type="text" 
                        value={editForm.nin}
                        onChange={(e) => setEditForm({...editForm, nin: e.target.value})}
                        placeholder="11-digit NIN"
                        maxLength={11}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-mono bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Student Email</label>
                      <input 
                        type="email" 
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        placeholder="student@school.edu.ng"
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Health Sub-section */}
                  <div className="border-t border-slate-200 dark:border-zinc-800 pt-4">
                    <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-3">
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Medical & Health Profile</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Blood Group</label>
                        <select 
                          value={editForm.bloodGroup}
                          onChange={(e) => setEditForm({...editForm, bloodGroup: e.target.value})}
                          className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                        >
                          <option value="">Select Group...</option>
                          {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Genotype</label>
                        <select 
                          value={editForm.genotype}
                          onChange={(e) => setEditForm({...editForm, genotype: e.target.value})}
                          className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                        >
                          <option value="">Select Genotype...</option>
                          {["AA", "AS", "SS", "AC"].map(gt => (
                            <option key={gt} value={gt}>{gt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Known Allergies</label>
                        <input 
                          type="text" 
                          value={editForm.allergies}
                          onChange={(e) => setEditForm({...editForm, allergies: e.target.value})}
                          placeholder="e.g. Peanuts, Penicillin, Asthma triggers"
                          className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Medical Observations & Conditions</label>
                        <textarea 
                          rows={2}
                          value={editForm.medicalNotes}
                          onChange={(e) => setEditForm({...editForm, medicalNotes: e.target.value})}
                          placeholder="General medical history, doctor remarks, or physical accommodations..."
                          className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                    <button 
                      type="button" 
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isPending}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isPending ? "Saving..." : "Save Bio-Data"}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Read-Only Bio Grid */}
                  <div className="bg-slate-50 dark:bg-zinc-950/70 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Official Identification & Bio-Data
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Full Name</span>
                        <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{student.firstName} {student.lastName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Admission ID</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">{student.admissionNumber || "Not Set"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">COHORT</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block" title="Cohort = Year group that started together at this school. Example: Cohort 2026 = all students admitted to this school in 2026. It stays the same even when they move to Primary 2, 3, etc.">
                          {student.cohort || (dynamic as any)?.cohort || (dynamic as any)?.admissionYear || (student.admissionNumber?.split("/")[1]) || "2026"}
                        </span>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          Cohort = Year group that started together at this school.
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Date of Birth</span>
                        <span className="font-medium text-slate-800 dark:text-zinc-200 mt-0.5 block">
                          {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Unspecified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">State of Origin</span>
                        <span className="font-medium text-slate-800 dark:text-zinc-200 mt-0.5 block">{student.stateOfOrigin || "Not Stated"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">LGA of Origin</span>
                        <span className="font-medium text-slate-800 dark:text-zinc-200 mt-0.5 block">{dynamic.lgaOfOrigin || "Not Stated"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">National ID (NIN)</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-zinc-200 mt-0.5 block">
                          {dynamic.nin ? dynamic.nin : <span className="text-slate-400 italic">Not Uploaded</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Health Card */}
                  <div className="bg-rose-50/50 dark:bg-rose-950/20 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Medical Profile & Health Indicators</span>
                      </h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                        Confidential
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-rose-200/50 dark:border-rose-900/30">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Blood Group</span>
                        <span className="text-base font-black text-rose-700 dark:text-rose-400 mt-1 block">
                          {dynamic.bloodGroup || "—"}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-rose-200/50 dark:border-rose-900/30">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Genotype</span>
                        <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                          {dynamic.genotype || "—"}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-rose-200/50 dark:border-rose-900/30 col-span-2">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Allergies</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 mt-1 block truncate">
                          {dynamic.allergies || "No documented allergies"}
                        </span>
                      </div>
                    </div>

                    {dynamic.medicalNotes && (
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed bg-white/70 dark:bg-zinc-900/70 p-3 rounded-xl border border-rose-100 dark:border-rose-900/20">
                        <strong>Clinical Notes:</strong> {dynamic.medicalNotes}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: GUARDIAN & CONTACTS */}
          {activeTab === "GUARDIAN" && (
            <div className="space-y-6 animate-in fade-in">
              {isEditing ? (
                <form onSubmit={handleSaveKyc} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Guardian Name</label>
                      <input 
                        type="text" 
                        value={editForm.parentName}
                        onChange={(e) => setEditForm({...editForm, parentName: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Occupation</label>
                      <input 
                        type="text" 
                        value={editForm.parentOccupation}
                        onChange={(e) => setEditForm({...editForm, parentOccupation: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Primary Telephone</label>
                      <input 
                        type="text" 
                        value={editForm.parentPhone}
                        onChange={(e) => setEditForm({...editForm, parentPhone: e.target.value})}
                        placeholder="+234..."
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-mono bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">WhatsApp Mobile</label>
                      <input 
                        type="text" 
                        value={editForm.parentWhatsApp}
                        onChange={(e) => setEditForm({...editForm, parentWhatsApp: e.target.value})}
                        placeholder="+234..."
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-mono bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Guardian Email</label>
                      <input 
                        type="email" 
                        value={editForm.parentEmail}
                        onChange={(e) => setEditForm({...editForm, parentEmail: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Emergency Contact Person</label>
                      <input 
                        type="text" 
                        value={editForm.emergencyContactName}
                        onChange={(e) => setEditForm({...editForm, emergencyContactName: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">Emergency Phone</label>
                      <input 
                        type="text" 
                        value={editForm.emergencyContactPhone}
                        onChange={(e) => setEditForm({...editForm, emergencyContactPhone: e.target.value})}
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-mono bg-white dark:bg-zinc-950 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                    <button 
                      type="button" 
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isPending}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isPending ? "Saving..." : "Save Contacts"}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="bg-slate-50 dark:bg-zinc-950/70 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Primary Parent / Guardian Profile
                      </h3>
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Authorized Sponsor
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Guardian Name</span>
                        <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{student.parentName || "Unrecorded"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Occupation</span>
                        <span className="font-medium text-slate-800 dark:text-zinc-200 mt-0.5 block">{student.parentOccupation || "Unspecified"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Primary Telephone</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{student.parentPhone || "None"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">WhatsApp Details</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{student.parentWhatsApp || "None"}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Official Email Address</span>
                        <span className="font-medium text-slate-800 dark:text-zinc-200 mt-0.5 block">{student.parentEmail || "None recorded"}</span>
                      </div>
                    </div>

                    {/* Direct Contact Triggers */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                      {student.parentPhone && (
                        <a 
                          href={`tel:${student.parentPhone.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call Primary Phone</span>
                        </a>
                      )}
                      {student.parentWhatsApp && (
                        <a 
                          href={`https://wa.me/${student.parentWhatsApp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Chat</span>
                        </a>
                      )}
                      {student.parentEmail && (
                        <a 
                          href={`mailto:${student.parentEmail}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Send Email</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Secondary Emergency Card */}
                  <div className="bg-amber-50/60 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Secondary Emergency Contact</span>
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Contact Person</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 mt-0.5 block">
                          {dynamic.emergencyContactName || "Not Provided"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Emergency Phone</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200 mt-0.5 block">
                          {dynamic.emergencyContactPhone || "Not Provided"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: KYC DOCUMENTS */}
          {activeTab === "DOCS" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-50 dark:bg-zinc-950/70 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Official Nigerian Admissions KYC Checklist
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      Statutory admission files required by state education boards and regulatory compliance.
                    </p>
                  </div>
                  {dynamic.lastKycAuditedAt && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Audited: {new Date(dynamic.lastKycAuditedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {[
                    { 
                      key: "birthCertVerified", 
                      label: "National Population Commission (NPC) Birth Certificate", 
                      desc: "Official birth registration or statutory declaration of age",
                      verified: Boolean(dynamic.birthCertVerified) 
                    },
                    { 
                      key: "ninVerified", 
                      label: "NIMC National Identification Number (NIN) Slip", 
                      desc: "Valid 11-digit national identity credential slip",
                      verified: Boolean(dynamic.ninVerified) 
                    },
                    { 
                      key: "medicalCertVerified", 
                      label: "Medical Certificate of Fitness & Immunization", 
                      desc: "Certified clinic report stating blood group and immunization",
                      verified: Boolean(dynamic.medicalCertVerified) 
                    },
                    { 
                      key: "previousSchoolVerified", 
                      label: "Transfer Certificate / Previous Academic Transcript", 
                      desc: "Verified transcript from previous educational institution",
                      verified: Boolean(dynamic.previousSchoolVerified) 
                    },
                  ].map((doc) => (
                    <div 
                      key={doc.key} 
                      className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{doc.label}</span>
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            doc.verified 
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}>
                            {doc.verified ? "VERIFIED" : "PENDING AUDIT"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">{doc.desc}</p>
                      </div>

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          const newStatus = !doc.verified;
                          startTransition(async () => {
                            const res = await updateStudentKyc(
                              schoolId,
                              student.id,
                              { [doc.key]: newStatus },
                              student.tier?.name || activeTier
                            );
                            if (res.success && res.student) {
                              setStudent(res.student as StudentWithTier);
                              setActionMsg({ type: "success", text: `${doc.label} status updated!` });
                            }
                          });
                        }}
                        className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                          doc.verified 
                            ? "bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-300 hover:bg-slate-100"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs"
                        }`}
                      >
                        {doc.verified ? "Mark Pending" : "Verify Document"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIFECYCLE & PROMOTION */}
          {activeTab === "LIFECYCLE" && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Promotion Center Card */}
              <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                        Academic Promotion & Tier Progression
                      </h3>
                      <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                        Advance student into the next class grade or transition across educational tiers.
                      </p>
                    </div>
                  </div>
                  {isTerminalGraduation && (
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                      Graduation Year
                    </span>
                  )}
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-zinc-400">Current Placement:</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">
                      {student.currentClass || "Unassigned"} ({student.tier?.name || activeTier || "Default Tier"})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-zinc-800 pt-2">
                    <span className="text-slate-500 dark:text-zinc-400">Calculated Progression:</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                      {isTerminalGraduation 
                        ? "Graduation to Alumni (Class Slot Cleared)" 
                        : (calculatedNextClass ? `➔ Next: ${calculatedNextClass}` : "No automatic rule detected")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase mb-1">
                        Override Target Class
                      </label>
                      <input 
                        type="text"
                        value={targetClassInput}
                        onChange={(e) => setTargetClassInput(e.target.value)}
                        placeholder="e.g. Primary 3 or JSS 1"
                        className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs bg-slate-50 dark:bg-zinc-950 font-semibold text-slate-800 dark:text-white"
                      />
                    </div>

                    {tiers.length > 1 && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase mb-1">
                          Transfer to Academic Tier
                        </label>
                        <select 
                          value={targetTierIdInput}
                          onChange={(e) => setTargetTierIdInput(e.target.value)}
                          className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs bg-slate-50 dark:bg-zinc-950 font-semibold text-slate-800 dark:text-white"
                        >
                          <option value="">Keep Current Tier ({student.tier?.name || activeTier})</option>
                          {tiers.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="pt-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase mb-1">
                      Promotion Notes / Assessment Reason
                    </label>
                    <input 
                      type="text"
                      value={promotionReason}
                      onChange={(e) => setPromotionReason(e.target.value)}
                      placeholder="e.g. Cleared 3rd term promotion examinations with honors"
                      className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleExecutePromotion}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{isPending ? "Executing..." : isTerminalGraduation ? "Confirm Graduation" : "Execute Promotion"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Administrative Suspension Control */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-white">
                    Administrative Disciplinary & Portal Access Control
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Suspending a student immediately revokes their student portal credentials and marks their attendance record as inactive.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleToggleSuspend}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition shrink-0 ${
                    student.status === "SUSPENDED"
                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                  }`}
                >
                  {student.status === "SUSPENDED" ? "Reinstate Student" : "Suspend Student"}
                </button>
              </div>

              {/* Promotion Audit Log */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    Promotion & Progression Audit History
                  </h4>
                </div>

                {promotionHistory.length === 0 ? (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-zinc-950/40">
                    No prior promotion audit events recorded for this student record.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {promotionHistory.map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-200">
                            <span>{item.fromClass}</span>
                            <ArrowRight className="w-3 h-3 text-indigo-500" />
                            <span className="text-indigo-600 dark:text-indigo-400">{item.toClass}</span>
                            <span className="text-[10px] font-semibold text-slate-400">({item.type})</span>
                          </div>
                          {item.remarks && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 italic">{item.remarks}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(item.date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: FEES & BILLING */}
          {activeTab === "FINANCE" && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Student Fees & Direct Settlement
                    </h3>
                    {student.feeStatus && (
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        student.feeStatus === "PAID"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : student.feeStatus === "PENDING_VERIFICATION"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse"
                          : student.feeStatus === "PARTIAL"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      }`}>
                        {student.feeStatus.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    100% direct bank transfer collection • No platform escrow • Bursar verified
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadFinancials}
                    disabled={loadingFinance}
                    className="p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition text-xs flex items-center gap-1 font-semibold"
                    title="Refresh student financials"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingFinance ? "animate-spin text-indigo-600" : ""}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (financialData?.invoices && financialData.invoices.length > 0) {
                        const openInv = financialData.invoices.find((i: any) => i.status !== "PAID") || financialData.invoices[0];
                        setPaymentInvoiceId(openInv.id);
                        setPaymentAmount(Math.max(0, openInv.amountDue - openInv.amountPaid));
                      }
                      setShowPaymentModal(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>
                </div>
              </div>

              {loadingFinance && !financialData && (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>Loading financial records and payment proofs...</span>
                </div>
              )}

              {financialData && (
                <>
                  {/* Financial Metrics Cards (3 Cards) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Invoiced
                      </span>
                      <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
                        {formatNaira(financialData.summary.totalInvoiced)}
                      </p>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
                        {financialData.summary.invoicesCount} billing schedule item(s)
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Paid
                      </span>
                      <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                        {formatNaira(financialData.summary.totalPaid)}
                      </p>
                      <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{
                            width: `${financialData.summary.totalInvoiced > 0 ? Math.min(100, Math.round((financialData.summary.totalPaid / financialData.summary.totalInvoiced) * 100)) : 0}%`
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Outstanding Balance
                      </span>
                      <p className={`text-xl font-black font-mono mt-1 ${financialData.summary.outstandingBalance > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                        {formatNaira(financialData.summary.outstandingBalance)}
                      </p>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
                        {financialData.summary.outstandingBalance > 0 ? "Pending tuition balance" : "Fully settled"}
                      </span>
                    </div>
                  </div>

                  {/* Subtabs for Finance Details */}
                  <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-4 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveFinanceSubtab("INVOICES")}
                      className={`pb-2 transition border-b-2 ${
                        activeFinanceSubtab === "INVOICES"
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                          : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700"
                      }`}
                    >
                      Invoices & Bills ({financialData.invoices.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFinanceSubtab("PROOFS")}
                      className={`pb-2 transition border-b-2 flex items-center gap-1.5 ${
                        activeFinanceSubtab === "PROOFS"
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                          : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700"
                      }`}
                    >
                      <span>Bank Transfer Proofs ({financialData.paymentProofs.length})</span>
                      {financialData.summary.pendingProofsCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                          {financialData.summary.pendingProofsCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFinanceSubtab("PAYMENTS")}
                      className={`pb-2 transition border-b-2 ${
                        activeFinanceSubtab === "PAYMENTS"
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                          : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700"
                      }`}
                    >
                      Receipt Ledger ({financialData.payments.length})
                    </button>
                  </div>

                  {/* SUBTAB 1: INVOICES */}
                  {activeFinanceSubtab === "INVOICES" && (
                    <div className="space-y-3">
                      {financialData.invoices.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                          No invoices have been billed to this student yet.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {financialData.invoices.map((inv: any) => {
                            const isPaid = inv.status === "PAID";
                            const remaining = Math.max(0, inv.amountDue - inv.amountPaid);
                            return (
                              <div
                                key={inv.id}
                                className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {inv.description || "Tuition Invoice"}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      isPaid
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        : inv.status === "PARTIAL"
                                        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                    }`}>
                                      {inv.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-[11px]">
                                    <span>Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</span>
                                    {inv.feeTemplate?.name && (
                                      <>
                                        <span>•</span>
                                        <span>Template: {inv.feeTemplate.name}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 self-end sm:self-center">
                                  <div className="text-right">
                                    <span className="text-[10px] text-slate-400 block uppercase">
                                      {isPaid ? "Settled" : `Remaining: ${formatNaira(remaining)}`}
                                    </span>
                                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                      {formatNaira(inv.amountPaid)} / {formatNaira(inv.amountDue)}
                                    </span>
                                  </div>

                                  {!isPaid && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPaymentInvoiceId(inv.id);
                                        setPaymentAmount(remaining);
                                        setShowPaymentModal(true);
                                      }}
                                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1"
                                    >
                                      <CreditCard className="w-3 h-3 text-indigo-500" />
                                      <span>Pay</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 2: PAYMENT PROOFS */}
                  {activeFinanceSubtab === "PROOFS" && (
                    <div className="space-y-3">
                      {financialData.paymentProofs.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                          No direct bank transfer receipts uploaded for this student yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {financialData.paymentProofs.map((proof: any) => {
                            const isPending = proof.status === "PENDING";
                            const isApproved = proof.status === "APPROVED";

                            return (
                              <div
                                key={proof.id}
                                className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
                              >
                                <div className="flex items-start gap-3">
                                  {/* Receipt Thumbnail with Lightbox click */}
                                  <button
                                    type="button"
                                    onClick={() => setLightboxProof(proof)}
                                    className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 overflow-hidden shrink-0 relative group cursor-pointer"
                                    title="Click to zoom receipt"
                                  >
                                    {proof.proofImageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={proof.proofImageUrl}
                                        alt="Receipt"
                                        className="w-full h-full object-cover group-hover:scale-105 transition"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <FileText className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </button>

                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                        {formatNaira(proof.amount)}
                                      </span>
                                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        isApproved
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                          : isPending
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse"
                                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                      }`}>
                                        {proof.status}
                                      </span>
                                    </div>

                                    <p className="text-slate-600 dark:text-zinc-300 font-medium">
                                      {proof.payerBankName} • {proof.payerAccountName || "Student Parent"}
                                    </p>

                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                                      <span>Ref: {proof.sessionId}</span>
                                      <span>•</span>
                                      <span>{new Date(proof.submittedAt).toLocaleDateString()}</span>
                                    </div>

                                    {proof.rejectionReason && (
                                      <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium mt-1">
                                        Reason: {proof.rejectionReason}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  <button
                                    type="button"
                                    onClick={() => setLightboxProof(proof)}
                                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs transition flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Inspect</span>
                                  </button>

                                  {isPending && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveProof(proof.id)}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Approve</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setRejectingProofId(proof.id)}
                                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900 font-bold text-xs transition"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 3: SETTLED PAYMENTS LEDGER */}
                  {activeFinanceSubtab === "PAYMENTS" && (
                    <div className="space-y-3">
                      {financialData.payments.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                          No confirmed payment receipts recorded yet for this student.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden">
                          {financialData.payments.map((pmt: any) => (
                            <div key={pmt.id} className="p-3.5 flex items-center justify-between text-xs">
                              <div>
                                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-200">
                                  <span>{formatNaira(pmt.amountPaid)}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-mono">
                                    {pmt.method || "TRANSFER"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                  {pmt.invoice?.description || "Tuition Settlement"}
                                </p>
                              </div>
                              <span className="font-mono text-[11px] text-slate-400">
                                {new Date(pmt.paymentDate).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Lightbox Receipt Inspection Modal */}
      {lightboxProof && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setLightboxProof(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 p-4 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bank Transfer Receipt Proof
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {lightboxProof.payerBankName} • Ref: {lightboxProof.sessionId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxProof(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2">
              {lightboxProof.proofImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxProof.proofImageUrl}
                  alt="Receipt Preview"
                  className="max-h-[60vh] w-auto object-contain rounded-lg"
                />
              ) : (
                <p className="text-xs text-slate-400">No image available.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatNaira(lightboxProof.amount)}
              </span>
              <div className="flex items-center gap-2">
                {lightboxProof.proofImageUrl && (
                  <a
                    href={lightboxProof.proofImageUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
                {lightboxProof.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = lightboxProof.id;
                      setLightboxProof(null);
                      handleApproveProof(id);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Now</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 p-5 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Record Offline / Direct Bank Payment</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 font-bold mb-1">Target Invoice *</label>
                <select
                  required
                  value={paymentInvoiceId}
                  onChange={(e) => {
                    setPaymentInvoiceId(e.target.value);
                    const inv = financialData?.invoices?.find((i: any) => i.id === e.target.value);
                    if (inv) {
                      setPaymentAmount(Math.max(0, inv.amountDue - inv.amountPaid));
                    }
                  }}
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="" disabled>Select an invoice...</option>
                  {financialData?.invoices?.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.description} (Rem: {formatNaira(Math.max(0, inv.amountDue - inv.amountPaid))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-zinc-400 font-bold mb-1">Payment Amount (₦) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 50000"
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 font-mono bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-zinc-400 font-bold mb-1">Payment Channel</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="MANUAL_TRANSFER">Direct Bank Transfer (NIP)</option>
                  <option value="CASH">Cash Deposit to Bursary</option>
                  <option value="BANK_DRAFT">Bank Draft / Cheque</option>
                  <option value="POS">School POS Terminal</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isPending ? "Recording..." : "Confirm Payment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingProofId && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setRejectingProofId(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 p-5 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h4 className="text-sm font-bold text-rose-600 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Reject Bank Payment Proof</span>
              </h4>
              <button
                type="button"
                onClick={() => setRejectingProofId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-zinc-300">
                Please specify a reason for rejection. This feedback will be recorded in the audit trail:
              </p>

              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Session ID not reflecting on school bank statement, or amount does not match."
                className="w-full border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingProofId(null);
                    setRejectionReason("");
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmReject}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5"
                >
                  <span>{isPending ? "Rejecting..." : "Reject Proof"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
