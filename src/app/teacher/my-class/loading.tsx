import React from "react";

/**
 * Instant Skeleton Fallback for /teacher/my-class:
 * Renders within < 50ms upon navigation to eliminate blank screens,
 * matching the exact geometry of the Hero Cockpit and 3 Performance Tiles.
 */
export default function MyClassLoading() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      {/* 1. Hero Cockpit Skeleton */}
      <div className="rounded-3xl bg-slate-900/90 dark:bg-zinc-900/90 p-6 sm:p-8 lg:p-10 border border-slate-800 shadow-xl animate-pulse">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl w-full">
            <div className="flex items-center gap-2">
              <div className="h-6 w-36 bg-slate-800 dark:bg-zinc-800 rounded-full" />
              <div className="h-6 w-24 bg-slate-800 dark:bg-zinc-800 rounded-full" />
            </div>
            <div className="h-8 sm:h-10 w-3/4 bg-slate-800 dark:bg-zinc-800 rounded-xl" />
            <div className="h-4 w-full bg-slate-800/60 dark:bg-zinc-800/60 rounded-md" />
          </div>

          <div className="flex items-center gap-3">
            <div className="h-12 w-32 bg-emerald-700/50 rounded-2xl" />
            <div className="h-12 w-28 bg-slate-800 dark:bg-zinc-800 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* 2. Core Performance Tiles Skeleton (3-Column Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs h-36 flex flex-col justify-between animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-slate-200 dark:bg-zinc-800 rounded-md" />
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-20 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
              <div className="h-3 w-36 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
