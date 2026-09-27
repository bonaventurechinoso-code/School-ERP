import React from "react";

export default function TenantsLoadingSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80 dark:border-zinc-800 animate-pulse">
        <div className="space-y-2">
          <div className="h-5 w-44 bg-slate-200 dark:bg-zinc-800 rounded-full" />
          <div className="h-8 w-64 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-9 w-32 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs h-32 flex flex-col justify-between animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-slate-200 dark:bg-zinc-800 rounded-md" />
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800" />
            </div>
            <div className="space-y-1.5">
              <div className="h-7 w-20 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar Skeleton */}
      <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
        <div className="h-9 w-full sm:w-80 bg-slate-100 dark:bg-zinc-800/70 rounded-xl" />
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="h-9 w-28 bg-slate-100 dark:bg-zinc-800/70 rounded-xl" />
          <div className="h-9 w-36 bg-slate-100 dark:bg-zinc-800/70 rounded-xl" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden animate-pulse">
        <div className="h-11 bg-slate-50 dark:bg-zinc-950/70 border-b border-slate-200/80 dark:border-zinc-800" />
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="py-4 px-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                  <div className="h-3 w-20 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
                </div>
              </div>
              <div className="h-6 w-28 bg-slate-100 dark:bg-zinc-800/70 rounded-lg hidden md:block" />
              <div className="flex gap-1.5 hidden lg:flex">
                <div className="h-5 w-20 bg-slate-100 dark:bg-zinc-800/70 rounded-full" />
                <div className="h-5 w-16 bg-slate-100 dark:bg-zinc-800/70 rounded-full" />
              </div>
              <div className="h-5 w-12 bg-slate-100 dark:bg-zinc-800/70 rounded-md text-center" />
              <div className="h-5 w-12 bg-slate-100 dark:bg-zinc-800/70 rounded-md text-center" />
              <div className="h-6 w-16 bg-slate-200 dark:bg-zinc-800 rounded-full" />
              <div className="flex gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800" />
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800" />
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
