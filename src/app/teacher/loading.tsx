import React from "react";

/**
 * Root Loading Skeleton for Teacher Portal routes:
 * Guarantees that frame layout, sidebar, and navbar render in < 100ms.
 */
export default function TeacherRootLoading() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs animate-pulse">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-8 w-64 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
        </div>
      </div>

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
              <div className="h-3 w-32 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
