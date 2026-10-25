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
 * High-fidelity Skeleton UI matching the consolidated Tenant Card geometry
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
      className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-72 md:min-w-[18rem] md:max-w-[18rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
        isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
      }`}
    >
      {/* Consolidated Tenant Card Skeleton */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-slate-800 animate-pulse shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="h-3.5 w-28 bg-slate-800 rounded-md animate-pulse" />
            <div className="h-2.5 w-16 bg-slate-800/60 rounded-md animate-pulse" />
          </div>
        </div>
        <button
          className="md:hidden p-1.5 rounded-lg text-slate-400"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Items Skeleton */}
      <div className="flex-1 min-h-0 px-3 py-4 flex flex-col gap-2 overflow-hidden">
        {[
          { w: "w-32", id: "s1" },
          { w: "w-36", id: "s2" },
          { w: "w-28", id: "s3" },
          { w: "w-32", id: "s4" },
        ].map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/30 border border-slate-800/40 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-md bg-slate-800 shrink-0" />
              <div className={`h-3 ${item.w} bg-slate-800 rounded-md`} />
            </div>
            <div className="w-3 h-3 bg-slate-800 rounded-md" />
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

  // Collapsible accordions state: "academic-engine" open by default
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "academic-engine": true,
  });

  // Clean School Display Name
  const cleanSchoolName = useMemo(() => {
    const raw = schoolName || tenant?.name || (schoolDomain === "egede" ? "Egede Primary School" : `${schoolDomain} School`);
    return raw.trim();
  }, [schoolName, tenant?.name, schoolDomain]);

  // 2-Letter Monogram Avatar
  const monogram = useMemo(() => {
    const words = cleanSchoolName.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return cleanSchoolName.substring(0, 2).toUpperCase();
  }, [cleanSchoolName]);

  // Active Educational Tier Label
  const activeTierLabel = useMemo(() => {
    if (currentTier) {
      const match = tiers.find(
        (t) => t.id === currentTier || t.slug === currentTier || t.name.toLowerCase() === currentTier.toLowerCase()
      );
      if (match) return match.name;
    }
    if (tiers && tiers.length > 0) {
      return tiers[0].name;
    }
    return "Institutional Portal";
  }, [tiers, currentTier]);

  // Helper to determine active status of items including merged matchPaths
  const isItemActive = (href: string, exact?: boolean, matchPaths?: string[]) => {
    const [basePath, queryString] = href.split("?");
    if (queryString) {
      const urlParams = new URLSearchParams(queryString);
      const matchesParams = Array.from(urlParams.entries()).every(
        ([k, v]) => searchParams.get(k) === v
      );
      if (pathname === basePath && matchesParams) return true;
    } else {
      if (exact) {
        if (pathname === basePath || pathname === `${basePath}/`) return true;
      } else {
        if (pathname.startsWith(basePath)) return true;
      }
    }

    if (matchPaths && matchPaths.length > 0) {
      return matchPaths.some((mp) => {
        const fullMp = `/${schoolDomain}${mp}`;
        return pathname === fullMp || pathname.startsWith(`${fullMp}/`) || pathname.startsWith(`${fullMp}?`);
      });
    }

    return false;
  };

  // Auto-expand group if current path matches any of its children
  useEffect(() => {
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some((child) =>
            isItemActive(child.href(schoolDomain), child.exact, child.matchPaths)
          );
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
      className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 md:w-72 md:min-w-[18rem] md:max-w-[18rem] h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
        isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
      }`}
    >
      {/* 1. SINGLE, HIGHLY POLISHED TENANT IDENTITY CARD */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 dark:bg-zinc-950/80 shrink-0">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Monogram Avatar with Minimal Status Dot */}
            <div className="relative shrink-0">
              {tenant?.branding?.logoUrl ? (
                <Image
                  src={tenant.branding.logoUrl}
                  alt={cleanSchoolName}
                  width={38}
                  height={38}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain border border-slate-700/80 shadow-xs"
                />
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-linear-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs border border-white/10 tracking-tight">
                  {monogram}
                </div>
              )}
              {/* Single minimal green indicator dot */}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 dark:ring-zinc-950 shadow-xs"
                title="Tenant Active"
              />
            </div>

            {/* Clean Institution Title without middle-word ellipses */}
            <div className="min-w-0 flex-1">
              <span className="block text-xs sm:text-sm font-bold text-white tracking-tight leading-snug line-clamp-2">
                {cleanSchoolName}
              </span>
              <span className="block text-[10px] text-slate-400 dark:text-zinc-400 font-medium truncate mt-0.5">
                {activeTierLabel}
              </span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all shrink-0 cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compact Tier Switcher (Rendered only when multiple tiers exist) */}
        {tiers && tiers.length > 1 && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/60">
            <TierSwitcher
              tiers={tiers}
              currentTier={currentTier}
              schoolDomain={schoolDomain}
              schoolName={schoolName}
              variant="sidebar"
            />
          </div>
        )}
      </div>

      {/* 2. COLLAPSIBLE ACCORDION NAVIGATION ARCHITECTURE */}
      <nav className="flex-1 min-h-0 px-2.5 py-3 flex flex-col gap-1.5 overflow-y-auto overscroll-contain">
        {navGroups.map((group) => {
          return (
            <div key={group.id} className="space-y-1">
              {group.title && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-black text-slate-400 dark:text-zinc-500 tracking-widest uppercase">
                  {group.title}
                </div>
              )}

              {group.items.map((item) => {
                const itemHref = item.href(schoolDomain);
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedGroups[item.id] ?? false;
                const Icon = item.icon;

                // Collapsible parent accordion folder
                if (hasChildren) {
                  const anyChildActive = item.children!.some((child) =>
                    isItemActive(child.href(schoolDomain), child.exact, child.matchPaths)
                  );

                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        title={item.label}
                        className={`w-full flex items-start justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          anyChildActive
                            ? "bg-indigo-600/15 text-white font-bold"
                            : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${anyChildActive ? "text-indigo-400" : "text-slate-400"}`} />
                          <span className="flex-1 min-w-0 text-xs sm:text-[12.5px] leading-snug break-words whitespace-normal text-left">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1.5 mt-0.5">
                          {anyChildActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          )}
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Accordion Children with clean vector icons & relative indent margins */}
                      {isExpanded && (
                        <div className="ml-3 pl-2.5 py-0.5 space-y-0.5 border-l border-slate-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
                          {item.children!.map((child) => {
                            const childHref = child.href(schoolDomain);
                            const isChildActive = isItemActive(childHref, child.exact, child.matchPaths);
                            const ChildIcon = child.icon;

                            return (
                              <Link
                                key={child.id}
                                href={childHref}
                                onClick={() => setIsSidebarOpen(false)}
                                title={child.label}
                                className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 ${
                                  isChildActive
                                    ? "bg-indigo-600/20 text-white font-bold border-l-2 border-indigo-500 shadow-2xs"
                                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                                }`}
                              >
                                {ChildIcon && (
                                  <ChildIcon
                                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                      isChildActive ? "text-indigo-400" : "text-slate-500"
                                    }`}
                                  />
                                )}
                                <span className="flex-1 min-w-0 text-xs sm:text-[11.5px] lg:text-xs leading-snug break-words whitespace-normal text-left">
                                  {child.label}
                                </span>
                                {child.badge && (
                                  <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {child.badge}
                                  </span>
                                )}
                              </Link>

                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Regular top-level item (fallback for single-tier roles)
                const isActive = isItemActive(itemHref, item.exact, item.matchPaths);

                return (
                  <Link
                    key={item.id}
                    href={itemHref}
                    onClick={() => setIsSidebarOpen(false)}
                    title={item.label}
                    className={`flex items-start justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group active:scale-98 ${
                      isActive
                        ? "bg-indigo-600/15 text-white font-bold border-l-2 border-indigo-500 shadow-2xs"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <Icon
                        className={`w-4 h-4 shrink-0 mt-0.5 transition-colors ${
                          isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                        }`}
                      />
                      <span className="flex-1 min-w-0 leading-snug break-words whitespace-normal text-left">
                        {item.label}
                      </span>
                    </div>
                    {item.badge && (
                      <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 mt-0.5">
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
