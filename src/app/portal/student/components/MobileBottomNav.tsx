"use client";

import React from "react";
import { LayoutDashboard, User, Megaphone, CreditCard, FileSpreadsheet } from "lucide-react";
import { TierPresentationConfig } from "../types";

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  tierConfig: TierPresentationConfig;
}

export function MobileBottomNav({ activeTab, setActiveTab, tierConfig }: MobileBottomNavProps) {
  const navItems = [
    { id: "OVERVIEW", label: "Overview", icon: LayoutDashboard },
    { id: "REPORTS", label: "Results", icon: FileSpreadsheet },
    { id: "PROFILE", label: "Profile", icon: User },
    { id: "COMMUNICATIONS", label: "Messages", icon: Megaphone },
    { id: "FINANCE", label: "Billing", icon: CreditCard },
  ];

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 text-slate-300 dark:bg-zinc-950/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 flex items-center justify-around shadow-xl transition-transform"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id || (item.id === "FINANCE" && activeTab === "TRANSACTIONS");
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
              isActive
                ? "text-indigo-400 font-extrabold"
                : "text-slate-400 hover:text-white font-medium"
            }`}
          >
            <div className={`p-1 rounded-lg transition ${isActive ? "bg-indigo-950/80 text-indigo-400" : ""}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
