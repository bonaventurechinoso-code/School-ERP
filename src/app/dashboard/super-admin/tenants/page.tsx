"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Search,
  Plus,
  Download,
  Eye,
  Power,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import {
  INITIAL_SCHOOLS,
  INITIAL_PROOFS,
  SchoolTenant,
  BankTransferProof,
  PlanTier,
  SubscriptionStatus,
} from "../mock-data";

export default function TenantsDirectoryPage() {
  const [schools, setSchools] = useState<SchoolTenant[]>(INITIAL_SCHOOLS);
  const [proofs, setProofs] = useState<BankTransferProof[]>(INITIAL_PROOFS);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [schoolToSuspend, setSchoolToSuspend] = useState<SchoolTenant | null>(null);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolTenant | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [verifyingProof, setVerifyingProof] = useState<BankTransferProof | null>(null);
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);

  // Add School Form
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolCode, setNewSchoolCode] = useState("");
  const [newSchoolSubdomain, setNewSchoolSubdomain] = useState("");
  const [newSchoolTier, setNewSchoolTier] = useState<PlanTier>("Basic");
  const [newSchoolStudents, setNewSchoolStudents] = useState("300");
  const [newSchoolEmail, setNewSchoolEmail] = useState("");
  const [newSchoolAdmin, setNewSchoolAdmin] = useState("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.adminName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTier = tierFilter === "All" || s.tier === tierFilter;
      const matchStatus = statusFilter === "All" || s.subscriptionStatus === statusFilter;
      return matchSearch && matchTier && matchStatus;
    });
  }, [schools, searchQuery, tierFilter, statusFilter]);

  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage) || 1;
  const paginatedSchools = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSchools.slice(start, start + itemsPerPage);
  }, [filteredSchools, currentPage]);

  const handleToggleSuspend = () => {
    if (!schoolToSuspend) return;
    const isCurrentlySuspended = schoolToSuspend.subscriptionStatus === "Suspended";
    const newStatus: SubscriptionStatus = isCurrentlySuspended ? "Active" : "Suspended";

    setSchools((prev) =>
      prev.map((s) =>
        s.id === schoolToSuspend.id
          ? {
              ...s,
              subscriptionStatus: newStatus,
              planStatus: isCurrentlySuspended ? "Active" : "Suspended",
            }
          : s
      )
    );

    triggerToast(
      `${schoolToSuspend.name} has been ${isCurrentlySuspended ? "reactivated" : "suspended"}.`
    );
    setSchoolToSuspend(null);
  };

  const handleDeleteSchool = () => {
    if (!schoolToDelete) return;
    if (deleteConfirmationInput.trim() !== schoolToDelete.name) {
      triggerToast("Confirmation name does not match. Deletion aborted.");
      return;
    }

    setSchools((prev) => prev.filter((s) => s.id !== schoolToDelete.id));
    triggerToast(`Tenant ${schoolToDelete.name} permanently deleted.`);
    setSchoolToDelete(null);
    setDeleteConfirmationInput("");
  };

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
    triggerToast(`Bank transfer ${proof.referenceId} rejected.`);
  };

  const handleCreateSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName || !newSchoolCode) {
      triggerToast("Please provide school name and code.");
      return;
    }

    const newTenant: SchoolTenant = {
      id: `sch-${Date.now()}`,
      name: newSchoolName.trim(),
      code: newSchoolCode.trim().toUpperCase(),
      subdomain: newSchoolSubdomain.trim().toLowerCase() || newSchoolCode.toLowerCase(),
      tier: newSchoolTier,
      studentsCount: parseInt(newSchoolStudents, 10) || 100,
      planStatus: "Active",
      subscriptionStatus: "Active",
      monthlyRevenue:
        newSchoolTier === "Enterprise"
          ? 350000
          : newSchoolTier === "Premium"
          ? 150000
          : newSchoolTier === "Basic"
          ? 75000
          : 0,
      contactEmail: newSchoolEmail || "admin@school.ng",
      contactPhone: "+234 800 000 0000",
      joinedDate: "Just now",
      adminName: newSchoolAdmin || "School Administrator",
    };

    setSchools([newTenant, ...schools]);
    setIsAddSchoolOpen(false);
    setNewSchoolName("");
    setNewSchoolCode("");
    setNewSchoolSubdomain("");
    setNewSchoolEmail("");
    setNewSchoolAdmin("");
    triggerToast(`School ${newTenant.name} registered and provisioned!`);
  };

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["School Name,Code,Subdomain,Tier,Students,Subscription Status,Monthly Revenue,Email"]
        .concat(
          schools.map(
            (s) =>
              `"${s.name}","${s.code}","${s.subdomain}","${s.tier}",${s.studentsCount},"${s.subscriptionStatus}",${s.monthlyRevenue},"${s.contactEmail}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `school_tenants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("Tenants CSV exported successfully!");
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
              Tenants & School Institutions
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {schools.length} Registered
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Complete database of tenant organizations, isolated databases, domain mappings, and subscriptions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddSchoolOpen(true)}
            className="bg-slate-950 hover:bg-slate-800 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Register School</span>
          </button>
        </div>
      </div>

      {/* Top Stats summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Active Tenants</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            {schools.filter((s) => s.subscriptionStatus === "Active").length}
          </div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Pending Proofs</div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
            {schools.filter((s) => s.subscriptionStatus === "Pending Verification").length}
          </div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Suspended</div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
            {schools.filter((s) => s.subscriptionStatus === "Suspended").length}
          </div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Enrolled</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {schools.reduce((acc, curr) => acc + curr.studentsCount, 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 sm:p-6 border-b border-slate-200/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="relative flex-1 w-full lg:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by name, code, subdomain, or admin..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Tier:</span>
              <select
                value={tierFilter}
                onChange={(e) => {
                  setTierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none text-xs"
              >
                <option value="All">All Tiers</option>
                <option value="Free">Free</option>
                <option value="Basic">Basic</option>
                <option value="Premium">Premium</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none text-xs"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending Verification">Pending</option>
                <option value="Suspended">Suspended</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">School & Code</th>
                <th className="py-3.5 px-4">Subdomain</th>
                <th className="py-3.5 px-4">Plan Tier</th>
                <th className="py-3.5 px-4">Students</th>
                <th className="py-3.5 px-4">Subscription Status</th>
                <th className="py-3.5 px-4 text-right">Monthly Rev</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSchools.length > 0 ? (
                paginatedSchools.map((school) => {
                  const isSuspended = school.subscriptionStatus === "Suspended";
                  const isPending = school.subscriptionStatus === "Pending Verification";
                  const tenantSlug = school.code.toLowerCase();

                  return (
                    <tr
                      key={school.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSuspended ? "bg-rose-50/30" : ""
                      }`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                            {school.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/super-admin/tenants/${tenantSlug}`}
                              className="font-bold text-slate-900 hover:text-blue-600 transition-colors block"
                            >
                              {school.name}
                            </Link>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                              <span>{school.code}</span>
                              <span>•</span>
                              <span>{school.adminName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono text-xs text-slate-600">
                        <a
                          href={`https://${school.subdomain}.schoolerp.com`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-blue-600 hover:underline"
                        >
                          {school.subdomain}.schoolerp.com
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-block text-xs font-bold px-2.5 py-1 rounded-md border ${
                            school.tier === "Enterprise"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : school.tier === "Premium"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : school.tier === "Basic"
                              ? "bg-slate-100 text-slate-700 border-slate-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {school.tier}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-semibold text-slate-700">
                        {school.studentsCount.toLocaleString()}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            school.subscriptionStatus === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : school.subscriptionStatus === "Pending Verification"
                              ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                              : school.subscriptionStatus === "Suspended"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              school.subscriptionStatus === "Active"
                                ? "bg-emerald-500"
                                : school.subscriptionStatus === "Pending Verification"
                                ? "bg-amber-500"
                                : school.subscriptionStatus === "Suspended"
                                ? "bg-rose-500"
                                : "bg-slate-400"
                            }`}
                          ></span>
                          {school.subscriptionStatus}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right font-mono text-xs font-bold text-slate-900">
                        ₦{school.monthlyRevenue.toLocaleString()}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              type="button"
                              title="Verify Bank Transfer"
                              onClick={() => {
                                const matchingProof = proofs.find(
                                  (p) => p.schoolId === school.id || p.schoolCode === school.code
                                ) || {
                                  id: `proof-${Date.now()}`,
                                  schoolId: school.id,
                                  schoolName: school.name,
                                  schoolCode: school.code,
                                  amount: school.monthlyRevenue || 150000,
                                  referenceId: "TRX-MANUAL-VERIFY",
                                  bankName: "Direct Deposit (Nigeria)",
                                  uploadedAt: "Recent",
                                  planRequested: school.tier,
                                  depositorName: school.adminName,
                                  proofImageUrl:
                                    school.paymentProofUrl ||
                                    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
                                  status: "Pending",
                                };
                                setVerifyingProof(matchingProof);
                              }}
                              className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          )}

                          <Link
                            href={`/dashboard/super-admin/tenants/${tenantSlug}`}
                            title="View School Details"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors inline-flex items-center justify-center"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            title={isSuspended ? "Reactivate School" : "Suspend School Access"}
                            onClick={() => setSchoolToSuspend(school)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isSuspended
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-slate-200 hover:bg-amber-50 text-slate-600 hover:text-amber-700"
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="Delete School Tenant"
                            onClick={() => {
                              setSchoolToDelete(school);
                              setDeleteConfirmationInput("");
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No schools match the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (lg:hidden) */}
        <div className="lg:hidden p-4 space-y-3.5 divide-y divide-slate-100">
          {paginatedSchools.length > 0 ? (
            paginatedSchools.map((school) => {
              const isSuspended = school.subscriptionStatus === "Suspended";
              const isPending = school.subscriptionStatus === "Pending Verification";
              const tenantSlug = school.code.toLowerCase();

              return (
                <div key={school.id} className="pt-3.5 first:pt-0 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                        {school.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/dashboard/super-admin/tenants/${tenantSlug}`}
                          className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors block"
                        >
                          {school.name}
                        </Link>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {school.code} • {school.studentsCount} students
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        school.tier === "Enterprise"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : school.tier === "Premium"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : school.tier === "Basic"
                          ? "bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {school.tier}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-500">
                      Status:{" "}
                      <span
                        className={`font-semibold ${
                          isSuspended
                            ? "text-rose-600"
                            : isPending
                            ? "text-amber-600 font-bold"
                            : "text-emerald-600"
                        }`}
                      >
                        {school.subscriptionStatus}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      ₦{school.monthlyRevenue.toLocaleString()}/mo
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Link
                      href={`/dashboard/super-admin/tenants/${tenantSlug}`}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </Link>

                    <button
                      type="button"
                      onClick={() => setSchoolToSuspend(school)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isSuspended
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {isSuspended ? "Reactivate" : "Suspend"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSchoolToDelete(school);
                        setDeleteConfirmationInput("");
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No schools match the filter criteria.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing{" "}
            <span className="font-bold">
              {filteredSchools.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-bold">
              {Math.min(filteredSchools.length, currentPage * itemsPerPage)}
            </span>{" "}
            of <span className="font-bold">{filteredSchools.length}</span> schools
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 font-medium inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="px-2 font-mono font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 font-medium inline-flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {schoolToSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              {schoolToSuspend.subscriptionStatus === "Suspended"
                ? "Reactivate School Access"
                : "Suspend School Access"}
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {schoolToSuspend.subscriptionStatus === "Suspended"
                ? `Are you sure you want to reactivate ${schoolToSuspend.name}? All students, teachers, and admins will immediately regain access.`
                : `Are you sure you want to suspend ${schoolToSuspend.name}? All staff, students, and parent portals for this school will be locked out immediately.`}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSchoolToSuspend(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleSuspend}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-colors ${
                  schoolToSuspend.subscriptionStatus === "Suspended"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {schoolToSuspend.subscriptionStatus === "Suspended"
                  ? "Confirm Reactivation"
                  : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {schoolToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-2xl border border-rose-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Delete School Tenant Permanently</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              This action <span className="font-bold text-rose-600">CANNOT BE UNDONE</span>. This
              will erase database records, student enrollments, exam results, and bursar ledger entries
              for <span className="font-bold">{schoolToDelete.name}</span>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type <span className="font-mono text-rose-600 font-bold">{schoolToDelete.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="Type school name exactly..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSchoolToDelete(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationInput.trim() !== schoolToDelete.name}
                onClick={handleDeleteSchool}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Permanently Erase Tenant
              </button>
            </div>
          </div>
        </div>
      )}

      {verifyingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
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
                <div className="h-40 w-full bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-300">
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

      {isAddSchoolOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[95vw] sm:max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Register New School Tenant</h3>
              <button
                type="button"
                onClick={() => setIsAddSchoolOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchool} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Institution Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corona International Secondary School"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">School Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CIS009"
                    value={newSchoolCode}
                    onChange={(e) => setNewSchoolCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subdomain Slug</label>
                  <input
                    type="text"
                    placeholder="e.g. corona"
                    value={newSchoolSubdomain}
                    onChange={(e) => setNewSchoolSubdomain(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs lowercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plan Tier</label>
                  <select
                    value={newSchoolTier}
                    onChange={(e) => setNewSchoolTier(e.target.value as PlanTier)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  >
                    <option value="Free">Free Trial</option>
                    <option value="Basic">Basic (₦75k/term)</option>
                    <option value="Premium">Premium (₦150k/term)</option>
                    <option value="Enterprise">Enterprise (₦350k/term)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Capacity</label>
                  <input
                    type="number"
                    value={newSchoolStudents}
                    onChange={(e) => setNewSchoolStudents(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Admin Email</label>
                  <input
                    type="email"
                    placeholder="admin@school.ng"
                    value={newSchoolEmail}
                    onChange={(e) => setNewSchoolEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Admin Name</label>
                  <input
                    type="text"
                    placeholder="Dr. John Doe"
                    value={newSchoolAdmin}
                    onChange={(e) => setNewSchoolAdmin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSchoolOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-950 text-white rounded-xl font-bold hover:bg-slate-800"
                >
                  Create & Provision Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
