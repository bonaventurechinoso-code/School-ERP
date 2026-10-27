import React from "react";
import SuperAdminSidebar from "@/app/super-admin/SuperAdminSidebar";
import SuperAdminProfileDropdown from "@/components/SuperAdminProfileDropdown";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-950 flex-col lg:flex-row transition-colors duration-200">
      {/* Sidebar: flows naturally as header on mobile; fixed 280px sticky sidebar on desktop (lg+) */}
      <aside className="lg:w-[280px] lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh z-30">
        <SuperAdminSidebar />
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Desktop Header Bar (Hidden on mobile < lg to avoid duplicate headers) */}
        <header className="hidden lg:flex bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800/80 px-6 py-3 items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Platform Administration
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <AdminNotificationBell />
            <ThemeToggle />
            <div className="h-5 w-px bg-slate-200 dark:bg-zinc-800 mx-0.5" />
            <SuperAdminProfileDropdown />
          </div>
        </header>

        {/* Responsive Content Container */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
