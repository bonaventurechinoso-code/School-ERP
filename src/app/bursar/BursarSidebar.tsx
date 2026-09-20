"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  Banknote,
  FileSpreadsheet,
  Receipt,
  Layers,
  Building2,
  FileBarChart,
  LogOut,
  X,
  ExternalLink,
  Coins,
} from "lucide-react";
import { BursarContext } from "./actions";

export interface BursarSidebarProps {
  context: BursarContext;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  pendingVerificationsCount?: number;
}

export const BURSAR_NAV_ITEMS = [
  { id: "dashboard", label: "Command Center", path: "/bursar", icon: LayoutDashboard },
  {
    id: "verifications",
    label: "Payment Verifications",
    path: "/bursar/verifications",
    icon: ShieldCheck,
    hasBadge: true,
  },
  { id: "collect", label: "Fee Collection Counter", path: "/bursar/collect", icon: Banknote },
  { id: "invoices", label: "Student Invoices", path: "/bursar/invoices", icon: FileSpreadsheet },
  { id: "receipts", label: "Official Receipts", path: "/bursar/receipts", icon: Receipt },
  { id: "fees", label: "Fee Structures", path: "/bursar/fees", icon: Layers },
  { id: "banking", label: "Direct Bank Accounts", path: "/bursar/banking", icon: Building2 },
  { id: "reports", label: "Defaulters & Reports", path: "/bursar/reports", icon: FileBarChart },
] as const;

export function BursarSidebar({
  context,
  isOpen,
  setIsOpen,
  pendingVerificationsCount = 0,
}: BursarSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    document.cookie = "mockTenant=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push(`/${context.schoolSubdomain}/login`);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 dark:bg-zinc-950 text-slate-100 flex flex-col border-r border-slate-800 dark:border-zinc-800/80 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Header Branding */}
        <div className="p-5 border-b border-slate-800 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-sm tracking-tight text-white leading-tight truncate">
                {context.schoolName}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-indigo-300 dark:text-indigo-400 uppercase tracking-wider">
                  Bursar Desk
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Cross-Nav Switcher */}
        <div className="px-4 pt-3 pb-1">
          <Link
            href={`/${context.schoolSubdomain}/finance`}
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-[11px] font-semibold text-slate-300 hover:text-white transition group"
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin Desk (Executive)</span>
            </span>
            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition" />
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-400">
            Financial Management
          </div>

          {BURSAR_NAV_ITEMS.map((item) => {
            const isActive =
              item.path === "/bursar"
                ? pathname === "/bursar"
                : pathname === item.path || pathname.startsWith(`${item.path}/`);

            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>

                {'hasBadge' in item && item.hasBadge && pendingVerificationsCount > 0 && (
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white text-indigo-700"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                    }`}
                  >
                    {pendingVerificationsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Profile & Session Card */}
        <div className="p-3.5 border-t border-slate-800 dark:border-zinc-800/80 bg-slate-900/50">
          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">{context.staffName}</p>
              <p className="text-[11px] text-slate-400 truncate">{context.staffRole}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
