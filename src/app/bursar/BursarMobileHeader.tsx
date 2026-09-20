"use client";

import React from "react";
import Link from "next/link";
import { Menu, Coins, ArrowLeft, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BursarContext } from "./actions";

export interface BursarMobileHeaderProps {
  context: BursarContext;
  onOpenSidebar: () => void;
}

export function BursarMobileHeader({ context, onOpenSidebar }: BursarMobileHeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20 shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
              {context.schoolName}
            </h1>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
              Bursar Portal
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href={`/${context.schoolSubdomain}`}
          className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          title="School Home"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Link
          href={`/${context.schoolSubdomain}/login`}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white transition"
          title="Switch User"
        >
          <LogOut className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
