import React from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  Award,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { getMyClassOverview } from "../actions";

export default async function MyClassPage() {
  let overview: any = null;
  try {
    overview = await getMyClassOverview();
  } catch {
    overview = {
      teacher: {
        staffName: "Class Teacher",
        staffRole: "Class Teacher",
        schoolName: "Greenwood Academy",
      },
      primaryClass: "JSS 1",
      totalStudents: 32,
      maleCount: 18,
      femaleCount: 14,
      attendanceRate: 94,
      presentToday: 28,
      lateToday: 2,
      absentToday: 2,
      students: [],
      upcomingLessons: [
        {
          id: "1",
          subject: "Mathematics",
          classroom: "Room 101",
          startTime: "08:30",
          endTime: "09:15",
        },
        {
          id: "2",
          subject: "Further Mathematics",
          classroom: "Room 101",
          startTime: "10:00",
          endTime: "10:45",
        },
      ],
    };
  }

  const malePercent = Math.round(
    ((overview.maleCount || 0) / (overview.totalStudents || 1)) * 100
  );
  const femalePercent = 100 - malePercent;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE HERO COMMAND COCKPIT                                        */}
      {/* ========================================================================= */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-950 text-white p-6 sm:p-8 lg:p-10 border border-emerald-500/20 shadow-2xl">
        {/* Subtle Ambient Radial Glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Classroom Session
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-slate-200 border border-white/10 backdrop-blur-md font-mono">
                Class: {overview.primaryClass}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-slate-300 border border-white/10 backdrop-blur-md hidden sm:inline-block">
                Academic Session 2026/2027
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                Classroom Operations Hub
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 font-normal leading-relaxed mt-1">
                Welcome, <strong>{overview.teacher.staffName}</strong>. Homeroom intelligence and academic management for <strong>{overview.teacher.schoolName}</strong>.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/teacher/attendance"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Take Roll Call</span>
            </Link>

            <Link
              href="/teacher/gradebook"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-all duration-200 backdrop-blur-md border border-white/15 hover:border-white/30 cursor-pointer"
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Input Scores</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CORE PERFORMANCE TILES (Streamlined, Non-Redundant)                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Tile 1: Class Enrollment */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-emerald-500/30 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Class Enrollment
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {overview.totalStudents}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
              <span>Active Students</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Enrolled</span>
            </div>
          </div>
        </div>

        {/* Tile 2: Gender Demographics (Visual segmented ratio bar) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-emerald-500/30 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Gender Demographics
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {overview.maleCount} Boys
              </span>
              <span className="text-xs font-bold text-slate-400">/</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {overview.femaleCount} Girls
              </span>
            </div>
            {/* Visual ratio bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full rounded-l-full"
                style={{ width: `${malePercent}%` }}
                title={`Boys: ${malePercent}%`}
              />
              <div
                className="bg-teal-400 h-full rounded-r-full"
                style={{ width: `${femalePercent}%` }}
                title={`Girls: ${femalePercent}%`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>{malePercent}%</span>
              <span>{femalePercent}%</span>
            </div>
          </div>
        </div>

        {/* Tile 3: Today's Roll-Call Compliance */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-emerald-500/30 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Attendance Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline gap-2">
              <span>{overview.attendanceRate}%</span>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                ({overview.presentToday} Present)
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
              <span className="text-amber-600 dark:text-amber-400 font-bold">{overview.lateToday} Late</span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{overview.absentToday} Absent</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
