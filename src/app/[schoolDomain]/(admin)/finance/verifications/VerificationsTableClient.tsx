"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Search,
  Filter,
  Loader2,
  Clock,
  Building2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Copy,
  Download,
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { approvePaymentProof, rejectPaymentProof } from "./actions";

interface PaymentProofItem {
  id: string;
  studentName: string;
  admissionNumber: string;
  amount: number;
  paidAt: Date | string;
  payerBankName: string;
  payerAccountName: string | null;
  sessionId: string;
  proofImageUrl: string;
  status: string;
  submittedAt: Date | string;
  verifiedAt: Date | string | null;
  verifiedByName: string | null;
  rejectionReason: string | null;
  invoice: {
    id: string;
    description: string;
    amountDue: number;
    amountPaid: number;
    status: string;
  } | null;
}

interface VerificationStats {
  pendingCount: number;
  approvedTodayCount: number;
  rejectedCount: number;
  totalVerifiedRevenue: number;
}

interface VerificationsTableClientProps {
  schoolDomain: string;
  initialProofs: PaymentProofItem[];
  initialStats: VerificationStats;
}

export default function VerificationsTableClient({
  schoolDomain,
  initialProofs,
  initialStats,
}: VerificationsTableClientProps) {
  const [proofs, setProofs] = useState<PaymentProofItem[]>(initialProofs);
  const [stats, setStats] = useState<VerificationStats>(initialStats);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal States
  const [activeProofForView, setActiveProofForView] = useState<PaymentProofItem | null>(null);
  const [activeProofForReject, setActiveProofForReject] = useState<PaymentProofItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Zoom state for Lightbox
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Duplicate Reference Detector across proofs in queue
  const sessionRefCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proofs) {
      const key = (p.sessionId || "").trim().toUpperCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [proofs]);

  // Filtering Logic
  const filteredProofs = proofs.filter((p) => {
    const matchesStatus =
      statusFilter === "ALL" || p.status.toUpperCase() === statusFilter.toUpperCase();

    if (!matchesStatus) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.trim().toLowerCase();
    return (
      p.studentName.toLowerCase().includes(q) ||
      p.admissionNumber.toLowerCase().includes(q) ||
      p.sessionId.toLowerCase().includes(q) ||
      p.payerBankName.toLowerCase().includes(q)
    );
  });

  const handleApprove = async (proof: PaymentProofItem) => {
    setActionLoadingId(proof.id);
    setActionFeedback(null);

    const res = await approvePaymentProof(schoolDomain, proof.id);

    setActionLoadingId(null);

    if (res.success) {
      setActionFeedback({ type: "success", text: res.message || "Payment verified & ledger updated." });

      // Update local state reactively
      setProofs((prev) =>
        prev.map((item) =>
          item.id === proof.id
            ? { ...item, status: "APPROVED", verifiedAt: new Date(), verifiedByName: "Bursar" }
            : item
        )
      );

      setStats((prev) => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
        approvedTodayCount: prev.approvedTodayCount + 1,
        totalVerifiedRevenue: prev.totalVerifiedRevenue + proof.amount,
      }));

      setTimeout(() => setActionFeedback(null), 4000);
    } else {
      setActionFeedback({ type: "error", text: res.error || "Approval failed." });
    }
  };

  const handleConfirmReject = async () => {
    if (!activeProofForReject || !rejectReason.trim()) return;

    const proof = activeProofForReject;
    setActionLoadingId(proof.id);
    setActionFeedback(null);

    const res = await rejectPaymentProof(schoolDomain, proof.id, rejectReason.trim());

    setActionLoadingId(null);
    setActiveProofForReject(null);
    const reasonText = rejectReason.trim();
    setRejectReason("");

    if (res.success) {
      setActionFeedback({ type: "success", text: "Payment rejected and reason logged for parent." });

      setProofs((prev) =>
        prev.map((item) =>
          item.id === proof.id
            ? {
                ...item,
                status: "REJECTED",
                rejectionReason: reasonText,
                verifiedAt: new Date(),
                verifiedByName: "Bursar",
              }
            : item
        )
      );

      setStats((prev) => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
        rejectedCount: prev.rejectedCount + 1,
      }));

      setTimeout(() => setActionFeedback(null), 4000);
    } else {
      setActionFeedback({ type: "error", text: res.error || "Rejection failed." });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setActionFeedback({ type: "success", text: `Copied '${text}' to clipboard` });
    setTimeout(() => setActionFeedback(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. KPI STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Pending */}
        <div
          onClick={() => setStatusFilter("PENDING")}
          className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer ${
            statusFilter === "PENDING"
              ? "bg-amber-500/10 border-amber-500/40 shadow-xs"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-amber-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pending
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {stats.pendingCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting bank audit</span>
        </div>

        {/* Card 2: Approved Today */}
        <div
          onClick={() => setStatusFilter("APPROVED")}
          className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer ${
            statusFilter === "APPROVED"
              ? "bg-emerald-500/10 border-emerald-500/40 shadow-xs"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-emerald-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Approved Today
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {stats.approvedTodayCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Receipted today</span>
        </div>

        {/* Card 3: Rejected */}
        <div
          onClick={() => setStatusFilter("REJECTED")}
          className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer ${
            statusFilter === "REJECTED"
              ? "bg-rose-500/10 border-rose-500/40 shadow-xs"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-rose-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Rejected
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {stats.rejectedCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Declined / Re-upload required</span>
        </div>

        {/* Card 4: Total Verified Revenue */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Verified Revenue
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              0% Fee
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono tracking-tight truncate">
            ₦{stats.totalVerifiedRevenue.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block truncate">Manually credited to school</span>
        </div>
      </div>

      {/* Action Feedback Alert */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3 rounded-2xl">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, Adm No, Session ID, or Bank..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter status tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl w-full sm:w-auto overflow-x-auto">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === f
                  ? "bg-white dark:bg-zinc-950 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {f === "ALL" ? "All Proofs" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 3. VERIFICATIONS TABLE */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        {filteredProofs.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              No Payment Proofs Found
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {statusFilter === "PENDING"
                ? "There are currently zero pending payment proofs in the queue. All submissions have been verified!"
                : "No matching payment proof submissions found for the selected filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3.5 px-4">Student &amp; Adm No</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Payer Bank</th>
                  <th className="py-3.5 px-4">Session ID / Ref</th>
                  <th className="py-3.5 px-4 text-center">Receipt Proof</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {filteredProofs.map((p) => {
                  const isActionLoading = actionLoadingId === p.id;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-zinc-850/50 transition-colors"
                    >
                      {/* Student & Admission No */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-zinc-100 block truncate max-w-[180px]">
                          {p.studentName}
                        </span>
                        <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold block">
                          {p.admissionNumber}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <span className="font-black font-mono text-sm text-slate-900 dark:text-white">
                          ₦{p.amount.toLocaleString()}
                        </span>
                        {p.invoice && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {p.invoice.description}
                          </span>
                        )}
                      </td>

                      {/* Payer Bank */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 block truncate max-w-[140px]">
                          {p.payerBankName}
                        </span>
                        {p.payerAccountName && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {p.payerAccountName}
                          </span>
                        )}
                      </td>

                      {/* Session ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-700 dark:text-zinc-300 truncate max-w-[130px]">
                            {p.sessionId}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(p.sessionId)}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition"
                            title="Copy Session ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {(sessionRefCounts.get((p.sessionId || "").trim().toUpperCase()) || 0) > 1 && (
                          <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[9px] font-black border border-rose-300 dark:border-rose-800">
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span>DUPLICATE REF</span>
                          </span>
                        )}
                      </td>

                      {/* Proof Thumbnail & View Button */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setZoomLevel(1);
                            setActiveProofForView(p);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Proof</span>
                        </button>
                      </td>

                      {/* Submitted At */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 text-[11px]">
                        {new Date(p.submittedAt).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {p.status === "PENDING" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                        {p.status === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        )}
                        {p.status === "REJECTED" && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-help"
                            title={p.rejectionReason || "Payment rejected"}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {p.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleApprove(p)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>

                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => {
                                setRejectReason("");
                                setActiveProofForReject(p);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-xs transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : p.status === "APPROVED" ? (
                          <span className="text-[11px] text-slate-400 italic">
                            Verified by {p.verifiedByName || "Bursar"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-rose-500 truncate max-w-[140px] block" title={p.rejectionReason || ""}>
                            Reason: {p.rejectionReason || "Declined"}
                          </span>
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

      {/* 4. LIGHTBOX IMAGE MODAL WITH ZOOM */}
      {activeProofForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 space-y-4 max-h-[95vh] flex flex-col text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black">
                  {activeProofForView.studentName} ({activeProofForView.admissionNumber})
                </h3>
                <p className="text-xs text-slate-400">
                  ₦{activeProofForView.amount.toLocaleString()} — {activeProofForView.payerBankName} (Session: {activeProofForView.sessionId})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <a
                  href={activeProofForView.proofImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Open Original Image"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveProofForView(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image Viewer Container */}
            <div className="flex-1 min-h-[320px] max-h-[60vh] overflow-auto flex items-center justify-center bg-black/60 rounded-xl p-3 border border-slate-800">
              <Image
                src={activeProofForView.proofImageUrl}
                alt="Payment Proof Receipt"
                width={800}
                height={800}
                unoptimized
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-lg transition-transform duration-150"
              />
            </div>

            {/* Footer Action when Pending */}
            {activeProofForView.status === "PENDING" && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  Inspect debit alert, session ID, and amount before approval.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const p = activeProofForView;
                      setActiveProofForView(null);
                      setActiveProofForReject(p);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-rose-600/60 hover:bg-rose-950/40 text-rose-400 text-xs font-bold"
                  >
                    Reject Proof
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = activeProofForView;
                      setActiveProofForView(null);
                      handleApprove(p);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Payment</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. REJECTION REASON MODAL */}
      {activeProofForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                <span>Reject Payment Proof</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveProofForReject(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                Rejecting payment of <strong>₦{activeProofForReject.amount.toLocaleString()}</strong> for{" "}
                <strong>{activeProofForReject.studentName}</strong> ({activeProofForReject.admissionNumber}).
              </p>
              <p className="text-[11px] text-slate-400">
                The parent will see this reason in their portal so they can re-upload or contact bursary.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 block">Common reasons:</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Transfer not reflected in school account",
                  "Incorrect amount transferred",
                  "Illegible or corrupted receipt screenshot",
                  "Duplicate transaction reference",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className="text-[10px] px-2 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Reason Textarea */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain clearly why this payment cannot be verified..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveProofForReject(null)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
