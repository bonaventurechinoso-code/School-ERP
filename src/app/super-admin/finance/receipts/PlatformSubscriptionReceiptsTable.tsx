"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  Building2,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";

export interface PlatformReceiptItem {
  id: string;
  tenantId: string;
  moduleType: string;
  payerName: string;
  referenceNo: string;
  amount: number | string;
  bankName?: string | null;
  fileUrl?: string | null;
  status: string;
  createdAt: string | Date;
  school?: {
    id: string;
    name: string;
    subdomain: string;
    subscriptionPlan?: string | null;
  } | null;
}

export default function PlatformSubscriptionReceiptsTable({
  initialReceipts,
}: {
  initialReceipts: PlatformReceiptItem[];
}) {
  const [receipts, setReceipts] = useState<PlatformReceiptItem[]>(initialReceipts);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleAction = async (receiptId: string, action: "VERIFY" | "REJECT") => {
    let rejectionReason: string | undefined = undefined;
    if (action === "REJECT") {
      const reason = window.prompt("Enter rejection reason for this subscription receipt:", "Payment proof unverified or invalid transfer session ID.");
      if (!reason) return;
      rejectionReason = reason;
    }

    setProcessingId(receiptId);
    setFeedback(null);

    try {
      const res = await fetch("/api/v1/payments/receipt/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId,
          action,
          rejectionReason,
          verifiedBy: "Super-Administrator",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process receipt verification.");
      }

      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      setFeedback({
        type: "success",
        message:
          action === "VERIFY"
            ? "Platform subscription verified! School portal is now ACTIVE with 30 days extended."
            : "Subscription receipt rejected successfully.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2 text-xs font-bold transition shadow-sm ${
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

      {/* Receipts Table */}
      <div className="overflow-x-auto">
        {receipts.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              All subscription payments cleared
            </p>
            <p className="text-xs text-slate-400">
              No pending tenant platform subscription receipts awaiting verification.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tenant / School</th>
                <th className="py-3 px-4">Plan / Module</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Proof</th>
                <th className="py-3 px-4">Submitted</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {receipts.map((r) => {
                const schoolName = r.school?.name || r.tenantId;
                const subdomain = r.school?.subdomain || r.tenantId;
                const planName = r.school?.subscriptionPlan || "MONTHLY";
                const isBusy = processingId === r.id;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                            {schoolName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {subdomain}.bonaveeict.com.ng
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {planName}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(Number(r.amount))}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-300">
                      <div>{r.referenceNo}</div>
                      {r.bankName && (
                        <div className="text-[10px] text-slate-400 font-sans">{r.bankName}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {r.fileUrl ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewUrl(r.fileUrl!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] transition"
                          >
                            <Eye className="w-3 h-3" />
                            Preview
                          </button>
                          <a
                            href={r.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No attachment</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(r.id, "VERIFY")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition shadow-2xs disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verify
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(r.id, "REJECT")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold text-xs transition disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Image Preview Modal */}
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
                Proof of Payment Preview
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
                <iframe src={previewUrl} className="w-full h-[60vh] rounded-xl" title="PDF Receipt Preview" />
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
