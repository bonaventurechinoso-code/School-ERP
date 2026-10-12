"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Users,
  CreditCard,
  Layers,
  Power,
  Trash2,
  KeyRound,
  Receipt,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
  Calendar,
  MapPin,
  ShieldCheck,
  Server,
  Lock,
  RefreshCw,
  Copy,
  Check,
  X,
} from "lucide-react";
import {
  findSchool,
  INITIAL_SCHOOLS,
  INITIAL_PROOFS,
  SchoolTenant,
  BankTransferProof,
  SubscriptionStatus,
} from "../../mock-data";

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const router = useRouter();
  const routeParams = useParams();
  // Safe param unwrapping for Next.js 15
  const unwrappedParams = typeof (params as any)?.then === "function" ? use(params as Promise<{ id: string }>) : (params as { id: string });
  const tenantId = (routeParams?.id as string) || unwrappedParams?.id || "";

  // Find school by id, code or subdomain
  const initialSchool = findSchool(tenantId) || INITIAL_SCHOOLS[0];

  const [school, setSchool] = useState<SchoolTenant>(initialSchool);
  const [proofs, setProofs] = useState<BankTransferProof[]>(INITIAL_PROOFS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isVerifyProofModalOpen, setIsVerifyProofModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);

  // Password reset state
  const [tempPassword, setTempPassword] = useState("School#Pass2026");
  const [forceChangeNextLogin, setForceChangeNextLogin] = useState(true);
  const [copiedPass, setCopiedPass] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isSuspended = school.subscriptionStatus === "Suspended";
  const isPendingVerification = school.subscriptionStatus === "Pending Verification";

  // Actions
  const handleToggleSuspend = () => {
    const newStatus: SubscriptionStatus = isSuspended ? "Active" : "Suspended";
    setSchool((prev) => ({
      ...prev,
      subscriptionStatus: newStatus,
      planStatus: isSuspended ? "Active" : "Suspended",
    }));
    triggerToast(
      `${school.name} has been ${isSuspended ? "reactivated successfully" : "suspended"}.`
    );
    setIsSuspendModalOpen(false);
  };

  const handleDeleteTenant = () => {
    if (deleteConfirmationInput.trim() !== school.name) {
      triggerToast("School name does not match. Deletion aborted.");
      return;
    }
    triggerToast(`Tenant ${school.name} permanently deleted.`);
    setIsDeleteModalOpen(false);
    setTimeout(() => {
      router.push("/dashboard/super-admin/tenants");
    }, 1200);
  };

  const handleApproveProof = () => {
    setSchool((prev) => ({
      ...prev,
      subscriptionStatus: "Active",
      planStatus: "Active",
      lastPaymentDate: "Today (Verified)",
    }));
    setProofs((prev) =>
      prev.map((p) =>
        p.schoolCode === school.code ? { ...p, status: "Approved" } : p
      )
    );
    setIsVerifyProofModalOpen(false);
    triggerToast(`Bank transfer verified & ${school.name} activated on ${school.tier} tier!`);
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let gen = "";
    for (let i = 0; i < 12; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(gen);
    setCopiedPass(false);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleConfirmResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetPasswordModalOpen(false);
    triggerToast(`Administrator password for ${school.adminName} has been reset.`);
  };

  const matchingProof = proofs.find(
    (p) => p.schoolCode === school.code || p.schoolId === school.id
  ) || {
    id: "proof-temp",
    schoolId: school.id,
    schoolName: school.name,
    schoolCode: school.code,
    amount: school.monthlyRevenue || 150000,
    referenceId: "TRX-MANUAL-VERIFY",
    bankName: "Zenith Bank PLC",
    uploadedAt: "Recent",
    planRequested: school.tier,
    depositorName: school.adminName,
    proofImageUrl:
      school.paymentProofUrl ||
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    status: isPendingVerification ? "Pending" : "Approved",
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-950 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-[95vw]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Breadcrumb & Back */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/super-admin/tenants"
          className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Tenants</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-xs font-mono text-slate-500 font-semibold">{school.code}</span>
      </div>

      {/* Tenant Header Profile Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              {school.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {school.name}
                </h1>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    school.tier === "Enterprise"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : school.tier === "Premium"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : school.tier === "Basic"
                      ? "bg-slate-100 text-slate-700 border-slate-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {school.tier} Tier
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    school.subscriptionStatus === "Active"
                      ? "bg-emerald-100 text-emerald-800"
                      : school.subscriptionStatus === "Pending Verification"
                      ? "bg-amber-100 text-amber-800 animate-pulse"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      school.subscriptionStatus === "Active"
                        ? "bg-emerald-500"
                        : school.subscriptionStatus === "Pending Verification"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  ></span>
                  {school.subscriptionStatus}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1.5 flex flex-wrap items-center gap-3">
                <span>Code: <strong className="text-slate-800">{school.code}</strong></span>
                <span>•</span>
                <span>Subdomain: <strong className="text-slate-800">{school.subdomain}.schoolerp.com</strong></span>
                <span>•</span>
                <span>Admin: <strong className="text-slate-800">{school.adminName}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isPendingVerification && (
              <button
                type="button"
                onClick={() => setIsVerifyProofModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 inline-flex items-center gap-1.5"
              >
                <Receipt className="w-4 h-4" />
                <span>Verify Bank Transfer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsResetPasswordModalOpen(true)}
              className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4 text-slate-500" />
              <span>Reset Password</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSuspendModalOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                isSuspended
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                  : "border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{isSuspended ? "Reactivate Tenant" : "Suspend Access"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteConfirmationInput("");
                setIsDeleteModalOpen(true);
              }}
              className="p-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors"
              title="Delete Tenant Permanently"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <a
              href={`https://${school.subdomain}.schoolerp.com`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow inline-flex items-center gap-1.5"
            >
              <span>Visit Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 4 Detail KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {school.studentsCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Across nursery, primary, & high school</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Monthly Rate</span>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₦{school.monthlyRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Bank transfer billing per term</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Last Payment Date</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2">
            {school.lastPaymentDate || "Awaiting Verification"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Confirmed bank slip receipt</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Database Isolation</span>
            <Server className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
            RLS Active
          </div>
          <div className="text-xs text-slate-500 mt-1">Multi-Tenant PostgreSQL</div>
        </div>
      </div>

      {/* Main Grid: Details Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Comprehensive Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Institutional Contact & Administration */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Administrative & Contact Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-1">Primary Administrator</span>
                <span className="font-bold text-slate-900 text-sm">{school.adminName}</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Assigned Headmaster / Principal</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-1">Official Email Address</span>
                <a
                  href={`mailto:${school.contactEmail}`}
                  className="font-bold text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {school.contactEmail}
                </a>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-1">Phone Number</span>
                <span className="font-bold text-slate-900 text-sm inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {school.contactPhone}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-1">Registration Date</span>
                <span className="font-bold text-slate-900 text-sm inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {school.joinedDate}
                </span>
              </div>

              <div className="sm:col-span-2 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-1">Campus Physical Address</span>
                <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  {school.address || "Main Educational Campus, Victoria Island, Lagos"}
                  {school.state ? ` (${school.lga}, ${school.state})` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Bank Transfer & Billing Section */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Bank Transfer Payment Records</span>
              </h2>
              {isPendingVerification && (
                <button
                  type="button"
                  onClick={() => setIsVerifyProofModalOpen(true)}
                  className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors"
                >
                  Verify Pending Slip
                </button>
              )}
            </div>

            <div className="border border-slate-200/70 rounded-2xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900">Reference: {matchingProof.referenceId}</span>
                  <span className="text-slate-500 block">Bank: {matchingProof.bankName}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-slate-900 text-sm">
                    ₦{matchingProof.amount.toLocaleString()}
                  </span>
                  <span
                    className={`block text-[11px] font-bold ${
                      matchingProof.status === "Approved"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {matchingProof.status}
                  </span>
                </div>
              </div>

              {matchingProof.proofImageUrl && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Bank Deposit Voucher on file</span>
                  <button
                    type="button"
                    onClick={() => setIsVerifyProofModalOpen(true)}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View Deposit Slip &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Technical & Security Config */}
        <div className="space-y-6">
          <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 space-y-5">
            <h2 className="text-base font-bold flex items-center gap-2 text-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Tenant Security & Isolation</span>
            </h2>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Subdomain Routing</span>
                <span className="font-mono text-emerald-400 font-semibold mt-0.5 block">
                  {school.subdomain}.schoolerp.com
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Wildcard SSL Active (Let&apos;s Encrypt)</span>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Database Security</span>
                <span className="font-mono text-blue-400 font-semibold mt-0.5 block">
                  schema_tenant_{school.code.toLowerCase()}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Row-Level Security (RLS) Enforced</span>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Plan Entitlements</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{school.tier} Subscription</span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Student limit: {school.tier === "Enterprise" ? "Unlimited" : "1,000 max"}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(true)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-700"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Issue Temp Admin Password</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* 1. Suspend / Reactivate Modal */}
      {isSuspendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              {isSuspended ? "Reactivate School Access" : "Suspend School Access"}
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {isSuspended
                ? `Are you sure you want to reactivate ${school.name}? Students and teachers will regain portal access immediately.`
                : `Are you sure you want to suspend ${school.name}? All staff, student, and parent portals will be locked out.`}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsSuspendModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleSuspend}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-colors ${
                  isSuspended
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isSuspended ? "Confirm Reactivation" : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Delete Modal (Type name to confirm) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-2xl border border-rose-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Delete Tenant Permanently</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              This action <span className="font-bold text-rose-600">CANNOT BE UNDONE</span>. It will
              permanently erase student records, report cards, exam scores, and fee records for{" "}
              <span className="font-bold">{school.name}</span>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type <span className="font-mono text-rose-600 font-bold">{school.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="Type school name exactly..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationInput.trim() !== school.name}
                onClick={handleDeleteTenant}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Permanently Erase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Verify Bank Transfer Modal */}
      {isVerifyProofModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-lg p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  ₦
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Verify Bank Transfer Proof</h3>
                  <p className="text-[11px] text-slate-500">{school.name} ({school.code})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVerifyProofModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400">Reference:</span>
                  <div className="font-mono font-bold text-slate-900">{matchingProof.referenceId}</div>
                </div>
                <div>
                  <span className="text-slate-400">Amount:</span>
                  <div className="font-black text-emerald-700 font-mono text-sm">
                    ₦{matchingProof.amount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Bank:</span>
                  <div className="font-semibold text-slate-900">{matchingProof.bankName}</div>
                </div>
                <div>
                  <span className="text-slate-400">Depositor:</span>
                  <div className="font-semibold text-slate-900">{matchingProof.depositorName}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 bg-slate-100 text-center">
                <div className="text-[11px] font-semibold text-slate-500 mb-2">
                  Uploaded Deposit Slip
                </div>
                <div className="h-40 w-full bg-slate-200 rounded-lg flex items-center justify-center flex-col gap-2 p-4 border border-slate-300">
                  <Receipt className="w-8 h-8 text-slate-400" />
                  <span className="font-mono text-xs font-bold text-slate-700">
                    {matchingProof.bankName} - TELLER SLIP
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Paid: ₦{matchingProof.amount.toLocaleString()} • Ref: {matchingProof.referenceId}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsVerifyProofModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleApproveProof}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                Approve & Activate Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Reset Admin Password Modal */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">Reset Admin Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="py-4 space-y-4 text-xs">
              <p className="text-slate-600">
                Generate an immediate one-time master password for{" "}
                <span className="font-bold text-slate-900">{school.adminName}</span> (
                {school.contactEmail}).
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Temporary Credentials
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tempPassword}
                    className="flex-1 px-3 py-2 bg-slate-50 font-mono font-bold text-slate-900 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
                    title="Copy Password"
                  >
                    {copiedPass ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
                    title="Generate New"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="forceReset"
                  checked={forceChangeNextLogin}
                  onChange={(e) => setForceChangeNextLogin(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="forceReset" className="text-slate-700 font-medium">
                  Enforce immediate password change upon next admin login
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-950 text-white rounded-xl font-bold hover:bg-slate-800"
                >
                  Save & Dispatch Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
