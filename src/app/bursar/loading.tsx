import React from "react";

export default function BursarLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="h-28 w-full bg-slate-200 dark:bg-zinc-800 rounded-3xl" />

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-slate-200 dark:bg-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="h-4 w-24 bg-slate-300 dark:bg-zinc-700 rounded-md" />
            <div className="h-8 w-36 bg-slate-300 dark:bg-zinc-700 rounded-lg" />
            <div className="h-3 w-28 bg-slate-300 dark:bg-zinc-700 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content Split Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
        <div className="h-96 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
      </div>
    </div>
  );
}
