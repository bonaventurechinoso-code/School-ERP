import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import ExamsList from "./ExamsList";
import GradingRoster from "./GradingRoster";

export default async function ExamsPage({ params, searchParams }: { params: { schoolDomain: string }, searchParams: { tab?: string } }) {
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
        <p>No school registered under domain: {params.schoolDomain}</p>
      </div>
    );
  }

  const tenantDb = getTenantClient(school.id);
  
  const [courses, exams, students, examResults] = await Promise.all([
    tenantDb.course.findMany(),
    tenantDb.exam.findMany({
      include: { course: { include: { tier: true } } },
      orderBy: { date: 'asc' }
    }),
    tenantDb.student.findMany(),
    tenantDb.examResult.findMany()
  ]);

  const activeTab = searchParams.tab || "exams";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Exams & Grading
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Schedule assessments and manage student grades.
        </p>
      </header>
      
      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <a
            href={`/${params.schoolDomain}/exams?tab=exams`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "exams"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Scheduled Exams
          </a>
          <a
            href={`/${params.schoolDomain}/exams?tab=grading`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "grading"
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Grading Roster
          </a>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === "exams" ? (
          <ExamsList 
            schoolId={school.id} 
            exams={exams} 
            courses={courses} 
          />
        ) : (
          <GradingRoster 
            schoolId={school.id} 
            exams={exams} 
            students={students} 
            examResults={examResults}
          />
        )}
      </div>
      
    </div>
  );
}
