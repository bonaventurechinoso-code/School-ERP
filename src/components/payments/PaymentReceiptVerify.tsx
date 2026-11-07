"use client";

import React, { useState } from "react";
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Flag,
  ExternalLink,
  DollarSign,
  Calendar,
  Building2,
  FileText,
  User,
  Clock,
  AlertTriangle,
} from "lucide-react";

export interface PaymentReceiptVerifyProps {
  receipt: any;
  canVerify?: boolean;
  compact?: boolean;
  onVerifySuccess?: (receipt: any) => void;
  onRejectSuccess?: (receipt: any) => void;
  onFlagSuccess?: (receipt: any) => void;
}

export default function PaymentReceiptVerify({
  receipt,
  canVerify = true,
  compact = false,
  onVerifySuccess,
  onRejectSuccess,
  onFlagSuccess,
}: PaymentReceiptVerifyProps) {
  const [localReceipt, setLocalReceipt] = useState<any>(receipt);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalReceipt(receipt);
  }, [receipt]);

  if (!localReceipt) return null;

  const handleAction = async (action: "VERIFY" | "REJECT" | "FLAG") => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const res = await fetch("/api/v1/payments/receipt/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId: localReceipt.id,
          action,
          rejectionReason: action === "REJECT" ? reason || "Payment proof could not be validated" : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Action failed");
      }

      setLocalReceipt(data.receipt);
      setRejecting(false);
      setReason("");

      if (action === "VERIFY" && onVerifySuccess) onVerifySuccess(data.receipt);
      if (action === "REJECT" && onRejectSuccess) onRejectSuccess(data.receipt);
      if (action === "FLAG" && onFlagSuccess) onFlagSuccess(data.receipt);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process receipt verification.");
    } finally {
      setIsProcessing(false);
    }
  };

  const statusColor =
    localReceipt.status === "VERIFIED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
      : localReceipt.status === "DUPLICATE"
      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
      : localReceipt.status === "REJECTED"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
      : localReceipt.status === "FLAGGED"
      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";

  // Compact row or card for Dossier integration
  if (compact) {
    return (
      <div className="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${statusColor}`}>
              {localReceipt.status}
            </span>
            <span className="font-bold text-xs text-slate-800 dark:text-zinc-100 truncate">
              ₦{Number(localReceipt.amount).toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 font-mono truncate">
              Ref: {localReceipt.referenceNo}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            {localReceipt.fileUrl && (localReceipt.fileUrl.startsWith("http") || localReceipt.fileUrl.startsWith("/")) ? (
              <a
                href={localReceipt.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[11px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-1 transition"
              >
                <span>Preview Slip</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ) : localReceipt.fileUrl ? (
              <span className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-bold text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800">
                {localReceipt.fileUrl === "POS_RECEIPT"
                  ? "POS Slip"
                  : localReceipt.fileUrl === "CASH_COUNTER_RECEIPT"
                  ? "Cash Slip"
                  : "Desk Settled"}
              </span>
            ) : null}

            {canVerify && localReceipt.status !== "VERIFIED" && (
              <button
                type="button"
                onClick={() => handleAction("VERIFY")}
                disabled={isProcessing}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Verify</span>
              </button>
            )}

            {canVerify && localReceipt.status !== "REJECTED" && (
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={isProcessing}
                className="px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <XCircle className="w-3 h-3" />
                <span>Reject</span>
              </button>
            )}
          </div>
        </div>

        {rejecting && (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason for rejection..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-100"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction("REJECT")}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        )}

        {localReceipt.rejectionReason && (
          <p className="text-[11px] text-red-600 dark:text-red-400">
            Rejection Reason: {localReceipt.rejectionReason}
          </p>
        )}
      </div>
    );
  }

  // Expanded card view for verification hub
  return (
    <div className="p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <span className={`px-2.5 py-1 rounded-full text-xs font-black border uppercase tracking-wider ${statusColor}`}>
            {localReceipt.status}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {localReceipt.moduleType?.replace(/_/g, " ")}
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
            ₦{Number(localReceipt.amount).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            Ref: {localReceipt.referenceNo}
          </p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Payer / Depositor:</span>
          <span className="font-bold text-slate-800 dark:text-zinc-200 truncate block">
            {localReceipt.depositorName || localReceipt.payerName}
          </span>
          <span className="text-[10px] text-slate-400">({localReceipt.payerType})</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Date / Mode:</span>
          <span className="font-bold text-slate-800 dark:text-zinc-200 block">
            {new Date(localReceipt.paymentDate).toLocaleDateString()}
          </span>
          <span className="text-[10px] text-slate-400">
            {localReceipt.paymentMode || localReceipt.paymentMethod}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Bank / Txn Ref:</span>
          <span className="font-bold text-slate-800 dark:text-zinc-200 truncate block">
            {localReceipt.bankName || "Direct Transfer"}
          </span>
          <span className="text-[10px] font-mono text-slate-400 truncate block">
            {localReceipt.transferReference || localReceipt.txnRef || "N/A"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Proof File:</span>
          {localReceipt.fileUrl && (localReceipt.fileUrl.startsWith("http") || localReceipt.fileUrl.startsWith("/")) ? (
            <a
              href={localReceipt.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 mt-0.5"
            >
              <span className="truncate">{localReceipt.fileName || "View Document"}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          ) : localReceipt.fileUrl ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs mt-0.5 block">
              {localReceipt.fileUrl === "POS_RECEIPT"
                ? "Desk POS Receipt"
                : localReceipt.fileUrl === "CASH_COUNTER_RECEIPT"
                ? "Desk Cash Lodgement"
                : "Admissions Desk Settled"}
            </span>
          ) : (
            <span className="text-slate-400">No file</span>
          )}
        </div>
      </div>

      {/* Duplicate Reference Detector Alert */}
      {localReceipt.isDuplicateReference && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-black">
              Duplicate Transfer Reference Detected ({localReceipt.duplicateCount} matching records)
            </strong>
            <span>
              This transaction reference has been submitted on another receipt in this institution. Verify bank statement carefully before settling.
            </span>
          </div>
        </div>
      )}

      {/* Rejection Alert */}
      {localReceipt.rejectionReason && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          <strong>Rejection Reason:</strong> {localReceipt.rejectionReason}
        </div>
      )}

      {/* Duplicate / Merged Alert */}
      {localReceipt.duplicateNotes && (
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300">
          <strong className="block font-black">Deduplication Audit Trail:</strong>
          <span>{localReceipt.duplicateNotes}</span>
          {localReceipt.masterReceiptId && (
            <div className="mt-1 font-mono text-[11px]">
              Master Transaction ID: #{localReceipt.masterReceiptId}
            </div>
          )}
        </div>
      )}

      {/* Prompt for rejection */}
      {rejecting && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3">
          <p className="font-bold text-xs text-red-800 dark:text-red-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>Select or Provide Mandatory Reason for Rejecting Payment Receipt:</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Mismatched Amount",
              "Unreadable Receipt",
              "Funds Not Reflected",
              "Duplicate Transaction Reference",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className="text-[10px] px-2 py-1 rounded-md bg-white dark:bg-zinc-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold hover:bg-red-100 transition cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Narration does not match candidate reference, transfer reversed, illegible slip..."
            className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleAction("REJECT")}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              {isProcessing ? "Rejecting..." : "Submit Rejection"}
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Action Buttons */}
      {canVerify && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
          {localReceipt.fileUrl && (localReceipt.fileUrl.startsWith("http") || localReceipt.fileUrl.startsWith("/")) && (
            <a
              href={localReceipt.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Proof</span>
            </a>
          )}

          {localReceipt.status !== "VERIFIED" && (
            <button
              type="button"
              onClick={() => handleAction("VERIFY")}
              disabled={isProcessing}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verify & Settle</span>
            </button>
          )}

          {localReceipt.status !== "FLAGGED" && localReceipt.status !== "VERIFIED" && (
            <button
              type="button"
              onClick={() => handleAction("FLAG")}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl border border-purple-200 hover:bg-purple-50 text-purple-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Flag</span>
            </button>
          )}

          {localReceipt.status !== "REJECTED" && (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
