import React from "react";

/**
 * Super Admin Instant Loading Skeleton (< 100ms):
 * Matches the geometry of Super-Admin Platform Command KPIs and Telemetry cards.
 */
export default function AdminDashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800 animate-pulse">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-slate-200 dark:bg-zinc-800 rounded-full" />
          <div className="h-8 w-72 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
        </div>
        <div className="h-9 w-36 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
      </div>

      {/* KPI Cards Skeleton (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs h-36 flex flex-col justify-between animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-28 bg-slate-200 dark:bg-zinc-800 rounded-md" />
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800" />
            </div>
            <div className="space-y-1.5">
              <div className="h-8 w-24 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Telemetry Strip Skeleton (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs h-36 flex flex-col justify-between animate-pulse"
          >
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-48 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex justify-between">
              <div className="h-3 w-24 bg-slate-100 dark:bg-zinc-800 rounded-md" />
              <div className="h-3 w-20 bg-slate-200 dark:bg-zinc-800 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
