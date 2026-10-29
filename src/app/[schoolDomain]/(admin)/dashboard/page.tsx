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
import { isTenantSuspended } from "@/lib/tenantStatus";
import ReactivationBanner from "./ReactivationBanner";

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

  // Pre-fetch classrooms with safe fallback
  let classrooms: any[] = [];
  try {
    classrooms = await getClassroomsForTenant(school.id, activeTier);
  } catch (err) {
    console.error("[DASHBOARD] Failed to load classrooms:", err);
    classrooms = [];
  }

  const isSuspended = isTenantSuspended(school);

  // Fetch unread notifications for tenant
  let notifications: any[] = [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: { equals: schoolDomain, mode: "insensitive" } },
          { slug: { equals: schoolDomain, mode: "insensitive" } },
          { id: school.id },
        ],
      },
      select: { id: true },
    });
    const effectiveTenantId = tenant?.id || school.id;
    notifications = await prisma.tenantNotification.findMany({
      where: {
        tenantId: effectiveTenantId,
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  } catch (e) {
    console.warn("[DASHBOARD] Notifications fetch error:", e);
  }

  const serializedNotifications = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: Boolean(n.isRead),
    createdAt: (n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt)).toISOString(),
    actionUrl: n.actionUrl || null,
  }));

  const reactivationNotif = serializedNotifications.find(
    (n) => n.type === "SUBSCRIPTION_REACTIVATED"
  );

  const primaryColor = "#0f172a";
  const userRole = session?.role?.toUpperCase() || "";
  const staffRole = session?.staffRole || "";
  const isFinanceAuthorized = isFinanceRole(userRole, staffRole);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      {isSuspended && (
        <div className="bg-amber-500/10 border border-amber-300 text-amber-900 dark:text-amber-200 dark:border-amber-700/50 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm sm:text-base">Subscription Overdue - Institutional Access Restricted</p>
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
              Please renew your institutional platform license to restore full administrative services.
            </p>
          </div>
          <a
            href="/dashboard/subscription"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap ml-4"
          >
            Renew Now
          </a>
        </div>
      )}

      {reactivationNotif && (
        <ReactivationBanner
          notification={reactivationNotif}
          schoolDomain={schoolDomain}
        />
      )}

      {/* Decoupled Interactive Header & New Application Modal Trigger */}
      <DashboardClientHeader
        schoolName={school.name}
        primaryColor={primaryColor}
        schoolId={school.id}
        activeTier={activeTier}
        tiers={school.academicTiers || []}
        classrooms={classrooms}
      />

      {/* Asynchronous Modular KPI Card Grid with Independent Suspense Boundaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">

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
