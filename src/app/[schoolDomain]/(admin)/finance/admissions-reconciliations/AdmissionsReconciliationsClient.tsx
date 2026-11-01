"use client";

import React, { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  AlertTriangle,
  Receipt,
  Download,
  ExternalLink,
  ShieldCheck,
  Building,
  CreditCard,
  User,
  Clock,
} from "lucide-react";
import {
  approveAdmissionsFeeTransaction,
  rejectAdmissionsFeeTransaction,
} from "./actions";

interface TransactionItem {
  id: string;
  tenantId: string;
  applicationId: string;
  paymentMethod: "DIRECT_GATEWAY" | "MANUAL_BANK_TRANSFER" | "POS_COUNTER" | "CASH" | string;
  amount: number | string;
  currency: string;
  paymentReference: string;
  proofOfPaymentUrl?: string | null;
  paymentStatus: "PENDING" | "SETTLED" | "REJECTED" | "DISPUTED" | string;
  reconciliationNotes?: string | null;
  verifiedByUserId?: string | null;
  verifiedAt?: string | Date | null;
  createdAt: string | Date;
  application: {
    id: string;
    applicationNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    whatsappNumber?: string | null;
    programId: string;
    status: string;
  };
}

interface ReconciliationsClientProps {
  initialTransactions: TransactionItem[];
  schoolId: string;
  schoolName: string;
}

export default function AdmissionsReconciliationsClient({
  initialTransactions,
  schoolId,
  schoolName,
}: ReconciliationsClientProps) {
  const [transactions, setTransactions] = useState<TransactionItem[]>(initialTransactions);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeReceiptProof, setActiveReceiptProof] = useState<string | null>(null);
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const filteredTx = transactions.filter((tx) => {
    const matchesSearch =
      `${tx.application.firstName} ${tx.application.lastName} ${tx.paymentReference} ${tx.application.applicationNumber}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    if (filterStatus === "ALL") return matchesSearch;
    return matchesSearch && tx.paymentStatus === filterStatus;
  });

  const handleApprove = (txId: string) => {
    startTransition(async () => {
      const res = await approveAdmissionsFeeTransaction({
        transactionId: txId,
        schoolId,
      });

      if (res.success) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === txId
              ? {
                  ...t,
                  paymentStatus: "SETTLED",
                  reconciliationNotes: "Reconciled with institutional bank ledger",
                }
              : t
          )
        );
        setActionFeedback({
          type: "success",
          message: "Payment settled! Application advanced to SUBMITTED and receipt issued.",
        });
        setTimeout(() => setActionFeedback(null), 5000);
      } else {
        setActionFeedback({ type: "error", message: res.error || "Approval failed." });
      }
    });
  };

  const handleReject = () => {
    if (!rejectingTxId) return;

    startTransition(async () => {
      const res = await rejectAdmissionsFeeTransaction({
        transactionId: rejectingTxId,
        schoolId,
        reason: rejectionReason || "Bank teller mismatch or unverified transaction reference",
      });

      if (res.success) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === rejectingTxId
              ? {
                  ...t,
                  paymentStatus: "REJECTED",
                  reconciliationNotes: rejectionReason,
                }
              : t
          )
        );
        setRejectingTxId(null);
        setRejectionReason("");
        setActionFeedback({
          type: "success",
          message: "Transaction rejected. Alert dispatched to applicant.",
        });
        setTimeout(() => setActionFeedback(null), 5000);
      } else {
        setActionFeedback({ type: "error", message: res.error || "Rejection failed." });
      }
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Admissions Fee Reconciliations Queue
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {schoolName} • Bursary Ledger Matching & Fiscal Receipt Clearance
          </p>
        </div>

        {actionFeedback && (
          <div
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              actionFeedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300"
            }`}
          >
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
          {["PENDING", "SETTLED", "REJECTED", "ALL"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === s
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by applicant or memo ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-4">Applicant & Ref</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Amount Claimed</th>
                <th className="p-4">Proof of Payment</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Bursary Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No transactions matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => {
                  const isPendingStatus = tx.paymentStatus === "PENDING";
                  const isSettled = tx.paymentStatus === "SETTLED";
                  const isRejected = tx.paymentStatus === "REJECTED";

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-black text-slate-900 dark:text-white">
                          {tx.application.firstName} {tx.application.lastName}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {tx.paymentReference}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          App: {tx.application.applicationNumber} • {tx.application.programId}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">
                          {tx.paymentMethod.replace(/_/g, " ")}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {tx.currency} {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="p-4">
                        {tx.proofOfPaymentUrl ? (
                          <button
                            type="button"
                            onClick={() => setActiveReceiptProof(tx.proofOfPaymentUrl!)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200 dark:border-indigo-800 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No file attached</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                            isSettled
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isRejected
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {tx.paymentStatus}
                        </span>
                        {tx.reconciliationNotes && (
                          <div className="text-[10px] text-slate-500 mt-1 max-w-xs truncate">
                            {tx.reconciliationNotes}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {isPendingStatus ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              disabled={isPending}
                              onClick={() => handleApprove(tx.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                            >
                              Settle & Approve
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => setRejectingTxId(tx.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg font-bold text-xs transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : isSettled ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Reconciled</span>
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold text-[11px]">Rejected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Viewer Lightbox */}
      {activeReceiptProof && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="text-xs font-black uppercase text-slate-600 dark:text-zinc-400">
                Payment Proof Document
              </h3>
              <button
                onClick={() => setActiveReceiptProof(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center p-2 bg-slate-950 rounded-xl">
              {activeReceiptProof.includes(".pdf") ? (
                <iframe
                  src={activeReceiptProof}
                  title="Receipt Proof"
                  className="w-full h-[60vh] rounded-lg bg-white"
                />
              ) : (
                <img
                  src={activeReceiptProof}
                  alt="Payment Receipt"
                  className="max-h-[60vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Prompt Modal */}
      {rejectingTxId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Reject Payment Submission
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400">
              State the reason this payment proof was not found on your bank ledger:
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Reference not found on bank statement, or amount does not match."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRejectingTxId(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleReject}
                className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
              >
                {isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
