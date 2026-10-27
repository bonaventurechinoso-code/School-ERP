"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Clock,
  Ban,
  UserCheck,
  GraduationCap,
  Calendar,
  CreditCard,
  Send,
  Lock,
  Phone,
  Mail,
  User,
  History,
  FileText,
  ExternalLink,
} from "lucide-react";
import { sendBankDetailsEmailAction, markFormFeePaidAction } from "./actions";

export interface AdmissionRegisterDrawerProps {
  applicant: any;
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  schoolDomain: string;
  schoolName?: string;
  isAuthorized?: boolean;
  onVerifyDocs: (id: string) => Promise<void>;
  onAdmit: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onRecordUpdated?: () => void;
}

export default function AdmissionRegisterDrawer({
  applicant,
  isOpen,
  onClose,
  schoolId,
  schoolDomain,
  schoolName = "Institution Admissions Desk",
  isAuthorized = false,
  onVerifyDocs,
  onAdmit,
  onReject,
  onRecordUpdated,
}: AdmissionRegisterDrawerProps) {
  const [activeTab, setActiveTab] = useState<"dossier" | "timeline">("dossier");
  const [copiedAppNo, setCopiedAppNo] = useState(false);
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Fee Dialog
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  if (!isOpen || !applicant) return null;

  // Extract credentials and docs
  const rawCreds = applicant.credentialsJson || {};
  const isArrayCreds = Array.isArray(rawCreds);
  const credsObj = isArrayCreds ? { documents: rawCreds } : { ...(rawCreds || {}) };

  const formFeePaid = Boolean(applicant.formFeePaid || credsObj.formFeePaid);
  const timelineLogs: any[] = Array.isArray(credsObj.statusLogs) ? credsObj.statusLogs : [];

  // Central Bursar Bank Details (Read-only)
  const bankDetails = {
    bankName: "Zenith Bank",
    accountNumber: "1012345678",
    accountName: `${schoolName} Admissions`,
    formFeeAmount: 5000,
  };

  const handleCopy = (text: string, field: "app" | "bankAcc" | "bankRef") => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      if (field === "app") {
        setCopiedAppNo(true);
        setTimeout(() => setCopiedAppNo(false), 2000);
      } else {
        setCopiedBankField(field);
        setTimeout(() => setCopiedBankField(null), 2000);
      }
    }
  };

  // Send Bank Details Email
  const handleSendBankDetailsEmail = async () => {
    setIsSendingEmail(true);
    setToastMsg(null);
    try {
      const targetEmail = applicant.email || "bonaveeict@gmail.com";
      const res = await sendBankDetailsEmailAction({
        registerId: applicant.id,
        schoolDomain,
        guardianEmail: targetEmail,
        applicantName: `${applicant.firstName} ${applicant.lastName}`,
        applicationNo: applicant.applicationNo,
        amount: bankDetails.formFeeAmount,
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        accountName: bankDetails.accountName,
      });

      if (res && res.success) {
        setToastMsg({ type: "success", text: `Bank details dispatched to ${targetEmail}` });
      } else {
        setToastMsg({ type: "error", text: res?.error || "Failed to dispatch email." });
      }
    } catch (err: any) {
      setToastMsg({ type: "error", text: err.message || "Failed to dispatch email." });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Mark Form Fee as Paid
  const handleMarkAsPaid = async () => {
    setIsMarkingPaid(true);
    setToastMsg(null);
    try {
      const res = await markFormFeePaidAction({
        registerId: applicant.id,
        schoolDomain,
      });

      if (res && res.success) {
        setToastMsg({ type: "success", text: "Form fee marked as PAID successfully." });
        if (onRecordUpdated) onRecordUpdated();
        setTimeout(() => {
          setIsPaymentDialogOpen(false);
        }, 1200);
      } else {
        setToastMsg({ type: "error", text: res?.error || "Failed to mark form fee paid." });
      }
    } catch (err: any) {
      setToastMsg({ type: "error", text: err.message || "Failed to mark form fee paid." });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Canonical documents list
  const docList = [
    { key: "PASSPORT", label: "Passport Photograph", isMandatory: true },
    { key: "BIRTH_CERT", label: "Birth Certificate / Age Declaration", isMandatory: true },
    { key: "PREVIOUS_RESULTS", label: "Academic Transcripts / Term Reports", isMandatory: true },
    { key: "MEDICAL", label: "Medical Certificate of Fitness", isMandatory: true },
    { key: "NIN_SLIP", label: "NIMC NIN Identification Slip", isMandatory: false },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity duration-300">
      <div className="w-full max-w-full sm:max-w-2xl md:max-w-3xl bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col transition-all border-l border-slate-200 dark:border-zinc-800">
        {/* HEADER: Full candidate name without truncation */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-zinc-800/40">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-zinc-50 break-words">
                {applicant.firstName} {applicant.lastName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {applicant.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleCopy(applicant.applicationNo, "app")}
                className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-blue-600 transition"
              >
                <span>{applicant.applicationNo}</span>
                {copiedAppNo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS: Candidate Dossier vs Audit Timeline */}
        <div className="flex items-center gap-4 px-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("dossier")}
            className={`py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "dossier"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Candidate Dossier</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "timeline"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Timeline ({timelineLogs.length})</span>
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === "dossier" ? (
            <>
              {/* Toast banner */}
              {toastMsg && (
                <div
                  className={`p-3.5 rounded-xl flex items-center justify-between text-xs font-bold ${
                    toastMsg.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  <span>{toastMsg.text}</span>
                  <button type="button" onClick={() => setToastMsg(null)} className="cursor-pointer">
                    ✕
                  </button>
                </div>
              )}

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Assigned Class */}
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Class
                  </span>
                  <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-zinc-100">
                    <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">{applicant.assignedClass || applicant.classApplied}</span>
                  </div>
                </div>

                {/* Form Fee */}
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Form Fee
                  </span>
                  <div>
                    {formFeePaid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3" /> Paid ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsPaymentDialogOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer transition"
                      >
                        <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                        <span>⏳ Pending</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Lead Source */}
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Source
                  </span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 truncate block">
                    Direct Register
                  </span>
                </div>

                {/* Date Filed */}
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Date Filed
                  </span>
                  <div className="flex items-center gap-1 font-mono text-slate-700 dark:text-zinc-300">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(applicant.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Guardian Contact Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
                <h4 className="font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 text-[11px]">
                  Guardian / Primary Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {applicant.parentPhone}
                    </span>
                  </div>
                  {applicant.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-800 dark:text-zinc-200 truncate">
                        {applicant.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Checklist */}
              <div className="space-y-3">
                <h4 className="font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 text-[11px]">
                  Submitted Credentials &amp; Verification
                </h4>
                <div className="space-y-2">
                  {docList.map((doc) => (
                    <div
                      key={doc.key}
                      className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-zinc-100 text-xs sm:text-sm truncate">
                            {doc.label}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {doc.isMandatory ? "Mandatory Document" : "Optional Document"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                          Standard File
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* TIMELINE TAB */
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Audited State Transitions ({timelineLogs.length})
              </h4>
              {timelineLogs.length === 0 ? (
                <p className="text-xs text-slate-400">No state transition logs recorded yet.</p>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
                  {timelineLogs.map((log, idx) => (
                    <div key={idx} className="relative group text-xs space-y-1">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">
                        ✓
                      </div>
                      <div className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        <span>{log.action}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-zinc-400">{log.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {!isAuthorized ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Read-Only Mode: State changes reserved for authorized staff.</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full justify-between sm:justify-end">
              {applicant.status !== "REJECTED" && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await onReject(applicant.id);
                    setIsProcessing(false);
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              )}

              {applicant.status !== "VERIFIED" && applicant.status !== "ENROLLED" && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await onVerifyDocs(applicant.id);
                    setIsProcessing(false);
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Mark Verified</span>
                </button>
              )}

              {applicant.status !== "ENROLLED" && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    await onAdmit(applicant.id);
                    setIsProcessing(false);
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Convert to Student</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FORM FEE PAYMENT ACTION DIALOG */}
      {isPaymentDialogOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <h3 className="text-base font-black text-slate-800 dark:text-zinc-100">
                  Form Fee Payment Action
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentDialogOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-Only Central Bursar Account Banner */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-[11px] font-bold text-amber-900 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                Central Bursar Account - Configured by Tenant Admin Only
              </span>
              <span className="text-[10px] text-amber-700 font-mono">READ-ONLY</span>
            </div>

            {/* Bank details grid */}
            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Bank
                  </span>
                  <span className="font-bold text-slate-800 dark:text-zinc-100">
                    {bankDetails.bankName}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Account Number
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-slate-900 dark:text-zinc-50 text-sm">
                      {bankDetails.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(bankDetails.accountNumber, "bankAcc")}
                      className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                    >
                      {copiedBankField === "bankAcc" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 dark:border-zinc-700/60 pt-2.5">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Account Name
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate block">
                    {bankDetails.accountName}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Amount
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    ₦{Number(bankDetails.formFeeAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 dark:border-zinc-700/60 pt-2.5">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Payment Reference
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 text-xs">
                      {applicant.applicationNo}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(applicant.applicationNo, "bankRef")}
                      className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                    >
                      {copiedBankField === "bankRef" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Candidate
                  </span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 truncate block text-xs">
                    {applicant.firstName} {applicant.lastName}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsPaymentDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendBankDetailsEmail}
                disabled={isSendingEmail || isMarkingPaid}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingEmail ? "Sending..." : "Send Bank Details to Email"}</span>
              </button>
              <button
                type="button"
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid || isSendingEmail}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isMarkingPaid ? "Updating..." : "Mark as Paid"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
