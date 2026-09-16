import React from "react";
import { cookies } from "next/headers";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import ExamsList from "./ExamsList";
import GradingRoster from "./GradingRoster";
import GradingConfigTab from "./GradingConfigTab";

export default async function ExamsPage({ 
  params: paramsPromise, 
  searchParams: searchParamsPromise 
}: { 
  params: Promise<{ schoolDomain: string }>; 
  searchParams: Promise<{ tab?: string; tier?: string; class?: string }>; 
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      academicTiers: {
        orderBy: { level: "asc" },
      },
    },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
        <p>No school registered under domain: {params.schoolDomain}</p>
      </div>
    );
  }

  // Resolve active tier from URL searchParams or cookie fallback
  const cookieStore = await cookies();
  const cookieTier = cookieStore.get("activeTier")?.value;
  const requestedTierParam = searchParams.tier;

  const activeTierObj = school.academicTiers.find((t) => {
    if (requestedTierParam) {
      return (
        sanitizeTierSlug(t.name) === sanitizeTierSlug(requestedTierParam) ||
        t.name.toLowerCase().includes(requestedTierParam.toLowerCase())
      );
    }
    if (cookieTier) {
      return (
        t.name.toLowerCase() === cookieTier.toLowerCase() ||
        sanitizeTierSlug(t.name) === sanitizeTierSlug(cookieTier)
      );
    }
    return false;
  }) || school.academicTiers[0];

  const activeTierName = activeTierObj ? activeTierObj.name : "";
  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);
  
  const [courses, exams, students, examResults] = await Promise.all([
    tenantDb.course.findMany({
      where: {
        schoolId: school.id,
      },
      include: { tier: true },
    }),
    tenantDb.exam.findMany({
      where: {
        schoolId: school.id,
      },
      include: { course: { include: { tier: true } } },
      orderBy: { date: 'asc' }
    }),
    tenantDb.student.findMany({
      where: {
        schoolId: school.id,
        status: { in: ["ENROLLED", "ACTIVE"] },
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
      include: { tier: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    }),
    tenantDb.examResult.findMany({
      where: {
        schoolId: school.id,
      }
    })
  ]);

  const activeTab = searchParams.tab || "exams";
  const savedTierConfigs = ((school.tierDatabasesConfig as any)?.assessmentWeights as Record<string, Record<string, number>>) || {};

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
          Assessments
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
          Schedule assessments, manage grading rosters, and configure grading metrics.
        </p>
      </header>
      
      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-8">
          <a
            href={`/${params.schoolDomain}/exams?tab=exams`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "exams"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            Scheduled Exams
          </a>
          <a
            href={`/${params.schoolDomain}/exams?tab=grading`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "grading"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            Grading Roster
          </a>
          <a
            href={`/${params.schoolDomain}/exams?tab=config`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "config"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            Grading Configuration
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
        ) : activeTab === "config" ? (
          <GradingConfigTab
            schoolId={school.id}
            schoolDomain={params.schoolDomain}
            initialTierName={activeTierName}
            savedConfigs={savedTierConfigs}
          />
        ) : (
          <GradingRoster 
            schoolId={school.id} 
            exams={exams} 
            students={students} 
            examResults={examResults}
            academicTiers={school.academicTiers}
            activeTierName={activeTierName}
          />
        )}
      </div>
      
    </div>
  );
}
