"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  Users,
  BookOpen,
  Calendar,
  CheckSquare,
  ClipboardList,
  Briefcase,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  Sparkles,
  Save,
  Layers,
  GraduationCap,
  Award,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  saveClassroomAttendance,
  saveClassroomGrades,
  AttendanceRecordPayload,
  GradeEntryPayload,
} from "./actions";

export interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string | null;
  registrationNumber?: string | null;
  currentClass?: string | null;
  class?: string | null;
  tierId: string;
  status: string;
  parentPhone?: string | null;
  guardianPhone?: string | null;
  gender?: string | null;
  dynamicFields?: any;
}

interface ClassroomItem {
  id: string;
  name: string;
  capacity: number;
  tierId: string | null;
}

interface CourseItem {
  id: string;
  name: string;
  code: string;
  tierId: string | null;
}

interface TierItem {
  id: string;
  name: string;
}

interface StaffPortalClientProps {
  schoolId: string;
  schoolName: string;
  schoolDomain: string;
  staffName?: string;
  staffRole?: string;
  initialTiers: TierItem[];
  initialClassrooms: ClassroomItem[];
  initialCourses: CourseItem[];
  initialStudents: StudentItem[];
  defaultTab?: "overview" | "rosters" | "attendance" | "gradebook";
}

