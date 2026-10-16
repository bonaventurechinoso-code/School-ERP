"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Layers,
  TrendingUp,
  ShieldCheck,
  Activity,
  FileText,
  Search,
  Bell,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { INITIAL_PROOFS, INITIAL_SCHOOLS } from "./mock-data";
import LogoutButton from "@/components/LogoutButton";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topSearch, setTopSearch] = useState("");

  const pendingProofsCount = INITIAL_PROOFS.filter((p) => p.status === "Pending").length;
  const totalSchoolsCount = INITIAL_SCHOOLS.length;

  interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    badge?: string;
    badgeAlert?: boolean;
  }

  interface NavGroup {
    group: string;
    items: NavItem[];
  }

  const navItems: NavGroup[] = [
    {
      group: "Platform Command",
      items: [
        {
          name: "Dashboard Overview",
          href: "/dashboard/super-admin",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          name: "Tenants / Schools",
          href: "/dashboard/super-admin/tenants",
          icon: Building2,
          badge: totalSchoolsCount.toString(),
        },
        {
          name: "Students Across Tenants",
          href: "/dashboard/super-admin/students",
          icon: Users,
        },
      ],
    },
    {
      group: "Billing & Bank Transfer",
      items: [
        {
          name: "Bank Transfer Proofs",
          href: "/dashboard/super-admin/bank-transfers",
          icon: Receipt,
          badge: pendingProofsCount > 0 ? pendingProofsCount.toString() : undefined,
          badgeAlert: pendingProofsCount > 0,
        },
        {
          name: "Plans & Pricing Tiers",
          href: "/dashboard/super-admin/plans",
          icon: Layers,
        },
        {
          name: "Revenue Analytics",
          href: "/dashboard/super-admin/revenue",
          icon: TrendingUp,
        },
      ],
    },
    {
      group: "Platform Security & Ops",
      items: [
        {
          name: "Security & Passwords",
          href: "/dashboard/super-admin/settings",
          icon: ShieldCheck,
        },
        {
          name: "System Health & Nodes",
          href: "/dashboard/super-admin/system-health",
          icon: Activity,
        },
        {
          name: "Audit Logs",
          href: "/dashboard/super-admin/audit-logs",
          icon: FileText,
        },
      ],
    },
  ];

  const isLinkActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Sidebar content component (used for both desktop and mobile drawer)
  const SidebarNav = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 select-none">
      {/* Brand / Logo */}
      <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
        <Link
          href="/dashboard/super-admin"
          onClick={onItemClick}
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            S
          </div>
          <div>
            <div className="font-bold text-white tracking-tight text-base leading-tight group-hover:text-blue-300 transition-colors">
              SchoolERP
            </div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-blue-400">
              Super Admin OS
            </div>
          </div>
        </Link>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
          v2.4
        </span>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {navItems.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.group}
            </div>
            {group.items.map((item) => {
              const active = isLinkActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-white" : "text-slate-400"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        item.badgeAlert
                          ? "bg-amber-500 text-slate-950 font-bold animate-pulse"
                          : active
                          ? "bg-blue-700 text-white"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Super Admin Badge Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
            SA
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-white truncate">Super Administrator</div>
            <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Root Platform Owner
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] text-slate-900 font-sans antialiased">
      {/* =========================================================================
          DESKTOP SIDEBAR (Fixed 280px, Hidden on mobile)
      ========================================================================= */}
      <aside className="hidden lg:flex w-[280px] shrink-0 sticky top-0 h-screen z-40 border-r border-slate-800/80">
        <SidebarNav />
      </aside>

      {/* =========================================================================
          MOBILE SHEET DRAWER (Opens from hamburger, lg:hidden)
      ========================================================================= */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 border-r border-slate-800">
          <SidebarNav onItemClick={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* =========================================================================
          MAIN WORKSPACE
      ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP NAVBAR */}
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 sticky top-0 z-30 flex items-center justify-between gap-3 sm:gap-4 shadow-sm">
          {/* Mobile Hamburger + Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
              aria-label="Open mobile navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick search input */}
            <div className="relative hidden md:block w-72 lg:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Quick lookup (tenants, codes, banks)..."
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
              />
              {topSearch && (
                <button
                  type="button"
                  onClick={() => setTopSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right quick controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Bank Transfer Warning Pill */}
            {pendingProofsCount > 0 && (
              <Link
                href="/dashboard/super-admin/bank-transfers"
                className="flex items-center gap-1.5 sm:gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-900 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors animate-pulse"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="hidden sm:inline">
                  {pendingProofsCount} Bank Transfers Pending
                </span>
                <span className="sm:hidden">{pendingProofsCount} Pending</span>
              </Link>
            )}

            {/* Notification Bell */}
            <Link
              href="/dashboard/super-admin/bank-transfers"
              className="relative p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Pending Payment Verifications"
            >
              <Bell className="w-4 h-4" />
              {pendingProofsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {pendingProofsCount}
                </span>
              )}
            </Link>

            {/* Quick Link to Tenants */}
            <Link
              href="/dashboard/super-admin/tenants"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Tenants ({totalSchoolsCount})</span>
            </Link>

            {/* Profile Avatar */}
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow">
              SA
            </div>

            {/* Logout Action */}
            <LogoutButton />
          </div>
        </header>

        {/* Page Content wrapped here */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
