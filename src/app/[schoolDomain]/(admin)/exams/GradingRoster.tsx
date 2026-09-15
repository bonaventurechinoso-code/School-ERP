"use client";

import React, { useState, useTransition } from "react";
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

  const handleSaveResult = (studentId: string, field: 'ca1' | 'ca2' | 'exam', valueStr: string) => {
    if (!selectedExam) return;
    
    const val = parseFloat(valueStr);
    const parsedVal = isNaN(val) ? 0 : val;

    const currentResult = currentExamResults.get(studentId) || { ca1Score: 0, ca2Score: 0, examScore: 0 };
    
    let ca1 = field === 'ca1' ? parsedVal : (currentResult.ca1Score || 0);
    let ca2 = field === 'ca2' ? parsedVal : (currentResult.ca2Score || 0);
    let exam = field === 'exam' ? parsedVal : (currentResult.examScore || 0);

    if (ca1 > 15) ca1 = 15;
    if (ca2 > 15) ca2 = 15;
    if (exam > 70) exam = 70;

    const totalScore = ca1 + ca2 + exam;

    const tierName = selectedExam.course?.tier?.name || "";
    const isHigherEd = tierName.toLowerCase().includes("higher") || tierName.toLowerCase().includes("university") || tierName.toLowerCase().includes("college");
    
    const percentage = Math.min((totalScore / 100) * 100, 100);
    const letterGrade = calculatePercentageToLetter(percentage, isHigherEd);

    startTransition(() => {
      upsertExamResult(schoolId, selectedExamId, studentId, totalScore, ca1, ca2, exam, letterGrade, "");
    });
  };

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

      {selectedExam && currentExamResults.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-4 flex items-center justify-between">
          <div className="text-indigo-800 dark:text-indigo-300 font-medium">Class Average Total</div>
          <div className="text-indigo-900 dark:text-indigo-200 font-bold text-xl">
            {(Array.from(currentExamResults.values()).reduce((sum, r) => sum + r.score, 0) / currentExamResults.size).toFixed(1)} / 100
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
                return (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{student.email || "—"}</td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" min="0" max="15" step="0.5" disabled={isPending}
                        defaultValue={result?.ca1Score ?? ""}
                        onBlur={(e) => handleSaveResult(student.id, 'ca1', e.target.value)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" min="0" max="15" step="0.5" disabled={isPending}
                        defaultValue={result?.ca2Score ?? ""}
                        onBlur={(e) => handleSaveResult(student.id, 'ca2', e.target.value)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" min="0" max="70" step="0.5" disabled={isPending}
                        defaultValue={result?.examScore ?? ""}
                        onBlur={(e) => handleSaveResult(student.id, 'exam', e.target.value)}
                        className="w-20 border border-slate-300 dark:border-slate-700 rounded p-1 text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                      {result?.score ?? "—"}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                      {result?.letterGrade || "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
