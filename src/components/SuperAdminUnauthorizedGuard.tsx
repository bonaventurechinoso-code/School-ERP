"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowRight, Loader2, AlertCircle, X } from "lucide-react";
import { getStoredSession } from "@/lib/session-context";

interface SuperAdminUnauthorizedGuardProps {
  userRole?: string;
}

export default function SuperAdminUnauthorizedGuard({
  userRole = "",
}: SuperAdminUnauthorizedGuardProps) {
  const router = useRouter();
  const [safeTarget, setSafeTarget] = useState("/dashboard/admin");
  const [countdown, setCountdown] = useState(2);
  const [showToast, setShowToast] = useState(true);

  useEffect(() => {
    // Sanitize address bar immediately to prevent any query parameter leakage
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const session = getStoredSession();
    const effectiveRole = (session?.role || session?.userRole || userRole || "").toUpperCase();
    const staffRole = (session?.staffRole || "").toUpperCase();
    const domain = session?.schoolDomain || "";

    let destination = "/dashboard/admin";
    if (effectiveRole === "SUPER_ADMIN") {
      destination = "/dashboard/super-admin";
    } else if (
      effectiveRole === "SCHOOL_ADMIN" ||
      effectiveRole === "TENANT_ADMIN" ||
      effectiveRole === "ADMIN" ||
      effectiveRole === "PRINCIPAL" ||
      effectiveRole === "VICE_PRINCIPAL" ||
      effectiveRole === "HEADMASTER"
    ) {
      destination = domain ? `/${domain}/dashboard` : "/dashboard/admin";
    } else if (
      effectiveRole === "TEACHER" ||
      effectiveRole === "STAFF" ||
      effectiveRole === "BURSAR" ||
      effectiveRole === "ACCOUNTANT" ||
      staffRole.includes("TEACHER") ||
      staffRole.includes("STAFF")
    ) {
      destination = "/dashboard/teacher";
    } else if (effectiveRole === "STUDENT") {
      destination = domain ? `/${domain}/portal/student` : "/dashboard/student";
    } else if (effectiveRole === "PARENT") {
      destination = "/dashboard/parent";
    }

    setSafeTarget(destination);

    // Controlled push redirect to the user's safe workspace
    const redirectTimer = setTimeout(() => {
      router.push(destination);
    }, 1800);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    return () => {
      clearTimeout(redirectTimer);
      clearInterval(countdownInterval);
    };
  }, [router, userRole]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-white relative">
      {/* Floating Toast Notification Overlay */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 right-6 z-50 max-w-sm sm:max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="p-4 rounded-2xl shadow-xl border bg-white/95 dark:bg-zinc-900/95 border-red-200 dark:border-red-900/80 text-red-700 dark:text-red-300 shadow-red-900/5 backdrop-blur-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
              Access Denied: You do not have permission to view the Super Admin control plane. Redirecting to your workspace...
            </div>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors duration-150 p-1 rounded-lg focus:outline-none"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl shadow-slate-900/5 text-center relative overflow-hidden">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 text-red-600 dark:text-red-400 mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100/70 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs font-bold uppercase tracking-wider mb-4 border border-red-200 dark:border-red-800">
          <span>Security Guard (HTTP 403)</span>
          {userRole && (
            <>
              <span>•</span>
              <span>{userRole}</span>
            </>
          )}
        </div>

        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
          Control Plane Protected
        </h1>

        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-6">
          Access Denied: You do not have permission to view the Super Admin control plane. Redirecting to your authorized workspace footprint in {countdown}s...
        </p>

        <div className="flex items-center justify-center gap-2 mb-6 text-xs text-slate-500 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Navigating to {safeTarget}...</span>
        </div>

        <button
          onClick={() => router.push(safeTarget)}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
        >
          <span>Go to Workspace Now</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
