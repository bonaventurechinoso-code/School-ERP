"use client";

import React from "react";
import Link from "next/link";
import { 
  LayoutDashboard, 
  User, 
  Megaphone, 
  CreditCard, 
  GraduationCap, 
  Layers, 
  LogOut, 
  X, 
  Database,
  Building2,
  BookOpen
} from "lucide-react";
import { TierPresentationConfig, StudentProfileData } from "../types";
import { INSTITUTIONAL_TIER_PRESETS } from "../tier-config";

interface NavigationSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  tierConfig: TierPresentationConfig;
  student: StudentProfileData;
  schoolName: string;
  subdomain: string;
  isolatedDbName: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onSelectTier?: (tierName: string) => void;
}

export function NavigationSidebar({
  activeTab,
  setActiveTab,
  tierConfig,
  student,
  schoolName,
  subdomain,
  isolatedDbName,
  mobileMenuOpen,
  setMobileMenuOpen,
  onSelectTier
}: NavigationSidebarProps) {
  const navItems = [
    { id: "OVERVIEW", label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "PROFILE", label: "Student Bio & Profile", icon: User },
    { id: "COMMUNICATIONS", label: "Live Communications", icon: Megaphone },
    { id: "FINANCE", label: tierConfig.billingTitle, icon: CreditCard },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4 sm:p-5">
      {/* Top Brand & Student Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black shadow-md shadow-indigo-950/40 shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-xs text-white truncate">
                {schoolName}
              </h2>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mini Student Card */}
        <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/60 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {tierConfig.badgeCode}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active Session
            </span>
          </div>
          <p className="font-bold text-xs text-white truncate">
            {student.fullName}
          </p>
          <p className="text-[10px] font-mono text-slate-400 truncate whitespace-nowrap">
            ID: {student.admissionNumber}
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
            Workspace Modules
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tier Adaptive Switcher Preview: Fluid Non-Clipping Layout */}
        {onSelectTier && (
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Simulate Tier Profile</span>
            </p>
            <div className="space-y-1">
              {INSTITUTIONAL_TIER_PRESETS.map((preset) => {
                const isSelected = tierConfig.tierName === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      onSelectTier(preset.name);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition ${
                      isSelected
                        ? "bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-bold"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <span className="leading-snug break-words whitespace-normal">{preset.name}</span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0 ml-1">
                      {preset.category === "EARLY_CHILDHOOD" ? "K-6" : preset.category === "SECONDARY" ? "7-12" : "COLLEGE"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Isolation Status & Logout */}
      <div className="space-y-2.5 pt-3 border-t border-slate-800">
        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px]">
            <Database className="w-3 h-3" />
            <span>Isolated Tenant DB</span>
          </div>
          <p className="text-[10px] font-mono text-slate-400 truncate">
            {isolatedDbName}
          </p>
        </div>

        <Link
          href={`/${subdomain}/login`}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 border border-slate-700/60 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Workspace</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Hidden on < 768px) */}
      <aside className="hidden md:block w-64 lg:w-72 shrink-0 h-[calc(100vh-4rem)] sticky top-16 bg-slate-900 text-slate-300 dark:bg-zinc-950 border-r border-slate-800/80 overflow-y-auto z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Visible on < 768px when toggled) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-slate-900 text-slate-300 dark:bg-zinc-950 shadow-2xl border-r border-slate-800/80 z-10 overflow-y-auto">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
