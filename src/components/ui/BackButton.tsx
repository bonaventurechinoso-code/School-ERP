"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  className?: string;
}

export default function BackButton({ className = "" }: BackButtonProps) {
  const r = useRouter();
  return (
    <button
      type="button"
      onClick={() => r.back()}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-700/80 border border-slate-200 dark:border-zinc-700 shadow-2xs transition-all cursor-pointer ${className}`}
    >
      ← Back
    </button>
  );
}
