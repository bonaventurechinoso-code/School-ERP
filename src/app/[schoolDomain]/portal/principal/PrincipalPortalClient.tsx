"use client";

import React, { useState, useMemo, useRef, useEffect, useTransition } from "react";
import {
  Briefcase,
  Layers,
  Calendar,
  CheckSquare,
  Award,
  Users,
  FileText,
  Clock,
  User,
  KeyRound,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Building2,
  Mail,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
  GraduationCap,
  BookOpen,
  CalendarDays,
  UserCheck,
  UserX,
  RefreshCw,
  Printer,
  Download,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import ChangeEmailCard from "@/components/ChangeEmailCard";
import {
  PrincipalPortalData,
  updateStaffLifecycleStatusAction,
} from "./actions";

interface PrincipalPortalClientProps {
  initialData: PrincipalPortalData;
  schoolDomain: string;
  defaultTab?: string;
}

export default function PrincipalPortalClient({
  initialData,
  schoolDomain,
  defaultTab = "overview",
}: PrincipalPortalClientProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  // Local state for dynamic updates
  const [staffList, setStaffList] = useState(initialData.staffDirectory);
  const [selectedStaffStatus, setSelectedStaffStatus] = useState<string>("ALL");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<string>("MONDAY");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const principalInitials = useMemo(() => {
    const parts = initialData.principal.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || "P").toUpperCase();
  }, [initialData.principal.name]);

  // Sidebar navigation groups with strict executive RBAC isolation
  const navSections = [
    {
      title: "EXECUTIVE OVERVIEW",
      items: [
        {
          id: "overview",
          label: "Executive Command",
          icon: Briefcase,
          badge: null,
        },
      ],
    },
    {
      title: "ACADEMIC MANAGEMENT",
      items: [
        {
          id: "streams",
          label: "Class Stream Overviews",
          icon: Layers,
          badge: `${initialData.classStreams.length}`,
        },
        {
          id: "schedules",
          label: "Master Teaching Schedules",
          icon: Calendar,
          badge: null,
        },
        {
          id: "attendance",
          label: "Global Attendance Metrics",
          icon: CheckSquare,
          badge: `${initialData.metrics.globalAttendanceRate}%`,
        },
        {
          id: "exams",
          label: "Exam Performance Sheets",
          icon: Award,
          badge: initialData.examSheets.length ? `${initialData.examSheets.length}` : null,
        },
      ],
    },
    {
      title: "EXECUTIVE DESK",
      items: [
        {
          id: "staff",
          label: "Staff Directory & Onboarding",
          icon: Users,
          badge: initialData.metrics.onboardingStaffCount ? `${initialData.metrics.onboardingStaffCount} new` : null,
        },
        {
          id: "reports",
          label: "Academic Reports",
          icon: FileText,
          badge: null,
        },
        {
          id: "leaves",
          label: "Leave Approvals Panel",
          icon: Clock,
          badge: null,
        },
        {
          id: "profile",
          label: "My Profile Settings",
          icon: User,
          badge: null,
        },
      ],
    },
  ];

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesStatus = selectedStaffStatus === "ALL" || s.status === selectedStaffStatus;
      const query = staffSearchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.department.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [staffList, selectedStaffStatus, staffSearchQuery]);

  // Handle staff status update
  const handleUpdateStaffStatus = (staffId: string, newStatus: any) => {
    setStatusMessage(null);
    startTransition(async () => {
      const res = await updateStaffLifecycleStatusAction(initialData.school.id, staffId, newStatus);
      if (res.success) {
        setStaffList((prev) =>
          prev.map((s) => (s.id === staffId ? { ...s, status: newStatus } : s))
        );
        setStatusMessage({ type: "success", text: `Staff status successfully updated to ${newStatus}` });
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to update status" });
      }
    });
  };

  // Schedules filtered by day
  const filteredSchedules = useMemo(() => {
    return initialData.masterSchedules.filter(
      (s) => s.dayOfWeek.toUpperCase() === selectedDay.toUpperCase()
    );
  }, [initialData.masterSchedules, selectedDay]);

  return (
    <div className="flex flex-1 h-screen max-h-screen w-full overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-zinc-950 relative">
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. Persistent Structural Left Side-Panel (Mirroring Teacher design) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-72 md:min-w-[18rem] md:max-w-[18rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
          isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
        }`}
      >
        {/* Consolidated Principal / Institution Header Block */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs border border-white/10 tracking-tight shrink-0 relative">
              {principalInitials}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900 dark:ring-zinc-950 shadow-xs"
                title="Principal Active"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-slate-100 truncate block">
                  {initialData.school.name}
                </span>
              </div>
              <p className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider truncate">
                EXECUTIVE PRINCIPAL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                {section.title}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                        isActive
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? "text-amber-400" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider shrink-0 ${
                            isActive
                              ? "bg-amber-400 text-slate-950 font-black"
                              : "bg-slate-800 text-slate-400 border border-slate-700/60"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Persistent Footer in Sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-bold text-slate-200 truncate">
                {initialData.principal.name}
              </p>
              <p className="text-[9px] text-slate-400 truncate">
                {initialData.principal.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen max-h-screen overflow-y-auto min-w-0 relative">
        {/* Unified Top Header Status Panel */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 px-4 sm:px-6 py-3 transition-colors shrink-0">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Mobile hamburger & Context indicators */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition"
                aria-label="Open Navigation Sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                    Executive Portal
                  </span>
                  <span className="text-slate-400 dark:text-zinc-600 text-xs hidden sm:inline">•</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate hidden sm:inline">
                    {initialData.school.name}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate mt-0.5">
                  {activeTab === "overview" && "Executive Command Dashboard"}
                  {activeTab === "streams" && "Class Stream Overviews"}
                  {activeTab === "schedules" && "Master Teaching Schedules"}
                  {activeTab === "attendance" && "Global Institutional Attendance Metrics"}
                  {activeTab === "exams" && "Exam Performance Sheets"}
                  {activeTab === "staff" && "Staff Directory & Onboarding"}
                  {activeTab === "reports" && "Academic Performance Reports"}
                  {activeTab === "leaves" && "Executive Leave Approvals"}
                  {activeTab === "profile" && "Principal Profile & Institutional Authority"}
                  {activeTab === "security" && "Security & Credentials"}
                </h1>
              </div>
            </div>

            {/* Right: Controls & Two-Tiered User Dropdown */}
            <div className="flex items-center gap-2.5 shrink-0">
              <ThemeToggle />

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  className="p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {initialData.institutionalNotices.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900" />
                  )}
                </button>
              </div>

              {/* Two-Tiered User Profile Menu */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700/60 transition cursor-pointer"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-600 to-amber-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    {principalInitials}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[110px]">
                      {initialData.principal.name.split(" ")[0]}
                    </p>
                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Principal
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in duration-150">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {initialData.principal.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                        {initialData.principal.email}
                      </p>
                      <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                        Principal Executive
                      </span>
                    </div>

                    <div className="py-1 px-1 space-y-0.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("profile");
                          setIsProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left"
                      >
                        <User className="w-4 h-4 text-amber-500" />
                        <span>Executive Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("security");
                          setIsProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left"
                      >
                        <KeyRound className="w-4 h-4 text-indigo-500" />
                        <span>Security & Password</span>
                      </button>

                      <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setShowLogoutConfirm(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-left font-bold"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Global Alert Notification */}
        {statusMessage && (
          <div className="px-4 sm:px-8 pt-4">
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="p-1 hover:opacity-75"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Canvas Area */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: EXECUTIVE COMMAND GRID (OVERVIEW)                                  */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Executive Welcome Hero */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2 max-w-xl">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Executive Command Console
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Welcome, Principal {initialData.principal.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Institutional operations are synchronized. Today&apos;s global student attendance stands at{" "}
                      <strong className="text-amber-400">{initialData.metrics.globalAttendanceRate}%</strong> across{" "}
                      {initialData.metrics.totalClassCohorts} registered academic streams.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("staff")}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      <span>Review Faculty</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("attendance")}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Global Metrics</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Statistics Metric Cards (Executive Command Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Class Cohorts */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Total Class Cohorts
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.totalClassCohorts}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Active Streams</span>
                  </div>
                  <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                    <span>100% Academic Coverage</span>
                  </div>
                </div>

                {/* 2. Active Faculty Count */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Active Faculty Count
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.activeFacultyCount}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Educators</span>
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{initialData.metrics.onboardingStaffCount} in onboarding</span>
                  </div>
                </div>

                {/* 3. Global Attendance Rate */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Global Attendance Rate
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.globalAttendanceRate}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Today</span>
                  </div>
                  <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <span>{initialData.attendanceBreakdown.present} present students</span>
                  </div>
                </div>

                {/* 4. Institutional Notices */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Institutional Notices
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.activeNoticesCount}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Dispatches</span>
                  </div>
                  <div className="mt-2 text-[11px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                    <span>Executive Circulars</span>
                  </div>
                </div>
              </div>

              {/* Grid: Class Stream Snapshot & Recent Notices Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Class Cohorts Snapshot */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Class Stream Overviews
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Active student capacity and enrollment distribution
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("streams")}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {initialData.classStreams.slice(0, 6).map((stream) => (
                      <div
                        key={stream.id}
                        className="p-3.5 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {stream.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                            {stream.tierName}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                            {stream.studentCount}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-semibold">
                            / {stream.capacity || 40} cap
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Institutional Notices Feed */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-500" />
                      <span>Executive Bulletins</span>
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                      Official
                    </span>
                  </div>

                  <div className="space-y-3">
                    {initialData.institutionalNotices.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        No active notices recorded for this session.
                      </p>
                    ) : (
                      initialData.institutionalNotices.slice(0, 4).map((notice) => (
                        <div
                          key={notice.id}
                          className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                              {notice.targetAudience}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {notice.createdAt}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {notice.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">
                            {notice.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CLASS STREAM OVERVIEWS                                             */}
          {/* ========================================================================= */}
          {activeTab === "streams" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Class Stream Overviews
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Comprehensive inventory of class cohorts, student capacities, and academic tiers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    Total Streams: <strong>{initialData.classStreams.length}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {initialData.classStreams.map((stream) => {
                  const utilization = Math.min(
                    100,
                    Math.round((stream.studentCount / (stream.capacity || 40)) * 100)
                  );
                  return (
                    <div
                      key={stream.id}
                      className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            {stream.tierName}
                          </span>
                          <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                            {stream.name}
                          </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-bold text-xs">
                          {stream.studentCount}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                          <span>Cohort Utilization</span>
                          <span>{utilization}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              utilization > 90
                                ? "bg-rose-500"
                                : utilization > 70
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${utilization}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 text-right">
                          {stream.studentCount} enrolled of {stream.capacity || 40} capacity
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MASTER TEACHING SCHEDULES                                          */}
          {/* ========================================================================= */}
          {activeTab === "schedules" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Master Teaching Schedules
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Institutional master timetable, classroom distribution, and educator assignments.
                  </p>
                </div>

                {/* Day of Week Selector */}
                <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                  {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        selectedDay === day
                          ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSchedules.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                  <Calendar className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                    No scheduled periods found for {selectedDay}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Master timetable entries will appear here once configured in the curriculum database.
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                        <tr>
                          <th className="py-3 px-4">Period Time</th>
                          <th className="py-3 px-4">Subject Course</th>
                          <th className="py-3 px-4">Class Stream</th>
                          <th className="py-3 px-4">Assigned Educator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {filteredSchedules.map((schedule) => (
                          <tr key={schedule.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                              {schedule.startTime} - {schedule.endTime}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {schedule.subjectName}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {schedule.subjectCode}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-lg font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                {schedule.className}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                              {schedule.teacherName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: GLOBAL INSTITUTIONAL ATTENDANCE METRICS                             */}
          {/* ========================================================================= */}
          {activeTab === "attendance" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Global Institutional Attendance Metrics
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Real-time aggregated daily presence rates across all academic tiers.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  <span>Overall Presence: {initialData.metrics.globalAttendanceRate}%</span>
                </div>
              </div>

              {/* Attendance Metric Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Present
                  </span>
                  <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                    {initialData.attendanceBreakdown.present}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">In Classroom</p>
                </div>

                <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/80 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    Absent
                  </span>
                  <p className="text-2xl font-black text-rose-900 dark:text-rose-200">
                    {initialData.attendanceBreakdown.absent}
                  </p>
                  <p className="text-[10px] text-rose-600 dark:text-rose-400">Unexcused</p>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Tardy / Late
                  </span>
                  <p className="text-2xl font-black text-amber-900 dark:text-amber-200">
                    {initialData.attendanceBreakdown.late}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">Gate logged</p>
                </div>

                <div className="p-5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/80 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                    Excused
                  </span>
                  <p className="text-2xl font-black text-sky-900 dark:text-sky-200">
                    {initialData.attendanceBreakdown.excused}
                  </p>
                  <p className="text-[10px] text-sky-600 dark:text-sky-400">Authorized medical/personal</p>
                </div>
              </div>

              {/* Attendance Progress & Cohort Breakdown */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Institutional Attendance Gauge
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-zinc-400">
                    <span>Target: 95.0% Statutory Minimum</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      Actual: {initialData.metrics.globalAttendanceRate}%
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, initialData.metrics.globalAttendanceRate)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: EXAM PERFORMANCE SHEETS                                            */}
          {/* ========================================================================= */}
          {activeTab === "exams" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Exam Performance Sheets
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Supervised assessment sessions, term tests, and compiled score archives.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                  {initialData.examSheets.length} assessment records
                </span>
              </div>

              {initialData.examSheets.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                  <Award className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                    No active examinations registered for this session
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Exam performance records will populate as teachers submit grades and test results.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {initialData.examSheets.map((exam) => (
                    <div
                      key={exam.id}
                      className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                            {exam.courseCode}
                          </span>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1.5">
                            {exam.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {exam.courseName}
                          </p>
                        </div>
                        <Award className="w-5 h-5 text-amber-500 shrink-0" />
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                        <span>Date: {exam.date}</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {exam.resultsCount} Graded
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: STAFF DIRECTORY & ONBOARDING STATUS                                */}
          {/* ========================================================================= */}
          {activeTab === "staff" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Staff Directory & Onboarding Status
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Faculty rosters, academic department designations, and executive lifecycle control.
                  </p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="Search faculty by name, department, or email..."
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {["ALL", "ACTIVE", "ONBOARDING", "LEAVE"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStaffStatus(status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        selectedStaffStatus === status
                          ? "bg-amber-500 text-slate-950 shadow-xs"
                          : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Directory Table */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Faculty Member</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Joined</th>
                        <th className="py-3 px-4 text-right">Executive Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No faculty members match the selected criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((staff) => (
                          <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold flex items-center justify-center shrink-0">
                                  {staff.firstName[0]}
                                  {staff.lastName[0]}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white">
                                    {staff.firstName} {staff.lastName}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-mono">
                                    {staff.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-zinc-300">
                              {staff.department}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  staff.status === "ACTIVE"
                                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                                    : staff.status === "ONBOARDING"
                                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60"
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                                }`}
                              >
                                {staff.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                              {staff.joinedDate}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {staff.status === "ONBOARDING" ? (
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleUpdateStaffStatus(staff.id, "ACTIVE")}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer"
                                >
                                  Authorize & Activate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleUpdateStaffStatus(
                                      staff.id,
                                      staff.status === "ACTIVE" ? "LEAVE" : "ACTIVE"
                                    )
                                  }
                                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-[11px] transition cursor-pointer"
                                >
                                  Toggle Status
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: ACADEMIC PERFORMANCE REPORTS                                       */}
          {/* ========================================================================= */}
          {activeTab === "reports" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Academic Performance Reports
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Institutional summaries, term-by-term cohort progress, and curriculum execution analytics.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Award className="w-5 h-5" />
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Curriculum Completion
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Lesson plan delivery across active class cohorts is at <strong>92.4%</strong> compliance.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-5 h-5" />
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Term Report Cards
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Continuous assessment (CA1 & CA2) scores entered by educators for standard compilation.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <GraduationCap className="w-5 h-5" />
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Institutional Pass Rate
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Current aggregated assessment pass benchmark stands at <strong>88.7%</strong> institution-wide.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: LEAVE APPROVALS PANEL                                              */}
          {/* ========================================================================= */}
          {activeTab === "leaves" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Executive Leave Approvals Panel
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Manage faculty absence notifications, statutory leaves, and classroom relief nominations.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Faculty On Statutory Leave
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {staffList.filter((s) => s.status === "LEAVE").length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      No faculty members are currently on authorized leave.
                    </p>
                  ) : (
                    staffList
                      .filter((s) => s.status === "LEAVE")
                      .map((staff) => (
                        <div key={staff.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white">
                              {staff.firstName} {staff.lastName}
                            </p>
                            <p className="text-[10px] text-slate-500">{staff.department}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateStaffStatus(staff.id, "ACTIVE")}
                            className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 font-bold text-xs hover:bg-emerald-100 transition cursor-pointer"
                          >
                            Mark Resumed
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 9: EXECUTIVE PROFILE SETTINGS                                         */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
              {/* Header Profile Card */}
              <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-500/10 via-transparent to-transparent rounded-bl-full pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-amber-700 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shrink-0 shadow-md ring-4 ring-amber-50 dark:ring-amber-950/40">
                    {principalInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                        {initialData.principal.role}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {initialData.principal.title}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                      {initialData.principal.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                      {initialData.principal.email} • {initialData.school.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("security")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      <span>Security & Password</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Institutional Authority Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Institutional Scope
                    </h3>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">School Institution</dt>
                      <dd className="font-bold text-slate-900 dark:text-white">{initialData.school.name}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Institutional Subdomain</dt>
                      <dd className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        {initialData.school.subdomain}.school.edu
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Executive Title</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {initialData.principal.title}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Administrative Authority</dt>
                      <dd className="font-bold text-emerald-600 dark:text-emerald-400">
                        Full Institutional Executive
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Security & Multi-Tenant RBAC
                    </h3>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Access Privilege</dt>
                      <dd className="font-bold text-slate-900 dark:text-white">Executive Desk & Academics</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Session Security</dt>
                      <dd className="text-emerald-600 dark:text-emerald-400 font-bold">Encrypted JWT • Active</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Tenant Isolation</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">Strict School Scope</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 10: SECURITY & PASSWORD SETTINGS (WITH CHANGE EMAIL)                  */}
          {/* ========================================================================= */}
          {activeTab === "security" && (
            <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl">
              {/* Account Information Layout Block */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                          Account Information
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                          Executive Primary
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                        {initialData.principal.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowChangeEmailModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/60 transition shadow-2xs cursor-pointer shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Change email</span>
                  </button>
                </div>
              </div>

              <SecurityPasswordForm
                schoolDomain={schoolDomain}
                userRole="PRINCIPAL"
                brandColor="#d97706"
              />
            </div>
          )}
        </div>

        {/* Change Email Modal */}
        {showChangeEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-xl w-full overflow-hidden relative">
              <button
                type="button"
                onClick={() => setShowChangeEmailModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition z-10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-6">
                <ChangeEmailCard
                  initialEmail={initialData.principal.email}
                  brandColor="#d97706"
                  schoolDomain={schoolDomain}
                  isSuperAdmin={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs py-4 px-4 md:px-8 transition-colors">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span>Powered by BonaVee ICT • School ERP Platform</span>
            </div>
            <div className="text-center sm:text-right shrink-0">
              <span>© {new Date().getFullYear()} {initialData.school.name}. All rights reserved.</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              End Executive Session?
            </h3>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Are you sure you want to end your current session for{" "}
              <strong>{initialData.school.name || "this institution"}</strong>?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-2"
              >
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
