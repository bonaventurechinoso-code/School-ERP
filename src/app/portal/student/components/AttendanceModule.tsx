"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  BarChart3,
  Flame,
  ChevronLeft,
  ChevronRight,
  Info,
  Award,
  ShieldCheck,
} from "lucide-react";
import { TierPresentationConfig } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "HOLIDAY" | "WEEKEND";

interface AttendanceDay {
  date: string;       // "YYYY-MM-DD"
  status: AttendanceStatus;
  note?: string;
  arrivalTime?: string;
}

interface TermAttendanceSummary {
  termName: string;
  session: string;
  totalSchoolDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysExcused: number;
  attendanceRate: number;
  streak: number; // Current consecutive present days
  longestStreak: number;
  records: AttendanceDay[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Data generators – realistic Nigerian school calendar 2026/2027 First Term
// School days: September – December, Mon-Fri, excluding public holidays
// ─────────────────────────────────────────────────────────────────────────────

function buildAttendanceData(): AttendanceDay[] {
  const records: AttendanceDay[] = [];

  // Nigerian school year: First Term runs roughly Sep–Nov
  // We'll build Sep, Oct, Nov 2026 calendar
  const months = [
    { year: 2026, month: 8 },  // September (0-indexed)
    { year: 2026, month: 9 },  // October
    { year: 2026, month: 10 }, // November
  ];

  // Public holidays (Nigeria) in this period
  const publicHolidays = new Set([
    "2026-10-01", // Independence Day
  ]);

  // Student-specific absences / lates
  const overrides: Record<string, { status: AttendanceStatus; note?: string; arrivalTime?: string }> = {
    "2026-09-10": { status: "LATE", note: "Traffic delay", arrivalTime: "8:42 AM" },
    "2026-09-17": { status: "ABSENT", note: "Fever – medical certificate presented" },
    "2026-09-18": { status: "ABSENT", note: "Continuing illness – parent notified" },
    "2026-09-30": { status: "LATE", note: "Car breakdown", arrivalTime: "9:05 AM" },
    "2026-10-01": { status: "HOLIDAY", note: "Independence Day" },
    "2026-10-15": { status: "EXCUSED", note: "Family bereavement – compassionate leave" },
    "2026-11-04": { status: "LATE", note: "Heavy rain", arrivalTime: "8:55 AM" },
    "2026-11-18": { status: "ABSENT", note: "Unexcused absence" },
  };

  months.forEach(({ year, month }) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        records.push({ date: dateStr, status: "WEEKEND" });
        continue;
      }

      if (publicHolidays.has(dateStr)) {
        records.push({ date: dateStr, status: "HOLIDAY", note: overrides[dateStr]?.note });
        continue;
      }

      if (overrides[dateStr]) {
        records.push({ date: dateStr, ...overrides[dateStr] });
        continue;
      }

      // Default: PRESENT with occasional arrival times
      records.push({
        date: dateStr,
        status: "PRESENT",
        arrivalTime: Math.random() > 0.7 ? "7:52 AM" : "7:45 AM",
      });
    }
  });

  return records;
}

