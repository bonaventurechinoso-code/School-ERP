"use client";

import React, { useState, useTransition, useMemo } from "react";
import { markStudentAttendance, markStaffAttendance, markAllClassPresentAction } from "./actions";
import { 
  Users, 
  Briefcase, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Search, 
  CheckCheck, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Filter
} from "lucide-react";
import { formatStaffRoleByTier, StaffTierCategory } from "@/lib/staff-roles-config";

type AttendanceProps = {
  schoolId: string;
  schoolDomain?: string;
  activeTier?: string;
  tierCategory?: StaffTierCategory;
  students: any[];
  staff: any[];
  classes?: string[];
  studentAttendanceRecords: any[];
  staffAttendanceRecords: any[];
};

export default function AttendanceView({ 
  schoolId, 
  schoolDomain,
  activeTier,
  tierCategory = "PRIMARY",
  students, 
  staff,
  classes = [],
  studentAttendanceRecords,
  staffAttendanceRecords,
}: AttendanceProps) {
  const [isPending, startTransition] = useTransition();
  const [activeAudience, setActiveAudience] = useState<"STUDENTS" | "STAFF">("STUDENTS");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Quick Date Shifters
  const handleShiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  // Lookups for selected date
  const studentAttendanceMap = useMemo(() => {
    const map = new Map();
    studentAttendanceRecords.forEach((record) => {
      const recordDateStr = new Date(record.date).toISOString().split('T')[0];
      if (recordDateStr === date) {
        map.set(record.studentId, record);
      }
    });
    return map;
  }, [studentAttendanceRecords, date]);

  const staffAttendanceMap = useMemo(() => {
    const map = new Map();
    staffAttendanceRecords.forEach((record) => {
      const recordDateStr = new Date(record.date).toISOString().split('T')[0];
      if (recordDateStr === date) {
        map.set(record.staffId, record);
      }
    });
    return map;
  }, [staffAttendanceRecords, date]);

  const handleUpdateStudentStatus = (studentId: string, newStatus: string) => {
    startTransition(async () => {
      await markStudentAttendance(schoolId, studentId, date, newStatus, undefined, schoolDomain, activeTier);
    });
  };

  const handleUpdateStaffStatus = (staffId: string, newStatus: string) => {
    startTransition(async () => {
      await markStaffAttendance(schoolId, staffId, date, newStatus, undefined, schoolDomain, activeTier);
    });
  };

  const handleMarkAllPresent = () => {
    if (confirm(`Mark all active students ${selectedClass !== "ALL" ? `in ${selectedClass}` : ""} as Present for ${date}?`)) {
      startTransition(async () => {
        const res = await markAllClassPresentAction(schoolId, selectedClass, date, schoolDomain, activeTier);
        if (res?.success) {
          setActionNotice(`Successfully marked ${res.count} student(s) as Present!`);
          setTimeout(() => setActionNotice(null), 4000);
        }
      });
    }
  };

  // Filtered Student Roster
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedClass !== "ALL" && s.currentClass !== selectedClass) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        const adm = (s.admissionNumber || "").toLowerCase();
        if (!fullName.includes(q) && !adm.includes(q)) return false;
      }
      return true;
    });
  }, [students, selectedClass, searchQuery]);

  // Filtered Staff Roster
  const filteredStaff = useMemo(() => {
    return staff.filter((st) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${st.firstName} ${st.lastName}`.toLowerCase();
        const email = (st.email || "").toLowerCase();
        const role = (st.role || "").toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !role.includes(q)) return false;
      }
      return true;
    });
  }, [staff, searchQuery]);

  const currentList = activeAudience === "STUDENTS" ? filteredStudents : filteredStaff;
  const currentMap = activeAudience === "STUDENTS" ? studentAttendanceMap : staffAttendanceMap;

  // Compute Daily Statistics for currently selected audience
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;

  currentList.forEach((item) => {
    const status = currentMap.get(item.id)?.status || "PRESENT";
    if (status === "PRESENT") presentCount++;
    else if (status === "ABSENT") absentCount++;
    else if (status === "LATE") lateCount++;
    else if (status === "EXCUSED") excusedCount++;
  });

  const totalEvaluated = currentList.length;
  const attendanceRate = totalEvaluated > 0 ? Math.round((presentCount / totalEvaluated) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* ACTION NOTICE BANNER */}
      {actionNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* TOP CONTROLS & AUDIENCE TOGGLE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800">
        {/* Audience Switcher */}
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-zinc-800 p-1 border border-slate-200 dark:border-zinc-700 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveAudience("STUDENTS");
              setSearchQuery("");
            }}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeAudience === "STUDENTS"
                ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Students ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveAudience("STAFF");
              setSearchQuery("");
            }}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeAudience === "STAFF"
                ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>School Staff ({staff.length})</span>
          </button>
        </div>

        {/* Date Selector with Previous/Next Day & Today Button */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="inline-flex items-center rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1">
            <button
              type="button"
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input 
              type="date" 
              className="border-0 bg-transparent px-2 text-xs sm:text-sm outline-none font-bold text-slate-800 dark:text-zinc-200"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              type="button"
              onClick={() => handleShiftDate(1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition"
          >
            Today
          </button>

          {/* Quick Mark All Present Button (For Students) */}
          {activeAudience === "STUDENTS" && (
            <button
              type="button"
              disabled={isPending || currentList.length === 0}
              onClick={handleMarkAllPresent}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Present</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS (CLASS & SEARCH) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          {activeAudience === "STUDENTS" && classes.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Class:</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="ALL">All Classes ({students.length})</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          )}

          {activeAudience === "STUDENTS" && classes.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-xl py-0.5">
              <button
                type="button"
                onClick={() => setSelectedClass("ALL")}
                className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition whitespace-nowrap ${
                  selectedClass === "ALL"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {classes.slice(0, 6).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedClass(cls)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition whitespace-nowrap ${
                    selectedClass === cls
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search Field */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeAudience === "STUDENTS" ? "by name or Reg No..." : "staff by name..."}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* DAILY STATS BADGES & ATTENDANCE RATE */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Present</div>
            <div className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-0.5">{presentCount}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Absent</div>
            <div className="text-xl font-extrabold text-rose-900 dark:text-rose-200 mt-0.5">{absentCount}</div>
          </div>
          <XCircle className="w-5 h-5 text-rose-500" />
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Late</div>
            <div className="text-xl font-extrabold text-amber-900 dark:text-amber-200 mt-0.5">{lateCount}</div>
          </div>
          <Clock className="w-5 h-5 text-amber-500" />
        </div>

        <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">Excused</div>
            <div className="text-xl font-extrabold text-sky-900 dark:text-sky-200 mt-0.5">{excusedCount}</div>
          </div>
          <AlertTriangle className="w-5 h-5 text-sky-500" />
        </div>

        {/* Dynamic Attendance Percentage Meter */}
        <div className="col-span-2 sm:col-span-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3.5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Turnout</span>
            <span className="text-sm font-black text-indigo-900 dark:text-indigo-200">{attendanceRate}%</span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-900/60 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ATTENDANCE ROSTER (RESPONSIVE TABLE & CARDS) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">
                  {activeAudience === "STUDENTS" ? "Student Name & Class" : "Staff Member & Localized Role"}
                </th>
                <th className="px-6 py-4">Identification</th>
                <th className="px-6 py-4 text-center">Attendance Status ({new Date(date).toLocaleDateString()})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {currentList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400 dark:text-zinc-500">
                    No active {activeAudience === "STUDENTS" ? "students" : "staff members"} found matching filters.
                  </td>
                </tr>
              ) : (
                currentList.map((item) => {
                  const record = currentMap.get(item.id);
                  const currentStatus = record?.status || "PRESENT";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.firstName} {item.lastName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          {activeAudience === "STUDENTS" 
                            ? (item.currentClass || item.tier?.name || "Enrolled Student")
                            : formatStaffRoleByTier(item.role, tierCategory) + (item.department ? ` • ${item.department.name}` : "")
                          }
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 text-xs font-mono">
                        {activeAudience === "STUDENTS"
                          ? (item.admissionNumber || item.email || "—")
                          : (item.email || "—")
                        }
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 p-1 gap-1">
                          <button
                            disabled={isPending}
                            onClick={() => {
                              if (activeAudience === "STUDENTS") {
                                handleUpdateStudentStatus(item.id, "PRESENT");
                              } else {
                                handleUpdateStaffStatus(item.id, "PRESENT");
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              currentStatus === "PRESENT"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            Present
                          </button>

                          <button
                            disabled={isPending}
                            onClick={() => {
                              if (activeAudience === "STUDENTS") {
                                handleUpdateStudentStatus(item.id, "ABSENT");
                              } else {
                                handleUpdateStaffStatus(item.id, "ABSENT");
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              currentStatus === "ABSENT"
                                ? "bg-rose-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            Absent
                          </button>

                          <button
                            disabled={isPending}
                            onClick={() => {
                              if (activeAudience === "STUDENTS") {
                                handleUpdateStudentStatus(item.id, "LATE");
                              } else {
                                handleUpdateStaffStatus(item.id, "LATE");
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              currentStatus === "LATE"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            Late
                          </button>

                          <button
                            disabled={isPending}
                            onClick={() => {
                              if (activeAudience === "STUDENTS") {
                                handleUpdateStudentStatus(item.id, "EXCUSED");
                              } else {
                                handleUpdateStaffStatus(item.id, "EXCUSED");
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              currentStatus === "EXCUSED"
                                ? "bg-sky-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            Excused
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
          {currentList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
              No matching records found.
            </div>
          ) : (
            currentList.map((item) => {
              const record = currentMap.get(item.id);
              const currentStatus = record?.status || "PRESENT";

              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {item.firstName} {item.lastName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {activeAudience === "STUDENTS" 
                          ? (item.currentClass || "Enrolled Student")
                          : formatStaffRoleByTier(item.role, tierCategory)
                        }
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {activeAudience === "STUDENTS" ? item.admissionNumber : item.email}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button
                      disabled={isPending}
                      onClick={() => activeAudience === "STUDENTS" ? handleUpdateStudentStatus(item.id, "PRESENT") : handleUpdateStaffStatus(item.id, "PRESENT")}
                      className={`py-1.5 rounded-lg text-[11px] font-bold text-center transition ${
                        currentStatus === "PRESENT" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Present
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => activeAudience === "STUDENTS" ? handleUpdateStudentStatus(item.id, "ABSENT") : handleUpdateStaffStatus(item.id, "ABSENT")}
                      className={`py-1.5 rounded-lg text-[11px] font-bold text-center transition ${
                        currentStatus === "ABSENT" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Absent
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => activeAudience === "STUDENTS" ? handleUpdateStudentStatus(item.id, "LATE") : handleUpdateStaffStatus(item.id, "LATE")}
                      className={`py-1.5 rounded-lg text-[11px] font-bold text-center transition ${
                        currentStatus === "LATE" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Late
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => activeAudience === "STUDENTS" ? handleUpdateStudentStatus(item.id, "EXCUSED") : handleUpdateStaffStatus(item.id, "EXCUSED")}
                      className={`py-1.5 rounded-lg text-[11px] font-bold text-center transition ${
                        currentStatus === "EXCUSED" ? "bg-sky-600 text-white shadow-xs" : "text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      Excused
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
