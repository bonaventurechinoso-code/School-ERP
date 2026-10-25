"use client";

import { useState } from "react";
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
  DollarSign,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Default open Platform Operations only. Others closed.
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

  const isActive = (href: string, exact: boolean = false, aliases: string[] = []) => {
    if (pathname === href) return true;
    if (aliases.some((a) => pathname === a || pathname.startsWith(`${a}/`))) return true;
    if (!exact && pathname.startsWith(`${href}/`)) return true;
    return false;
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
        <Link href="/super-admin" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center p-1.5 shadow-xs group-hover:border-cyan-500/60 transition-colors">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={26}
              height={26}
              className="object-contain w-full h-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-tight">
                School ERP
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 uppercase tracking-wider">
                Console
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Platform Administration
            </p>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Accordion Sections */}
      <nav className="flex-1 p-3.5 space-y-3 overflow-y-auto">
        {/* GROUP 1: Platform Overview (Always open, no accordion) */}
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-widest text-gray-400 font-bold py-1 px-3">
            Platform Overview
          </div>
          <Link
            href="/super-admin"
            onClick={() => setIsOpen(false)}
            className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
              isActive("/super-admin", true)
                ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Platform Dashboard</span>
            </div>
          </Link>
        </div>

        {/* GROUP 2: Platform Operations (Accordion, icon LayoutDashboard) */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup("operations")}
            className="text-[11px] uppercase tracking-widest text-gray-400 font-bold py-2 px-3 flex justify-between items-center cursor-pointer hover:text-white transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Platform Operations</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                openGroups.operations ? "rotate-180" : ""
              }`}
            />
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              openGroups.operations ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-4 border-l border-white/10 pl-3 py-1 space-y-1">
              {/* Tenants / Schools */}
              <Link
                href="/super-admin/tenants"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                  isActive("/super-admin/tenants")
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>Tenants / Schools</span>
                </div>
              </Link>

              {/* Subscriptions & Plans */}
              <Link
                href="/super-admin/subscriptions"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                  isActive("/super-admin/subscriptions", false, ["/super-admin/billings"])
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Subscriptions & Plans</span>
                </div>
              </Link>

              {/* Platform Finance (parent) -> accordion nested */}
              <div className="space-y-1">
                <div
                  onClick={() => toggleGroup("finance")}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <Landmark className="w-4 h-4 shrink-0" />
                    <span>Platform Finance</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      openGroups.finance ? "rotate-180" : ""
                    }`}
                  />
                </div>

                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    openGroups.finance ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="ml-4 border-l border-white/10 pl-3 py-1 space-y-1">
                    <Link
                      href="/super-admin/finance/payments"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                        isActive("/super-admin/finance/payments", false, ["/super-admin/settings/payments"])
                          ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                        <span>Payment Modules</span>
                      </div>
                    </Link>

                    <Link
                      href="/super-admin/finance/bank"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                        isActive("/super-admin/finance/bank", false, ["/super-admin/finance/bank-account"])
                          ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Landmark className="w-3.5 h-3.5 shrink-0" />
                        <span>Bank Account Configs</span>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Platform Users & Roles */}
              <Link
                href="/super-admin/users"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                  isActive("/super-admin/users", false, ["/super-admin/audit-logs"])
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Platform Users & Roles</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* GROUP 3: Platform Settings (Accordion, icon Settings) */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup("settings")}
            className="text-[11px] uppercase tracking-widest text-gray-400 font-bold py-2 px-3 flex justify-between items-center cursor-pointer hover:text-white transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Platform Settings</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                openGroups.settings ? "rotate-180" : ""
              }`}
            />
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              openGroups.settings ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-4 border-l border-white/10 pl-3 py-1 space-y-1">
              {/* General Settings */}
              <Link
                href="/super-admin/settings"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                  isActive("/super-admin/settings", true)
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>General Settings</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* GROUP 4: System (Accordion, icon Shield) */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup("system")}
            className="text-[11px] uppercase tracking-widest text-gray-400 font-bold py-2 px-3 flex justify-between items-center cursor-pointer hover:text-white transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>System</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                openGroups.system ? "rotate-180" : ""
              }`}
            />
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              openGroups.system ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-4 border-l border-white/10 pl-3 py-1 space-y-1">
              {/* Super-Admin Account & Security */}
              <Link
                href="/super-admin/account"
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                  isActive("/super-admin/account", false, ["/super-admin/profile"])
                    ? "bg-white/10 text-white font-semibold border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCircle className="w-4 h-4 shrink-0" />
                  <span>Super-Admin Account & Security</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Status & Footer */}
      <div className="p-3.5 border-t border-slate-800 space-y-2">
        {/* System Health Status */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="text-[11px] leading-tight">
              <span className="font-semibold text-white block">Platform Active</span>
              <span className="text-[10px] text-slate-400">PostgreSQL Core • 100%</span>
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
      {/* Mobile Top Bar with Toggle Button */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
            aria-label="Toggle navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/img/business-logo.png"
              alt="School ERP"
              width={24}
              height={24}
              className="object-contain"
            />
            <span className="font-bold text-sm tracking-tight">Super-Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Online</span>
        </div>
      </div>

      {/* Mobile Slide-over Backdrop & Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop Sticky Vertical Sidebar */}
      <aside className="hidden lg:block w-60 xl:w-64 h-screen sticky top-0 shrink-0 border-r border-slate-800 z-30">
        {navContent}
      </aside>
    </>
  );
}
