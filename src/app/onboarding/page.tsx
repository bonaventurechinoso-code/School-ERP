"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Clock, ArrowRight, Building, Sparkles } from "lucide-react";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenant") || "trial";
  const schoolName = tenantSlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto mb-6">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            14-Day Free Trial Activated
          </span>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            Welcome to {schoolName}
          </h1>
          <p className="text-slate-400 text-sm">
            Your dedicated cloud ERP tenant is live and isolated on{" "}
            <span className="text-blue-400 font-mono font-semibold">
              {tenantSlug}.bonaveeict.com.ng
            </span>
          </p>
        </div>

        {/* Trial Status Card */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Trial Period:
            </span>
            <span className="font-bold text-amber-300">14 Days Remaining</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Plan Tier:
            </span>
            <span className="font-bold text-slate-200">Free Trial (Full Features)</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" /> Tenant Boundary:
            </span>
            <span className="font-mono text-xs text-blue-300 font-bold">{tenantSlug}</span>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2.5 mb-8 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Dedicated PostgreSQL multi-tier tenant created with 0 setup charge</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Clean initial state: ready to enroll your first pupils & teachers</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Super Admin platform notified with live countdown tracking</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/${tenantSlug}/dashboard`}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl text-center text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>Enter Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/login?school=${tenantSlug}`}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold py-3.5 px-6 rounded-xl text-center text-sm transition-all"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading onboarding...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
