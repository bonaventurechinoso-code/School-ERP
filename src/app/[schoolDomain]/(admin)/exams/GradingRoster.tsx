"use client";

import React, { useState, useEffect, useTransition } from "react";
import { upsertExamResult } from "./actions";
import { calculatePercentageToLetter } from "@/lib/gpa";

type GradingRosterProps = {
  schoolId: string;
  exams: any[];
  students: any[];
  examResults: any[];
};

export default function GradingRoster({ schoolId, exams, students, examResults }: GradingRosterProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || "");

  // Map existing results for quick lookup: map[studentId] = result
  const currentExamResults = new Map();
  examResults.forEach(r => {
    if (r.examId === selectedExamId) {
      currentExamResults.set(r.studentId, r);
    }
  });

  const selectedExam = exams.find(e => e.id === selectedExamId);

  // Track row input states per student for real-time calculation & empty state checks
  const [scores, setScores] = useState<Record<string, { ca1: string; ca2: string; exam: string }>>({});

  // Sync state when exam selection changes
  useEffect(() => {
    const initialScores: Record<string, { ca1: string; ca2: string; exam: string }> = {};
    students.forEach((student) => {
      const res = examResults.find(
        (r) => r.examId === selectedExamId && r.studentId === student.id
      );
      const hasScores =
        res &&
        (res.ca1Score != null || res.ca2Score != null || res.examScore != null) &&
        (res.ca1Score > 0 || res.ca2Score > 0 || res.examScore > 0 || (res.score != null && res.score > 0));

      initialScores[student.id] = {
        ca1: hasScores && res?.ca1Score != null ? String(res.ca1Score) : "",
        ca2: hasScores && res?.ca2Score != null ? String(res.ca2Score) : "",
        exam: hasScores && res?.examScore != null ? String(res.examScore) : "",
      };
    });
    setScores(initialScores);
  }, [selectedExamId, examResults, students]);

  const getStudentScores = (studentId: string, result: any) => {
    if (scores[studentId]) {
      return scores[studentId];
    }
    const hasScores =
      result &&
      (result.ca1Score != null || result.ca2Score != null || result.examScore != null) &&
      (result.ca1Score > 0 || result.ca2Score > 0 || result.examScore > 0 || (result.score != null && result.score > 0));

    return {
      ca1: hasScores && result?.ca1Score != null ? String(result.ca1Score) : "",
      ca2: hasScores && result?.ca2Score != null ? String(result.ca2Score) : "",
      exam: hasScores && result?.examScore != null ? String(result.examScore) : "",
    };
  };

  const handleInputChange = (studentId: string, field: "ca1" | "ca2" | "exam", value: string, result: any) => {
    const current = getStudentScores(studentId, result);
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const handleSaveResult = (studentId: string, result: any) => {
    if (!selectedExam) return;

    const studentScores = getStudentScores(studentId, result);
    const ca1Str = studentScores.ca1.trim();
    const ca2Str = studentScores.ca2.trim();
    const examStr = studentScores.exam.trim();

    // Do NOT calculate or save if row is completely empty
    if (ca1Str === "" && ca2Str === "" && examStr === "") {
      return;
    }

    let ca1 = ca1Str !== "" ? parseFloat(ca1Str) : 0;
    let ca2 = ca2Str !== "" ? parseFloat(ca2Str) : 0;
    let exam = examStr !== "" ? parseFloat(examStr) : 0;

    if (isNaN(ca1)) ca1 = 0;
    if (isNaN(ca2)) ca2 = 0;
    if (isNaN(exam)) exam = 0;

    if (ca1 > 15) ca1 = 15;
    if (ca2 > 15) ca2 = 15;
    if (exam > 70) exam = 70;

    const totalScore = Math.round((ca1 + ca2 + exam) * 10) / 10;

    const tierName = selectedExam.course?.tier?.name || "";
    const isHigherEd =
      tierName.toLowerCase().includes("higher") ||
      tierName.toLowerCase().includes("university") ||
      tierName.toLowerCase().includes("college");

    const percentage = Math.min((totalScore / 100) * 100, 100);
    const letterGrade = calculatePercentageToLetter(percentage, isHigherEd);

    startTransition(() => {
      upsertExamResult(
        schoolId,
        selectedExamId,
        studentId,
        totalScore,
        ca1Str !== "" ? ca1 : undefined,
        ca2Str !== "" ? ca2 : undefined,
        examStr !== "" ? exam : undefined,
        letterGrade,
        ""
      );
    });
  };

  const gradedResults = Array.from(currentExamResults.values()).filter(
    (r) => (r.ca1Score != null || r.ca2Score != null || r.examScore != null) && r.score > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white w-full text-center sm:text-left">Grading Roster</h3>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:space-x-3 w-full sm:w-auto">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Select Exam:</label>
          <select 
            className="border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm w-full sm:w-64 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
          >
            {exams.map(e => (
              <option key={e.id} value={e.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                {e.name === "Terminal Assessment" ? "Termly Assessment" : e.name} ({e.semester}) - {e.course.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedExam && gradedResults.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-4 flex items-center justify-between">
          <div className="text-indigo-800 dark:text-indigo-300 font-medium">Class Average Total</div>
          <div className="text-indigo-900 dark:text-indigo-200 font-bold text-xl">
            {(gradedResults.reduce((sum, r) => sum + r.score, 0) / gradedResults.length).toFixed(1)} / 100
          </div>
        </div>
      )}

      {!selectedExam ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
          No exam selected. Please schedule an exam first.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">1st CA (Max: 15)</th>
                <th className="px-6 py-4 font-semibold">2nd CA (Max: 15)</th>
                <th className="px-6 py-4 font-semibold">Termly Exam (Max: 70)</th>
                <th className="px-6 py-4 font-semibold">Total (100)</th>
                <th className="px-6 py-4 font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {students.filter(s => s.status === "ENROLLED" || s.status === "ACTIVE").map((student) => {
                const result = currentExamResults.get(student.id);
                const studentScores = getStudentScores(student.id, result);
                const ca1Str = studentScores.ca1.trim();
                const ca2Str = studentScores.ca2.trim();
                const examStr = studentScores.exam.trim();

                // Format the automated email field as static, clean, read-only text string
                const studentEmail =
                  student.email ||
                  `${student.firstName ? student.firstName.charAt(0).toLowerCase() : "s"}.${student.lastName ? student.lastName.toLowerCase().replace(/[^a-z0-9]/g, "") : "student"}@school.edu`;

                // If the input boxes for a student row are empty or blank strings (''),
                // the 'Total' and 'Grade' cells must display a clean default placeholder hyphen ('—').
                const isEmptyRow = ca1Str === "" && ca2Str === "" && examStr === "";

                let totalDisplay: string = "—";
                let gradeDisplay: string = "—";

                if (!isEmptyRow) {
                  let ca1 = ca1Str !== "" ? parseFloat(ca1Str) : 0;
                  let ca2 = ca2Str !== "" ? parseFloat(ca2Str) : 0;
                  let exam = examStr !== "" ? parseFloat(examStr) : 0;

                  if (isNaN(ca1)) ca1 = 0;
                  if (isNaN(ca2)) ca2 = 0;
                  if (isNaN(exam)) exam = 0;

                  if (ca1 > 15) ca1 = 15;
                  if (ca2 > 15) ca2 = 15;
                  if (exam > 70) exam = 70;

                  const totalScore = Math.round((ca1 + ca2 + exam) * 10) / 10;
                  totalDisplay = String(totalScore);

                  const tierName = selectedExam.course?.tier?.name || "";
                  const isHigherEd =
                    tierName.toLowerCase().includes("higher") ||
                    tierName.toLowerCase().includes("university") ||
                    tierName.toLowerCase().includes("college");

                  const percentage = Math.min((totalScore / 100) * 100, 100);
                  gradeDisplay = calculatePercentageToLetter(percentage, isHigherEd);
                }

                return (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-300 select-none">
                      {studentEmail}
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" min="0" max="15" step="0.5" disabled={isPending}
                        value={studentScores.ca1}
                        onChange={(e) => handleInputChange(student.id, 'ca1', e.target.value, result)}
                        onBlur={() => handleSaveResult(student.id, result)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" min="0" max="15" step="0.5" disabled={isPending}
                        value={studentScores.ca2}
                        onChange={(e) => handleInputChange(student.id, 'ca2', e.target.value, result)}
                        onBlur={() => handleSaveResult(student.id, result)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" min="0" max="70" step="0.5" disabled={isPending}
                        value={studentScores.exam}
                        onChange={(e) => handleInputChange(student.id, 'exam', e.target.value, result)}
                        onBlur={() => handleSaveResult(student.id, result)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                      {totalDisplay}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                      {gradeDisplay}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

