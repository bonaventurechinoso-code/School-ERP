"use client";

import React, { useState, useTransition } from "react";
import { markStudentAttendance, markStaffAttendance } from "./actions";
import { Users, Briefcase, Calendar, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

type AttendanceProps = {
  schoolId: string;
  students: any[];
  staff: any[];
  studentAttendanceRecords: any[];
  staffAttendanceRecords: any[];
};

export default function AttendanceView({ 
  schoolId, 
  students, 
  staff,
  studentAttendanceRecords,
  staffAttendanceRecords,
}: AttendanceProps) {
  const [isPending, startTransition] = useTransition();
  const [activeAudience, setActiveAudience] = useState<"STUDENTS" | "STAFF">("STUDENTS");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Lookups for selected date
  const studentAttendanceMap = new Map();
  studentAttendanceRecords.forEach(record => {
    if (new Date(record.date).toISOString().split('T')[0] === date) {
      studentAttendanceMap.set(record.studentId, record);
    }
  });

  const staffAttendanceMap = new Map();
  staffAttendanceRecords.forEach(record => {
    if (new Date(record.date).toISOString().split('T')[0] === date) {
      staffAttendanceMap.set(record.staffId, record);
    }
  });

  const handleUpdateStudentStatus = (studentId: string, newStatus: string) => {
    startTransition(() => {
      markStudentAttendance(schoolId, studentId, date, newStatus);
    });
  };

  const handleUpdateStaffStatus = (staffId: string, newStatus: string) => {
    startTransition(() => {
      markStaffAttendance(schoolId, staffId, date, newStatus);
    });
  };

  // Compute Daily Statistics for currently selected audience
  const currentList = activeAudience === "STUDENTS" ? students : staff;
  const currentMap = activeAudience === "STUDENTS" ? studentAttendanceMap : staffAttendanceMap;

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;

  currentList.forEach(item => {
    const status = currentMap.get(item.id)?.status || "PRESENT";
    if (status === "PRESENT") presentCount++;
    else if (status === "ABSENT") absentCount++;
    else if (status === "LATE") lateCount++;
    else if (status === "EXCUSED") excusedCount++;
  });

  return (
    <div className="space-y-6">
      {/* TOP CONTROLS & AUDIENCE TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        {/* Switcher */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveAudience("STUDENTS")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeAudience === "STUDENTS"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Students ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAudience("STAFF")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeAudience === "STAFF"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Staff & Faculty ({staff.length})</span>
          </button>
        </div>

        {/* Date Selector with Today Button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <input 
            type="date" 
            className="border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            Today
          </button>
        </div>
      </div>

      {/* DAILY STATS BADGES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Present</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{presentCount}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Absent</div>
            <div className="text-xl font-extrabold text-rose-900 mt-0.5">{absentCount}</div>
          </div>
          <XCircle className="w-5 h-5 text-rose-500" />
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Late</div>
            <div className="text-xl font-extrabold text-amber-900 mt-0.5">{lateCount}</div>
          </div>
          <Clock className="w-5 h-5 text-amber-500" />
        </div>

        <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Excused</div>
            <div className="text-xl font-extrabold text-sky-900 mt-0.5">{excusedCount}</div>
          </div>
          <AlertTriangle className="w-5 h-5 text-sky-500" />
        </div>
      </div>

      {/* ATTENDANCE ROSTER TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">
                  {activeAudience === "STUDENTS" ? "Student Name & Class" : "Staff Member & Role"}
                </th>
                <th className="px-6 py-4">Contact Email</th>
                <th className="px-6 py-4 text-center">Attendance Status ({new Date(date).toLocaleDateString()})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                    No active {activeAudience === "STUDENTS" ? "students" : "staff members"} found.
                  </td>
                </tr>
              ) : (
                currentList.map((item) => {
                  const record = currentMap.get(item.id);
                  const currentStatus = record?.status || "PRESENT";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {item.firstName} {item.lastName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {activeAudience === "STUDENTS" 
                            ? (item.currentClass || item.tier?.name || "Enrolled Student")
                            : `${item.role}${item.department ? ` • ${item.department.name}` : ""}`
                          }
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                        {item.email || item.parentEmail || "—"}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 gap-1">
                          <button
                            disabled={isPending}
                            onClick={() => {
                              if (activeAudience === "STUDENTS") {
                                handleUpdateStudentStatus(item.id, "PRESENT");
                              } else {
                                handleUpdateStaffStatus(item.id, "PRESENT");
                              }
                            }}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                              currentStatus === "PRESENT"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-200"
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
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                              currentStatus === "ABSENT"
                                ? "bg-rose-600 text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-200"
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
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                              currentStatus === "LATE"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-200"
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
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                              currentStatus === "EXCUSED"
                                ? "bg-sky-600 text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-200"
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
      </div>
    </div>
  );
}
