"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/session-context";
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Ban,
  UserCheck,
  FileCheck,
  Calendar,
  GraduationCap,
  AlertCircle,
  Copy,
  ChevronRight,
  ShieldCheck,
  ArrowUpDown,
} from "lucide-react";
import AdmissionRegisterDrawer, {
  AdmissionRegisterRecord,
} from "./AdmissionRegisterDrawer";
import { requestApplicantDocsAction } from "./actions";

interface AdmissionRegisterTableProps {
  schoolId: string;
  schoolDomain: string;
  schoolName?: string;
  onStatsUpdate?: (stats: { total: number; newCount: number; docsPendingCount: number; admittedCount: number }) => void;
}

export default function AdmissionRegisterTable({
  schoolId,
  schoolDomain,
  schoolName = "Greenwood Academy",
  onStatsUpdate,
}: AdmissionRegisterTableProps) {
  const { session } = useSession();
  const [records, setRecords] = useState<AdmissionRegisterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedRecord, setSelectedRecord] = useState<AdmissionRegisterRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Resolve active tenant ID from auth session, localStorage, or props
  const getEffectiveTenantId = useCallback(() => {
    if (typeof window !== "undefined") {
      const localTenant =
        localStorage.getItem("tenantId") ||
        localStorage.getItem("schoolId") ||
        sessionStorage.getItem("tenantId") ||
        sessionStorage.getItem("schoolId");
      if (localTenant) return localTenant;
    }
    return session?.schoolId || session?.tenantId || schoolId || schoolDomain;
  }, [session, schoolId, schoolDomain]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = getEffectiveTenantId();
      const statusParam = "new,docs_pending,admitted";
      const url = `/api/v1/admissions?status=${statusParam}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to fetch admissions`);
      }

      const json = await res.json();
      const data: AdmissionRegisterRecord[] = json.data || [];
      setRecords(data);

      if (onStatsUpdate) {
        onStatsUpdate({
          total: data.length,
          newCount: data.filter((r) => r.status === "new").length,
          docsPendingCount: data.filter((r) => r.status === "docs_pending" || r.status === "under_review").length,
          admittedCount: data.filter((r) => r.status === "admitted").length,
        });
      }
    } catch (err: any) {
      console.error("[AdmissionRegisterTable] Fetch error:", err);
      setError(err.message || "Failed to load admission register records");
    } finally {
      setLoading(false);
    }
  }, [getEffectiveTenantId, onStatsUpdate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Action Handlers
  const handleVerifyDocs = async (id: string) => {
    setActionLoadingId(id);
    setActionMessage(null);
    try {
      const tenantId = getEffectiveTenantId();
      const res = await fetch(`/api/v1/admissions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          status: "docs_pending",
          verifiedBy: "Admissions Officer",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      setActionMessage({ type: "success", text: "Applicant credentials marked for document verification." });
      await fetchRecords();
      if (selectedRecord?.id === id) {
        setSelectedRecord(data.data);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Error verifying documents" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdmit = async (id: string) => {
    setActionLoadingId(id);
    setActionMessage(null);
    try {
      const tenantId = getEffectiveTenantId();
      const res = await fetch(`/api/v1/admissions/${id}/admit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          verifiedBy: "Admissions Officer",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to admit applicant");

      setActionMessage({
        type: "success",
        text: `Applicant admitted successfully! Matriculation record created.`,
      });
      await fetchRecords();
      if (selectedRecord?.id === id && data.data?.admissionRegister) {
        setSelectedRecord(data.data.admissionRegister);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Error admitting applicant" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    setActionMessage(null);
    try {
      const tenantId = getEffectiveTenantId();
      const res = await fetch(`/api/v1/admissions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          status: "rejected",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject applicant");

      setActionMessage({ type: "success", text: "Application marked as rejected." });
      await fetchRecords();
      if (selectedRecord?.id === id) {
        setSelectedRecord(data.data);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Error rejecting application" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRequestDocs = async (record: AdmissionRegisterRecord) => {
    setActionLoadingId(record.id);
    setActionMessage(null);
    try {
      if (typeof window !== "undefined") {
        const url = `${window.location.origin}/${schoolDomain}/admissions/track/${record.applicationNo}`;
        navigator.clipboard.writeText(url);
      }

      const res = await requestApplicantDocsAction({
        admissionId: record.id,
        applicationNo: record.applicationNo,
        schoolId,
        schoolDomain,
        recipientEmail: record.email || undefined,
      });

      if (res && res.success) {
        setActionMessage({
          type: "success",
          text: `Document request email successfully dispatched to ${res.recipientEmail || record.email || "applicant"}! Link copied to clipboard.`,
        });
        await fetchRecords();
        if (selectedRecord?.id === record.id) {
          setSelectedRecord((prev) => (prev ? { ...prev, status: "docs_pending" } : null));
        }
      } else {
        setActionMessage({
          type: "error",
          text: res?.error || "Failed to dispatch request email. Upload link was copied to clipboard.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Error requesting documents.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDrawer = (record: AdmissionRegisterRecord) => {
    setSelectedRecord(record);
    setIsDrawerOpen(true);
  };

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            new
          </span>
        );
      case "docs_pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            docs_pending
          </span>
        );
      case "docs_submitted":
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-2xs">
            <FileCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            docs_submitted
          </span>
        );
      case "admitted":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            admitted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
            <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
            {status}
          </span>
        );
    }
  };

  // Filtered Records
  const filteredRecords = records.filter((r) => {
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      r.applicationNo.toLowerCase().includes(query) ||
      r.classApplied.toLowerCase().includes(query) ||
      (r.parentPhone && r.parentPhone.includes(query));

    const matchesStatus =
      statusFilter === "ALL" ||
      r.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* ACTION MESSAGE TOAST / BANNER */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold transition shadow-xs ${
            actionMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SEARCH & CONTROLS TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search application no, name, class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-zinc-200 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 shadow-2xs focus:outline-indigo-500"
            >
              <option value="ALL">All Statuses ({records.length})</option>
              <option value="new">New ({records.filter((r) => r.status === "new").length})</option>
              <option value="docs_pending">Docs Pending ({records.filter((r) => r.status === "docs_pending").length})</option>
              <option value="docs_submitted">Docs Submitted ({records.filter((r) => r.status === "docs_submitted" || r.status === "under_review").length})</option>
              <option value="admitted">Admitted ({records.filter((r) => r.status === "admitted").length})</option>
              <option value="rejected">Rejected ({records.filter((r) => r.status === "rejected").length})</option>
            </select>
          </div>

          <button
            onClick={() => fetchRecords()}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition shadow-2xs"
            title="Refresh Table"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ADMISSION REGISTER DATA TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4">Application No</th>
                <th className="py-3.5 px-4">Applicant Name</th>
                <th className="py-3.5 px-4">Class Applied</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading verified admission register...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-rose-500">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-bold">{error}</p>
                    <button
                      onClick={() => fetchRecords()}
                      className="mt-3 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 dark:text-zinc-400">No Admission Records Found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchQuery
                        ? "Try adjusting your search or status filter."
                        : "Prospective applicants submitted via the application portal will be recorded here permanently."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isActionLoading = actionLoadingId === record.id;
                  const isAdmitted = record.status.toLowerCase() === "admitted";

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition group"
                    >
                      {/* APPLICATION NO */}
                      <td className="py-4 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{record.applicationNo}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(record.applicationNo);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition"
                            title="Copy Application Number"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* APPLICANT NAME */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                          <span>
                            {record.firstName} {record.lastName}
                          </span>
                        </div>
                        {record.email && (
                          <span className="text-[11px] text-slate-400 block font-normal">
                            {record.email}
                          </span>
                        )}
                      </td>

                      {/* CLASS APPLIED */}
                      <td className="py-4 px-4 font-semibold text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{record.classApplied}</span>
                        </div>
                      </td>

                      {/* STATUS BADGE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {renderStatusBadge(record.status)}
                      </td>

                      {/* CREATED AT */}
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {new Date(record.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* VIEW (DRAWER) */}
                          <button
                            onClick={() => openDrawer(record)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                            title="View Applicant Dossier"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>View</span>
                          </button>

                          {/* VERIFY DOCS */}
                          {record.status !== "docs_pending" && !isAdmitted && (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleVerifyDocs(record.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                              title="Mark Documents Pending / Verified"
                            >
                              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Verify Docs</span>
                            </button>
                          )}

                          {/* ACTION BUTTON: REQUEST DOCS vs ADMIT */}
                          {record.status.toLowerCase() === "docs_pending" || record.status.toLowerCase() === "new" ? (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleRequestDocs(record)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                              title="Copy document upload tracking link"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>Request Docs</span>
                            </button>
                          ) : (record.status.toLowerCase() === "docs_submitted" || record.status.toLowerCase() === "approved") ? (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleAdmit(record.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition shadow-2xs flex items-center gap-1 hover:shadow-xs"
                              title="Admit applicant and create enrolled student record"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Admit</span>
                            </button>
                          ) : isAdmitted ? (
                            <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Enrolled</span>
                            </span>
                          ) : null}

                          {/* REJECT */}
                          {record.status !== "rejected" && !isAdmitted && (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleReject(record.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                              title="Reject Application"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPLICANT DOSSIER DRAWER */}
      <AdmissionRegisterDrawer
        applicant={selectedRecord}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onVerifyDocs={handleVerifyDocs}
        onAdmit={handleAdmit}
        onReject={handleReject}
        schoolName={schoolName}
        schoolDomain={schoolDomain}
      />
    </div>
  );
}
