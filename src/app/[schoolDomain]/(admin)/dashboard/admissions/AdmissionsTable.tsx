"use client";

import React, { useTransition } from "react";
import { Student } from "@prisma/client";
import { advanceStudentState } from "./actions";
import { useTenant } from "@/lib/tenant-context";

export default function AdmissionsTable({ 
  students, 
  schoolId 
}: { 
  students: Student[], 
  schoolId: string 
}) {
  const [isPending, startTransition] = useTransition();
  const tenant = useTenant();

  const handleAdvance = (studentId: string, currentStatus: string, targetStatus: string) => {
    startTransition(() => {
      advanceStudentState(schoolId, studentId, currentStatus, targetStatus);
    });
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "PROSPECT":
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Prospect</span>;
      case "APPLICANT":
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Applicant</span>;
      case "SCREENED":
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Screened</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
          <tr>
            <th className="px-6 py-4 font-semibold">Student Name</th>
            <th className="px-6 py-4 font-semibold">Email</th>
            <th className="px-6 py-4 font-semibold">Current Status</th>
            <th className="px-6 py-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-lg">
                No active applicants in the pipeline right now.
              </td>
            </tr>
          )}
          {students.map((student) => (
            <tr key={student.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900">
                {student.firstName} {student.lastName}
              </td>
              <td className="px-6 py-4 text-slate-500">{student.email || "—"}</td>
              <td className="px-6 py-4">
                {renderStatus(student.status)}
              </td>
              <td className="px-6 py-4 text-right">
                
                {student.status === "PROSPECT" && (
                  <button 
                    disabled={isPending}
                    onClick={() => handleAdvance(student.id, student.status, "APPLICANT")}
                    className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded-lg transition disabled:opacity-50"
                  >
                    Move to Applicant
                  </button>
                )}
                
                {student.status === "APPLICANT" && (
                  <button 
                    disabled={isPending}
                    onClick={() => handleAdvance(student.id, student.status, "SCREENED")}
                    className="px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium rounded-lg transition disabled:opacity-50"
                  >
                    Mark Screened
                  </button>
                )}
                
                {student.status === "SCREENED" && (
                  <button 
                    disabled={isPending}
                    onClick={() => handleAdvance(student.id, student.status, "ENROLLED")}
                    className="px-4 py-2 text-white font-medium rounded-lg transition disabled:opacity-50 shadow-sm"
                    style={{ backgroundColor: tenant.branding.primaryColor }}
                  >
                    Enroll Student
                  </button>
                )}

              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
