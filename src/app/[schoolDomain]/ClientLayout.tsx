"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import { Menu, Home, Users, CreditCard, UserPlus, Briefcase } from "lucide-react";
import AIChatWidget from "@/components/AIChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import SubscriptionBell from "@/components/SubscriptionBell";
import { useTenant } from "@/lib/tenant-context";
import { useSession } from "@/lib/session-context";
import { checkRouteAuthorization } from "@/lib/permissions";
import Sidebar, { SidebarTier } from "@/components/Sidebar";
import UserProfileDropdown from "@/components/UserProfileDropdown";

export type { SidebarTier as ClientLayoutTier };

export default function ClientLayout({
  schoolName,
  headerContent,
  children,
  tiers = [],
  currentTier,
}: {
  schoolName: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  tiers?: SidebarTier[];
  currentTier?: string | null;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const schoolDomain = (params?.schoolDomain as string) || "egede";

  return (
    <div className="flex flex-1 h-screen max-h-screen w-full overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-zinc-950 relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Reactive Multi-Tenant Sidebar with Loading Guard & Skeleton */}
      <Sidebar
        schoolName={schoolName}
        schoolDomain={schoolDomain}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        tiers={tiers}
        currentTier={currentTier}
        headerContent={headerContent}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto relative">
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-zinc-800/50 flex items-center justify-between gap-2.5 sm:gap-4 w-full px-3.5 sm:px-6 md:px-8 py-2.5 md:py-3.5 shadow-xs flex-shrink-0 sticky top-0 z-20 transition-colors duration-200">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              className="md:hidden w-10 h-10 -ml-1 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full active:scale-95 transition-all touch-manipulation flex items-center justify-center shrink-0"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 dark:text-zinc-400 font-bold truncate">
                Administrative Desk
              </h1>
              <p className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-zinc-200 truncate md:hidden">
                {schoolName}
              </p>
            </div>
          </div>

          {/* Top-right utility bar */}
          <div className="flex items-center gap-2 shrink-0">
            <SubscriptionBell />
            <ThemeToggle />
            <UserProfileDropdown schoolName={schoolName} schoolDomain={schoolDomain} />
          </div>
        </header>

        <div className="p-4 md:p-8 pb-16 md:pb-16 flex-1 text-slate-900 dark:text-zinc-50 max-w-7xl mx-auto w-full">
          {children}
        </div>

        {/* Tenant Dashboard Footer */}
        <footer className="mt-auto border-t border-slate-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs py-4 px-4 md:px-8 pb-8 sm:pb-4 transition-colors duration-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400 sm:pr-56 md:pr-64">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>Powered by </span>
              <Image
                src="/img/business-logo.png"
                alt="BonaVee ICT"
                width={20}
                height={20}
                className="h-5 w-5 inline-block align-middle object-contain rounded-xs shadow-xs"
              />
            </div>
            <div className="text-center sm:text-right shrink-0">
              <span>© {new Date().getFullYear()} School ERP Platform. All rights reserved.</span>
            </div>
          </div>
        </footer>
      </main>

      <AIChatWidget />
    </div>
  );
}
