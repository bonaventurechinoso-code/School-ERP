"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { InvoiceItem, StudentProfileData } from "../types";
import { NIGERIAN_BANKS } from "@/lib/nigerian-banks";
import {
  X,
  Loader2,
  Building2,
  Copy,
  CheckCircle2,
  Upload,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  FileCheck2,
  Calendar,
} from "lucide-react";

interface FeePaymentCheckoutProps {
  invoice: InvoiceItem;
  student?: StudentProfileData;
  subdomain: string;
  onClose: () => void;
  onPaymentSuccess?: (invoiceId: string, amountPaid: number, reference: string) => void;
}

interface SchoolBankInfo {
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  instruction: string;
  isConfigured: boolean;
  isManualTransferEnabled?: boolean;
  bankAccounts?: Array<{
    bank_name: string;
    account_number: string;
    account_name: string;
    branch_code?: string | null;
    currency?: string | null;
    swift_bic?: string | null;
  }>;
}

export default function FeePaymentCheckout({
  invoice,
  student,
  subdomain,
  onClose,
  onPaymentSuccess,
}: FeePaymentCheckoutProps) {
  const [bankInfo, setBankInfo] = useState<SchoolBankInfo | null>(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [copied, setCopied] = useState(false);

  // Modal Step: "DETAILS" (Show account) | "UPLOAD_PROOF" (Form) | "SUCCESS"
  const [step, setStep] = useState<"DETAILS" | "UPLOAD_PROOF" | "SUCCESS">("DETAILS");

  // Proof Submission Form State
  const amountDue = Math.max(0, invoice.amountDue - invoice.amountPaid);
  const [amountPaid, setAmountPaid] = useState<string>(String(amountDue));
  const [paidDate, setPaidDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payerBankName, setPayerBankName] = useState<string>("");
  const [payerAccountName, setPayerAccountName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadBankDetails() {
      try {
        const res = await fetch(`/api/${subdomain}/bank-details`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.school) {
            setBankInfo(data.school);
          }
        }
      } catch (err) {
        console.warn("[LOAD_BANK_DETAILS_FAILED]:", err);
      } finally {
        if (isMounted) setLoadingBank(false);
      }
    }
    loadBankDetails();
    return () => {
      isMounted = false;
    };
  }, [subdomain]);

  const handleCopyAccount = () => {
    if (bankInfo?.accountNumber) {
      navigator.clipboard.writeText(bankInfo.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File exceeds 5MB limit. Please upload a smaller image.");
      return;
    }

    setProofFile(file);
    setErrorMsg(null);

    // Create local preview URL
    const preview = URL.createObjectURL(file);
    setProofPreviewUrl(preview);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!amountPaid || Number(amountPaid) <= 0) {
      setErrorMsg("Please enter a valid amount transferred.");
      return;
    }

    if (!payerBankName) {
      setErrorMsg("Please select the bank transferred from.");
      return;
    }

    if (!sessionId.trim()) {
      setErrorMsg("Please enter the NIP Transaction Session ID, Reference, or Teller Number.");
      return;
    }

    if (!proofFile) {
      setErrorMsg("Please upload your transfer screenshot or receipt.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload proof image file
      const uploadFormData = new FormData();
      uploadFormData.append("file", proofFile);

      const uploadRes = await fetch("/api/upload/payment-proof", {
        method: "POST",
        body: uploadFormData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "Receipt image upload failed. Please try again.");
      }

      // 2. Submit payment proof record
      const submitRes = await fetch("/api/payment-proof/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolDomain: subdomain,
          studentId: student?.id,
          invoiceId: invoice.id,
          amount: Number(amountPaid),
          paidAt: paidDate,
          payerBankName,
          payerAccountName: payerAccountName.trim() || student?.fullName || "Student/Parent",
          depositor_name: payerAccountName.trim() || student?.fullName || "Student/Parent",
          sessionId: sessionId.trim(),
          transfer_reference: sessionId.trim(),
          proofImageUrl: uploadData.url,
          proof_of_payment_url: uploadData.url,
          paymentMode: "MANUAL_TRANSFER",
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || !submitData.success) {
        throw new Error(submitData.error || "Failed to submit verification request.");
      }

      setSuccessReference(sessionId.trim());
      setStep("SUCCESS");

      if (onPaymentSuccess) {
        onPaymentSuccess(invoice.id, Number(amountPaid), sessionId.trim());
      }
    } catch (err: any) {
      console.error("[SUBMIT_PROOF_FAILED]:", err);
      setErrorMsg(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-5 relative max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Direct Bank Transfer Payment
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                100% Direct School Collection (0% Platform Fee)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: Bank Account Details Card */}
        {step === "DETAILS" && (
          <div className="space-y-5">
            {loadingBank ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs">Loading institutional bank details...</span>
              </div>
            ) : bankInfo?.isManualTransferEnabled === false ? (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Direct Manual Transfer Disabled</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Manual bank transfer verification is currently disabled by institutional payment governance. Please contact the school bursary office.
                </p>
              </div>
            ) : !bankInfo?.isConfigured ? (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>School Bank Account Not Configured</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  The institution has not set up their direct collection bank account yet. Please contact the school bursary office directly.
                </p>
              </div>
            ) : (
              <>
                {/* Visual Direct Collection Account Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-2xl p-5 shadow-lg border border-slate-800 space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                      {bankInfo.name || "School"} Official Account
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Direct Settlement
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Bank</span>
                      <span className="text-xs font-bold text-white block truncate">
                        {bankInfo.bankName}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Account Name</span>
                      <span className="text-xs font-bold text-white block truncate">
                        {bankInfo.accountName}
                      </span>
                    </div>
                  </div>

                  {/* Prominent Account Number with Copy Button */}
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Account Number</span>
                      <span className="text-lg sm:text-xl font-black font-mono tracking-widest text-emerald-400">
                        {bankInfo.accountNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>

                  {/* Mandatory Narration */}
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
                      Transfer Narration / Remarks
                    </span>
                    <span className="font-mono font-bold text-amber-200">
                      {student?.admissionNumber || "Student Admission No"}
                    </span>
                  </div>
                </div>

                {/* Amount Due Indicator */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Item / Invoice</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block truncate max-w-[240px]">
                      {invoice.description}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Amount Payable</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      ₦{amountDue.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Clear Transfer Instructions */}
                <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/30 p-3.5 rounded-xl border border-slate-200/60 dark:border-zinc-700/40">
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block">How to complete payment:</span>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                    <li>Copy the 10-digit school account number above.</li>
                    <li>Open your bank mobile app (Opay, Access, GTBank, Kuda, etc.) and transfer.</li>
                    <li>Type your admission number (<strong>{student?.admissionNumber || "RIV/SEC/2026/001"}</strong>) into the narration/remarks box.</li>
                    <li>Take a screenshot of the debit alert or transfer receipt.</li>
                    <li>Return here and click <strong>&quot;I Have Paid - Upload Proof&quot;</strong> below.</li>
                  </ol>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("UPLOAD_PROOF")}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>I Have Paid — Upload Proof</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2: Proof of Payment Upload Form */}
        {step === "UPLOAD_PROOF" && (
          <form onSubmit={handleSubmitProof} className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-50">
                Upload Proof of Payment
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Provide transfer details so the school bursar can verify and receipt your payment.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Amount Paid */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Amount Transferred (₦) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="e.g. 50000"
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date Paid */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Date of Transfer <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Payer Bank Name Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Bank Transferred From <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={payerBankName}
                onChange={(e) => setPayerBankName(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select your bank or app</option>
                {NIGERIAN_BANKS.map((b) => (
                  <option key={b.code} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Depositor / Sender Account Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Depositor / Sender Account Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={payerAccountName}
                onChange={(e) => setPayerAccountName(e.target.value)}
                placeholder="Full name on sender's bank account"
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Session ID / Transaction Reference */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  NIP Session ID / Transfer Reference <span className="text-rose-500">*</span>
                </label>
              </div>
              <input
                type="text"
                required
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="e.g. 0000132409191834010928374 or Ref No."
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400">
                Found on your bank debit receipt or notification alert.
              </p>
            </div>

            {/* Proof Image Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Receipt Screenshot or PDF <span className="text-rose-500">*</span>
              </label>
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-50/50 dark:bg-zinc-800/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {proofPreviewUrl ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-36 mx-auto">
                      <Image
                        src={proofPreviewUrl}
                        alt="Proof Preview"
                        fill
                        unoptimized
                        className="rounded-lg shadow-xs object-contain border border-slate-200 dark:border-zinc-700"
                      />
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      Click to choose another image
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-2">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                      Click to upload receipt image
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      JPG, PNG, WebP or PDF (Max 5MB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("DETAILS")}
                className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold transition cursor-pointer"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading & Submitting...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4" />
                    <span>Submit for Verification</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Submission Confirmation Screen */}
        {step === "SUCCESS" && (
          <div className="p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                Proof Submitted Successfully!
              </h4>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Your payment of <strong>₦{Number(amountPaid).toLocaleString()}</strong> has been submitted to the bursary queue.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs text-left space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Status: Awaiting Bursar Confirmation</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                The school bursar will verify this against the school&apos;s bank statement. Once confirmed, your official receipt will be generated.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs transition"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
