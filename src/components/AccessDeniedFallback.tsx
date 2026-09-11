"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, LogOut } from "lucide-react";

interface AccessDeniedFallbackProps {
  title?: string;
  message?: string;
  role?: string;
  portalUrl?: string;
  portalLabel?: string;
}

export default function AccessDeniedFallback({
  title = "Access Denied",
  message = "You do not have permission to view this administrative workspace. This area is strictly reserved for authorized administrators.",
  role,
  portalUrl,
  portalLabel,
}: AccessDeniedFallbackProps) {
  const resolvedPortalUrl = portalUrl || (role?.toUpperCase() === "STUDENT" ? "/portal/student" : "/portal/staff");
  const resolvedPortalLabel = portalLabel || (role?.toUpperCase() === "STUDENT" ? "Return to Student Portal" : "Return to Staff Workspace");

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-950/80 rounded-3xl p-8 sm:p-10 shadow-xl shadow-red-500/5 text-center relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100/70 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs font-bold uppercase tracking-wider mb-4 border border-red-200 dark:border-red-800">
          <span>Security Guard Activated</span>
          {role && (
            <>
              <span>•</span>
              <span>Role: {role}</span>
            </>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
          {title}
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed mb-8">
          {message}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={resolvedPortalUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 font-bold text-sm shadow-md transition active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>{resolvedPortalLabel}</span>
          </Link>
          <button
            onClick={() => {
              document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
              window.location.href = "/login";
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-sm transition active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
