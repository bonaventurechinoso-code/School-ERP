import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";

export default function TrialExpiredPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center">
        {/* Warning Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 shadow-inner">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>

        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
          <ShieldAlert className="w-3.5 h-3.5" />
          Access Interrupted
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-4">
          Trial Period Expired
        </h1>

        {/* Required Notification Message */}
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-medium mb-8">
          Your 14-day trial has expired. Please upgrade your subscription to regain access.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Link
            href="/#pricing"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 group"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            Upgrade Subscription Plan
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/"
            className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold py-3 px-6 rounded-xl transition border border-slate-700/50"
          >
            Return to Homepage
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-xs text-slate-500">
          Need assistance or data migration support? Contact billing at{" "}
          <a href="mailto:support@bonaveeict.com.ng" className="text-blue-400 hover:underline">
            support@bonaveeict.com.ng
          </a>
        </div>
      </div>
    </div>
  );
}
