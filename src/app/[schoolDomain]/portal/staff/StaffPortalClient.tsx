"use client";

import React, { useState, useMemo, useEffect, useTransition, useRef } from "react";
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
  Download,
  FileText,
  Send,
  CalendarDays,
  Check,
  PlusCircle,
  FileCheck,
  KeyRound,
  ShieldAlert,
  Menu,
  LogOut,
  ArrowLeft,
  User,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import SecurityPasswordForm from "@/components/SecurityPasswordForm";
import {
  saveClassroomAttendance,
  saveClassroomGrades,
  fetchClassroomAttendance,
  fetchClassroomGrades,
  compileClassReportCardsFromStaffPortal,
  AttendanceRecordPayload,
  GradeEntryPayload,
  StaffProfileData,
  PayrollRecordItem,
  TimetablePeriodItem,
  LessonNoteData,
  fetchStaffLessonNotesAction,
  submitLessonNoteAction,
  LeaveRequestData,
  fetchStaffLeaveRequestsAction,
  submitLeaveRequestAction,
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
  initialLessonNotes?: LessonNoteData[];
  initialLeaveRequests?: LeaveRequestData[];
  defaultTab?: "overview" | "rosters" | "attendance" | "gradebook" | "schedule" | "lessons" | "leaves" | "payslips" | "security";
  isAccessDenied?: boolean;
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
  initialLessonNotes = [],
  initialLeaveRequests = [],
  defaultTab = "overview",
  isAccessDenied = false,
}: StaffPortalClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "rosters" | "attendance" | "gradebook" | "schedule" | "lessons" | "leaves" | "payslips" | "security">(defaultTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // Report Card Batch Compilation State
  const [isCompilingReportCards, setIsCompilingReportCards] = useState(false);
  const [compilationMessage, setCompilationMessage] = useState<string | null>(null);
  const [compilationError, setCompilationError] = useState<string | null>(null);

  // Lesson Notes State
  const [lessonNotes, setLessonNotes] = useState<LessonNoteData[]>(initialLessonNotes);
  const [showLessonNoteModal, setShowLessonNoteModal] = useState(false);
  const [selectedLessonNote, setSelectedLessonNote] = useState<LessonNoteData | null>(null);
  const [lessonFormData, setLessonFormData] = useState<LessonNoteData>({
    weekNumber: 1,
    subject: initialCourses[0]?.name || "General Mathematics",
    className: initialClassrooms[0]?.name || "JSS 1",
    topic: "",
    subTopic: "",
    objectives: "",
    instructionalMaterials: "",
    introduction: "",
    presentationSteps: "",
    evaluation: "",
    status: "SUBMITTED",
  });

  // Leave Requests State
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestData[]>(initialLeaveRequests);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState<LeaveRequestData>({
    leaveType: "CASUAL",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    reason: "",
    reliefTeacher: "",
    status: "PENDING",
  });

  // Payslip Modal State
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecordItem | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Profile Dropdown State
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Attendance CSV Export Handler
  const handleExportAttendanceCSV = () => {
    if (classStudents.length === 0) {
      alert("No students found in this class stream to export.");
      return;
    }

    const headers = ["Student Name", "Admission Number", "Class", "Date", "Status", "Notes"];
    const rows = classStudents.map((s) => {
      const name = `"${s.lastName}, ${s.firstName}"`;
      const adm = `"${s.admissionNumber || s.registrationNumber || "N/A"}"`;
      const cls = `"${selectedClass}"`;
      const dt = `"${attendanceDate}"`;
      const status = `"${attendanceMap[s.id]?.status || "PRESENT"}"`;
      const notes = `"${(attendanceMap[s.id]?.notes || "").replace(/"/g, '""')}"`;
      return [name, adm, cls, dt, status, notes].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_${selectedClass.replace(/\s+/g, "_")}_${attendanceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Report Card Batch Compilation Handler
  const handleCompileReportCards = () => {
    if (!selectedClass) {
      setCompilationError("Please select a classroom first.");
      return;
    }
    setIsCompilingReportCards(true);
    setCompilationMessage(null);
    setCompilationError(null);

    startTransition(async () => {
      try {
        const res = await compileClassReportCardsFromStaffPortal(
          schoolId,
          selectedClass,
          selectedTerm,
          academicYear
        );

        if (res.success) {
          setCompilationMessage(res.message || `Successfully compiled report cards for ${selectedClass}.`);
          setTimeout(() => setCompilationMessage(null), 8000);
        } else {
          setCompilationError(res.error || "Failed to compile class report cards.");
        }
      } catch (err: any) {
        setCompilationError(err.message || "An error occurred during report card compilation.");
      } finally {
        setIsCompilingReportCards(false);
      }
    });
  };

  // Lesson Note Handlers
  const handleSaveLessonNote = (status: "DRAFT" | "SUBMITTED") => {
    if (!staffProfile?.id) {
      alert("Staff profile not resolved. Please contact administrator.");
      return;
    }
    if (!lessonFormData.topic || !lessonFormData.objectives) {
      alert("Please enter a Topic and Behavioral Objectives.");
      return;
    }

    startTransition(async () => {
      const payload: LessonNoteData = {
        ...lessonFormData,
        status,
      };
      const res = await submitLessonNoteAction(schoolId, staffProfile.id, payload);
      if (res.success && res.note) {
        setLessonNotes((prev) => {
          const idx = prev.findIndex((n) => n.id === res.note!.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = res.note!;
            return copy;
          }
          return [res.note!, ...prev];
        });
        setShowLessonNoteModal(false);
        setLessonFormData({
          weekNumber: (lessonFormData.weekNumber % 14) + 1,
          subject: lessonFormData.subject,
          className: lessonFormData.className,
          topic: "",
          subTopic: "",
          objectives: "",
          instructionalMaterials: "",
          introduction: "",
          presentationSteps: "",
          evaluation: "",
          status: "SUBMITTED",
        });
      } else {
        alert(res.error || "Failed to save lesson note.");
      }
    });
  };

  // Leave Request Handler
  const handleSaveLeaveRequest = () => {
    if (!staffProfile?.id) {
      alert("Staff profile not resolved. Please contact administrator.");
      return;
    }
    if (!leaveFormData.reason.trim()) {
      alert("Please provide a reason for the leave application.");
      return;
    }

    startTransition(async () => {
      const res = await submitLeaveRequestAction(schoolId, staffProfile.id, leaveFormData);
      if (res.success && res.request) {
        setLeaveRequests((prev) => [res.request!, ...prev]);
        setShowLeaveModal(false);
        setLeaveFormData({
          leaveType: "CASUAL",
          startDate: new Date().toISOString().split("T")[0],
          endDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
          reason: "",
          reliefTeacher: "",
          status: "PENDING",
        });
      } else {
        alert(res.error || "Failed to submit leave request.");
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

  const staffInitials = useMemo(() => {
    if (!staffName) return "ST";
    const parts = staffName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }, [staffName]);

  const navSections = useMemo(
    () => [
      {
        title: "ACADEMIC ENGINE",
        items: [
          { id: "overview", label: "Dashboard Overview", icon: Briefcase, badge: null },
          { id: "rosters", label: "Classroom Rosters", icon: Users, badge: classStudents.length ? `${classStudents.length}` : null },
          { id: "attendance", label: "Daily Attendance", icon: CheckSquare, badge: "Daily" },
          { id: "gradebook", label: "Gradebook & Assessments", icon: Award, badge: null },
          { id: "schedule", label: "Teaching Schedule", icon: Calendar, badge: initialTimetable.length ? `${initialTimetable.length} hrs` : null },
          { id: "lessons", label: "Lesson Notes & Schemes", icon: BookOpen, badge: null },
        ],
      },
      {
        title: "PERSONNEL & ACCOUNT",
        items: [
          { id: "leaves", label: "Staff Leave Requests", icon: Clock, badge: initialLeaveRequests.length ? `${initialLeaveRequests.length}` : null },
          { id: "payslips", label: "My Remuneration & Payslips", icon: Receipt, badge: null },
          { id: "security", label: "Security & Password", icon: KeyRound, badge: null },
        ],
      },
    ],
    [classStudents.length, initialTimetable.length, initialLeaveRequests.length]
  );

  const allNavItems = useMemo(() => navSections.flatMap((s) => s.items), [navSections]);

  return (
    <div className="flex flex-1 h-screen max-h-screen w-full overflow-hidden bg-slate-50 transition-colors duration-200 dark:bg-zinc-950 relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. True Left-Hand Side Panel (Full-height persistent sidebar matching Admin layout) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 h-screen max-h-screen shrink-0 bg-slate-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:w-72 md:min-w-[18rem] md:max-w-[18rem] md:h-screen md:max-h-screen md:shrink-0 md:translate-x-0 overflow-hidden select-none ${
          isSidebarOpen ? "translate-x-0 shadow-2xl z-50" : "-translate-x-full"
        }`}
      >
        {/* Consolidated Tenant / Profile Header Block */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-700 to-emerald-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs border border-white/10 tracking-tight shrink-0 relative">
              {staffInitials}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 dark:ring-zinc-950 shadow-xs"
                title="Staff Active"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs sm:text-sm font-bold text-white tracking-tight leading-snug truncate">
                {staffName}
              </span>
              <span className="block text-[10px] text-slate-400 dark:text-zinc-400 font-medium truncate mt-0.5">
                {staffRole} • {schoolName}
              </span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all shrink-0 cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stream / Department Context Pill */}
        <div className="px-3.5 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between text-[11px] shrink-0">
          <span className="text-slate-400 font-medium truncate">{staffProfile?.department || "Academic Staff"}</span>
          <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md truncate max-w-[120px]">
            {selectedClass}
          </span>
        </div>

        {/* Navigation Architecture */}
        <nav className="flex-1 min-h-0 px-2.5 py-3 flex flex-col gap-1.5 overflow-y-auto overscroll-contain">
          {navSections.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-black text-slate-400 dark:text-zinc-500 tracking-widest uppercase">
                {group.title}
              </div>

              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-emerald-600/20 text-emerald-400 dark:text-emerald-300 font-bold border border-emerald-500/30"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    ) : item.badge ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold shrink-0">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Institutional & Profile Actions Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-150 cursor-pointer text-left group"
          >
            <LogOut className="w-4 h-4 text-rose-400 group-hover:text-rose-300 transition-colors shrink-0" />
            <span className="font-bold tracking-tight">Log out</span>
          </button>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/40">
            <span className="font-mono text-[10px] truncate max-w-[140px]">.{schoolDomain}</span>
            <span className="font-bold text-slate-300">2026/2027 Session</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto relative">
        {/* Unified Top Navigation / Status Header matching Admin layout */}
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-zinc-800/50 flex items-center justify-between gap-2.5 sm:gap-4 w-full px-3.5 sm:px-6 md:px-8 py-2.5 md:py-3.5 shadow-xs flex-shrink-0 sticky top-0 z-20 transition-colors duration-200">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              className="md:hidden w-10 h-10 -ml-1 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full active:scale-95 transition-all touch-manipulation flex items-center justify-center shrink-0 cursor-pointer"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 dark:text-zinc-400 font-bold truncate">
                  Staff Educator Workspace
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                  {selectedClass} Classroom Workspace
                </span>
              </div>
              <p className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-zinc-200 truncate">
                {schoolName} • {staffName}
              </p>
            </div>
          </div>

          {/* Top-right utility controls */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/teacher/my-class"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Teacher ERP</span>
            </Link>
            {/* Admin-pattern Profile Selection Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                aria-expanded={isProfileDropdownOpen}
                aria-haspopup="true"
                aria-label="Staff profile menu"
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 active:scale-98"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-700 to-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white dark:ring-zinc-900">
                  {staffInitials}
                </div>
                <div className="hidden md:flex flex-col text-left leading-tight pr-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[130px]">
                    {staffName}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 truncate max-w-[130px]">
                    {staffRole || "Teacher"}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${
                    isProfileDropdownOpen ? "rotate-180 text-emerald-500" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 select-none"
                >
                  {/* Top Header Section: User Snapshot */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-700 to-emerald-800 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {staffInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                          {staffName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                          {staffProfile?.email || "educator@school.edu"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50 uppercase tracking-wider">
                            STAFF EDUCATOR
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation List Options */}
                  <div className="py-1.5 px-1 space-y-0.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
                    {/* 1. Profile */}
                    <Link
                      href="/teacher/profile"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition-colors"
                    >
                      <User className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Profile</span>
                    </Link>

                    {/* 2. Security & Password */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("security");
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition-colors text-left cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Security & Password</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="my-1 border-t border-slate-100 dark:border-zinc-800/80" />

                  {/* 3. Log out */}
                  <div className="px-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 shrink-0 text-red-500" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* High-Density Dashboard Canvas Container */}
        <div className="p-4 md:p-8 pb-16 md:pb-16 flex-1 text-slate-900 dark:text-zinc-50 max-w-7xl mx-auto w-full space-y-6">
          {/* Access Denied Interception Notice */}
          {isAccessDenied && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/40 dark:to-amber-950/20 border border-red-200/90 dark:border-red-900/60 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-red-900 dark:text-red-200 uppercase tracking-wider">
                    Administrative Area Restricted
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-200 dark:bg-red-900 font-extrabold text-red-800 dark:text-red-200">
                    STAFF PERMISSION LOCK
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-red-800/90 dark:text-red-300/90 mt-1 font-medium leading-relaxed">
                  Super administrative consoles and billing/wallet configurations are strictly isolated to School and Platform Administrators. You have been redirected to your staff educator portal for <strong>{schoolName}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW & DASHBOARD METRICS                                       */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Dashboard Client Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                      Educator Command Center
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                      {staffRole} • Active Staff
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50 truncate">
                    Welcome, {staffName}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Classroom management for <strong className="font-semibold text-slate-700 dark:text-zinc-200">{schoolName}</strong> ({selectedClass}). Roll calls, continuous assessments, schedule, and remuneration.
                  </p>
                </div>

                {/* Quick Filter / Class Context Selector */}
                <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700/80">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Classroom</p>
                      <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="text-xs font-bold text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer"
                      >
                        {initialClassrooms.map((c) => (
                          <option key={c.id} value={c.name} className="dark:bg-zinc-900 text-slate-900 dark:text-white">
                            {c.name}
                          </option>
                        ))}
                        {initialClassrooms.length === 0 && (
                          <option value="JSS 1">JSS 1</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* High-Density Modular KPI Statistics Grid matching Admin benchmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                {/* 1. Assigned Classes */}
                <div
                  className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
                  style={{ borderTopColor: "#4f46e5" }}
                >
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
                      Assigned Classes
                    </h3>
                    <div
                      className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5"
                      style={{ backgroundColor: "#4f46e514", color: "#4f46e5" }}
                    >
                      <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-2 relative z-10">
                    <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
                      {initialClassrooms.length || 4}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
                      Active Cohorts
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#4f46e5" }} />
                  </div>
                </div>

                {/* 2. Total Students */}
                <div
                  className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
                  style={{ borderTopColor: "#0284c7" }}
                >
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
                      Total Students
                    </h3>
                    <div
                      className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5"
                      style={{ backgroundColor: "#0284c714", color: "#0284c7" }}
                    >
                      <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-2 relative z-10">
                    <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
                      {initialStudents.length}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
                      Enrolled Learners
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#0284c7" }} />
                  </div>
                </div>

                {/* 3. Weekly Periods */}
                <div
                  className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
                  style={{ borderTopColor: "#7c3aed" }}
                >
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
                      Weekly Periods
                    </h3>
                    <div
                      className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5"
                      style={{ backgroundColor: "#7c3aed14", color: "#7c3aed" }}
                    >
                      <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-2 relative z-10">
                    <p className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate">
                      {initialTimetable.length || 0}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
                      Scheduled Teaching Hours
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#7c3aed" }} />
                  </div>
                </div>

                {/* 4. Base Salary */}
                <div
                  className="p-6 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[165px] sm:min-h-[175px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 border-t-[3.5px] text-slate-900 dark:text-zinc-100 relative overflow-hidden group"
                  style={{ borderTopColor: "#059669" }}
                >
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
                      Base Salary
                    </h3>
                    <div
                      className="p-2 sm:p-2.5 rounded-xl shadow-2xs shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5"
                      style={{ backgroundColor: "#05966914", color: "#059669" }}
                    >
                      <Receipt className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-2 relative z-10">
                    <p className="text-2xl sm:text-3xl lg:text-[32px] font-black tracking-tight text-slate-900 dark:text-white leading-none truncate font-mono">
                      {formatNaira(staffProfile?.baseSalary || 220000)}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 relative z-10 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
                      Monthly Remuneration
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#059669" }} />
                  </div>
                </div>
              </div>

              {/* Educator Action Summary Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 pt-1">
                {/* 1. Daily Roll Call Readiness */}
                <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                        <CheckSquare className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Morning Roll Call</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Daily Register</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      Date: {attendanceDate}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      Synchronized attendance for {selectedClass} and assigned cohorts.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Ready for roll call
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("attendance")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors cursor-pointer"
                    >
                      Take Attendance <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 2. Assessment & Grading Matrix */}
                <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <Award className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Assessment Status</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">WAEC Standard</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedTerm} • {academicYear}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      Continuous assessment (CA1, CA2) and term examination entry.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Gradebook Active
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("gradebook")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                      Enter Scores <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 3. Assigned Cohorts Directory */}
                <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <Users className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Class Directory</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Rosters</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {classStudents.length} Learners in {selectedClass}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      Access student records, guardian emergency lines, and bio details.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {initialClassrooms.length} assigned stream(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("rosters")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      View Directory <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
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
          {/* Printable Attendance Sheet Header */}
          <div className="hidden print:block mb-6 text-center border-b border-slate-300 pb-4">
            <h1 className="text-xl font-black uppercase tracking-wide text-black">{schoolName}</h1>
            <p className="text-sm font-semibold text-slate-700">Official Daily Classroom Attendance Register</p>
            <div className="flex justify-between items-center text-xs mt-3 px-2 text-slate-800">
              <span><strong>Class / Arm:</strong> {selectedClass}</span>
              <span><strong>Date:</strong> {attendanceDate}</span>
              <span><strong>Staff Member:</strong> {staffName} ({staffRole})</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs print:hidden">
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

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleExportAttendanceCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition cursor-pointer"
                title="Export current classroom attendance register to CSV file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition cursor-pointer"
                title="Print physical attendance roster sheet"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Register</span>
              </button>
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

          {/* Print-only Teacher & Principal Signature Block */}
          <div className="hidden print:flex justify-between items-center mt-12 pt-6 border-t border-slate-400 text-xs text-black">
            <div>
              <p className="font-bold">Class Teacher Signature: _______________________</p>
              <p className="text-[10px] text-slate-600 mt-1">Date: {attendanceDate}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">Principal / Supervisor Seal: _______________________</p>
              <p className="text-[10px] text-slate-600 mt-1">Official Institutional Register Stamp</p>
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

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                disabled={isCompilingReportCards || isPending}
                onClick={handleCompileReportCards}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                title="Compile term report cards with class ranking, GPA, and subject summaries for all students in this class"
              >
                {isCompilingReportCards ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCheck className="w-3.5 h-3.5" />
                )}
                <span>{isCompilingReportCards ? "Compiling..." : "Compile Class Report Cards"}</span>
              </button>

              <button
                type="button"
                disabled={isPending || isCompilingReportCards}
                onClick={handleSaveGrades}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isPending ? "Persisting Marks..." : "Save Grades (Dual Sync)"}</span>
              </button>
            </div>
          </div>

          {compilationMessage && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{compilationMessage}</span>
            </div>
          )}

          {compilationError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{compilationError}</span>
            </div>
          )}

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

      {/* ========================================================================= */}
      {/* TAB 7: LESSON NOTES & SCHEMES OF WORK                                     */}
      {/* ========================================================================= */}
      {activeTab === "lessons" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header & Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <span>Lesson Notes & Curriculum Schemes</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Author, structure, and submit weekly teaching lesson plans for administrative inspection and HOD review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedLessonNote(null);
                setLessonFormData({
                  weekNumber: 1,
                  subject: initialCourses[0]?.name || "General Mathematics",
                  className: initialClassrooms[0]?.name || "JSS 1",
                  topic: "",
                  subTopic: "",
                  objectives: "",
                  instructionalMaterials: "",
                  introduction: "",
                  presentationSteps: "",
                  evaluation: "",
                  status: "SUBMITTED",
                });
                setShowLessonNoteModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Lesson Plan</span>
            </button>
          </div>

          {/* Metrics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">
                Total Lesson Plans
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{lessonNotes.length}</p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-500 block mb-1">
                Under Review
              </span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {lessonNotes.filter((n) => n.status === "SUBMITTED").length}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-500 block mb-1">
                Approved by HOD
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {lessonNotes.filter((n) => n.status === "APPROVED").length}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block mb-1">
                Drafts
              </span>
              <p className="text-2xl font-black text-slate-600 dark:text-zinc-300">
                {lessonNotes.filter((n) => n.status === "DRAFT").length}
              </p>
            </div>
          </div>

          {/* Lesson Plans List */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Weekly Instructional Submissions
              </h4>
              <span className="text-xs text-slate-400">
                Showing {lessonNotes.length} plan{lessonNotes.length === 1 ? "" : "s"}
              </span>
            </div>

            {lessonNotes.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300">No Lesson Notes Prepared Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Create your weekly scheme of work, objectives, instructional aids, and evaluation steps.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLessonNote(null);
                    setShowLessonNoteModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create First Lesson Note</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {lessonNotes.map((note) => {
                  const isApproved = note.status === "APPROVED";
                  const isSubmitted = note.status === "SUBMITTED";
                  const isRevision = note.status === "REVISION_REQUESTED";

                  const badgeStyle = isApproved
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : isSubmitted
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                    : isRevision
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                    : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

                  return (
                    <div
                      key={note.id || `${note.weekNumber}-${note.topic}`}
                      className="p-5 hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] uppercase">
                            Week {note.weekNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                            {note.className} • {note.subject}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>
                            {note.status}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white">{note.topic}</h5>
                        {note.subTopic && (
                          <p className="text-xs text-slate-600 dark:text-zinc-400">
                            <strong>Sub-Topic:</strong> {note.subTopic}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-zinc-500 line-clamp-1">
                          <strong>Objectives:</strong> {note.objectives}
                        </p>
                        {note.supervisorFeedback && (
                          <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                            <strong>HOD Review:</strong> {note.supervisorFeedback}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLessonNote(note);
                            setLessonFormData({ ...note });
                            setShowLessonNoteModal(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                        >
                          View & Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: FACULTY LEAVE REQUESTS                                             */}
      {/* ========================================================================= */}
      {activeTab === "leaves" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header & Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span>Staff Leave Applications & Absence</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Apply for statutory staff leave, assign relief teachers for class coverage, and track approval status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Apply for Leave</span>
            </button>
          </div>

          {/* Statutory Allowances & Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">
                Casual Leave Entitlement
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">7 Days / Yr</p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-500 block mb-1">
                Medical Leave Allowance
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">10 Days / Yr</p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-500 block mb-1">
                Pending Applications
              </span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {leaveRequests.filter((l) => l.status === "PENDING").length}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-500 block mb-1">
                Approved Records
              </span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {leaveRequests.filter((l) => l.status === "APPROVED").length}
              </p>
            </div>
          </div>

          {/* Leave History Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Application History & Duty Relief
              </h4>
              <span className="text-xs text-slate-400">
                {leaveRequests.length} Record{leaveRequests.length === 1 ? "" : "s"}
              </span>
            </div>

            {leaveRequests.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarDays className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300">No Leave Applications on Record</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  You have full attendance standing. When you require absence, submit an application here.
                </p>
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Apply for Leave</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-3.5">Leave Type</th>
                      <th className="px-6 py-3.5">Duration</th>
                      <th className="px-6 py-3.5">Relief Staff / Teacher</th>
                      <th className="px-6 py-3.5">Reason</th>
                      <th className="px-6 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5">Admin Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {leaveRequests.map((leave) => {
                      const isPendingStatus = leave.status === "PENDING";
                      const isApproved = leave.status === "APPROVED";
                      const badgeClass = isApproved
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : isPendingStatus
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                        : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";

                      return (
                        <tr key={leave.id || `${leave.startDate}-${leave.leaveType}`} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[11px]">
                              {leave.leaveType}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-700 dark:text-zinc-200">
                              {leave.startDate} to {leave.endDate}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {Math.max(1, Math.round((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / 86400000) + 1)} day(s)
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-700 dark:text-zinc-300">
                            {leave.reliefTeacher || "None Nominated"}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-zinc-400 max-w-xs truncate" title={leave.reason}>
                            {leave.reason}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                              {leave.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-zinc-400 text-xs">
                            {leave.adminNotes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 9: PERSONAL SECURITY & PASSWORD SETTINGS                             */}
      {/* ========================================================================= */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
          <SecurityPasswordForm
            schoolDomain={schoolDomain}
            userRole={staffRole || "STAFF"}
            brandColor="#059669"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT LESSON NOTE                                          */}
      {/* ========================================================================= */}
      {showLessonNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {selectedLessonNote ? "Edit Curriculum Lesson Plan" : "Prepare Weekly Lesson Note"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Standard educational delivery scheme & behavioral objectives
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLessonNoteModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                    Week Number (1 - 14):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={lessonFormData.weekNumber}
                    onChange={(e) =>
                      setLessonFormData((prev) => ({ ...prev, weekNumber: parseInt(e.target.value) || 1 }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                    Class Cohort:
                  </label>
                  <select
                    value={lessonFormData.className}
                    onChange={(e) =>
                      setLessonFormData((prev) => ({ ...prev, className: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  >
                    {initialClassrooms.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                    Subject / Course:
                  </label>
                  <select
                    value={lessonFormData.subject}
                    onChange={(e) =>
                      setLessonFormData((prev) => ({ ...prev, subject: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  >
                    {initialCourses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                    Topic: *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Quadratic Equations by Factorization"
                    value={lessonFormData.topic}
                    onChange={(e) => setLessonFormData((prev) => ({ ...prev, topic: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                    Sub-Topic (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Finding roots of trinomials"
                    value={lessonFormData.subTopic || ""}
                    onChange={(e) => setLessonFormData((prev) => ({ ...prev, subTopic: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Behavioral Objectives: * (By the end of the lesson, learners should be able to...)
                </label>
                <textarea
                  rows={2}
                  placeholder="1. Define quadratic equations in standard form. 2. Factorize ax^2 + bx + c = 0."
                  value={lessonFormData.objectives}
                  onChange={(e) => setLessonFormData((prev) => ({ ...prev, objectives: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Instructional Aids & Teaching Materials:
                </label>
                <input
                  type="text"
                  placeholder="Whiteboard, geometric models, graphing paper, flashcards"
                  value={lessonFormData.instructionalMaterials || ""}
                  onChange={(e) => setLessonFormData((prev) => ({ ...prev, instructionalMaterials: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Introduction / Prior Knowledge Hook:
                </label>
                <textarea
                  rows={2}
                  placeholder="Review linear equations and expansion of brackets with interactive questions."
                  value={lessonFormData.introduction || ""}
                  onChange={(e) => setLessonFormData((prev) => ({ ...prev, introduction: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Step-by-Step Presentation / Teacher & Student Activities:
                </label>
                <textarea
                  rows={3}
                  placeholder="Step 1: Teacher explains standard form ax^2 + bx + c = 0. Step 2: Teacher solves worked example on the board. Step 3: Students work in pairs on guided problem set."
                  value={lessonFormData.presentationSteps || ""}
                  onChange={(e) => setLessonFormData((prev) => ({ ...prev, presentationSteps: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Evaluation, Classwork & Homework:
                </label>
                <textarea
                  rows={2}
                  placeholder="Classwork: Exercises 1 to 4 on page 82. Homework: Solve questions 5 to 10 for submission on Thursday."
                  value={lessonFormData.evaluation || ""}
                  onChange={(e) => setLessonFormData((prev) => ({ ...prev, evaluation: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/40">
              <button
                type="button"
                onClick={() => setShowLessonNoteModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-300 font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSaveLessonNote("DRAFT")}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-white font-bold text-xs hover:bg-slate-300 dark:hover:bg-zinc-600 transition disabled:opacity-50 cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSaveLessonNote("SUBMITTED")}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPending ? "Submitting..." : "Submit for HOD Approval"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LEAVE APPLICATION                                                  */}
      {/* ========================================================================= */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Staff Leave Application
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Formal notice for statutory or medical absence
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Leave Category:
                </label>
                <select
                  value={leaveFormData.leaveType}
                  onChange={(e) => setLeaveFormData((prev) => ({ ...prev, leaveType: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                >
                  <option value="CASUAL">Casual Leave (Short absence)</option>
                  <option value="SICK">Medical / Sick Leave</option>
                  <option value="ANNUAL">Annual Leave / Recess</option>
                  <option value="COMPASSIONATE">Compassionate / Bereavement</option>
                  <option value="MATERNITY">Maternity Leave</option>
                  <option value="PATERNITY">Paternity Leave</option>
                  <option value="STUDY">Academic / Study Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                    Start Date:
                  </label>
                  <input
                    type="date"
                    value={leaveFormData.startDate}
                    onChange={(e) => setLeaveFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                    Resumption Date:
                  </label>
                  <input
                    type="date"
                    value={leaveFormData.endDate}
                    onChange={(e) => setLeaveFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Nominated Relief Teacher (For classroom coverage):
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mr. Chukwuemeka Eze (English Dept)"
                  value={leaveFormData.reliefTeacher || ""}
                  onChange={(e) => setLeaveFormData((prev) => ({ ...prev, reliefTeacher: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  Reason & Academic Handover Notes: *
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide details regarding the reason for leave and instructional plans handed over..."
                  value={leaveFormData.reason}
                  onChange={(e) => setLeaveFormData((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/40">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-300 font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveLeaveRequest}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPending ? "Submitting..." : "Submit Application"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </div>

        {/* Tenant Dashboard Footer matching Admin */}
        <footer className="mt-auto border-t border-slate-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs py-4 px-4 md:px-8 transition-colors duration-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span>Powered by BonaVee ICT • School ERP Platform</span>
            </div>
            <div className="text-center sm:text-right shrink-0">
              <span>© {new Date().getFullYear()} {schoolName}. All rights reserved.</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Logout Confirmation Modal matching School Admin pattern */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Log out?
            </h3>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
              Are you sure you want to end your current session for{" "}
              <strong>{schoolName || "this institution"}</strong>?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-2"
              >
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

