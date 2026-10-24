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
  ShieldCheck,
  Lock,
  GitMerge,
  ArrowRight,
  Layers,
  Check,
} from "lucide-react";
import AdmissionRegisterDrawer from "./AdmissionRegisterDrawer";
import { requestApplicantDocsAction, checkDuplicateAction, mergeDuplicateAction } from "./actions";
import { isAdmissionsAuthorized } from "@/lib/admissions-rbac";
import {
  AdmissionRegisterRecord,
  DuplicateCheckMatch,
  AdmissionStatus,
} from "@/lib/admissions.types";
import { getApplicantDocsSummary } from "@/lib/admissions-docs";

export type { AdmissionRegisterRecord };

interface AdmissionRegisterTableProps {
  schoolId: string;
  schoolDomain: string;
  schoolName?: string;
  canMutate?: boolean;
  onStatsUpdate?: (stats: { total: number; newCount: number; docsPendingCount: number; admittedCount: number }) => void;
}

export default function AdmissionRegisterTable({
  schoolId,
  schoolDomain,
  schoolName = "Greenwood Academy",
  canMutate = false,
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
  const [copiedAppNo, setCopiedAppNo] = useState<string | null>(null);

  // Deduplication Modal State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [activeDuplicateScan, setActiveDuplicateScan] = useState<DuplicateCheckMatch | null>(null);
  const [pendingMergeApplicant, setPendingMergeApplicant] = useState<AdmissionRegisterRecord | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // RBAC Permission Profile: Gated strictly via canMutate prop from Server Component checkRouteAuthorization
  const userRole = (session?.role || session?.staffRole || (session as any)?.userRole || (session?.user as any)?.role || "").toUpperCase();
  const isAuthorized = canMutate || isAdmissionsAuthorized(userRole, session?.staffRole);

  // Resolve active tenant ID
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
      const url = `/api/v1/admissions`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          "x-user-role": userRole,
          ...(session?.staffRole ? { "x-staff-role": session.staffRole } : {}),
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
          newCount: data.filter((r) => r.status === "INQUIRY" || r.status === "new").length,
          docsPendingCount: data.filter((r) => r.status === "DOCS_PENDING" || r.status === "docs_pending" || r.status === "under_review").length,
          admittedCount: data.filter((r) => r.status === "CONVERTED" || r.status === "admitted" || r.status === "APPROVED" || r.status === "approved").length,
        });
      }
    } catch (err: any) {
      console.error("[AdmissionRegisterTable] Fetch error:", err);
      setError(err.message || "Failed to load admission register records");
    } finally {
      setLoading(false);
    }
  }, [getEffectiveTenantId, onStatsUpdate, userRole, session?.staffRole]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Action Handlers with Strict RBAC Checks
  const handleVerifyDocs = async (id: string) => {
    if (!isAuthorized) {
      setActionMessage({
        type: "error",
        text: "Access Denied: Only authorized Registrar, Admissions Officer, or Superadmin can verify documents.",
      });
      return;
    }

    setActionLoadingId(id);
    setActionMessage(null);
    try {
      const tenantId = getEffectiveTenantId();
      const res = await fetch(`/api/v1/admissions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          "x-user-role": userRole,
          ...(session?.staffRole ? { "x-staff-role": session.staffRole } : {}),
        },
        body: JSON.stringify({
          status: "VERIFIED",
          verifiedBy: session?.name || "Admissions Officer",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to verify documents (HTTP ${res.status})`);
      }

      const data = await res.json();
      setActionMessage({
        type: "success",
        text: "Applicant status updated to VERIFIED. All KYC documents confirmed.",
      });

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
    if (!isAuthorized) {
      setActionMessage({
        type: "error",
        text: "Access Denied: Only authorized Registrar, Admissions Officer, or Superadmin can matriculate students.",
      });
      return;
    }

    setActionLoadingId(id);
    setActionMessage(null);
    try {
      const tenantId = getEffectiveTenantId();
      const res = await fetch(`/api/v1/admissions/${id}/admit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          "x-user-role": userRole,
          ...(session?.staffRole ? { "x-staff-role": session.staffRole } : {}),
        },
        body: JSON.stringify({
          verifiedBy: session?.name || "Admissions Officer",
          status: "CONVERTED",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to admit applicant (HTTP ${res.status})`);
      }

      setActionMessage({
        type: "success",
        text: "Applicant successfully converted to student record and matriculated. Audit trail preserved.",
      });

      await fetchRecords();
      setIsDrawerOpen(false);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Error admitting applicant" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!isAuthorized) {
      setActionMessage({
        type: "error",
        text: "Access Denied: Only authorized Registrar, Admissions Officer, or Superadmin can reject applications.",
      });
      return;
    }

    setActionLoadingId(id);
    setActionMessage(null);
    try {
      const tenantId = getEffectiveTenantId();
      const res = await fetch(`/api/v1/admissions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          "x-user-role": userRole,
          ...(session?.staffRole ? { "x-staff-role": session.staffRole } : {}),
        },
        body: JSON.stringify({
          status: "REJECTED",
          verifiedBy: session?.name || "Admissions Officer",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to reject applicant (HTTP ${res.status})`);
      }

      const data = await res.json();
      setActionMessage({
        type: "success",
        text: "Application file marked as REJECTED. Historical records retained for audit.",
      });

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

  const handleScanDuplicate = async (record: AdmissionRegisterRecord) => {
    setActionLoadingId(record.id);
    try {
      const tenantId = getEffectiveTenantId();
      const fullName = `${record.firstName} ${record.lastName}`.trim();
      const dupResult = await checkDuplicateAction({
        schoolId: tenantId,
        name: fullName,
        phone: record.parentPhone,
        email: record.email || undefined,
      });

      if (dupResult.isDuplicate && (dupResult.existingRegister || dupResult.existingLead)) {
        setActiveDuplicateScan(dupResult);
        setPendingMergeApplicant(record);
        setIsDuplicateModalOpen(true);
      } else {
        setActionMessage({
          type: "success",
          text: `Anti-Duplicate Scan Pass: No duplicates detected for ${fullName}.`,
        });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to scan for duplicates" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMergeData = async () => {
    if (!pendingMergeApplicant || !activeDuplicateScan?.existingRegister) {
      setIsDuplicateModalOpen(false);
      return;
    }

    setIsMerging(true);
    try {
      const res = await mergeDuplicateAction({
        existingRegisterId: activeDuplicateScan.existingRegister.id,
        incomingData: {
          firstName: pendingMergeApplicant.firstName,
          lastName: pendingMergeApplicant.lastName,
          classApplied: pendingMergeApplicant.classApplied,
          parentPhone: pendingMergeApplicant.parentPhone,
          email: pendingMergeApplicant.email || undefined,
          formFeePaid: pendingMergeApplicant.formFeePaid,
        },
        schoolId,
        schoolDomain,
      });

      if (res && res.success) {
        setActionMessage({
          type: "success",
          text: `Successfully merged incoming data into active record ${activeDuplicateScan.existingRegister.applicationNo}. Zero data fracturing.`,
        });
        await fetchRecords();
        setIsDuplicateModalOpen(false);
      } else {
        setActionMessage({
          type: "error",
          text: res?.error || "Failed to merge duplicate entries.",
        });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Error merging data" });
    } finally {
      setIsMerging(false);
    }
  };

  const openDrawer = (record: AdmissionRegisterRecord) => {
    setSelectedRecord(record);
    setIsDrawerOpen(true);
  };

  const handleCopy = (text: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedAppNo(text);
      setTimeout(() => setCopiedAppNo(null), 2000);
    }
  };

  /**
   * Color System Specification:
   * INQUIRY = slate
   * DOCS_PENDING = amber
   * VERIFIED = blue
   * APPROVED = emerald
   * REJECTED = rose
   * CONVERTED = violet
   */
  const renderStatusBadge = (status: string) => {
    const s = (status || "INQUIRY").toUpperCase();
    if (s === "INQUIRY") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>
          <span>INQUIRY</span>
        </span>
      );
    }
    if (s === "DOCS_PENDING" || s === "NEW" || s === "DOCS_SUBMITTED" || s === "UNDER_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 whitespace-nowrap">
          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>DOCS_PENDING</span>
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 whitespace-nowrap">
          <FileCheck className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>VERIFIED</span>
        </span>
      );
    }
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>APPROVED</span>
        </span>
      );
    }
    if (s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 whitespace-nowrap">
          <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>REJECTED</span>
        </span>
      );
    }
    if (s === "CONVERTED" || s === "ADMITTED" || s === "ENROLLED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-300 dark:border-violet-800 whitespace-nowrap">
          <UserCheck className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0" />
          <span>CONVERTED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 whitespace-nowrap">
        <span>{status}</span>
      </span>
    );
  };

  // Extract canonical 4 docs metadata
  const getDocsSummary = (r: AdmissionRegisterRecord) => {
    return getApplicantDocsSummary(r);
  };

  // Filtered Records
  const filteredRecords = records.filter((r) => {
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      r.applicationNo.toLowerCase().includes(query) ||
      r.classApplied.toLowerCase().includes(query) ||
      (r.parentPhone && r.parentPhone.includes(query));

    const matchesStatus =
      statusFilter === "ALL" ||
      r.status.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 w-full">
      {/* ACTION MESSAGE TOAST / BANNER */}
      {actionMessage && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-bold transition shadow-xs ${
            actionMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="truncate">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs underline ml-3 shrink-0 opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TOOLBAR CONTROLS: Stacks vertically on mobile viewports */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-zinc-100 truncate">
                Admission Register
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                v2.2 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              {filteredRecords.length} profile records in live register
            </p>
          </div>
        </div>

        {/* CONTROLS: Fluid and stacked on small viewports */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          {/* SEARCH BAR */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student, app #, or parent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100"
            />
          </div>

          {/* STATUS FILTER */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold focus:outline-indigo-500 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="INQUIRY">INQUIRY (Slate)</option>
            <option value="DOCS_PENDING">DOCS_PENDING (Amber)</option>
            <option value="VERIFIED">VERIFIED (Blue)</option>
            <option value="APPROVED">APPROVED (Emerald)</option>
            <option value="REJECTED">REJECTED (Rose)</option>
            <option value="CONVERTED">CONVERTED (Violet)</option>
          </select>

          {/* REFRESH */}
          <button
            onClick={() => fetchRecords()}
            disabled={loading}
            className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="whitespace-nowrap">Refresh</span>
          </button>
        </div>
      </div>

      {/* ADAPTIVE TABLE / MOBILE CARDS ARCHITECTURE */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden w-full">
        {loading && records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs sm:text-sm font-semibold">Loading live admission records...</p>
          </div>
        ) : error && records.length === 0 ? (
          <div className="p-12 text-center text-rose-500 space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-bold">{error}</p>
            <button
              onClick={() => fetchRecords()}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition"
            >
              Retry
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">No matching admission records</p>
            <p className="text-xs">Adjust your search query or filters.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            {/* Table layout on desktop, stacked card layout on mobile */}
            <table className="w-full text-left border-collapse text-xs sm:text-sm block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4">Application #</th>
                  <th className="p-4">Candidate &amp; Parent</th>
                  <th className="p-4">Assigned Class</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Docs Status</th>
                  <th className="p-4">Form Fee</th>
                  <th className="p-4">Lead Source</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="block md:table-row-group p-3 sm:p-4 md:p-0 space-y-4 md:space-y-0 divide-y-0 md:divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredRecords.map((r) => {
                  const isActionLoading = actionLoadingId === r.id;
                  const docsSummary = getDocsSummary(r);
                  const isFeePaid = Boolean(
                    r.formFeePaid ||
                    (typeof r.credentialsJson === "object" && r.credentialsJson?.formFeePaid)
                  );
                  const isConverted = Boolean(
                    r.convertedFromLead ||
                    (typeof r.credentialsJson === "object" && r.credentialsJson?.convertedFromLead)
                  );

                  return (
                    <tr
                      key={r.id}
                      className="block md:table-row bg-white dark:bg-zinc-900 rounded-2xl md:rounded-none p-4 md:p-4 border border-slate-200 dark:border-zinc-800 md:border-0 shadow-xs md:shadow-none space-y-3 md:space-y-0 hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition"
                    >
                      {/* APPLICATION NUMBER */}
                      <td className="block md:table-cell py-1 md:py-4 px-0 md:px-4 min-w-0">
                        <div className="flex items-center justify-between md:justify-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(r.applicationNo)}
                            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:border-indigo-400 transition cursor-pointer shrink-0"
                            title="Click to copy Application Number"
                          >
                            <span>{r.applicationNo}</span>
                            <Copy className="w-3 h-3 text-slate-400" />
                          </button>
                          {copiedAppNo === r.applicationNo && (
                            <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Copied!</span>
                          )}
                          {/* Mobile-only status badge */}
                          <div className="md:hidden">
                            {renderStatusBadge(r.status)}
                          </div>
                        </div>
                      </td>

                      {/* CANDIDATE & PARENT */}
                      <td className="block md:table-cell py-1 md:py-4 px-0 md:px-4 min-w-0">
                        <button
                          onClick={() => openDrawer(r)}
                          className="font-bold text-slate-800 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-left cursor-pointer truncate break-words block text-xs sm:text-sm"
                        >
                          {r.firstName} {r.lastName}
                        </button>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
                          {r.parentPhone} {r.email ? `• ${r.email}` : ""}
                        </p>
                      </td>

                      {/* ASSIGNED CLASS */}
                      <td className="block md:table-cell py-1 md:py-4 px-0 md:px-4 min-w-0">
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{r.assignedClass || r.classApplied}</span>
                        </div>
                      </td>

                      {/* STATUS (Desktop) */}
                      <td className="hidden md:table-cell py-4 px-4 min-w-0">
                        {renderStatusBadge(r.status)}
                      </td>

                      {/* DOCS STATUS */}
                      <td className="block md:table-cell py-1 md:py-4 px-0 md:px-4 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${
                            docsSummary.status === "verified"
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200"
                              : docsSummary.status === "pending"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-500"
                          }`}
                        >
                          <FileCheck className="w-3 h-3 shrink-0" />
                          <span className="truncate">{docsSummary.label}</span>
                        </span>
                      </td>

                      {/* FORM FEE PAID */}
                      <td className="block md:table-cell py-1 md:py-4 px-0 md:px-4 min-w-0">
                        {isFeePaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Check className="w-3 h-3" /> Fee Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                            <Clock className="w-3 h-3" /> Fee Pending
                          </span>
                        )}
                      </td>

                      {/* LEAD SOURCE / CONVERTED FLAG */}
                      <td className="block md:table-cell py-1 md:py-4 px-0 md:px-4 min-w-0">
                        <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                          {isConverted ? (
                            <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300 font-bold">
                              <GitMerge className="w-3 h-3 shrink-0" /> Converted Lead
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-zinc-500">Direct Register</span>
                          )}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="block md:table-cell py-2 md:py-4 px-0 md:px-4 text-left md:text-right">
                        <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => openDrawer(r)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-xs text-slate-700 dark:text-zinc-300 transition flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Dossier</span>
                          </button>

                          {/* Anti-Duplicate check trigger */}
                          <button
                            type="button"
                            onClick={() => handleScanDuplicate(r)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-xs text-slate-600 dark:text-zinc-400 transition flex items-center gap-1 cursor-pointer shrink-0"
                            title="Run compound key deduplication scan"
                          >
                            <GitMerge className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="hidden sm:inline">Dedupe</span>
                          </button>

                          {/* Mark Verified (Permission-Gated) */}
                          {isAuthorized && r.status !== "VERIFIED" && r.status !== "CONVERTED" && (
                            <button
                              type="button"
                              onClick={() => handleVerifyDocs(r.id)}
                              disabled={isActionLoading}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 font-bold text-xs transition flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>Verify</span>
                            </button>
                          )}

                          {/* Convert to Student (Permission-Gated) */}
                          {isAuthorized && r.status !== "CONVERTED" && (
                            <button
                              type="button"
                              onClick={() => handleAdmit(r.id)}
                              disabled={isActionLoading}
                              className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Convert to Student</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL / DOSSIER DRAWER */}
      <AdmissionRegisterDrawer
        applicant={selectedRecord}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedRecord(null);
        }}
        onVerifyDocs={handleVerifyDocs}
        onAdmit={handleAdmit}
        onReject={handleReject}
        schoolName={schoolName}
        schoolDomain={schoolDomain}
        canMutate={isAuthorized}
      />

      {/* DUPLICATE MERGE MODAL (System Anti-Duplicate Guard) */}
      {isDuplicateModalOpen && activeDuplicateScan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <GitMerge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-zinc-100">
                  Duplicate Candidate Detected
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Compound key scan found an existing profile matching this candidate ({activeDuplicateScan.matchType} match).
                </p>
              </div>
            </div>

            {/* COMPARISON CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Active Existing Record</span>
                <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
                  {activeDuplicateScan.existingRegister
                    ? `${activeDuplicateScan.existingRegister.firstName} ${activeDuplicateScan.existingRegister.lastName}`
                    : activeDuplicateScan.existingLead?.applicantName}
                </p>
                <p className="font-mono text-slate-500">
                  App #: {activeDuplicateScan.existingRegister?.applicationNo || "LEAD-INQUIRY"}
                </p>
                <p className="text-slate-600 dark:text-zinc-300">
                  Phone: {activeDuplicateScan.existingRegister?.parentPhone || activeDuplicateScan.existingLead?.parentContact}
                </p>
                <p className="text-slate-600 dark:text-zinc-300">
                  Status: {activeDuplicateScan.existingRegister?.status || activeDuplicateScan.existingLead?.status}
                </p>
              </div>

              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200/80 dark:border-indigo-800 space-y-2">
                <span className="font-bold text-indigo-500 uppercase tracking-wider text-[10px]">Incoming Candidate Data</span>
                <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
                  {pendingMergeApplicant ? `${pendingMergeApplicant.firstName} ${pendingMergeApplicant.lastName}` : "Incoming Record"}
                </p>
                <p className="font-mono text-slate-500">
                  Class: {pendingMergeApplicant?.classApplied}
                </p>
                <p className="text-slate-600 dark:text-zinc-300">
                  Phone: {pendingMergeApplicant?.parentPhone}
                </p>
                <p className="text-indigo-600 font-bold">
                  Matched via: {activeDuplicateScan.matchedFields?.join(", ") || "Compound key"}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              To prevent data fracturing, merge this payload directly into the active register record. All documents, notes, and contact history will be unified under one application number.
            </p>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                Keep Both as Separate
              </button>
              <button
                type="button"
                onClick={handleMergeData}
                disabled={isMerging}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md"
              >
                {isMerging ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <GitMerge className="w-4 h-4" />
                )}
                <span>Merge Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
