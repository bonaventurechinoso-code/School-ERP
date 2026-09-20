"use client";

import React from "react";
import { Menu, School as SchoolIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface TeacherMobileHeaderProps {
  schoolName: string;
  teacherName: string;
  onOpenSidebar: () => void;
}

export function TeacherMobileHeader({
  schoolName,
  teacherName,
  onOpenSidebar,
}: TeacherMobileHeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shadow-xs">
      {/* Left: School Logo & Truncated Teacher Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 shrink-0">
          <SchoolIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate leading-tight">
            {schoolName}
          </h1>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate">
            {teacherName} • Teacher Portal
          </p>
        </div>
      </div>

      {/* Right: Theme Toggle & Prominent Hamburger Menu Button */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open Navigation Menu"
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs cursor-pointer flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
