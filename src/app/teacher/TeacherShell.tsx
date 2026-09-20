"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TeacherSidebar } from "./TeacherSidebar";
import { TeacherMobileHeader } from "./TeacherMobileHeader";
import { TeacherContext } from "./actions";

interface TeacherShellProps {
  teacherContext: TeacherContext;
  children: React.ReactNode;
}

export function TeacherShell({ teacherContext, children }: TeacherShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      {/* Mobile Sticky Header (< 1024px) */}
      <TeacherMobileHeader
        schoolName={teacherContext.schoolName}
        teacherName={teacherContext.staffName}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />

      {/* Navigation Sidebar (Fixed Desktop + Animated Mobile Drawer) */}
      <TeacherSidebar
        schoolName={teacherContext.schoolName}
        schoolSubdomain={teacherContext.schoolSubdomain}
        teacherName={teacherContext.staffName}
        teacherRole={teacherContext.staffRole}
        staffEmail={teacherContext.staffEmail}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area (Offset by lg:pl-64 for persistent desktop sidebar) */}
      <div className="lg:pl-64 flex-1 flex flex-col min-h-screen">
        {/* Desktop Top Control Bar (>= 1024px) */}
        <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 px-8 py-3 shadow-xs">
          <div className="flex items-center gap-3" />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Term 1 • 2026/2027 Session</span>
            </div>

            <span className="text-slate-300 dark:text-zinc-700">|</span>

            <ThemeToggle />

            <Link
              href={`/${teacherContext.schoolSubdomain}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>School Home</span>
            </Link>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
