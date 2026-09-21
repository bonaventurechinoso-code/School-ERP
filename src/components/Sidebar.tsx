"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  X,
  Home,
  Users,
  CreditCard,
  Settings,
  UserPlus,
  Briefcase,
  Calendar,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
  MessageSquare,
  Building2,
  Landmark,
  FileCheck2,
  Coins,
} from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { useSession } from "@/lib/session-context";
import { checkRouteAuthorization, isAdminExecutive } from "@/lib/permissions";
import TierSwitcher from "@/components/TierSwitcher";

export interface SidebarTier {
  id: string;
  name: string;
  sublabel?: string;
  slug?: string;
  databaseName?: string | null;
  databaseUrl?: string | null;
}

export interface SidebarProps {
  schoolName: string;
  schoolDomain: string;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  tiers?: SidebarTier[];
  currentTier?: string | null;
  headerContent?: React.ReactNode;
}

/**
 * High-fidelity Skeleton UI rendered while session/tenant state is actively resolving
 */
export function SidebarSkeleton({
  isSidebarOpen,
  setIsSidebarOpen,
  schoolName,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  schoolName: string;
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-64 md:min-w-[16rem] md:max-w-[16rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
        isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
      }`}
    >
      {/* Header Skeleton */}
      <div className="p-4 sm:p-5 font-bold text-lg tracking-wide border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 dark:bg-zinc-950/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div className="w-9 h-9 rounded-xl bg-slate-800 animate-pulse shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="h-4 w-28 bg-slate-800 rounded-md animate-pulse" />
            <div className="h-2 w-16 bg-slate-800/60 rounded-md animate-pulse" />
          </div>
        </div>
        <button
          className="md:hidden p-2 -mr-2 rounded-lg hover:bg-slate-800 active:scale-95 transition-all"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Tier Switcher Skeleton */}
      <div className="px-3 py-2.5 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
        <div className="h-9 w-full rounded-xl bg-slate-800/70 animate-pulse" />
      </div>

      {/* Nav Items Skeleton */}
      <div className="flex-1 min-h-0 px-3 py-6 flex flex-col gap-2 overflow-hidden">
        {[
          { w: "w-28", id: "s1" },
          { w: "w-36", id: "s2" },
          { w: "w-24", id: "s3" },
          { w: "w-32", id: "s4" },
          { w: "w-20", id: "s5" },
          { w: "w-28", id: "s6" },
          { w: "w-32", id: "s7" },
          { w: "w-24", id: "s8" },
        ].map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/30 border border-slate-800/40 animate-pulse"
          >
            <div className="w-5 h-5 rounded-lg bg-slate-800 shrink-0" />
            <div className={`h-3.5 ${item.w} bg-slate-800 rounded-md`} />
          </div>
        ))}
      </div>

      {/* Footer Wallet Skeleton */}
      <div className="p-3 border-t border-slate-800/60 bg-slate-900/80 dark:bg-zinc-950/80 mt-auto shrink-0">
        <div className="h-16 w-full rounded-xl bg-slate-800/60 animate-pulse" />
      </div>
    </aside>
  );
}

export default function Sidebar({
  schoolName,
  schoolDomain,
  isSidebarOpen,
  setIsSidebarOpen,
  tiers = [],
  currentTier,
  headerContent,
}: SidebarProps) {
  const pathname = usePathname();
  const tenant = useTenant();
  const { session, role: sessionRole, staffRole, loading, isAuthorizedAdmin } = useSession();

  // Combine role from session with tenant context fallback
  const effectiveRole = useMemo(() => {
    return (sessionRole || tenant?.userRole || "").trim().toUpperCase();
  }, [sessionRole, tenant?.userRole]);

  // Master links catalog
  const allLinks = useMemo(
    () => [
      { label: "Dashboard", href: `/${schoolDomain}/dashboard`, icon: Home },
      { label: "Public Portal Settings", href: `/${schoolDomain}/portal-settings`, icon: Settings },
      { label: "Bank Account", href: `/${schoolDomain}/settings/bank`, icon: Landmark },
      { label: "Enrollment", href: `/${schoolDomain}/admissions`, icon: UserPlus },
      { label: "Students", href: `/${schoolDomain}/students`, icon: Users },
      { label: "Staff", href: `/${schoolDomain}/staff`, icon: Briefcase },
      { label: "Timetable", href: `/${schoolDomain}/scheduling`, icon: Calendar },
      { label: "Assessments", href: `/${schoolDomain}/exams`, icon: GraduationCap },
      { label: "Report Cards", href: `/${schoolDomain}/report-cards`, icon: FileSpreadsheet },
      { label: "Academic Records", href: `/${schoolDomain}/transcripts`, icon: BookOpen },
      { label: "Communications", href: `/${schoolDomain}/communications`, icon: MessageSquare },
      { label: "Payment Verifications", href: `/${schoolDomain}/finance/verifications`, icon: FileCheck2 },
      { label: "Bursary", href: `/${schoolDomain}/finance`, icon: CreditCard },
      { label: "Bursar Portal", href: "/bursar", icon: Coins },
      { label: "Management & Payroll", href: `/${schoolDomain}/hr`, icon: Building2 },
    ],
    [schoolDomain]
  );

  // Reactively filter links based on verified role & permissions
  const links = useMemo(() => {
    if (!effectiveRole) {
      // During transient initial hydration, avoid filtering to zero if loading
      return [];
    }
    return allLinks.filter((link) => {
      const auth = checkRouteAuthorization(link.href, effectiveRole, staffRole);
      return auth.allowed;
    });
  }, [allLinks, effectiveRole, staffRole]);

  // Wallet authorization strictly for executive admin / super admin
  const isWalletAuthorized = useMemo(() => {
    if (!effectiveRole) return false;
    return isAuthorizedAdmin || isAdminExecutive(effectiveRole, staffRole);
  }, [effectiveRole, isAuthorizedAdmin, staffRole]);

  // 1. LOADING GUARD:
  // If session is resolving and no role is determined yet, render the skeleton
  if (loading && !effectiveRole) {
    return (
      <SidebarSkeleton
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        schoolName={schoolName}
      />
    );
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-64 md:min-w-[16rem] md:max-w-[16rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
        isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 sm:p-5 font-bold text-lg tracking-wide border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50 dark:bg-zinc-950/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {tenant?.branding?.logoUrl ? (
            <img
              src={tenant.branding.logoUrl}
              alt={schoolName}
              className="w-9 h-9 rounded-xl object-contain border border-slate-800 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="truncate text-base font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
            {schoolName.toUpperCase()}
          </span>
        </div>
        <button
          className="md:hidden p-2 -mr-2 rounded-lg hover:bg-slate-800 active:scale-95 transition-all"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Sidebar Tier Switcher (for Multi-Tier Tenants) */}
      {tiers && tiers.length > 0 && (
        <div className="px-3 py-2.5 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
          <TierSwitcher
            tiers={tiers}
            currentTier={currentTier}
            schoolDomain={schoolDomain}
            variant="sidebar"
          />
        </div>
      )}

      {/* Reactive Navigation Modules */}
      <nav className="flex-1 min-h-0 px-3 py-4 flex flex-col gap-1 overflow-y-auto overscroll-contain">
        {links.length === 0 && loading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 w-full bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400 font-medium"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
                onClick={() => setIsSidebarOpen(false)}
              >
                {link.icon && (
                  <link.icon
                    className={`w-5 h-5 ${isActive ? "text-indigo-400" : "text-slate-400"}`}
                  />
                )}
                <span>{link.label}</span>
              </a>
            );
          })
        )}
      </nav>
    </aside>
  );
}

