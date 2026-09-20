"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BursarContext } from "./actions";
import { BursarSidebar } from "./BursarSidebar";
import { BursarMobileHeader } from "./BursarMobileHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Banknote, Building2, ShieldCheck } from "lucide-react";

export interface BursarShellProps {
  bursarContext: BursarContext;
  pendingVerificationsCount?: number;
  children: React.ReactNode;
}

export function BursarShell({
  bursarContext,
  pendingVerificationsCount = 0,
  children,
}: BursarShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      {/* Desktop Sidebar */}
      <BursarSidebar
        context={bursarContext}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        pendingVerificationsCount={pendingVerificationsCount}
      />

      {/* Mobile Top Header */}
      <BursarMobileHeader
        context={bursarContext}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-w-0">
        {/* Top Desktop Navigation & Status Bar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-3.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Institutional Bursary
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {bursarContext.schoolName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Tuition billing, verified bank transfers & cashflow treasury
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Collection Account Badge */}
            {bursarContext.settlementAccountNumber && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  {bursarContext.settlementBankName}:{" "}
                  <strong className="font-mono font-bold text-slate-900 dark:text-white">
                    {bursarContext.settlementAccountNumber}
                  </strong>
                </span>
              </div>
            )}

            {/* Quick Pending Alert */}
            {pendingVerificationsCount > 0 && (
              <Link
                href="/bursar/verifications"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition animate-pulse"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{pendingVerificationsCount} Proofs to Verify</span>
              </Link>
            )}

            {/* Direct Collect CTA */}
            <Link
              href="/bursar/collect"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              <span>Collect Payment</span>
            </Link>

            <ThemeToggle />
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
