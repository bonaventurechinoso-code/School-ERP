"use client";

import React, { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Layers, Database, Check, ChevronDown } from "lucide-react";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";

interface TierItem {
  id: string;
  name: string;
  databaseName?: string | null;
  databaseUrl?: string | null;
}

interface TierSwitcherProps {
  tiers?: TierItem[];
  currentTier?: string | null;
  schoolDomain: string;
  variant?: "topbar" | "sidebar";
}

function getTierStyle(tierName: string, isActive: boolean) {
  const upper = (tierName || "").toUpperCase();
  if (upper.includes("NURSERY") || upper.includes("DAYCARE")) {
    return isActive
      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
      : "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60";
  }
  if (upper.includes("PRIMARY") && upper.includes("SECONDARY")) {
    return isActive
      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60";
  }
  if (upper.includes("PRIMARY")) {
    return isActive
      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
      : "bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60";
  }
  if (upper.includes("SECONDARY")) {
    return isActive
      ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
      : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60";
  }
  return isActive
    ? "bg-purple-600 text-white border-purple-700 shadow-sm"
    : "bg-purple-50 text-purple-800 hover:bg-purple-100 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60";
}

export default function TierSwitcher({
  tiers = [],
  currentTier,
  schoolDomain,
  variant = "topbar",
}: TierSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (!tiers || tiers.length === 0) return null;

  // Resolve active tier name
  const paramTier = searchParams.get("tier");
  const activeTierObj =
    tiers.find(
      (t) =>
        (paramTier && (sanitizeTierSlug(t.name) === sanitizeTierSlug(paramTier) || t.name.toLowerCase().includes(paramTier.toLowerCase()))) ||
        (currentTier && (t.name.toLowerCase() === currentTier.toLowerCase() || sanitizeTierSlug(t.name) === sanitizeTierSlug(currentTier)))
    ) || tiers[0];

  const handleSelectTier = (tier: TierItem) => {
    const slug = sanitizeTierSlug(tier.name);
    // 1. Set cookie for activeTier so server components read it
    document.cookie = `activeTier=${encodeURIComponent(tier.name)}; path=/; max-age=31536000; SameSite=Lax`;
    
    // 2. Hot-swap URL search param
    startTransition(() => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set("tier", slug);
      const search = current.toString();
      const query = search ? `?${search}` : "";
      router.push(`${pathname}${query}`);
      router.refresh();
    });
  };

  // Sidebar Layout (Compact Segmented Pills)
  if (variant === "sidebar") {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider">
          <span className="flex items-center gap-1.5 text-slate-300 dark:text-zinc-400">
            <Layers className="w-3 h-3 text-indigo-400" />
            Academic Tier
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {tiers.map((tier) => {
            const isActive = activeTierObj.id === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleSelectTier(tier)}
                disabled={isPending}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${getTierStyle(
                  tier.name,
                  isActive
                )} ${isActive ? "ring-1 ring-white/20" : "opacity-80 hover:opacity-100"}`}
              >
                <span className="truncate">{tier.name}</span>
                {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Topbar Layout (Horizontal Tab / Segmented Bar)
  return (
    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/60 p-1 rounded-xl border border-slate-200 dark:border-zinc-700/80 shadow-xs">
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
        {tiers.map((tier) => {
          const isActive = activeTierObj.id === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => handleSelectTier(tier)}
              disabled={isPending}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${getTierStyle(
                tier.name,
                isActive
              )} ${isActive ? "shadow-xs" : "opacity-75 hover:opacity-100"}`}
              title={`Switch tier to ${tier.name}`}
            >
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
              <span>{tier.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
