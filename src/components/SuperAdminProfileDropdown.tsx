"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  User,
  ShieldCheck,
  KeyRound,
  Mail,
  Laptop,
  LogOut,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface SuperAdminProfileDropdownProps {
  initialEmail?: string;
  initialName?: string;
  align?: "left" | "right";
}

export default function SuperAdminProfileDropdown({
  initialEmail = "bonaventure.chinoso@gmail.com",
  initialName = "Super Administrator",
  align = "right",
}: SuperAdminProfileDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState(initialName);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or ESC key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Fetch fresh profile state from /api/admin/profile
  useEffect(() => {
    let isMounted = true;
    fetch("/api/admin/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.profile) {
          if (data.profile.email) setEmail(data.profile.email);
          if (data.profile.displayName) setDisplayName(data.profile.displayName);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      await signOut({ callbackUrl: "/login" });
    } catch {
      window.location.href = "/login";
    }
  };

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SA";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
      >
        {/* Avatar Monogram */}
        <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-900 text-white font-black text-xs flex items-center justify-center shadow-xs select-none shrink-0 tracking-tight">
          <span>{initials}</span>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
        </div>

        {/* Text Details (Hidden on small mobile) */}
        <div className="hidden sm:flex flex-col text-left leading-tight max-w-[130px] truncate">
          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {displayName}
          </span>
          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase truncate">
            Super-Admin
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "left" ? "left-0" : "right-0"
          } mt-2 w-72 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header Card */}
          <div className="p-4 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 dark:from-zinc-900 dark:via-indigo-950/20 dark:to-zinc-800/80 border-b border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-900 text-white font-extrabold text-sm flex items-center justify-center shadow-md shrink-0">
                {initials}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {displayName}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 truncate font-mono">
                  {email}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60 dark:border-zinc-800/80">
              <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[10px]">
                <ShieldCheck className="w-3.5 h-3.5" /> Root Platform Scope
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                Verified Owner
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-2 space-y-0.5">
            <Link
              href="/admin/profile"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-zinc-800/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
            >
              <User className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
              <div className="flex-1 text-left">
                <div className="leading-tight">Profile & Account Settings</div>
                <div className="text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  Update identity details & avatar
                </div>
              </div>
            </Link>

            <Link
              href="/admin/profile#security"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-zinc-800/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
            >
              <KeyRound className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
              <div className="flex-1 text-left">
                <div className="leading-tight">Security & Passwords</div>
                <div className="text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  NIST 12-round BCrypt update
                </div>
              </div>
            </Link>

            <Link
              href="/admin/profile#email"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-zinc-800/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
            >
              <Mail className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
              <div className="flex-1 text-left">
                <div className="leading-tight">Update Root Email</div>
                <div className="text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  Verified OTP dispatch pipeline
                </div>
              </div>
            </Link>

            <Link
              href="/admin/profile#sessions"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-zinc-800/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
            >
              <Laptop className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
              <div className="flex-1 text-left">
                <div className="leading-tight">Active Device Sessions</div>
                <div className="text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  Selective device revocation
                </div>
              </div>
            </Link>
          </div>

          {/* Footer Action */}
          <div className="p-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoggingOut ? "Signing out..." : "Sign Out of Console"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
