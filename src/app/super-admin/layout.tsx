import React from "react";
import SuperAdminSidebar from "@/app/super-admin/SuperAdminSidebar";
import SuperAdminProfileDropdown from "@/components/SuperAdminProfileDropdown";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-zinc-950">
      <aside className="w-[280px] shrink-0 sticky top-0 h-screen overflow-y-auto bg-[#0f172a]">
        <SuperAdminSidebar />
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-x-auto bg-[#f8fafc] dark:bg-zinc-950">
        {/* Top Header Bar with restored NotificationBell, ThemeToggle, and ProfileDropdown */}
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800/80 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Platform Administration
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <AdminNotificationBell />
            <ThemeToggle />
            <div className="h-5 w-px bg-slate-200 dark:bg-zinc-800 mx-0.5 hidden sm:block" />
            <SuperAdminProfileDropdown />
          </div>
        </header>

        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
