"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  Award,
  Save,
  Filter,
  CheckCircle2,
  BookOpen,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { saveTeacherGrades } from "../actions";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string | null;
  currentClass?: string | null;
  cohort?: string | null;
  dynamicFields?: any;
}

interface TeacherGradebookClientProps {
  initialClass: string;
  initialSubject: string;
  initialTerm: string;
  initialAcademicYear: string;
  assignedClasses: string[];
  assignedSubjects: string[];
  students: Student[];
  initialGradesMap: Record<
    string,
    { ca1: number; ca2: number; exam: number; total: number; remarks: string }
  >;
  schoolName: string;
}

function resolveGrade(score: number): { letter: string; color: string } {
  if (score >= 75) return { letter: "A", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300" };
  if (score >= 65) return { letter: "B", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300" };
  if (score >= 50) return { letter: "C", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300" };
  if (score >= 40) return { letter: "P", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300" };
  return { letter: "F", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300" };
}

export function TeacherGradebookClient({
  initialClass,
  initialSubject,
  initialTerm,
  initialAcademicYear,
  assignedClasses,
  assignedSubjects,
  students,
  initialGradesMap,
  schoolName,
}: TeacherGradebookClientProps) {
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [selectedTerm, setSelectedTerm] = useState(initialTerm);
  const [selectedSession, setSelectedSession] = useState(initialAcademicYear || "2026/2027");
  const [selectedCohort, setSelectedCohort] = useState<string>("ALL");
  const [gradesMap, setGradesMap] = useState(initialGradesMap);
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Compute distinct cohorts present in students list
  const availableCohorts = useMemo(() => {
    const cohorts = new Set<string>();
    students.forEach((s) => {
      const c = s.cohort || s.dynamicFields?.cohort || s.dynamicFields?.admissionYear || (s.admissionNumber ? s.admissionNumber.split("/")[1] : "");
      if (c && /^\d{4}$/.test(String(c).trim())) {
        cohorts.add(String(c).trim());
      }
    });
    return Array.from(cohorts).sort();
  }, [students]);

  // Filter students by selectedCohort
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedCohort === "ALL") return true;
      const c = String(s.cohort || s.dynamicFields?.cohort || s.dynamicFields?.admissionYear || (s.admissionNumber ? s.admissionNumber.split("/")[1] : "")).trim();
      return c === selectedCohort;
    });
  }, [students, selectedCohort]);

  const handleScoreChange = (
    studentId: string,
    field: "ca1" | "ca2" | "exam" | "remarks",
    value: string
  ) => {
    setGradesMap((prev) => {
      const current = prev[studentId] || { ca1: 0, ca2: 0, exam: 0, total: 0, remarks: "" };
      const numVal = field === "remarks" ? 0 : Math.max(0, Number(value) || 0);

      const ca1 = field === "ca1" ? Math.min(20, numVal) : current.ca1;
      const ca2 = field === "ca2" ? Math.min(20, numVal) : current.ca2;
      const exam = field === "exam" ? Math.min(60, numVal) : current.exam;
      const remarks = field === "remarks" ? value : current.remarks;
      const total = ca1 + ca2 + exam;

      return {
        ...prev,
        [studentId]: { ca1, ca2, exam, total, remarks },
      };
    });
  };

  // Rank computation
  const rankedStudents = useMemo(() => {
    const list = filteredStudents.map((s) => {
      const g = gradesMap[s.id] || { ca1: 0, ca2: 0, exam: 0, total: 0, remarks: "" };
      return {
        student: s,
        ca1: g.ca1,
        ca2: g.ca2,
        exam: g.exam,
        total: g.total,
        remarks: g.remarks,
      };
    });

    const sorted = [...list].sort((a, b) => b.total - a.total);
    const rankMap = new Map<string, string>();
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
      rankMap.set(item.student.id, `${rank}${suffix}`);
    });

    return list.map((item) => ({
      ...item,
      position: rankMap.get(item.student.id) || "-",
    }));
  }, [filteredStudents, gradesMap]);

  // Overall stats
  const totalScores = rankedStudents.map((r) => r.total).filter((t) => t > 0);
  const classAverage =
    totalScores.length > 0
      ? Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length)
      : 0;
  const passCount = rankedStudents.filter((r) => r.total >= 40).length;

  const handleSaveGrades = () => {
    setSaveMessage(null);
    startTransition(async () => {
      const payload = filteredStudents.map((s) => {
        const g = gradesMap[s.id] || { ca1: 0, ca2: 0, exam: 0, total: 0, remarks: "" };
        return {
          studentId: s.id,
          ca1: g.ca1,
          ca2: g.ca2,
          exam: g.exam,
          remarks: g.remarks,
        };
      });

      try {
        const res = await saveTeacherGrades(
          selectedClass,
          selectedSubject,
          selectedTerm,
          selectedSession,
          payload
        );
        if (res.success) {
          setSaveMessage(`Successfully saved marks for ${res.count} students.`);
          setTimeout(() => setSaveMessage(null), 4000);
        }
      } catch (err: any) {
        setSaveMessage(`Error saving marks: ${err.message}`);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-1">
            <Award className="w-3.5 h-3.5" />
            <span>Academic Mark Entry</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Gradebook & Assessment Register
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Record continuous assessment scores (CA1, CA2) and terminal examinations.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Session / Academic Year */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Session:</span>
            <span className="text-slate-800 dark:text-zinc-200 font-mono font-bold">
              {selectedSession}
            </span>
          </div>

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

          {/* Cohort Select with Tooltip & Helper Text */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
              <span
                className="text-slate-400 font-bold uppercase text-[10px] cursor-help"
                title="Cohort = Year group that started together at this school. Example: Cohort 2026 = all students admitted to this school in 2026. It stays the same even when they move to Primary 2, 3, etc."
              >
                COHORT:
              </span>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer font-bold"
              >
                <option value="ALL" className="bg-white dark:bg-zinc-900">
                  All Cohorts
                </option>
                {availableCohorts.map((c) => (
                  <option key={c} value={c} className="bg-white dark:bg-zinc-900">
                    Cohort {c}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[9px] text-slate-400 italic mt-0.5">
              Cohort = Year group that started together
            </span>
          </div>

          {/* Subject Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            >
              {assignedSubjects.map((sub) => (
                <option key={sub} value={sub} className="bg-white dark:bg-zinc-900">
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Term Select */}
          <div className="bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            >
              <option value="1st Term" className="bg-white dark:bg-zinc-900">1st Term</option>
              <option value="2nd Term" className="bg-white dark:bg-zinc-900">2nd Term</option>
              <option value="3rd Term" className="bg-white dark:bg-zinc-900">3rd Term</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSaveGrades}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? "Saving..." : "Save Scores"}</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Class Average Score
            </p>
            <p className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-0.5">
              {classAverage}%
            </p>
          </div>
          <TrendingUp className="w-6 h-6 text-emerald-600 opacity-80" />
        </div>

        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Pass Rate (Score ≥ 40)
            </p>
            <p className="text-2xl font-black text-blue-950 dark:text-blue-200 mt-0.5">
              {students.length > 0 ? Math.round((passCount / students.length) * 100) : 0}%
            </p>
          </div>
          <CheckCircle2 className="w-6 h-6 text-blue-600 opacity-80" />
        </div>

        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Grading Schema
            </p>
            <p className="text-xs font-bold text-purple-950 dark:text-purple-200 mt-1">
              CA1 (20) + CA2 (20) + Exam (60) = 100
            </p>
          </div>
          <FileSpreadsheet className="w-6 h-6 text-purple-600 opacity-80" />
        </div>
      </div>

      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Grade Entry Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/80 dark:border-zinc-700">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-2 text-center w-20">CA 1 (20)</th>
                <th className="py-3 px-2 text-center w-20">CA 2 (20)</th>
                <th className="py-3 px-2 text-center w-20">Exam (60)</th>
                <th className="py-3 px-2 text-center w-20">Total (100)</th>
                <th className="py-3 px-2 text-center w-16">Grade</th>
                <th className="py-3 px-2 text-center w-16">Rank</th>
                <th className="py-3 px-2 text-center w-24">Promotion Status</th>
                <th className="py-3 px-3">Teacher Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {rankedStudents.length > 0 ? (
                rankedStudents.map((item, idx) => {
                  const grade = resolveGrade(item.total);
                  return (
                    <tr key={item.student.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        <div>{item.student.lastName}, {item.student.firstName}</div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.student.admissionNumber || "N/A"}
                        </span>
                      </td>

                      {/* CA1 Input */}
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={item.ca1 || ""}
                          onChange={(e) => handleScoreChange(item.student.id, "ca1", e.target.value)}
                          className="w-16 p-1.5 text-center font-mono font-bold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-emerald-500"
                        />
                      </td>

                      {/* CA2 Input */}
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={item.ca2 || ""}
                          onChange={(e) => handleScoreChange(item.student.id, "ca2", e.target.value)}
                          className="w-16 p-1.5 text-center font-mono font-bold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-emerald-500"
                        />
                      </td>

                      {/* Exam Input */}
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={item.exam || ""}
                          onChange={(e) => handleScoreChange(item.student.id, "exam", e.target.value)}
                          className="w-16 p-1.5 text-center font-mono font-bold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-emerald-500"
                        />
                      </td>

                      {/* Total Score */}
                      <td className="py-3 px-2 text-center font-mono font-black text-sm text-slate-900 dark:text-white">
                        {item.total}
                      </td>

                      {/* Letter Grade */}
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-black border ${grade.color}`}>
                          {grade.letter}
                        </span>
                      </td>

                      {/* Position / Rank */}
                      <td className="py-3 px-2 text-center font-bold text-slate-600 dark:text-zinc-300">
                        {item.position}
                      </td>

                      {/* Auto-Promotion Status */}
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          item.total >= 50
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300"
                            : item.total >= 40
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300"
                        }`}>
                          {item.total >= 50 ? "PROMOTED" : item.total >= 40 ? "TRIAL" : "REPEAT"}
                        </span>
                      </td>

                      {/* Teacher Remarks */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          placeholder="e.g. Excellent aptitude"
                          value={item.remarks}
                          onChange={(e) => handleScoreChange(item.student.id, "remarks", e.target.value)}
                          className="w-full min-w-[140px] px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-emerald-500"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 dark:text-zinc-500 font-medium">
                    No students enrolled in {selectedClass} for {selectedSession}. Ask Admin to Bulk Enroll.
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
