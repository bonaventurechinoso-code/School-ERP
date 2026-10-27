"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Copy,
  Check,
  Eye,
  FileCheck,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  UserCheck,
  Users,
} from "lucide-react";
import AdmissionRegisterDrawer from "./AdmissionRegisterDrawer";
import { enrollApplicantFromRegisterAction } from "./actions";

interface AdmissionRegisterRecord {
  id: string;
  tenantId: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  classApplied: string;
  assignedClass?: string;
  parentPhone: string;
  email?: string;
  credentialsJson?: any;
  status: string;
  verifiedBy?: string;
  verifiedAt?: string;
  admittedAt?: string;
  createdAt: string;
  updatedAt: string;
  formFeePaid?: boolean;
  convertedFromLead?: boolean;
}

export default function AdmissionRegisterTable({
  schoolId,
  schoolDomain,
  schoolName = "Institution Admissions Desk",
  canMutate = false,
}: {
  schoolId: string;
  schoolDomain: string;
  schoolName?: string;
  canMutate?: boolean;
}) {
  const [records, setRecords] = useState<AdmissionRegisterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedAppNo, setCopiedAppNo] = useState<string | null>(null);

  // Drawer state
  const [selectedRecord, setSelectedRecord] = useState<AdmissionRegisterRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Action status message
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admissions?tenantId=${encodeURIComponent(schoolId)}`, {
        headers: {
          "x-tenant-id": schoolId,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.data || [];
        setRecords(data);
      }
    } catch (err) {
      console.error("Failed to load admissions register:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [schoolId]);

  const handleCopy = (text: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedAppNo(text);
      setTimeout(() => setCopiedAppNo(null), 2000);
    }
  };

  // Convert to Student action using enterprise atomic handshake
  const handleAdmit = async (recordId: string) => {
    if (!canMutate) {
      setActionMessage({
        type: "error",
        text: "Access Denied: Only authorized staff can matriculate students.",
      });
      return;
    }

    setActionLoadingId(recordId);
    setActionMessage(null);
    try {
      const res = await enrollApplicantFromRegisterAction({
        registerId: recordId,
        schoolId,
        schoolDomain,
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Applicant enrolled successfully. Matriculation No: ${(res.student as any)?.admissionNumber || "Generated"}`,
        });
        await fetchRecords();
        if (selectedRecord && selectedRecord.id === recordId) {
          setIsDrawerOpen(false);
        }
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to finalize enrollment.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to finalize enrollment.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark Verified
  const handleVerify = async (recordId: string) => {
    if (!canMutate) return;
    setActionLoadingId(recordId);
    try {
      const res = await fetch(`/api/v1/admissions/${recordId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": schoolId,
        },
        body: JSON.stringify({ status: "VERIFIED" }),
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Applicant documents marked as VERIFIED." });
        await fetchRecords();
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Verification failed." });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject
  const handleReject = async (recordId: string) => {
    if (!canMutate) return;
    if (!confirm("Are you sure you want to mark this application as REJECTED?")) return;
    setActionLoadingId(recordId);
    try {
      const res = await fetch(`/api/v1/admissions/${recordId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": schoolId,
        },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Application marked as REJECTED." });
        await fetchRecords();
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Rejection failed." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        r.applicationNo.toLowerCase().includes(q) ||
        (r.parentPhone && r.parentPhone.includes(q)) ||
        (r.classApplied && r.classApplied.toLowerCase().includes(q));

      const s = (r.status || "NEW").toUpperCase();
      const matchesStatus =
        statusFilter === "ALL" ||
        s === statusFilter ||
        (statusFilter === "DOCS_PENDING" && (s === "NEW" || s === "DOCS_SUBMITTED" || s === "UNDER_REVIEW")) ||
        (statusFilter === "CONVERTED" && (s === "ADMITTED" || s === "ENROLLED"));

      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  const renderStatusBadge = (status: string) => {
    const s = (status || "NEW").toUpperCase();
    if (s === "DOCS_PENDING" || s === "NEW" || s === "DOCS_SUBMITTED" || s === "UNDER_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5" />
          <span>Docs Pending</span>
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          <FileCheck className="w-3.5 h-3.5" />
          <span>Verified</span>
        </span>
      );
    }
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approved</span>
        </span>
      );
    }
    if (s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
          <Ban className="w-3.5 h-3.5" />
          <span>Rejected</span>
        </span>
      );
    }
    if (s === "CONVERTED" || s === "ADMITTED" || s === "ENROLLED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <UserCheck className="w-3.5 h-3.5" />
          <span>Enrolled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4 w-full">
      {/* Alert toast message */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between text-xs font-bold ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toolbar: Search + Stage Filter + Refresh */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search live register by candidate, app no, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition text-slate-800 dark:text-zinc-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-zinc-200 shadow-2xs shrink-0"
          >
            <option value="ALL">All Statuses</option>
            <option value="DOCS_PENDING">Docs Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CONVERTED">Enrolled</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchRecords}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition shadow-2xs cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table Container: min-w-[900px] with horizontal overflow to prevent column overlap */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/90 dark:border-zinc-800 shadow-sm overflow-hidden w-full">
        {loading && records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
            <p className="text-xs sm:text-sm font-semibold">Loading live admissions register...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">No matching records found</p>
            <p className="text-xs">Try adjusting your search criteria or filter.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px] text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Parent Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Form Fee</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredRecords.map((r) => {
                  const isFeePaid = Boolean(
                    r.formFeePaid || (typeof r.credentialsJson === "object" && r.credentialsJson?.formFeePaid)
                  );
                  const isActionLoading = actionLoadingId === r.id;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition"
                    >
                      {/* Application # */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCopy(r.applicationNo)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2.5 py-1 rounded-md border border-slate-200 dark:border-zinc-700 hover:border-blue-400 transition cursor-pointer"
                          title="Copy Application Number"
                        >
                          <span>{r.applicationNo}</span>
                          {copiedAppNo === r.applicationNo ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Candidate Name - FULL NAME without truncation */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecord(r);
                            setIsDrawerOpen(true);
                          }}
                          className="font-bold text-slate-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition text-left cursor-pointer text-xs sm:text-sm"
                        >
                          {r.firstName} {r.lastName}
                        </button>
                      </td>

                      {/* Class */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-800 dark:text-zinc-200 font-semibold text-xs">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{r.assignedClass || r.classApplied}</span>
                        </span>
                      </td>

                      {/* Parent Contact */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-600 dark:text-zinc-400">
                        {r.parentPhone}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(r.status)}
                      </td>

                      {/* Form Fee */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isFeePaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <Check className="w-3 h-3" />
                            <span>Paid ✓</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecord(r);
                              setIsDrawerOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 transition cursor-pointer"
                            title="Click to view bank instructions"
                          >
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>Pending</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecord(r);
                              setIsDrawerOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-xs text-slate-700 dark:text-zinc-300 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>Dossier</span>
                          </button>

                          {canMutate && r.status !== "VERIFIED" && r.status !== "ENROLLED" && (
                            <button
                              type="button"
                              onClick={() => handleVerify(r.id)}
                              disabled={isActionLoading}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs transition cursor-pointer"
                            >
                              Verify
                            </button>
                          )}

                          {canMutate && r.status !== "ENROLLED" && (
                            <button
                              type="button"
                              onClick={() => handleAdmit(r.id)}
                              disabled={isActionLoading}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                            >
                              {isActionLoading ? "Enrolling..." : "Convert"}
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

      {/* ADMISSION REGISTER DRAWER */}
      {selectedRecord && (
        <AdmissionRegisterDrawer
          applicant={selectedRecord}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedRecord(null);
          }}
          schoolId={schoolId}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          isAuthorized={canMutate}
          onVerifyDocs={handleVerify}
          onAdmit={handleAdmit}
          onReject={handleReject}
          onRecordUpdated={fetchRecords}
        />
      )}
    </div>
  );
}
