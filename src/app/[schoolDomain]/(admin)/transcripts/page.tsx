import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { aggregateTranscripts } from "@/lib/gpa";

export default async function TranscriptsDashboard({ params }: { params: { schoolDomain: string } }) {
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: { academicTiers: true }
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
      </div>
    );
  }

  const isBasicEd = school.academicTiers.some(tier => 
    ["PRIMARY", "SECONDARY", "NURSERY", "HIGH SCHOOL", "DAYCARE"].some(t => tier.name.toUpperCase().includes(t))
  );

  const headerTitle = isBasicEd ? "Terminal Report Cards" : "Student Transcripts";
  const headerSubtitle = isBasicEd 
    ? "Continuous Assessment (CA) tracking, terminal exam scores, and automated report sheet generation." 
    : "Cumulative GPA tracking and official record generation.";
  const colHeader = isBasicEd ? "Terminal Average (%)" : "Cumulative GPA";
  const linkPath = isBasicEd ? "report-cards" : "transcripts";
  const linkLabel = isBasicEd ? "View Report Card" : "View Transcript";

  const tenantDb = getTenantClient(school.id);
  
  // Get all active students with their exam results
  const students = await tenantDb.student.findMany({
    where: { status: { in: ["ACTIVE", "ENROLLED"] } },
    include: {
      ExamResult: {
        include: {
          exam: {
            include: { course: true }
          }
        }
      }
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          {headerTitle}
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          {headerSubtitle}
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Student Name</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">{colHeader}</th>
              <th className="px-6 py-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No active students found.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const { cumulativeGPA } = aggregateTranscripts(student.ExamResult);
                
                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {student.lastName}, {student.firstName}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 text-base">
                      {cumulativeGPA}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a 
                        href={`/${params.schoolDomain}/${linkPath}/${student.id}`}
                        className="text-indigo-600 hover:text-indigo-900 font-medium bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition"
                      >
                        {linkLabel}
                      </a>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}