function computeSummary(records: AttendanceDay[]): Omit<TermAttendanceSummary, "termName" | "session"> {
  const schoolDays = records.filter(r => r.status !== "WEEKEND");
  const totalSchoolDays = schoolDays.length;
  const daysPresent = schoolDays.filter(r => r.status === "PRESENT").length;
  const daysAbsent = schoolDays.filter(r => r.status === "ABSENT").length;
  const daysLate = schoolDays.filter(r => r.status === "LATE").length;
  const daysExcused = schoolDays.filter(r => r.status === "EXCUSED").length;
  const attendanceRate = totalSchoolDays > 0
    ? Math.round(((daysPresent + daysLate + daysExcused) / totalSchoolDays) * 1000) / 10
    : 0;

  // Calculate streak (consecutive present/late from the latest record backwards)
  let streak = 0;
  for (let i = schoolDays.length - 1; i >= 0; i--) {
    if (schoolDays[i].status === "PRESENT" || schoolDays[i].status === "LATE") {
      streak++;
    } else if (schoolDays[i].status === "ABSENT") {
      break;
    }
  }

  // Longest streak
  let longestStreak = 0, currentStreak = 0;
  schoolDays.forEach(r => {
    if (r.status === "PRESENT" || r.status === "LATE") {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (r.status === "ABSENT") {
      currentStreak = 0;
    }
  });

  return { totalSchoolDays, daysPresent, daysAbsent, daysLate, daysExcused, attendanceRate, streak, longestStreak, records };
}

// ─────────────────────────────────────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AttendanceStatus, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
  PRESENT: { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/30", label: "Present", icon: <CheckCircle2 className="w-3 h-3" /> },
  ABSENT:  { bg: "bg-red-500/20",     text: "text-red-300",     border: "border-red-500/30",     label: "Absent",  icon: <XCircle className="w-3 h-3" /> },
  LATE:    { bg: "bg-amber-500/20",   text: "text-amber-300",   border: "border-amber-500/30",   label: "Late",    icon: <Clock className="w-3 h-3" /> },
  EXCUSED: { bg: "bg-blue-500/20",    text: "text-blue-300",    border: "border-blue-500/30",    label: "Excused", icon: <ShieldCheck className="w-3 h-3" /> },
  HOLIDAY: { bg: "bg-purple-500/20",  text: "text-purple-300",  border: "border-purple-500/30",  label: "Holiday", icon: <Award className="w-3 h-3" /> },
  WEEKEND: { bg: "bg-slate-800/40",   text: "text-slate-600",   border: "border-slate-700/20",   label: "Weekend", icon: null },
};

// Calendar cell colours for the heatmap dots
const CELL_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-500",
  ABSENT:  "bg-red-500",
  LATE:    "bg-amber-400",
  EXCUSED: "bg-blue-400",
  HOLIDAY: "bg-purple-500",
  WEEKEND: "bg-slate-800",
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini Calendar Component
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface MonthCalendarProps {
  year: number;
  month: number; // 0-indexed
  records: AttendanceDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

function MonthCalendar({ year, month, records, selectedDate, onSelectDate }: MonthCalendarProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const recordMap = useMemo(() => {
    const m: Record<string, AttendanceDay> = {};
    records.forEach(r => { m[r.date] = r; });
    return m;
  }, [records]);

  const cells: (null | number)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // Pad to complete grid rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-2">
      <div className="text-center">
        <span className="text-xs font-black text-white">{MONTH_NAMES[month]} {year}</span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-[9px] font-bold text-slate-500 py-1">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const record = recordMap[dateStr];
          const status = record?.status ?? "WEEKEND";
          const isSelected = dateStr === selectedDate;
          const isWeekend = status === "WEEKEND";

          return (
            <button
              key={idx}
              type="button"
              onClick={() => !isWeekend && onSelectDate(dateStr)}
              disabled={isWeekend}
              title={record?.note || STATUS_STYLES[status].label}
              className={`relative flex flex-col items-center justify-center aspect-square rounded-lg transition-all duration-150 ${
                isWeekend ? "cursor-default opacity-30" : "cursor-pointer hover:ring-2 hover:ring-white/20"
              } ${isSelected ? "ring-2 ring-white/60 bg-slate-700/60" : ""}`}
            >
              <span className={`text-[10px] font-bold ${isWeekend ? "text-slate-600" : "text-slate-300"}`}>{day}</span>
              {!isWeekend && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${CELL_COLOR[status]}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Bar Mini-Chart
// ─────────────────────────────────────────────────────────────────────────────

function WeeklyTrendChart({ records }: { records: AttendanceDay[] }) {
  // Group school days by ISO week
  const weekMap = new Map<string, { present: number; absent: number; late: number }>();
  records
    .filter(r => r.status !== "WEEKEND" && r.status !== "HOLIDAY")
    .forEach(r => {
      const d = new Date(r.date);
      const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
      const weekNum = Math.ceil((dayOfYear + new Date(d.getFullYear(), 0, 1).getDay()) / 7);
      const key = `W${weekNum}`;
      if (!weekMap.has(key)) weekMap.set(key, { present: 0, absent: 0, late: 0 });
      const w = weekMap.get(key)!;
      if (r.status === "PRESENT") w.present++;
      else if (r.status === "ABSENT") w.absent++;
      else if (r.status === "LATE") w.late++;
    });

  const weeks = Array.from(weekMap.entries()).slice(-8); // Last 8 weeks
  const maxDays = 5;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5 h-20">
        {weeks.map(([week, data]) => {
          const presentH = (data.present / maxDays) * 100;
          const lateH = (data.late / maxDays) * 100;
          const absentH = (data.absent / maxDays) * 100;
          return (
            <div key={week} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col justify-end rounded-sm overflow-hidden h-16" title={`${week}: ${data.present}P ${data.late}L ${data.absent}A`}>
                <div style={{ height: `${presentH}%` }} className="bg-emerald-500 w-full transition-all duration-500" />
                <div style={{ height: `${lateH}%` }} className="bg-amber-400 w-full transition-all duration-500" />
                <div style={{ height: `${absentH}%` }} className="bg-red-500 w-full transition-all duration-500" />
              </div>
              <span className="text-[8px] text-slate-500 font-mono">{week}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 justify-center">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /><span className="text-[10px] text-slate-400">Present</span></div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /><span className="text-[10px] text-slate-400">Late</span></div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /><span className="text-[10px] text-slate-400">Absent</span></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Rate Ring
// ─────────────────────────────────────────────────────────────────────────────

function AttendanceRing({ rate }: { rate: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rate / 100) * circumference;
  const color = rate >= 95 ? "#10b981" : rate >= 80 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-black text-white leading-none">{rate}%</span>
        <span className="text-[9px] text-slate-400 font-semibold mt-0.5">Rate</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface AttendanceModuleProps {
  tierConfig: TierPresentationConfig;
  studentName: string;
  studentClass: string;
}

const MONTHS = [
  { year: 2026, month: 8, label: "September 2026" },
  { year: 2026, month: 9, label: "October 2026" },
  { year: 2026, month: 10, label: "November 2026" },
];

export function AttendanceModule({ tierConfig, studentName, studentClass }: AttendanceModuleProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonthIdx, setCalendarMonthIdx] = useState(1); // default to October

  const allRecords = useMemo(() => buildAttendanceData(), []);
  const summary = useMemo(() => computeSummary(allRecords), [allRecords]);

  const selectedRecord = selectedDate ? allRecords.find(r => r.date === selectedDate) : null;

  // Non-weekend, non-holiday school days for the log
  const schoolDayLog = allRecords
    .filter(r => r.status !== "WEEKEND")
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first

  const currentMonth = MONTHS[calendarMonthIdx];

  const rateColor = summary.attendanceRate >= 95
    ? "text-emerald-400" : summary.attendanceRate >= 80
    ? "text-amber-400" : "text-red-400";

  const rateLabel = summary.attendanceRate >= 95
    ? "Excellent" : summary.attendanceRate >= 80
    ? "Satisfactory" : "Needs Improvement";

  return (
    <div className="space-y-5 w-full">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-5 sm:p-6 shadow-lg border border-emerald-800/40 relative overflow-hidden">
        <div className="hidden sm:block absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden sm:block absolute -bottom-10 left-10 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Attendance Record</h2>
              <p className="text-[11px] text-emerald-300/80 font-medium mt-0.5">
                {tierConfig.category === "HIGHER_ED" ? "Semester Attendance" : "First Term 2026/2027"} • {studentClass}
              </p>
            </div>
          </div>

          {/* Attendance Rate Ring + stats */}
          <div className="flex items-center gap-5">
            <AttendanceRing rate={summary.attendanceRate} />
            <div className="space-y-1.5">
              <div className={`text-sm font-black ${rateColor}`}>{rateLabel}</div>
              <div className="text-[11px] text-slate-400">
                <span className="text-emerald-400 font-bold">{summary.daysPresent}</span> present •{" "}
                <span className="text-amber-400 font-bold">{summary.daysLate}</span> late •{" "}
                <span className="text-red-400 font-bold">{summary.daysAbsent}</span> absent
              </div>
              <div className="text-[11px] text-slate-400">
                <span className="text-blue-400 font-bold">{summary.daysExcused}</span> excused •{" "}
                <span className="text-slate-300 font-bold">{summary.totalSchoolDays}</span> total school days
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Present Days", value: summary.daysPresent, sub: `of ${summary.totalSchoolDays} school days`, color: "emerald", icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: "Current Streak", value: `${summary.streak}d`, sub: "consecutive attendance", color: "amber", icon: <Flame className="w-4 h-4" /> },
          { label: "Longest Streak", value: `${summary.longestStreak}d`, sub: "best run this term", color: "indigo", icon: <TrendingUp className="w-4 h-4" /> },
          { label: "Late / Absent", value: `${summary.daysLate}L / ${summary.daysAbsent}A`, sub: "flags this term", color: "rose", icon: <AlertTriangle className="w-4 h-4" /> },
        ].map(({ label, value, sub, color, icon }) => (
          <div key={label} className={`bg-[#1e1e2f] p-4 rounded-xl border border-${color}-900/50 relative overflow-hidden group hover:border-${color}-500/50 transition`}>
            <div className={`absolute top-0 inset-x-0 h-1 bg-${color}-500`} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</span>
              <div className={`w-7 h-7 rounded-lg bg-${color}-500/20 text-${color}-400 flex items-center justify-center shrink-0`}>
                {icon}
              </div>
            </div>
            <p className="text-xl font-black text-white truncate">{value}</p>
            <span className={`text-[10px] font-semibold text-${color}-400 mt-0.5 block truncate`}>{sub}</span>
          </div>
        ))}
      </div>

      {/* ── Main 2-col layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* Left: Calendar + Log */}
        <div className="space-y-5">

          {/* Calendar */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
            {/* Month navigator */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Monthly Calendar</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonthIdx(i => Math.max(0, i - 1))}
                  disabled={calendarMonthIdx === 0}
                  className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-300 w-36 text-center">{currentMonth.label}</span>
                <button
                  type="button"
                  onClick={() => setCalendarMonthIdx(i => Math.min(MONTHS.length - 1, i + 1))}
                  disabled={calendarMonthIdx === MONTHS.length - 1}
                  className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-400 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <MonthCalendar
              year={currentMonth.year}
              month={currentMonth.month}
              records={allRecords}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800">
              {(["PRESENT","LATE","ABSENT","EXCUSED","HOLIDAY"] as AttendanceStatus[]).map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${CELL_COLOR[s]}`} />
                  <span className="text-[10px] text-slate-400">{STATUS_STYLES[s].label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Day Detail */}
          {selectedRecord && selectedRecord.status !== "WEEKEND" && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${STATUS_STYLES[selectedRecord.status].bg} ${STATUS_STYLES[selectedRecord.status].border}`}>
              <div className={`mt-0.5 ${STATUS_STYLES[selectedRecord.status].text}`}>
                {STATUS_STYLES[selectedRecord.status].icon}
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-black ${STATUS_STYLES[selectedRecord.status].text}`}>
                    {new Date(selectedRecord.date + "T12:00").toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[selectedRecord.status].bg} ${STATUS_STYLES[selectedRecord.status].border} ${STATUS_STYLES[selectedRecord.status].text}`}>
                    {STATUS_STYLES[selectedRecord.status].label}
                  </span>
                </div>
                {selectedRecord.arrivalTime && (
                  <p className="text-[11px] text-slate-400">
                    Arrival time: <span className="font-semibold text-slate-300">{selectedRecord.arrivalTime}</span>
                  </p>
                )}
                {selectedRecord.note && (
                  <p className="text-[11px] text-slate-400">{selectedRecord.note}</p>
                )}
              </div>
            </div>
          )}

          {/* Daily Log Table */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">Daily Attendance Log</h3>
              <span className="text-[10px] text-slate-500">{schoolDayLog.length} school days</span>
            </div>
            <div className="overflow-y-auto max-h-80">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/60 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Arrival</th>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {schoolDayLog.map((r, idx) => {
                    const s = STATUS_STYLES[r.status];
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedDate(r.date === selectedDate ? null : r.date)}
                        className={`cursor-pointer transition hover:bg-slate-800/40 ${r.date === selectedDate ? "bg-slate-800/60" : ""}`}
                      >
                        <td className="px-4 py-2.5 text-[11px] font-mono text-slate-300 whitespace-nowrap">
                          {new Date(r.date + "T12:00").toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${s.bg} ${s.border} ${s.text}`}>
                            {s.icon}
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-400 font-mono hidden sm:table-cell">
                          {r.arrivalTime ?? (r.status === "ABSENT" ? "—" : r.status === "HOLIDAY" ? "Holiday" : "—")}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-500 max-w-[200px] truncate hidden md:table-cell">
                          {r.note ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Sidebar panels */}
        <div className="space-y-4">

          {/* Weekly Trend Chart */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Weekly Trend</h3>
            </div>
            <WeeklyTrendChart records={allRecords} />
          </div>

          {/* Tier-specific guidance */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Attendance Policy</h3>
            </div>
            <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed">
              {tierConfig.category === "HIGHER_ED" ? (
                <>
                  <p>• Minimum <span className="font-bold text-white">75%</span> attendance required for examination eligibility per course.</p>
                  <p>• Three or more unexplained absences trigger an <span className="font-bold text-amber-300">Academic Warning Letter</span>.</p>
                  <p>• Students below 60% may be barred from sitting semester examinations.</p>
                </>
              ) : tierConfig.category === "SECONDARY" ? (
                <>
                  <p>• A minimum of <span className="font-bold text-white">80%</span> attendance is required for promotion consideration.</p>
                  <p>• Absences beyond <span className="font-bold text-white">10 school days</span> per term require written parental explanation.</p>
                  <p>• Persistent lateness (3+ occurrences) results in a <span className="font-bold text-amber-300">detention notice</span>.</p>
                </>
              ) : (
                <>
                  <p>• Children are expected to attend <span className="font-bold text-white">all school days</span> unless medically unfit.</p>
                  <p>• Parents must notify the school office <span className="font-bold text-white">before 8:00 AM</span> on any absence day.</p>
                  <p>• Three or more unexplained absences prompt a <span className="font-bold text-amber-300">welfare check</span> by the class teacher.</p>
                </>
              )}
            </div>
          </div>

          {/* Achievement badges */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Attendance Awards</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: "Perfect Week", earned: summary.longestStreak >= 5, desc: "5 consecutive present days" },
                { label: "Star Attender", earned: summary.attendanceRate >= 90, desc: "90%+ attendance rate" },
                { label: "Term Champion", earned: summary.attendanceRate >= 98, desc: "98%+ attendance rate" },
                { label: "Zero Absence", earned: summary.daysAbsent === 0, desc: "No unexcused absences" },
              ].map(({ label, earned, desc }) => (
                <div key={label} className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition ${earned ? "border-amber-500/30 bg-amber-500/10" : "border-slate-700/40 bg-slate-800/30 opacity-50"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${earned ? "bg-amber-500/20 text-amber-400" : "bg-slate-700/40 text-slate-500"}`}>
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate ${earned ? "text-amber-300" : "text-slate-500"}`}>{label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{desc}</p>
                  </div>
                  {earned && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Attendance records are updated daily by class teachers. Contact the school registrar to dispute any discrepancy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
