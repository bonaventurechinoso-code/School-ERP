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
  AlertCircle,
  FileText,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";

export interface PlatformSubscriptionReceipt {
  id: string;
  tenantId: string;
  amount: number | string;
  receiptUrl: string;
  status: string;
  createdAt: string | Date;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  tenant?: {
    id: string;
    schoolName: string;
    subdomain: string;
    status: string;
    subscriptionStatus?: string | null;
    planName?: string;
  } | null;
}

export default function PlatformSubscriptionReceiptsTable({
  initialReceipts,
}: {
  initialReceipts: PlatformSubscriptionReceipt[];
}) {
  const [receipts, setReceipts] = useState<PlatformSubscriptionReceipt[]>(initialReceipts);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleApprove = async (paymentId: string) => {
    setProcessingId(paymentId);
    setFeedback(null);

    try {
      let res = await fetch(`/api/super-admin/finance/receipts/${paymentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });

      if (!res.ok) {
        res = await fetch(`/api/super-admin/finance/verify/${paymentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE" }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify payment.");
      }

      setReceipts((prev) =>
        prev.map((r) =>
          r.id === paymentId
            ? {
                ...r,
                status: "VERIFIED",
                verifiedAt: new Date().toISOString(),
                tenant: r.tenant
                  ? { ...r.tenant, status: "ACTIVE", subscriptionStatus: "ACTIVE" }
                  : null,
              }
            : r
        )
      );

      setFeedback({
        type: "success",
        message: "Payment approved! School portal reactivated with 30-day access and admin notified.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred during approval.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (paymentId: string) => {
    const reason = window.prompt(
      "Enter rejection reason for this subscription receipt:",
      "Payment proof unverified or invalid transaction session reference."
    );
    if (!reason) return;

    setProcessingId(paymentId);
    setFeedback(null);

    try {
      const res = await fetch(`/api/super-admin/finance/verify/${paymentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", rejectionReason: reason }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject payment.");
      }

      setReceipts((prev) =>
        prev.map((r) =>
          r.id === paymentId
            ? { ...r, status: "REJECTED", rejectionReason: reason }
            : r
        )
      );

      setFeedback({
        type: "success",
        message: "Subscription receipt rejected successfully.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred during rejection.",
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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
        {receipts.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              No subscription receipts awaiting review
            </p>
            <p className="text-xs text-slate-400">
              All submitted tenant SaaS platform renewal payments are cleared.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tenant / Institution</th>
                <th className="py-3 px-4">Plan / Module</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Proof</th>
                <th className="py-3 px-4">Submitted</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {receipts.map((r) => {
                const schoolName = r.tenant?.schoolName || r.tenantId;
                const subdomain = r.tenant?.subdomain || r.tenantId;
                const planName = r.tenant?.planName || "Standard";
                const isBusy = processingId === r.id;
                const isVerified = r.status === "VERIFIED";
                const isRejected = r.status === "REJECTED";

                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 max-w-[180px]">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {schoolName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
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

                    <td className="py-3.5 px-4">
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3" />
                          VERIFIED
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <XCircle className="w-3 h-3" />
                          REJECTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Clock className="w-3 h-3" />
                          PENDING
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {r.receiptUrl ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewUrl(r.receiptUrl)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] transition"
                          >
                            <Eye className="w-3 h-3" />
                            Preview
                          </button>
                          <a
                            href={r.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No receipt file</span>
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
                      {isVerified ? (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy || isRejected}
                            onClick={() => handleApprove(r.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition shadow-2xs disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            VERIFY
                          </button>
                          {!isRejected && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReject(r.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold text-xs transition disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Image / PDF Preview Modal */}
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
                Subscription Payment Proof Preview
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
                <img src={previewUrl} alt="Subscription Receipt Proof" className="max-h-[60vh] max-w-full object-contain rounded-xl" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
