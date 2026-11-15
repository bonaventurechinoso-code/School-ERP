import React from "react";
import Image from "next/image";
import { Building2, Home, Sparkles, ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Page Not Found | BonaveeICT School ERP",
  description: "The requested page could not be found.",
};

export default function RootNotFound() {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-zinc-950 flex flex-col justify-start py-8 sm:py-16 px-4 sm:px-6 overflow-y-auto selection:bg-indigo-600 selection:text-white">
      <div className="w-full max-w-lg mx-auto my-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <Image
            src="/img/business-logo.png"
            alt="School ERP"
            width={28}
            height={28}
            className="w-7 h-7 rounded-lg object-contain"
          />
          <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-extrabold">
            BonaveeICT School ERP
          </span>
        </div>

        {/* 404 Icon Graphic */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Building2 className="w-8 h-8" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span>HTTP 404 &bull; Resource Not Found</span>
        </div>

        {/* Heading & Notice */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
            The page or institutional portal you are attempting to reach does not exist.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <a
            href="https://bonaveeict.com.ng"
            className="flex-1 py-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </a>
          <a
            href="https://bonaveeict.com.ng/register"
            className="flex-1 py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Onboard Institution</span>
          </a>
        </div>
      </div>
    </div>
  );
}
