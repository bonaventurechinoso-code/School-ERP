"use client";

import React, { useState, useTransition, useRef } from "react";
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
} from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";
import { submitSubscriptionPaymentAction } from "./actions";

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
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [amount, setAmount] = useState<string>("25000");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validMimes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
    if (!validMimes.includes(file.type)) {
      setFeedback({
        type: "error",
        message: "Invalid file format. Please upload a PDF, PNG, or JPG receipt.",
      });
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({
        type: "error",
        message: "File exceeds 5MB limit. Please upload a smaller file.",
      });
      return false;
    }
    setSelectedFile(file);
    setFeedback(null);
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedFile) {
      setFeedback({ type: "error", message: "Please select or drop a payment proof receipt." });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid transfer amount." });
      return;
    }

    startTransition(async () => {
      try {
        // 1. Upload file to /api/upload/payment-proof
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("/api/upload/payment-proof", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success || !uploadData.url) {
          throw new Error(uploadData.error || "Failed to upload receipt file.");
        }

        // 2. Submit payment record via server action
        const result = await submitSubscriptionPaymentAction({
          tenantId: tenant.id,
          amount: numAmount,
          receiptUrl: uploadData.url,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to submit subscription payment record.");
        }

        // 3. Add to local list
        setPayments((prev) => [
          {
            id: result.paymentId || String(Date.now()),
            amount: numAmount,
            receiptUrl: uploadData.url,
            status: "PENDING_VERIFICATION",
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);

        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setFeedback({
          type: "success",
          message: "Payment receipt submitted successfully! Super Admin will review and activate your subscription shortly.",
        });
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err.message || "An unexpected error occurred during submission.",
        });
      }
    });
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

        {/* Live Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* School Status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs shadow-xs">
            <span className="text-slate-400 font-semibold text-[11px]">School Status:</span>
            {isSchoolActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <AlertCircle className="w-3 h-3" />
                {tenant.schoolStatus}
              </span>
            )}
          </div>

          {/* Subscription Status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs shadow-xs">
            <span className="text-slate-400 font-semibold text-[11px]">Subscription:</span>
            {isSubActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <ShieldCheck className="w-3 h-3" />
                ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                <Clock className="w-3 h-3" />
                {tenant.subscriptionStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid: Bank Details Card + Upload Proof Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Read-Only Bank Account Card */}
        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 shadow-xl border border-indigo-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between pb-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">
                  Official Transfer Account
                </p>
                <p className="text-base font-black text-white">{bankAccount.bankName}</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              VERIFIED
            </span>
          </div>

          <div className="py-6 space-y-4">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Account Number (NUBAN)
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-white">
                  {bankAccount.accountNumber}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(bankAccount.accountNumber)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
                  title="Copy Account Number"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Beneficiary Name
              </p>
              <p className="text-sm font-bold text-slate-100 uppercase tracking-wide mt-0.5">
                {bankAccount.accountName}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 text-[11px] text-slate-400 leading-relaxed">
            Please make your bank transfer using the exact details above, then upload your transaction receipt on the right to clear your subscription.
          </div>
        </div>

        {/* Upload Proof Dropzone Form */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm p-6 sm:p-7 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Submit Payment Proof
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Upload a PDF document or image screenshot of your bank transfer receipt
                </p>
              </div>
            </div>

            {/* Amount Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Transfer Amount (NGN ₦)
              </label>
              <input
                type="number"
                required
                min={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Dropzone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Receipt File (PDF, PNG, JPG max 5MB)
              </label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-300 dark:border-zinc-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      validateAndSetFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {selectedFile ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB — Ready to upload
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      Drag &amp; drop receipt here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      PDF, JPG, or PNG up to 5MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !selectedFile}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              {isPending ? "Uploading Receipt Proof..." : "Submit Receipt for Verification"}
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
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-4">
                      {p.status === "VERIFIED" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          VERIFIED
                        </span>
                      ) : p.status === "REJECTED" ? (
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
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(p.receiptUrl)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 text-[11px]">
                      {new Date(p.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden max-w-2xl w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Proof Document Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 dark:bg-zinc-950 rounded-2xl p-2">
              {previewUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewUrl} className="w-full h-[60vh] rounded-xl" title="PDF Preview" />
              ) : (
                <img src={previewUrl} alt="Receipt Proof" className="max-h-[60vh] max-w-full object-contain rounded-xl" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

