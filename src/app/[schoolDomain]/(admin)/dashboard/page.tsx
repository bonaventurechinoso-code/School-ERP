import React, { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCachedSchool } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import { isFinanceRole } from "@/lib/permissions";
import {
  StudentRosterCard,
  StaffStatusCard,
  FinancialSummaryCard,
  EventsStatusCard,
  DashboardSkeleton,
} from "./DashboardCards";
import DashboardClientHeader from "./DashboardClientHeader";
import { getClassroomsForTenant } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // Strict Request-Scoped Server Auth Verification (bound to target tenant)
  const [school, session] = await Promise.all([
    getCachedSchool(schoolDomain),
    getSession(undefined, schoolDomain),
  ]);

  if (!school) {
    redirect(`/login?error=tenant_not_found&school=${encodeURIComponent(schoolDomain)}`);
  }

  if (!session) {
    redirect(`/login?school=${encodeURIComponent(schoolDomain)}`);
  }

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">

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

        {/* 3. Verified Revenue Module (Protected) */}
        {isFinanceAuthorized && (
          <Suspense fallback={<DashboardSkeleton />}>
            <FinancialSummaryCard
              schoolId={school.id}
              subdomain={school.subdomain}
              activeTier={activeTier}
              primaryColor="#059669"
            />
          </Suspense>
        )}

        {/* 4. Events Module */}
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
