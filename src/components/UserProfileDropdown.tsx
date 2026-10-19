"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  KeyRound,
  Mail,
  LogOut,
  ChevronDown,
  Building2,
} from "lucide-react";
import { useSession } from "@/lib/session-context";
import { useTenant } from "@/lib/tenant-context";

interface UserProfileDropdownProps {
  schoolName: string;
  schoolDomain: string;
}

export default function UserProfileDropdown({
  schoolName,
  schoolDomain,
}: UserProfileDropdownProps) {
  const router = useRouter();
  const { session, role, staffRole } = useSession();
  const tenant = useTenant();

  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isSuper =
    (role || session?.role || tenant?.userRole || "").toUpperCase() === "SUPER_ADMIN" ||
    session?.email === "bonaventure.chinoso@gmail.com" ||
    session?.email === "admin@bonaveeict.com.ng";

  // Tenant header must show tenant user only; never leak Super Admin identity
  const displayName = isSuper
    ? (schoolName ? `${schoolName} Admin` : "School Administrator")
    : (session?.name || session?.firstName ? `${session?.firstName || ""} ${session?.lastName || ""}`.trim() : session?.email?.split("@")[0] || "Administrator");

  const displayEmail = isSuper
    ? `admin@${schoolDomain || "tenant"}.edu.ng`
    : (session?.email || `admin@${schoolDomain || "tenant"}.edu.ng`);

  const displayRole = isSuper
    ? "SCHOOL ADMINISTRATOR"
    : (staffRole || role || tenant?.userRole || "Tenant Admin")
        .replace(/_/g, " ")
        .toUpperCase();

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AD";

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        document.cookie = "activeTier=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      }
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Topbar Avatar Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile menu"
        className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-98"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white dark:ring-zinc-900">
          {initials}
        </div>
        <div className="hidden md:flex flex-col text-left leading-tight pr-1">
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[130px]">
            {displayName}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 truncate max-w-[130px]">
            {displayRole}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-indigo-500" : ""
          }`}
        />
      </button>

      {/* Profile Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 select-none"
        >
          {/* User Snapshot Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                  {displayEmail}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50 uppercase tracking-wider">
                    {displayRole}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="py-1.5 px-1 space-y-0.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
            {/* 1. Profile */}
            <Link
              href={`/${schoolDomain}/settings/security`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition-colors"
            >
              <User className="w-4 h-4 text-indigo-500" />
              <span>Profile</span>
            </Link>

            {/* 2. Security & Password */}
            <Link
              href={`/${schoolDomain}/settings/security`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span>Security & Password</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* 4. Logout Action */}
          <div className="px-1 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowLogoutModal(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Log out?
            </h3>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Are you sure you want to end your current session for{" "}
              <strong>{schoolName || "this institution"}</strong>?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-2"
              >
                {isLoggingOut && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
