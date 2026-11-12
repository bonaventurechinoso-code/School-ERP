"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/lib/session-context";
import { performTenantLogout } from "@/lib/client-logout";

interface TenantAuthActionsProps {
  initialIsAuthed: boolean;
  workspaceHref: string;
  email?: string | null;
  subdomain: string;
  variant?: "header" | "footer";
}

export function TenantAuthActions({
  initialIsAuthed,
  workspaceHref,
  email,
  subdomain,
  variant = "header",
}: TenantAuthActionsProps) {
  const { session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Strict check: only genuine portal roles count as authenticated (exclude guest applicants)
  const isClientAuthed = Boolean(
    session &&
    session.role &&
    session.role !== "GUEST_APPLICANT" &&
    session.role !== "GUEST" &&
    session.role !== "APPLICANT"
  );

  const effectiveIsAuthed = mounted ? isClientAuthed : initialIsAuthed;
  const displayEmail = email || session?.email;

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    await performTenantLogout({
      schoolDomain: subdomain,
      redirectUrl: `/${subdomain}`,
    });
  };

  if (variant === "footer") {
    if (effectiveIsAuthed) {
      return (
        <>
          <Link
            href={workspaceHref}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          >
            <span>Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors border border-white/10 cursor-pointer disabled:opacity-50"
          >
            <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
          </button>
        </>
      );
    }

    return (
      <Link
        href={`/${subdomain}/login`}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
      >
        <span>Sign In</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }

  // Header (Canva bar) variant
  if (effectiveIsAuthed) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        {displayEmail && (
          <span className="text-xs text-slate-600 hidden md:inline font-medium">{displayEmail}</span>
        )}
        <Link
          href={workspaceHref}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-xs text-xs sm:text-sm"
        >
          <span>Dashboard</span>
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-1 px-3 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-50"
        >
          <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
        </button>
      </div>
    );
  }

  return (
    <Link
      href={`/${subdomain}/login`}
      className="inline-flex items-center gap-1.5 sm:gap-2 px-4 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-all shadow-xs text-xs sm:text-sm border border-slate-800"
    >
      <span>Sign In</span>
      <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
    </Link>
  );
}

