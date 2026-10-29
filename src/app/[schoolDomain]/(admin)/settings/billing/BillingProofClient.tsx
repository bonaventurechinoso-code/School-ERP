"use client";

import React, { useState, useCallback } from "react";
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
} from "lucide-react";
import { useTenant } from "@/lib/tenant-context";

// ─── Nigerian Bank List (abbreviated for this form) ───────────────────────────
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

type FormState = "idle" | "submitting" | "success" | "error";

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
}: {
  schoolDomain: string;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | null;
  platformBankName?: string | null;
  platformAccountNumber?: string | null;
  platformAccountName?: string | null;
}) {
  const tenant = useTenant();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [formState, setFormState] = useState<FormState>("idle");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const bankName = platformBankName || (tenant?.platformBank as any)?.bankName || "Wema Bank";
  const accountNumber =
    platformAccountNumber || (tenant?.platformBank as any)?.accountNumber || "0123456789";
  const accountName =
    platformAccountName || (tenant?.platformBank as any)?.accountName || "SchoolERP Platform Central";

  const expiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const statusColor = {
    ACTIVE: "emerald",
    PENDING_VERIFICATION: "blue",
    PAST_DUE: "rose",
    EXPIRED: "rose",
    TRIALING: "amber",
  }[subscriptionStatus || "ACTIVE"] || "emerald";

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

    try {
      let fileUrl = "";
      if (selectedFile) {
        try {
          const fd = new FormData();
          fd.append("file", selectedFile);
          fd.append("moduleType", "PLATFORM_SUBSCRIPTION");
          fd.append("payerType", "SCHOOL");
          fd.append("payerName", form.payerName.trim() || schoolDomain);
          fd.append("referenceNo", form.reference.trim());
          fd.append("amount", form.amount);
          fd.append("bankName", form.bankName);
          fd.append("tenantId", schoolDomain);

          const upRes = await fetch("/api/v1/payments/receipt/upload", {
            method: "POST",
            body: fd,
          });
          const upData = await upRes.json();
          if (upData.success && upData.receipt?.fileUrl) {
            fileUrl = upData.receipt.fileUrl;
          }
        } catch (uploadErr) {
          console.warn("[BILLING_PROOF] Upload non-fatal error:", uploadErr);
        }
      }

      let res = await fetch(`/api/${schoolDomain}/subscription/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolDomain,
          reference: form.reference.trim(),
          amount: Number(form.amount),
          bankName: form.bankName,
          payerName: form.payerName.trim(),
          note: form.note.trim(),
          fileUrl,
        }),
      });

      if (!res.ok && res.status === 404) {
        // Fallback to legacy endpoint if route was not found
        res = await fetch("/api/tenant/submit-subscription-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolDomain,
            reference: form.reference.trim(),
            amount: Number(form.amount),
            bankName: form.bankName,
            payerName: form.payerName.trim(),
            note: form.note.trim(),
            fileUrl,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to submit proof. Please try again.");
        setFormState("error");
        return;
      }

      setFormState("success");
      setForm(INITIAL_FORM);
      setSelectedFile(null);
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setFormState("error");
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Status Overview Card ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
              SaaS Portal Subscription
            </span>
          </div>
          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border
              ${
                statusColor === "emerald"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                  : statusColor === "blue"
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60"
                  : statusColor === "amber"
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60"
                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                statusColor === "emerald"
                  ? "bg-emerald-500"
                  : statusColor === "blue"
                  ? "bg-blue-500"
                  : statusColor === "amber"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            {subscriptionStatus === "PENDING_VERIFICATION"
              ? "Pending Verification"
              : subscriptionStatus === "PAST_DUE"
              ? "Past Due"
              : subscriptionStatus === "EXPIRED"
              ? "Expired"
              : subscriptionStatus === "TRIALING"
              ? "Trial Active"
              : "Active"}
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
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mb-1">
              Next Renewal
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {expiresAt
                ? expiresAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mb-1">
              Days Remaining
            </p>
            <p
              className={`text-sm font-bold ${
                daysLeft !== null && daysLeft <= 7
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {daysLeft !== null ? `${daysLeft} days` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Platform Corporate Bank Account Details ── */}
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-zinc-900 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <h2 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
            Platform Subscription Corporate Account
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
          Transfer your monthly SaaS portal subscription fee directly to this account, then submit
          proof below.
        </p>

        <div className="space-y-3">
          {/* Bank Name */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-0.5">
                Bank
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{bankName}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(bankName, "bank")}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
              aria-label="Copy bank name"
            >
              {copiedField === "bank" ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Account Number */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-0.5">
                Account Number
              </p>
              <p className="text-xl font-black tracking-widest text-slate-900 dark:text-white font-mono">
                {accountNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(accountNumber, "account")}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
              aria-label="Copy account number"
            >
              {copiedField === "account" ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Account Name */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-0.5">
                Account Name
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {accountName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(accountName, "name")}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
              aria-label="Copy account name"
            >
              {copiedField === "name" ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
          <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
            Use your school subdomain (
            <span className="font-bold">{schoolDomain}</span>) as the transfer narration/description
            to help us identify your payment quickly.
          </p>
        </div>
      </div>

      {/* ── Success State ── */}
      {formState === "success" && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 p-6 flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center">
            <BadgeCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-emerald-800 dark:text-emerald-300 text-base">
              Proof Submitted Successfully!
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1 max-w-sm mx-auto">
              Our team will verify your bank transfer within 24 hours and activate your
              subscription.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormState("idle")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline mt-1"
          >
            <RefreshCcw className="w-3 h-3" />
            Submit another proof
          </button>
        </div>
      )}

      {/* ── Proof Submission Form ── */}
      {formState !== "success" && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm"
        >
          <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-500" />
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
              Submit Transfer Proof
            </h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Error Alert */}
            {formState === "error" && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{errorMsg}</p>
              </div>
            )}

            {/* Reference (NIP Session ID) */}
            <div>
              <label
                htmlFor="billing-reference"
                className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                NIP Session ID / Deposit Reference{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                id="billing-reference"
                name="reference"
                type="text"
                required
                value={form.reference}
                onChange={handleChange}
                placeholder="e.g. 240921123456ABCD or RCPT-00123456"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 transition-all font-mono"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                Found on your bank transfer receipt or mobile banking history.
              </p>
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="billing-amount"
                className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                Amount Transferred (₦) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-zinc-400 font-bold text-sm select-none">
                  ₦
                </span>
                <input
                  id="billing-amount"
                  name="amount"
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="50000"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            {/* Bank Name */}
            <div>
              <label
                htmlFor="billing-bank"
                className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                Your Sending Bank <span className="text-rose-500">*</span>
              </label>
              <select
                id="billing-bank"
                name="bankName"
                required
                value={form.bankName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 transition-all"
              >
                <option value="">Select your bank…</option>
                {COMMON_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Payer Name (optional) */}
            <div>
              <label
                htmlFor="billing-payer"
                className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                Account Holder Name{" "}
                <span className="text-slate-400 dark:text-zinc-500 font-normal">(optional)</span>
              </label>
              <input
                id="billing-payer"
                name="payerName"
                type="text"
                value={form.payerName}
                onChange={handleChange}
                placeholder="e.g. GREEN VALLEY SCHOOLS LTD"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 transition-all"
              />
            </div>

            {/* Receipt File Upload */}
            <div>
              <label
                htmlFor="billing-file"
                className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                Payment Receipt Proof (Image or PDF){" "}
                <span className="text-slate-400 dark:text-zinc-500 font-normal">(recommended)</span>
              </label>
              <input
                id="billing-file"
                name="file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                Attach proof of bank transfer or deposit teller.
              </p>
            </div>

            {/* Note (optional) */}
            <div>
              <label
                htmlFor="billing-note"
                className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                Additional Note{" "}
                <span className="text-slate-400 dark:text-zinc-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="billing-note"
                name="note"
                rows={2}
                value={form.note}
                onChange={handleChange}
                placeholder="e.g. Renewal for October 2026 subscription"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              Verification within 24 hours. Portal stays active during review.
            </p>
            <button
              type="submit"
              disabled={formState === "submitting"}
              id="billing-submit-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto"
            >
              {formState === "submitting" ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Proof
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Zero-Fee Disclaimer ── */}
      <p className="text-[10px] text-center text-slate-400 dark:text-zinc-600 leading-relaxed">
        *0% Transaction Fee Architecture — This platform only charges a flat monthly SaaS portal
        subscription. Schools collect 100% of student tuition directly to their institutional bank
        accounts. We never co-process or deduct from student fee collections.
      </p>
    </div>
  );
}
