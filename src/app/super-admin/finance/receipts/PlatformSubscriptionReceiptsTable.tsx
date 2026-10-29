"use client";

import React, { useState, useMemo } from "react";
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
  Search,
  Download,
  Printer,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";

export interface PlatformSubscriptionReceipt {
  id: string;
  tenantId: string;
  schoolSlug?: string;
  schoolName?: string;
  amount: number | string;
  nipSessionId?: string;
  senderBank?: string;
  accountName?: string | null;
  receiptUrl?: string | null;
  receiptData?: string | null;
  receiptMimeType?: string | null;
  status: string;
  createdAt: string | Date;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
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
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "VERIFIED" | "REJECTED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState<PlatformSubscriptionReceipt | null>(null);
  const [confirmVerifyItem, setConfirmVerifyItem] = useState<PlatformSubscriptionReceipt | null>(null);
  const [rejectItem, setRejectItem] = useState<PlatformSubscriptionReceipt | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filtered and searched receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const statusUpper = r.status.toUpperCase();
      const isPending = statusUpper === "PENDING" || statusUpper === "PENDING_VERIFICATION";
      const isVerified = statusUpper === "VERIFIED";
      const isRejected = statusUpper === "REJECTED";

      if (activeTab === "PENDING" && !isPending) return false;
      if (activeTab === "VERIFIED" && !isVerified) return false;
      if (activeTab === "REJECTED" && !isRejected) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const schoolName = (r.schoolName || r.tenant?.schoolName || "").toLowerCase();
      const slug = (r.schoolSlug || r.tenant?.subdomain || "").toLowerCase();
      const ref = (r.nipSessionId || r.id).toLowerCase();
      const bank = (r.senderBank || "").toLowerCase();
      const payer = (r.accountName || "").toLowerCase();

