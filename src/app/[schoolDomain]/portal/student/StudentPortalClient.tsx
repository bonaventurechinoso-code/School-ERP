"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  GraduationCap,
  CheckSquare,
  Calendar,
  BookOpen,
  Award,
  Bell,
  FileText,
  Receipt,
  User,
  KeyRound,
  ChevronDown,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Download,
  Printer,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileDown,
  Send,
  Eye,
  Building2,
  ShieldCheck,
  Mail,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import ChangeEmailCard from "@/components/ChangeEmailCard";
import { StudentPortalData } from "./actions";

interface StudentPortalClientProps {
  initialData: StudentPortalData;
  schoolDomain: string;
  defaultTab?: string;
}

function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function StudentPortalClient({
  initialData,
  schoolDomain,
  defaultTab = "overview",
}: StudentPortalClientProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("My Academics");
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [selectedTimetableDay, setSelectedTimetableDay] = useState("MONDAY");
  const [submittedAssignmentMsg, setSubmittedAssignmentMsg] = useState<string | null>(null);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSection((prev) => (prev === sectionTitle ? null : sectionTitle));
  };

  const profileDropdownRef = useRef<HTMLDivElement>(null);

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

  const studentInitials = useMemo(() => {
    const parts = initialData.student.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || "S").toUpperCase();
  }, [initialData.student.name]);

  // Sidebar navigation sections strictly adhering to Student RBAC
  const navSections = useMemo(
    () => [
      {
        title: "My Academics",
        icon: GraduationCap,
        items: [
          {
            id: "overview",
            label: "Academic Overview",
            icon: GraduationCap,
            badge: null,
          },
          {
            id: "attendance",
            label: "My Daily Attendance",
            icon: CheckSquare,
            badge: `${initialData.metrics.attendanceRate}%`,
          },
          {
            id: "timetable",
            label: "Class Timetable",
            icon: Calendar,
            badge: null,
          },
          {
            id: "assignments",
            label: "Assignment Submissions",
            icon: BookOpen,
            badge: initialData.metrics.pendingAssignmentsCount ? `${initialData.metrics.pendingAssignmentsCount} due` : null,
          },
          {
            id: "reportcards",
            label: "Termly Report Cards",
            icon: Award,
            badge: initialData.reportCards.length ? `${initialData.reportCards.length}` : null,
          },
        ],
      },
      {
        title: "Campus Workspace",
        icon: Building2,
        items: [
          {
            id: "noticeboard",
            label: "School Noticeboard",
            icon: Bell,
            badge: initialData.notices.length ? `${initialData.notices.length}` : null,
          },
          {
            id: "resources",
            label: "Learning Resources",
            icon: FileText,
            badge: `${initialData.learningResources.length}`,
          },
          {
            id: "fees",
            label: "Fees & Invoices",
            icon: Receipt,
            badge: initialData.metrics.outstandingFees > 0 ? "Due" : null,
          },
          {
            id: "profile",
            label: "My Profile Settings",
            icon: User,
            badge: null,
          },
        ],
      },
    ],
    [
      initialData.metrics.attendanceRate,
      initialData.metrics.pendingAssignmentsCount,
      initialData.reportCards.length,
      initialData.notices.length,
      initialData.learningResources.length,
      initialData.metrics.outstandingFees,
    ]
  );

  // Auto-expand accordion section containing the active tab
  useEffect(() => {
    const currentGroup = navSections.find((g) => g.items.some((it) => it.id === activeTab));
    if (currentGroup && expandedSection !== currentGroup.title) {
      setExpandedSection(currentGroup.title);
    }
  }, [activeTab, navSections]);

  // Filtered timetable for selected day
  const filteredTimetable = useMemo(() => {
    return initialData.timetable.filter(
      (t) => t.dayOfWeek.toUpperCase() === selectedTimetableDay.toUpperCase()
    );
  }, [initialData.timetable, selectedTimetableDay]);

  const handleDownloadInvoice = (inv: any) => {
    window.print();
  };

  return (
    <div className="flex flex-1 h-screen max-h-screen w-full overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-zinc-950 relative">
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. Structural Left Side-Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-72 md:min-w-[18rem] md:max-w-[18rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
          isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
        }`}
      >
        {/* Consolidated Student / Institution Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs border border-white/10 tracking-tight shrink-0 relative">
              {studentInitials}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 dark:ring-zinc-950 shadow-xs"
                title="Student Active"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-slate-100 truncate block">
                  {initialData.school.name}
                </span>
              </div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider truncate">
                STUDENT • {initialData.student.currentClass}
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

        {/* Collapsible Accordion Navigation Architecture */}
        <nav className="flex-1 min-h-0 px-2.5 py-3 flex flex-col gap-1.5 overflow-y-auto overscroll-contain">
          {navSections.map((group, gIdx) => {
            const anyChildActive = group.items.some((item) => activeTab === item.id);
            const isExpanded =
              expandedSection === group.title ||
              (expandedSection === "My Academics" && gIdx === 0);
            const FolderIcon = group.icon;

            return (
              <div key={group.title || gIdx} className="space-y-0.5">
                {/* Main Folder Accordion Row */}
                <button
                  type="button"
                  onClick={() => toggleSection(group.title)}
                  title={group.title}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    anyChildActive
                      ? "bg-indigo-500/15 text-white font-bold"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <FolderIcon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        anyChildActive ? "text-indigo-400" : "text-slate-400"
                      }`}
                    />
                    <span className="flex-1 min-w-0 text-xs sm:text-[12.5px] leading-snug break-words whitespace-normal text-left truncate">
                      {group.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                    {anyChildActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform duration-150" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform duration-150" />
                    )}
                  </div>
                </button>

                {/* Indented Child Links */}
                {isExpanded && (
                  <div className="ml-3 pl-2.5 py-0.5 space-y-0.5 border-l border-slate-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
                    {group.items.map((child) => {
                      const isChildActive = activeTab === child.id;
                      const ChildIcon = child.icon;

                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(child.id);
                            setIsSidebarOpen(false);
                          }}
                          title={child.label}
                          className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                            isChildActive
                              ? "bg-indigo-500/20 text-white font-bold border-l-2 border-indigo-500 shadow-2xs"
                              : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-l-2 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {ChildIcon && (
                              <ChildIcon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isChildActive ? "text-indigo-400" : "text-slate-500"
                                }`}
                              />
                            )}
                            <span className="flex-1 min-w-0 text-xs sm:text-[11.5px] lg:text-xs leading-snug break-words whitespace-normal text-left truncate">
                              {child.label}
                            </span>
                          </div>
                          {isChildActive ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          ) : child.badge ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold shrink-0">
                              {child.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Persistent Footer in Sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-bold text-slate-200 truncate">
                {initialData.student.name}
              </p>
              <p className="text-[9px] text-slate-400 font-mono truncate">
                {initialData.student.admissionNumber}
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
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition shrink-0"
                aria-label="Open Navigation Sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                    Student
                  </span>
                  <span className="text-slate-400 dark:text-zinc-600 text-xs hidden sm:inline">•</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate hidden sm:inline">
                    {initialData.student.currentClass}
                  </span>
                </div>
                <h1 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white truncate mt-0.5">
                  {activeTab === "overview" && "Academic Desk Overview"}
                  {activeTab === "attendance" && "My Daily Attendance Records"}
                  {activeTab === "timetable" && "Class Timetable & Periods"}
                  {activeTab === "assignments" && "Assignment Submissions & Tasks"}
                  {activeTab === "reportcards" && "Termly Academic Report Cards"}
                  {activeTab === "noticeboard" && "School Noticeboard & Circulars"}
                  {activeTab === "resources" && "Curriculum Learning Resources"}
                  {activeTab === "fees" && "Personal Fees & Billing Statement"}
                  {activeTab === "profile" && "My Student Profile & Credentials"}
                  {activeTab === "security" && "Security & Password Settings"}
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
                  onClick={() => setActiveTab("noticeboard")}
                  className="p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition relative"
                  title="Campus Notices"
                >
                  <Bell className="w-4 h-4" />
                  {initialData.notices.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-zinc-900" />
                  )}
                </button>
              </div>

              {/* Two-Tiered Profile Settings Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700/60 transition cursor-pointer"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    {studentInitials}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[110px]">
                      {initialData.student.name.split(" ")[0]}
                    </p>
                    <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                      Student
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in duration-150">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {initialData.student.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                        {initialData.student.admissionNumber}
                      </p>
                      <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        {initialData.student.currentClass}
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
                        <User className="w-4 h-4 text-indigo-500" />
                        <span>Student Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("security");
                          setIsProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left"
                      >
                        <KeyRound className="w-4 h-4 text-amber-500" />
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

        {/* Mobile Horizontal Quick Navigation Scroller */}
        <div className="md:hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-3 py-2 overflow-x-auto scrollbar-none flex items-center gap-1.5 shrink-0 sticky top-[57px] z-20 shadow-2xs">
          {navSections.flatMap((s) => s.items).map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Notification Banner */}
        {submittedAssignmentMsg && (
          <div className="px-4 sm:px-8 pt-4">
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{submittedAssignmentMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmittedAssignmentMsg(null)}
                className="p-1 hover:opacity-75"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Canvas Area */}
        <div className="flex-1 p-3.5 sm:p-6 md:p-8 pb-24 md:pb-8 space-y-4 sm:space-y-6 min-w-0">
          {/* ========================================================================= */}
          {/* TAB 1: ACADEMIC DESK OVERVIEW (STATISTICS OVERVIEW METRICS LAYOUT)         */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Student Welcome Hero */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2 max-w-xl">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Learner Workspace • {initialData.student.currentClass}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Welcome, {initialData.student.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Your academic record is up to date. You have{" "}
                      <strong className="text-indigo-300">{initialData.metrics.pendingAssignmentsCount} pending assignments</strong>{" "}
                      due this week. Keep up your continuous assessment streak!
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("assignments")}
                      className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>View Tasks</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("timetable")}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Today&apos;s Classes</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Statistics Overview Metrics Layout (Requirement 4) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. My Attendance Rate */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      My Attendance Rate
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.attendanceRate}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Active Term</span>
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span>Good standing (Above 90%)</span>
                  </div>
                </div>

                {/* 2. Pending Assignments */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Pending Assignments
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.pendingAssignmentsCount}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Tasks Due</span>
                  </div>
                  <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <span>Mathematics & Science</span>
                  </div>
                </div>

                {/* 3. Continuous Assessment (CA) Average */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      CA Score Average
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.caAverage}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">CA1 + CA2</span>
                  </div>
                  <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                    <span>Rank: Top Tier</span>
                  </div>
                </div>

                {/* 4. Outstanding School Fees */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Outstanding Fees
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {formatNaira(initialData.metrics.outstandingFees)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                    <span>{initialData.metrics.outstandingFees === 0 ? "Account Fully Paid" : "Balance Due"}</span>
                  </div>
                </div>
              </div>

              {/* Grid: Upcoming Class Periods & Active Tasks */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Assignments */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Curriculum Tasks & Homework
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Assigned course exercises and upcoming submission deadlines
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("assignments")}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {initialData.assignments.map((asg) => (
                      <div
                        key={asg.id}
                        className="p-3.5 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {asg.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {asg.subject} • Due: <strong className="text-slate-700 dark:text-zinc-300">{asg.dueDate}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {asg.status === "PENDING" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSubmittedAssignmentMsg(`Assignment "${asg.title}" marked as submitted.`);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit Work</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 font-mono">
                              Score: {asg.score}/{asg.maxScore}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Campus Announcements Widget */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-500" />
                      <span>Noticeboard</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("noticeboard")}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View All
                    </button>
                  </div>

                  <div className="space-y-3">
                    {initialData.notices.slice(0, 3).map((notice) => (
                      <div
                        key={notice.id}
                        className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30 space-y-1"
                      >
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {notice.createdAt}
                        </span>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {notice.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">
                          {notice.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MY DAILY ATTENDANCE                                                */}
          {/* ========================================================================= */}
          {activeTab === "attendance" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    My Daily Attendance
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Statutory daily classroom presence and roll call history.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  Rate: {initialData.metrics.attendanceRate}%
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Class Session</th>
                        <th className="py-3 px-4">Attendance Status</th>
                        <th className="py-3 px-4 text-right">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {initialData.attendanceHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No individual attendance entries logged yet.
                          </td>
                        </tr>
                      ) : (
                        initialData.attendanceHistory.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {att.date}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                              {initialData.student.currentClass}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  att.status === "PRESENT"
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                    : att.status === "LATE"
                                    ? "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                                }`}
                              >
                                {att.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-500">
                              {att.notes || "Recorded on roll"}
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
          {/* TAB 3: CLASS TIMETABLE                                                    */}
          {/* ========================================================================= */}
          {activeTab === "timetable" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Class Timetable & Periods
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Weekly subject timetable for {initialData.student.currentClass}.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                  {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedTimetableDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        selectedTimetableDay === day
                          ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4">Teacher</th>
                        <th className="py-3 px-4 text-right">Classroom</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredTimetable.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No scheduled classes for {selectedTimetableDay}.
                          </td>
                        </tr>
                      ) : (
                        filteredTimetable.map((period) => (
                          <tr key={period.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {period.startTime} - {period.endTime}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {period.subjectName}
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {period.subjectCode}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">
                              {period.teacherName}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-zinc-400">
                              {period.classroomName}
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
          {/* TAB 4: ASSIGNMENT SUBMISSIONS                                             */}
          {/* ========================================================================= */}
          {activeTab === "assignments" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Assignment Submissions
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Coursework exercises, essay prompts, and scored feedback from educators.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {initialData.assignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          {asg.subject}
                        </span>
                        <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                          {asg.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                          Deadline: <strong>{asg.dueDate}</strong>
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          asg.status === "GRADED"
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                        }`}
                      >
                        {asg.status}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 font-mono">
                        Max Score: {asg.maxScore} pts
                      </span>
                      {asg.status === "PENDING" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmittedAssignmentMsg(`Assignment "${asg.title}" submitted successfully.`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Work</span>
                        </button>
                      ) : (
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          Grade: {asg.score} / {asg.maxScore}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: TERMLY REPORT CARDS                                                */}
          {/* ========================================================================= */}
          {activeTab === "reportcards" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Termly Report Cards
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Official term assessment transcripts, grade position, and principal remarks.
                  </p>
                </div>
              </div>

              {initialData.reportCards.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                  <Award className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                    No Published Report Cards
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    End-of-term continuous assessment cards will appear here once finalized by the academic office.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {initialData.reportCards.map((rc) => (
                    <div
                      key={rc.id}
                      className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                            {rc.academicYear} • {rc.term}
                          </span>
                          <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                            {rc.className} Final Transcript
                          </h3>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            {rc.averageScore}%
                          </span>
                          <span className="block text-[10px] font-bold text-slate-400">
                            Grade {rc.gradeLetter || "A"}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-1 text-xs">
                        <p className="text-slate-600 dark:text-zinc-300">
                          Class Position: <strong>{rc.classPosition || 1}</strong> of {rc.totalStudentsInClass || 35}
                        </p>
                        <p className="text-slate-600 dark:text-zinc-300">
                          Passed Subjects: <strong>{rc.passedSubjects}</strong> of {rc.totalSubjects}
                        </p>
                        {rc.principalRemarks && (
                          <p className="text-slate-500 italic mt-1">
                            &ldquo;{rc.principalRemarks}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-zinc-300 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Report</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: SCHOOL NOTICEBOARD                                                 */}
          {/* ========================================================================= */}
          {activeTab === "noticeboard" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    School Noticeboard
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Official announcements, academic calendars, and campus administrative updates.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {initialData.notices.map((n) => (
                  <div
                    key={n.id}
                    className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        {n.createdAt}
                      </span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        {n.priority}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {n.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                      {n.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: LEARNING RESOURCES                                                 */}
          {/* ========================================================================= */}
          {activeTab === "resources" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Learning Resources
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Curriculum reading packs, past test questions, and educator handouts.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {initialData.learningResources.map((res) => (
                  <div
                    key={res.id}
                    className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {res.subject} • {res.format}
                      </span>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1.5">
                        {res.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {res.size} • Uploaded {res.uploadedAt}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => alert(`Starting download for ${res.title}`)}
                      className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 transition cursor-pointer shrink-0"
                      title="Download Resource"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: FEES & INVOICES (PERSONAL VIEW ONLY)                                */}
          {/* ========================================================================= */}
          {activeTab === "fees" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Personal Fees & Invoices
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Your institutional billing invoices and payment verification receipts.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 font-bold text-xs">
                  Outstanding: {formatNaira(initialData.metrics.outstandingFees)}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Billing Item</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Total Amount</th>
                        <th className="py-3 px-4 text-right">Download Statement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {initialData.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No personal billing statements found. All fees are cleared!
                          </td>
                        </tr>
                      ) : (
                        initialData.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {inv.description}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                              {inv.dueDate}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  inv.status === "PAID"
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {formatNaira(inv.amountDue)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoice(inv)}
                                className="px-3 py-1 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition cursor-pointer flex items-center gap-1.5 ml-auto"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Bill</span>
                              </button>
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
          {/* TAB 9: STUDENT PROFILE SETTINGS                                           */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
              <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/10 via-transparent to-transparent rounded-bl-full pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-700 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shrink-0 shadow-md ring-4 ring-indigo-50 dark:ring-indigo-950/40">
                    {studentInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                        {initialData.student.currentClass}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {initialData.student.tierName}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                      {initialData.student.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                      {initialData.student.admissionNumber} • {initialData.school.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("security")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Security & Password</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Enrolled Academic Scope
                    </h3>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Institution</dt>
                      <dd className="font-bold text-slate-900 dark:text-white">{initialData.school.name}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Class Cohort</dt>
                      <dd className="font-bold text-indigo-600 dark:text-indigo-400">
                        {initialData.student.currentClass}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Academic Tier</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {initialData.student.tierName}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      RBAC Access Isolation
                    </h3>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Account Type</dt>
                      <dd className="font-bold text-emerald-600 dark:text-emerald-400">
                        Enrolled Student Learner
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Administrative Guard</dt>
                      <dd className="text-slate-600 dark:text-zinc-300 font-semibold">
                        Personal Data Only • Zero Staff Ledger Access
                      </dd>
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
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                          Account Information
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                          Student
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                        {initialData.student.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowChangeEmailModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 transition shadow-2xs cursor-pointer shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Change email</span>
                  </button>
                </div>
              </div>

              <SecurityPasswordForm
                schoolDomain={schoolDomain}
                userRole="STUDENT"
                brandColor="#4f46e5"
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
                  initialEmail={initialData.student.email}
                  brandColor="#4f46e5"
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

        {/* Mobile Fixed Bottom Navigation Bar */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-zinc-800/90 px-3 py-1.5 flex items-center justify-around shadow-lg"
          aria-label="Mobile Bottom Bar"
        >
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] ${
              activeTab === "overview"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] ${
              activeTab === "attendance"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timetable")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] ${
              activeTab === "timetable"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Timetable</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assignments")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] relative ${
              activeTab === "assignments"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Tasks</span>
            {initialData.metrics.pendingAssignmentsCount > 0 && (
              <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 dark:text-zinc-400 font-medium transition min-w-[56px]"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Menu</span>
          </button>
        </nav>
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
              Log out of Student Portal?
            </h3>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Are you sure you want to end your current student session for{" "}
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
