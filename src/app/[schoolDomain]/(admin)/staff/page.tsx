import React, { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import StaffTable from "./StaffTable";
import { fetchStaffPaginated } from "./actions";
import { Users, UserCheck, Briefcase, Clock, ShieldCheck } from "lucide-react";

export default async function StaffPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams?: Promise<{ tier?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};

  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      academicTiers: {
        orderBy: { level: "asc" }
      },
      departments: {
        include: {
          _count: { select: { staff: true } }
        },
        orderBy: { name: "asc" }
      }
    }
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
  const requestedTierParam = searchParams?.tier;

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
  }) || (school.academicTiers.length > 0 ? school.academicTiers[0] : null);

  const activeTierName = activeTierObj ? activeTierObj.name : (requestedTierParam || cookieTier || "");

  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);

  // Today's date range for staff turnout
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // High-performance parallel counts
  const [
    staffPagination,
    totalActive,
    totalOnboarding,
    teachersCount,
    adminsCount,
    todayTurnoutCount,
  ] = await Promise.all([
    fetchStaffPaginated(school.id, { limit: 25 }),
    tenantDb.staff.count({ where: { schoolId: school.id, status: "ACTIVE" } }).catch(() => 0),
    tenantDb.staff.count({ where: { schoolId: school.id, status: "ONBOARDING" } }).catch(() => 0),
    tenantDb.staff.count({
      where: {
        schoolId: school.id,
        status: "ACTIVE",
        OR: [
          { role: { contains: "Teacher", mode: "insensitive" } },
          { role: { contains: "Lecturer", mode: "insensitive" } },
          { role: { contains: "Instructor", mode: "insensitive" } },
          { role: { contains: "Professor", mode: "insensitive" } },
        ]
      }
    }).catch(() => 0),
    tenantDb.staff.count({
      where: {
        schoolId: school.id,
        status: "ACTIVE",
        OR: [
          { role: { contains: "Admin", mode: "insensitive" } },
          { role: { contains: "Principal", mode: "insensitive" } },
          { role: { contains: "Headmaster", mode: "insensitive" } },
          { role: { contains: "Bursar", mode: "insensitive" } },
          { role: { contains: "Officer", mode: "insensitive" } },
        ]
      }
    }).catch(() => 0),
    tenantDb.staffAttendance.count({
      where: {
        schoolId: school.id,
        date: { gte: todayStart, lte: todayEnd },
        status: { in: ["PRESENT", "LATE"] }
      }
    }).catch(() => 0),
  ]);

  const turnoutRate = totalActive > 0 ? Math.round((todayTurnoutCount / totalActive) * 100) : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER & TIER SWITCHER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            Staff Directory & Faculty Management
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm sm:text-base">
            Manage teachers, administrative officers, TRCN credentials, and daily attendance register.
          </p>
        </div>

        {/* Academic Tier Switcher Pills */}
        {school.academicTiers.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700/80 overflow-x-auto shrink-0">
            {school.academicTiers.map((tier) => {
              const isSelected = activeTierName.toLowerCase() === tier.name.toLowerCase();
              return (
                <Link
                  key={tier.id}
                  href={`/${params.schoolDomain}/staff?tier=${encodeURIComponent(tier.name)}`}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-700/50"
                  }`}
                >
                  {tier.name}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* STAFF METRICS SUMMARY (5 KPI CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Active */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Active Staff</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{totalActive}</p>
        </div>

        {/* Teachers / Faculty */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Faculty & Teachers</span>
            <UserCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{teachersCount}</p>
        </div>

        {/* Administrative & Support */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Admin & Support</span>
            <Briefcase className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{adminsCount}</p>
        </div>

        {/* Onboarding */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Onboarding / KYC</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{totalOnboarding}</p>
        </div>

        {/* Today's Turnout */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-purple-500 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Today&apos;s Turnout</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">
            {todayTurnoutCount}
            <span className="text-xs font-normal text-slate-400 ml-1">/ {totalActive} ({turnoutRate}%)</span>
          </p>
        </div>
      </div>
      
      <Suspense fallback={
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded-lg w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-lg"></div>
            ))}
          </div>
        </div>
      }>
        <StaffTable 
          staffList={staffPagination.items} 
          initialNextCursor={staffPagination.nextCursor}
          initialHasMore={staffPagination.hasMore}
          schoolId={school.id}
          departments={school.departments}
          schoolDomain={params.schoolDomain}
          schoolName={school.name}
          activeTier={activeTierName}
        />
      </Suspense>
      
    </div>
  );
}
