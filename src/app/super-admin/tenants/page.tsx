"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  GraduationCap,
  Search,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  X,
  RotateCcw,
  Activity,
} from "lucide-react";
import RegisterSchoolDrawer from "@/app/admin/tenants/RegisterSchoolDrawer";
import { getTierBadgeConfig } from "@/app/admin/tenants/TenantsConsoleView";

interface AcademicTierData {
  id?: string;
  name: string;
}

export interface SuperAdminTenantRow {
  id: string;
  name: string;
  subdomain: string;
  slug?: string;
  contactPhone?: string | null;
  contactEmail?: string;
  email?: string;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE" | "DELETED";
  isActive: boolean;
  isDeleted?: boolean;
  students_count?: number;
  studentsCount?: number;
  staff_count?: number;
  academic_tiers?: AcademicTierData[];
  createdAt?: string | Date;
}

const SOFT_DELETED_STORAGE_KEY = "superadmin_soft_deleted_tenants_v1";
const STATUS_OVERRIDE_STORAGE_KEY = "superadmin_tenant_status_overrides_v1";

function getSoftDeletedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SOFT_DELETED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addSoftDeletedId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = new Set(getSoftDeletedIds());
    current.add(id);
    window.localStorage.setItem(SOFT_DELETED_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

function getStatusOverrides(): Record<string, "ACTIVE" | "SUSPENDED"> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STATUS_OVERRIDE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStatusOverride(id: string, status: "ACTIVE" | "SUSPENDED") {
  if (typeof window === "undefined") return;
  try {
    const current = getStatusOverrides();
    current[id] = status;
    window.localStorage.setItem(STATUS_OVERRIDE_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-indigo-700",
  "from-blue-500 to-blue-700",
  "from-purple-500 to-purple-700",
  "from-emerald-500 to-emerald-700",
  "from-teal-500 to-teal-700",
  "from-violet-500 to-violet-700",
  "from-rose-500 to-rose-700",
  "from-amber-500 to-amber-700",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getSchoolInitials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "SC";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<SuperAdminTenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Soft-delete modal state
  const [tenantToDelete, setTenantToDelete] = useState<SuperAdminTenantRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; tone: "success" | "warning" }>>([]);

  const pushToast = useCallback((message: string, tone: "success" | "warning" = "success") => {
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id: toastId, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  }, []);

  const basePlatformUrl = "https://bonaveeict.com.ng";

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/tenants?status=ALL", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json?.data?.tenants || json?.data?.schools || [];
        const deletedIds = new Set(getSoftDeletedIds());

        const normalized: SuperAdminTenantRow[] = rows
          .filter((r: any) => {
            if (r.isDeleted || String(r.status || "").toUpperCase() === "DELETED" || r.deletedAt) return false;
            if ((r.subdomain || "").toLowerCase() !== "demo" && (deletedIds.has(r.id) || deletedIds.has(r.subdomain))) {
              return false;
            }
            return true;
          })
          .map((r: any) => {
            const rawStatus = String(r.status || "").toUpperCase();
            const isSusp =
              rawStatus === "SUSPENDED" ||
              r.isActive === false ||
              String(r.subscriptionStatus || "").toUpperCase() === "SUSPENDED";
            return {
              id: r.id,
              name: r.name,
              subdomain: r.subdomain,
              slug: r.slug || r.subdomain,
              contactPhone: r.contactPhone || null,
              contactEmail: r.contactEmail || r.email || "",
              email: r.email || r.contactEmail || "",
              status: isSusp ? "SUSPENDED" : "ACTIVE",
              isActive: !isSusp,
              students_count: r.students_count ?? r.studentsCount ?? 0,
              staff_count: r.staff_count ?? 0,
              academic_tiers: Array.isArray(r.academic_tiers) ? r.academic_tiers : [],
            };
          });
        setTenants(normalized);
      }
    } catch (err) {
      console.error("[SuperAdminTenantsPage] Failed to load tenants:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleToggleStatus = async (tenant: SuperAdminTenantRow) => {
    const id = tenant.id;
    const newStatus: "ACTIVE" | "SUSPENDED" =
      tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setTogglingId(id);
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason: "Subscription overdue" }),
      }).catch(() => null);

      setStatusOverride(id, newStatus);
      setTenants((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: newStatus,
                isActive: newStatus === "ACTIVE",
              }
            : item
        )
      );

      if (res?.ok) {
        pushToast(
          `${tenant.name} ${newStatus === "SUSPENDED" ? "suspended" : "reactivated"}`,
          newStatus === "SUSPENDED" ? "warning" : "success"
        );
        setTimeout(() => {
          pushToast("Tenant admins notified", "success");
        }, 350);
      }
    } catch (err) {
      console.error("[SuperAdminTenantsPage] Status update failed:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmSoftDelete = async () => {
    if (!tenantToDelete || deleteConfirmText.trim() !== "DELETE") return;
    const id = tenantToDelete.id;
    setIsDeleting(true);
    try {
      // 1. Try DELETE endpoint first, then fallback to PUT /status soft-delete (never hard delete)
      const delRes = await fetch(`/api/super-admin/tenants/${id}`, {
        method: "DELETE",
      }).catch(() => null);

      if (!delRes || !delRes.ok) {
        await fetch(`/api/super-admin/tenants/${id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "INACTIVE",
            isDeleted: true,
            reason: "Soft-deleted by Super Admin",
          }),
        }).catch(() => null);
      }

      addSoftDeletedId(id);
      if (tenantToDelete.subdomain) {
        addSoftDeletedId(tenantToDelete.subdomain);
      }

      setTenantToDelete(null);
      setDeleteConfirmText("");
      await fetchTenants();
    } catch (err) {
      console.error("[SuperAdminTenantsPage] Soft delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopySlug = (subdomain: string) => {
    const fullUrl = `${basePlatformUrl}/${subdomain}/dashboard`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(subdomain);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const totalSchools = tenants.length;
  const totalStudents = useMemo(
    () => tenants.reduce((acc, s) => acc + (s.students_count || 0), 0),
    [tenants]
  );
  const totalStaff = useMemo(
    () => tenants.reduce((acc, s) => acc + (s.staff_count || 0), 0),
    [tenants]
  );
  const activeTenants = useMemo(
    () => tenants.filter((s) => s.status === "ACTIVE").length,
    [tenants]
  );

  const filteredSchools = useMemo(() => {
    return tenants.filter((tenant) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = tenant.name.toLowerCase().includes(query);
        const matchesSubdomain = tenant.subdomain.toLowerCase().includes(query);
        if (!matchesName && !matchesSubdomain) return false;
      }

      if (statusFilter === "ACTIVE" && tenant.status !== "ACTIVE") return false;
      if (statusFilter === "SUSPENDED" && tenant.status !== "SUSPENDED") return false;

      if (tierFilter !== "ALL") {
        const hasMatchingTier = (tenant.academic_tiers || []).some((tier) => {
          const cfg = getTierBadgeConfig(tier.name);
          return (
            cfg.label.toLowerCase() === tierFilter.toLowerCase() ||
            tier.name.toLowerCase().includes(tierFilter.toLowerCase())
          );
        });
        if (!hasMatchingTier) return false;
      }

      return true;
    });
  }, [tenants, searchQuery, statusFilter, tierFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || statusFilter !== "ALL" || tierFilter !== "ALL";

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setTierFilter("ALL");
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 max-w-full overflow-x-hidden">
      {/* TOAST NOTIFICATIONS */}
      {toasts.length > 0 && (
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all ${
                t.tone === "warning"
                  ? "bg-orange-50 text-orange-800 border-orange-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80 dark:border-zinc-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
              SaaS Administration
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Multi-Tenant Institutional Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Institutional Tenants
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Provision, monitor, and configure institutional tenants and their academic tiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
          <Link
            href="/admin/saas"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-xs font-semibold shadow-xs transition"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Open SaaS Console</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Register School</span>
          </button>
        </div>
      </div>

      {/* 2. TOP KPI CARDS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Total Schools
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {totalSchools}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Registered educational institutions
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Total Students
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {totalStudents.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Enrolled across all active tiers
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Total Staff
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {totalStaff.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Faculty & institutional administrators
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Active Tenants
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {activeTenants} <span className="text-sm font-normal text-slate-400">/ {totalSchools}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {totalSchools > 0 ? `${((activeTenants / totalSchools) * 100).toFixed(0)}%` : "0%"} operational status
          </p>
        </div>
      </div>

      {/* 3. TABLE FILTER & SEARCH TOOLBAR */}
      <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by school name or subdomain slug..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50/70 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-[11px] font-medium hidden sm:inline">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50/70 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended Only</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <span className="text-[11px] font-medium hidden sm:inline">Tier:</span>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="bg-slate-50/70 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer max-w-[170px] truncate"
              >
                <option value="ALL">All Academic Tiers</option>
                <option value="Creche / Daycare">Creche / Daycare</option>
                <option value="Nursery / Kindergarten">Nursery / Kindergarten</option>
                <option value="Primary School">Primary School</option>
                <option value="Junior Secondary School">Junior Secondary School</option>
                <option value="Senior Secondary School">Senior Secondary School</option>
                <option value="Technical / Vocational School">Technical / Vocational</option>
                <option value="Islamiyya / Quranic School">Islamiyya / Quranic</option>
                <option value="University">University</option>
                <option value="Polytechnic">Polytechnic</option>
                <option value="College of Education">College of Education</option>
                <option value="Monotechnic">Monotechnic</option>
                <option value="College of Nursing / Health Sciences">College of Nursing</option>
                <option value="Professional / Postgraduate Institute">Postgraduate</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
          <span>
            Showing <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{filteredSchools.length}</strong> of {totalSchools} institutional tenants
          </span>
          {hasActiveFilters && (
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
              Filtered results active
            </span>
          )}
        </div>
      </div>

      {/* 4. RESPONSIVE TENANTS CONTAINER (DESKTOP TABLE + MOBILE CARDS) */}
      <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        {/* DESKTOP VIEW (md+) */}
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 dark:bg-zinc-950/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5 font-semibold">School Name</th>
                <th className="py-3.5 px-4 font-semibold">Subdomain</th>
                <th className="py-3.5 px-4 font-semibold">Academic Tiers</th>
                <th className="py-3.5 px-4 font-semibold text-center">Students</th>
                <th className="py-3.5 px-4 font-semibold text-center">Staff</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Loading institutional tenants...
                  </td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 px-4 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {hasActiveFilters ? "No matching tenants found" : "No institutional tenants registered"}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {hasActiveFilters
                            ? "Try adjusting or clearing your search filters to find what you're looking for."
                            : "Get started by provisioning your first school workspace on the platform."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSchools.map((tenant) => {
                  const initials = getSchoolInitials(tenant.name);
                  const gradient = getAvatarGradient(tenant.name);
                  const tenantUrl = `${basePlatformUrl}/${tenant.subdomain}/dashboard`;
                  const isCopied = copiedSlug === tenant.subdomain;
                  const isUpdating = togglingId === tenant.id;

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* SCHOOL NAME */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-zinc-100 text-sm leading-snug">
                              {tenant.name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                              ID: {tenant.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SUBDOMAIN */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 font-mono text-xs text-slate-700 dark:text-zinc-300 shadow-2xs">
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            /{tenant.subdomain}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySlug(tenant.subdomain)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            title={isCopied ? "Copied!" : "Copy tenant URL"}
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <Link
                            href={tenantUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="Open Tenant Dashboard"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>

                      {/* ACADEMIC TIERS */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {tenant.academic_tiers && tenant.academic_tiers.length > 0 ? (
                            tenant.academic_tiers.map((tier) => {
                              const badge = getTierBadgeConfig(tier.name);
                              return (
                                <span
                                  key={tier.id || tier.name}
                                  className={`${badge.style} text-[11px] px-2.5 py-0.5 rounded-full font-medium border shadow-2xs`}
                                >
                                  {badge.label}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">No tiers configured</span>
                          )}
                        </div>
                      </td>

                      {/* STUDENTS COUNT */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200 text-sm">
                          {(tenant.students_count || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* STAFF COUNT */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200 text-sm">
                          {(tenant.staff_count || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* STATUS COLUMN */}
                      <td className="py-4 px-4 text-center">
                        {tenant.status === "ACTIVE" && (
                          <span className="bg-green-100 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-bold">
                            ● ACTIVE
                          </span>
                        )}
                        {tenant.status === "SUSPENDED" && (
                          <span className="bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1 rounded-full text-xs font-bold">
                            ● SUSPENDED
                          </span>
                        )}
                      </td>

                      {/* ACTIONS COLUMN (3 BUTTONS: VIEW AS TENANT, SUSPEND/REACTIVATE, DELETE) */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/${tenant.subdomain}/dashboard`}
                            className="text-blue-600 hover:bg-blue-50 border border-blue-200/80 px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                            title={`Switch to ${tenant.name} tenant context`}
                          >
                            <span>View as Tenant</span>
                          </Link>

                          {tenant.status === "ACTIVE" ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleToggleStatus(tenant)}
                              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
                            >
                              {isUpdating ? "Suspending..." : "Suspend"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleToggleStatus(tenant)}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
                            >
                              {isUpdating ? "Reactivating..." : "Reactivate"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setTenantToDelete(tenant);
                              setDeleteConfirmText("");
                            }}
                            className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE STACKED CARDS (<768px) */}
        <div className="md:hidden grid gap-3 p-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Loading institutional tenants...
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {hasActiveFilters ? "No matching tenants found" : "No institutional tenants registered"}
            </div>
          ) : (
            filteredSchools.map((tenant) => {
              const initials = getSchoolInitials(tenant.name);
              const gradient = getAvatarGradient(tenant.name);
              const isUpdating = togglingId === tenant.id;

              return (
                <div
                  key={tenant.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-3"
                >
                  {/* Top Row: School Name + Subdomain + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} text-white font-bold text-xs flex items-center justify-center shrink-0`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-zinc-100 text-sm truncate">
                          {tenant.name}
                        </div>
                        <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 truncate">
                          /{tenant.subdomain}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {tenant.status === "ACTIVE" && (
                        <span className="bg-green-100 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-bold inline-block">
                          ● ACTIVE
                        </span>
                      )}
                      {tenant.status === "SUSPENDED" && (
                        <span className="bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1 rounded-full text-xs font-bold inline-block">
                          ● SUSPENDED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-lg">
                    <span>
                      Students: <strong className="text-slate-800 dark:text-zinc-200">{(tenant.students_count || 0).toLocaleString()}</strong>
                    </span>
                    <span>
                      Staff: <strong className="text-slate-800 dark:text-zinc-200">{(tenant.staff_count || 0).toLocaleString()}</strong>
                    </span>
                  </div>

                  {/* 3 Action Buttons in Flex Wrap */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <Link
                      href={`/${tenant.subdomain}/dashboard`}
                      className="text-blue-600 hover:bg-blue-50 border border-blue-200/80 px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 transition"
                    >
                      <span>View as Tenant</span>
                    </Link>

                    {tenant.status === "ACTIVE" ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleToggleStatus(tenant)}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
                      >
                        {isUpdating ? "Suspending..." : "Suspend"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleToggleStatus(tenant)}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
                      >
                        {isUpdating ? "Reactivating..." : "Reactivate"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setTenantToDelete(tenant);
                        setDeleteConfirmText("");
                      }}
                      className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SOFT-DELETE CONFIRMATION MODAL */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-200 dark:border-red-900/50 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Soft-Delete
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Delete {tenantToDelete.name}? This will soft-delete tenant. Type DELETE to confirm.
                </p>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTenantToDelete(null);
                  setDeleteConfirmText("");
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim() !== "DELETE" || isDeleting}
                onClick={handleConfirmSoftDelete}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SLIDE-OVER REGISTER SCHOOL DRAWER */}
      <RegisterSchoolDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          fetchTenants();
        }}
      />
    </div>
  );
}
