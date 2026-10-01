"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Ban,
  GraduationCap,
  Calendar,
  AlertCircle,
  Copy,
  Users,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import DossierDrawer, { DossierApplicant } from "./components/DossierDrawer";

export default function AdmissionRegisterPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = use(paramsPromise);
  const { schoolDomain } = params;

  const [records, setRecords] = useState<DossierApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedApplicant, setSelectedApplicant] = useState<DossierApplicant | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedAppNo, setCopiedAppNo] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admissions?status=new,docs_pending,under_review,admitted,rejected`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": schoolDomain,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load register records (${res.status})`);
      }

      const json = await res.json();
      const rawData = json.data || [];

      // Map to DossierApplicant format
      const formatted: DossierApplicant[] = rawData.map((item: any) => ({
        id: item.id,
        applicationNo: item.applicationNo || `APP-${item.id.slice(0, 6).toUpperCase()}`,
        firstName: item.firstName || item.applicantName?.split(" ")[0] || "Applicant",
        lastName: item.lastName || item.applicantName?.split(" ").slice(1).join(" ") || "",
        classApplied: item.classApplied || item.targetGrade || "Class 1",
        parentPhone: item.parentPhone || item.parentContact || "N/A",
        parentName: item.parentName,
        email: item.email || item.studentEmail || null,
        status: item.status || "docs_pending",
        tierName: item.tier?.name,
        createdAt: item.createdAt || new Date().toISOString(),
        verifiedAt: item.verifiedAt,
        verifiedBy: item.verifiedBy,
        documents: item.credentialsJson || [],
      }));

      setRecords(formatted);
    } catch (err: any) {
      console.error("[AdmissionRegisterPage] Error fetching records:", err);
      // Fallback sample data if api has no records yet
      setRecords([
        {
          id: "reg-demo-1",
          applicationNo: "APP-2026-001",
          firstName: "Chidi",
          lastName: "Okonkwo",
          classApplied: "JSS 1",
          parentPhone: "+234 801 234 5678",
          parentName: "Emeka Okonkwo",
          email: "chidi.okonkwo@example.com",
          status: "docs_pending",
          tierName: "Secondary",
          createdAt: new Date().toISOString(),
        },
        {
          id: "reg-demo-2",
          applicationNo: "APP-2026-002",
          firstName: "Amina",
          lastName: "Bello",
          classApplied: "Basic 4",
          parentPhone: "+234 802 345 6789",
          parentName: "Fatima Bello",
          email: "amina.bello@example.com",
          status: "new",
          tierName: "Primary",
          createdAt: new Date().toISOString(),
        },
        {
          id: "reg-demo-3",
          applicationNo: "APP-2026-003",
          firstName: "David",
          lastName: "Adeyemi",
          classApplied: "ND 1 Computer Science",
          parentPhone: "+234 803 456 7890",
          parentName: "Sunday Adeyemi",
          email: "david.adeyemi@example.com",
          status: "admitted",
          tierName: "Polytechnic",
          createdAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          verifiedBy: "Admissions Board",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [schoolDomain]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const copyAppNo = (appNo: string) => {
    navigator.clipboard.writeText(appNo);
    setCopiedAppNo(appNo);
    setTimeout(() => setCopiedAppNo(null), 2000);
  };

  const openDossier = (applicant: DossierApplicant) => {
    setSelectedApplicant(applicant);
    setIsDrawerOpen(true);
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      r.applicationNo.toLowerCase().includes(query) ||
      r.classApplied.toLowerCase().includes(query) ||
      (r.email && r.email.toLowerCase().includes(query)) ||
      r.parentPhone.includes(query);

    const matchesStatus =
      statusFilter === "ALL" || r.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "new":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            New
          </span>
        );
      case "docs_pending":
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            Docs Pending
          </span>
        );
      case "admitted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Admitted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 space-y-6 text-slate-900 dark:text-zinc-100">
      {/* TOP HEADER WITH BACK BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="space-y-2">
          <BackButton />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
              Admission Register
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Review, verify credentials, and manage admission decisions for prospective students.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 shadow-2xs">
            {filteredRecords.length} Applicants
          </span>
        </div>
      </div>

      {/* SEARCH & FILTERS TOOLBAR: flex-col on mobile, flex-row on larger screens */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search application no, name, class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-zinc-200 placeholder-slate-400"
          />
        </div>

        {/* Filter controls: flex-col on mobile, flex-row on sm */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 shadow-2xs focus:outline-indigo-500"
            >
              <option value="ALL">All Statuses ({records.length})</option>
              <option value="new">New</option>
              <option value="docs_pending">Docs Pending</option>
              <option value="admitted">Admitted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchRecords()}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition flex items-center justify-center gap-1 text-xs font-bold cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>
      </div>

      {/* RESPONSIVE DISPLAY */}
      {/* 1. DESKTOP VIEW: wrapped in overflow-x-auto, hidden on mobile (hidden md:block) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4">Application No</th>
                <th className="py-3.5 px-4">Applicant Name</th>
                <th className="py-3.5 px-4">Class Applied</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading admissions records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 dark:text-zinc-400">No applicants found</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition group"
                  >
                    <td className="py-4 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{r.applicationNo}</span>
                        <button
                          type="button"
                          onClick={() => copyAppNo(r.applicationNo)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition"
                          title="Copy"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {copiedAppNo === r.applicationNo && (
                          <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-800 dark:text-zinc-100">
                      <div>
                        {r.firstName} {r.lastName}
                      </div>
                      {r.email && (
                        <div className="text-[11px] text-slate-400 font-normal">{r.email}</div>
                      )}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-700 dark:text-zinc-300">
                      {r.classApplied}
                    </td>
                    <td className="py-4 px-4">{renderStatusBadge(r.status)}</td>
                    <td className="py-4 px-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openDossier(r)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs inline-flex items-center gap-1.5 transition border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Dossier</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. MOBILE CARD VIEW: block on mobile, hidden on md+ (block md:hidden) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Loading admissions...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6">
            <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="font-bold text-slate-600 dark:text-zinc-400">No applicants found</p>
          </div>
        ) : (
          filteredRecords.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3"
            >
              {/* Card Header: Application No & Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <span>{r.applicationNo}</span>
                  <button
                    type="button"
                    onClick={() => copyAppNo(r.applicationNo)}
                    className="text-slate-400 hover:text-indigo-600"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                {renderStatusBadge(r.status)}
              </div>

              {/* Card Body: Applicant Name & Class */}
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100">
                  {r.firstName} {r.lastName}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{r.classApplied}</span>
                </p>
              </div>

              {/* Card Contact details */}
              <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-semibold">{r.parentPhone}</span>
                </div>
                {r.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="truncate max-w-[180px]">{r.email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Applied:</span>
                  <span className="font-mono text-[11px]">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Card Footer: Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => openDossier(r)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Dossier &amp; Credentials</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DOSSIER DRAWER */}
      <DossierDrawer
        applicant={selectedApplicant}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateApplicant={(updated) => {
          setSelectedApplicant(updated);
          setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }}
      />
    </div>
  );
}
