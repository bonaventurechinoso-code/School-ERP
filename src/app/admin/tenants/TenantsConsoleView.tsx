"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  GraduationCap,
  ShieldCheck,
  Search,
  Filter,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  Power,
  PowerOff,
  Trash2,
  X,
  RotateCcw,
  Sparkles,
  Server,
  Activity,
} from "lucide-react";
import EditSchoolModal from "../EditSchoolModal";
import DeleteSchoolForm from "../DeleteSchoolForm";
import RegisterSchoolDrawer from "./RegisterSchoolDrawer";
import { toggleSchoolStatus } from "../actions";

interface AcademicTierData {
  id?: string;
  name: string;
}

export interface TenantSchoolItem {
  id: string;
  name: string;
  subdomain: string;
  contactPhone?: string | null;
  isActive: boolean;
  students_count?: number;
  staff_count?: number;
  academic_tiers?: AcademicTierData[];
  createdAt?: string | Date;
}

interface TenantsConsoleViewProps {
  schools: TenantSchoolItem[];
  basePlatformUrl?: string;
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

export function getTierBadgeConfig(tierName: string) {
  const norm = (tierName || "").trim();
  const upper = norm.toUpperCase();

  if (upper.includes("CRECHE") || upper.includes("DAYCARE")) {
    return {
      label: "Creche / Daycare",
      style: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
    };
  }
  if (upper.includes("NURSERY") || upper.includes("KINDERGARTEN")) {
    return {
      label: "Nursery / Kindergarten",
      style: "bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/50",
    };
  }
  if (upper.includes("JUNIOR SECONDARY") || upper === "JSS") {
    return {
      label: "Junior Secondary School",
      style: "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/50",
    };
  }
  if (upper.includes("SENIOR SECONDARY") || upper === "SSS") {
    return {
      label: "Senior Secondary School",
      style: "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50",
    };
  }
  if (upper.includes("TECHNICAL") || upper.includes("VOCATIONAL")) {
    return {
      label: "Technical / Vocational School",
      style: "bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/50",
    };
  }
  if (upper.includes("ISLAMIYYA") || upper.includes("QURANIC")) {
    return {
      label: "Islamiyya / Quranic School",
      style: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
    };
  }
  if (upper.includes("UNIVERSITY")) {
    return {
      label: "University",
      style: "bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50",
    };
  }
  if (upper.includes("POLYTECHNIC")) {
    return {
      label: "Polytechnic",
      style: "bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/50",
    };
  }
  if (upper.includes("COLLEGE OF EDUCATION")) {
    return {
      label: "College of Education",
      style: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800/50",
    };
  }
  if (upper.includes("MONOTECHNIC")) {
    return {
      label: "Monotechnic",
      style: "bg-pink-50 text-pink-700 border-pink-200/80 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800/50",
    };
  }
  if (upper.includes("NURSING") || upper.includes("HEALTH SCIENCES")) {
    return {
      label: "College of Nursing / Health Sciences",
      style: "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50",
    };
  }
  if (upper.includes("POSTGRADUATE") || upper.includes("PROFESSIONAL")) {
    return {
      label: "Professional / Postgraduate Institute",
      style: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    };
  }
  if (upper.includes("PRIMARY") && upper.includes("SECONDARY")) {
    return {
      label: "Primary & Secondary",
      style: "bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/50",
    };
  }
  if (upper.includes("PRIMARY")) {
    return {
      label: "Primary School",
      style: "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50",
    };
  }
  if (upper.includes("SECONDARY")) {
    return {
      label: "Secondary School",
      style: "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50",
    };
  }
  return {
    label: norm,
    style: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  };
}

export default function TenantsConsoleView({
  schools,
  basePlatformUrl = "https://bonaveeict.com.ng",
}: TenantsConsoleViewProps) {
  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");

  // Clipboard feedback state
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleCopySlug = (subdomain: string) => {
    const fullUrl = `${basePlatformUrl}/${subdomain}/dashboard`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(subdomain);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // KPIs
  const totalSchools = schools.length;
  const totalStudents = useMemo(
    () => schools.reduce((acc, s) => acc + (s.students_count || 0), 0),
    [schools]
  );
  const totalStaff = useMemo(
    () => schools.reduce((acc, s) => acc + (s.staff_count || 0), 0),
    [schools]
  );
  const activeTenants = useMemo(
    () => schools.filter((s) => s.isActive).length,
    [schools]
  );

  // Filtered Schools
  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = school.name.toLowerCase().includes(query);
        const matchesSubdomain = school.subdomain.toLowerCase().includes(query);
        if (!matchesName && !matchesSubdomain) return false;
      }

      // 2. Status Filter
      if (statusFilter === "ACTIVE" && !school.isActive) return false;
      if (statusFilter === "SUSPENDED" && school.isActive) return false;

      // 3. Tier Filter
      if (tierFilter !== "ALL") {
        const hasMatchingTier = (school.academic_tiers || []).some((tier) => {
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
  }, [schools, searchQuery, statusFilter, tierFilter]);

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "ALL" || tierFilter !== "ALL";

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setTierFilter("ALL");
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
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

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
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

      {/* 2. TOP KPI CARDS ROW (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Schools */}
        <div className="p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Total Schools
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {totalSchools}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Registered educational institutions
          </p>
        </div>

        {/* Card 2: Total Students */}
        <div className="p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Total Students
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {totalStudents.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Enrolled across all active tiers
          </p>
        </div>

        {/* Card 3: Total Staff */}
        <div className="p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Total Staff
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
            {totalStaff.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Faculty & institutional administrators
          </p>
        </div>

        {/* Card 4: Active Tenants */}
        <div className="p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Active Tenants
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
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
          {/* Search Input */}
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

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
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

            {/* Academic Tier Filter */}
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

            {/* Reset Filters Action */}
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

        {/* Results Counter Bar */}
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

      {/* 4. REDESIGNED TENANTS TABLE (FULL WIDTH CONTAINER) */}
      <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
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
              {filteredSchools.length === 0 ? (
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
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsDrawerOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Register First School</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => {
                  const initials = getSchoolInitials(school.name);
                  const gradient = getAvatarGradient(school.name);
                  const tenantUrl = `${basePlatformUrl}/${school.subdomain}/dashboard`;
                  const isCopied = copiedSlug === school.subdomain;

                  return (
                    <tr
                      key={school.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* SCHOOL NAME (AVATAR + NAME) */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-zinc-100 text-sm leading-snug">
                              {school.name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                              ID: {school.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SUBDOMAIN (MONO PILL WITH COPY + OPEN) */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 font-mono text-xs text-slate-700 dark:text-zinc-300 shadow-2xs">
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            /{school.subdomain}
                          </span>

                          {/* Copy Link Button */}
                          <button
                            type="button"
                            onClick={() => handleCopySlug(school.subdomain)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            title={isCopied ? "Copied!" : "Copy tenant URL"}
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>

                          {/* Open Dashboard Link */}
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

                      {/* ACADEMIC TIERS (COLORED PILL BADGES, TITLE CASE) */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {school.academic_tiers && school.academic_tiers.length > 0 ? (
                            school.academic_tiers.map((tier) => {
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
                          {(school.students_count || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* STAFF COUNT */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200 text-sm">
                          {(school.staff_count || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* STATUS (MODERN GREEN PILL WITH DOT) */}
                      <td className="py-4 px-4 text-center">
                        {school.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>SUSPENDED</span>
                          </span>
                        )}
                      </td>

                      {/* ACTIONS (CLEAN ICON BUTTONS WITH TOOLTIPS) */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Edit Tenant */}
                          <EditSchoolModal
                            school={{
                              id: school.id,
                              name: school.name,
                              contactPhone: school.contactPhone,
                              subdomain: school.subdomain,
                              academicTiers: school.academic_tiers || [],
                            }}
                            trigger={
                              <button
                                type="button"
                                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all cursor-pointer shadow-2xs"
                                title="Edit Tenant Details & Tiers"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            }
                          />

                          {/* 2. Suspend / Activate Toggle */}
                          <form
                            action={toggleSchoolStatus.bind(null, school.id, school.isActive)}
                            className="inline-block"
                          >
                            <button
                              type="submit"
                              title={school.isActive ? "Suspend Tenant" : "Activate Tenant"}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer shadow-2xs ${
                                school.isActive
                                  ? "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/30"
                                  : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
                              }`}
                            >
                              {school.isActive ? (
                                <PowerOff className="w-3.5 h-3.5" />
                              ) : (
                                <Power className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </form>

                          {/* 3. Delete Tenant */}
                          <DeleteSchoolForm
                            schoolId={school.id}
                            trigger={
                              <span
                                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-all cursor-pointer shadow-2xs"
                                title="Permanently Delete Tenant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </span>
                            }
                          />
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

      {/* 5. SLIDE-OVER REGISTER SCHOOL DRAWER */}
      <RegisterSchoolDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
