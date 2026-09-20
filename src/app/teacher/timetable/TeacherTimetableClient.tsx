"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  CalendarDays,
  Sparkles,
} from "lucide-react";

interface TimetablePeriod {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseName: string;
  courseCode: string;
  classroomName: string;
}

interface TeacherTimetableClientProps {
  timetable: TimetablePeriod[];
  schoolName: string;
  teacherName: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function TeacherTimetableClient({
  timetable,
  schoolName,
  teacherName,
}: TeacherTimetableClientProps) {
  const [activeDay, setActiveDay] = useState<string>("Monday");

  // Group by day of week
  const groupedByDay = WEEKDAYS.reduce((acc, day) => {
    acc[day] = timetable.filter(
      (t) => t.dayOfWeek.toLowerCase() === day.toLowerCase()
    );
    return acc;
  }, {} as Record<string, TimetablePeriod[]>);

  const activePeriods = groupedByDay[activeDay] || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Academic Schedule Grid</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Teaching Timetable & Rotations
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Daily subject allocations, classroom rooming, and period timings.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60">
          <span>Total Weekly Periods: {timetable.length}</span>
        </div>
      </div>

      {/* Weekday Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-zinc-800">
        {WEEKDAYS.map((day) => {
          const count = groupedByDay[day]?.length || 0;
          const isActive = activeDay === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDay(day)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800"
              }`}
            >
              <span>{day}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day Schedule Grid */}
      <div className="space-y-4">
        {activePeriods.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePeriods.map((period, idx) => (
              <div
                key={period.id}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4 hover:border-emerald-500/50 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>
                      {period.startTime} - {period.endTime}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Period #{idx + 1}
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    {period.courseName}
                  </h3>
                  <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    {period.courseCode}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-zinc-300">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{period.classroomName}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    45 mins
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto" />
            <p className="font-bold text-sm text-slate-600 dark:text-zinc-400">
              No teaching periods scheduled on {activeDay}.
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">
              This day is free of scheduled lectures according to the active term timetable.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
