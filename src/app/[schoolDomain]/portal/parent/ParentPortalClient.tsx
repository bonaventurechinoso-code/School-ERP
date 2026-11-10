"use client";

import React, { useState, useMemo, useRef, useEffect, useTransition } from "react";
import {
  Users,
  Heart,
  CheckSquare,
  Calendar,
  Award,
  ClipboardList,
  Receipt,
  CreditCard,
  Bell,
  User,
  KeyRound,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Send,
  Building2,
  ShieldCheck,
  Mail,
  Home,
  Clock,
  TrendingUp,
  UploadCloud,
  FileCheck,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { performTenantLogout } from "@/lib/client-logout";
import { resolveInstitutionalTier } from "@/lib/tier-naming";
import { ThemeToggle } from "@/components/ThemeToggle";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import ChangeEmailCard from "@/components/ChangeEmailCard";
import {
  ParentPortalData,
  WardData,
  submitParentPaymentProofAction,
} from "./actions";

interface ParentPortalClientProps {
  initialData: ParentPortalData;
  schoolDomain: string;
  defaultTab?: string;
}

function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ParentPortalClient({
  initialData,
  schoolDomain,
  defaultTab = "overview",
}: ParentPortalClientProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("My Wards (Children)");
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSection((prev) => (prev === sectionTitle ? null : sectionTitle));
  };

  // Multi-Child Selector State (Requirement 4)
  const [selectedWardId, setSelectedWardId] = useState<string>(
    initialData.wards[0]?.id || ""
  );

  // Selected Active Ward (derived state)
  const activeWard: WardData = useMemo(() => {
    return (
      initialData.wards.find((w) => w.id === selectedWardId) ||
      initialData.wards[0] || {
        id: "none",
        name: "No ward linked",
        admissionNumber: "N/A",
        currentClass: "N/A",
        tierName: "N/A",
        status: "N/A",
        metrics: {
          attendanceRate: 0,
          pendingHomeworkCount: 0,
          academicStandingLetter: "N/A",
          academicAverage: 0,
          outstandingFees: 0,
        },
        attendanceHistory: [],
        timetable: [],
        reportCards: [],
        invoices: [],
        behavioralRemarks: [],
      }
    );
  }, [initialData.wards, selectedWardId]);

  // Proof of Payment Upload Form State
  const [proofForm, setProofForm] = useState({
    amount: "",
    payerBankName: "First Bank of Nigeria",
    payerAccountName: "",
    sessionId: "",
    paidAt: new Date().toISOString().split("T")[0],
  });
  const [proofStatus, setProofStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const parentInitials = useMemo(() => {
    const parts = initialData.parent.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || "P").toUpperCase();
  }, [initialData.parent.name]);

  const terminology = useMemo(() => {
    return resolveInstitutionalTier(
      initialData.school.name,
      initialData.school.academicTiers
    );
  }, [initialData.school.name, initialData.school.academicTiers]);

  // Sidebar navigation structure strictly adhering to Family RBAC
  const navSections = useMemo(
    () => [
      {
        title: "My Wards (Children)",
        icon: Heart,
        items: [
          {
            id: "overview",
            label: "Family Overview",
            icon: Home,
            badge: `${initialData.wards.length} ${initialData.wards.length === 1 ? "Ward" : "Wards"}`,
          },
          {
            id: "attendance",
            label: "Children's Attendance",
            icon: CheckSquare,
            badge: `${activeWard.metrics.attendanceRate}%`,
          },
          {
            id: "timetable",
            label: "Academic Timetables",
            icon: Calendar,
            badge: null,
          },
          {
            id: "reportcards",
            label: "Terminal Report Cards",
            icon: Award,
            badge: activeWard.reportCards.length ? `${activeWard.reportCards.length}` : null,
          },
          {
            id: "remarks",
            label: "Behavioral Remarks",
            icon: ClipboardList,
            badge: `${activeWard.behavioralRemarks.length}`,
          },
        ],
      },
      {
        title: "Accounts & Services",
        icon: CreditCard,
        items: [
          {
            id: "fees",
            label: "School Fee Bills",
            icon: Receipt,
            badge: activeWard.metrics.outstandingFees > 0 ? "Due" : null,
          },
          {
            id: "proof",
            label: "Upload Proof of Payment",
            icon: CreditCard,
            badge: "Submit",
          },
          {
            id: "noticeboard",
            label: "School Noticeboard",
            icon: Bell,
            badge: initialData.notices.length ? `${initialData.notices.length}` : null,
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
      initialData.wards.length,
      activeWard.metrics.attendanceRate,
      activeWard.reportCards.length,
      activeWard.behavioralRemarks.length,
      activeWard.metrics.outstandingFees,
      initialData.notices.length,
    ]
  );

  // Auto-expand accordion section containing the active tab
  useEffect(() => {
    const currentGroup = navSections.find((g) => g.items.some((it) => it.id === activeTab));
    if (currentGroup) {
      setExpandedSection((prev) => (prev !== currentGroup.title ? currentGroup.title : prev));
    }
  }, [activeTab, navSections]);

  // Submit proof of payment action
  const handleSubmitProof = (e: React.FormEvent) => {
    e.preventDefault();
    setProofStatus(null);

    const amt = parseFloat(proofForm.amount);
    if (!amt || amt <= 0) {
      setProofStatus({ type: "error", text: "Please enter a valid payment amount." });
      return;
    }
    if (!proofForm.sessionId.trim()) {
      setProofStatus({ type: "error", text: "Please enter the bank transaction ref or teller session ID." });
      return;
    }

    startTransition(async () => {
      const res = await submitParentPaymentProofAction({
        schoolId: initialData.school.id,
        studentId: activeWard.id,
        studentName: activeWard.name,
        admissionNumber: activeWard.admissionNumber,
        amount: amt,
        paidAt: proofForm.paidAt,
        payerBankName: proofForm.payerBankName,
        payerAccountName: proofForm.payerAccountName || initialData.parent.name,
        sessionId: proofForm.sessionId.trim(),
      });

      if (res.success) {
        setProofStatus({
          type: "success",
          text: `Payment proof of ${formatNaira(amt)} submitted for ${activeWard.name}. Bursar audit queue has been notified.`,
        });
        setProofForm({
          amount: "",
          payerBankName: "First Bank of Nigeria",
          payerAccountName: "",
          sessionId: "",
          paidAt: new Date().toISOString().split("T")[0],
        });
      } else {
        setProofStatus({ type: "error", text: res.error || "Submission failed." });
      }
    });
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

      {/* 1. Structural Left Side-Panel (Slate/Charcoal Premium Branding) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-72 md:min-w-[18rem] md:max-w-[18rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
          isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
        }`}
      >
        {/* Consolidated Parent / Institution Header Block */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-slate-700 via-slate-800 to-zinc-900 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs border border-white/10 tracking-tight shrink-0 relative">
              {parentInitials}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-900 dark:ring-zinc-950 shadow-xs"
                title="Parent Active"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-slate-100 truncate block">
                  {initialData.school.name}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                PARENT & GUARDIAN PORTAL
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
              (expandedSection === "My Wards (Children)" && gIdx === 0);
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
                      ? "bg-slate-800 text-white font-bold"
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
                              ? "bg-slate-800 text-white font-bold border-l-2 border-indigo-400 shadow-2xs"
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
                {initialData.parent.name}
              </p>
              <p className="text-[9px] text-slate-400 font-mono truncate">
                {initialData.parent.relationship}
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
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 shrink-0">
                    Parent
                  </span>
                  <span className="text-slate-400 dark:text-zinc-600 text-xs hidden sm:inline">•</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate hidden sm:inline">
                    Ward: <strong className="text-slate-800 dark:text-zinc-200">{activeWard.name}</strong> ({activeWard.currentClass})
                  </span>
                </div>
                <h1 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white truncate mt-0.5">
                  {activeTab === "overview" && "Family Overview & Ward Progress"}
                  {activeTab === "attendance" && "Children's Attendance Records"}
                  {activeTab === "timetable" && "Academic Timetables"}
                  {activeTab === "reportcards" && "Terminal Report Cards"}
                  {activeTab === "remarks" && terminology.behavioralRemarksLabel}
                  {activeTab === "fees" && "School Fee Bills & Invoices"}
                  {activeTab === "proof" && "Upload Proof of Payment"}
                  {activeTab === "noticeboard" && "School Noticeboard & Circulars"}
                  {activeTab === "profile" && "Parent Profile & Ward Settings"}
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
                  title="School Notices"
                >
                  <Bell className="w-4 h-4" />
                  {initialData.notices.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-600 ring-2 ring-white dark:ring-zinc-900" />
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
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-slate-700 via-slate-800 to-zinc-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    {parentInitials}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[110px]">
                      {initialData.parent.name.split(" ")[0]}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                      Parent
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in duration-150">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {initialData.parent.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                        {initialData.parent.email}
                      </p>
                      <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {initialData.parent.relationship}
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
                        <User className="w-4 h-4 text-slate-500" />
                        <span>Parent Profile</span>
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
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
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

        {/* Global Alert Notification */}
        {proofStatus && (
          <div className="px-4 sm:px-8 pt-4">
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                proofStatus.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {proofStatus.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{proofStatus.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setProofStatus(null)}
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
          {/* MULTI-CHILD SELECTOR (REQUIREMENT 4)                                      */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                Select Registered Ward
              </span>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Switching child dynamically toggles attendance, timetables, report cards, and tuition bills.
              </p>
            </div>

            {/* Child Tab Picker */}
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
              {initialData.wards.map((ward) => {
                const isSelected = ward.id === selectedWardId;
                return (
                  <button
                    key={ward.id}
                    type="button"
                    onClick={() => setSelectedWardId(ward.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-zinc-700"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-zinc-600"
                      }`}
                    />
                    <span>{ward.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({ward.currentClass})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: FAMILY OVERVIEW (METRICS LAYOUT - REQUIREMENT 5)                   */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Parent Hero Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-slate-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2 max-w-xl">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/50">
                      Family Desk • {activeWard.name}&apos;s Academic Summary
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Welcome, {initialData.parent.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      You are viewing real-time educational progress for <strong>{activeWard.name}</strong> enrolled in{" "}
                      {activeWard.currentClass}. Total family outstanding fees across all {initialData.wards.length} registered wards is{" "}
                      <strong className="text-slate-200 font-mono">{formatNaira(initialData.familyTotals.totalOutstandingFeesAllWards)}</strong>.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("proof")}
                      className="px-4 py-2.5 rounded-xl bg-white text-slate-950 font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer hover:bg-slate-100"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Upload Proof of Payment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("reportcards")}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Award className="w-4 h-4" />
                      <span>Report Cards</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Family Overview Metrics Layout (Requirement 5) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Average Attendance Rate */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Average Attendance Rate
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {activeWard.metrics.attendanceRate}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">{activeWard.name.split(" ")[0]}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span>Family Avg: {initialData.familyTotals.overallFamilyAttendanceRate}%</span>
                  </div>
                </div>

                {/* 2. Pending Homework/Assignments */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Pending Homework
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {activeWard.metrics.pendingHomeworkCount}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Active Tasks</span>
                  </div>
                  <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <span>Coursework Submissions</span>
                  </div>
                </div>

                {/* 3. Overall Academic Standing */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Academic Standing
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {activeWard.metrics.academicStandingLetter}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                    <span>Average CA: {activeWard.metrics.academicAverage}%</span>
                  </div>
                </div>

                {/* 4. Total Outstanding Fees across all wards */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Family Fees Balance
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {formatNaira(initialData.familyTotals.totalOutstandingFeesAllWards)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400 font-bold flex items-center gap-1">
                    <span>{initialData.wards.length} children combined</span>
                  </div>
                </div>
              </div>

              {/* Grid: Ward Progress & Recent Notices */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Ward Terminal Snapshot */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {activeWard.name}&apos;s Academic Progress
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {activeWard.currentClass} • {activeWard.tierName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("reportcards")}
                      className="text-xs font-bold text-slate-700 dark:text-zinc-300 hover:underline flex items-center gap-1"
                    >
                      <span>View Transcripts</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {activeWard.reportCards.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        Report cards are being finalized for {activeWard.name}.
                      </div>
                    ) : (
                      activeWard.reportCards.map((rc) => (
                        <div
                          key={rc.id}
                          className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between"
                        >
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                              {rc.term} • {rc.academicYear}
                            </span>
                            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                              {rc.className} Final Performance Transcript
                            </p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                              Passed {rc.passedSubjects} of {rc.totalSubjects} curriculum subjects
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                              {rc.averageScore}%
                            </span>
                            <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Grade {rc.gradeLetter}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* School Circulars */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                      <span>Parent Circulars</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("noticeboard")}
                      className="text-xs font-bold text-slate-700 dark:text-zinc-300 hover:underline"
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
          {/* TAB 2: CHILDREN'S ATTENDANCE                                              */}
          {/* ========================================================================= */}
          {activeTab === "attendance" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {activeWard.name}&apos;s Attendance Records
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Statutory daily presence and classroom roll calls.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  Presence Rate: {activeWard.metrics.attendanceRate}%
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Class Session</th>
                        <th className="py-3 px-4">Presence Status</th>
                        <th className="py-3 px-4 text-right">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {activeWard.attendanceHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No attendance logs found for {activeWard.name}.
                          </td>
                        </tr>
                      ) : (
                        activeWard.attendanceHistory.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {att.date}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                              {activeWard.currentClass}
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
                              {att.notes || "Official Roll"}
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
          {/* TAB 3: ACADEMIC TIMETABLES                                                */}
          {/* ========================================================================= */}
          {activeTab === "timetable" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {activeWard.name}&apos;s Academic Timetable
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Subject schedules, classrooms, and assigned subject educators for {activeWard.currentClass}.
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Day</th>
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4">Educator</th>
                        <th className="py-3 px-4 text-right">Classroom</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {activeWard.timetable.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {t.dayOfWeek}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-400">
                            {t.startTime} - {t.endTime}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                            {t.subjectName} ({t.subjectCode})
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                            {t.teacherName}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-500">
                            {t.classroomName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: TERMINAL REPORT CARDS (WITH PRINT OPTIONS)                          */}
          {/* ========================================================================= */}
          {activeTab === "reportcards" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {activeWard.name}&apos;s Terminal Report Cards
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Official verified examination results, subject breakdowns, and school principal remarks.
                  </p>
                </div>
              </div>

              {activeWard.reportCards.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                  <Award className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                    No Published Report Cards Available
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Terminal report sheets are published by the administration at the conclusion of each term.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {activeWard.reportCards.map((rc) => (
                    <div
                      key={rc.id}
                      className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                            {rc.academicYear} • {rc.term}
                          </span>
                          <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                            {rc.className} Official Assessment
                          </h3>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                            {rc.averageScore}%
                          </span>
                          <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Grade {rc.gradeLetter}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-1.5 text-xs">
                        <p className="text-slate-600 dark:text-zinc-300">
                          Class Standing: <strong>{rc.classPosition || 1}</strong> of {rc.totalStudentsInClass || 30} students
                        </p>
                        <p className="text-slate-600 dark:text-zinc-300">
                          Passed Disciplines: <strong>{rc.passedSubjects}</strong> of {rc.totalSubjects}
                        </p>
                        {rc.principalRemarks && (
                          <p className="text-slate-500 italic mt-1 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                            Principal: &ldquo;{rc.principalRemarks}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Official Transcript</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: BEHAVIORAL REMARKS                                                 */}
          {/* ========================================================================= */}
          {activeTab === "remarks" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {terminology.behavioralRemarksLabel}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Observations regarding {activeWard.name}&apos;s character, decorum, and team collaboration.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {activeWard.behavioralRemarks.map((remark, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {remark.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {remark.date}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed italic">
                      &ldquo;{remark.remark}&rdquo;
                    </p>
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white">
                      — {remark.teacher}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: SCHOOL FEE BILLS                                                   */}
          {/* ========================================================================= */}
          {activeTab === "fees" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    School Fee Bills for {activeWard.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Download official tuition vouchers and review payment statuses.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs">
                  Outstanding: {formatNaira(activeWard.metrics.outstandingFees)}
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
                        <th className="py-3 px-4">Amount Due</th>
                        <th className="py-3 px-4 text-right">Invoice Statement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {activeWard.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No billing statements found. All fees for {activeWard.name} are cleared!
                          </td>
                        </tr>
                      ) : (
                        activeWard.invoices.map((inv) => (
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
                                onClick={() => window.print()}
                                className="px-3 py-1 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 transition cursor-pointer flex items-center gap-1.5 ml-auto"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Bill</span>
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
          {/* TAB 7: UPLOAD PROOF OF PAYMENT                                            */}
          {/* ========================================================================= */}
          {activeTab === "proof" && (
            <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl">
              <div className="pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Upload Proof of Payment
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Submit bank transfer session codes or teller receipts directly to the Bursar for credit reconciliation.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                <form onSubmit={handleSubmitProof} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                      Beneficiary Ward:
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${activeWard.name} (${activeWard.admissionNumber})`}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-700 dark:text-zinc-300 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                      Amount Paid (₦): *
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 150000"
                      value={proofForm.amount}
                      onChange={(e) => setProofForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                        Payer Bank:
                      </label>
                      <select
                        value={proofForm.payerBankName}
                        onChange={(e) => setProofForm((prev) => ({ ...prev, payerBankName: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                      >
                        <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                        <option value="Zenith Bank">Zenith Bank</option>
                        <option value="GTBank (Guaranty Trust)">GTBank</option>
                        <option value="Access Bank">Access Bank</option>
                        <option value="United Bank for Africa (UBA)">UBA</option>
                        <option value="Stanbic IBTC">Stanbic IBTC</option>
                        <option value="Kuda / OPay / PalmPay">Digital Bank / FinTech</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                        Payment Date:
                      </label>
                      <input
                        type="date"
                        value={proofForm.paidAt}
                        onChange={(e) => setProofForm((prev) => ({ ...prev, paidAt: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                      NIP Session ID / Transaction Reference: *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 11000424092019283749201"
                      value={proofForm.sessionId}
                      onChange={(e) => setProofForm((prev) => ({ ...prev, sessionId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>{isPending ? "Submitting to Bursar..." : "Submit Proof to Bursary"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: SCHOOL NOTICEBOARD                                                 */}
          {/* ========================================================================= */}
          {activeTab === "noticeboard" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    School Noticeboard & Circulars
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Official memos, PTA notices, and academic calendars.
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
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
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
          {/* TAB 9: PARENT PROFILE SETTINGS                                            */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
              <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-slate-500/10 via-transparent to-transparent rounded-bl-full pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-slate-700 via-slate-800 to-zinc-900 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shrink-0 shadow-md ring-4 ring-slate-100 dark:ring-zinc-800">
                    {parentInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                        {initialData.parent.relationship}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {initialData.wards.length} Wards Enrolled
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                      {initialData.parent.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                      {initialData.parent.email} • {initialData.parent.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("security")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                      <span>Security & Password</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <Building2 className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
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
                      <dd className="font-mono text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                        {initialData.school.subdomain}.school.edu
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Strict Ward Privacy
                    </h3>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Privacy Isolation</dt>
                      <dd className="font-bold text-emerald-600 dark:text-emerald-400">
                        Relational Ward Filtering Only
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Corporate Finance Access</dt>
                      <dd className="text-slate-500 font-semibold">Strictly Blocked</dd>
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
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                          Account Information
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 shrink-0">
                          Guardian Primary
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                        {initialData.parent.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowChangeEmailModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 transition shadow-2xs cursor-pointer shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Change email</span>
                  </button>
                </div>
              </div>

              <SecurityPasswordForm
                schoolDomain={schoolDomain}
                userRole="PARENT"
                brandColor="#334155"
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
                  initialEmail={initialData.parent.email}
                  brandColor="#334155"
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
          aria-label="Parent Mobile Bottom Bar"
        >
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] ${
              activeTab === "overview"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <Heart className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] ${
              activeTab === "attendance"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reportcards")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] ${
              activeTab === "reportcards"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <Award className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("fees")}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[56px] relative ${
              activeTab === "fees"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-zinc-400 font-medium"
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Fees</span>
            {activeWard.metrics.outstandingFees > 0 && (
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
              Log out of Parent Portal?
            </h3>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Are you sure you want to exit your active guardian session for{" "}
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
                onClick={() => {
                  if (isLoggingOut) return;
                  setIsLoggingOut(true);
                  performTenantLogout(schoolDomain);
                }}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
