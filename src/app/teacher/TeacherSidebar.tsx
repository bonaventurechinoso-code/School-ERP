"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  GraduationCap,
  MessageSquare,
  UserCheck,
  LifeBuoy,
  LogOut,
  X,
  School as SchoolIcon,
} from "lucide-react";
import { teacherLogoutAction } from "./actions";

export interface TeacherSidebarProps {
  schoolName: string;
  schoolSubdomain: string;
  teacherName: string;
  teacherRole: string;
  staffEmail: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const TEACHER_NAV_MODULES = [
  { id: "my-class", label: "My Class", path: "/teacher/my-class", icon: LayoutDashboard },
  { id: "assignments", label: "Assignments", path: "/teacher/assignments", icon: ClipboardList },
  { id: "timetable", label: "Timetable", path: "/teacher/timetable", icon: Calendar, badge: "Live" },
  { id: "students", label: "Students", path: "/teacher/students", icon: GraduationCap },
  { id: "messages", label: "Messages", path: "/teacher/messages", icon: MessageSquare },
  { id: "profile", label: "Profile", path: "/teacher/profile", icon: UserCheck },
  { id: "support", label: "Support", path: "/teacher/support", icon: LifeBuoy },
] as const;

export function TeacherSidebar({
  schoolName,
  schoolSubdomain,
  teacherName,
  teacherRole,
  staffEmail,
  isOpen,
  setIsOpen,
}: TeacherSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      document.cookie = "mockTenant=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      try {
        const res = await teacherLogoutAction();
        router.push(res.redirectUrl || `/${schoolSubdomain}/login`);
      } catch {
        router.push(`/${schoolSubdomain}/login`);
      }
    });
  };

  const navContent = (
    <div className="h-full flex flex-col justify-between bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 shadow-sm">
      {/* Top Header / Branding & Identity Card */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* School Branding & Mobile Close Button */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/teacher/my-class"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 min-w-0 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 shrink-0 group-hover:scale-105 transition-transform">
              <SchoolIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white truncate leading-tight tracking-tight">
                {schoolName}
              </h2>
            </div>
          </Link>

          {/* Close button on mobile viewport */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close Navigation Drawer"
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Teacher Profile Snapshot Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 space-y-1.5 shadow-2xs">
          <div className="flex items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              {teacherRole}
            </span>
          </div>
          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {teacherName.charAt(0) || "T"}
            </div>
            <p className="font-bold text-xs text-slate-800 dark:text-zinc-100 truncate">
              {teacherName}
            </p>
          </div>
        </div>

        {/* Core Navigation Matrix (10 Modules in exact order) */}
        <nav className="space-y-1 pt-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 pb-1">
            Modules
          </p>

          {TEACHER_NAV_MODULES.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/teacher/my-class"
                ? pathname === "/teacher/my-class" || pathname === "/teacher"
                : pathname.startsWith(item.path);

            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={() => setIsOpen(false)}
                className={`w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all group ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-extrabold border-r-2 border-emerald-500 shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100/70 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {"badge" in item && item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                      isActive
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Module 10: Logout Action Trigger & Footer */}
      <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-zinc-800 space-y-2">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-950/40 text-slate-700 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-300 text-xs font-bold border border-slate-200/80 dark:border-zinc-700/80 hover:border-red-200 dark:hover:border-red-900/60 transition-all cursor-pointer disabled:opacity-50"
        >
          <LogOut className="w-4 h-4 shrink-0 text-red-500" />
          <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (>= 1024px) */}
      <aside className="hidden lg:block w-64 h-screen fixed left-0 top-0 z-30 overflow-y-auto">
        {navContent}
      </aside>

      {/* Mobile Slide-over Drawer (< 1024px) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 overflow-y-auto transform transition ease-in-out duration-300">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
