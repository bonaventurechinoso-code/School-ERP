"use client";

import React, { useState, useEffect } from "react";
import { useTenant } from "@/lib/tenant-context";
import { AlertTriangle, PhoneCall, Landmark, Copy, Check } from "lucide-react";

export function SubscriptionLockModal() {
  const tenant = useTenant();
  const [isLocked, setIsLocked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tenant) return;

    // 1. Check strict model statuses
    if (tenant.subscriptionStatus === "EXPIRED" || tenant.subscriptionStatus === "PAST_DUE") {
      setIsLocked(true);
      return;
    }

    // 2. Check expiration date boundary crossover
    if (tenant.subscriptionExpiresAt) {
      const currentDate = new Date();
      const expiresAt = new Date(tenant.subscriptionExpiresAt);
      if (currentDate > expiresAt) {
        setIsLocked(true);
      }
    }
  }, [tenant]);

  const handleCopyAccount = (acc: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(acc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // If the tenant is active, don't render anything
  if (!isLocked) return null;

  return (
    // Unclosable full-screen backdrop blurring the underlying admin panel layout
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white dark:bg-zinc-950 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-xl w-full mx-4 text-center border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-300">
        
        {/* Warning Icon Layer */}
        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-5 shadow-inner">
          <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
          SaaS Access Paused for {tenant.name}
        </h2>
        
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mb-6 leading-relaxed font-medium">
          Your flat monthly SaaS portal subscription has expired. Please manually transfer your subscription fee directly to the platform corporate account below to restore instant system operations.
        </p>

        {/* Platform Manual Transfer Account Details Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-left mb-6 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-indigo-500" />
              Platform Corporate Account
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">0% Fee Verified</span>
          </div>

          <div className="flex items-center justify-between bg-white dark:bg-zinc-950 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Bank & Account Number</div>
              <div className="text-base font-mono font-black text-slate-900 dark:text-white tracking-wide">
                Wema Bank • 0123456789
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopyAccount("0123456789")}
              className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
              title="Copy Account Number"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
            *Please include your school subdomain (<strong>{tenant.subdomain}</strong>) as payment reference/narration.
          </p>
        </div>
        
        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="mailto:billing@bonaveeict.com.ng?subject=SaaS%20Subscription%20Renewal%20Proof"
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
          >
            Submit Transfer Receipt
          </a>
          
          <a
            href="tel:+2348000000000"
            className="w-full sm:w-auto bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-4 h-4" />
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

