import React from "react";
import { cookies } from "next/headers";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import GradingRoster from "../exams/GradingRoster";
import AnnualCompiledSheet from "../exams/AnnualCompiledSheet";
import Link from "next/link";
import { Award, FileSpreadsheet, GraduationCap, ArrowRight, Layers } from "lucide-react";

export default async function ResultsPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
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

  const cookieStore = await cookies();
  const cookieTier = cookieStore.get("activeTier")?.value;
  const requestedTierParam = searchParams.tier;

  const activeTierObj =
    school.academicTiers.find((t) => {
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

  const [courses, exams, students, examResults, gradeRecords, academicRecords, classrooms] =
    await Promise.all([
      tenantDb.course
        .findMany({
          where: { schoolId: school.id },
          include: { tier: true },
        })
        .catch(() => []),
      tenantDb.exam
        .findMany({
          where: { schoolId: school.id },
          include: { course: { include: { tier: true } } },
          orderBy: { date: "asc" },
        })
        .catch(() => []),
      tenantDb.student
        .findMany({
          where: {
            schoolId: school.id,
            status: { in: ["ENROLLED", "ACTIVE"] },
            ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
          },
          include: { tier: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
        .catch(() => []),
      tenantDb.examResult
        .findMany({
          where: { schoolId: school.id },
        })
        .catch(() => []),
      tenantDb.gradeRecord
        .findMany({
          where: { schoolId: school.id },
          orderBy: { updatedAt: "desc" },
        })
        .catch(() => []),
      tenantDb.academicRecord
        .findMany({
          where: { schoolId: school.id },
          orderBy: { updatedAt: "desc" },
        })
        .catch(() => []),
      tenantDb.classroom
        .findMany({
          where: { schoolId: school.id },
          orderBy: { name: "asc" },
        })
        .catch(() => []),
    ]);

  const activeTab = searchParams.tab || "annual";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <Award className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Result Processing & Annual Master Records
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
            Enterprise terminal grading broadsheets, annual session compiled sheets, and report card publishing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${params.schoolDomain}/report-cards`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition shadow-2xs"
          >
            <span>Print Student Report Cards</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          <a
            href={`/${params.schoolDomain}/results?tab=annual`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "annual"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            Annual Compiled Sheet (1st + 2nd + 3rd Term)
          </a>
          <a
            href={`/${params.schoolDomain}/results?tab=terminal`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "terminal"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            Terminal Grading Broadsheet
          </a>
          <a
            href={`/${params.schoolDomain}/exams?tab=exams`}
            className="whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            Scheduled Exams
          </a>
          <a
            href={`/${params.schoolDomain}/report-cards`}
            className="whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            Student Report Cards
          </a>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === "annual" ? (
          <AnnualCompiledSheet
            schoolId={school.id}
            schoolDomain={params.schoolDomain}
            schoolName={school.name}
            schoolTier={school.tier}
            exams={exams}
            students={students}
            examResults={examResults}
            gradeRecords={gradeRecords}
            academicRecords={academicRecords}
            courses={courses}
            classrooms={classrooms}
            academicTiers={school.academicTiers}
            activeTierName={activeTierName}
          />
        ) : (
          <GradingRoster
            schoolId={school.id}
            schoolDomain={params.schoolDomain}
            schoolName={school.name}
            schoolTier={school.tier}
            exams={exams}
            students={students}
            examResults={examResults}
            gradeRecords={gradeRecords}
            academicRecords={academicRecords}
            courses={courses}
            classrooms={classrooms}
            academicTiers={school.academicTiers}
            activeTierName={activeTierName}
          />
        )}
      </div>
    </div>
  );
}
