"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  Search,
  Filter,
  Phone,
  User,
  ShieldCheck,
  AlertTriangle,
  Award,
  X,
} from "lucide-react";

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string | null;
  currentClass?: string | null;
  parentPhone?: string | null;
  gender?: string | null;
  status: string;
}

interface TeacherStudentsClientProps {
  initialStudents: StudentItem[];
  assignedClasses: string[];
  schoolName: string;
}

export function TeacherStudentsClient({
  initialStudents,
  assignedClasses,
  schoolName,
}: TeacherStudentsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

  // Behavioral notes mock tracker state
  const [behaviorNote, setBehaviorNote] = useState("");
  const [behaviorType, setBehaviorType] = useState<"COMMENDATION" | "INFRACTION" | "NEUTRAL">("COMMENDATION");
  const [behaviorLogs, setBehaviorLogs] = useState<
    Record<string, { note: string; type: string; date: string }[]>
  >({});

  const filteredStudents = initialStudents.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.admissionNumber || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass =
      selectedClass === "ALL" ||
      (s.currentClass || "").toLowerCase().includes(selectedClass.toLowerCase());

    return matchesSearch && matchesClass;
  });

  const handleAddBehaviorLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !behaviorNote) return;

    const newLog = {
      note: behaviorNote,
      type: behaviorType,
      date: new Date().toISOString().split("T")[0],
    };

    setBehaviorLogs((prev) => ({
      ...prev,
      [selectedStudent.id]: [newLog, ...(prev[selectedStudent.id] || [])],
    }));

    setBehaviorNote("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Classroom Directory</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Student Profiles & Guardian Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Search student records, view guardian contacts, and document behavioral logs.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-zinc-900">All Classes</option>
              {assignedClasses.map((cls) => (
                <option key={cls} value={cls} className="bg-white dark:bg-zinc-900">
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Directory Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
            Displaying {filteredStudents.length} Students
          </span>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            Click &apos;Log Behavior&apos; to view or document conduct
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/80 dark:border-zinc-700">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Guardian Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((st, idx) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {st.lastName}, {st.firstName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-zinc-400">
                      {st.admissionNumber || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-zinc-300">
                      {st.currentClass || "Unassigned"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                      {st.gender || "Not Set"}
                    </td>
                    <td className="py-3.5 px-4">
                      {st.parentPhone ? (
                        <a
                          href={`tel:${st.parentPhone}`}
                          className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{st.parentPhone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">No phone on file</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(st)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-zinc-800 dark:hover:bg-emerald-950/40 text-slate-700 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-300 font-bold text-xs transition cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Behavior Log</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No students match the active search or class filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Behavioral Tracking Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Behavior & Conduct Tracker
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {selectedStudent.lastName}, {selectedStudent.firstName} ({selectedStudent.currentClass})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Conduct Log Form */}
            <form onSubmit={handleAddBehaviorLog} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Log Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: "COMMENDATION", label: "Commendation", color: "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" },
                    { type: "NEUTRAL", label: "Observation", color: "border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40" },
                    { type: "INFRACTION", label: "Infraction", color: "border-rose-500 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40" },
                  ].map((btn) => (
                    <button
                      key={btn.type}
                      type="button"
                      onClick={() => setBehaviorType(btn.type as any)}
                      className={`p-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                        behaviorType === btn.type
                          ? btn.color
                          : "border-slate-200 dark:border-zinc-700 text-slate-500"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Observation Note
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Exhibited exemplary leadership during math group work."
                  value={behaviorNote}
                  onChange={(e) => setBehaviorNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Record Conduct Note
              </button>
            </form>

            {/* Past Logs for this student */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
              <h4 className="font-extrabold text-xs text-slate-700 dark:text-zinc-300">
                Recent Conduct Records
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {(behaviorLogs[selectedStudent.id] || []).length > 0 ? (
                  behaviorLogs[selectedStudent.id].map((log, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] uppercase text-emerald-600">
                          {log.type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {log.date}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-zinc-300">{log.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No behavior records logged yet for this student.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
