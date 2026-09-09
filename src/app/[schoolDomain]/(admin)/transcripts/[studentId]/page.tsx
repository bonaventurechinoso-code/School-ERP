import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { aggregateTranscripts } from "@/lib/gpa";

export default async function TranscriptPrintView({ params: paramsPromise }: { params: Promise<{ schoolDomain: string, studentId: string }> }) {
  const params = await paramsPromise;
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
  });

  if (!school) return <div>Tenant Not Found</div>;

  const tenantDb = getTenantClient(school.id);
  
  const student = await tenantDb.student.findUnique({
    where: { id: params.studentId },
    include: {
      ExamResult: {
        include: {
          exam: {
            include: { 
              course: {
                include: { tier: true }
              } 
            }
          }
        }
      }
    }
  });

  if (!student) return <div>Student Not Found</div>;

  const { semesters, cumulativeGPA, degreeClass } = aggregateTranscripts(student.ExamResult);

  return (
    <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 md:p-12 shadow-sm rounded-lg border border-slate-200 overflow-hidden">
      
      {/* Hide this action bar when printing */}
      <div className="flex justify-between items-center mb-8 pb-8 border-b border-slate-200 print:hidden">
        <a href={`/${params.schoolDomain}/transcripts`} className="text-indigo-600 hover:underline">
          ← Back to Transcripts
        </a>
        <button 
          className="bg-slate-800 text-white px-6 py-2 rounded shadow hover:bg-slate-900 transition"
        >
          Print Transcript
        </button>
        {/* We need a tiny client component for the print button, or just inject a script. */}
        <script dangerouslySetInnerHTML={{__html: `
          document.querySelector('button').addEventListener('click', function() {
            window.print();
          });
        `}} />
      </div>

      {/* Official Document Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-serif font-bold text-slate-900 uppercase tracking-widest">{school.name}</h1>
        <p className="text-slate-500 mt-2 text-sm uppercase tracking-widest">Official Academic Transcript</p>
      </div>

      {/* Student Details */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-10 pb-4 border-b-2 border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{student.firstName} {student.lastName}</h2>
          <p className="text-slate-500 mt-1">Student ID: <span className="font-mono text-slate-700">{student.id.substring(0, 8)}</span></p>
          <p className="text-slate-500">Status: {student.status}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-slate-500">Date Issued:</p>
          <p className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Subject Breakdown by Term / Semester */}
      <div className="mb-12 space-y-8">
        {semesters.length === 0 ? (
          <div className="py-8 text-center text-slate-500 italic border border-slate-200 rounded">
            No academic records found for this student.
          </div>
        ) : (
          semesters.map((sem, idx) => (
            <div key={idx} className="mb-6">
              <div className="flex justify-between items-center bg-slate-50 px-4 py-2 border-y border-slate-200">
                <h3 className="font-bold text-slate-800">{sem.semester}</h3>
                <span className="text-sm font-semibold text-slate-600">Term GPA: {sem.semesterGPA}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-slate-600 text-sm uppercase tracking-wider">
                    <th className="py-2 px-2">Subject Code</th>
                    <th className="py-2 px-2">Subject Name</th>
                    <th className="py-2 px-2 text-center">Score %</th>
                    <th className="py-2 px-2 text-center">Grade</th>
                    <th className="py-2 px-2 text-center">GPA Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sem.courseGrades.map((grade: any, gIdx: number) => (
                    <tr key={gIdx} className="group">
                      <td className="py-3 px-2 font-mono text-sm text-slate-600">{grade.courseCode}</td>
                      <td className="py-3 px-2 font-medium text-slate-900">{grade.courseName}</td>
                      <td className="py-3 px-2 text-center text-slate-700">{grade.percentage}%</td>
                      <td className="py-3 px-2 text-center font-bold text-slate-900">{grade.letterGrade}</td>
                      <td className="py-3 px-2 text-center text-slate-600 font-mono">{grade.gpaPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Final Summary */}
      <div className="flex justify-end border-t-2 border-slate-800 pt-6">
        <div className="text-right bg-slate-50 p-6 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-1">Cumulative Record</p>
          <p className="text-4xl font-extrabold text-slate-900">CGPA: {cumulativeGPA}</p>
          {degreeClass && (
            <p className="text-lg font-bold text-indigo-600 mt-2">{degreeClass}</p>
          )}
        </div>
      </div>

      <div className="mt-16 text-center text-xs text-slate-400 print:block">
        <p>This document was generated automatically by the {school.name} Information System.</p>
        <p>Any alteration or erasure voids this transcript.</p>
      </div>

    </div>
  );
}
