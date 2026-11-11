"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Landmark,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  UploadCloud,
  FileText,
  Copy,
  Check,
  Building2,
  Eye,
  ExternalLink,
  Download,
  X,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string | null;
}

interface TenantDetails {
  id: string;
  schoolName: string;
  subdomain: string;
  schoolStatus: string;
  subscriptionStatus: string;
  trialEndDate?: string | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  receiptUrl: string;
  status: string;
  createdAt: string;
}

export default function SubscriptionClient({
  bankAccount,
  tenant,
  recentPayments: initialPayments,
}: {
  bankAccount: BankAccount;
  tenant: TenantDetails;
  recentPayments: PaymentRecord[];
}) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [amount, setAmount] = useState<string>("25000");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validMimes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
      if (!validMimes.includes(file.type)) {
        setFeedback({
          type: "error",
          message: "Invalid file format. Please upload a PDF, PNG, or JPG receipt.",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFeedback({
          type: "error",
          message: "File exceeds 5MB limit. Please upload a smaller file.",
        });
        return;
      }
      setSelectedFile(file);
      setFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedFile) {
      setFeedback({ type: "error", message: "Please select your bank transfer payment proof receipt." });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid transfer amount." });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("amount", String(numAmount));
      formData.append("tenantId", tenant.id);

      const res = await fetch("/api/tenant-subscription-payments/submit", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const data = await res.json();

      if (res.status === 401) {
        setFeedback({ type: "error", message: "Session expired, please login again." });
        router.push("/login");
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit subscription receipt proof.");
      }

      setFeedback({
        type: "success",
        message: "Receipt submitted successfully, pending Super Admin verification.",
      });

      // Add to local table list
      setPayments((prev) => [
        {
          id: data.id || data.paymentId || String(Date.now()),
          amount: numAmount,
          receiptUrl: "",
          status: "PENDING_VERIFICATION",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err: any) {
      // NOTE: DO NOT call signOut() on failure
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred during submission.",
      });
    } finally {
      setLoading(false);
    }
  };

  const isSchoolActive = tenant.schoolStatus.toUpperCase() === "ACTIVE";
  const isSubActive = tenant.subscriptionStatus.toUpperCase() === "ACTIVE";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Header & Status Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Institutional Billing
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
              {tenant.subdomain}.bonaveeict.com.ng
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Subscription &amp; Billing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage institutional SaaS licenses, view platform settlement accounts, and upload renewal payment receipts
          </p>
        </div>

        {/* Current Status Pill */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
              Institution License
            </p>
            <p className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              {tenant.schoolName}
            </p>
          </div>
          <div
            className={`px-3.5 py-1.5 rounded-2xl flex items-center gap-2 border shadow-xs ${
              isSubActive && isSchoolActive
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
            }`}
          >
            {isSubActive && isSchoolActive ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-extrabold text-xs tracking-wide uppercase">
              {isSubActive && isSchoolActive ? "ACTIVE" : "SUSPENDED / TRIAL"}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Bank Details + Upload Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Platform Settlement Bank Account Details */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Platform Settlement Account
              </h2>
              <p className="text-xs text-slate-400">
                Transfer your SaaS renewal fees to this official account
              </p>
            </div>
          </div>

          {/* Account Details Card */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Bank Name
                </span>
                <p className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 mt-0.5">
                  {bankAccount.bankName}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account Name
                </span>
                <p className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 mt-0.5">
                  {bankAccount.accountName}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Account Number
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(bankAccount.accountNumber)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-2xl font-black font-mono tracking-wider text-slate-900 dark:text-white mt-1">
                  {bankAccount.accountNumber}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                Instant Account Verification
              </p>
              <p className="text-[11px] leading-relaxed opacity-90">
                After transfer, take a screenshot or download the transaction PDF receipt from your mobile bank app and upload it using the form. Super Admin verifies within 1–2 hours.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Upload Receipt Form */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Submit Payment Receipt
              </h2>
              <p className="text-xs text-slate-400">
                Provide transfer amount and attach proof of payment
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Transfer Amount (₦)
              </label>
              <input
                type="number"
                min="1000"
                step="500"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Whole Card Clickable Upload Dropzone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Receipt File (PDF, PNG, JPG max 5MB)
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!selectedFile || loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              {loading ? "Uploading..." : "Submit Receipt for Verification"}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Submissions Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Recent Subscription Submissions ({payments.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          {payments.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No recent subscription payment receipts found.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Proof</th>
                  <th className="py-3 px-4">Date Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {payments.map((p) => {
                  const isVerified = p.status === "VERIFIED";
                  const isRejected = p.status === "REJECTED";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 px-4">
                        {isVerified ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            VERIFIED
                          </span>
                        ) : isRejected ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            REJECTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            PENDING VERIFICATION
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.receiptUrl ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewUrl(p.receiptUrl)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                            {p.receiptUrl.startsWith("https://") && (
                              <a
                                href={p.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Submitted
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 text-[11px]">
                        {new Date(p.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Lightbox / Preview Modal */}
      {previewUrl && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Payment Proof Receipt
              </h4>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-50 dark:bg-zinc-950 p-2 flex items-center justify-center">
              {previewUrl.includes(".pdf") || previewUrl.startsWith("data:application/pdf") ? (
                <iframe src={previewUrl} className="w-full h-[400px] rounded-lg" title="PDF Proof" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  className="max-h-[400px] w-auto mx-auto object-contain rounded-lg"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <a
                href={previewUrl}
                download="subscription_receipt"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
