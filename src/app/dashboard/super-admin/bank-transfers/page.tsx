"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Check,
  X,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import {
  INITIAL_PROOFS,
  INITIAL_SCHOOLS,
  BankTransferProof,
  SchoolTenant,
} from "../mock-data";

export default function BankTransfersPage() {
  const [proofs, setProofs] = useState<BankTransferProof[]>(INITIAL_PROOFS);
  const [schools, setSchools] = useState<SchoolTenant[]>(INITIAL_SCHOOLS);
  const [verifyingProof, setVerifyingProof] = useState<BankTransferProof | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("All");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const pendingProofs = proofs.filter((p) => p.status === "Pending");
  const totalVerifiedVolume = proofs
    .filter((p) => p.status === "Approved")
    .reduce((acc, curr) => acc + curr.amount, 1250000); // 1.25M baseline verified

  const filteredProofs = proofs.filter((p) => {
    if (filterStatus === "All") return true;
    return p.status === filterStatus;
  });

  const handleApproveProof = (proof: BankTransferProof) => {
    setProofs((prev) =>
      prev.map((p) => (p.id === proof.id ? { ...p, status: "Approved" } : p))
    );
    setSchools((prev) =>
      prev.map((s) =>
        s.id === proof.schoolId || s.code === proof.schoolCode
          ? {
              ...s,
              subscriptionStatus: "Active",
              planStatus: "Active",
              tier: proof.planRequested,
              lastPaymentDate: "Today (Verified)",
            }
          : s
      )
    );
    setVerifyingProof(null);
    triggerToast(
      `Bank transfer ${proof.referenceId} approved! ${proof.schoolName} activated on ${proof.planRequested} tier.`
    );
  };

  const handleRejectProof = (proof: BankTransferProof) => {
    setProofs((prev) =>
      prev.map((p) => (p.id === proof.id ? { ...p, status: "Rejected" } : p))
    );
    setVerifyingProof(null);
    triggerToast(`Bank transfer ${proof.referenceId} marked as rejected.`);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] bg-slate-950 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-[95vw]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Bank Transfer Verifications (Manual Model)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              {pendingProofs.length} Pending
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Audit and verify institutional bank deposit slips, wire receipts, and direct bank remittances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none shadow-sm"
          >
            <option value="All">All Transactions</option>
            <option value="Pending">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Financial Protocol Notice Banner */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-md">
          ₦
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-amber-950 text-base">
            Manual Bank Transfer Verification Model
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed max-w-3xl">
            Under the Nigerian educational SaaS billing model, schools pay directly into the SchoolERP
            corporate bank account and upload bank deposit slips or mobile transfer transaction receipts.
            The Super Admin manually reconciles each receipt with the corporate banking statement before
            approving and provisioning the tenant plan tier.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pending Proofs
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-2">
            {pendingProofs.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Requires bank statement cross-check</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Verified Volume
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2 font-mono">
            ₦{totalVerifiedVolume.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total recognized subscription inflow</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gateway Fee Savings
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-2 font-mono">
            ₦{Math.round(totalVerifiedVolume * 0.015).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Saved vs 1.5% payment gateway processing fees</div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Pending & Verified Bank Slips
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review uploaded receipts and activate corresponding school tiers
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            {filteredProofs.length} records
          </span>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">School Name</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Reference ID</th>
                <th className="py-3.5 px-4">Bank Name</th>
                <th className="py-3.5 px-4">Date Uploaded</th>
                <th className="py-3.5 px-4">Proof Slip</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProofs.map((proof) => (
                <tr key={proof.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    <Link
                      href={`/dashboard/super-admin/tenants/${proof.schoolCode.toLowerCase()}`}
                      className="font-bold text-slate-900 hover:text-blue-600 transition-colors block"
                    >
                      {proof.schoolName}
                    </Link>
                    <div className="text-xs text-slate-500 font-mono">
                      {proof.schoolCode} • Requested: <strong>{proof.planRequested}</strong>
                    </div>
                  </td>

                  <td className="py-4 px-4 font-mono font-black text-slate-900 text-sm">
                    ₦{proof.amount.toLocaleString()}
                  </td>

                  <td className="py-4 px-4 font-mono text-xs text-slate-600">
                    {proof.referenceId}
                  </td>

                  <td className="py-4 px-4 text-xs text-slate-700 font-medium">
                    {proof.bankName}
                  </td>

                  <td className="py-4 px-4 text-xs text-slate-500">{proof.uploadedAt}</td>

                  <td className="py-4 px-4">
                    <button
                      type="button"
                      onClick={() => setVerifyingProof(proof)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Slip
                    </button>
                  </td>

                  <td className="py-4 px-6 text-right">
                    {proof.status === "Pending" ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleApproveProof(proof)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectProof(proof)}
                          className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          proof.status === "Approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {proof.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="lg:hidden p-4 space-y-3.5 divide-y divide-slate-100">
          {filteredProofs.map((proof) => (
            <div key={proof.id} className="pt-3.5 first:pt-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/dashboard/super-admin/tenants/${proof.schoolCode.toLowerCase()}`}
                    className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors block"
                  >
                    {proof.schoolName}
                  </Link>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Ref: {proof.referenceId} • {proof.bankName}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-black text-slate-900 text-sm block">
                    ₦{proof.amount.toLocaleString()}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      proof.status === "Approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : proof.status === "Pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {proof.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setVerifyingProof(proof)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Slip
                </button>

                {proof.status === "Pending" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRejectProof(proof)}
                      className="px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveProof(proof)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Slip Modal */}
      {verifyingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-lg p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  ₦
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Verify Bank Deposit</h3>
                  <p className="text-[11px] text-slate-500">Ref: {verifyingProof.referenceId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingProof(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400">School:</span>
                  <div className="font-bold text-slate-900">{verifyingProof.schoolName}</div>
                </div>
                <div>
                  <span className="text-slate-400">Amount Paid:</span>
                  <div className="font-black text-emerald-700 font-mono text-sm">
                    ₦{verifyingProof.amount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Bank Name:</span>
                  <div className="font-semibold text-slate-900">{verifyingProof.bankName}</div>
                </div>
                <div>
                  <span className="text-slate-400">Depositor:</span>
                  <div className="font-semibold text-slate-900">{verifyingProof.depositorName}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 bg-slate-100 text-center">
                <div className="text-[11px] font-semibold text-slate-500 mb-2">
                  Uploaded Deposit Slip Proof
                </div>
                <div className="h-44 w-full bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-300">
                  <div className="text-slate-500 text-xs flex flex-col items-center gap-2 p-4">
                    <Receipt className="w-8 h-8 text-slate-400" />
                    <span className="font-mono text-[11px] font-bold">
                      {verifyingProof.bankName} - RECEIPT VOUCHER
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Amount: ₦{verifyingProof.amount.toLocaleString()} • Ref: {verifyingProof.referenceId}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleRejectProof(verifyingProof)}
                className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold"
              >
                Reject Proof
              </button>
              <button
                type="button"
                onClick={() => handleApproveProof(verifyingProof)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                Approve & Activate Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
