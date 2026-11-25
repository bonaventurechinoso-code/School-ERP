import React from "react";
import { cookies } from "next/headers";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import { getInstitutionTierConfig } from "@/lib/institution-tiers";
import ExamsList from "./ExamsList";
import GradingRoster from "./GradingRoster";
import GradingConfigTab from "./GradingConfigTab";
import AnnualCompiledSheet from "./AnnualCompiledSheet";

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

  // Authoritative Nigerian Institution Tier Configuration
  const tierConfig = getInstitutionTierConfig({
    schoolId: school.id,
    name: school.name,
    subdomain: params.schoolDomain,
    tier: school.tier,
    institutionType: (school as any).institutionType || (school as any).tertiaryType,
    academicTiers: school.academicTiers,
  });

  const activeTierName = activeTierObj ? activeTierObj.name : tierConfig.name;
  const isTertiary = tierConfig.key === "TERTIARY";
  const isCreche = tierConfig.key === "CRECHE";
  const isSecondary = tierConfig.key === "SECONDARY";
  const isPrimary = tierConfig.key === "PRIMARY";
  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);
  
  const [courses, exams, rawStudents, examResults, rawStaff, rawGradeRecords, rawAcademicRecords, rawReportCards, classrooms] = await Promise.all([
    tenantDb.course.findMany({
      where: {
        schoolId: school.id,
      },
      include: { tier: true },
    }).catch(() => []),
    tenantDb.exam.findMany({
      where: {
        schoolId: school.id,
      },
      include: { course: { include: { tier: true } } },
      orderBy: { date: 'asc' }
    }).catch(() => []),
    tenantDb.student.findMany({
      where: {
        schoolId: school.id,
        status: { in: ["ENROLLED", "ACTIVE"] },
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
      include: { tier: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    }).catch(() => []),
    tenantDb.examResult.findMany({
      where: {
        schoolId: school.id,
      }
    }).catch(() => []),
    tenantDb.staff.findMany({
      where: {
        schoolId: school.id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: {
          select: { role: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }).catch(() => []),
    tenantDb.gradeRecord.findMany({
      where: { schoolId: school.id },
      orderBy: { updatedAt: "desc" },
    }).catch(() => []),
    tenantDb.academicRecord.findMany({
      where: { schoolId: school.id },
      orderBy: { updatedAt: "desc" },
    }).catch(() => []),
    tenantDb.reportCard.findMany({
      where: { schoolId: school.id },
      orderBy: { updatedAt: "desc" },
    }).catch(() => []),
    tenantDb.classroom.findMany({
      where: { schoolId: school.id },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  let students = [...rawStudents];
  let gradeRecords = [...rawGradeRecords];
  let academicRecords = [...rawAcademicRecords];
  let reportCards = [...rawReportCards];

  if (tenantDb !== basePrisma) {
    const [baseStudents, baseGrades, baseAcademic, baseReportCards] = await Promise.all([
      basePrisma.student.findMany({
        where: {
          schoolId: school.id,
          status: { in: ["ENROLLED", "ACTIVE"] },
          ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
        },
        include: { tier: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      }).catch(() => []),
      basePrisma.gradeRecord.findMany({
        where: { schoolId: school.id },
        orderBy: { updatedAt: "desc" },
      }).catch(() => []),
      basePrisma.academicRecord.findMany({
        where: { schoolId: school.id },
        orderBy: { updatedAt: "desc" },
      }).catch(() => []),
      basePrisma.reportCard.findMany({
        where: { schoolId: school.id },
        orderBy: { updatedAt: "desc" },
      }).catch(() => []),
    ]);

    const sIds = new Set(students.map((s: any) => s.id));
    for (const bs of baseStudents) {
      if (!sIds.has(bs.id)) {
        students.push(bs);
        sIds.add(bs.id);
      }
    }

    const gIds = new Set(gradeRecords.map((g: any) => g.id));
    for (const bg of baseGrades) {
      if (!gIds.has(bg.id)) {
        gradeRecords.push(bg);
        gIds.add(bg.id);
      }
    }

    const aIds = new Set(academicRecords.map((a: any) => a.id));
    for (const ba of baseAcademic) {
      if (!aIds.has(ba.id)) {
        academicRecords.push(ba);
        aIds.add(ba.id);
      }
    }

    const rcIds = new Set(reportCards.map((rc: any) => rc.id));
    for (const brc of baseReportCards) {
      if (!rcIds.has(brc.id)) {
        reportCards.push(brc);
        rcIds.add(brc.id);
      }
    }
  }

  const staff = rawStaff.map((s: any) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    role: s.user?.role || "STAFF",
  }));

  // Strict isolation query for bonavee_scheduled_exams:
  // SELECT * FROM bonavee_scheduled_exams WHERE tenant_id = params.tenant ORDER BY exam_date DESC
  let scheduledExamsRaw: any[] = [];
  try {
    scheduledExamsRaw = await basePrisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM bonavee_scheduled_exams WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY exam_date DESC`,
      school.id,
      params.schoolDomain
    );
  } catch (err) {
    // Graceful fallback if table is freshly created
    scheduledExamsRaw = [];
  }

  const activeTab = searchParams.tab || "exams";
  const savedTierConfigs = ((school.tierDatabasesConfig as any)?.assessmentWeights as Record<string, Record<string, number>>) || {};

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border ${tierConfig.badgeColor}`}>
            {tierConfig.badgeLabel}
          </span>
          <span className="text-xs text-slate-400 font-medium">Session 2026/2027</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
          {isTertiary
            ? "Course Examinations & Assessment Records"
            : isCreche
            ? "Early Years Milestone Reviews & Assessments"
            : isSecondary
            ? "Examinations & Continuous Assessment"
            : "Continuous Assessment & Terminal Examinations"}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base max-w-4xl">
          {tierConfig.terminology.assessmentSubtitle}
        </p>
      </header>
      
      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          <a
            href={`/${params.schoolDomain}/exams?tab=exams`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "exams"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            {isTertiary
              ? "Course Examination Schedules"
              : isCreche
              ? "Developmental Milestone Reviews"
              : "Scheduled Examinations & CAs"}
          </a>
          <a
            href={`/${params.schoolDomain}/exams?tab=grading`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "grading"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            {isTertiary
              ? "Semester Course Grade Roster"
              : isCreche
              ? "Milestone Evaluation Broadsheet"
              : "Continuous Assessment Broadsheet"}
          </a>
          <a
            href={`/${params.schoolDomain}/exams?tab=annual`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "annual"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            {isTertiary
              ? "Sessional CGPA Master Broadsheet (1st & 2nd Semester)"
              : isCreche
              ? "Annual Developmental Profile"
              : isSecondary
              ? "Annual Promotion Broadsheet"
              : "Annual Compiled Broadsheet"}
          </a>
          <a
            href={`/${params.schoolDomain}/report-cards`}
            className="whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            {tierConfig.terminology.reportCardLabel}
          </a>
          <a
            href={`/${params.schoolDomain}/exams?tab=config`}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "config"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            {isTertiary
              ? "NUC / NBTE CGPA & Degree Classification"
              : "Grading Configuration"}
          </a>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === "exams" ? (
          <ExamsList 
            schoolId={school.id} 
            schoolDomain={params.schoolDomain}
            schoolName={school.name}
            schoolTier={school.tier}
            exams={exams} 
            scheduledExams={scheduledExamsRaw}
            courses={courses} 
            staff={staff}
            classrooms={classrooms}
            academicTiers={school.academicTiers}
            tierName={activeTierName}
          />
        ) : activeTab === "config" ? (
          <GradingConfigTab
            schoolId={school.id}
            schoolDomain={params.schoolDomain}
            initialTierName={activeTierName}
            savedConfigs={savedTierConfigs}
          />
        ) : activeTab === "annual" ? (
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
            reportCards={reportCards}
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
            reportCards={reportCards}
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
