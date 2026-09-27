"use client";

import React, { useEffect } from "react";
import { X, Building2 } from "lucide-react";
import RegisterSchoolForm from "./RegisterSchoolForm";

interface RegisterSchoolDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RegisterSchoolDrawer({ isOpen, onClose }: RegisterSchoolDrawerProps) {
  // Listen for Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg h-full bg-white dark:bg-zinc-900 border-l border-slate-200/80 dark:border-zinc-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 text-left">
        {/* Top Decorative Gradient Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shrink-0" />

        {/* Drawer Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between gap-4 bg-slate-50/60 dark:bg-zinc-950/40 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Register Institutional Tenant
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Provision a new school workspace, configure master credentials, and assign academic tiers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <RegisterSchoolForm onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}
