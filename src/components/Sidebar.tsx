"use client";

import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  X,
  GraduationCap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { useSession } from "@/lib/session-context";
import TierSwitcher from "@/components/TierSwitcher";
import {
  getTenantNavigation,
  NavGroupConfig,
  NavItemConfig,
  NavChildItem,
} from "@/lib/nav-config";

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
  const searchParams = useSearchParams();
  const tenant = useTenant();
  const { session, role: sessionRole, staffRole, loading } = useSession();

  // Combine role from session with tenant context fallback
  const effectiveRole = useMemo(() => {
    return (sessionRole || tenant?.userRole || "").trim().toUpperCase();
  }, [sessionRole, tenant?.userRole]);

  // Unified single nav config driving both desktop and mobile
  const navGroups: NavGroupConfig[] = useMemo(() => {
    return getTenantNavigation(effectiveRole, staffRole, schoolDomain);
  }, [effectiveRole, staffRole, schoolDomain]);

  // Collapsible groups state (e.g. "staff-group")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "staff-group": true,
  });

  // Auto-expand group if current path matches any of its children
  useEffect(() => {
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some((child) => {
            const childHref = child.href(schoolDomain);
            const [basePath, queryString] = childHref.split("?");
            if (queryString) {
              const urlParams = new URLSearchParams(queryString);
              const matchesParams = Array.from(urlParams.entries()).every(
                ([k, v]) => searchParams.get(k) === v
              );
              return pathname === basePath && matchesParams;
            }
            return pathname === basePath;
          });
          if (hasActiveChild) {
            setExpandedGroups((prev) => ({ ...prev, [item.id]: true }));
          }
        }
      });
    });
  }, [pathname, searchParams, navGroups, schoolDomain]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Helper to determine active status of item
  const isItemActive = (href: string, exact?: boolean) => {
    const [basePath, queryString] = href.split("?");
    if (queryString) {
      const urlParams = new URLSearchParams(queryString);
      const matchesParams = Array.from(urlParams.entries()).every(
        ([k, v]) => searchParams.get(k) === v
      );
      return pathname === basePath && matchesParams;
    }
    if (exact) {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(basePath);
  };

  // 1. LOADING GUARD
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
            <Image
              src={tenant.branding.logoUrl}
              alt={schoolName}
              width={36}
              height={36}
              className="w-9 h-9 rounded-xl object-contain border border-slate-800 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="truncate text-base font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
            {(schoolName || "EGEDE PRIMARY SCHOOL").toUpperCase()}
          </span>
        </div>
        <button
          className="md:hidden p-2 -mr-2 rounded-lg hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* FIX 4: TOP LABEL (TENANT) & Tenant Switcher / Status Banner */}
      <div className="px-3 py-2.5 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
        <TierSwitcher
          tiers={tiers}
          currentTier={currentTier}
          schoolDomain={schoolDomain}
          schoolName={schoolName}
          variant="sidebar"
        />
      </div>

      {/* Reactive Navigation Modules with Groups (PEOPLE, ACADEMIC, FINANCE, SYSTEM) */}
      <nav className="flex-1 min-h-0 px-3 py-3 flex flex-col gap-1 overflow-y-auto overscroll-contain">
        {navGroups.map((group) => {
          return (
            <div key={group.id} className="space-y-1">
              {/* Group Section Header */}
              {group.title && (
                <div className="px-3 pt-3.5 pb-1 text-[10px] font-black text-slate-400 dark:text-zinc-500 tracking-widest uppercase">
                  {group.title}
                </div>
              )}

              {/* Group Items */}
              {group.items.map((item) => {
                const itemHref = item.href(schoolDomain);
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedGroups[item.id] ?? false;
                const Icon = item.icon;

                // Collapsible parent item
                if (hasChildren) {
                  const anyChildActive = item.children!.some((child) =>
                    isItemActive(child.href(schoolDomain), child.exact)
                  );

                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          anyChildActive
                            ? "bg-indigo-600/10 text-indigo-400 font-bold"
                            : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${anyChildActive ? "text-indigo-400" : "text-slate-400"}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {/* Collapsible Children */}
                      {isExpanded && (
                        <div className="pl-4 pr-1 py-0.5 space-y-0.5 border-l border-slate-800/80 ml-4 animate-in fade-in slide-in-from-top-1 duration-150">
                          {item.children!.map((child) => {
                            const childHref = child.href(schoolDomain);
                            const isChildActive = isItemActive(childHref, child.exact);
                            const ChildIcon = child.icon;

                            return (
                              <Link
                                key={child.id}
                                href={childHref}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 ${
                                  isChildActive
                                    ? "bg-indigo-600/20 text-white font-bold border-l-2 border-indigo-500 shadow-2xs"
                                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                                }`}
                              >
                                {ChildIcon && (
                                  <ChildIcon
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      isChildActive ? "text-indigo-400" : "text-slate-500"
                                    }`}
                                  />
                                )}
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Regular Top-Level Item
                const isActive = isItemActive(itemHref, item.exact);

                return (
                  <Link
                    key={item.id}
                    href={itemHref}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group active:scale-98 ${
                      isActive
                        ? "bg-indigo-600/15 text-white font-bold border-l-2 border-indigo-500 shadow-2xs"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
