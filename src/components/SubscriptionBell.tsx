"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, Landmark, ShieldCheck, ArrowRight, Clock, AlertCircle } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";

export default function SubscriptionBell() {
  const tenant = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Status computation
  const status = (tenant?.subscriptionStatus || "ACTIVE").toUpperCase();
  const isActive = status === "ACTIVE";
  const isPendingVerification = status === "PENDING_VERIFICATION" || status === "PENDING";
  const isPastDue = status === "PAST_DUE" || status === "EXPIRED";

  // Check if renewal is within 7 days
  const expiresAt = tenant?.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
  const daysUntilExpiry = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 30;
  const isNearRenewal = expiresAt ? daysUntilExpiry <= 7 : false;

  const requiresAttention = !isActive || isNearRenewal || isPendingVerification;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Bank display details (instruction micro-copy per requirement)
  const bankName = tenant?.platformBank?.bankName || "Fidelity Bank";
  const accountNumber = tenant?.platformBank?.accountNumber || "6550257550";

  // Route to billing settings page
  const billingUrl = tenant?.subdomain
    ? `/${tenant.subdomain}/settings/billing`
    : "/dashboard/settings/billing";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer relative text-slate-600 dark:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        aria-label="Subscription Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        
        {/* Pulsing Dot Notification Badge */}
        {requiresAttention && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse ring-2 ring-white dark:ring-zinc-900" />
        )}
      </button>

      {/* Floating Dropdown Panel Overlay */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-2xl z-50 p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
              SaaS Portal Subscription
            </span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>

          {/* Status Indicator Row */}
          <div className="py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Status:</span>
            {isActive && !isNearRenewal && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            )}
            {isActive && isNearRenewal && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                <Clock className="w-3 h-3" />
                Renew in {daysUntilExpiry}d
              </span>
            )}
            {isPendingVerification && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                <Clock className="w-3 h-3" />
                Pending Verification
              </span>
            )}
            {isPastDue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                <AlertCircle className="w-3 h-3" />
                Past Due
              </span>
            )}
          </div>

          {/* Payment Instructions Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1.5 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              <Landmark className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              Corporate Bank Transfer
            </div>
            {/* Required instruction micro-copy */}
            <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 leading-snug">
              Renew via Transfer to: <span className="font-bold text-indigo-600 dark:text-indigo-400">{bankName} — {accountNumber}</span>
            </p>
            {expiresAt && (
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                Next Invoice Date: {expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </div>

          {/* Interactive Trigger CTA Button */}
          <Link
            href={billingUrl}
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <span>Submit Transfer Proof</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Micro-Disclaimer */}
          <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-2.5 text-center leading-tight">
            *0% Transaction Fee Architecture. Schools retain 100% of student tuition collections.
          </p>
        </div>
      )}
    </div>
  );
}
