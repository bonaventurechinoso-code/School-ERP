"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";

export default function ReportCardsPage() {
  const tenant = useTenant();
  const [term, setTerm] = useState("");
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");

  const hasFilters = term && className && subject;

  // Mock student roster for the UI layout
  const mockStudents = [
    { id: "1", name: "Ibrahim Musa", ca1: "", ca2: "", exam: "" },
    { id: "2", name: "Chisom Okafor", ca1: "", ca2: "", exam: "" },
    { id: "3", name: "Amina Bello", ca1: "", ca2: "", exam: "" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-slate-50 text-slate-900 min-h-screen pb-12">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: tenant.branding.primaryColor }}>
          Terminal Report Cards
        </h2>
        <p className="mt-2 text-lg text-slate-500">
          Continuous Assessment (CA) tracking, terminal exam scores, and automated primary report sheet generation.
        </p>
      </header>

      {/* Filter Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Filter Roster</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Term</label>
            <select 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Choose Term --</option>
              <option value="First Term">First Term</option>
              <option value="Second Term">Second Term</option>
              <option value="Third Term">Third Term</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Class</label>
            <select 
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Choose Class --</option>
              <option value="Primary 1">Primary 1</option>
              <option value="Primary 2">Primary 2</option>
              <option value="Primary 3">Primary 3</option>
              <option value="Primary 4">Primary 4</option>
              <option value="Primary 5">Primary 5</option>
              <option value="Primary 6">Primary 6</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Subject</label>
            <select 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Choose Subject --</option>
              <option value="Mathematics">Mathematics</option>
              <option value="English Language">English Language</option>
              <option value="Basic Science">Basic Science</option>
              <option value="Verbal Reasoning">Verbal Reasoning</option>
            </select>
          </div>
        </div>
      </div>

      {/* Roster Table or Placeholder */}
      {!hasFilters ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Awaiting Selection</h3>
          <p className="text-slate-500">
            Please select a term, class, and subject to begin entering student marks.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Student Name</th>
                  <th className="px-6 py-4 font-semibold">Continuous Assessment 1 (Max 20)</th>
                  <th className="px-6 py-4 font-semibold">Continuous Assessment 2 (Max 20)</th>
                  <th className="px-6 py-4 font-semibold">Terminal Exam Score (Max 60)</th>
                  <th className="px-6 py-4 font-semibold">Total Score</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockStudents.map((student) => {
                  const ca1Num = Number(student.ca1) || 0;
                  const ca2Num = Number(student.ca2) || 0;
                  const examNum = Number(student.exam) || 0;
                  const total = ca1Num + ca2Num + examNum;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="20" 
                          min="0"
                          className="w-24 border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="0 - 20"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="20" 
                          min="0"
                          className="w-24 border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="0 - 20"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="60" 
                          min="0"
                          className="w-24 border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="0 - 60"
                        />
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {total > 0 ? `${total}%` : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-xs shadow-sm">
                          <Save className="w-4 h-4" />
                          Save Grade
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