      return schoolName.includes(q) || slug.includes(q) || ref.includes(q) || bank.includes(q) || payer.includes(q);
    });
  }, [receipts, activeTab, searchQuery]);

  const handleVerify = async (paymentId: string) => {
    setIsProcessing(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/super-admin/finance/receipts/${paymentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });

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
                verifiedBy: "Super Admin",
                tenant: r.tenant
                  ? { ...r.tenant, status: "ACTIVE", subscriptionStatus: "ACTIVE" }
                  : null,
              }
            : r
        )
      );

      setFeedback({
        type: "success",
        message: data.message || "Institution payment verified and reactivated successfully!",
      });
      setConfirmVerifyItem(null);
      if (previewItem?.id === paymentId) {
        setPreviewItem(null);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An unexpected error occurred." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (paymentId: string) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejecting this payment proof.");
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/super-admin/finance/receipts/${paymentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", rejectionReason: rejectionReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject payment.");
      }

      setReceipts((prev) =>
        prev.map((r) =>
          r.id === paymentId
            ? {
                ...r,
                status: "REJECTED",
                verifiedAt: new Date().toISOString(),
                notes: rejectionReason.trim(),
                rejectionReason: rejectionReason.trim(),
              }
            : r
        )
      );

      setFeedback({
        type: "success",
        message: "Payment rejected and tenant notified.",
      });
      setRejectItem(null);
      setRejectionReason("");
      if (previewItem?.id === paymentId) {
        setPreviewItem(null);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An unexpected error occurred." });
    } finally {
      setIsProcessing(false);
    }
  };

  const getPreviewSource = (r: PlatformSubscriptionReceipt) => {
    if (r.receiptUrl?.startsWith("https://") || r.receiptUrl?.startsWith("data:")) {
      return r.receiptUrl;
    }
    if (r.receiptData) {
      return `data:${r.receiptMimeType || "image/jpeg"};base64,${r.receiptData}`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-semibold animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border border-rose-500 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
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
            className="p-1 hover:opacity-70 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Control Bar: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700/60 shrink-0">
          {(["ALL", "PENDING", "VERIFIED", "REJECTED"] as const).map((tab) => {
            const count = receipts.filter((r) => {
              const s = r.status.toUpperCase();
              if (tab === "ALL") return true;
              if (tab === "PENDING") return s === "PENDING" || s === "PENDING_VERIFICATION";
              if (tab === "VERIFIED") return s === "VERIFIED";
              if (tab === "REJECTED") return s === "REJECTED";
              return false;
            }).length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === tab
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeTab === tab
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search school, ref, bank..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {filteredReceipts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              No subscription receipts found
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              {searchQuery ? "Try refining your search terms" : "Submitted receipts will appear here for verification"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <th className="py-3.5 px-4">Institution</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">NIP Ref / Session ID</th>
                  <th className="py-3.5 px-4">Bank / Origin</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Proof File</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredReceipts.map((r) => {
                  const statusUpper = r.status.toUpperCase();
                  const isVerified = statusUpper === "VERIFIED";
                  const isPending = statusUpper === "PENDING" || statusUpper === "PENDING_VERIFICATION";
                  const isRejected = statusUpper === "REJECTED";
                  const previewSrc = getPreviewSource(r);
                  const isEphemeralLost = !previewSrc && Boolean(r.receiptUrl);

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition"
                    >
                      {/* Institution */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100 dark:border-indigo-800">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {r.schoolName || r.tenant?.schoolName || "Institution"}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {r.schoolSlug || r.tenant?.subdomain || "portal"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                        {formatCurrency(Number(r.amount || 0))}
                      </td>

                      {/* Reference */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-300">
                        {r.nipSessionId || r.id}
                      </td>

                      {/* Bank */}
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800 dark:text-zinc-200 font-medium">
                          {r.senderBank || "Bank Transfer"}
                        </p>
                        {r.accountName && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {r.accountName}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isVerified
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : isPending
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {isVerified ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : isPending ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {isVerified ? "Verified" : isPending ? "Pending" : "Rejected"}
                        </span>
                        {r.verifiedBy && (
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            by {r.verifiedBy}
                          </p>
                        )}
                      </td>

                      {/* Proof File */}
                      <td className="py-3.5 px-4">
                        {previewSrc ? (
                          <button
                            type="button"
                            onClick={() => setPreviewItem(r)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-[11px] transition cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-indigo-500" />
                            <span>Preview</span>
                          </button>
                        ) : isEphemeralLost ? (
                          <button
                            type="button"
                            onClick={() => setPreviewItem(r)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] font-medium"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Needs Re-upload</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No file</span>
                        )}
                      </td>

                      {/* Submitted */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 text-[11px]">
                        {new Date(r.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isVerified ? (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setConfirmVerifyItem(r)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition shadow-2xs disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              VERIFY
                            </button>
                            {!isRejected && (
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => {
                                  setRejectItem(r);
                                  setRejectionReason("");
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
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
          </div>
        )}
      </div>

      {/* ── Modal 1: Receipt Preview Modal ── */}
      {previewItem && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="space-y-0.5">
                <p className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Payment Proof &bull; {previewItem.schoolName || previewItem.tenant?.schoolName}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Ref: {previewItem.nipSessionId || previewItem.id} &bull; {formatCurrency(Number(previewItem.amount || 0))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Preview Body */}
            <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-50 dark:bg-zinc-950 p-2 flex items-center justify-center">
              {(() => {
                const src = getPreviewSource(previewItem);
                const isPdf =
                  previewItem.receiptMimeType === "application/pdf" ||
                  src?.startsWith("data:application/pdf") ||
                  previewItem.receiptUrl?.endsWith(".pdf");

                if (!src) {
                  return (
                    <div className="p-8 text-center space-y-3">
                      <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                      <p className="font-extrabold text-sm text-slate-800 dark:text-zinc-200">
                        File Expired Before Persistence Fix
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        This receipt was uploaded to ephemeral disk on Render before the persistence fix was deployed.
                        The transaction reference is intact. <b>You can still verify this institution below</b>, or ask the school to re-upload.
                      </p>
                    </div>
                  );
                }

                if (isPdf) {
                  return (
                    <iframe
                      src={src}
                      className="w-full h-[500px] rounded-lg border border-slate-200 dark:border-zinc-800"
                      title="PDF Proof"
                    />
                  );
                }

                return (
                  <img
                    src={src}
                    alt="Payment Receipt"
                    className="max-h-[500px] w-auto mx-auto object-contain rounded-lg shadow-sm"
                  />
                );
              })()}
            </div>

            {/* Modal Action Footer */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {getPreviewSource(previewItem) && (
                  <>
                    <a
                      href={getPreviewSource(previewItem)!}
                      download={`receipt_${previewItem.nipSessionId || previewItem.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </button>
                  </>
                )}
              </div>

              {previewItem.status !== "VERIFIED" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmVerifyItem(previewItem);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Verify Confirmation Dialog ── */}
      {confirmVerifyItem && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isProcessing && setConfirmVerifyItem(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Confirm License Verification
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Verify payment of <b>{formatCurrency(Number(confirmVerifyItem.amount || 0))}</b> for{" "}
                <b>{confirmVerifyItem.schoolName || confirmVerifyItem.tenant?.schoolName}</b>?
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl space-y-1 text-xs text-slate-600 dark:text-zinc-300">
              <p>&bull; Activates institution license for <b>365 days</b></p>
              <p>&bull; Atomically unlocks portal network routing</p>
              <p>&bull; Sends reactivation email and green in-dashboard alert to tenant</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmVerifyItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleVerify(confirmVerifyItem.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm &amp; Activate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Reject Dialog ── */}
      {rejectItem && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isProcessing && setRejectItem(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Reject Payment Proof
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Please state the reason for rejection. This will be sent directly to the tenant administrator.
              </p>
            </div>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Transfer narration does not match student ID or amount credited does not reflect on platform bank statement."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setRejectItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleReject(rejectItem.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
              >
                {isProcessing ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