export default function StaffPortalClient({
  schoolId,
  schoolName,
  schoolDomain,
  staffName = "Educator",
  staffRole = "Class Teacher",
  initialTiers,
  initialClassrooms,
  initialCourses,
  initialStudents,
  defaultTab = "overview",
}: StaffPortalClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "rosters" | "attendance" | "gradebook">(defaultTab);
  const [isPending, startTransition] = useTransition();

  // Tier & Class Filtering
  const [selectedTierId, setSelectedTierId] = useState<string>(initialTiers[0]?.id || "");
  const [selectedClass, setSelectedClass] = useState<string>(
    initialClassrooms[0]?.name || initialStudents[0]?.currentClass || initialStudents[0]?.class || "JSS 1"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; notes: string }>>({});
  const [attendanceSaveMessage, setAttendanceSaveMessage] = useState<string | null>(null);

  // Gradebook State
  const [selectedSubject, setSelectedSubject] = useState<string>(initialCourses[0]?.name || "General Mathematics");
  const [selectedTerm, setSelectedTerm] = useState<string>("1st Term");
  const [academicYear, setAcademicYear] = useState<string>("2026/2027");
  const [gradesMap, setGradesMap] = useState<Record<string, { ca1: number; ca2: number; exam: number; remarks: string }>>({});
  const [gradesSaveMessage, setGradesSaveMessage] = useState<string | null>(null);

  // Filtered Students for the selected class & search
  const classStudents = useMemo(() => {
    return initialStudents.filter((s) => {
      const studentClass = s.currentClass || s.class;
      const studentReg = s.admissionNumber || s.registrationNumber;
      const matchesClass = !selectedClass || studentClass?.toLowerCase() === selectedClass.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        studentReg?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [initialStudents, selectedClass, searchQuery]);

  // Attendance Handlers
  const handleSetAttendanceStatus = (studentId: string, status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED") => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        status,
        notes: prev[studentId]?.notes || "",
      },
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: string; notes: string }> = {};
    classStudents.forEach((s) => {
      updated[s.id] = {
        status: "PRESENT",
        notes: attendanceMap[s.id]?.notes || "",
      };
    });
    setAttendanceMap((prev) => ({ ...prev, ...updated }));
  };

  const handleSaveAttendance = () => {
    setAttendanceSaveMessage(null);
    startTransition(async () => {
      const records: AttendanceRecordPayload[] = classStudents.map((s) => ({
        studentId: s.id,
        status: attendanceMap[s.id]?.status || "PRESENT",
        notes: attendanceMap[s.id]?.notes || "",
      }));

      const res = await saveClassroomAttendance(schoolId, attendanceDate, records);
      if (res.success) {
        setAttendanceSaveMessage(`Successfully saved attendance for ${res.count} students.`);
        setTimeout(() => setAttendanceSaveMessage(null), 4000);
      } else {
        setAttendanceSaveMessage(`Error: ${res.error}`);
      }
    });
  };

  // Gradebook Handlers & Computed Matrix
  const handleScoreChange = (
    studentId: string,
    field: "ca1" | "ca2" | "exam" | "remarks",
    value: string | number
  ) => {
    setGradesMap((prev) => {
      const current = prev[studentId] || { ca1: 0, ca2: 0, exam: 0, remarks: "" };
      let parsedValue = value;

      if (field === "ca1" || field === "ca2") {
        parsedValue = Math.min(20, Math.max(0, Number(value) || 0));
      } else if (field === "exam") {
        parsedValue = Math.min(60, Math.max(0, Number(value) || 0));
      }

      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: parsedValue,
        },
      };
    });
  };

  // Compute WAEC Grade and Positions
  const gradedMatrix = useMemo(() => {
    function resolveGradeLetter(total: number) {
      if (total >= 75) return { letter: "A1", label: "Distinction", color: "text-emerald-500" };
      if (total >= 70) return { letter: "B2", label: "Very Good", color: "text-emerald-400" };
      if (total >= 65) return { letter: "B3", label: "Good", color: "text-teal-400" };
      if (total >= 60) return { letter: "C4", label: "Credit", color: "text-blue-400" };
      if (total >= 55) return { letter: "C5", label: "Credit", color: "text-blue-400" };
      if (total >= 50) return { letter: "C6", label: "Credit", color: "text-indigo-400" };
      if (total >= 45) return { letter: "D7", label: "Pass", color: "text-amber-400" };
      if (total >= 40) return { letter: "E8", label: "Pass", color: "text-amber-500" };
      return { letter: "F9", label: "Fail", color: "text-rose-500" };
    }

    const calculated = classStudents.map((student) => {
      const entry = gradesMap[student.id] || { ca1: 0, ca2: 0, exam: 0, remarks: "" };
      const total = Number(entry.ca1) + Number(entry.ca2) + Number(entry.exam);
      const grade = resolveGradeLetter(total);
      return {
        student,
        ca1: entry.ca1,
        ca2: entry.ca2,
        exam: entry.exam,
        total,
        grade,
        remarks: entry.remarks,
      };
    });

    // Sort by total score descending to determine position
    const sorted = [...calculated].sort((a, b) => b.total - a.total);
    const ranks = new Map<string, string>();
    sorted.forEach((item, index) => {
      const rank = index + 1;
      const suffix =
        rank % 10 === 1 && rank !== 11
          ? "st"
          : rank % 10 === 2 && rank !== 12
          ? "nd"
          : rank % 10 === 3 && rank !== 13
          ? "rd"
          : "th";
      ranks.set(item.student.id, `${rank}${suffix}`);
    });

    return calculated.map((item) => ({
      ...item,
      position: ranks.get(item.student.id) || "-",
    }));
  }, [classStudents, gradesMap]);

  const handleSaveGrades = () => {
    setGradesSaveMessage(null);
    startTransition(async () => {
      const records: GradeEntryPayload[] = classStudents.map((s) => {
        const entry = gradesMap[s.id] || { ca1: 0, ca2: 0, exam: 0, remarks: "" };
        const total = Number(entry.ca1) + Number(entry.ca2) + Number(entry.exam);
        return {
          studentId: s.id,
          ca1: entry.ca1,
          ca2: entry.ca2,
          exam: entry.exam,
          totalScore: total,
          teacherRemarks: entry.remarks || undefined,
        };
      });

      const res = await saveClassroomGrades(
        schoolId,
        selectedClass,
        selectedSubject,
        selectedTerm,
        academicYear,
        records
      );

      if (res.success) {
        setGradesSaveMessage(`Successfully submitted assessment grades for ${res.count} students.`);
        setTimeout(() => setGradesSaveMessage(null), 4000);
      } else {
        setGradesSaveMessage(`Error: ${res.error}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2 overflow-x-auto">
        {[
          { id: "overview", label: "Dashboard Overview", icon: Briefcase },
          { id: "rosters", label: "Classroom Rosters", icon: Users },
          { id: "attendance", label: "Daily Attendance", icon: CheckSquare },
          { id: "gradebook", label: "Gradebook & Assessments", icon: Award },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & DASHBOARD METRICS                                       */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-bold mb-3 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{staffRole} • Active Faculty</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-2">
                  Welcome, {staffName}
                </h2>
                <p className="text-sm text-emerald-200 max-w-xl">
                  Manage your assigned classrooms for <strong>{schoolName}</strong>. Conduct morning roll calls, enter continuous assessment scores, and review student rosters.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shrink-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-emerald-200 uppercase font-bold tracking-wider">Department</p>
                  <p className="text-sm font-black text-white">Academics & Instruction</p>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Assigned Classes</span>
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {initialClassrooms.length || 4}
              </p>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                Active This Term
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Students</span>
                <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {initialStudents.length}
              </p>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-1 block">
                Enrolled Cohorts
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Subjects</span>
                <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {initialCourses.length || 8}
              </p>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1 block">
                Curriculum Courses
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Grading Cycle</span>
                <ClipboardList className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">1st Term</p>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1 block">
                Continuous Assessments
              </span>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveTab("rosters")}
              className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 dark:hover:border-emerald-600 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                Classroom Rosters
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Inspect enrolled pupils, registration numbers, guardian contacts, and status.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                <span>View Class Directory</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>

            <div
              onClick={() => setActiveTab("attendance")}
              className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-teal-500 dark:hover:border-teal-600 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <CheckSquare className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                Daily Attendance Register
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Take morning roll call with one-click bulk present toggles and attendance notes.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 group-hover:translate-x-1 transition-transform">
                <span>Take Attendance Now</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>

            <div
              onClick={() => setActiveTab("gradebook")}
              className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500 dark:hover:border-indigo-600 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                Gradebook & Term Entries
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Input CA1 (20), CA2 (20), and Exam (60) scores with automated WAEC grade calculations.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>Enter Assessment Grades</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CLASSROOM ROSTERS & PUPIL DIRECTORY                                */}
      {/* ========================================================================= */}
      {activeTab === "rosters" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Classroom Roster & Pupil Directory</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Displaying enrolled students assigned to your classroom streams.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {initialClassrooms.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search pupil name / Reg No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56"
                />
              </div>
            </div>
          </div>

          {/* Pupil Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3.5">Student Name</th>
                    <th className="px-4 py-3.5">Reg Number</th>
                    <th className="px-4 py-3.5">Class Stream</th>
                    <th className="px-4 py-3.5">Gender</th>
                    <th className="px-4 py-3.5">Guardian Contact</th>
                    <th className="px-4 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        No students found matching the selected class stream or filter.
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                              {s.firstName[0]}
                              {s.lastName[0]}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                {s.lastName}, {s.firstName}
                              </p>
                              <span className="text-[10px] text-slate-400">Enrolled Student</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          {s.admissionNumber || s.registrationNumber || "PENDING"}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-zinc-200">
                          {s.currentClass || s.class || selectedClass}
                        </td>
                        <td className="px-4 py-3.5 capitalize text-slate-600 dark:text-zinc-400">
                          {s.gender || (s.dynamicFields as any)?.gender || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-zinc-400 font-mono">
                          {s.parentPhone || s.guardianPhone || "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-semibold">
              <span>Total Pupils in {selectedClass}: {classStudents.length}</span>
              <span>{schoolName}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DAILY ATTENDANCE REGISTER                                          */}
      {/* ========================================================================= */}
      {activeTab === "attendance" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-teal-600" />
                <span>Daily Attendance Register & Roll Call</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Record morning and lesson roll call status. Syncs directly to the student portal.
              </p>
            </div>

            {/* Control Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {initialClassrooms.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold text-xs hover:bg-teal-100 transition cursor-pointer"
              >
                Mark All Present
              </button>

              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isPending || classStudents.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 disabled:opacity-60 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isPending ? "Saving Register..." : "Save Register"}</span>
              </button>
            </div>
          </div>

          {attendanceSaveMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{attendanceSaveMessage}</span>
            </div>
          )}

          {/* Attendance Roster Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3.5">Student</th>
                    <th className="px-4 py-3.5">Reg Number</th>
                    <th className="px-4 py-3.5 text-center">Status Toggle</th>
                    <th className="px-5 py-3.5">Teacher Observation / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                        No students enrolled in {selectedClass}.
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((s) => {
                      const currentStatus = attendanceMap[s.id]?.status || "PRESENT";
                      const currentNotes = attendanceMap[s.id]?.notes || "";

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                            {s.lastName}, {s.firstName}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500 dark:text-zinc-400">
                            {s.admissionNumber || s.registrationNumber || "—"}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                              {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const).map((statusOption) => {
                                const isSelected = currentStatus === statusOption;
                                const colorClass =
                                  statusOption === "PRESENT"
                                    ? isSelected
                                      ? "bg-emerald-600 text-white font-bold"
                                      : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950"
                                    : statusOption === "LATE"
                                    ? isSelected
                                      ? "bg-amber-500 text-white font-bold"
                                      : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950"
                                    : statusOption === "ABSENT"
                                    ? isSelected
                                      ? "bg-rose-600 text-white font-bold"
                                      : "text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950"
                                    : isSelected
                                    ? "bg-blue-600 text-white font-bold"
                                    : "text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950";

                                return (
                                  <button
                                    key={statusOption}
                                    type="button"
                                    onClick={() => handleSetAttendanceStatus(s.id, statusOption)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer ${colorClass}`}
                                  >
                                    {statusOption}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <input
                              type="text"
                              placeholder="e.g. Excused with note, Sick, Arrived 8:30"
                              value={currentNotes}
                              onChange={(e) =>
                                setAttendanceMap((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    status: currentStatus,
                                    notes: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
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
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GRADEBOOK & CONTINUOUS ASSESSMENTS MATRIX                           */}
      {/* ========================================================================= */}
      {activeTab === "gradebook" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-2 border border-indigo-200/60 dark:border-indigo-800/60">
                <Award className="w-3.5 h-3.5" />
                <span>Authentic 20/20/60 Continuous Assessment Matrix</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Gradebook & Term Assessment Scores
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Enter continuous assessment marks. Automatically computes totals, WAEC/NECO grades, and class rank positions.
              </p>
            </div>

            {/* Assessment Selectors Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {initialClassrooms.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {initialCourses.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>

              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="1st Term">1st Term</option>
                <option value="2nd Term">2nd Term</option>
                <option value="3rd Term">3rd Term</option>
              </select>

              <button
                type="button"
                onClick={handleSaveGrades}
                disabled={isPending || classStudents.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-60 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isPending ? "Submitting Scores..." : "Submit Grades"}</span>
              </button>
            </div>
          </div>

          {gradesSaveMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{gradesSaveMessage}</span>
            </div>
          )}

          {/* Gradebook Matrix Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3.5">Reg Number & Name</th>
                    <th className="px-3 py-3.5 text-center w-24">1st CA (20)</th>
                    <th className="px-3 py-3.5 text-center w-24">2nd CA (20)</th>
                    <th className="px-3 py-3.5 text-center w-24">Exam (60)</th>
                    <th className="px-3 py-3.5 text-center w-24 bg-slate-100/60 dark:bg-zinc-800/80">
                      Total (100)
                    </th>
                    <th className="px-3 py-3.5 text-center w-20">WAEC Grade</th>
                    <th className="px-3 py-3.5 text-center w-20">Position</th>
                    <th className="px-4 py-3.5">Teacher Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {gradedMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        No students found for this class stream.
                      </td>
                    </tr>
                  ) : (
                    gradedMatrix.map((item) => (
                      <tr
                        key={item.student.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {item.student.lastName}, {item.student.firstName}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400">
                            {item.student.admissionNumber || item.student.registrationNumber || "NO REG"}
                          </span>
                        </td>

                        {/* CA 1 */}
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={item.ca1 || ""}
                            onChange={(e) => handleScoreChange(item.student.id, "ca1", e.target.value)}
                            className="w-16 mx-auto px-2 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* CA 2 */}
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={item.ca2 || ""}
                            onChange={(e) => handleScoreChange(item.student.id, "ca2", e.target.value)}
                            className="w-16 mx-auto px-2 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Exam */}
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={item.exam || ""}
                            onChange={(e) => handleScoreChange(item.student.id, "exam", e.target.value)}
                            className="w-16 mx-auto px-2 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Total Score */}
                        <td className="px-3 py-3.5 text-center bg-slate-50/80 dark:bg-zinc-800/40">
                          <span
                            className={`font-mono text-sm font-black ${
                              item.total >= 50
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {item.total}
                          </span>
                        </td>

                        {/* Grade Letter */}
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 ${item.grade.color}`}
                          >
                            {item.grade.letter}
                          </span>
                        </td>

                        {/* Position */}
                        <td className="px-3 py-3.5 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                          {item.position}
                        </td>

                        {/* Remark */}
                        <td className="px-4 py-3.5">
                          <input
                            type="text"
                            placeholder="e.g. Excellent work, Commendable effort"
                            value={item.remarks}
                            onChange={(e) =>
                              handleScoreChange(item.student.id, "remarks", e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400 font-semibold">
              <span>Class Stream: {selectedClass} • Subject: {selectedSubject}</span>
              <span>Grading Engine: Nigerian 20/20/60 Standard</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
