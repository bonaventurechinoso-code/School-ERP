"use client";

import React, { useTransition, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Layers, Check, ChevronDown } from "lucide-react";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";

export interface TierItem {
  id: string;
  name: string;
  sublabel?: string;
  databaseName?: string | null;
  databaseUrl?: string | null;
}

interface TierSwitcherProps {
  tiers?: TierItem[];
  currentTier?: string | null;
  schoolDomain: string;
  variant?: "topbar" | "sidebar";
}

/**
 * The complete, authentic spectrum of educational tiers available for trial testing.
 */
export const COMPLETE_TRIAL_TIERS: TierItem[] = [
  { id: "tier-nursery", name: "Daycare / Nursery", sublabel: "Early Childhood Care" },
  { id: "tier-primary", name: "Primary School", sublabel: "Basic 1 - 6" },
  { id: "tier-secondary", name: "Secondary School", sublabel: "Junior & Senior Secondary" },
  { id: "tier-coe", name: "College of Education", sublabel: "Tertiary NCE" },
  { id: "tier-poly", name: "Polytechnic", sublabel: "Tertiary ND/HND" },
  { id: "tier-uni", name: "University", sublabel: "Undergraduate & Postgraduate" },
];

export function getTierStyle(tierName: string, isActive: boolean) {
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
  if (upper.includes("COLLEGE")) {
    return isActive
      ? "bg-teal-600 text-white border-teal-700 shadow-sm"
      : "bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60";
  }
  if (upper.includes("POLYTECHNIC") || upper.includes("POLY")) {
    return isActive
      ? "bg-cyan-600 text-white border-cyan-700 shadow-sm"
      : "bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60";
  }
  if (upper.includes("UNIVERSITY") || upper.includes("HIGHER")) {
    return isActive
      ? "bg-purple-600 text-white border-purple-700 shadow-sm"
      : "bg-purple-50 text-purple-800 hover:bg-purple-100 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60";
  }
  if (upper.includes("SECONDARY")) {
    return isActive
      ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
      : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60";
  }
  return isActive
    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
    : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60";
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

  // Determine whether current environment is the Trial Sandbox
  const isTrial = schoolDomain === "trial-sandbox" || schoolDomain.includes("trial");

  // Effective tiers: For trial sandbox (or when fewer tiers exist), merge with the complete spectrum of 6 tiers
  const effectiveTiers: TierItem[] = useMemo(() => {
    if (isTrial || tiers.length <= 2) {
      return COMPLETE_TRIAL_TIERS.map((trialTier) => {
        const existing = tiers.find(
          (t) =>
            t.name.toLowerCase() === trialTier.name.toLowerCase() ||
            sanitizeTierSlug(t.name) === sanitizeTierSlug(trialTier.name)
        );
        return existing
          ? { ...existing, sublabel: trialTier.sublabel }
          : trialTier;
      });
    }

    // Attach known sublabels to existing tiers
    return tiers.map((t) => {
      const match = COMPLETE_TRIAL_TIERS.find(
        (ct) =>
          ct.name.toLowerCase() === t.name.toLowerCase() ||
          sanitizeTierSlug(ct.name) === sanitizeTierSlug(t.name)
      );
      return match ? { ...t, sublabel: match.sublabel } : t;
    });
  }, [isTrial, tiers]);

  if (!effectiveTiers || effectiveTiers.length === 0) return null;

  // Resolve active tier item
  const paramTier = searchParams.get("tier");
  const activeTierObj =
    effectiveTiers.find(
      (t) =>
        (paramTier &&
          (sanitizeTierSlug(t.name) === sanitizeTierSlug(paramTier) ||
            t.name.toLowerCase().includes(paramTier.toLowerCase()) ||
            sanitizeTierSlug(paramTier).includes(sanitizeTierSlug(t.name)))) ||
        (currentTier &&
          (t.name.toLowerCase() === currentTier.toLowerCase() ||
            sanitizeTierSlug(t.name) === sanitizeTierSlug(currentTier)))
    ) || effectiveTiers[0];

  const handleSelectTier = (tier: TierItem) => {
    const slug = sanitizeTierSlug(tier.name);
    // 1. Set cookie for activeTier so server components and layouts immediately read it
    document.cookie = `activeTier=${encodeURIComponent(tier.name)}; path=/; max-age=31536000; SameSite=Lax`;

    // 2. Hot-swap URL search param and refresh router
    startTransition(() => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set("tier", slug);
      const search = current.toString();
      const query = search ? `?${search}` : "";
      router.push(`${pathname}${query}`);
      router.refresh();
    });
  };

  // Sidebar Layout: Dedicated Dropdown Selector Component
  if (variant === "sidebar") {
    return (
      <div className="mt-1 space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider">
          <span className="flex items-center gap-1.5 text-slate-300 dark:text-zinc-400">
            <Layers className="w-3 h-3 text-indigo-400" />
            Academic Tier
          </span>
        </div>

        {/* Dropdown Selector Component */}
        <div className="relative">
          <select
            value={activeTierObj.name}
            onChange={(e) => {
              const selected = effectiveTiers.find(
                (t) => t.name === e.target.value || t.id === e.target.value
              );
              if (selected) handleSelectTier(selected);
            }}
            disabled={isPending}
            className="w-full appearance-none bg-slate-800/95 hover:bg-slate-800 text-white border border-slate-700/90 rounded-xl px-3 py-2.5 pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-xs"
          >
            {effectiveTiers.map((tier) => (
              <option key={tier.id} value={tier.name} className="bg-slate-900 text-white py-1.5 font-medium">
                {tier.name} {tier.sublabel ? `(${tier.sublabel})` : ""}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {/* Active Tier Visual Indicator Badge */}
        <div
          className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between transition-all ${getTierStyle(
            activeTierObj.name,
            true
          )}`}
        >
          <div className="flex flex-col min-w-0 pr-2">
            <span className="font-bold truncate">{activeTierObj.name}</span>
            {activeTierObj.sublabel && (
              <span className="text-[10px] opacity-90 truncate">{activeTierObj.sublabel}</span>
            )}
          </div>
          <span className="text-[10px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-white/25 text-white shrink-0">
            Active
          </span>
        </div>
      </div>
    );
  }

  // Topbar Layout (Horizontal Tab / Segmented Bar)
  return (
    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/60 p-1 rounded-xl border border-slate-200 dark:border-zinc-700/80 shadow-xs max-w-full overflow-hidden">
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar scroll-smooth w-full">
        {effectiveTiers.map((tier) => {
          const isActive = activeTierObj.id === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => handleSelectTier(tier)}
              disabled={isPending}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer touch-manipulation min-h-[34px] shrink-0 ${getTierStyle(
                tier.name,
                isActive
              )} ${isActive ? "shadow-xs ring-1 ring-white/20" : "opacity-75 hover:opacity-100"}`}
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
