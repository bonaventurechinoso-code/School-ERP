"use client";

import React, { useState, useTransition } from "react";
import { markStudentAttendance } from "./actions";

type AttendanceProps = {
  schoolId: string;
  students: any[];
  attendanceRecords: any[];
};

export default function AttendanceView({ schoolId, students, attendanceRecords }: AttendanceProps) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Create a quick lookup for today's attendance
  const attendanceMap = new Map();
  attendanceRecords.forEach(record => {
    // Only map records that match the selected date (comparing YYYY-MM-DD)
    if (new Date(record.date).toISOString().split('T')[0] === date) {
      attendanceMap.set(record.studentId, record);
    }
  });

  const handleUpdateStatus = (studentId: string, newStatus: string) => {
    startTransition(() => {
      markStudentAttendance(schoolId, studentId, date, newStatus);
    });
  };

  const activeStudents = students.filter(s => s.status === "ENROLLED" || s.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800">Daily Student Attendance</h3>
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-slate-600">Select Date:</label>
          <input 
            type="date" 
            className="border border-slate-300 rounded-lg p-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Student Name</th>
              <th className="px-6 py-4 font-semibold">Email</th>
              <th className="px-6 py-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeStudents.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-lg">
                  No enrolled students found.
                </td>
              </tr>
            )}
            {activeStudents.map((student) => {
              const currentStatus = attendanceMap.get(student.id)?.status || "PRESENT"; // Default assuming they are present if unmarked, or you can default to unmarked
              return (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {student.firstName} {student.lastName}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{student.email || "—"}</td>
                  <td className="px-6 py-4">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 space-x-1">
                      <button
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(student.id, "PRESENT")}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition ${currentStatus === "PRESENT" ? "bg-green-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
                      >
                        Present
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(student.id, "ABSENT")}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition ${currentStatus === "ABSENT" ? "bg-red-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
                      >
                        Absent
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(student.id, "LATE")}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition ${currentStatus === "LATE" ? "bg-yellow-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
                      >
                        Late
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(student.id, "EXCUSED")}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition ${currentStatus === "EXCUSED" ? "bg-blue-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
                      >
                        Excused
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
