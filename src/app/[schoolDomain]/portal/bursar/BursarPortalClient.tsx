"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback, useTransition } from "react";
import {
  CreditCard,
  FileText,
  TrendingDown,
  BookOpen,
  DollarSign,
  Users,
  AlertTriangle,
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
  Receipt,
  Printer,
  Download,
  Wallet,
  Clock,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Phone,
  FileCheck,
  Copy,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import ChangeEmailCard from "@/components/ChangeEmailCard";
import {
  BursarPortalData,
  verifyPaymentProofAction,
  disbursePayrollRecordAction,
} from "./actions";

interface BursarPortalClientProps {
  initialData: BursarPortalData;
  schoolDomain: string;
  defaultTab?: string;
}

function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BursarPortalClient({
  initialData,
  schoolDomain,
  defaultTab = "overview",
}: BursarPortalClientProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  // Local state for dynamic updates
  const [pendingProofs, setPendingProofs] = useState(initialData.pendingProofs);
  const [payrollList, setPayrollList] = useState(initialData.payroll);
  const [feeSearchQuery, setFeeSearchQuery] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("ALL");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Application Fees & Admissions Payments state for cross-referencing
  const [admissionsApplications, setAdmissionsApplications] = useState<any[]>([]);
  const [admissionsLoading, setAdmissionsLoading] = useState(false);
  const [admissionsSearch, setAdmissionsSearch] = useState("");
  const [appFeeFilter, setAppFeeFilter] = useState("ALL");
  const [selectedProofPreview, setSelectedProofPreview] = useState<any | null>(null);
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null);

  const fetchAdmissionsForBursar = useCallback(async () => {
    setAdmissionsLoading(true);
    try {
      const res = await fetch(`/api/v1/admissions?status=ALL&tenant_id=${encodeURIComponent(schoolDomain)}`, {
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": schoolDomain,
        },
      });
      if (res.ok) {
        const json = await res.json();
        setAdmissionsApplications(json.data || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setAdmissionsLoading(false);
    }
  }, [schoolDomain]);

  useEffect(() => {
    if (activeTab === "application-fees" && admissionsApplications.length === 0) {
      fetchAdmissionsForBursar();
    }
  }, [activeTab, fetchAdmissionsForBursar, admissionsApplications.length]);

  // Combined cross-referenced admission applications and registration payment proofs
  const crossReferencedAdmissions = useMemo(() => {
    return admissionsApplications.filter((app) => {
      const query = admissionsSearch.toLowerCase();
      const fullName = `${app.firstName || ""} ${app.lastName || ""}`.toLowerCase();
      const appNo = (app.applicationNo || "").toLowerCase();
      const classApplied = (app.classApplied || "").toLowerCase();
      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        appNo.includes(query) ||
        classApplied.includes(query);

      const status = (app.status || "new").toLowerCase();
      const matchesFilter =
        appFeeFilter === "ALL" ||
        (appFeeFilter === "admitted" && status === "admitted") ||
        (appFeeFilter === "pending" && (status === "docs_pending" || status === "under_review" || status === "new"));

      return matchesSearch && matchesFilter;
    });
  }, [admissionsApplications, admissionsSearch, appFeeFilter]);

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

  const bursarInitials = useMemo(() => {
    const parts = initialData.bursar.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || "B").toUpperCase();
  }, [initialData.bursar.name]);

  // Sidebar navigation structure strictly adhering to Financial RBAC
  const navSections = [
    {
      title: "FINANCE HUB",
      items: [
        {
          id: "overview",
          label: "Treasury Command",
          icon: Wallet,
          badge: null,
        },
        {
          id: "fees",
          label: "Fee Collection Panels",
          icon: CreditCard,
          badge: initialData.recentPayments.length ? `${initialData.recentPayments.length}` : null,
        },
        {
          id: "application-fees",
          label: "Application Fees",
          icon: Receipt,
          badge: null,
        },
        {
          id: "invoices",
          label: "Invoice Generation",
          icon: FileText,
          badge: `${initialData.invoices.length}`,
        },
        {
          id: "expenses",
          label: "Expense Trackers",
          icon: TrendingDown,
          badge: null,
        },
        {
          id: "ledger",
          label: "Financial Ledger Books",
          icon: BookOpen,
          badge: null,
        },
      ],
    },
    {
      title: "ACCOUNT DESK",
      items: [
        {
          id: "payments",
          label: "Student Payment Disbursals",
          icon: Receipt,
          badge: pendingProofs.length ? `${pendingProofs.length} audit` : null,
        },
        {
          id: "payroll",
          label: "Staff Payroll Disbursals",
          icon: Users,
          badge: null,
        },
        {
          id: "arrears",
          label: "Fee Arrears Lists",
          icon: AlertTriangle,
          badge: initialData.arrears.length ? `${initialData.arrears.length}` : null,
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

  // Filtered recent fees collection
  const filteredFees = useMemo(() => {
    return initialData.recentPayments.filter((p) => {
      const matchesMethod = selectedMethod === "ALL" || p.method.toUpperCase() === selectedMethod.toUpperCase();
      const query = feeSearchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        p.studentName.toLowerCase().includes(query) ||
        p.admissionNumber.toLowerCase().includes(query) ||
        p.className.toLowerCase().includes(query);
      return matchesMethod && matchesSearch;
    });
  }, [initialData.recentPayments, selectedMethod, feeSearchQuery]);

  // Handle Payment Proof Verification
  const handleVerifyProof = (proofId: string, status: "APPROVED" | "REJECTED") => {
    setStatusMessage(null);
    startTransition(async () => {
      const res = await verifyPaymentProofAction(initialData.school.id, proofId, status);
      if (res.success) {
        setPendingProofs((prev) => prev.filter((p) => p.id !== proofId));
        setStatusMessage({
          type: "success",
          text: `Payment verification proof ${status === "APPROVED" ? "approved & credited" : "rejected"}`,
        });
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to process verification" });
      }
    });
  };

  // Handle Payroll Disbursal
  const handleDisbursePayroll = (recordId: string) => {
    setStatusMessage(null);
    startTransition(async () => {
      const res = await disbursePayrollRecordAction(initialData.school.id, recordId);
      if (res.success) {
        setPayrollList((prev) =>
          prev.map((pr) => (pr.id === recordId ? { ...pr, status: "PAID" } : pr))
        );
        setStatusMessage({ type: "success", text: "Payroll record disbursed successfully." });
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to disburse payroll" });
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

      {/* 1. Structural Left Side-Panel (Mirroring Teacher & Principal design) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-72 md:min-w-[18rem] md:max-w-[18rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
          isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
        }`}
      >
        {/* Consolidated Bursar / Institution Header Block */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-600 to-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs border border-white/10 tracking-tight shrink-0 relative">
              {bursarInitials}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-slate-900 dark:ring-zinc-950 shadow-xs"
                title="Bursar Active"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-slate-100 truncate block">
                  {initialData.school.name}
                </span>
              </div>
              <p className="text-[10px] text-cyan-400/90 font-bold uppercase tracking-wider truncate">
                CHIEF BURSAR & FINANCE
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
                          ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-xs"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? "text-cyan-400" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider shrink-0 ${
                            isActive
                              ? "bg-cyan-400 text-slate-950 font-black"
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
                {initialData.bursar.name}
              </p>
              <p className="text-[9px] text-slate-400 truncate">
                {initialData.bursar.email}
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
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 shrink-0">
                    Bursar Portal
                  </span>
                  <span className="text-slate-400 dark:text-zinc-600 text-xs hidden sm:inline">•</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate hidden sm:inline">
                    {initialData.school.name}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate mt-0.5">
                  {activeTab === "overview" && "Treasury & Financial Overview"}
                  {activeTab === "fees" && "Fee Collection Panels"}
                  {activeTab === "application-fees" && "Application Fees & Admissions Payments"}
                  {activeTab === "invoices" && "Invoice Generation & Billing"}
                  {activeTab === "expenses" && "Expense Trackers & Disbursements"}
                  {activeTab === "ledger" && "Financial Ledger Books"}
                  {activeTab === "payments" && "Student Payment Disbursals & Proofs"}
                  {activeTab === "payroll" && "Staff Payroll Disbursals"}
                  {activeTab === "arrears" && "Fee Arrears Lists & Recovery"}
                  {activeTab === "profile" && "Bursar Profile & Treasury Scope"}
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
                  className="p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition relative"
                  title="Financial Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {pendingProofs.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-500 ring-2 ring-white dark:ring-zinc-900" />
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
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-teal-600 to-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    {bursarInitials}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[110px]">
                      {initialData.bursar.name.split(" ")[0]}
                    </p>
                    <p className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                      Bursar
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in duration-150">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {initialData.bursar.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                        {initialData.bursar.email}
                      </p>
                      <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                        Bursar Controller
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
                        <User className="w-4 h-4 text-cyan-500" />
                        <span>Bursar Profile</span>
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
          {/* TAB 1: TREASURY OVERVIEW (ACCOUNTING STATISTIC METRICS GRID)               */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Financial Hero Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2 max-w-xl">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Treasury Console
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Financial Desk • {initialData.school.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      All tuition accounts, fee payments, and expenditure journals are synchronized under strict financial RBAC.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("payments")}
                      className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Audit Proofs ({pendingProofs.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("invoices")}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Review Invoices</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Accounting Statistic Metrics Grid (Requirement 4) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Fees Collected */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Total Fees Collected
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {formatNaira(initialData.metrics.totalFeesCollected)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span>Verified Receipts</span>
                  </div>
                </div>

                {/* 2. Outstanding Balances */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Outstanding Balances
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                      {formatNaira(initialData.metrics.totalOutstandingBalances)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                    <span>{initialData.arrears.length} students with arrears</span>
                  </div>
                </div>

                {/* 3. Total Expenses Logged */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Total Expenses Logged
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {formatNaira(initialData.metrics.totalExpensesLogged)}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <span>Operations & Maintenance</span>
                  </div>
                </div>

                {/* 4. Pending Invoice Approvals */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Pending Approvals
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {initialData.metrics.pendingInvoiceApprovals}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">Tellers</span>
                  </div>
                  <div className="mt-2 text-[11px] text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-1">
                    <span>Audit Queue Pending</span>
                  </div>
                </div>
              </div>

              {/* Grid: Pending Proofs & Recent Fee Receipts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pending Verification Queue */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Bank Transfer Proof Verification Queue
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Review uploaded teller receipts and credit student invoices
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400">
                      {pendingProofs.length} Awaiting Audit
                    </span>
                  </div>

                  {pendingProofs.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        All bank transfers are verified!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingProofs.slice(0, 4).map((proof) => (
                        <div
                          key={proof.id}
                          className="p-3.5 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {proof.studentName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({proof.admissionNumber})
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                              {proof.payerBankName} • Ref: {proof.sessionId}
                            </p>
                            <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {formatNaira(proof.amount)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleVerifyProof(proof.id, "APPROVED")}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Credit & Approve</span>
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleVerifyProof(proof.id, "REJECTED")}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Fee Collection Feed */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-cyan-500" />
                      <span>Recent Collections</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("fees")}
                      className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                      View All
                    </button>
                  </div>

                  <div className="space-y-3">
                    {initialData.recentPayments.slice(0, 5).map((pay) => (
                      <div
                        key={pay.id}
                        className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {pay.studentName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {pay.method} • {pay.paymentDate}
                          </p>
                        </div>
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {formatNaira(pay.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FEE COLLECTION PANELS                                              */}
          {/* ========================================================================= */}
          {activeTab === "fees" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Fee Collection Panels
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    All processed student tuition payments, teller entries, and verified credit receipts.
                  </p>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  Total Records: <strong>{initialData.recentPayments.length}</strong>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={feeSearchQuery}
                    onChange={(e) => setFeeSearchQuery(e.target.value)}
                    placeholder="Search by student name or class..."
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {["ALL", "CASH", "TRANSFER", "CARD"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMethod(m)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        selectedMethod === m
                          ? "bg-cyan-500 text-slate-950 shadow-xs"
                          : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Channel</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4 text-right">Amount Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredFees.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No collection records matching filters.
                          </td>
                        </tr>
                      ) : (
                        filteredFees.map((pay) => (
                          <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {pay.studentName}
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {pay.admissionNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                              {pay.className}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60">
                                {pay.method}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 font-mono">
                              {pay.paymentDate}
                            </td>
                            <td className="py-3 px-4 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">
                              {formatNaira(pay.amount)}
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
          {/* TAB: APPLICATION FEES & ADMISSIONS PAYMENTS CROSS-REFERENCE               */}
          {/* ========================================================================= */}
          {activeTab === "application-fees" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Application Fees & Admissions Payments
                    </h2>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/60">
                      Bursar Verification Desk
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Reconcile application fee transactions, teller proofs, and registration deposits for incoming student admissions.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fetchAdmissionsForBursar()}
                    disabled={admissionsLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${admissionsLoading ? "animate-spin" : ""}`} />
                    <span>Sync Registry</span>
                  </button>
                  <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    {admissionsApplications.length} Registered Candidates
                  </span>
                </div>
              </div>

              {/* Admissions Payment KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Total Applicants Tracked
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {admissionsApplications.length}
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Pending Clearance
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {admissionsApplications.filter((a) => a.status !== "admitted").length}
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Admitted & Fee-Cleared
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {admissionsApplications.filter((a) => a.status === "admitted").length}
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                    Audit Queue Proofs
                  </p>
                  <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                    {pendingProofs.length}
                  </p>
                </div>
              </div>

              {/* Incoming Payment Proofs Clearance Section */}
              {pendingProofs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Pending Audit Proofs ({pendingProofs.length})
                    </h3>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      Requires Bursar Sign-off
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingProofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                              Application / Bank Proof
                            </span>
                            <h4 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                              {proof.studentName}
                            </h4>
                            <p className="text-xs text-slate-400 font-mono">
                              Ref/Admission: {proof.admissionNumber}
                            </p>
                          </div>
                          <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {formatNaira(proof.amount)}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-1 text-xs">
                          <p className="text-slate-500">
                            Bank: <strong>{proof.payerBankName}</strong>
                          </p>
                          <p className="text-slate-500">
                            Session / Teller: <strong className="font-mono">{proof.sessionId}</strong>
                          </p>
                          <p className="text-slate-500">
                            Payment Date: <strong>{proof.paidAt}</strong>
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleVerifyProof(proof.id, "REJECTED")}
                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 transition cursor-pointer"
                          >
                            Reject Proof
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleVerifyProof(proof.id, "APPROVED")}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify & Clear</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidates & Registration Cross-Reference Roster */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={admissionsSearch}
                      onChange={(e) => setAdmissionsSearch(e.target.value)}
                      placeholder="Cross-reference candidate by name, application number, or class..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      value={appFeeFilter}
                      onChange={(e) => setAppFeeFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30"
                    >
                      <option value="ALL">All Application Stages</option>
                      <option value="pending">Pending Clearance</option>
                      <option value="admitted">Admitted & Cleared</option>
                    </select>
                  </div>
                </div>

                {admissionsLoading ? (
                  <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                    <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                      Cross-referencing Admissions Registry...
                    </p>
                  </div>
                ) : crossReferencedAdmissions.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                    <Receipt className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                      No candidate application records matching criteria
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      New registrations will appear here for bursar payment cross-referencing.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 uppercase tracking-wider font-extrabold text-[10px]">
                          <tr>
                            <th className="px-5 py-3.5">Application No</th>
                            <th className="px-5 py-3.5">Candidate Name</th>
                            <th className="px-5 py-3.5">Class Applied</th>
                            <th className="px-5 py-3.5">Parent Contact</th>
                            <th className="px-5 py-3.5">Admissions Status</th>
                            <th className="px-5 py-3.5">Fee Clearance</th>
                            <th className="px-5 py-3.5 text-right">Reference Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {crossReferencedAdmissions.map((candidate) => {
                            const isAdmitted = candidate.status?.toLowerCase() === "admitted";
                            return (
                              <tr
                                key={candidate.id}
                                className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition"
                              >
                                <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span>{candidate.applicationNo}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(candidate.applicationNo);
                                        setCopiedAppId(candidate.applicationNo);
                                        setTimeout(() => setCopiedAppId(null), 2000);
                                      }}
                                      title="Copy Application Number"
                                      className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    {copiedAppId === candidate.applicationNo && (
                                      <span className="text-[10px] text-emerald-500 font-bold">Copied!</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                                  {candidate.firstName} {candidate.lastName}
                                </td>
                                <td className="px-5 py-4 font-semibold text-slate-600 dark:text-zinc-300">
                                  {candidate.classApplied}
                                </td>
                                <td className="px-5 py-4 text-slate-500 dark:text-zinc-400">
                                  <p className="font-mono">{candidate.parentPhone || "—"}</p>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                      isAdmitted
                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                        : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                                    }`}
                                  >
                                    {candidate.status || "new"}
                                  </span>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                      isAdmitted
                                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                        : "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                    }`}
                                  >
                                    {isAdmitted ? "Fee Cleared" : "Clearance In Progress"}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedProofPreview(candidate)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold transition text-xs cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                    <span>Cross-Reference</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Cross-Reference Detail Drawer/Modal */}
              {selectedProofPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
                  <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40">
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          Admissions Fee Cross-Reference
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          Verification record for {selectedProofPreview.firstName} {selectedProofPreview.lastName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProofPreview(null)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Application No</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedProofPreview.applicationNo}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Class Applied</span>
                          <span className="font-bold text-slate-900 dark:text-white">{selectedProofPreview.classApplied}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Parent Phone</span>
                          <span className="font-mono text-slate-700 dark:text-zinc-300">{selectedProofPreview.parentPhone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Admissions Status</span>
                          <span className="font-bold uppercase text-cyan-600 dark:text-cyan-400">{selectedProofPreview.status}</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 text-xs text-cyan-800 dark:text-cyan-300">
                        <p className="font-bold">Bursary Cross-Reference Checklist</p>
                        <p className="mt-0.5 text-[11px] text-cyan-700 dark:text-cyan-400/90 leading-relaxed">
                          Confirm that the candidate&apos;s registration deposit or application form fee matches the official tenant account records before validating clearance for formal matriculation.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                      <button
                        type="button"
                        onClick={() => setSelectedProofPreview(null)}
                        className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-950 text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: INVOICE GENERATION & BILLING                                       */}
          {/* ========================================================================= */}
          {activeTab === "invoices" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Invoice Generation & Student Accounts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Termly school fee billings, credit balances, and payment statuses.
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Student & Class</th>
                        <th className="py-3 px-4">Billing Item</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Amount Due</th>
                        <th className="py-3 px-4 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {initialData.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {inv.studentName}
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {inv.className} • {inv.admissionNumber}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">
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
                                  : inv.status === "PARTIAL"
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {formatNaira(inv.amountDue)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {formatNaira(inv.balance)}
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
          {/* TAB 4: EXPENSE TRACKERS                                                   */}
          {/* ========================================================================= */}
          {activeTab === "expenses" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Expense Trackers & Outflows
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Operational disbursements, facility maintenance, and procurement expenditures.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  Total: {formatNaira(initialData.metrics.totalExpensesLogged)}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Date Logged</th>
                        <th className="py-3 px-4 text-right">Amount Outflow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {initialData.expenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No expense transactions recorded.
                          </td>
                        </tr>
                      ) : (
                        initialData.expenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {exp.description}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                {exp.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                              {exp.createdAt}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                              -{formatNaira(exp.amount)}
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
          {/* TAB 5: FINANCIAL LEDGER BOOKS                                             */}
          {/* ========================================================================= */}
          {activeTab === "ledger" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Financial Ledger Books
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Double-entry style financial journal records of institutional income and expense debits.
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {initialData.ledger.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                            {entry.date}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                entry.type === "INCOME"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                              }`}
                            >
                              {entry.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 font-semibold">
                            {entry.category}
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-white">
                            {entry.description}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-black ${
                              entry.type === "INCOME"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {entry.type === "INCOME" ? "+" : "-"}
                            {formatNaira(entry.amount)}
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
          {/* TAB 6: STUDENT PAYMENT DISBURSALS & PROOFS                                */}
          {/* ========================================================================= */}
          {activeTab === "payments" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Student Payment Disbursals & Proofs
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Active teller verification queue and direct bank receipt reconciliations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingProofs.length === 0 ? (
                  <div className="md:col-span-2 p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                      Audit Queue Cleared
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      No incoming student payment proofs currently awaiting bursar authorization.
                    </p>
                  </div>
                ) : (
                  pendingProofs.map((proof) => (
                    <div
                      key={proof.id}
                      className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                            Bank Transfer Proof
                          </span>
                          <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                            {proof.studentName}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono">
                            {proof.admissionNumber}
                          </p>
                        </div>
                        <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {formatNaira(proof.amount)}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 space-y-1 text-xs">
                        <p className="text-slate-500">
                          Bank: <strong>{proof.payerBankName}</strong>
                        </p>
                        <p className="text-slate-500">
                          Session Ref: <strong className="font-mono">{proof.sessionId}</strong>
                        </p>
                        <p className="text-slate-500">
                          Date: <strong>{proof.paidAt}</strong>
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleVerifyProof(proof.id, "REJECTED")}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 transition cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleVerifyProof(proof.id, "APPROVED")}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Post</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: STAFF PAYROLL DISBURSALS                                           */}
          {/* ========================================================================= */}
          {activeTab === "payroll" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Staff Payroll Disbursals
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Faculty salary reconciliations, monthly payslip dispatches, and bank remittance vouchers.
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Faculty Member</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Scheduled Pay Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Net Remuneration</th>
                        <th className="py-3 px-4 text-right">Disbursal Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {payrollList.map((pr) => (
                        <tr key={pr.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {pr.staffName}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                            {pr.department}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                            {pr.payDate}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                pr.status === "PAID"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                              }`}
                            >
                              {pr.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {formatNaira(pr.amount)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {pr.status === "PENDING" ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleDisbursePayroll(pr.id)}
                                className="px-3 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] transition cursor-pointer"
                              >
                                Disburse Remittance
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-400">
                                {pr.receiptCode || "PROCESSED"}
                              </span>
                            )}
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
          {/* TAB 8: FEE ARREARS LISTS                                                  */}
          {/* ========================================================================= */}
          {activeTab === "arrears" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Fee Arrears Lists & Debt Recovery
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Accounts with outstanding balances requiring institutional follow-up or payment reminders.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-xs font-bold">
                  Total Arrears: {formatNaira(initialData.metrics.totalOutstandingBalances)}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Parent Contact</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4 text-right">Outstanding Arrears</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {initialData.arrears.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No student arrears registered! All accounts are in good standing.
                          </td>
                        </tr>
                      ) : (
                        initialData.arrears.map((arr) => (
                          <tr key={arr.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {arr.studentName}
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {arr.admissionNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">
                              {arr.className}
                            </td>
                            <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1.5">
                              {arr.parentPhone ? (
                                <>
                                  <Phone className="w-3 h-3 text-cyan-500" />
                                  <span>{arr.parentPhone}</span>
                                </>
                              ) : (
                                "No phone recorded"
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                              {arr.dueDate}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                              {formatNaira(arr.arrearsAmount)}
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
          {/* TAB 9: BURSAR PROFILE SETTINGS                                            */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
              <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-cyan-500/10 via-transparent to-transparent rounded-bl-full pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 via-teal-600 to-emerald-700 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shrink-0 shadow-md ring-4 ring-cyan-50 dark:ring-cyan-950/40">
                    {bursarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60">
                        {initialData.bursar.role}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {initialData.bursar.title}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                      {initialData.bursar.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                      {initialData.bursar.email} • {initialData.school.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("security")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Security & Password</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
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
                      <dt className="text-slate-500 dark:text-zinc-400">Domain Slug</dt>
                      <dd className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                        {initialData.school.subdomain}.school.edu
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Primary Responsibility</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        Treasury, Tuition & Disbursement Control
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      RBAC Privilege Guard
                    </h3>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Privilege Level</dt>
                      <dd className="font-bold text-emerald-600 dark:text-emerald-400">
                        Strict Finance & Accounts Authority
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Academic Segregation</dt>
                      <dd className="text-slate-600 dark:text-zinc-300 font-semibold">
                        Zero Lesson Note / Grade Access
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 dark:text-zinc-400">Tenant Integrity</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">Isolated Tenant Database</dd>
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
                    <div className="w-11 h-11 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                          Account Information
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 shrink-0">
                          Bursar Primary
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                        {initialData.bursar.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowChangeEmailModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 border border-cyan-200 dark:border-cyan-800/60 transition shadow-2xs cursor-pointer shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Change email</span>
                  </button>
                </div>
              </div>

              <SecurityPasswordForm
                schoolDomain={schoolDomain}
                userRole="BURSAR"
                brandColor="#0891b2"
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
                  initialEmail={initialData.bursar.email}
                  brandColor="#0891b2"
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
              End Bursar Session?
            </h3>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Are you sure you want to exit your active financial session for{" "}
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
