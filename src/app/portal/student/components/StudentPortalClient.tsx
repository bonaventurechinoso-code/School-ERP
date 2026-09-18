"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  StudentPortalWorkspaceData, 
  TierPresentationConfig,
  StudentPortalTab 
} from "../types";
import { getTierPresentationConfig, INSTITUTIONAL_TIER_PRESETS } from "../tier-config";
import { StudentProfileModule } from "./StudentProfileModule";
import { CommunicationsModule } from "./CommunicationsModule";
import { FeesFinanceModule } from "./FeesFinanceModule";
import { TransactionHistoryModule } from "./TransactionHistoryModule";
import { StudentReportCardPortalModule } from "./StudentReportCardPortalModule";
import { NavigationSidebar } from "./NavigationSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  GraduationCap, 
  Menu, 
  LogOut, 
  BookOpen, 
  CheckCircle2, 
  Award, 
  Calendar, 
  Clock, 
  ArrowRight, 
  ShieldAlert, 
  Layers,
  ChevronDown,
  ChevronRight,
  User,
  CreditCard,
  Megaphone,
  Receipt
} from "lucide-react";

interface StudentPortalClientProps {
  initialData: StudentPortalWorkspaceData;
  initialTab?: StudentPortalTab;
}

export function StudentPortalClient({ initialData, initialTab }: StudentPortalClientProps) {
  const [activeTab, setActiveTab] = useState<StudentPortalTab>(initialTab || "OVERVIEW");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTier, setActiveTier] = useState<string>(initialData.tierConfig.tierName);

  // Dynamic Tier Configuration (reacts to user switching preset or server tier)
  const currentTierConfig: TierPresentationConfig = React.useMemo(() => {
    return getTierPresentationConfig(activeTier);
  }, [activeTier]);

  const { school, student, communications, finance, isAccessDenied, isSuspended } = initialData;
  const [financeState, setFinanceState] = useState(finance);
  const [paymentBanner, setPaymentBanner] = useState<string | null>(null);

  // Model A Paystack Split Return Listener:
  // Detects return redirect from Paystack callback with payment=success
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "success" || params.get("reference")) {
        setActiveTab("FINANCE");
        const invoiceId = params.get("invoiceId") || "inv-ec-2";
        const amount = Number(params.get("amount")) || 15000;
        const ref = params.get("reference") || `PAY-${Date.now()}`;

        setPaymentBanner(`Payment of ₦${amount.toLocaleString()} settled successfully via Paystack (Ref: ${ref}). Funds routed directly to school account.`);

        setFinanceState((prev) => {
          if (prev.invoices.some((inv) => inv.id === invoiceId && (inv.status === "PAID" || inv.amountDue <= inv.amountPaid))) {
            return prev;
          }
          const targetInv = prev.invoices.find((i) => i.id === invoiceId);
          const invDesc = targetInv?.description || "Creche After-School Care & Play Material Levy";
          const updatedInvoices = prev.invoices.map((inv) => {
            if (inv.id === invoiceId) {
              return {
                ...inv,
                status: "PAID" as const,
                amountPaid: inv.amountDue,
              };
            }
            return inv;
          });

          const newPayment = {
            id: `pay-${Date.now()}`,
            reference: ref,
            invoiceId: invoiceId,
            invoiceDescription: invDesc,
            amountPaid: amount,
            paymentDate: new Date().toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }),
            method: "PAYSTACK",
            status: "VERIFIED" as const,
            receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
          };

          return {
            ...prev,
            invoices: updatedInvoices,
            totalPaid: prev.totalPaid + amount,
            outstandingBalance: Math.max(0, prev.outstandingBalance - amount),
            payments: [newPayment, ...prev.payments],
          };
        });
      }
    }
  }, []);

  const handlePaymentSuccess = (invoiceId: string, amountPaid: number, reference: string) => {
    setPaymentBanner(`Payment of ₦${amountPaid.toLocaleString()} settled successfully via Paystack (Ref: ${reference}). Funds routed directly to school account.`);
    setFinanceState((prev) => {
      const targetInv = prev.invoices.find((i) => i.id === invoiceId);
      const invDesc = targetInv?.description || "Creche After-School Care & Play Material Levy";
      const updatedInvoices = prev.invoices.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: "PAID" as const,
            amountPaid: inv.amountDue,
          };
        }
        return inv;
      });

      const newPayment = {
        id: `pay-${Date.now()}`,
        reference: reference,
        invoiceId: invoiceId,
        invoiceDescription: invDesc,
        amountPaid: amountPaid,
        paymentDate: new Date().toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }),
        method: "PAYSTACK",
        status: "VERIFIED" as const,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      };

      return {
        ...prev,
        invoices: updatedInvoices,
        totalPaid: prev.totalPaid + amountPaid,
        outstandingBalance: Math.max(0, prev.outstandingBalance - amountPaid),
        payments: [newPayment, ...prev.payments],
      };
    });
  };

  const isHigherEd = currentTierConfig.category === "HIGHER_ED";
  const isSecondary = currentTierConfig.category === "SECONDARY";
  const isEarlyChildhood = currentTierConfig.category === "EARLY_CHILDHOOD";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* Top Navigation Bar: Sleek Dark Slate Enterprise ERP Header */}
      <header className="bg-slate-900 text-slate-200 dark:bg-zinc-950 border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm gap-3 relative before:absolute before:top-0 before:inset-x-0 before:h-0.5 before:bg-gradient-to-r before:from-indigo-500 before:via-purple-500 before:to-indigo-500">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition shrink-0"
            aria-label="Open Workspace Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb Header: Dashboard > Student Portal */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-400 min-w-0">
            <Link
              href={`/${school.subdomain}/dashboard`}
              className="hover:text-white transition truncate hidden sm:inline"
            >
              Dashboard
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 hidden sm:inline" />
            <span className="font-semibold text-white truncate">
              Student Portal
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-semibold border border-slate-700/80 truncate max-w-[130px] sm:max-w-none">
              {school.name}
            </span>
          </nav>
        </div>

        {/* Header Right Tools */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Tier Switcher Dropdown */}
          <div className="relative hidden lg:flex items-center">
            <select
              value={activeTier}
              onChange={(e) => setActiveTier(e.target.value)}
              className="appearance-none bg-slate-800 text-slate-200 text-xs font-semibold py-1.5 pl-3 pr-7 rounded-lg border border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Switch Institutional Tier"
            >
              {INSTITUTIONAL_TIER_PRESETS.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none text-slate-400" />
          </div>

          <ThemeToggle />

          <Link
            href={`/${school.subdomain}/login`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 border border-slate-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Switch User</span>
          </Link>
        </div>
      </header>

      {/* Main Responsive Body Layout */}
      <div className="flex-1 flex w-full bg-slate-100 dark:bg-slate-950">
        {/* Responsive Desktop Sidebar + Mobile Drawer */}
        <NavigationSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tierConfig={currentTierConfig}
          student={student}
          schoolName={school.name}
          subdomain={school.subdomain}
          isolatedDbName={school.isolatedDbStatus.databaseName}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onSelectTier={setActiveTier}
        />

        {/* Content Container (Mobile-first single column, expanding to multi-col on desktop) */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
          
          {/* Access Restricted Intercept Notice */}
          {isAccessDenied && (
            <div className="p-4 sm:p-5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/60 shadow-xs flex items-start gap-4 animate-in fade-in duration-300">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black text-red-900 dark:text-red-200 uppercase tracking-wider">
                    Access Restricted • Student Security Router
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-200 dark:bg-red-900 font-extrabold text-red-800 dark:text-red-200">
                    HTTP 403 BLOCKED
                  </span>
                </div>
                <p className="text-xs text-red-800/90 dark:text-red-300/90 mt-1 font-medium leading-relaxed">
                  Administrative consoles and finance configurations are strictly reserved for school administrators. You have been securely routed to your dedicated student workspace for <strong>{school.name}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Account Suspended Intercept Notice */}
          {isSuspended && (
            <div className="p-4 sm:p-5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 shadow-xs flex items-start gap-4 animate-in fade-in duration-300">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                    Account Inactive • Access Suspended
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 font-extrabold text-rose-800 dark:text-rose-200">
                    SUSPENDED
                  </span>
                </div>
                <p className="text-xs text-rose-800/90 dark:text-rose-300/90 mt-1 font-medium leading-relaxed">
                  Your student portal account has been placed on hold by school administration. Please consult the bursary or registrar office to restore access.
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Student Welcome Hero Card (Modern School ERP Banner) */}
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg shadow-indigo-950/20 border border-indigo-800/40 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                {/* Decorative ambient background glows */}
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-2 relative z-10">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Welcome back, {student.firstName}!
                  </h2>
                  <p className="text-xs sm:text-sm text-indigo-100/80 max-w-xl leading-relaxed">
                    {isEarlyChildhood
                      ? "Review daily care logs, developmental milestones, attendance, and termly tuition & feeding invoices."
                      : isSecondary
                      ? "Track continuous assessments (CA1/CA2), termly reports, class standings, and academic announcements."
                      : "Monitor collegiate course credit unit loading, faculty dues, semester GPA tracking, and senate bulletins."}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("REPORTS")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-100 border border-indigo-400/30 text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-300" />
                      <span>View Termly Report Card →</span>
                    </button>
                  </div>
                </div>

                {/* Student Identity Card */}
                <div className="flex items-center gap-3.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 px-4 py-3 rounded-xl shrink-0 transition relative z-10 text-white">
                  <div className="w-11 h-11 rounded-lg bg-indigo-500/30 text-indigo-200 flex items-center justify-center font-bold text-lg border border-indigo-400/20">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-indigo-200 uppercase font-bold tracking-wider">
                        {isHigherEd ? "Matric No." : "Student ID"}
                      </p>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-400/25 text-indigo-200 border border-indigo-300/30 font-extrabold uppercase">
                        {currentTierConfig.badgeCode}
                      </span>
                    </div>
                    <p className="text-sm font-black text-white font-mono tracking-wide whitespace-nowrap">
                      {student.admissionNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4 Feature Metric Cards: Elevated, Color-Accented Modern ERP Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Learning Areas / Subjects / Credit Units */}
                <div className="bg-gradient-to-br from-indigo-50/70 via-white to-white dark:from-indigo-950/30 dark:via-zinc-900 dark:to-zinc-900 p-5 rounded-xl shadow-sm shadow-indigo-100/50 dark:shadow-none border border-indigo-100/80 dark:border-indigo-900/40 relative overflow-hidden group hover:border-indigo-300/80 transition">
                  <div className="absolute top-0 inset-x-0 h-1 bg-indigo-500" />
                  <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider truncate text-slate-500 dark:text-zinc-400">
                      {isHigherEd ? "Credit Units" : isSecondary ? "Subjects" : "Learning Areas"}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    {isHigherEd ? `${student.academicRank.creditUnitsRegistered || 21}` : "8"}
                  </p>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {isHigherEd ? "Active This Semester" : "Active This Term"}
                  </span>
                </div>

                {/* Metric 2: Attendance Rate */}
                <div className="bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 p-5 rounded-xl shadow-sm shadow-emerald-100/50 dark:shadow-none border border-emerald-100/80 dark:border-emerald-900/40 relative overflow-hidden group hover:border-emerald-300/80 transition">
                  <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
                  <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider truncate text-slate-500 dark:text-zinc-400">Attendance Rate</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">96.4%</p>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    Present 52/54 Days
                  </span>
                </div>

                {/* Metric 3: Academic Standing / Learning Stage / GPA */}
                <div className="bg-gradient-to-br from-amber-50/70 via-white to-white dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-900 p-5 rounded-xl shadow-sm shadow-amber-100/50 dark:shadow-none border border-amber-100/80 dark:border-amber-900/40 relative overflow-hidden group hover:border-amber-300/80 transition">
                  <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
                  <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider truncate text-slate-500 dark:text-zinc-400">
                      {isHigherEd ? "Semester GPA" : isSecondary ? "Class Rank" : "Learning Stage"}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    {isHigherEd
                      ? `${student.academicRank.semesterGpa || 3.88}`
                      : isSecondary
                      ? "3rd / 44"
                      : "Stage 3"}
                  </p>
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1 block truncate">
                    {isHigherEd ? "First Class Standing" : isSecondary ? "Honors Roll" : "Exceeding Expectations"}
                  </span>
                </div>

                {/* Metric 4: Outstanding Fees */}
                <div className="bg-gradient-to-br from-purple-50/70 via-white to-white dark:from-purple-950/30 dark:via-zinc-900 dark:to-zinc-900 p-5 rounded-xl shadow-sm shadow-purple-100/50 dark:shadow-none border border-purple-100/80 dark:border-purple-900/40 relative overflow-hidden group hover:border-purple-300/80 transition">
                  <div className="absolute top-0 inset-x-0 h-1 bg-purple-500" />
                  <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider truncate text-slate-500 dark:text-zinc-400">Outstanding Fees</span>
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <p className={`text-2xl sm:text-3xl font-black whitespace-nowrap font-mono tabular-nums tracking-tight ${financeState.outstandingBalance > 0 ? "text-purple-700 dark:text-purple-300" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {financeState.currency}{financeState.outstandingBalance.toLocaleString()}
                  </p>
                  <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-1 block">
                    {financeState.outstandingBalance > 0 ? "Payment Due" : "Clear Ledger"}
                  </span>
                </div>
              </div>

              {/* Isolated Miniature Overview Summary Strip (< 15% Screen Height) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* 1. Latest Institutional Bulletin Snapshot */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <Megaphone className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Latest Bulletin</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Read-only digest</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                      {communications.notices[0]?.title || "No active school bulletins at this time"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      {communications.notices[0]?.content || "Official school announcements and notices will appear here."}
                    </p>
                  </div>
                  <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {communications.notices.length} active announcements
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("COMMUNICATIONS")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Open Broadcasts <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 2. Academic Enrollment Standing Snapshot */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Award className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Academic Record</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Official Registry</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                      Class / Level: {student.currentClass}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase">{student.status || "ENROLLED"}</span> • {currentTierConfig.tierName}
                    </p>
                  </div>
                  <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Verified Bio Profile
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("PROFILE")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      View Student Bio <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 3. Tuition & Clearance Ledger Snapshot */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Bursary Clearance</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Fiscal Cycle</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                      {financeState.outstandingBalance > 0
                        ? `Balance Due: ${financeState.currency}${financeState.outstandingBalance.toLocaleString()}`
                        : "Tuition & Fees Cleared"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      {financeState.outstandingBalance > 0
                        ? "Clearance required before term examination seating"
                        : "Account in good standing with school bursary"}
                    </p>
                  </div>
                  <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {finance.invoices.length} billed invoices
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("FINANCE")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Bursary Portal <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE MODULE */}
          {activeTab === "PROFILE" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <StudentProfileModule
                student={student}
                tierConfig={currentTierConfig}
                showFullBioGrid={true}
              />
            </div>
          )}

          {/* TAB 3: COMMUNICATIONS MODULE */}
          {activeTab === "COMMUNICATIONS" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <CommunicationsModule
                communications={communications}
                tierConfig={currentTierConfig}
              />
            </div>
          )}

          {/* TAB 4: FEES & FINANCE MODULE */}
          {activeTab === "FINANCE" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {paymentBanner && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{paymentBanner}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentBanner(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}
              <FeesFinanceModule
                finance={financeState}
                tierConfig={currentTierConfig}
                schoolId={school.id}
                studentLoginId={student.admissionNumber}
                subdomain={school.subdomain}
                student={student}
                onViewTransactionHistory={() => setActiveTab("TRANSACTIONS")}
                onPaymentSuccess={handlePaymentSuccess}
              />
            </div>
          )}

          {/* TAB 5: TRANSACTION HISTORY MODULE */}
          {activeTab === "TRANSACTIONS" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <TransactionHistoryModule
                finance={financeState}
                tierConfig={currentTierConfig}
                schoolId={school.id}
                studentLoginId={student.admissionNumber}
                onBack={() => setActiveTab("OVERVIEW")}
              />
            </div>
          )}

          {/* TAB 6: REPORT CARDS & RESULTS MODULE */}
          {activeTab === "REPORTS" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <StudentReportCardPortalModule
                student={student}
                tierConfig={currentTierConfig}
                schoolName={school.name}
                subdomain={school.subdomain}
              />
            </div>
          )}

        </main>
      </div>

      {/* Responsive Mobile Bottom Navigation Tray (Exclusively on < 768px) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tierConfig={currentTierConfig}
      />
    </div>
  );
}
