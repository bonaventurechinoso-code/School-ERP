"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  Copy,
  Check,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  ShieldCheck,
  Loader2,
  Send,
  FileText,
} from "lucide-react";
import { NIGERIAN_BANKS } from "@/lib/nigerian-banks";

export interface TenantBankAccountItem {
  bank_name: string;
  account_number: string;
  account_name: string;
  branch_code?: string;
  currency?: string;
  swift_bic?: string;
}

export interface ApplicationFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  schoolId?: string;
  schoolDomain?: string;
  schoolName?: string;
  applicantId: string;
  applicantName: string;
  applicantEmail?: string | null;
  applicationReference: string;
  defaultAmount?: number;
  onSubmitted?: (receipt: any) => void;
  onSendEmailAction?: () => Promise<void>;
  onMarkPaidAction?: () => Promise<void>;
  isAdminView?: boolean;
}

export default function ApplicationFeeModal({
  isOpen,
  onClose,
  tenantId,
  schoolId,
  schoolDomain,
  schoolName = "Institution",
  applicantId,
  applicantName,
  applicantEmail,
  applicationReference,
  defaultAmount = 5000,
  onSubmitted,
  onSendEmailAction,
  onMarkPaidAction,
  isAdminView = false,
}: ApplicationFeeModalProps) {
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isManualEnabled, setIsManualEnabled] = useState(true);
  const [manualDisabledReason, setManualDisabledReason] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string>(
    "Transfer the application fee to the official bank account below and include your Application Reference Code in the transfer narration/memo."
  );
  const [bankAccounts, setBankAccounts] = useState<TenantBankAccountItem[]>([]);
  const [selectedBankIdx, setSelectedBankIdx] = useState(0);
  const [supportedGateways, setSupportedGateways] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<"MANUAL_TRANSFER" | "DIRECT_GATEWAY">(
    "MANUAL_TRANSFER"
  );

  // Copy states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Upload Proof Form state
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [depositorName, setDepositorName] = useState<string>(applicantName || "");
  const [payerBankName, setPayerBankName] = useState<string>("");
  const [transferReference, setTransferReference] = useState<string>("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [submittedState, setSubmittedState] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoadingSettings(true);
    setFeedback(null);

    const lookupId = tenantId || schoolId || schoolDomain || "default";
    fetch(
      `/api/v1/tenant/settings/payments?tenant_id=${encodeURIComponent(lookupId)}&moduleType=ADMISSION_FORM_FEE`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && data.settings) {
          const s = data.settings;
          const effManual = Boolean(s.effective_is_manual_transfer_enabled);
          setIsManualEnabled(effManual);

          if (!effManual) {
            if (!s.platform_governance?.is_manual_transfer_allowed) {
              setManualDisabledReason(
                "Direct Bank / Mobile Transfer is currently disabled platform-wide by Super Admin governance."
              );
            } else {
              setManualDisabledReason(
                "Direct Bank / Mobile Transfer has been disabled by this institution's administrator."
              );
            }
          } else {
            setManualDisabledReason(null);
          }

          if (s.manual_transfer_instructions) {
            setInstructions(s.manual_transfer_instructions);
          }

          if (Array.isArray(s.bank_accounts) && s.bank_accounts.length > 0) {
            setBankAccounts(s.bank_accounts);
          } else {
            setBankAccounts([
              {
                bank_name: "Zenith Bank",
                account_number: "1012345678",
                account_name: `${schoolName} Admissions`,
                currency: "NGN",
              },
            ]);
          }

          const gws = Array.isArray(s.effective_supported_online_gateways)
            ? s.effective_supported_online_gateways
            : [];
          setSupportedGateways(gws);

          if (!effManual && gws.length > 0) {
            setSelectedMode("DIRECT_GATEWAY");
          } else {
            setSelectedMode("MANUAL_TRANSFER");
          }
        }
        if (data.setting?.amount && data.setting.amount > 0) {
          setAmount(Number(data.setting.amount));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingSettings(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, tenantId, schoolId, schoolDomain, schoolName]);

  if (!isOpen) return null;

  const activeBank = bankAccounts[selectedBankIdx] || bankAccounts[0] || null;

  const handleCopy = (value: string, key: string) => {
    if (typeof window !== "undefined" && value) {
      navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isManualEnabled) {
      setFeedback({
        type: "error",
        text: manualDisabledReason || "Manual Bank Transfer is disabled.",
      });
      return;
    }

    if (!depositorName.trim()) {
      setFeedback({ type: "error", text: "Please enter the Sender / Depositor Account Name." });
      return;
    }

    if (!transferReference.trim()) {
      setFeedback({
        type: "error",
        text: "Please enter the Bank Transfer Reference / Session ID.",
      });
      return;
    }

    if (!proofFile) {
      setFeedback({
        type: "error",
        text: "Please attach your transfer receipt (Image or PDF).",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", proofFile);
      fd.append("moduleType", "ADMISSION_FORM_FEE");
      fd.append("payerType", "APPLICANT");
      fd.append("payerId", applicantId);
      fd.append("payerName", applicantName);
      if (applicantEmail) fd.append("payerEmail", applicantEmail);
      fd.append("depositorName", depositorName.trim());
      fd.append("transferReference", transferReference.trim());
      fd.append("txnRef", transferReference.trim());
      fd.append("referenceNo", applicationReference);
      fd.append("amount", String(amount));
      fd.append("paymentMethod", "BANK_TRANSFER");
      fd.append("paymentMode", "MANUAL_TRANSFER");
      if (payerBankName) fd.append("bankName", payerBankName);
      fd.append("tenantId", tenantId || schoolId || "default");
      if (schoolId) fd.append("schoolId", schoolId);

      const res = await fetch("/api/v1/payments/receipt/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit payment proof.");
      }

      setSubmittedState("PAYMENT_PENDING_REVIEW");
      setFeedback({
        type: "success",
        text: "Proof of payment submitted! Application state is now PAYMENT_PENDING_REVIEW awaiting Finance Officer verification.",
      });

      if (onSubmitted) {
        onSubmitted(data.receipt);
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Error uploading proof of payment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-zinc-50">
                Application Fee Settlement
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Non-Custodial Direct Institution Settlement • {schoolName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingSettings ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs font-bold">
              Loading active tenant payment methods...
            </span>
          </div>
        ) : (
          <>
            {/* Payment Model Selector */}
            <div className="flex items-center gap-2">
              {isManualEnabled && (
                <button
                  type="button"
                  onClick={() => setSelectedMode("MANUAL_TRANSFER")}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedMode === "MANUAL_TRANSFER"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Direct Bank / Mobile Transfer</span>
                </button>
              )}

              {supportedGateways.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMode("DIRECT_GATEWAY")}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedMode === "DIRECT_GATEWAY"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Direct Online Gateway ({supportedGateways.join(", ")})</span>
                </button>
              )}
            </div>

            {!isManualEnabled && supportedGateways.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Direct Bank / Mobile Transfer Unavailable</span>
                </div>
                <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
                  {manualDisabledReason ||
                    "Manual bank transfer is currently turned off for this institution."}
                </p>
              </div>
            )}

            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {submittedState === "PAYMENT_PENDING_REVIEW" && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                  <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>Status: PAYMENT_PENDING_REVIEW (Pending Officer Verification)</span>
                </div>
                <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300">
                  {applicationReference}
                </span>
              </div>
            )}

            {isManualEnabled && selectedMode === "MANUAL_TRANSFER" && activeBank && (
              <div className="space-y-4">
                {/* Multi-bank selector if tenant configured multiple bank accounts */}
                {bankAccounts.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {bankAccounts.map((b, idx) => (
                      <button
                        key={`${b.bank_name}-${b.account_number}-${idx}`}
                        type="button"
                        onClick={() => setSelectedBankIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap cursor-pointer ${
                          selectedBankIdx === idx
                            ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300"
                            : "bg-white dark:bg-zinc-800 text-slate-600 border-slate-200"
                        }`}
                      >
                        {b.bank_name} ({b.currency || "NGN"})
                      </button>
                    ))}
                  </div>
                )}

                {/* Validated Bank Details Card */}
                <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Bank Name
                      </span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">
                        {activeBank.bank_name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Account Number
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {activeBank.account_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeBank.account_number, "acc")}
                          className="text-slate-400 hover:text-indigo-600 transition p-0.5 cursor-pointer"
                          title="Copy account number"
                        >
                          {copiedKey === "acc" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-zinc-700/70 pt-2.5">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Account Name
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate block">
                        {activeBank.account_name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Fee Amount ({activeBank.currency || "NGN"})
                      </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                        ₦{Number(amount).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {(activeBank.branch_code || activeBank.swift_bic) && (
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-zinc-700/70 pt-2.5">
                      {activeBank.branch_code && (
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Sort / Branch Code
                          </span>
                          <span className="font-mono text-slate-700 dark:text-zinc-300">
                            {activeBank.branch_code}
                          </span>
                        </div>
                      )}
                      {activeBank.swift_bic && (
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            SWIFT / BIC
                          </span>
                          <span className="font-mono text-slate-700 dark:text-zinc-300">
                            {activeBank.swift_bic}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-zinc-700/70 pt-2.5">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Unique Narration / Memo Ref
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                          {applicationReference}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(applicationReference, "ref")}
                          className="text-slate-400 hover:text-indigo-600 transition p-0.5 cursor-pointer"
                          title="Copy reference code"
                        >
                          {copiedKey === "ref" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Applicant
                      </span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100 truncate block">
                        {applicantName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Custom Transfer Instructions */}
                {instructions && (
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-xs text-slate-700 dark:text-zinc-300 flex items-start gap-2">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed whitespace-pre-wrap">{instructions}</p>
                  </div>
                )}

                {/* Proof of Payment Upload Form */}
                <form
                  onSubmit={handleSubmitProof}
                  className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-zinc-800"
                >
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    Submit Proof of Payment for Verification
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                        Sender / Depositor Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={depositorName}
                        onChange={(e) => setDepositorName(e.target.value)}
                        placeholder="Account holder name on receipt"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                        Transaction Reference / Session ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                        placeholder="NIP Session ID or Bank Ref"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-semibold text-slate-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                        Sender Bank
                      </label>
                      <select
                        value={payerBankName}
                        onChange={(e) => setPayerBankName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100"
                      >
                        <option value="">Select Sender Bank...</option>
                        {NIGERIAN_BANKS.map((b) => (
                          <option key={b.code} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                        Receipt Screenshot / PDF *
                      </label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-slate-600 dark:text-zinc-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Close
                    </button>

                    {isAdminView && onSendEmailAction && (
                      <button
                        type="button"
                        onClick={onSendEmailAction}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 transition cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Bank Details to Email</span>
                      </button>
                    )}

                    {isAdminView && onMarkPaidAction && (
                      <button
                        type="button"
                        onClick={onMarkPaidAction}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify & Mark Settled</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer shadow-xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>
                        {isSubmitting ? "Submitting Proof..." : "Submit Proof for Verification"}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

