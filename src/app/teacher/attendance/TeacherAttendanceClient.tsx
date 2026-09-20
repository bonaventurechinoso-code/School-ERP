"use client";

import React, { useState, useTransition } from "react";
import {
  CheckCircle2,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  Save,
  Download,
  Filter,
  Users,
} from "lucide-react";
import { saveTeacherAttendance } from "../actions";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string | null;
  currentClass?: string | null;
}

interface TeacherAttendanceClientProps {
  initialDate: string;
  initialClass: string;
  assignedClasses: string[];
  students: Student[];
  initialAttendanceMap: Record<string, { status: string; notes: string }>;
  schoolName: string;
}

export function TeacherAttendanceClient({
  initialDate,
  initialClass,
  assignedClasses,
  students,
  initialAttendanceMap,
  schoolName,
}: TeacherAttendanceClientProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; notes: string }>>(
    initialAttendanceMap
  );
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Status counters
  const presentCount = students.filter(
    (s) => (attendanceMap[s.id]?.status || "PRESENT") === "PRESENT"
  ).length;
  const lateCount = students.filter(
    (s) => attendanceMap[s.id]?.status === "LATE"
  ).length;
  const absentCount = students.filter(
    (s) => attendanceMap[s.id]?.status === "ABSENT"
  ).length;
  const excusedCount = students.filter(
    (s) => attendanceMap[s.id]?.status === "EXCUSED"
  ).length;

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        status,
        notes: prev[studentId]?.notes || "",
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || "PRESENT",
        notes,
      },
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: string; notes: string }> = {};
    students.forEach((s) => {
      updated[s.id] = {
        status: "PRESENT",
        notes: attendanceMap[s.id]?.notes || "",
      };
    });
    setAttendanceMap(updated);
  };

  const handleSave = () => {
    setSaveMessage(null);
    startTransition(async () => {
      const records = students.map((s) => ({
        studentId: s.id,
        status: attendanceMap[s.id]?.status || "PRESENT",
        notes: attendanceMap[s.id]?.notes || undefined,
      }));

      try {
        const res = await saveTeacherAttendance(selectedDate, selectedClass, records);
        if (res.success) {
          setSaveMessage(`Successfully saved attendance for ${res.count} students.`);
          setTimeout(() => setSaveMessage(null), 4000);
        }
      } catch (err: any) {
        setSaveMessage(`Error saving attendance: ${err.message}`);
      }
    });
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;
    const headers = ["Student Name", "Admission Number", "Class", "Date", "Status", "Notes"];
    const rows = students.map((s) => {
      const name = `"${s.lastName}, ${s.firstName}"`;
      const adm = `"${s.admissionNumber || "N/A"}"`;
      const cls = `"${selectedClass}"`;
      const dt = `"${selectedDate}"`;
      const status = `"${attendanceMap[s.id]?.status || "PRESENT"}"`;
      const notes = `"${(attendanceMap[s.id]?.notes || "").replace(/"/g, '""')}"`;
      return [name, adm, cls, dt, status, notes].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_${selectedClass}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Roll-Call Workspace</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Daily Attendance Register
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Track student morning presence, late arrivals, and excused absences.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            >
              {assignedClasses.map((cls) => (
                <option key={cls} value={cls} className="bg-white dark:bg-zinc-900">
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Date Input */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            />
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Real-time Summary Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Present
            </p>
            <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-0.5">
              {presentCount}
            </p>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 opacity-80" />
        </div>

        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Late Arrival
            </p>
            <p className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-0.5">
              {lateCount}
            </p>
          </div>
          <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 opacity-80" />
        </div>

        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Absent
            </p>
            <p className="text-2xl font-black text-rose-900 dark:text-rose-200 mt-0.5">
              {absentCount}
            </p>
          </div>
          <UserX className="w-6 h-6 text-rose-600 dark:text-rose-400 opacity-80" />
        </div>

        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Excused
            </p>
            <p className="text-2xl font-black text-blue-900 dark:text-blue-200 mt-0.5">
              {excusedCount}
            </p>
          </div>
          <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 opacity-80" />
        </div>
      </div>

      {/* Save Notification Alert */}
      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Attendance Roll Call Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
              Roll-Call Roster: {selectedClass} ({students.length} Students)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-bold transition cursor-pointer border border-emerald-200/60 dark:border-emerald-800/60"
            >
              Mark All Present
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isPending ? "Saving..." : "Save Register"}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/80 dark:border-zinc-700">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Attendance Status</th>
                <th className="py-3 px-4">Remarks / Late Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {students.length > 0 ? (
                students.map((student, idx) => {
                  const currentStatus = attendanceMap[student.id]?.status || "PRESENT";
                  const currentNotes = attendanceMap[student.id]?.notes || "";

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {student.lastName}, {student.firstName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-zinc-400">
                        {student.admissionNumber || "N/A"}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700 gap-1">
                          {[
                            { code: "PRESENT", label: "Present", color: "bg-emerald-600 text-white shadow-xs" },
                            { code: "LATE", label: "Late", color: "bg-amber-500 text-white shadow-xs" },
                            { code: "ABSENT", label: "Absent", color: "bg-rose-600 text-white shadow-xs" },
                            { code: "EXCUSED", label: "Excused", color: "bg-blue-600 text-white shadow-xs" },
                          ].map((pill) => (
                            <button
                              key={pill.code}
                              type="button"
                              onClick={() => handleStatusChange(student.id, pill.code)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                currentStatus === pill.code
                                  ? pill.color
                                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          placeholder="Optional notes..."
                          value={currentNotes}
                          onChange={(e) => handleNotesChange(student.id, e.target.value)}
                          className="w-full max-w-xs px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-emerald-500"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No students registered in {selectedClass}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
