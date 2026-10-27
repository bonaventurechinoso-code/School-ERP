"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Settings,
  Shield,
  ShieldCheck,
  Landmark,
  UserCircle,
  ChevronDown,
  Menu,
  X,
  ExternalLink,
  LifeBuoy,
  FileCheck,
  FileText,
} from "lucide-react";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import SuperAdminProfileDropdown from "@/components/SuperAdminProfileDropdown";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Accordion state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    operations: true,
    finance: false,
    settings: false,
    system: false,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Automatically expand relevant accordion on route change
  useEffect(() => {
    if (
      pathname.startsWith("/super-admin/finance") ||
      pathname === "/super-admin/billings"
    ) {
      setOpenGroups((prev) => ({ ...prev, operations: true, finance: true }));
    } else if (
      pathname.startsWith("/super-admin/tenants") ||
      pathname.startsWith("/super-admin/settings/payments") ||
      pathname.startsWith("/super-admin/users") ||
      pathname.startsWith("/super-admin/audit-logs") ||
      pathname.startsWith("/super-admin/support")
    ) {
      setOpenGroups((prev) => ({ ...prev, operations: true }));
    } else if (pathname === "/super-admin/settings") {
      setOpenGroups((prev) => ({ ...prev, settings: true }));
    } else if (
      pathname.startsWith("/super-admin/profile") ||
      pathname.startsWith("/super-admin/account")
    ) {
      setOpenGroups((prev) => ({ ...prev, system: true }));
    }
  }, [pathname]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Dismiss drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const isActive = (
    href: string,
    exact: boolean = false,
    aliases: string[] = []
  ) => {
    if (pathname === href) return true;
    if (aliases.some((a) => pathname === a || pathname.startsWith(`${a}/`)))
      return true;
    if (!exact && pathname.startsWith(`${href}/`)) return true;
    return false;
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <Link
          href="/super-admin"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-3 group min-w-0"
        >
          <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center p-1.5 shadow-xs group-hover:border-cyan-500/60 transition-colors shrink-0">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={26}
              height={26}
              className="object-contain w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-tight truncate">
                School ERP
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 uppercase tracking-wider shrink-0">
                Console
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              Platform Administration
            </p>
          </div>
        </Link>

        {/* Mobile close button with accessible 44px touch target */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          aria-label="Close navigation sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Scrollable Body with Momentum Scrolling */}
      <nav className="flex-1 p-3.5 space-y-3 overflow-y-auto overscroll-contain touch-pan-y">
        {/* GROUP 1: Platform Overview (Always open) */}
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold py-1 px-3">
            Platform Overview
          </div>
          <Link
            href="/super-admin"
            onClick={() => setIsOpen(false)}
            className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-all duration-150 min-h-[40px] touch-manipulation ${
              isActive("/super-admin", true)
                ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400 shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <LayoutDashboard className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="truncate">Platform Dashboard</span>
            </div>
          </Link>
        </div>

        {/* GROUP 2: Platform Operations (Accordion) */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup("operations")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleGroup("operations");
              }
            }}
            className="text-[11px] uppercase tracking-widest text-slate-400 font-bold py-2 px-3 flex justify-between items-center cursor-pointer hover:text-white transition-colors select-none min-h-[38px] rounded-lg focus:outline-none focus:bg-white/5"
          >
            <div className="flex items-center gap-2 truncate">
              <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Platform Operations</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                openGroups.operations ? "rotate-180" : ""
              }`}
            />
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              openGroups.operations ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-3 border-l border-white/10 pl-2.5 py-1 space-y-1">
              {/* Tenants / Schools */}
              <Link
                href="/super-admin/tenants"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 min-h-[38px] touch-manipulation ${
                  isActive("/super-admin/tenants")
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Tenants / Schools</span>
                </div>
              </Link>

              {/* Subscriptions & Plans */}
              <Link
                href="/super-admin/settings/payments"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 min-h-[38px] touch-manipulation ${
                  isActive("/super-admin/settings/payments")
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span className="truncate">Subscriptions &amp; Plans</span>
                </div>
              </Link>

              {/* Platform Billing (Sub-Accordion) */}
              <div className="space-y-1">
                <div
                  onClick={() => toggleGroup("finance")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleGroup("finance");
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer select-none min-h-[38px] focus:outline-none"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Landmark className="w-4 h-4 shrink-0" />
                    <span className="truncate">Platform Billing</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                      openGroups.finance ? "rotate-180" : ""
                    }`}
                  />
                </div>

                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    openGroups.finance ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="ml-3 border-l border-white/10 pl-2.5 py-1 space-y-1">
                    <Link
                      href="/super-admin/finance/bank-account"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all duration-150 min-h-[36px] touch-manipulation ${
                        isActive("/super-admin/finance/bank-account")
                          ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Landmark className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Bank Account Configs</span>
                      </div>
                    </Link>

                    <Link
                      href="/super-admin/billings"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all duration-150 min-h-[36px] touch-manipulation ${
                        isActive("/super-admin/billings")
                          ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Platform Ledger</span>
                      </div>
                    </Link>

                    <Link
                      href="/super-admin/finance/receipts"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all duration-150 min-h-[36px] touch-manipulation ${
                        isActive("/super-admin/finance/receipts")
                          ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Receipts &amp; Clearance</span>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Platform Users & Roles */}
              <Link
                href="/super-admin/users"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 min-h-[38px] touch-manipulation ${
                  isActive("/super-admin/users")
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">Platform Users &amp; Roles</span>
                </div>
              </Link>

              {/* Audit Logs */}
              <Link
                href="/super-admin/audit-logs"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 min-h-[38px] touch-manipulation ${
                  isActive("/super-admin/audit-logs")
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">System Audit Logs</span>
                </div>
              </Link>

              {/* Support & Communications */}
              <Link
                href="/super-admin/support"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 min-h-[38px] touch-manipulation ${
                  isActive("/super-admin/support")
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <LifeBuoy className="w-4 h-4 shrink-0" />
                  <span className="truncate">Support &amp; Inquiries</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* GROUP 3: Platform Settings (Accordion) */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup("settings")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleGroup("settings");
              }
            }}
            className="text-[11px] uppercase tracking-widest text-slate-400 font-bold py-2 px-3 flex justify-between items-center cursor-pointer hover:text-white transition-colors select-none min-h-[38px] rounded-lg focus:outline-none focus:bg-white/5"
          >
            <div className="flex items-center gap-2 truncate">
              <Settings className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Platform Settings</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                openGroups.settings ? "rotate-180" : ""
              }`}
            />
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              openGroups.settings ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-3 border-l border-white/10 pl-2.5 py-1 space-y-1">
              <Link
                href="/super-admin/settings"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 min-h-[38px] touch-manipulation ${
                  isActive("/super-admin/settings", true)
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Settings className="w-4 h-4 shrink-0" />
                  <span className="truncate">General Settings</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* GROUP 4: System (Accordion) */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup("system")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleGroup("system");
              }
            }}
            className="text-[11px] uppercase tracking-widest text-slate-400 font-bold py-2 px-3 flex justify-between items-center cursor-pointer hover:text-white transition-colors select-none min-h-[38px] rounded-lg focus:outline-none focus:bg-white/5"
          >
            <div className="flex items-center gap-2 truncate">
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">System</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                openGroups.system ? "rotate-180" : ""
              }`}
            />
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              openGroups.system ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-3 border-l border-white/10 pl-2.5 py-1 space-y-1">
              <Link
                href="/super-admin/profile"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 min-h-[38px] touch-manipulation ${
                  isActive("/super-admin/profile", false, ["/super-admin/account"])
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <UserCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">Super-Admin Profile &amp; Security</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Status & Footer (Safe area padding for phones) */}
      <div className="p-3.5 border-t border-slate-800 space-y-2 shrink-0 pb-safe">
        {/* System Health Status */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="text-[11px] leading-tight truncate">
              <span className="font-semibold text-white block truncate">Platform Active</span>
              <span className="text-[10px] text-slate-400 truncate">PostgreSQL Core • 100%</span>
            </div>
          </div>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        </div>

        <div className="px-1 text-[10px] text-slate-500 flex items-center justify-between font-mono">
          <span>v2.4 SaaS Core</span>
          <Link
            href="/"
            target="_blank"
            className="hover:text-slate-300 transition flex items-center gap-1 font-sans"
          >
            Root Portal <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* =========================================================================
          MOBILE TOP NAVBAR (Visible on < lg, All Phones & Tablets)
      ========================================================================= */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-xs w-full min-w-0 transition-colors">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="p-2 -ml-1 rounded-xl text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:bg-slate-200 dark:active:bg-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-cyan-500/40 min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Open navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link
            href="/super-admin"
            className="flex items-center gap-2 group min-w-0"
          >
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-slate-900 dark:bg-zinc-950 border border-slate-700/80 flex items-center justify-center p-1 shrink-0">
              <Image
                src="/img/business-logo.png"
                alt="School ERP"
                width={22}
                height={22}
                className="object-contain"
              />
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white truncate">
                Super-Admin
              </span>
              <span className="hidden xs:inline-block text-[8px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 uppercase tracking-wider shrink-0">
                Console
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Quick Controls (Notifications, Theme, Profile Dropdown) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <AdminNotificationBell />
          <ThemeToggle />
          <div className="h-5 w-px bg-slate-200 dark:bg-zinc-800 mx-0.5 hidden xs:block" />
          <SuperAdminProfileDropdown align="right" />
        </div>
      </div>

      {/* =========================================================================
          MOBILE SLIDE-OVER DRAWER (Visible when open on < lg)
      ========================================================================= */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity cursor-pointer"
          onClick={() => setIsOpen(false)}
        />

        {/* Drawer slide-in panel */}
        <aside
          className={`fixed inset-y-0 left-0 w-[290px] sm:w-[320px] max-w-[85vw] h-full h-dvh bg-[#0f172a] shadow-2xl z-10 flex flex-col transform transition-transform duration-300 ease-in-out ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {navContent}
        </aside>
      </div>

      {/* =========================================================================
          DESKTOP SIDEBAR (Visible on lg and up >= 1024px)
      ========================================================================= */}
      <div className="hidden lg:flex lg:flex-col lg:w-[280px] h-full border-r border-slate-800 bg-[#0f172a] text-slate-300">
        {navContent}
      </div>
    </>
  );
}
