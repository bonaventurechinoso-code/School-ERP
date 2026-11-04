"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  Search,
  Filter,
  Download,
  ExternalLink,
  RefreshCw,
  DollarSign,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  Copy,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import PaymentReceiptVerify from "./PaymentReceiptVerify";

export interface BursarReceiptsHubProps {
  tenantId?: string;
  isSuperAdmin?: boolean;
  schoolName?: string;
}

export default function BursarReceiptsHub({
  tenantId,
  isSuperAdmin = false,
  schoolName,
}: BursarReceiptsHubProps) {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    verifiedToday: 0,
    amountVerified: 0,
    duplicateCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [termFilter, setTermFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");

  // Selected receipt for detailed verification modal
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  // Deduplication Modal State
  const [dedupModalData, setDedupModalData] = useState<{
    receipt: any;
    competingReceipts: any[];
  } | null>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");
  const [dedupNotes, setDedupNotes] = useState<string>("");
  const [isDeduplicating, setIsDeduplicating] = useState<boolean>(false);
  const [dedupError, setDedupError] = useState<string | null>(null);

  // Enabled modules for this tenant
  const [enabledModules, setEnabledModules] = useState<{ moduleType: string; title: string }[]>([]);

  useEffect(() => {
    fetch(`/api/v1/payments/settings?tenantId=${encodeURIComponent(tenantId || "default")}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          if (isSuperAdmin) {
            setEnabledModules(
              data.settings.map((s: any) => ({ moduleType: s.moduleType, title: s.title }))
            );
          } else {
            const enabled = data.settings
              .filter((s: any) => s.isEnabled)
              .map((s: any) => ({ moduleType: s.moduleType, title: s.title }));
            setEnabledModules(enabled);
          }
        }
      })
      .catch(() => {});
  }, [tenantId, isSuperAdmin]);

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tenantId && tenantId !== "super-admin") params.append("tenantId", tenantId);
      if (moduleFilter !== "ALL") params.append("moduleType", moduleFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (search.trim()) params.append("search", search.trim());
      params.append("page", String(page));
      params.append("limit", "15");

      // Date filtering helper
      if (dateFilter === "TODAY") {
        const today = new Date().toISOString().split("T")[0];
        params.append("startDate", today);
      } else if (dateFilter === "WEEK") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.append("startDate", d.toISOString().split("T")[0]);
      } else if (dateFilter === "MONTH") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.append("startDate", d.toISOString().split("T")[0]);
      }

      const res = await fetch(`/api/v1/payments/receipt/list?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setReceipts(data.receipts || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error("[FETCH_RECEIPTS_ERROR]:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, moduleFilter, statusFilter, search, page, dateFilter]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleOpenDeduplicate = (receipt: any) => {
    const competing =
      receipt.competingReceipts && receipt.competingReceipts.length > 0
        ? receipt.competingReceipts
        : [receipt];
    setDedupModalData({ receipt, competingReceipts: competing });
    // Default master selection: if one is already VERIFIED, keep it as master, otherwise default to current row
    const verifiedOne = competing.find((c: any) => c.status === "VERIFIED");
    setSelectedMasterId(verifiedOne ? verifiedOne.id : receipt.id);
    setDedupNotes("");
    setDedupError(null);
  };

  const handleExecuteDeduplicate = async () => {
    if (!dedupModalData || !selectedMasterId) return;
    const clones = dedupModalData.competingReceipts.filter((c: any) => c.id !== selectedMasterId);
    if (clones.length === 0) {
      setDedupError("You must have at least one redundant submission to merge as duplicate.");
      return;
    }

    try {
      setIsDeduplicating(true);
      setDedupError(null);

      const res = await fetch("/api/v1/payments/receipt/deduplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterReceiptId: selectedMasterId,
          duplicateReceiptIds: clones.map((c: any) => c.id),
          reconciliationNotes: dedupNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to deduplicate transactions");
      }

      setDedupModalData(null);
      fetchReceipts();
    } catch (err: any) {
      setDedupError(err.message || "Failed to execute deduplication");
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleExportCSV = () => {
    if (receipts.length === 0) return;
    const headers = [
      "ID",
      "Module",
      "Payer Name",
      "Payer Type",
      "Reference No",
      "Amount (NGN)",
      "Payment Date",
      "Method",
      "Bank",
      "Txn Ref",
      "Status",
      "Verified By",
    ];

    const rows = receipts.map((r) => [
      r.id,
      r.moduleType,
      `"${r.payerName}"`,
      r.payerType,
      r.referenceNo,
      r.amount,
      new Date(r.paymentDate).toLocaleDateString(),
      r.paymentMethod,
      `"${r.bankName || ""}"`,
      `"${r.txnRef || ""}"`,
      r.status,
      `"${r.verifiedBy || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `receipts_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            VERIFIED
          </span>
        );
      case "DUPLICATE":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
            <Copy className="w-3 h-3" /> DUPLICATE
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
            REJECTED
          </span>
        );
      case "FLAGGED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            FLAGGED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <FileCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>Universal Payment Receipt Verification Hub</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {isSuperAdmin
              ? "Super Admin Central Clearing Desk — Cross-School & Platform Subscriptions"
              : `Bursar Revenue & Admissions Verification Portal ${schoolName ? `• ${schoolName}` : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReceipts()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Widget 1: Pending */}
        <div className="p-5 rounded-3xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-950/20 dark:to-zinc-900 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
              Pending Verification
            </span>
            <span className="text-3xl font-black text-amber-950 dark:text-amber-200 mt-1 block">
              {stats.pendingCount}
            </span>
            <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-medium">
              Awaiting Bursar clearance
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Widget 2: Verified Today */}
        <div className="p-5 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/70 to-white dark:from-emerald-950/20 dark:to-zinc-900 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              Verified Today
            </span>
            <span className="text-3xl font-black text-emerald-950 dark:text-emerald-200 mt-1 block">
              {stats.verifiedToday}
            </span>
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              Cleared today
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Widget 3: Amount Verified */}
        <div className="p-5 rounded-3xl border border-indigo-200/80 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-950/20 dark:to-zinc-900 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
              Total Amount Verified
            </span>
            <span className="text-2xl sm:text-3xl font-black text-indigo-950 dark:text-indigo-200 mt-1 block truncate">
              ₦{Number(stats.amountVerified).toLocaleString()}
            </span>
            <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 font-medium">
              Settled into school accounts
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search payer, ref no, txn ref, bank..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Module Filter */}
          <div>
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Enabled Modules</option>
              {enabledModules.length > 0 ? (
                enabledModules.map((m) => (
                  <option key={m.moduleType} value={m.moduleType}>
                    {m.title}
                  </option>
                ))
              ) : (
                <>
                  <option value="ADMISSION_FORM_FEE">Application Fee</option>
                  <option value="PLATFORM_SUBSCRIPTION">Platform Subscription</option>
                  <option value="TUITION">Tuition / School Fees</option>
                  <option value="RESULT_CHECKING_FEE">Result Checking Fee</option>
                  <option value="REPORT_CARD_CHECKING_FEE">Report Card Access Fee</option>
                  <option value="TRANSCRIPT_FEE">Official Transcript Fee</option>
                  <option value="EXAM">Examination Fee</option>
                  <option value="PTA">PTA Levy</option>
                  <option value="UNIFORM">School Uniform</option>
                  <option value="BOOKS">Textbooks & Stationery</option>
                  <option value="TRANSPORT">Transport / Bus</option>
                  <option value="HOSTEL">Hostel Accommodation</option>
                  <option value="OTHER">Other Fees</option>
                </>
              )}
            </select>
          </div>


          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Verification</option>
              <option value="VERIFIED">Verified</option>
              <option value="DUPLICATE">Duplicate (Merged)</option>
              <option value="REJECTED">Rejected</option>
              <option value="FLAGGED">Flagged</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Paid Today</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Receipts List */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs font-bold text-slate-500">Loading payment receipts...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              No Payment Receipts Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are currently no receipts matching the active filter criteria. Receipts uploaded by applicants or students will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-black tracking-wider">
                  <th className="p-3.5 pl-6">Reference / Payer</th>
                  <th className="p-3.5">Module</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Payment Date</th>
                  <th className="p-3.5">Method & Bank</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {receipts.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition"
                  >
                    <td className="p-3.5 pl-6">
                      <div className="font-bold text-slate-900 dark:text-zinc-100">
                        {r.payerName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{r.referenceNo}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                          {r.payerType}
                        </span>
                      </div>
                      {r.isPotentialDuplicate && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black border border-amber-300 dark:border-amber-800"
                          title="Multiple receipts share the exact same ID, Module, and Amount"
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
                          <span>POTENTIAL DUPLICATE ({r.competingCount + 1})</span>
                        </div>
                      )}
                      {r.status === "DUPLICATE" && r.masterReceiptId && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[10px] font-bold border border-purple-200 dark:border-purple-800"
                          title={`Merged under Master transaction #${r.masterReceiptId}`}
                        >
                          <Copy className="w-3 h-3 shrink-0" />
                          <span>Merged: #{r.masterReceiptId.slice(0, 8)}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-700 dark:text-zinc-300">
                        {r.moduleType?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-slate-900 dark:text-zinc-100 text-sm">
                      ₦{Number(r.amount).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-zinc-400">
                      <div>{new Date(r.paymentDate).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">
                        Uploaded {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-zinc-400">
                      <div className="font-medium">{r.paymentMethod}</div>
                      {r.depositorName && (
                        <div className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300 truncate max-w-[160px]">
                          Depositor: {r.depositorName}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                        {r.bankName || r.transferReference || r.txnRef || "—"}
                      </div>
                      {r.isDuplicateReference && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-300 dark:border-rose-800"
                          title={`Duplicate transfer reference (${r.duplicateCount} occurrences)`}
                        >
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>DUPLICATE REF ({r.duplicateCount})</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">{statusBadge(r.status)}</td>
                    <td className="p-3.5 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.fileUrl && (
                          <a
                            href={r.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                            title="Preview Payment Proof Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {r.isPotentialDuplicate ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDeduplicate(r)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-[11px] shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer ring-2 ring-amber-400/30"
                            title="Multiple identical receipts detected. Click to merge and verify master record."
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Deduplicate</span>
                          </button>
                        ) : r.status === "DUPLICATE" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDeduplicate(r)}
                            className="px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title="Inspect merged duplicate cluster"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Merged Clone</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveReceipt(r)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition cursor-pointer"
                          >
                            Verify Hub
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {page} of {totalPages} ({totalCount} total receipts)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">
                  Review &amp; Verify Payment Receipt
                </h3>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <PaymentReceiptVerify
                receipt={activeReceipt}
                canVerify={true}
                onVerifySuccess={(updated) => {
                  setActiveReceipt(null);
                  fetchReceipts();
                }}
                onRejectSuccess={(updated) => {
                  setActiveReceipt(null);
                  fetchReceipts();
                }}
                onFlagSuccess={(updated) => {
                  setActiveReceipt(null);
                  fetchReceipts();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Deduplication Modal */}
      {dedupModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-zinc-100">
                    Receipt Deduplication &amp; Clearance Desk
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Resolve competing transactions sharing identical Application/Student ID, Module, and Amount
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDedupModalData(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Context Summary Bar */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Candidate / Payer: </span>
                <strong className="text-slate-900 dark:text-zinc-100">
                  {dedupModalData.receipt.payerName}
                </strong>
                <span className="ml-2 font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300">
                  {dedupModalData.receipt.referenceNo}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 font-medium">Module: </span>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">
                    {dedupModalData.receipt.moduleType?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Fee: </span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                    ₦{Number(dedupModalData.receipt.amount).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {dedupError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{dedupError}</span>
                </div>
              )}

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                  Select Master Transaction Record ({dedupModalData.competingReceipts.length} Competing Submissions)
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Choose the verified primary transaction record. The unselected competing submission(s) will be automatically merged and tagged natively as <strong>DUPLICATE</strong> under this master record without causing skewed rejection reports or sending false re-upload emails.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {dedupModalData.competingReceipts.map((item: any, idx: number) => {
                    const isSelectedMaster = selectedMasterId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedMasterId(item.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelectedMaster
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30 shadow-xs"
                            : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-slate-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        <div>
                          {/* Card Status & Selection Header */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800 mb-3">
                            <span className="text-[11px] font-mono font-bold text-slate-500">
                              Entry #{idx + 1} • {item.id.slice(0, 8)}
                            </span>
                            {isSelectedMaster ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                                <CheckCircle2 className="w-3 h-3" />
                                MASTER RECORD
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <Copy className="w-3 h-3" />
                                WILL BE FLAGGED DUPLICATE
                              </span>
                            )}
                          </div>

                          {/* Proof Image Preview */}
                          {item.fileUrl && (
                            <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 relative group aspect-video flex items-center justify-center">
                              {item.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                                <img
                                  src={item.fileUrl}
                                  alt="Payment Proof"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-slate-400 text-xs flex flex-col items-center gap-1">
                                  <FileCheck className="w-6 h-6 text-slate-400" />
                                  <span>Document Receipt</span>
                                </div>
                              )}
                              <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5"
                              >
                                <ExternalLink className="w-4 h-4" />
                                <span>Inspect Full Slip</span>
                              </a>
                            </div>
                          )}

                          {/* Metadata Fields */}
                          <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300 font-medium">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Current Status:</span>
                              <span>{statusBadge(item.status)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Upload Date:</span>
                              <span className="text-slate-800 dark:text-zinc-200 font-semibold">
                                {new Date(item.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {item.depositorName && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Depositor:</span>
                                <span className="font-semibold">{item.depositorName}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-slate-400">Bank / Channel:</span>
                              <span>{item.bankName || item.paymentMethod}</span>
                            </div>
                            {(item.transferReference || item.txnRef) && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Ref / Session ID:</span>
                                <span className="font-mono text-[11px] truncate max-w-[150px]">
                                  {item.transferReference || item.txnRef}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Radio Selector Footer */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                          <input
                            type="radio"
                            name="masterSelection"
                            checked={isSelectedMaster}
                            onChange={() => setSelectedMasterId(item.id)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                            {isSelectedMaster ? "Primary Active Record" : "Set as Master Record"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Deduplication Notes */}
              <div className="pt-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">
                  Reconciliation &amp; Deduplication Notes (Audit Trail)
                </label>
                <textarea
                  rows={2}
                  value={dedupNotes}
                  onChange={(e) => setDedupNotes(e.target.value)}
                  placeholder="e.g. Duplicate slip submitted via both applicant portal and walk-in desk; primary transaction verified under master record."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                1 record marked <strong>VERIFIED</strong> • {dedupModalData.competingReceipts.length - 1} record(s) flagged <strong>DUPLICATE</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDedupModalData(null)}
                  disabled={isDeduplicating}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDeduplicate}
                  disabled={isDeduplicating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeduplicating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isDeduplicating ? "Merging..." : "Merge & Finalize Deduplication"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
