"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Radio,
  History,
  Settings,
  LifeBuoy,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  Landmark,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Tenants",
    href: "/admin/tenants",
    icon: Building2,
  },
  {
    name: "Bank",
    href: "/admin/bank",
    icon: Landmark,
  },
  {
    name: "Billings",
    href: "/admin/billings",
    icon: CreditCard,
  },
  {
    name: "Webhooks",
    href: "/admin/webhooks",
    icon: Radio,
    badge: "Live",
  },
  {
    name: "Audit Logs",
    href: "/admin/audit-logs",
    icon: History,
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
  {
    name: "Security & Password",
    href: "/admin/security",
    icon: ShieldCheck,
  },
  {
    name: "Support",
    href: "/admin/support",
    icon: LifeBuoy,
  },
];

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#0D1117] dark:bg-zinc-950 text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 dark:border-zinc-800/80 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-slate-900 dark:bg-zinc-900 border border-slate-700/80 dark:border-zinc-800 flex items-center justify-center p-1.5 shadow-xs group-hover:border-indigo-500/60 transition-colors">
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
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 uppercase tracking-wider">
                Console
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
              Platform Administration
            </p>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 dark:hover:bg-zinc-800 transition"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-2 text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest">
          Platform Operations
        </div>

        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group relative ${
                active
                  ? "bg-indigo-600/15 text-white font-semibold border border-indigo-500/25 shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 dark:hover:bg-zinc-900/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active
                      ? "text-indigo-400"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                <span className="tracking-tight">{item.name}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    active
                      ? "bg-indigo-500/30 text-indigo-200"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {/* Active left indicator indicator bar */}
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-500 rounded-r-full shadow-sm" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Status & Footer */}
      <div className="p-3.5 border-t border-slate-800/80 dark:border-zinc-800/80 space-y-2.5">
        <div className="p-3 rounded-xl bg-slate-900/60 dark:bg-zinc-900/50 border border-slate-800 dark:border-zinc-800/80 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="text-[11px] leading-tight">
              <span className="font-semibold text-white block">Platform Active</span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">PostgreSQL Core • 100%</span>
            </div>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        </div>

        <div className="px-2 text-[10px] text-slate-500 dark:text-zinc-500 flex items-center justify-between font-mono">
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
      <aside className="hidden lg:block w-60 xl:w-64 h-screen sticky top-0 shrink-0 border-r border-slate-800 dark:border-zinc-800/80 z-30">
        {navContent}
      </aside>
    </>
  );
}
