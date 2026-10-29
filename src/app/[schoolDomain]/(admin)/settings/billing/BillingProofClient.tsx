"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Landmark,
  Send,
  CheckCircle,
  AlertCircle,
  Copy,
  Clock,
  ShieldCheck,
  BadgeCheck,
  RefreshCcw,
  ChevronRight,
  Info,
  AlertTriangle,
  XCircle,
  FileText,
  Calendar,
  UploadCloud,
} from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { formatCurrency } from "@/lib/format-utils";

const COMMON_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Keystone Bank",
  "Optimus Bank",
  "Polaris Bank",
  "Premium Trust Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank Nigeria",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
  "Kuda Bank",
  "OPay",
  "PalmPay",
  "Moniepoint MFB",
];

export interface PaymentHistoryItem {
  id: string;
  amount: number;
  nipSessionId: string;
  senderBank: string;
  status: string;
  submittedAt: string;
  verifiedAt?: string | null;
  notes?: string | null;
}

interface FormData {
  reference: string;
  amount: string;
  bankName: string;
  payerName: string;
  note: string;
}

const INITIAL_FORM: FormData = {
  reference: "",
  amount: "",
  bankName: "",
  payerName: "",
  note: "",
};

export default function BillingProofClient({
  schoolDomain,
  subscriptionPlan,
  subscriptionStatus,
  subscriptionExpiresAt,
  platformBankName,
  platformAccountNumber,
  platformAccountName,
  initialPayments = [],
}: {
  schoolDomain: string;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | null;
  platformBankName?: string | null;
  platformAccountNumber?: string | null;
  platformAccountName?: string | null;
  initialPayments?: PaymentHistoryItem[];
}) {
  const tenant = useTenant();
  const [payments, setPayments] = useState<PaymentHistoryItem[]>(initialPayments);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showRenewForm, setShowRenewForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg("File exceeds 5MB limit. Please upload a smaller file.");
        return;
      }
      setSelectedFile(file);
      setErrorMsg("");
    }
  };

  const bankName = platformBankName || (tenant?.platformBank as any)?.bankName || "Fidelity Bank";
  const accountNumber =
    platformAccountNumber || (tenant?.platformBank as any)?.accountNumber || "6560627850";
  const accountName =
    platformAccountName || (tenant?.platformBank as any)?.accountName || "BONAVEE ICT CONCEPTS";

  const expiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const latestPayment = payments[0] || null;
  const isPendingReview = latestPayment?.status === "PENDING" || latestPayment?.status === "PENDING_VERIFICATION";
  const isRejected = latestPayment?.status === "REJECTED";

  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setFormState("submitting");

    if (!selectedFile) {
      setErrorMsg("Please attach your bank transfer receipt proof.");
      setFormState("error");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("amount", form.amount);
      formData.append("tenantId", schoolDomain);
      formData.append("reference", form.reference.trim());
      formData.append("bankName", form.bankName);
      formData.append("payerName", form.payerName.trim());
      formData.append("notes", form.note.trim());

      const res = await fetch("/api/tenant-subscription-payments/submit", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const data = await res.json();

      if (res.status === 401) {
        setErrorMsg("Session expired, please login again.");
        window.location.href = `/${schoolDomain}/login`;
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit proof. Please try again.");
      }

      // Add new payment to local history
      const newPayment: PaymentHistoryItem = {
        id: data.id || data.paymentId || form.reference.trim(),
        amount: Number(form.amount),
        nipSessionId: form.reference.trim(),
        senderBank: form.bankName,
        status: "PENDING",
        submittedAt: new Date().toISOString(),
        notes: form.note.trim() || null,
      };

      setPayments((prev) => [newPayment, ...prev]);
      setFormState("success");
      setForm(INITIAL_FORM);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowRenewForm(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please check your connection and try again.");
      setFormState("error");
    }
  };

  return (
    <div className="space-y-8">
      {/* ── 1. Status Overview Card ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
              SaaS Portal Subscription
            </span>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isPendingReview
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60"
                : isRejected
                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPendingReview ? "bg-amber-500 animate-pulse" : isRejected ? "bg-rose-500" : "bg-emerald-500"
              }`}
            />
            {isPendingReview ? "Pending Clearance" : isRejected ? "Needs Re-upload" : "Active"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-zinc-800">
          <div className="px-6 py-4">
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mb-1">Plan</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              {subscriptionPlan?.toLowerCase() || "Basic"}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mb-1">Status Expiry</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {expiresAt
                ? expiresAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Ongoing"}
            </p>
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mb-1">Days Remaining</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} days` : "Expired") : "Active"}
              </p>
            </div>
            {!isPendingReview && (
              <button
                type="button"
                onClick={() => setShowRenewForm((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 transition"
              >
                {showRenewForm ? "Hide Form" : "Renew / Extend"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Pending Verification Banner ── */}
      {isPendingReview && (
        <div className="bg-amber-500/10 border-2 border-amber-400/80 p-5 rounded-2xl flex items-start gap-3.5 text-amber-950 dark:text-amber-100 animate-in fade-in">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <p className="font-extrabold text-sm text-amber-900 dark:text-amber-200">
              Payment Proof Under Review
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-300 leading-relaxed">
              Your submission of <b>{formatCurrency(latestPayment?.amount || 0)}</b> (Ref:{" "}
              <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">
                {latestPayment?.nipSessionId}
              </code>
              ) submitted on{" "}
              {new Date(latestPayment?.submittedAt || Date.now()).toLocaleDateString()}{" "}
              is currently awaiting Super Admin clearance. <b>New submissions are disabled while review is in progress.</b>
            </p>
          </div>
        </div>
      )}

      {/* ── 3. Rejection Banner ── */}
      {isRejected && (
        <div className="bg-rose-500/10 border-2 border-rose-400/80 p-5 rounded-2xl flex items-start gap-3.5 text-rose-950 dark:text-rose-100 animate-in fade-in">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-sm text-rose-900 dark:text-rose-200">
              Payment Proof Rejected
            </p>
            <p className="text-xs text-rose-800/90 dark:text-rose-300 leading-relaxed">
              Reason: <b>{latestPayment?.notes || "Details could not be verified by platform administration."}</b>.
              Please check your payment narration and submit a new receipt proof below.
            </p>
          </div>
        </div>
      )}

      {/* ── 4. Platform Official Bank Account Details ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-indigo-500" />
          <h2 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Official Platform Corporate Bank Account
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Bank Name</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{bankName}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Account Number</p>
              <button
                type="button"
                onClick={() => handleCopy(accountNumber, "accountNumber")}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                {copiedField === "accountNumber" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-base font-mono font-black text-slate-900 dark:text-white tracking-wider">
              {accountNumber}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Account Name</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{accountName}</p>
          </div>
        </div>
      </div>

      {/* ── 5. Payment Submission Form ── */}
      {(!isPendingReview || showRenewForm) && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs space-y-6"
        >
          <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Submit Offline Transfer Proof
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Enter your transfer reference number (NIP Session ID) and upload your bank receipt.
            </p>
          </div>

          {errorMsg && (
            <div className="mx-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {formState === "success" && (
            <div className="mx-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Payment proof submitted successfully! Pending verification.</span>
            </div>
          )}

          <div className="px-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  NIP Session ID / Reference <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="reference"
                  required
                  value={form.reference}
                  onChange={handleChange}
                  placeholder="e.g. 10000424092612345678"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Amount Transferred (NGN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  required
                  min="1"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="e.g. 25000"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Sending Bank <span className="text-rose-500">*</span>
                </label>
                <select
                  name="bankName"
                  required
                  value={form.bankName}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select your bank…</option>
                  {COMMON_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Originating Account Name
                </label>
                <input
                  type="text"
                  name="payerName"
                  value={form.payerName}
                  onChange={handleChange}
                  placeholder="e.g. EGEDE PRIMARY SCHOOL"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Receipt File Proof (JPG, PNG, PDF up to 5MB)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-blue-500 transition"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept=".jpg,.jpeg,.png,.pdf,.webp"
                  onChange={handleFileChange}
                />
                <div className="mx-auto w-12 h-12 bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-white">Click to Upload Your Receipt</p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 5MB</p>
                {selectedFile && (
                  <p className="mt-3 text-sm text-green-500 dark:text-green-400 font-medium flex items-center justify-center gap-1">
                    ✓ {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB) selected
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Note / Narration (optional)
              </label>
              <input
                type="text"
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="e.g. October 2026 SaaS Renewal"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/30 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end">
            <button
              type="submit"
              disabled={formState === "submitting"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
            >
              {formState === "submitting" ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  <span>Uploading Proof...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Proof</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── 6. Payment Proof History Table ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <h2 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Submission History
          </h2>
        </div>

        {payments.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-4">
            No previous payment proofs found for this school.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Bank</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {payments.map((p) => {
                  const isVerified = p.status === "VERIFIED";
                  const isPending = p.status === "PENDING" || p.status === "PENDING_VERIFICATION";
                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                        {new Date(p.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 dark:text-white font-semibold">
                        {p.nipSessionId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                        {p.senderBank}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Number(p.amount || 0))}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isVerified
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isPending
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {isVerified ? "Verified" : isPending ? "Pending" : "Rejected"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate text-[11px]">
                        {p.notes || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
