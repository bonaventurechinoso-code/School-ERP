import React, { Suspense } from "react";
import { cookies } from "next/headers";
import { getCachedSchool } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import { isFinanceRole } from "@/lib/permissions";
import {
  StudentRosterCard,
  StaffStatusCard,
  ApplicantPipelineCard,
  FinancialSummaryCard,
  EventsStatusCard,
  DashboardSkeleton,
} from "./DashboardCards";
import DashboardClientHeader from "./DashboardClientHeader";
import { getClassroomsForTenant } from "./actions";

export default async function TenantDashboard({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  // Concurrently resolve route parameters, query search parameters, and cookies
  const [params, searchParams, cookieStore] = await Promise.all([
    paramsPromise,
    searchParamsPromise,
    cookies(),
  ]);

  const schoolDomain = params.schoolDomain;
  const activeTier = searchParams.tier || cookieStore.get("activeTier")?.value || undefined;

  // Pre-fetch school metadata from Redis memory stream and user session in parallel
  const [school, session] = await Promise.all([
    getCachedSchool(schoolDomain),
    getSession(),
  ]);

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Institution Not Found</h2>
          <p>No active institutional tenant registered under domain: {schoolDomain}</p>
        </div>
      </div>
    );
  }

  // Resolve active tier object to immediately supply activeTierId to the pipeline card
  const activeTierObj = school.academicTiers.find((t) => {
    if (activeTier) {
      return (
        t.name.toLowerCase() === activeTier.toLowerCase() ||
        t.name.toLowerCase().includes(activeTier.toLowerCase())
      );
    }
    return false;
  }) || school.academicTiers[0];

  const activeTierId = activeTierObj?.id;

  // Pre-fetch classrooms for application modal (backed by Redis cache)
  const classrooms = await getClassroomsForTenant(school.id, activeTier);

  const primaryColor = "#0f172a";
  const userRole = session?.role?.toUpperCase() || "";
  const staffRole = session?.staffRole || "";
  const isFinanceAuthorized = isFinanceRole(userRole, staffRole);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      {/* Decoupled Interactive Header & New Application Modal Trigger */}
      <DashboardClientHeader
        schoolName={school.name}
        primaryColor={primaryColor}
        schoolId={school.id}
        activeTier={activeTier}
        tiers={school.academicTiers}
        classrooms={classrooms}
      />

      {/* Asynchronous Modular KPI Card Grid with Independent Suspense Boundaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
        
        {/* 1. Student Roster Module */}
        <Suspense fallback={<DashboardSkeleton />}>
          <StudentRosterCard
            schoolId={school.id}
            subdomain={school.subdomain}
            activeTier={activeTier}
            primaryColor="#4f46e5"
          />
        </Suspense>

        {/* 2. Staff Status Module */}
        <Suspense fallback={<DashboardSkeleton />}>
          <StaffStatusCard
            schoolId={school.id}
            activeTier={activeTier}
            primaryColor="#0284c7"
          />
        </Suspense>

        {/* 3. Applicant Pipeline Module */}
        <Suspense fallback={<DashboardSkeleton />}>
          <ApplicantPipelineCard
            schoolId={school.id}
            subdomain={school.subdomain}
            activeTier={activeTier}
            activeTierId={activeTierId}
            primaryColor="#d97706"
          />
        </Suspense>

        {/* 4. Financial Summary Module (Protected) */}
        {isFinanceAuthorized && (
          <Suspense fallback={<DashboardSkeleton />}>
            <FinancialSummaryCard
              schoolId={school.id}
              activeTier={activeTier}
              primaryColor="#059669"
            />
          </Suspense>
        )}

        {/* 5. Events Module */}
        <Suspense fallback={<DashboardSkeleton />}>
          <EventsStatusCard
            schoolId={school.id}
            activeTier={activeTier}
            primaryColor="#7c3aed"
          />
        </Suspense>

      </div>
    </div>
  );
}
