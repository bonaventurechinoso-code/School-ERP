"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Building2,
  CreditCard,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";

export interface BankDetails {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  paymentInstruction?: string;
}

export type ModuleType =
  | "ADMISSION_FORM_FEE"
  | "PLATFORM_SUBSCRIPTION"
  | "TUITION"
  | "PTA"
  | "EXAM"
  | "UNIFORM"
  | "BOOKS"
  | "TRANSPORT"
  | "HOSTEL"
  | "TRANSCRIPT_FEE"
  | "RESULT_CHECKING_FEE"
  | "REPORT_CARD_CHECKING_FEE"
  | "OTHER";

export interface PaymentReceiptUploadProps {
  moduleType: ModuleType;
  payerType: "APPLICANT" | "STUDENT" | "PARENT" | "SCHOOL";
  payerId?: string;
  payerName: string;
  payerEmail?: string;
  referenceNo: string;
  tenantId: string;
  schoolId?: string;
  amount?: number;
  linkedInvoiceId?: string;
  term?: string;
  session?: string;
  bankDetails?: BankDetails;
  existingReceipt?: any;
  onUploadSuccess?: (receipt: any) => void;
  title?: string;
  subtitle?: string;
  customWriteup?: string | null;
  previewMode?: boolean;
}

export default function PaymentReceiptUpload({
  moduleType,
  payerType,
  payerId,
  payerName,
  payerEmail,
  referenceNo,
  tenantId,
  schoolId,
  amount: defaultAmount = 0,
  linkedInvoiceId,
  term,
  session,
  bankDetails: initialBankDetails,
  existingReceipt,
  onUploadSuccess,
  title: initialTitle,
  subtitle,
  customWriteup: initialCustomWriteup,
  previewMode = false,
}: PaymentReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(defaultAmount || existingReceipt?.amount || 0);
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    existingReceipt?.paymentMethod || "BANK_TRANSFER"
  );
  const [depositorName, setDepositorName] = useState<string>(
    existingReceipt?.depositorName || payerName || ""
  );
  const [txnRef, setTxnRef] = useState<string>(
    existingReceipt?.transferReference || existingReceipt?.txnRef || ""
  );
  const [bankName, setBankName] = useState<string>(existingReceipt?.bankName || "");
  const [receipt, setReceipt] = useState<any>(existingReceipt || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tenant payment activation state
  const [settingChecked, setSettingChecked] = useState(false);
  const [isModuleEnabled, setIsModuleEnabled] = useState(true);
  const [resolvedSetting, setResolvedSetting] = useState<any | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    if (previewMode) {
      setSettingChecked(true);
      setIsModuleEnabled(true);
      return;
    }

    if (tenantId && moduleType) {
      fetch(
        `/api/v1/payments/settings?tenantId=${encodeURIComponent(tenantId)}&moduleType=${encodeURIComponent(moduleType)}${term ? `&term=${encodeURIComponent(term)}` : ""}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.success && data.setting) {
            setResolvedSetting(data.setting);
            const enabled = Boolean(data.setting.isEnabled && data.setting.isActive);
            setIsModuleEnabled(enabled);
            if (enabled && defaultAmount === 0 && data.setting.amount) {
              setAmount(data.setting.amount);
            }
          }
          setSettingChecked(true);
        })
        .catch(() => {
          if (!isMounted) return;
          setSettingChecked(true);
        });
    } else {
      setSettingChecked(true);
    }

    return () => {
      isMounted = false;
    };
  }, [tenantId, moduleType, term, previewMode, defaultAmount]);

  // If check completed and institution disabled this fee: return null
  if (settingChecked && !isModuleEnabled && !previewMode) {
    return null;
  }

  const effectiveTitle = initialTitle || resolvedSetting?.title || titleForModule(moduleType);
  const effectiveCustomWriteup = initialCustomWriteup || resolvedSetting?.customWriteup;
  const effectiveBankDetails: BankDetails = initialBankDetails || {
    bankName: resolvedSetting?.bankName || undefined,
    accountNumber: resolvedSetting?.accountNumber || undefined,
    accountName: resolvedSetting?.accountName || undefined,
    paymentInstruction: undefined,
  };



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setErrorMsg(null);
      if (selected.type.startsWith("image/")) {
        setFilePreview(URL.createObjectURL(selected));
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!file && !receipt?.fileUrl) {
      setErrorMsg("Please upload your bank transfer slip, receipt, or transaction screenshot.");
      return;
    }

    try {
      setIsSubmitting(true);
      const fd = new FormData();
      if (file) {
        fd.append("file", file);
      } else if (receipt?.fileUrl) {
        fd.append("fileUrl", receipt.fileUrl);
      }

      fd.append("moduleType", moduleType);
      fd.append("payerType", payerType);
      if (payerId) fd.append("payerId", payerId);
      fd.append("payerName", payerName);
      if (payerEmail) fd.append("payerEmail", payerEmail);
      fd.append("referenceNo", referenceNo);
      fd.append("amount", String(amount));
      fd.append("paymentDate", paymentDate);
      fd.append("paymentMethod", paymentMethod);
      fd.append("paymentMode", "MANUAL_TRANSFER");
      if (depositorName) {
        fd.append("depositorName", depositorName);
        fd.append("depositor_name", depositorName);
      }
      if (txnRef) {
        fd.append("txnRef", txnRef);
        fd.append("transferReference", txnRef);
        fd.append("transfer_reference", txnRef);
      }
      if (bankName) fd.append("bankName", bankName);
      fd.append("tenantId", tenantId);
      if (schoolId) fd.append("schoolId", schoolId);
      if (linkedInvoiceId) fd.append("linkedInvoiceId", linkedInvoiceId);
      if (term) fd.append("term", term);
      if (session) fd.append("session", session);

      const res = await fetch("/api/v1/payments/receipt/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit receipt");
      }

      setReceipt(data.receipt);
      setSuccessMsg("Payment receipt submitted successfully! Bursar will verify shortly.");
      if (onUploadSuccess) {
        onUploadSuccess(data.receipt);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while uploading receipt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status badges
  const renderStatus = () => {
    if (!receipt) return null;
    if (receipt.status === "VERIFIED") {
      return (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                Payment Receipt Verified ✓
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                Verified by {receipt.verifiedBy || "Bursar"} on{" "}
                {receipt.verifiedAt ? new Date(receipt.verifiedAt).toLocaleDateString() : "Record"}
              </p>
            </div>
          </div>
          {receipt.fileUrl && (
            <a
              href={receipt.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <span>View Proof</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      );
    }

    if (receipt.status === "REJECTED") {
      return (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-2">
          <div className="flex items-center gap-2.5 text-red-700 dark:text-red-300 font-bold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Receipt Rejected by Finance Desk</span>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 pl-7">
            Reason: <strong>{receipt.rejectionReason || "Payment proof could not be verified."}</strong>
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 pl-7 font-medium">
            Please check your payment details and re-upload a clear receipt below.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
              Under Bursar Verification
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Ref: {receipt.referenceNo} • ₦{Number(receipt.amount).toLocaleString()}
            </p>
          </div>
        </div>
        {receipt.fileUrl && (
          <a
            href={receipt.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-100/50 transition"
          >
            <span>Preview</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg tracking-tight">
              {effectiveTitle}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {subtitle || `Reference No: ${referenceNo} • ${payerName}`}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* Settlement Bank Details Card if provided */}
        {effectiveBankDetails && effectiveBankDetails.accountNumber && (
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <span>Official Settlement Account Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Bank:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{effectiveBankDetails.bankName || "Access Bank"}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Account No:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                  {effectiveBankDetails.accountNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Account Name:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100 truncate block">
                  {effectiveBankDetails.accountName || "School Administration"}
                </span>
              </div>
            </div>
            {effectiveBankDetails.paymentInstruction && (
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 pt-1 border-t border-indigo-100/60 dark:border-indigo-900/40">
                <strong>Narration Instruction:</strong> {effectiveBankDetails.paymentInstruction}
              </p>
            )}
          </div>
        )}

        {/* Institution Custom Note / Writeup if provided */}
        {effectiveCustomWriteup && (
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-1 text-xs text-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Official Payment Directive</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-[12px] text-slate-700 dark:text-zinc-300 pt-0.5">
              {effectiveCustomWriteup}
            </p>
          </div>
        )}


        {/* Existing Status Indicator */}
        {renderStatus()}

        {/* Form (Show if not verified or if user wants to update) */}
        {receipt?.status !== "VERIFIED" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span>Amount Paid (₦) *</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Payment Date *</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Payment Method</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / Deposit</option>
                  <option value="POS">POS Terminal</option>
                  <option value="CASH">Cash at Bursary</option>
                  <option value="ONLINE">Online Portal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Depositor / Sender Account Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder="Full name on sender's bank account"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Transaction Ref / Session ID *</span>
                </label>
                <input
                  type="text"
                  required
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  placeholder="e.g. 09026723820293"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Payer Bank Name (Optional)</span>
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. GTBank, Zenith, OPay, Palmpay"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Receipt Proof Upload Zone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Upload Payment Proof (JPG, PNG, PDF) *
              </label>
              <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer transition">
                <UploadCloud className="w-8 h-8 text-indigo-500 mb-2" />
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  {file ? file.name : "Click to select or drag receipt slip here"}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  Supports Images (PNG, JPG) and PDF documents up to 10MB
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {filePreview && (
                <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <img
                    src={filePreview}
                    alt="Receipt Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-300 dark:border-zinc-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">
                      {file?.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Uploading receipt proof...</span>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>{receipt ? "Update Payment Receipt" : "Submit Payment Receipt"}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function titleForModule(mod: string): string {
  switch (mod) {
    case "ADMISSION_FORM_FEE":
      return "Application Form Fee";
    case "TUITION":
      return "School Tuition Fee";
    case "PLATFORM_SUBSCRIPTION":
      return "School Platform Subscription";
    case "RESULT_CHECKING_FEE":
      return "Terminal Result Checking Fee";
    case "REPORT_CARD_CHECKING_FEE":
      return "Report Card & Broadsheet Access Fee";
    case "TRANSCRIPT_FEE":
      return "Official Academic Transcript Fee";
    case "EXAM":
      return "External / Mock Exam Fee";
    case "PTA":
      return "PTA Levy Payment";
    case "UNIFORM":
      return "Uniform Purchase Fee";
    case "BOOKS":
      return "Books & Materials Fee";
    case "TRANSPORT":
      return "School Bus Transport Fee";
    case "HOSTEL":
      return "Hostel Accommodation Fee";
    default:
      return "Payment Receipt Submission";
  }
}

