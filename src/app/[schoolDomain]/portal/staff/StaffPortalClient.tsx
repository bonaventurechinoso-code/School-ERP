"use client";

import React, { useState, useMemo, useEffect, useTransition } from "react";
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
  Receipt,
  Printer,
  X,
  CreditCard,
  Building2,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import {
  saveClassroomAttendance,
  saveClassroomGrades,
  fetchClassroomAttendance,
  fetchClassroomGrades,
  AttendanceRecordPayload,
  GradeEntryPayload,
  StaffProfileData,
  PayrollRecordItem,
  TimetablePeriodItem,
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
  staffProfile?: StaffProfileData | null;
  initialPayroll?: PayrollRecordItem[];
  initialTimetable?: TimetablePeriodItem[];
  initialTiers: TierItem[];
  initialClassrooms: ClassroomItem[];
  initialCourses: CourseItem[];
  initialStudents: StudentItem[];
  defaultTab?: "overview" | "rosters" | "attendance" | "gradebook" | "schedule" | "payslips";
}

function formatNaira(amount: number): string {
  return `₦${(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StaffPortalClient({
  schoolId,
  schoolName,
  schoolDomain,
  staffName = "Educator",
  staffRole = "Class Teacher",
  staffProfile,
  initialPayroll = [],
  initialTimetable = [],
  initialTiers,
  initialClassrooms,
  initialCourses,
  initialStudents,
  defaultTab = "overview",
}: StaffPortalClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "rosters" | "attendance" | "gradebook" | "schedule" | "payslips">(defaultTab);
  const [isPending, startTransition] = useTransition();

  // Tier & Class Filtering
  const [selectedTierId, setSelectedTierId] = useState<string>(initialTiers[0]?.id || "");
  const [selectedClass, setSelectedClass] = useState<string>(
    initialClassrooms[0]?.name || initialStudents[0]?.currentClass || initialStudents[0]?.class || "JSS 1"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Attendance State & Loading
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; notes: string }>>({});
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [attendanceSaveMessage, setAttendanceSaveMessage] = useState<string | null>(null);

  // Gradebook State & Loading
  const [selectedSubject, setSelectedSubject] = useState<string>(initialCourses[0]?.name || "General Mathematics");
  const [selectedTerm, setSelectedTerm] = useState<string>("1st Term");
  const [academicYear, setAcademicYear] = useState<string>("2026/2027");
  const [gradesMap, setGradesMap] = useState<Record<string, { ca1: number; ca2: number; exam: number; remarks: string }>>({});
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);
  const [gradesSaveMessage, setGradesSaveMessage] = useState<string | null>(null);

  // Payslip Modal State
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecordItem | null>(null);

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

  // Two-Way Sync: Load Attendance when date changes
  useEffect(() => {
    let isMounted = true;
    setIsLoadingAttendance(true);
    fetchClassroomAttendance(schoolId, attendanceDate)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.records) {
          const map: Record<string, { status: string; notes: string }> = {};
          res.records.forEach((r) => {
            map[r.studentId] = {
              status: r.status,
              notes: r.notes || "",
            };
          });
          setAttendanceMap(map);
        }
      })
      .catch((err) => console.error("Failed to load attendance records:", err))
      .finally(() => {
        if (isMounted) setIsLoadingAttendance(false);
      });

    return () => {
      isMounted = false;
    };
  }, [schoolId, attendanceDate]);

  // Two-Way Sync: Load Grades when Class, Subject, or Term changes
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    let isMounted = true;
    setIsLoadingGrades(true);
    fetchClassroomGrades(schoolId, selectedClass, selectedSubject, selectedTerm)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.grades) {
          const map: Record<string, { ca1: number; ca2: number; exam: number; remarks: string }> = {};
          res.grades.forEach((g) => {
            map[g.studentId] = {
              ca1: g.ca1,
              ca2: g.ca2,
              exam: g.exam,
              remarks: "",
            };
          });
          setGradesMap(map);
        }
      })
      .catch((err) => console.error("Failed to load grade records:", err))
      .finally(() => {
        if (isMounted) setIsLoadingGrades(false);
      });

    return () => {
      isMounted = false;
    };
  }, [schoolId, selectedClass, selectedSubject, selectedTerm]);

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
        const totalScore = Number(entry.ca1) + Number(entry.ca2) + Number(entry.exam);
        return {
          studentId: s.id,
          ca1: Number(entry.ca1) || 0,
          ca2: Number(entry.ca2) || 0,
          exam: Number(entry.exam) || 0,
          totalScore,
          teacherRemarks: entry.remarks,
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
        setGradesSaveMessage(`Successfully persisted grades for ${res.count} students.`);
        setTimeout(() => setGradesSaveMessage(null), 4000);
      } else {
        setGradesSaveMessage(`Error: ${res.error}`);
      }
    });
  };

  // Group timetable by day of the week
  const scheduleByDay = useMemo(() => {
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    const grouped: Record<string, TimetablePeriodItem[]> = {};
    days.forEach((d) => (grouped[d] = []));

    initialTimetable.forEach((item) => {
      const day = item.dayOfWeek.toUpperCase();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(item);
    });

    return grouped;
  }, [initialTimetable]);

  return (
    <div className="space-y-6">
      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2 overflow-x-auto hide-scrollbar">
        {[
          { id: "overview", label: "Dashboard Overview", icon: Briefcase },
          { id: "rosters", label: "Classroom Rosters", icon: Users },
          { id: "attendance", label: "Daily Attendance", icon: CheckSquare },
          { id: "gradebook", label: "Gradebook & Assessments", icon: Award },
          { id: "schedule", label: "Teaching Schedule", icon: Calendar },
          { id: "payslips", label: "My Remuneration & Payslips", icon: Receipt },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0 ${
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
                  Manage your assigned classrooms for <strong>{schoolName}</strong>. Conduct morning roll calls, enter continuous assessment scores, view teaching schedules, and review remuneration payslips.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shrink-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-emerald-200 uppercase font-bold tracking-wider">Department</p>
                  <p className="text-sm font-black text-white">{staffProfile?.department || "Academics & Instruction"}</p>
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
                Active Cohorts
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
                Enrolled Learners
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Weekly Periods</span>
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {initialTimetable.length || 0}
              </p>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1 block">
                Scheduled Teaching Hours
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Base Salary</span>
                <Receipt className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono truncate">
                {formatNaira(staffProfile?.baseSalary || 220000)}
              </p>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                Monthly Remuneration
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
                Take morning roll call with one-click bulk present toggles and real-time database sync.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 group-hover:translate-x-1 transition-transform">
                <span>Open Attendance Sheet</span>
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
                20/20/60 Gradebook
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Enter continuous assessments and exam scores with instant WAEC grading letter calculations.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>Open Grade Matrix</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CLASSROOM ROSTERS                                                  */}
      {/* ========================================================================= */}
      {activeTab === "rosters" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Class Stream Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Class:</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {initialClassrooms.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name or registration #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Rosters Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {selectedClass} Student Directory
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                {classStudents.length} Students Enrolled
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-6 py-3.5">Admission / Reg #</th>
                    <th className="px-6 py-3.5">Class / Stream</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Guardian Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        No students found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-zinc-400">
                          {s.admissionNumber || s.registrationNumber || "N/A"}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600 dark:text-zinc-300">
                          {s.currentClass || s.class || selectedClass}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-zinc-400">
                          {s.parentPhone || s.guardianPhone || "Not Provided"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DAILY ATTENDANCE REGISTER                                          */}
      {/* ========================================================================= */}
      {activeTab === "attendance" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                  Attendance Date:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                  {isLoadingAttendance && (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                  Cohort:
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  {initialClassrooms.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition cursor-pointer"
              >
                Mark All Present
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveAttendance}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isPending ? "Saving..." : "Save Register"}</span>
              </button>
            </div>
          </div>

          {attendanceSaveMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{attendanceSaveMessage}</span>
            </div>
          )}

          {/* Attendance Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5">Notes / Reasons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                        No students in this class register.
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((s) => {
                      const currentStatus = attendanceMap[s.id]?.status || "PRESENT";
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {s.firstName} {s.lastName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {s.admissionNumber || s.registrationNumber || "No Reg"}
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const).map((st) => {
                                const isSelected = currentStatus === st;
                                let colorClass = "text-slate-500 bg-slate-100 dark:bg-zinc-800";
                                if (isSelected) {
                                  if (st === "PRESENT") colorClass = "bg-emerald-600 text-white font-black";
                                  if (st === "LATE") colorClass = "bg-amber-500 text-white font-black";
                                  if (st === "ABSENT") colorClass = "bg-rose-600 text-white font-black";
                                  if (st === "EXCUSED") colorClass = "bg-blue-600 text-white font-black";
                                }
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleSetAttendanceStatus(s.id, st)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] transition font-bold cursor-pointer ${colorClass}`}
                                  >
                                    {st}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <input
                              type="text"
                              placeholder="Add optional note..."
                              value={attendanceMap[s.id]?.notes || ""}
                              onChange={(e) =>
                                setAttendanceMap((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    status: currentStatus,
                                    notes: e.target.value,
                                  },
                                }))
                              }
                              className="w-full max-w-xs px-2.5 py-1 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200"
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
      {/* TAB 4: 20/20/60 GRADEBOOK & ASSESSMENTS                                   */}
      {/* ========================================================================= */}
      {activeTab === "gradebook" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Gradebook Config Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                  Class:
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  {initialClassrooms.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                  Subject:
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  {initialCourses.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                  Term:
                </label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="1st Term">1st Term</option>
                  <option value="2nd Term">2nd Term</option>
                  <option value="3rd Term">3rd Term</option>
                </select>
              </div>

              {isLoadingGrades && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold pt-4">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading marks...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveGrades}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isPending ? "Persisting Marks..." : "Save Grades (Dual Sync)"}</span>
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
                    <th className="px-5 py-3.5">Student Name & Reg #</th>
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
              <span>Grading Engine: NERDC 20/20/60 Standard Continuous Assessment</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: TEACHING SCHEDULE & TIMETABLE                                      */}
      {/* ========================================================================= */}
      {activeTab === "schedule" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Weekly Teaching Timetable</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Assigned lecture periods, course codes, and classroom halls for {staffName}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((day) => {
              const periods = scheduleByDay[day] || [];
              return (
                <div
                  key={day}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                    <h4 className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-white uppercase">
                      {day}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                      {periods.length} Periods
                    </span>
                  </div>

                  {periods.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic">
                      No periods scheduled.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {periods.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {p.course.name}
                            </span>
                            <span className="font-mono font-bold text-[10px] text-emerald-600 dark:text-emerald-400">
                              {p.startTime} - {p.endTime}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                            <span>Room: <strong>{p.classroom.name}</strong></span>
                            <span className="font-mono text-[10px]">{p.course.code}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: REMUNERATION & PAYSLIPS                                            */}
      {/* ========================================================================= */}
      {activeTab === "payslips" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Remuneration & Monthly Payslips</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Review institutional salary disbursements, bank details, and print official electronic vouchers.
            </p>
          </div>

          {/* Salary & Bank Profile Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs border-l-4 border-l-emerald-500">
              <span className="text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">
                Base Monthly Salary
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatNaira(staffProfile?.baseSalary || 220000)}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Direct bank disbursement rate
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs border-l-4 border-l-blue-500">
              <span className="text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">
                Destination Bank
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white truncate">
                {staffProfile?.bankName || "First Bank of Nigeria"}
              </p>
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 mt-0.5 block">
                Acct: {staffProfile?.bankAccountNumber || "0123456789"}
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs border-l-4 border-l-indigo-500">
              <span className="text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">
                Disbursements Count
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {initialPayroll.length} Records
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-semibold">
                Electronic Receipts Available
              </span>
            </div>
          </div>

          {/* Payslips Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Disbursement History
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {initialPayroll.length} Pay Slips
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3.5">Disbursement Date</th>
                    <th className="px-6 py-3.5">Receipt Code</th>
                    <th className="px-6 py-3.5">Gross Amount</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {initialPayroll.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        No disbursed salary records found yet. Disbursed salaries from HR will appear here automatically.
                      </td>
                    </tr>
                  ) : (
                    initialPayroll.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">
                          {new Date(pay.payDate).toLocaleDateString("en-NG", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-600 dark:text-zinc-400">
                          {pay.receiptCode || "N/A"}
                        </td>
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-zinc-100">
                          {formatNaira(pay.amount)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {pay.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslip(pay)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-bold text-xs transition cursor-pointer shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>View Pay Slip</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE ELECTRONIC PAY SLIP MODAL                                       */}
      {/* ========================================================================= */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Actions Bar */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Electronic Pay Slip Voucher</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 dark:text-white" id="printable-payslip">
              {/* Institution Header */}
              <div className="text-center border-b-2 border-slate-900 dark:border-zinc-700 pb-4">
                <h2 className="text-xl font-black uppercase tracking-wider">{schoolName}</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Bursary & Payroll Administration</p>
                <div className="inline-block mt-2 px-3 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 font-mono text-[11px] font-bold">
                  Receipt: {selectedPayslip.receiptCode || "VOUCHER-PAYROLL"}
                </div>
              </div>

              {/* Staff Bio-Data Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Employee Name</span>
                  <span className="font-bold text-sm">{staffName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Designation & Role</span>
                  <span className="font-bold text-sm">{staffRole}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
                  <span className="font-semibold">{staffProfile?.department || "Academics"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Disbursement Date</span>
                  <span className="font-semibold">{new Date(selectedPayslip.payDate).toLocaleDateString("en-NG")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Name</span>
                  <span className="font-semibold">{staffProfile?.bankName || "First Bank"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
                  <span className="font-mono font-semibold">{staffProfile?.bankAccountNumber || "N/A"}</span>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 text-left">Component</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    <tr>
                      <td className="p-3">Basic Salary (70%)</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatNaira(selectedPayslip.amount * 0.7)}</td>
                    </tr>
                    <tr>
                      <td className="p-3">Housing & Transport Allowance (20%)</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatNaira(selectedPayslip.amount * 0.2)}</td>
                    </tr>
                    <tr>
                      <td className="p-3">Utility & Instructional Allowance (10%)</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatNaira(selectedPayslip.amount * 0.1)}</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-zinc-800/50 font-bold">
                      <td className="p-3">Gross Total Earnings</td>
                      <td className="p-3 text-right font-mono text-sm">{formatNaira(selectedPayslip.amount)}</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-slate-400">Total Statutory Deductions (Tax & Pension)</td>
                      <td className="p-3 text-right font-mono text-slate-400">₦0.00</td>
                    </tr>
                    <tr className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-black text-sm">
                      <td className="p-3">Net Take-Home Salary Disbursed</td>
                      <td className="p-3 text-right font-mono">{formatNaira(selectedPayslip.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Electronic Stamp Seal */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                <div>
                  <p className="text-slate-400 text-[10px]">Generated electronically by Bursary Portal</p>
                  <p className="font-semibold text-slate-700 dark:text-zinc-300">Status: {selectedPayslip.status}</p>
                </div>
                <div className="border-2 border-dashed border-emerald-600 text-emerald-600 px-3 py-1.5 rounded-lg text-center font-extrabold text-[10px] tracking-wider uppercase">
                  ELECTRONICALLY VERIFIED<br />
                  <span className="font-normal text-[9px]">BURSARY DISBURSEMENT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
